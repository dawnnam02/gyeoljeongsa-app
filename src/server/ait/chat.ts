// AIT-A · 연애 고민 정리 챗봇 — 서버가 단계 · 턴 · 칸을 쥐고, 모델은 말만 한다.
// 흐름(요청 하나 = 업체 호출 최대 1회, 재생성 호출 0 — 보안 AC-28 · AC-32):
//   prepareTurn()  입력 문(위기 · 폭력 · 오용) → 가리기 · 감싸기 → 단계 결정 → 호출 꼴
//   (앱 서버 함수가 업체를 한 번 부른다)
//   finishTurn()   출력 검사(문장마다 근거 번호) → 통과하면 새 봉투 · 화면용 문장, 아니면 blocked_output(턴 안 올림)
// 이 파일은 업체를 부르지 않고 키 · 접근 코드를 다루지 않는다.

import type { ApiMessage, ChatSlots, Kind, ModelFlag, StageId } from './types.ts';
import { KINDS, MODEL_FLAGS } from './types.ts';
import type { ResponseCode } from './codes.ts';
import { charLen, endsWithHaeyo, hasResidualPii, maskText, quoteInSource, sanitize, wrapState, wrapTurn } from './text.ts';
import { classifyHits, hasDiagnosisAsk, hasDiagnosisRequest, hasInjectionShape, hasMoneyHint, hasVerdictRequest } from './lexicon.ts';
import type { FixedCard } from './fixed.ts';
import { composeSafety, composeSafetyFromFlags } from './safety.ts';
import {
  ALWAYS_LINE, CARD_NOTE, CHAT_FOOTER, CHAT_GUESS_NOTE, CRISIS_CARD, MINOR_CARD, MISUSE_CARD, MONEY_CAUTION,
  PRACTICAL_LABEL, SESSION_END_CARD, SOFT_HELP_LINES, VIOLENCE_CARD, WEAK_LABEL,
} from './fixed.ts';
import { CHAT_ALLOW_PHRASES, CHAT_RULES, checkText, contactHit } from './rules.ts';
import type { EvidenceCard } from './cards.ts';
import { citationFor, isPractical } from './cards.ts';

// ---------------------------------------------------------------- 상수 (10-31 본인 결정 D-236: 턴 상한 뗌)
// 단계별 횟수(STAGE_CAPS S1~S4)는 흐름의 짜임이고 사용자 한도가 아니다. 결론(S5) 뒤에는 사용자가 '충분해요'를 고르기 전까지 이어 말할 수 있다.
// 오래된 턴은 원문 대신 짧은 digest 로 접어 한 요청의 크기가 턴 수와 무관하게 묶인다(아래 FOLD_*).
export const FOLD_AT_TURNS = 14;      // 원문으로 들고 있는 턴이 이 수를 넘으면
export const FOLD_TURNS = 6;          // 가장 오래된 이 수의 턴을 digest 로 접는다
export const FOLD_CLIP = 80;          // 접힌 턴의 말은 이 글자 수만 남긴다(모델이 보는 것 = 서버가 인용 대조에 쓰는 것)
export const DIGEST_MAX_CHARS = 2400; // digest 상한(넘치면 오래된 앞쪽부터 잘라 낸다)
export const STAGE_ORDER: readonly StageId[] = ['S1', 'S2', 'S3', 'S4', 'S5'];
export const STAGE_CAPS: Readonly<Record<StageId, number>> = { S1: 3, S2: 2, S3: 2, S4: 3, S5: Number.POSITIVE_INFINITY };   // S5 = 상한 없음
export const CHAT_LIMITS = {
  askerMax: 600,        // 질문자 글 한 번 (보안 제안 1,000자 → 원가표로 낮춤)
  partnerMax: 800,      // 상대가 보낸 말 칸 한 번 (보안 제안 1,500자)
  aliasMax: 20,
  maxCrisisCards: 5,    // 위기 카드가 이만큼 나오면 세션을 닫는다
  maxBlocked: 4,        // 검사 탈락(blocked_output)이 이만큼 쌓이면 세션을 닫는다(재전송 반복으로 돈이 새는 길 차단)
  sentenceMax: 140,
  sentenceMin: 4,
  quoteMax: 60,
  slotValueMax: 60,
} as const;
/** 단계별 max_tokens(thinking 포함). 보안 제안 ≤ 1,000은 JSON 틀 + 근거 인용 + thinking을 담기엔 모자라 단계별로 올림 */
export const STAGE_MAX_TOKENS: Readonly<Record<StageId, number>> = { S1: 1500, S2: 1500, S3: 2500, S4: 1500, S5: 3000 };

// ---------------------------------------------------------------- 칩
export type ChipCode =
  | 'stage_before' | 'stage_chat' | 'stage_after' | 'stage_other'
  | 'problem_yes' | 'problem_edit' | 'unknown'
  | 'react_yes' | 'react_some' | 'react_no'
  | 'state_1' | 'state_2' | 'state_3' | 'state_4'
  | 'enough' | 'skip';

