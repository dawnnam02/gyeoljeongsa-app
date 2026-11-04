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
import { MANIPULATE_OBJ, classifyHits, hasDiagnosisAsk, hasDiagnosisRequest, hasInjectionShape, hasMoneyHint, hasVerdictRequest } from './lexicon.ts';
import type { FixedCard } from './fixed.ts';
import { composeSafety, composeSafetyFromFlags } from './safety.ts';
import {
  ALWAYS_LINE, CARD_NOTE, CRISIS_CHECK_LINE, FALLBACK_QUESTION, CHAT_FOOTER, CHAT_GUESS_NOTE, CRISIS_CARD, MINOR_CARD, MISUSE_CARD, MONEY_CAUTION,
  PRACTICAL_LABEL, SESSION_END_CARD, SOFT_HELP_LINES, VERDICT_NOTE, VIOLENCE_CARD, WEAK_LABEL,
} from './fixed.ts';
import { CHAT_ALLOW_PHRASES, CHAT_RULES, checkText, contactHit } from './rules.ts';
import type { EvidenceCard } from './cards.ts';
import { citationFor, isPractical } from './cards.ts';

// ---------------------------------------------------------------- 상수 (10-31 본인 결정 D-236: 턴 상한 뗌)
// 단계별 횟수(STAGE_CAPS S1~S4)는 흐름의 짜임이고 사용자 한도가 아니다. 결론(S5) 뒤에는 사용자가 '충분해요'를 고르기 전까지 이어 말할 수 있다.
// 오래된 턴은 원문 대신 짧은 digest 로 접어 한 요청의 크기가 턴 수와 무관하게 묶인다(아래 FOLD_*).
export const FOLD_AT_TURNS = 10;      // 원문으로 들고 있는 턴이 이 수를 넘으면 (AI-FIX1: 14 → 10 — 서명 묶음이 턴마다 3~10KB 늘어 14턴보다 먼저 요청 본문 상한에 닿았다)
export const FOLD_TURNS = 4;          // 가장 오래된 이 수의 턴을 digest 로 접는다
export const FOLD_CLIP = 80;          // 접힌 턴의 말은 이 글자 수만 남긴다(모델이 보는 것 = 서버가 인용 대조에 쓰는 것)
export const DIGEST_MAX_CHARS = 2400; // digest 상한(넘치면 오래된 앞쪽부터 잘라 낸다)
export const FOLD_BYTES = 40 * 1024;  // 원문 이력(messages + userTexts)이 UTF-8 로 이 크기를 넘으면 턴 수와 상관없이 접는다 — 묶음이 80KB(seal.ts SEAL_MAX_BYTES)에 못 닿게
const FOLD_ENC = new TextEncoder();
export const STAGE_ORDER: readonly StageId[] = ['S1', 'S2', 'S3', 'S4', 'S5'];
export const STAGE_CAPS: Readonly<Record<StageId, number>> = { S1: 3, S2: 2, S3: 2, S4: 3, S5: Number.POSITIVE_INFINITY };   // S5 = 상한 없음
export const CHAT_LIMITS = {
  askerMax: 600,        // 질문자 글 한 번 (보안 제안 1,000자 → 원가표로 낮춤)
  partnerMax: 800,      // 상대가 보낸 말 칸 한 번 (보안 제안 1,500자)
  aliasMax: 20,
  maxCrisisCards: 5,    // 위기 카드가 이만큼 나오면 세션을 닫는다
  maxBlocked: 6,        // 검사 탈락(blocked_output)이 연속 이만큼 쌓이면 세션을 닫는다(재전송 반복으로 돈이 새는 길 차단). AI-FIX1: 4 → 6 — 평가에서 질문 칸 형식 때문에 4연속 탈락으로 일반 세션이 전부 S2 에서 닫혔다
  sentenceMax: 140,
  sentenceMin: 4,
  quoteMax: 60,
  slotValueMax: 60,
} as const;
/** 단계별 max_tokens(thinking 포함). 보안 제안 ≤ 1,000은 JSON 틀 + 근거 인용 + thinking을 담기엔 모자라 단계별로 올림 */
export const STAGE_MAX_TOKENS: Readonly<Record<StageId, number>> = { S1: 1500, S2: 1500, S3: 3500, S4: 1500, S5: 4000 };   // AI-FIX2 R3: S3 2,500 → 3,500 · S5 3,000 → 4,000 (평가에서 생각 토큰이 한도를 다 써 stop:max_tokens 3/91)

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
  /** 위기 카드 뒤 첫 일반 턴에 고정 점검 한 줄을 이미 보였나(AI-FIX4 R-a) */
  checked?: boolean;
  /** 방금 검사에 걸려 보여 주지 못한 답에서 걸린 낱말(최대 6개) — 다음 시도에서 모델이 그 낱말을 피해 풀어 쓰게 상태 줄로 알린다(막다른 길 줄이기, AI-FIX6 ②) */
  avoid?: string[];
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
          { kinds: ['question'], min: 0, max: state.chips.enough === true ? 0 : 1 },   // AI-FIX3 N3: '충분해요' 뒤 마지막 답은 끝나는 턴이라 답할 곳 없는 질문을 달지 않는다
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
  /** 질문자가 '헤어질지 정해 달라 · 점수로 말해 달라'를 물었다 → 모델이 거절 문장을 못 내도 서버가 고정 한 줄(VERDICT_NOTE)을 앞에 붙인다(AI-FIX2 A7) */
  verdictAsked: boolean;
  /** 오용 사전에 걸렸지만 피해를 털어놓는 글로 읽혀 카드 대신 AI 입력 판정(judge.ts)에 맡긴 턴(AI-FIX4). 판정이 harm 이거나 판정을 못 하면(모의 모드 · 실패 · 시간 초과) 오용 카드로 닫는다 */
  softMisuse: boolean;
}

