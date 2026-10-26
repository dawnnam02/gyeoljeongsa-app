// 대화형 설문(V6-F) 글 고르기 · 채우기. 글 원본은 content/surveyChatCopy.ts(CHAT_V6 = 카피.md 13장)만 쓴다.
//  · 변형 고르기(V6-K 0장 · D-163): 같은 사람이 다시 열면 같은 말이 나오게 회원 ID + 문항 ID 로 고정(섞기 씨앗)
//  · 값 자리 {이름} · {지역} · {학교} · {n} · {최소} · {최대} · {섹션} · {월} · {일} · {답} 를 채우고, 조사 '으로/로'는 받침으로 고른다
//  · 받아 주는 말(ack)은 값을 평가하지 않는다 — 어느 줄을 쓸지만 답 종류(V6-K 표의 '답 종류')로 고른다
import { CHAT_V6 } from '@/content/surveyChatCopy';
import { SECTION_COPY } from '@/features/surveyV2/copy';
import { emptyDraft, qOf } from '@/features/surveyV2/model';
import type { SectionKey, V2Answers, V2Value } from '@/features/surveyV2/types';

export const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(CHAT_V6, key);
export const t = (key: string): string => CHAT_V6[key] ?? '';

// 씨앗 글 → 0 이상 정수(FNV-1a). 화면에 보이지 않는다
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// prefix.1 · prefix.2 · prefix.3 가운데 있는 것 하나(회원 ID 고정)
export function pick(prefix: string, userKey: string): string {
  const keys = [1, 2, 3].map((n) => `${prefix}.${n}`).filter(has);
  if (keys.length === 0) return '';
  return t(keys[seedOf(`${userKey}:${prefix}`) % keys.length]);
}

// 받침이 있으면 '으로', 없거나 ㄹ 받침이면 '로'
export function euro(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return /[0-9]$/.test(last) ? (/[136780]$/.test(last) ? '으로' : '로') : '로';
  const jong = code % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}

export type Fill = Readonly<Partial<Record<'이름' | '지역' | '학교' | 'n' | '최소' | '최대' | '섹션' | '월' | '일' | '답', string>>>;

export function fill(text: string, vars: Fill): string {
  let out = text;
  // 조사 붙은 자리 먼저: {지역}으로 · {학교}로 → 받침에 맞춰
  for (const name of ['지역', '학교'] as const) {
    const v = vars[name];
    if (v === undefined) continue;
    out = out.replace(new RegExp(`\\{${name}\\}(으로|로)`, 'g'), () => `${v}${euro(v)}`);
  }
  return out.replace(/\{([^}]+)\}/g, (m, k: string) => (vars as Record<string, string | undefined>)[k] ?? m);
}

// 이름 자리: 성을 뗀 이름(세 글자 이상일 때) — 시안 '한서윤 → 서윤 님'
export const givenName = (name: string): string => {
  const n = name.trim();
  return [...n].length >= 3 ? [...n].slice(1).join('') : n;
};

export const sectionName = (key: SectionKey): string => SECTION_COPY[key].name;

// 2부 칸: 서버 칸 키(ai/V6 · 0033) → 화면 글 키(V6-K 4장)
export const SLOT_COPY: Readonly<Record<string, string>> = {
  intro: 'intro',
  daily_work: 'work_day',
  family: 'family_ties',
  marriage: 'marriage_view',
  money: 'money_life',
  conflict: 'conflict',
  rest: 'rest',
  partner: 'wish_person',
  appeal: 'facts',
  last_words: 'last_words',
};
export const SLOT_ORDER: readonly string[] = Object.keys(SLOT_COPY);
export const slotName = (slot: string | null): string | null => (slot && SLOT_COPY[slot] ? t(`CHAT.SLOT.${SLOT_COPY[slot]}.name`) : null);
export const slotFallback = (slot: string): string => t(`CHAT.SLOT.${SLOT_COPY[slot] ?? slot}.fallback`);

// ── 받아 주는 말 고르기 ────────────────────────────────────────────────
const isArr = (v: unknown): v is readonly string[] => Array.isArray(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const INC_HIGH = ['inc05', 'inc06', 'inc07', 'inc08', 'inc09', 'inc10', 'inc11', 'inc12', 'inc13'];

// 답 종류 → ack 키 끝(t1 · t2 · decline · skip · any_ok …). 없으면 null(공통 말)
export function ackKind(id: string, value: V2Value | undefined, a: V2Answers, userKey = ''): string | null {
  if (value === undefined) {
    if (id === 'B03') return 'skip';
    if (id === 'F12') return 'none';
    return null;
  }
  if (value === null) return 'decline';
  const anyOk = value === 'any' || (isArr(value) && value.length === 1 && value[0] === 'any');
  if (anyOk && has(`CHAT.${id}.ack.any_ok`)) return 'any_ok';
  switch (id) {
    case 'A05':
      return typeof value === 'number' && (value < 140 || value > 200) ? 't2' : 't1';
    case 'A06':
      return value === 'other' ? 't1' : 't2';
    case 'A07':
      return value === 'never' ? 't1' : 't2';
    case 'A08':
    case 'B04':
      return value === 'none' ? 't1' : 't2';
    case 'B01':
      return value === 'hs' ? 't1' : 't2';
    case 'B02':
      return isObj(value) ? 't1' : 't2';
    case 'B05':
      return isObj(value) ? 't1' : value === 'none' ? 't2' : null;
    case 'C01':
      return value === 'student' ? 't1' : 't2';
    case 'C05':
      return a.C01 === 'student' && typeof value === 'string' && INC_HIGH.includes(value) ? 't2' : 't1';
    case 'D08':
    case 'D09':
      return value === 'unknown' ? 'unknown' : 't1';
    case 'D05':
      return value === '0' ? 't1' : 't2';
    case 'E13': {
      const first = emptyDraft(qOf('E13'), userKey);
      return first.kind === 'rankAll' && isArr(value) && value.join() === first.order.join() ? 'keep' : 't1';
    }
    case 'F12':
      return isArr(value) && value.length > 0 ? 't1' : 'none';
    default:
      return has(`CHAT.${id}.ack.any`) ? 'any' : has(`CHAT.${id}.ack.t1`) ? 't1' : null;
  }
}

const COMMON_ACKS = ['CHAT.ACK.1', 'CHAT.ACK.2', 'CHAT.ACK.3', 'CHAT.ACK.4'];

// 받아 주는 말 글(값 자리 채움). 줄이 없으면 공통 말을 돌려 쓴다
export function ackText(id: string, value: V2Value | undefined, a: V2Answers, vars: Fill, userKey: string): string {
  const kind = ackKind(id, value, a, userKey);
  const key = kind ? `CHAT.${id}.ack.${kind}` : null;
  if (key && has(key)) return fill(t(key), vars);
  if (has(`CHAT.${id}.ack.t1`) && kind !== 'decline') return fill(t(`CHAT.${id}.ack.t1`), vars);
  return t(COMMON_ACKS[seedOf(`${userKey}:${id}:ack`) % COMMON_ACKS.length]);
}