export const CHIP_LABEL: Readonly<Record<ChipCode, string>> = {
  stage_before: '만나기 전이에요', stage_chat: '대화방에서 이야기 중이에요', stage_after: '만난 뒤예요', stage_other: '그 밖이에요',
  problem_yes: '맞아요', problem_edit: '조금 달라요', unknown: '모르겠어요',
  react_yes: '맞아요', react_some: '조금 맞아요', react_no: '아니에요',
  state_1: '조금 신경 쓰여요', state_2: '계속 마음에 걸려요', state_3: '일상에 영향이 있어요', state_4: '많이 힘들어요',
  enough: '충분해요', skip: '그냥 결론만',
};
const CHIP_STAGES: Readonly<Record<ChipCode, readonly StageId[]>> = {
  stage_before: ['S1'], stage_chat: ['S1'], stage_after: ['S1'], stage_other: ['S1'],
  problem_yes: ['S1'], problem_edit: ['S1'], unknown: ['S2'],
  react_yes: ['S3'], react_some: ['S3'], react_no: ['S3'],
  state_1: ['S4'], state_2: ['S4'], state_3: ['S4'], state_4: ['S4'],
  enough: ['S5'], skip: ['S1', 'S2', 'S3', 'S4'],
};
export function isChipCode(v: unknown): v is ChipCode {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CHIP_LABEL, v);
}

// ---------------------------------------------------------------- 상태 · 봉투
export type SlotKey = keyof ChatSlots;
export type StoredSlots = Partial<Record<SlotKey, string | string[]>>;
const STAGE_SLOT_KEYS: Readonly<Record<StageId, readonly SlotKey[]>> = {
  S1: ['fact', 'my_reading', 'wish', 'problem_line'],
  S2: ['other_obs', 'my_guess', 'context'],
  S3: ['traits'],
  S4: ['my_need', 'my_line', 'deadline'],
  S5: [],
};
const LIST_SLOTS: readonly SlotKey[] = ['other_obs', 'traits'];

export interface ChatState {
  v: 1;
  stage: StageId;
  stageTurn: number;     // 이 단계에서 끝난 AI 턴 수
  aiTurns: number;       // 세션 전체 AI 턴 수(통계 — 상한 없음)
  userTurns: number;     // 받아들인 질문자 말 수
  safety: boolean;       // 폭력 · 스토킹 안전 트랙
  crisisCards: number;
  ended: boolean;
  s5Delivered: boolean;
  historyChars: number;  // 질문자가 보낸 글 합(통계 — 상한 없음)
  folded: number;        // digest 로 접힌 턴 수 (messages 에는 (userTurns - folded) 턴만 남는다)
  /** 검사에 걸려 보여 주지 못한 답의 수(턴은 안 올라가지만 돈은 든다) — 이만큼 쌓이면 세션을 닫는다 */
  blocked: number;
  slots: StoredSlots;
  chips: { problem_confirmed?: boolean; reaction?: 'yes' | 'some' | 'no'; my_state?: number; unknown?: boolean; stage_code?: string; enough?: boolean };
}

export interface UserTexts { asker: string; partner: string }

export interface DisplayRef { label: string; type: 'user' | 'card'; quote?: string; cardId?: string; citation?: string; limit?: string; practical?: boolean }
export interface DisplaySentence { kind: Kind; text: string; refs: DisplayRef[]; weak: boolean }
export interface DisplayTurn {
  stage: StageId;
  progress: number;                 // 1 ~ 5 (점 다섯 개 중 몇 번째 — 남은 횟수 숫자는 보이지 않는다)
  sentences: DisplaySentence[];
  notes: string[];                  // 고정 줄(서버가 붙임)
  chips: ChipCode[];                // 다음 입력에서 보여 줄 칩
  ended: boolean;
}

export interface ChatEnvelope {
  state: ChatState;
  /** 접힌 앞부분의 짧은 기록(내 말 번호 + 앞 80자). 첫 user 메시지 앞에 <앞이야기>로 붙는다 */
  digest: string;
  userTexts: UserTexts[];
  /** API 형식 이력 그대로(assistant는 받은 content 블록 전체). 앞 턴을 고치거나 빼지 않는다 — 캐시 · 생각 블록 검사 */
  messages: ApiMessage[];
  conclusion: DisplaySentence[] | null;
}

export function newSession(): ChatEnvelope {
  return {
    state: {
      v: 1, stage: 'S1', stageTurn: 0, aiTurns: 0, userTurns: 0, safety: false, crisisCards: 0, ended: false,
      s5Delivered: false, historyChars: 0, folded: 0, blocked: 0, slots: {}, chips: {},
    },
    digest: '', userTexts: [], messages: [], conclusion: null,
  };
}

// ---------------------------------------------------------------- 턴 계획(이번 턴에 써야 하는 문장)
export interface PlanItem { kinds: readonly Kind[]; min: number; max: number }
export interface Plan { stage: StageId; t: number; items: PlanItem[]; allowed: Kind[]; maxTokens: number }