export type Prepared =
  | { kind: 'reject'; code: ResponseCode; why: string }
  | { kind: 'card'; code: 'crisis' | 'refused_intent'; card: FixedCard; env: ChatEnvelope; violenceJudge?: { texts: { asker: string; partner: string }; plainEnv: ChatEnvelope } }
  | { kind: 'end'; code: 'ok'; env: ChatEnvelope; display: DisplayTurn }
  | { kind: 'call'; env: ChatEnvelope; call: CallSpec };

/** 입력 판정이 위기(crisis)로 읽은 글에 위기 카드를 내고 세는 새 봉투(AI-FIX6 ⑤). 위기를 올리는 방향으로만 쓴다 */
export function applyCrisisCard(env: ChatEnvelope): ChatEnvelope {
  const e = cloneEnv(env);
  e.state.crisisCards += 1;
  if (e.state.crisisCards >= CHAT_LIMITS.maxCrisisCards) e.state.ended = true;
  return e;
}

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
    // AI-FIX6 ④: 폭력 낱말이 든 **가해 문장**("제가 남친을 미행해 보려는데")에 피해자용 폭력 카드가 나가던 것 — 호출하는 쪽이 입력 판정을 함께 불러 harm 이면
    //  오용 카드로 바꾼다(그때 쓰도록 안전 트랙을 켜기 전 봉투를 함께 돌려준다). 판정이 실패하면 이 폭력 카드를 그대로 낸다. 위기 · 가해 의도 카드는 이 앞에서 이미 돌았다.
    const plainEnv = cloneEnv(env);
    st.safety = true;
    if (safe.endSession) st.ended = true;
    const kn = { partnerNames: [] as string[] };
    const violenceJudge = safe.endSession ? undefined : { texts: { asker: maskText(askerRaw, kn).text, partner: maskText(partnerRaw, kn).text }, plainEnv };
    return { kind: 'card', code: 'crisis', card: safe.card, env, violenceJudge };
  }
  if (st.ended) {
    return { kind: 'end', code: 'ok', env, display: summaryCard(env) };
  }
  if (!askerRaw && !partnerRaw && !input.chip) return { kind: 'reject', code: 'bad_request', why: 'empty' };
  // 오용 사전에 걸렸어도 피해를 털어놓는 느낌의 말(무서워요 · 속상해요 · 당했어요 …)이 있고 방법을 묻거나 하겠다는 말이 없으면, 바로 카드로 닫지 않고 AI 입력 판정에 맡긴다(피해자 오탐 줄이기 — AI-FIX4).
  //  판정을 못 하면 handler 가 사전 결과(카드)로 닫는다. 위기 · 폭력 · 미성년 카드는 위에서 이미 먼저 돌았다.
  let softMisuse = false;
  if (hits.includes('misuse')) {
    const whole = askerRaw + ' ' + partnerRaw;
    if ((VICTIM_FEELING.test(whole) || THIRD_DISSUADE.test(whole)) && !HARM_ASK.test(whole)) softMisuse = true;
    else return { kind: 'card', code: 'refused_intent', card: MISUSE_CARD, env };
  }
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
  // '충분해요'를 글과 함께 보냈으면(마지막 말) 모델이 그 글에 한 번 답한 뒤 끝낸다 — 글 없이 칩만이면 호출 없이 마침 카드(AI-FIX2 F5: 마지막 글이 안 읽히던 문제)
  if (resolved.stage === 'S5' && resolved.s5Delivered && resolved.chips.enough && !askerRaw && !partnerRaw) {
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
    ...(resolved.avoid && resolved.avoid.length ? { avoid: resolved.avoid } : {}),
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
    verdictAsked: hasVerdictRequest(askerRaw),
    softMisuse,
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
  /** AI 출력 판정(judge.ts)이 걸러 낸 문장 글(AI-FIX4) — 그 글과 같은 문장은 'judge' 로 떨군다. 구성(종류별 개수)은 그대로 다시 본다 */
  dropTexts?: ReadonlySet<string>;
}
export interface EvalResult {
  ok: boolean;
  sentences: DisplaySentence[];
  dropped: Array<{ index: number; reason: string }>;
  blockers: string[];
  flags: ModelFlag[];
  slotsPatch: StoredSlots;
  /** 사전이 건 낱말(문장을 떨구거나 답을 막은 것) — 최대 6개 · 12자 이하 */
  hitWords: string[];
}

