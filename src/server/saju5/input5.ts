// IF5-A · 입력 허용 목록. 출생 정보(본인 · 상대) 검사와 대화 글 준비. 업체를 부르지 않는다.
// 상대 생일: 키는 생년월일 · 시각 · (성별 · 출생지는 선택)뿐. 이름 · 별명 · 메모 · 연락처 키가 있으면 거절한다(이름 0 · 저장 0은 구조로).

import { classifyHit } from '../ait/lexicon.ts';
import { CRISIS_CARD, MINOR_CARD, MISUSE_CARD, VIOLENCE_CARD } from '../ait/fixed.ts';
import type { FixedCard } from '../ait/fixed.ts';
import { charLen, hasResidualPii, maskText, sanitize } from '../ait/text.ts';

/** calc5.py BIRTH_PLACES 와 같은 이름(시험이 파이썬 파일과 대조) */
export const BIRTH_PLACES: Readonly<Record<string, number>> = {
  서울: 126.98, 인천: 126.71, 수원: 127.03, 춘천: 127.73, 강릉: 128.88, 원주: 127.95, 청주: 127.49, 대전: 127.38, 세종: 127.29, 전주: 127.15,
  광주: 126.85, 목포: 126.39, 여수: 127.66, 제주: 126.53, 대구: 128.60, 안동: 128.73, 포항: 129.37, 울산: 129.31, 부산: 129.08, 창원: 128.68,
  진주: 128.11, 평양: 125.75, 개성: 126.55,
};

export interface BirthInput { year: number; month: number; day: number; hour: number | null; minute: number | null; gender: 'M' | 'F' | null; place: string | null }
const BIRTH_KEYS = ['year', 'month', 'day', 'hour', 'minute', 'gender', 'place'] as const;
const NAME_LIKE = ['name', 'nickname', 'alias', 'memo', 'phone', 'contact', 'email', 'sns', 'note', 'label'];
export const SUPPORT_FROM = Date.UTC(1961, 7, 10);   // 1961-08-10
export const SUPPORT_TO_YEAR = 2050;

export type BirthCheck = { ok: true; value: BirthInput } | { ok: false; why: string };

function isRec(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }

/** role=partner(상대): 성별 · 출생지는 받지만 필수 아님. 두 역할 모두 키 허용 목록은 같다. */
export function validateBirth(raw: unknown, role: 'self' | 'partner'): BirthCheck {
  if (!isRec(raw)) return { ok: false, why: 'shape' };
  for (const k of Object.keys(raw)) {
    if (NAME_LIKE.includes(k.toLowerCase())) return { ok: false, why: role === 'partner' ? 'partner_name_not_allowed' : 'name_not_allowed' };
    if (!(BIRTH_KEYS as readonly string[]).includes(k)) return { ok: false, why: 'extra_key' };
  }
  const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
  const y = int(raw.year), m = int(raw.month), d = int(raw.day);
  if (y === null || m === null || d === null) return { ok: false, why: 'date' };
  if (y < 1961 || y > SUPPORT_TO_YEAR || m < 1 || m > 12 || d < 1 || d > 31) return { ok: false, why: 'date_range' };
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return { ok: false, why: 'date_invalid' };
  if (t.getTime() < SUPPORT_FROM) return { ok: false, why: 'before_1961_08_10' };
  const hasH = raw.hour !== undefined && raw.hour !== null;
  const hasM = raw.minute !== undefined && raw.minute !== null;
  let hour: number | null = null, minute: number | null = null;
  if (hasH) {
    hour = int(raw.hour);
    minute = hasM ? int(raw.minute) : 0;
    if (hour === null || minute === null || hour < 0 || hour > 23 || minute < 0 || minute > 59) return { ok: false, why: 'time' };
  } else if (hasM) return { ok: false, why: 'minute_without_hour' };
  let gender: 'M' | 'F' | null = null;
  if (raw.gender !== undefined && raw.gender !== null) {
    if (raw.gender !== 'M' && raw.gender !== 'F') return { ok: false, why: 'gender' };
    gender = raw.gender;
  }
  let place: string | null = null;
  if (raw.place !== undefined && raw.place !== null) {
    if (typeof raw.place !== 'string' || !Object.prototype.hasOwnProperty.call(BIRTH_PLACES, raw.place)) return { ok: false, why: 'place' };
    place = raw.place;
  }
  return { ok: true, value: { year: y, month: m, day: d, hour, minute, gender, place } };
}

// ---------------------------------------------------------------- 대화 글 준비 (위기 · 폭력 · 오용 · 미성년 → 고정 카드, 가리기)
export const CHAT5_LIMITS = { textMax: 1000 } as const;   // 한 번에 보내는 글 길이(기술적 크기 한도 — 횟수 · 턴 수 한도는 없음)

export type ChatPrep5 =
  | { kind: 'reject'; code: 'bad_request' | 'too_long'; why: string }
  | { kind: 'card'; code: 'crisis' | 'refused_intent'; card: FixedCard; endSession: boolean }
  | { kind: 'ok'; text: string; masked: number };

export function prepareChatText(raw: unknown): ChatPrep5 {
  if (typeof raw !== 'string') return { kind: 'reject', code: 'bad_request', why: 'type' };
  const clean = sanitize(raw).trim();
  if (!clean) return { kind: 'reject', code: 'bad_request', why: 'empty' };
  const hit = classifyHit(clean);
  if (hit === 'crisis_db' || hit === 'crisis_ext') return { kind: 'card', code: 'crisis', card: CRISIS_CARD, endSession: false };
  if (hit === 'violence') return { kind: 'card', code: 'crisis', card: VIOLENCE_CARD, endSession: false };
  if (hit === 'misuse') return { kind: 'card', code: 'refused_intent', card: MISUSE_CARD, endSession: false };
  if (hit === 'minor') return { kind: 'card', code: 'refused_intent', card: MINOR_CARD, endSession: true };
  if (charLen(clean) > CHAT5_LIMITS.textMax) return { kind: 'reject', code: 'too_long', why: 'length' };
  const m = maskText(clean);
  if (hasResidualPii(m.text)) return { kind: 'reject', code: 'bad_request', why: 'residual_pii' };
  return { kind: 'ok', text: m.text, masked: m.count };
}