export function planFor(state: ChatState): Plan {
  const stage = state.stage;
  const t = state.stageTurn + 1;
  let items: PlanItem[];
  switch (stage) {
    case 'S1':
      items = [
        { kinds: ['restate'], min: 1, max: 2 },
        { kinds: ['problem_line'], min: t >= 2 ? 1 : 0, max: t >= 2 ? 1 : 0 },
        { kinds: ['question'], min: 1, max: 1 },
      ];
      break;
    case 'S2':
      items = [
        { kinds: ['restate'], min: 1, max: 2 },
        { kinds: ['summary'], min: 0, max: t >= 2 ? 1 : 0 },
        { kinds: ['question'], min: 1, max: 1 },
      ];
      break;
    case 'S3':
      items = t === 1
        ? [
          { kinds: ['trait', 'reason'], min: 1, max: 3 },
          { kinds: ['counter'], min: 1, max: 1 },
          { kinds: ['check'], min: 1, max: 1 },
          { kinds: ['question'], min: 0, max: 1 },
        ]
        : [
          { kinds: ['restate'], min: 1, max: 1 },
          { kinds: ['trait', 'reason'], min: 0, max: 2 },
          { kinds: ['counter'], min: 0, max: 1 },
          { kinds: ['check'], min: 0, max: 1 },
        ];
      break;
    case 'S4':
      items = [
        { kinds: ['restate'], min: 1, max: 2 },
        { kinds: ['question'], min: 1, max: 1 },
      ];
      break;
    default:
      items = t === 1 && !state.s5Delivered
        ? [
          { kinds: ['direction'], min: 1, max: 1 },
          { kinds: ['because'], min: 1, max: 3 },
          { kinds: ['option'], min: 2, max: 3 },
          { kinds: ['first_action'], min: 1, max: 1 },
          { kinds: ['change_if'], min: 0, max: 1 },
          { kinds: ['question'], min: 0, max: 1 },
        ]
        : [
          { kinds: ['restate', 'because', 'option', 'first_action', 'change_if'], min: 1, max: 6 },
          { kinds: ['question'], min: 0, max: 1 },
        ];
  }
  const allowed = Array.from(new Set(items.flatMap((i) => i.kinds.filter(() => true)))) as Kind[];
  // min/max가 0인 종류는 허용 목록에서 뺀다
  const reallyAllowed = allowed.filter((k) => items.some((i) => i.kinds.includes(k) && i.max > 0));
  return { stage, t, items, allowed: reallyAllowed, maxTokens: STAGE_MAX_TOKENS[stage] };
}

/** 모델에게 보이는 need 글: ["restate:1-2","question:1"] */
export function needStrings(plan: Plan): string[] {
  return plan.items.filter((i) => i.max > 0).map((i) => `${i.kinds.join('|')}:${i.min === i.max ? i.min : `${i.min}-${i.max}`}`);
}

// ---------------------------------------------------------------- 단계 이동(서버 규칙으로만)
function stageDone(st: ChatState): boolean {
  const cap = STAGE_CAPS[st.stage];
  if (st.stageTurn >= cap) return true;
  switch (st.stage) {
    case 'S1': return st.chips.problem_confirmed === true;
    case 'S2': {
      const obs = st.slots.other_obs;
      const nObs = Array.isArray(obs) ? obs.length : 0;
      return nObs >= 2 && (!!st.slots.my_guess || st.chips.unknown === true);
    }
    case 'S3': return st.chips.reaction === 'yes';
    case 'S4': return typeof st.chips.my_state === 'number' && !!st.slots.my_need;
    default: return st.s5Delivered && st.chips.enough === true;
  }
}

function nextStageOf(st: ChatState): StageId | null {
  const i = STAGE_ORDER.indexOf(st.stage);
  let next = STAGE_ORDER[i + 1];
  if (!next) return null;
  if (st.safety) while (next === 'S2' || next === 'S3') next = STAGE_ORDER[STAGE_ORDER.indexOf(next) + 1] as StageId;
  return next;
}

/** 이번 호출의 단계를 정한다(상태를 바꾼 복사본을 돌려준다) */
export function resolveStage(input: ChatState): ChatState {
  const st: ChatState = { ...input, slots: { ...input.slots }, chips: { ...input.chips } };
  for (let guard = 0; guard < 6; guard++) {
    if (st.stage === 'S5') break;
    if (!stageDone(st)) break;
    const nx = nextStageOf(st);
    if (!nx) break;
    st.stage = nx;
    st.stageTurn = 0;
    // 새 단계의 칩 기억은 비운다(이전 단계 칩이 다음 단계를 건너뛰게 하지 않는다)
    if (nx === 'S3') delete st.chips.reaction;
    if (nx === 'S4') delete st.chips.my_state;
  }
  return st;
}