const VICTIM_FEELING = /무서|무섭|속상|힘들|불안|답답|서운|걱정|두렵|괴롭|당하|당했|당해|시달|스트레스|싫어|불편|것\s?같|거\s?같|느낌|듯해|제\s?(?:휴대폰|핸드폰|폰|카톡|계정|메시지|메신저|위치|사진)|저를|나를|저한테|나한테/;
/** 제3자(친구 · 가족 …)가 복수 · 보복을 하겠다는데 말리고 싶다는 글 — 낱말(복수)로 바로 카드로 닫지 않고 입력 판정에 넘긴다(AI-FIX6 ③) */
const THIRD_DISSUADE = /(?:친구|동생|언니|오빠|형|누나|지인|동료|후배|선배|가족|엄마|아빠|아들|딸|친척)(?:이|가|는|은)[^.]{0,40}(?:말리|말려|막고\s?싶|막아야|막을|그만두게|하지\s?못하게)|(?:말리|말려|막고\s?싶|막아야)[^.]{0,40}(?:친구|동생|언니|오빠|형|누나|지인|동료|가족)/;
const HARM_ASK = /방법|하는\s?법|알려\s?줘|알려\s?주세요|가르쳐/;   // 방법을 묻는 말만 사전 그대로 카드. 하겠다는 말(~하려고 · ~할래)은 판정이 가린다
const REF_USER = /^내 말 ([1-9][0-9]*)$/;   // 턴 상한이 없어 세 자리 번호도 나온다
const REF_CARD = /^K-[1-9][0-9]?$/;
/** 사용자가 걱정하는 모양을 되짚는 말의 틀만(주어가 상대면 제외). 사용자 글에 같은 틀이 있을 때만 쓴다 — '사용자 글에 있던 말이면 봐주기'처럼 낱말 전체를 풀지 않는다 */
const WORRY_FRAME = /(?<!(?:상대방?|그분|그 ?사람|그쪽|걔|그이|그 ?애|남자 ?친구|여자 ?친구|남친|여친|애인|남편|아내|연인|배우자)(?:이|가|은|는|도|께서)? ?)예민(?:한 ?사람(?:처럼|으로)|해) ?(?:보일|비칠|보이|여겨질|느껴질|볼|생각할|여길)(?:까 ?봐|까 ?걱정|까 ?염려|까 ?두려|까 ?무서)/g;
const WORRY_TEST = new RegExp(WORRY_FRAME.source);
/** 피해를 서술하는 틀(상대가 나를 …하는 것 같다 · …당한다)만. 조언 꼴("조종하는 법" · "조종해 보세요" · "길들이는 방법")은 이 틀에 없다 */
const VICTIM_FRAME = /(?:조종|길들)(?:당하|당했|여지|여진|이려는|이려고|이려 ?해|이려 ?한|이려 ?하는|이는 ?것 ?같|이는 ?느낌|이는 ?듯|하려는|하려고|하려 ?해|하려 ?한|하려 ?하는|하는 ?것 ?같|하는 ?느낌|하는 ?듯|처럼|같은 ?느낌|같이)|질투(?:를|가)? ?(?:나게|하게|유발)(?: ?만[들드든][가-힣]{0,3})?/g;
/** 피해 틀을 풀어 주는 조건(AI-FIX3 N1): 사용자의 느낌을 되짚는 보고형으로 끝나고, 조언 낱말이 없고, 상대를 겨눈 목적어 꼴(상대를 조종…)이 아닐 때만 */
const VICTIM_REPORT_END = /(?:군요|셨어요|셨네요|셨죠|들려요|들렸어요|들렸네요|들리네요|느껴져요|느껴졌어요|느껴지네요|말씀이에요|말씀이시죠|들었어요|들었네요|읽혀요|읽히네요)[.\s]*$/;
const VICTIM_REPORT_SOFT = /(?:느낌|마음|말|생각|일)[^.]{0,14}(?:것으로|걸로) ?(?:보여요|읽혀요|들려요)[.\s]*$/;   // "그 말이 마음에 남아 있는 것으로 보여요" 같은 조심스러운 보고
const VICTIM_QUESTION_ECHO = /(?:느끼|느껴|하셨|말씀|들으|들었|쓰셨)/;
const FIT_USER = /안\s?맞|맞지\s?않|잘\s?맞/;
const FIT_STEM = /안 ?맞|맞지 않|잘 ?맞/g;
const FIT_PAIR = /두 ?분|상대|사이|사람|서로|우리|관계|궁합|성격|성향|둘이|연인|그분|그 ?사람/;
const FIT_PAIR_AFTER = /사이|사람|관계|궁합/;
/** 사용자가 쓴 말을 보고형으로 되짚을 때 검사에서 빼는 낱말(사용자 글에 같은 낱말이 있을 때만) */
const ECHO_EXEMPT: ReadonlyArray<{ user: RegExp; strip: RegExp }> = [
  { user: /자존감/, strip: /자존감 ?(?:이 ?)?(?:바닥|낮|없|문제)/g },          // c_symptom
  { user: /떠보/, strip: /떠보/g },                                            // c_manip
];
const VICTIM_ADVICE = /보세요|해 ?보|해 ?주세요|하세요|방법|쪽으로|좋겠|권해|보시면|볼 ?수|드릴게|효과|좋다고|좋아요|낫|나아 ?보|도움이 ?되|유용|해야|돼요|하면 ?돼|하는 ?게 ?좋|전해 ?보/;
/** 틀 뒤에 조건 꼴(면 · 듯이 · 하면서 · 려면)이 오거나, 틀 가까이에 사람 · 성향 · 타입 같은 낙인 꼴이 오면 풀지 않는다(AI-FIX4 M1: "조종하려는 느낌을 주면 …" · "길들이려는 성향의 사람") */
const VICTIM_AFTER_BAD = /면[\s,]|듯이|하면서|려면/;
const VICTIM_STIGMA_NEAR = /^[^.]{0,6}(?:사람|성향|타입|스타일|기질)/;
function victimFrameOk(t: string, question = false): boolean {
  const endOk = question ? /\?\s*$/.test(t.trim()) && VICTIM_QUESTION_ECHO.test(t) : VICTIM_REPORT_END.test(t.trim()) || VICTIM_REPORT_SOFT.test(t.trim());   // 질문은 사용자가 말한 느낌을 되묻는 꼴(…느끼셨나요?)만
  if (!endOk || VICTIM_ADVICE.test(t) || MANIPULATE_OBJ.test(t.replace(/[^가-힣a-z0-9]/gi, ''))) return false;
  const m = new RegExp(VICTIM_FRAME.source).exec(t);
  if (!m) return true;
  const after = t.slice(m.index + m[0].length);
  if (VICTIM_AFTER_BAD.test(after)) return false;
  if (VICTIM_STIGMA_NEAR.test(after)) return false;
  return true;
}
/** 문장(마침표 · 물음표 단위)마다 따로 본다 — 한 칸에 보고 문장과 군더더기 문장이 같이 있어도, 틀은 보고형으로 끝나는 그 문장에서만 푼다 */
const unwrapVictimFrame = (text: string, stems: readonly string[], question = false): string =>
  text.split(/(?<=[.?!])\s+/).map((c) => (victimFrameOk(c, question) ? c.replace(VICTIM_FRAME, (m) => (stems.some((st) => m.startsWith(st)) ? '' : m)) : c)).join(' ');
const HEDGE = /보여요|같아요|수 있어요|수도 있어요|가까워요|가까워 보여요|가능성|듯해요|라고 해요|이래요|나아 보여요/;
const WEAK_MARK = /약하지만|말씀하신 (대목|내용|부분)만|확실하지|참고만|짐작/;
const HEDGE_KINDS: readonly Kind[] = ['trait', 'reason', 'counter', 'direction'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 질문 칸 형식(AI-FIX1 · 형식 규칙만 — 안전 규칙은 그대로). 평가에서 질문 칸의 77%(76/99)가 "~까요? 모르면 모른다고 하셔도 괜찮아요"처럼 물음표 뒤에 안내 문장을 덧붙여 물음표로 안 끝났다는 이유로 지워졌다.
 *  ① 물음표가 있고 그 뒤에 글이 더 있으면 마지막 물음표까지만 남긴다(버려지는 쪽은 안내 말이라 새로 보이는 글이 없다 — 오히려 줄어든다).
 *  ② 물음표가 없어도 '~적어 주세요 · ~들려주실래요' 같은 부탁 꼴로 끝나면 질문으로 본다. 그 밖의 평서문은 그대로 탈락. 금지어 · 근거 · 해요체 검사는 이 뒤에 그대로 돈다. */
const QUESTION_REQUEST_END = /(?:주세요|주실래요|주시겠어요|주실 수 있을까요|보세요|볼래요)[.\s]*$/;
export function normalizeQuestionText(t: string): string {
  const i = t.lastIndexOf('?');
  return i >= 0 && i < t.length - 1 ? t.slice(0, i + 1).trim() : t;
}
export function isQuestionForm(t: string): boolean {
  return /\?\s*$/.test(t) || QUESTION_REQUEST_END.test(t);
}

/** 모델 출력 하나를 검사한다. 문장마다: 종류 허용 · 길이 · 금지어 · 해요체 · 근거 번호(내 말 n은 원문 인용 대조, K-n은 카드 목록 · 단계) · 조심스러운 말투. */
export function evaluateChatOutput(raw: unknown, ctx: EvalContext): EvalResult {
  const res: EvalResult = { ok: false, sentences: [], dropped: [], blockers: [], flags: [], slotsPatch: {}, hitWords: [] };
  // 모델 표지(위기 · 폭력 · 미성년 …)는 문장이 비어 있거나 틀이 조금 어긋나도 먼저 읽는다 — 위기 표지를 단 모델이 문장을 비워 보내면(실호출 E1R4 crisis_cr07 3/3)
  //  카드가 아니라 탈락으로 끝나던 길을 막는다. 표지가 있으면 finishTurn 이 응답 전체를 고정 카드로 바꾼다(위기 흐름은 형식 때문에 막히지 않는다).
  if (isRecord(raw) && Array.isArray(raw.flags)) res.flags = (raw.flags as unknown[]).filter((f): f is ModelFlag => typeof f === 'string' && (MODEL_FLAGS as readonly string[]).includes(f));
  if (!isRecord(raw) || raw.stage !== ctx.plan.stage || !Array.isArray(raw.sentences) || !isRecord(raw.slots) || !Array.isArray(raw.flags)) {
    res.blockers.push('shape');
    return res;
  }
  if (raw.sentences.length === 0 || raw.sentences.length > 20) { res.blockers.push('sentence_count'); return res; }
  const seenText = new Set<string>();
  const lastAsker = ctx.userTexts[ctx.userTexts.length - 1]?.asker ?? '';
  const allAsker = ctx.userTexts.map((t) => t.asker).join(' ');          // 이 세션에서 사용자가 쓴 말 전부 — 앞 턴에 쓴 낱말(자존감이 바닥)을 모델이 다음 턴에도 되짚는 길(실호출 E1R7 m4 T2 · T3 막다른 길)
  const worryOk = WORRY_TEST.test(lastAsker);
  const victimStems = ['조종', '길들', '질투'].filter((st) => lastAsker.includes(st));            // 사용자가 직접 쓴 낱말만(모델이 먼저 꺼낸 낱말은 풀지 않는다)
  const kept: Array<{ kind: Kind; ds: DisplaySentence }> = [];
  let qDropped = false;

  raw.sentences.forEach((s: unknown, index: number) => {
    const drop = (reason: string) => { res.dropped.push({ index, reason }); if (isRecord(s) && s.kind === 'question') qDropped = true; };
    if (!isRecord(s)) return drop('shape');
    const kind = s.kind as Kind;
    if (!(KINDS as readonly string[]).includes(kind) || !ctx.plan.allowed.includes(kind)) return drop('kind');
    const rawText = typeof s.text === 'string' ? s.text.trim() : '';
    const text = kind === 'question' ? normalizeQuestionText(rawText) : rawText;     // 질문 칸 형식 규칙(AI-FIX1): 마지막 물음표 뒤에 덧붙은 안내 말은 버린다
    const len = charLen(text);
    if (len < CHAT_LIMITS.sentenceMin || len > CHAT_LIMITS.sentenceMax) return drop('length');
    if (ctx.dropTexts?.has(text)) return drop('judge');
    // 금지어
    // 사용자가 직접 말한 걱정 틀("예민한 사람처럼 보일까 봐")을 되짚는 restate · problem_line 에서만 그 틀을 검사에서 뺀다(AI-FIX2 R2). 틀 밖의 말은 그대로 검사한다
    //  같은 꼴로 피해를 말한 사용자("저를 조종하려고 해요" · "길들여지는 것 같아요")의 말을 되짚는 restate · problem_line 은 c_manip 에서 그 틀만 뺀다(AI-FIX2 A1: 피해 꼴 5건 중 2건이 이 때문에 연속 탈락). 가스라이팅 같은 낙인 낱말(c_label)은 그대로 막는다.
    const scan = (t: string): string => {
      if (kind !== 'restate' && kind !== 'problem_line' && kind !== 'question') return t;
      let u = worryOk ? t.replace(WORRY_FRAME, '') : t;
      if (victimStems.length) u = unwrapVictimFrame(u, victimStems, kind === 'question');
      // 사용자가 쓴 말을 되짚는 보고형 문장에서만, 그 말의 낱말을 사전에서 뺀다(AI-FIX5 D4 · AI-FIX6 ① ②). 보고형 = 끝말(군요 · 셨어요 …)이 있고 조언 낱말이 없음. 질문은 느낌을 되묻는 꼴만.
      const reportForm = !VICTIM_ADVICE.test(t) && (kind === 'question' ? /\?\s*$/.test(t.trim()) && VICTIM_QUESTION_ECHO.test(t) : VICTIM_REPORT_END.test(t.trim()) || VICTIM_REPORT_SOFT.test(t.trim()));
      if (reportForm) {
        // c_fit: "안 맞는 / 맞지 않는" 앞뒤에 짝(두 분 · 상대 · 사이 · 사람 · 관계 …)이 있으면 AI 가 짝을 판정하는 문장이라 면제하지 않는다. "양가 일정이 안 맞는다" 같은 일정 · 시간 이야기만 풀어 준다
        if (FIT_USER.test(lastAsker)) u = u.replace(FIT_STEM, (m, off: number, whole: string) => (FIT_PAIR.test(whole.slice(Math.max(0, off - 14), off)) || FIT_PAIR_AFTER.test(whole.slice(off + m.length, off + m.length + 8)) ? m : ''));
        // 사용자가 직접 쓴 낱말(자존감이 바닥 · 떠보는 말투)을 되짚는 말은 그 낱말만 뺀다 — 피해를 털어놓는 첫 글이 3연속 막히던 것
        for (const e of ECHO_EXEMPT) if (e.user.test(allAsker)) u = u.replace(e.strip, '');
      }
      return u;
    };
    const hits = checkText(scan(text), CHAT_RULES, { allowPhrases: CHAT_ALLOW_PHRASES });
    const ch = contactHit(text);
    if (ch) hits.push(ch);
    if (rawText !== text) {                         // 질문 칸에서 잘라 낸 뒷부분도 안전선(block)은 그대로 본다 — 형식 완화가 안전 규칙을 약하게 만들지 않게(AI-FIX1)
      for (const h of checkText(scan(rawText), CHAT_RULES, { allowPhrases: CHAT_ALLOW_PHRASES })) if (h.severity === 'block' && !hits.some((x) => x.id === h.id)) hits.push(h);
      const rch = contactHit(rawText);
      if (rch && !ch) hits.push(rch);
    }
    if (hits.length > 0) {
      for (const h of hits) { if (h.severity === 'block') res.blockers.push(h.id); if (h.word && h.word.length <= 12 && !res.hitWords.includes(h.word) && res.hitWords.length < 6) res.hitWords.push(h.word); }
      return drop('rule:' + hits[0].id);
    }
    // 문장 끝
    const isQ = kind === 'question';
    if (isQ ? !isQuestionForm(text) : /\?\s*$/.test(text)) return drop(isQ ? 'question_mark' : 'stray_question');
    if (!endsWithHaeyo(text)) return drop('ending');
    if (seenText.has(text)) return drop('duplicate');
    // 근거
    const refsIn = Array.isArray(s.refs) ? (s.refs as unknown[]).filter((r): r is string => typeof r === 'string') : [];
    const quotesIn = Array.isArray(s.quotes) ? (s.quotes as unknown[]).filter(isRecord) : [];
    const refs: DisplayRef[] = [];
    let hasCard = false;
    let badCard = false;
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
        const stageOk = !!card && card.use_in.includes(ctx.plan.stage) && (!card.safety_only || ctx.state.safety);
        if (!card || !stageOk) { badCard = true; continue; }          // 없는 번호 · 이 단계에 못 쓰는 카드: 번호만 지우면 카드 말이 번호 없이 나가므로 문장을 지운다(AI-FIX2 F6)
        if (!refs.some((x) => x.label === r)) {
          refs.push({ label: r, type: 'card', cardId: card.id, citation: citationFor(card), limit: card.limit, practical: isPractical(card) });
          hasCard = true;
        }
      }
    }
    if (badCard && !isQ) return drop('card_ref');
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
  // 질문 칸만 형식 규칙(글자 수 · 물음표 · 3인칭 낱말 등 drop)에 걸려 떨어졌고 다른 막힘이 없으면, 답 전체를 버리지 않고 서버 고정 질문을 단계별로 단다(AI-FIX3). 안전 규칙(block)으로 떨어진 경우에는 쓰지 않는다
  if (qDropped && res.blockers.length === 1 && res.blockers[0] === 'composition:question' && (ctx.plan.stage === 'S1' || ctx.plan.stage === 'S2' || ctx.plan.stage === 'S4')) {
    const fq = ctx.plan.stage === 'S1' && out.some((x) => x.kind === 'problem_line') ? FALLBACK_QUESTION.S1_CONFIRM : FALLBACK_QUESTION[ctx.plan.stage as 'S1' | 'S2' | 'S4'];   // AI-FIX4 M4: 한 줄 정리를 보여 준 턴에는 그 줄이 맞는지 묻는다
    out.push({ kind: 'question', text: fq, refs: [], weak: false });
    res.blockers.pop();
    res.dropped.push({ index: -1, reason: 'question_fixed' });
  }
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

const VERDICT_REFUSED = /대신 (?:내릴|정해|결정|판단|골라)|결정은 [^.]{0,12}(?:몫|본인)|정해 드릴 수 없/;
function buildNotes(stage: StageId, sentences: readonly DisplaySentence[], moneyHint: boolean, chip: ChipCode | null, extra: { safetyLine: boolean; verdictAsked: boolean; ending: boolean; crisisCheck?: boolean }): string[] {
  const notes: string[] = [];
  if (extra.crisisCheck) notes.push(CRISIS_CHECK_LINE);          // 위기 카드 뒤 첫 일반 턴의 맨 앞 고정 점검 한 줄(AI-FIX4 R-a)
  // 판정 요구(헤어질지 · 점수)에 모델이 거절 문장을 못 냈으면 서버가 앞에 한 줄을 붙인다 — 거절 문장이 검사에 떨어지고 '대신 …'만 남던 문제(AI-FIX2 A7)
  if (extra.verdictAsked && !sentences.some((s) => VERDICT_REFUSED.test(s.text))) notes.push(VERDICT_NOTE);
  if (stage === 'S3' || stage === 'S5') notes.push(CHAT_GUESS_NOTE);
  if (sentences.some((s) => s.weak)) notes.push(WEAK_LABEL);
  if (sentences.some((s) => s.refs.some((r) => r.type === 'card'))) notes.push(CARD_NOTE);
  if (sentences.some((s) => s.refs.some((r) => r.practical))) notes.push(PRACTICAL_LABEL);
  if (moneyHint) notes.push(MONEY_CAUTION);
  if (chip === 'state_4') notes.push(...SOFT_HELP_LINES);
  if (extra.ending) notes.push(...SESSION_END_CARD.lines);
  if (stage === 'S5') notes.push(CHAT_FOOTER, ALWAYS_LINE);
  else if (extra.safetyLine) notes.push(ALWAYS_LINE);        // 위기 카드 · 폭력 트랙 뒤에는 S5 가 아니어도 매 턴 번호 줄(109 · 112 · 119 · 1366)이 이어진다(AI-FIX2 A2)
  return notes;
}

const clip = (s: string): string => Array.from(s).slice(0, FOLD_CLIP).join('');
const DIGEST_PREFIX = /^<앞이야기>[\s\S]*?<\/앞이야기>\n/;

/** 원문 턴이 FOLD_AT_TURNS 를 넘으면 가장 오래된 FOLD_TURNS 턴을 digest 로 접는다(결정적 · 업체 호출 0). 접힌 턴의 userTexts 는 digest 와 같은 앞 80자만 남겨 인용 대조가 그대로 된다. */
export function foldEnvelope(env: ChatEnvelope): void {
  const st = env.state;
  // 턴 수 말고 크기로도 접는다(AI-FIX1): 글을 길게 쓰는 사람은 10턴 전에 요청 본문 상한(서명 묶음 SEAL_MAX_BYTES)에 닿으므로, 원문이 FOLD_BYTES 를 넘으면 FOLD_TURNS 턴이 남을 때까지 더 접는다
  const tooBig = (): boolean => st.userTurns - st.folded > FOLD_TURNS && FOLD_ENC.encode(JSON.stringify({ m: env.messages, u: env.userTexts.slice(st.folded) })).length > FOLD_BYTES;
  while (st.userTurns - st.folded > FOLD_AT_TURNS || tooBig()) {
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
    // digest 에서 밀려난 아주 오래된 턴의 글은 비운다(번호 자리는 남겨 userTexts.length === userTurns 를 지킨다). 모델이 더는 볼 수 없는 말이라 인용 근거로도 못 쓰고,
    // 안 비우면 접힌 턴마다 앞 80자 두 칸(한글 최대 480바이트)이 계속 쌓여 긴 대화가 묶음 크기 상한에 닿는다(AI-FIX1)
    const kept = new Set(Array.from(env.digest.matchAll(/(?:^|\n)내 말 (\d+):/g), (m) => Number(m[1]) - 1));
    for (let i = 0; i < st.folded; i++) if (!kept.has(i) && (env.userTexts[i].asker || env.userTexts[i].partner)) env.userTexts[i] = { asker: '', partner: '' };
  }
  const first = env.messages[0];
  if (env.digest && first && first.role === 'user' && typeof first.content === 'string') {
    env.messages = [{ role: 'user', content: '<앞이야기>' + env.digest + '</앞이야기>\n' + first.content.replace(DIGEST_PREFIX, '') }, ...env.messages.slice(1)];
  }
}

const CONCLUSION_KINDS: readonly Kind[] = ['direction', 'option', 'first_action'];
/** 결론 뒤 후속 턴이 방향 · 선택지 · 첫 행동을 새로 냈으면 마침 카드(summaryCard)에 그것이 들어가게 합친다 — 마침 카드가 첫 결론의 복사본이라 후속 답이 사라지던 문제(AI-FIX2 F5) */
export function mergeConclusion(old: DisplaySentence[] | null, fresh: readonly DisplaySentence[]): DisplaySentence[] | null {
  const newer = fresh.filter((s) => CONCLUSION_KINDS.includes(s.kind));
  if (newer.length === 0) return old;
  const kept = (old ?? []).filter((s) => !newer.some((n) => n.kind === s.kind));
  return [...kept, ...newer].sort((a, b) => CONCLUSION_KINDS.indexOf(a.kind) - CONCLUSION_KINDS.indexOf(b.kind));
}

/** 업체 응답을 검사해 새 봉투와 화면용 턴을 만든다. 통과 못 하면 blocked(재호출 0 · 턴 안 올림) */
export function finishTurn(prep: Extract<Prepared, { kind: 'call' }>, resp: ApiResult, cards: ReadonlyMap<string, EvidenceCard>, opts: { dropTexts?: ReadonlySet<string> } = {}): Finished {
  const { env, call } = prep;
  const block = (reasons: string[], words: readonly string[] = []): Finished => {
    const e = cloneEnv(env);
    e.state.blocked += 1;
    if (words.length) e.state.avoid = [...words]; else delete e.state.avoid;
    if (e.state.blocked >= CHAT_LIMITS.maxBlocked) e.state.ended = true;
    return { kind: 'blocked', code: 'blocked_output', reasons, env: e };
  };
  if (resp.stop_reason !== 'end_turn') return block(['stop:' + String(resp.stop_reason)]);
  let parsed: unknown;
  try { parsed = JSON.parse(textOf(resp.content)); } catch { return block(['json']); }

  const userTexts = [...env.userTexts, call.newTexts];
  const ev = evaluateChatOutput(parsed, { state: call.stateAfterResolve, plan: call.plan, userTexts, cards, diagnosisAsked: call.diagnosisAsked, dropTexts: opts.dropTexts });

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
  if (!ev.ok) return block([...new Set([...ev.blockers, ...ev.dropped.map((d) => d.reason)])], ev.hitWords.filter((w) => userTexts.some((u) => u.asker.replace(/\s/g, '').includes(w.replace(/\s/g, '')))));   // 사용자가 직접 쓴 낱말만 '피할 낱말'로 돌려준다(모델이 낸 낱말은 서명 묶음 → 화면 쪽으로 새지 않게)

  // 새 봉투
  const st: ChatState = { ...call.stateAfterResolve, slots: { ...call.stateAfterResolve.slots }, chips: { ...call.stateAfterResolve.chips } };
  st.userTurns += 1;
  st.aiTurns += 1;
  st.stageTurn += 1;
  st.historyChars += charLen(call.newTexts.asker) + charLen(call.newTexts.partner);
  Object.assign(st.slots, ev.slotsPatch);
  const crisisCheck = st.crisisCards > 0 && !st.checked;
  if (crisisCheck) st.checked = true;
  const isFirstConclusion = call.stage === 'S5' && !st.s5Delivered;
  if (call.stage === 'S5') st.s5Delivered = true;
  st.blocked = 0;                // 검사 탈락은 '연속' 수 — 정상 답이 나오면 센 것을 지운다
  delete st.avoid;
  const endedByEnough = call.chip === 'enough' && call.stage === 'S5';      // 마지막 말에 답한 뒤 끝낸다
  if (endedByEnough) st.ended = true;
  // AI-FIX2: 이력에는 글(text) 블록만 넣는다. 생각(thinking) 블록은 서명이 앞 이력과 묶여 있어, 접기(foldEnvelope)가 앞 턴을 자르거나 첫 메시지에 digest 를 붙이면 업체가 400 'Invalid signature in thinking block' 으로 거절한다 —
  // 실호출 재평가(E1R2) path12_01 이 11턴째 접힌 뒤 12턴째에 그렇게 죽었다. 지난 턴의 생각 블록은 다음 요청에 필요 없다(도구 호출 없음).
  const assistantContent = resp.content.filter((b) => isRecord(b) && b.type === 'text');
  const out: ChatEnvelope = {
    state: st,
    digest: env.digest ?? '',
    userTexts,
    messages: [...call.messages, { role: 'assistant', content: assistantContent }],
    conclusion: isFirstConclusion ? ev.sentences : call.stage === 'S5' ? mergeConclusion(env.conclusion, ev.sentences) : env.conclusion,
  };
  foldEnvelope(out);
  const display: DisplayTurn = {
    stage: call.stage,
    progress: STAGE_ORDER.indexOf(call.stage) + 1,
    sentences: ev.sentences,
    notes: buildNotes(call.stage, ev.sentences, call.moneyHint, call.chip, { safetyLine: st.crisisCards > 0 || st.safety, verdictAsked: call.verdictAsked, ending: endedByEnough, crisisCheck }),
    chips: st.ended ? [] : nextChips(call.stage, st, ev.sentences),
    ended: st.ended,
  };
  return { kind: 'ok', code: 'ok', env: out, display, droppedCount: ev.dropped.length, flags: flagged };
}