function applyChip(st: ChatState, chip: ChipCode): void {
  switch (chip) {
    case 'stage_before': case 'stage_chat': case 'stage_after': case 'stage_other': st.chips.stage_code = chip; break;
    case 'problem_yes': st.chips.problem_confirmed = true; break;
    case 'problem_edit': st.chips.problem_confirmed = false; break;
    case 'unknown': st.chips.unknown = true; break;
    case 'react_yes': st.chips.reaction = 'yes'; break;
    case 'react_some': st.chips.reaction = 'some'; break;
    case 'react_no': st.chips.reaction = 'no'; break;
    case 'state_1': st.chips.my_state = 1; break;
    case 'state_2': st.chips.my_state = 2; break;
    case 'state_3': st.chips.my_state = 3; break;
    case 'state_4': st.chips.my_state = 4; break;
    case 'enough': st.chips.enough = true; break;
    case 'skip': st.stage = 'S5'; st.stageTurn = 0; break;
  }
}

// ---------------------------------------------------------------- 준비
export interface ChatInput {
  askerText: string;
  partnerText?: string;
  chip?: ChipCode | null;
  /** 첫 화면 '상대를 뭐라고 부를까요?'에서 받은 호칭. 매 요청에 함께 온다(서버가 저장하지 않는다) */
  partnerAlias?: string | null;
}

export interface CallSpec {
  stage: StageId;
  plan: Plan;
  userN: number;
  userContent: string;
  messages: ApiMessage[];
  newTexts: UserTexts;
  stateAfterResolve: ChatState;
  moneyHint: boolean;
  maskCount: number;
  chip: ChipCode | null;
  /** 질문자가 진단을 물었다 → 응답에 '진단은 할 수 없어요 …' 행동 이야기로 돌리는 문장이 꼭 있어야 한다 */
  diagnosisAsked: boolean;
}

export type Prepared =
  | { kind: 'reject'; code: ResponseCode; why: string }
  | { kind: 'card'; code: 'crisis' | 'refused_intent'; card: FixedCard; env: ChatEnvelope }
  | { kind: 'end'; code: 'ok'; env: ChatEnvelope; display: DisplayTurn }
  | { kind: 'call'; env: ChatEnvelope; call: CallSpec };

function cloneEnv(env: ChatEnvelope): ChatEnvelope {
  return { ...env, state: { ...env.state, slots: { ...env.state.slots }, chips: { ...env.state.chips } } };
}

export function summaryCard(env: ChatEnvelope): DisplayTurn {
  const concl = env.conclusion ?? [];
  return {
    stage: 'S5', progress: 5, sentences: concl.filter((s) => ['direction', 'option', 'first_action'].includes(s.kind)),
    notes: [...SESSION_END_CARD.lines, CHAT_FOOTER, ALWAYS_LINE], chips: [], ended: true,
  };
}

export function prepareTurn(envIn: ChatEnvelope, input: ChatInput): Prepared {
  const env = cloneEnv(envIn);
  const st = env.state;
  if (input.askerText != null && typeof input.askerText !== 'string') return { kind: 'reject', code: 'bad_request', why: 'type' };
  if (input.partnerText != null && typeof input.partnerText !== 'string') return { kind: 'reject', code: 'bad_request', why: 'type' };
  if (input.chip != null && !isChipCode(input.chip)) return { kind: 'reject', code: 'bad_request', why: 'chip' };

  const askerRaw = sanitize(input.askerText ?? '').trim();
  const partnerRaw = sanitize(input.partnerText ?? '').trim();

  // 1) 위기 · 폭력 · 오용 · 미성년 — 업체를 부르기 전. 걸리면 글은 버린다(이력 · 로그 0).
  //    위기 · 폭력 카드는 세션이 이미 끝났어도 먼저 보인다(안전이 먼저)
  //    A-QF2: 한 글에 갈래가 둘 이상 걸리면(위기 + 폭력 · 위기 + 미성년 …) 가장 먼저 처리할 카드 하나에 다른 갈래의 확정 번호 줄만 덧붙이고(safety.ts),
  //    미성년이 끼어 있으면 세션을 마친다. 가해 의도('죽이고 싶어요')는 위기 카드처럼 매번 카드로 막는다(위기 카드 횟수에 센다).
  const hits = classifyHits(askerRaw + '\n' + partnerRaw);
  const safe = composeSafety(hits);
  if (safe && (safe.kinds[0] === 'crisis' || safe.kinds[0] === 'harm_intent')) {
    st.crisisCards += 1;
    if (st.crisisCards >= CHAT_LIMITS.maxCrisisCards || safe.endSession) st.ended = true;
    return { kind: 'card', code: 'crisis', card: safe.card, env };
  }
  if (safe && safe.kinds[0] === 'violence' && !st.safety) {
    st.safety = true;
    if (safe.endSession) st.ended = true;
    return { kind: 'card', code: 'crisis', card: safe.card, env };
  }
  if (st.ended) {
    return { kind: 'end', code: 'ok', env, display: summaryCard(env) };
  }
  if (!askerRaw && !partnerRaw && !input.chip) return { kind: 'reject', code: 'bad_request', why: 'empty' };
  if (hits.includes('misuse')) return { kind: 'card', code: 'refused_intent', card: MISUSE_CARD, env };
  if (hits.includes('minor')) { st.ended = true; return { kind: 'card', code: 'refused_intent', card: MINOR_CARD, env }; }

  // 2) 길이 (정규화 뒤)
  if (charLen(askerRaw) > CHAT_LIMITS.askerMax || charLen(partnerRaw) > CHAT_LIMITS.partnerMax) return { kind: 'reject', code: 'too_long', why: 'length' };

  // 3) 가리기 + 상대 호칭 치환 + 안전망
  const alias = typeof input.partnerAlias === 'string' ? sanitize(input.partnerAlias).trim().slice(0, CHAT_LIMITS.aliasMax) : '';
  const known = { partnerNames: alias ? [alias] : [] };
  const mA = maskText(askerRaw, known);
  const mP = maskText(partnerRaw, known);
  if (hasResidualPii(mA.text) || hasResidualPii(mP.text)) return { kind: 'reject', code: 'bad_request', why: 'residual_pii' };
  const maskCount = mA.count + mP.count;

  // 4) 칩 · 단계
  const chip = input.chip ?? null;
  if (chip && !CHIP_STAGES[chip].includes(st.stage) && chip !== 'skip') {
    // 칩이 지금 단계 것이 아니면 무시하지 않고 거절(앱 버그)
    return { kind: 'reject', code: 'bad_request', why: 'chip_stage' };
  }
  if (chip) applyChip(st, chip);
  const label = chip ? `[선택] ${CHIP_LABEL[chip]}` : '';
  const askerText = [label, mA.text].filter(Boolean).join(' ');
  const resolved = resolveStage(st);
  if (resolved.stage === 'S5' && resolved.s5Delivered && resolved.chips.enough) {
    env.state = { ...resolved, ended: true };
    return { kind: 'end', code: 'ok', env, display: summaryCard(env) };
  }

  // 5) 호출 꼴
  const plan = planFor(resolved);
  const userN = st.userTurns + 1;
  const injection = hasInjectionShape(askerRaw) || hasInjectionShape(partnerRaw);
  const guard = resolved.safety ? 'safety' : (maskCount > 0 || injection || hasDiagnosisRequest(askerRaw) || hasVerdictRequest(askerRaw)) ? 'flagged' : 'ok';
  const diagnosisAsked = hasDiagnosisAsk(askerRaw);
  const stateLine = wrapState({
    stage: resolved.stage,
    stage_turn: resolved.stageTurn + 1,
    stage_cap: Number.isFinite(STAGE_CAPS[resolved.stage]) ? STAGE_CAPS[resolved.stage] : null,
    ai_turn: resolved.aiTurns + 1,
    safety: resolved.safety,
    guard,
    diagnosis_asked: diagnosisAsked,
    user_turn: userN,
    need: needStrings(plan),
    slots: resolved.slots,
  });
  const userContent = stateLine + '\n' + wrapTurn(userN, askerText, mP.text);
  const messages: ApiMessage[] = [...env.messages, { role: 'user', content: userContent }];
  const call: CallSpec = {
    stage: resolved.stage, plan, userN, userContent, messages,
    newTexts: { asker: askerText, partner: mP.text },
    stateAfterResolve: resolved,
    moneyHint: hasMoneyHint(askerRaw) || hasMoneyHint(partnerRaw),
    maskCount,
    chip,
    diagnosisAsked,
  };
  return { kind: 'call', env, call };
}

// ---------------------------------------------------------------- 출력 검사
export interface EvalContext {
  state: ChatState;
  plan: Plan;
  userTexts: UserTexts[];         // 새 말 포함(번호 n의 글은 userTexts[n-1])
  cards: ReadonlyMap<string, EvidenceCard>;
  diagnosisAsked?: boolean;
}
export interface EvalResult {
  ok: boolean;
  sentences: DisplaySentence[];
  dropped: Array<{ index: number; reason: string }>;
  blockers: string[];
  flags: ModelFlag[];
  slotsPatch: StoredSlots;
}

const REF_USER = /^내 말 ([1-9][0-9]*)$/;   // 턴 상한이 없어 세 자리 번호도 나온다
const REF_CARD = /^K-[1-9][0-9]?$/;
const HEDGE = /보여요|같아요|수 있어요|수도 있어요|가까워요|가까워 보여요|가능성|듯해요|라고 해요|이래요|나아 보여요/;
const WEAK_MARK = /약하지만|말씀하신 (대목|내용|부분)만|확실하지|참고만|짐작/;
const HEDGE_KINDS: readonly Kind[] = ['trait', 'reason', 'counter', 'direction'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 모델 출력 하나를 검사한다. 문장마다: 종류 허용 · 길이 · 금지어 · 해요체 · 근거 번호(내 말 n은 원문 인용 대조, K-n은 카드 목록 · 단계) · 조심스러운 말투. */
export function evaluateChatOutput(raw: unknown, ctx: EvalContext): EvalResult {
  const res: EvalResult = { ok: false, sentences: [], dropped: [], blockers: [], flags: [], slotsPatch: {} };
  if (!isRecord(raw) || raw.stage !== ctx.plan.stage || !Array.isArray(raw.sentences) || !isRecord(raw.slots) || !Array.isArray(raw.flags)) {
    res.blockers.push('shape');
    return res;
  }
  if (raw.sentences.length === 0 || raw.sentences.length > 20) { res.blockers.push('sentence_count'); return res; }
  res.flags = (raw.flags as unknown[]).filter((f): f is ModelFlag => typeof f === 'string' && (MODEL_FLAGS as readonly string[]).includes(f));
  const seenText = new Set<string>();
  const kept: Array<{ kind: Kind; ds: DisplaySentence }> = [];

  raw.sentences.forEach((s: unknown, index: number) => {
    const drop = (reason: string) => { res.dropped.push({ index, reason }); };
    if (!isRecord(s)) return drop('shape');
    const kind = s.kind as Kind;
    if (!(KINDS as readonly string[]).includes(kind) || !ctx.plan.allowed.includes(kind)) return drop('kind');
    const text = typeof s.text === 'string' ? s.text.trim() : '';
    const len = charLen(text);
    if (len < CHAT_LIMITS.sentenceMin || len > CHAT_LIMITS.sentenceMax) return drop('length');
    // 금지어
    const hits = checkText(text, CHAT_RULES, { allowPhrases: CHAT_ALLOW_PHRASES });
    const ch = contactHit(text);
    if (ch) hits.push(ch);
    if (hits.length > 0) {
      for (const h of hits) if (h.severity === 'block') res.blockers.push(h.id);
      return drop('rule:' + hits[0].id);
    }
    // 문장 끝
    const isQ = kind === 'question';
    if (isQ !== /\?\s*$/.test(text)) return drop(isQ ? 'question_mark' : 'stray_question');
    if (!endsWithHaeyo(text)) return drop('ending');
    if (seenText.has(text)) return drop('duplicate');
    // 근거
    const refsIn = Array.isArray(s.refs) ? (s.refs as unknown[]).filter((r): r is string => typeof r === 'string') : [];
    const quotesIn = Array.isArray(s.quotes) ? (s.quotes as unknown[]).filter(isRecord) : [];
    const refs: DisplayRef[] = [];
    let hasCard = false;
    for (const r of refsIn) {
      const mu = REF_USER.exec(r);
      if (mu) {
        const n = Number(mu[1]);
        const texts = ctx.userTexts[n - 1];
        if (!texts) continue;
        const q = quotesIn.find((x) => x.n === n && typeof x.q === 'string' && charLen(x.q as string) <= CHAT_LIMITS.quoteMax && quoteInSource(x.q as string, texts.asker, texts.partner));
        if (!q) continue;
        if (!refs.some((x) => x.label === r)) refs.push({ label: r, type: 'user', quote: q.q as string });
        continue;
      }
      if (REF_CARD.test(r)) {
        const card = ctx.cards.get(r);
        if (!card) continue;
        const stageOk = card.use_in.includes(ctx.plan.stage) && (!card.safety_only || ctx.state.safety);
        if (!stageOk) continue;
        if (!refs.some((x) => x.label === r)) {
          refs.push({ label: r, type: 'card', cardId: card.id, citation: citationFor(card), limit: card.limit, practical: isPractical(card) });
          hasCard = true;
        }
      }
    }
    if (!isQ && refs.length === 0) return drop('no_ref');
    // 조심스러운 말투 · 약한 근거 표시
    const weak = (kind === 'trait' || kind === 'reason') && !hasCard;
    if (HEDGE_KINDS.includes(kind) && !HEDGE.test(text)) return drop('no_hedge');
    if (weak && !WEAK_MARK.test(text)) return drop('weak_unmarked');
    if ((kind === 'trait' || kind === 'reason') && !['보통', '약함'].includes(String(s.strength))) return drop('strength');
    seenText.add(text);
    kept.push({ kind, ds: { kind, text, refs: isQ ? [] : refs, weak } });
  });

  // 구성: 종류별 개수가 계획 안에 있나(넘치는 것은 뒤에서부터 지운다)
  const out: DisplaySentence[] = [];
  const counts = new Map<number, number>();
  for (const k of kept) {
    const idx = ctx.plan.items.findIndex((i) => i.kinds.includes(k.kind) && i.max > 0);
    if (idx < 0) continue;
    const c = (counts.get(idx) ?? 0) + 1;
    if (c > ctx.plan.items[idx].max) { res.dropped.push({ index: -1, reason: 'over_max:' + k.kind }); continue; }
    counts.set(idx, c);
    out.push(k.ds);
  }
  ctx.plan.items.forEach((it, idx) => {
    if ((counts.get(idx) ?? 0) < it.min) res.blockers.push('composition:' + it.kinds.join('|'));
  });
  // 진단을 물었으면 행동 이야기로 돌리는 문장이 있어야 한다(법무 16-2 낙인)
  if (ctx.diagnosisAsked && !out.some((x) => CHAT_ALLOW_PHRASES.some((ph) => x.text.includes(ph)))) res.blockers.push('diagnosis_redirect');
  // 그룹(trait|reason, restate|because|… 후속)에서 같은 칸을 여러 종류가 나눠 쓸 수 있도록 findIndex 첫 항목에 모은다
  res.sentences = out;

  // 칸(slots) 갱신 제안: 지금 단계 키만, 짧게, 가린 글에서
  const patch: StoredSlots = {};
  for (const key of STAGE_SLOT_KEYS[ctx.plan.stage]) {
    const v = (raw.slots as Record<string, unknown>)[key];
    if (LIST_SLOTS.includes(key)) {
      if (Array.isArray(v)) {
        const arr = v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter((x) => x && charLen(x) <= CHAT_LIMITS.slotValueMax && !hasResidualPii(x)).slice(0, 4);
        if (arr.length) patch[key] = arr;
      }
    } else if (typeof v === 'string') {
      const x = v.trim();
      if (x && charLen(x) <= CHAT_LIMITS.slotValueMax && !hasResidualPii(x)) patch[key] = x;
    }
  }
  res.slotsPatch = patch;
  res.ok = res.blockers.length === 0 && res.sentences.length > 0;
  return res;
}

// ---------------------------------------------------------------- 마무리
export interface ApiResult { stop_reason: string | null; content: unknown[] }

export type Finished =
  | { kind: 'ok'; code: 'ok'; env: ChatEnvelope; display: DisplayTurn; droppedCount: number; flags: ModelFlag[] }
  | { kind: 'card'; code: 'crisis' | 'refused_intent'; card: FixedCard; env: ChatEnvelope }
  | { kind: 'blocked'; code: 'blocked_output'; reasons: string[]; env: ChatEnvelope };

function textOf(content: unknown[]): string {
  return content
    .filter((b): b is { type: string; text: string } => isRecord(b) && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
}

function nextChips(stage: StageId, state: ChatState, sentences: readonly DisplaySentence[]): ChipCode[] {
  const chips: ChipCode[] = [];
  switch (stage) {
    case 'S1':
      if (!state.chips.stage_code) chips.push('stage_before', 'stage_chat', 'stage_after', 'stage_other');
      if (sentences.some((s) => s.kind === 'problem_line')) chips.push('problem_yes', 'problem_edit');
      chips.push('skip');
      break;
    case 'S2': chips.push('unknown', 'skip'); break;
    case 'S3': chips.push('react_yes', 'react_some', 'react_no', 'skip'); break;
    case 'S4': if (state.chips.my_state === undefined) chips.push('state_1', 'state_2', 'state_3', 'state_4'); chips.push('skip'); break;
    default: chips.push('enough');
  }
  return chips;
}

function buildNotes(stage: StageId, sentences: readonly DisplaySentence[], moneyHint: boolean, chip: ChipCode | null): string[] {
  const notes: string[] = [];
  if (stage === 'S3' || stage === 'S5') notes.push(CHAT_GUESS_NOTE);
  if (sentences.some((s) => s.weak)) notes.push(WEAK_LABEL);
  if (sentences.some((s) => s.refs.some((r) => r.type === 'card'))) notes.push(CARD_NOTE);
  if (sentences.some((s) => s.refs.some((r) => r.practical))) notes.push(PRACTICAL_LABEL);
  if (moneyHint) notes.push(MONEY_CAUTION);
  if (chip === 'state_4') notes.push(...SOFT_HELP_LINES);
  if (stage === 'S5') notes.push(CHAT_FOOTER, ALWAYS_LINE);
  return notes;
}

const clip = (s: string): string => Array.from(s).slice(0, FOLD_CLIP).join('');
const DIGEST_PREFIX = /^<앞이야기>[\s\S]*?<\/앞이야기>\n/;

/** 원문 턴이 FOLD_AT_TURNS 를 넘으면 가장 오래된 FOLD_TURNS 턴을 digest 로 접는다(결정적 · 업체 호출 0). 접힌 턴의 userTexts 는 digest 와 같은 앞 80자만 남겨 인용 대조가 그대로 된다. */
export function foldEnvelope(env: ChatEnvelope): void {
  const st = env.state;
  while (st.userTurns - st.folded > FOLD_AT_TURNS) {
    const from = st.folded;
    const lines: string[] = [];
    for (let i = from; i < from + FOLD_TURNS; i++) {
      const t = env.userTexts[i];
      const trimmed = { asker: clip(t.asker), partner: clip(t.partner) };
      env.userTexts[i] = trimmed;
      lines.push(`내 말 ${i + 1}: ${trimmed.asker}${trimmed.partner ? ' / 상대가 보낸 말: ' + trimmed.partner : ''}`);
    }
    const all = Array.from([env.digest, ...lines].filter(Boolean).join('\n'));
    env.digest = all.length <= DIGEST_MAX_CHARS ? all.join('') : all.slice(all.length - DIGEST_MAX_CHARS).join('');
    env.messages = env.messages.slice(FOLD_TURNS * 2);
    st.folded += FOLD_TURNS;
  }
  const first = env.messages[0];
  if (env.digest && first && first.role === 'user' && typeof first.content === 'string') {
    env.messages = [{ role: 'user', content: '<앞이야기>' + env.digest + '</앞이야기>\n' + first.content.replace(DIGEST_PREFIX, '') }, ...env.messages.slice(1)];
  }
}

/** 업체 응답을 검사해 새 봉투와 화면용 턴을 만든다. 통과 못 하면 blocked(재호출 0 · 턴 안 올림) */
export function finishTurn(prep: Extract<Prepared, { kind: 'call' }>, resp: ApiResult, cards: ReadonlyMap<string, EvidenceCard>): Finished {
  const { env, call } = prep;
  const block = (reasons: string[]): Finished => {
    const e = cloneEnv(env);
    e.state.blocked += 1;
    if (e.state.blocked >= CHAT_LIMITS.maxBlocked) e.state.ended = true;
    return { kind: 'blocked', code: 'blocked_output', reasons, env: e };
  };
  if (resp.stop_reason !== 'end_turn') return block(['stop:' + String(resp.stop_reason)]);
  let parsed: unknown;
  try { parsed = JSON.parse(textOf(resp.content)); } catch { return block(['json']); }

  const userTexts = [...env.userTexts, call.newTexts];
  const ev = evaluateChatOutput(parsed, { state: call.stateAfterResolve, plan: call.plan, userTexts, cards, diagnosisAsked: call.diagnosisAsked });

  // 모델 표지: 위기 · 폭력 · 미성년이면 응답 전체를 고정 카드로 바꾼다(이력에 이번 말을 넣지 않는다)
  const flagged = ev.flags;
  const flagSafe = composeSafetyFromFlags(flagged);            // A-QF2: 표지가 둘 이상이면 확정 번호 줄만 합친다(safety.ts)
  if (flagSafe && (flagSafe.kinds[0] === 'crisis' || flagSafe.kinds[0] === 'harm_intent')) {     // 가해 의도 표지도 위기 카드처럼 매번 카드(횟수에 셈)
    const e = cloneEnv(env); e.state.crisisCards += 1; if (e.state.crisisCards >= CHAT_LIMITS.maxCrisisCards || flagSafe.endSession) e.state.ended = true;
    return { kind: 'card', code: 'crisis', card: flagSafe.card, env: e };
  }
  if (flagSafe && flagSafe.kinds[0] === 'violence' && !env.state.safety) {
    const e = cloneEnv(env); e.state.safety = true; if (flagSafe.endSession) e.state.ended = true;
    return { kind: 'card', code: 'crisis', card: flagSafe.card, env: e };
  }
  if (flagged.includes('minor')) {
    const e = cloneEnv(env); e.state.ended = true;
    return { kind: 'card', code: 'refused_intent', card: MINOR_CARD, env: e };
  }
  if (!ev.ok) return block([...new Set([...ev.blockers, ...ev.dropped.map((d) => d.reason)])]);

  // 새 봉투
  const st: ChatState = { ...call.stateAfterResolve, slots: { ...call.stateAfterResolve.slots }, chips: { ...call.stateAfterResolve.chips } };
  st.userTurns += 1;
  st.aiTurns += 1;
  st.stageTurn += 1;
  st.historyChars += charLen(call.newTexts.asker) + charLen(call.newTexts.partner);
  Object.assign(st.slots, ev.slotsPatch);
  const isFirstConclusion = call.stage === 'S5' && !st.s5Delivered;
  if (call.stage === 'S5') st.s5Delivered = true;
  st.blocked = 0;                // 검사 탈락은 '연속' 수 — 정상 답이 나오면 센 것을 지운다
  const assistantContent = resp.content;
  const out: ChatEnvelope = {
    state: st,
    digest: env.digest ?? '',
    userTexts,
    messages: [...call.messages, { role: 'assistant', content: assistantContent }],
    conclusion: isFirstConclusion ? ev.sentences : env.conclusion,
  };
  foldEnvelope(out);
  const display: DisplayTurn = {
    stage: call.stage,
    progress: STAGE_ORDER.indexOf(call.stage) + 1,
    sentences: ev.sentences,
    notes: buildNotes(call.stage, ev.sentences, call.moneyHint, call.chip),
    chips: st.ended ? [] : nextChips(call.stage, st, ev.sentences),
    ended: st.ended,
  };
  return { kind: 'ok', code: 'ok', env: out, display, droppedCount: ev.dropped.length, flags: flagged };
}

