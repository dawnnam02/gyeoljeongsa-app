// 09 · 10 의 규칙(순수 함수). 원본: 기획/화면_요구사항.md 09 · 10 · 정책 2-4(맞는 점 이름 19개) · 1-1(09:00) · 7장.
//  · 앱은 정렬하지 않는다: 서버가 준 순서 그대로(R5). 가리는 계산도 하지 않는다 — 서버가 거른 것만 그린다
//  · 점수 · 등급 · 순위는 받지도 보이지도 않는다(lib/recsApi.ts 가 아는 키만 읽는다)
import { CANDIDATE, RECS } from '@/content/copy';

// 정책 2-4 표: 이유 ID → 칩에 쓰는 이름. 이 19개 밖의 ID 는 칩에 쓰지 않는다(서버도 같은 목록으로 거른다)
export const REASON_NAMES: Readonly<Record<string, string>> = {
  F01: '나이',
  F02: '키',
  F03: '학력',
  F04: '직업군',
  F05: '연봉',
  F06: '지역',
  F07: '종교',
  F08: '흡연',
  F09: '혼인 이력',
  F10: '자녀 유무',
  F14: '부모님 학력',
  F15: '부모님 자산',
  F16: '본인 자산',
  E01: '결혼 시기',
  E02: '자녀 계획',
  E03: '맞벌이',
  E05: '부모 부양',
  E06: '결혼 후 지역',
  E07: '돈 관리',
};

export const CARD_REASON_MAX = 3; // 09 칩
export const DETAIL_REASON_MAX = 5; // 10 박스

export function reasonNames(ids: readonly unknown[], max: number): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string') continue;
    const name = REASON_NAMES[id];
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

// 받침 있으면 "이", 없으면 "가"
export function withSubject(name: string): string {
  const code = name.charCodeAt(name.length - 1);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  return `${name}${hangul && (code - 0xac00) % 28 !== 0 ? '이' : '가'}`;
}

// "지역 · 종교 · 자녀 계획이 맞아요." (마지막 이름에만 이/가)
export function whySentence(names: readonly string[]): string {
  if (names.length === 0) return '';
  const head = names.slice(0, -1);
  const last = withSubject(names[names.length - 1]);
  return `${[...head, last].join(' · ')} 맞아요.`;
}

// 남은 시간: 1시간 이상 "{n}시간 {m}분"(분이 0이면 "{n}시간"), 1시간 미만 "{m}분", 1분 미만 "1분 미만" (2장 ②)
export function formatRemaining(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return '1분 미만';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export const remainingLabel = (ms: number): string => RECS.remaining(formatRemaining(ms));

// 서버 현재 시각과의 차(서버가 now 를 주면 그 값, 아니면 0)로 기기 시계가 틀려도 같게 센다
export function msUntil(nextAt: number, deviceNow: number, offset: number): number {
  return nextAt - (deviceNow + offset);
}

// 추천 0장일 때 무엇을 보이나(화면_요구사항 09 입력 검증 규칙 ③ · 스키마 9-12). 카드가 있으면 보지 않는다
//  first_list_pending=true → 첫 추천 대기 NK01(ready 와 상관없이, 서버가 계정별로 계산 · 가정 D-40)
//  아니고 ready=false     → 준비 중 NK02(정책 P1-20)
//  아니고 ready=true      → 13 추천 없음(후보 0명인 날)
export type EmptyKind = 'empty' | 'preparing' | 'first';
const KST_MS = 9 * 3_600_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export function emptyKind(firstListPending: boolean, ready: boolean): EmptyKind {
  if (firstListPending) return 'first';
  return ready ? 'empty' : 'preparing';
}

// 추천이 1~2명인 날의 지역 안내(B15 · D-66 ①). 서버가 region_hint 를 true 로 준 때만, 무료 카드가 1~2장일 때만 카드 수 n 을 돌려준다. 그 밖(힌트 false · 0장 · 3장 이상)은 null = 안내 없음.
//  앱은 지역 때문인지 따지지 않는다(R5, 서버 판정). 0장은 기존 빈 상태 글을 쓴다(카피 09: "0명이면 위 빈 상태 글을 쓴다")
export function widenCount(regionHint: boolean, freeCards: number): 1 | 2 | null {
  if (!regionHint) return null;
  return freeCards === 1 || freeCards === 2 ? freeCards : null;
}

// NK01 제목: 첫 목록은 next_at(다음 09:00)에 열린다(0008: 확정 직후 계정은 그 배치에서 첫 목록을 받는다).
//  첫 목록이 오늘(한국 날짜) 09:00 이고 아직 그 전이면 "오늘 오전 9시에 도착해요.", 1시간 미만이면 "{m}분 뒤", 아니면 "{n}시간 뒤"(올림)
export function firstWaitText(firstAt: number, serverNow: number): string {
  const today = new Date(serverNow + KST_MS);
  const at = new Date(firstAt + KST_MS);
  const sameDay = today.getUTCFullYear() === at.getUTCFullYear() && today.getUTCMonth() === at.getUTCMonth() && today.getUTCDate() === at.getUTCDate();
  if (sameDay && today.getUTCHours() < 9) return RECS.firstWaitToday;
  const left = firstAt - serverNow;
  if (left < HOUR_MS) return RECS.firstWaitMinutes(Math.max(1, Math.ceil(left / MINUTE_MS)));
  return RECS.firstWait(Math.ceil(left / HOUR_MS));
}

export function subtitleFor(count: number): string {
  if (count >= 3) return RECS.subtitle;
  if (count === 2) return RECS.subtitleFew(RECS.who.two);
  return RECS.subtitleFew(RECS.who.one);
}

// 값 하나를 글로: 글 · 숫자 · 글 목록. 모르는 모양은 null(칸을 비운다)
export function plain(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(plain).filter((x): x is string => x !== null);
    return parts.length ? parts.join(', ') : null;
  }
  return null;
}

// 지역은 모든 화면에서 "시도 약칭 + 시군구 전체"(서울 마포구)로 쓴다(U30, 줄여 쓰지 않는다)
export function regionText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return null;
  const v = value as { sido?: unknown; sigungu?: unknown };
  if (typeof v.sido !== 'string') return null;
  return typeof v.sigungu === 'string' && v.sigungu !== '' ? `${v.sido} ${v.sigungu}` : v.sido;
}

export function heightText(value: unknown): string | null {
  const text = plain(value);
  if (text === null) return null;
  return /^\d+(\.\d+)?$/.test(text) ? `${text}cm` : text;
}

export type Answers = Readonly<Record<string, unknown>>;

// 09 카드 한 줄 정보: 직업군 · 학력 · 종교 · 혼인 이력 — 상대가 보이게 둔 항목만(서버가 준 것만) 넣고 없으면 줄에서 뺀다
export function cardInfoLine(answers: Answers): string {
  return [answers.C01, answers.B01, answers.A06, answers.A07].map(plain).filter((x): x is string => x !== null).join(' · ');
}

// 10 한 줄 정보: 직업군 · 학력 · 종교 · 혼인 이력 · 흡연 · 키
export function detailInfoLine(answers: Answers): string {
  return [answers.C01, answers.B01, answers.A06, answers.A07, answers.A09].map(plain).filter((x): x is string => x !== null).concat(heightText(answers.A05) ?? []).join(' · ');
}

// 이름 줄: "김OO · 32 · 서울 강남"
export function headLine(answers: Answers): string {
  const age = plain(answers.A01);
  return [plain(answers.A12), age === null ? null : age, regionText(answers.A03)].filter((x): x is string => x !== null).join(' · ');
}

export function headLineDetail(answers: Answers): string {
  const age = plain(answers.A01);
  return [plain(answers.A12), age === null ? null : age, regionText(answers.A03)].filter((x): x is string => x !== null).join(' · ');
}

// 10 공개 항목 15개(정책 2-5, 이 순서). 서버가 상대가 보이게 둔 것만 주므로 있는 줄만 그린다(구간 공개 항목은 서버가 준 구간 글 그대로)
export const OPEN_ITEMS = ['A04', 'A10', 'A11', 'A08', 'D05', 'D06', 'B03', 'B04', 'C03', 'C04', 'C06', 'B02', 'C02', 'G02', 'G03'] as const;
export type OpenItemId = (typeof OPEN_ITEMS)[number];

export function openItems(answers: Answers): { id: OpenItemId; label: string; value: string }[] {
  const out: { id: OpenItemId; label: string; value: string }[] = [];
  for (const id of OPEN_ITEMS) {
    const value = plain(answers[id]);
    if (value !== null) out.push({ id, label: CANDIDATE.openLabels[id], value });
  }
  return out;
}

// 10 표 3줄: 항상 있다. 없으면(가렸거나 답하지 않음) "비공개"
export const TABLE_ROWS = [
  { key: 'income', question: 'C05' },
  { key: 'parentEducation', question: 'D03' },
  { key: 'parentAssets', question: 'D04' },
] as const;

export function tableRows(answers: Answers): { key: (typeof TABLE_ROWS)[number]['key']; label: string; value: string }[] {
  return TABLE_ROWS.map((r) => ({ key: r.key, label: CANDIDATE.tableLabels[r.key], value: plain(answers[r.question]) ?? CANDIDATE.hidden }));
}

export type PhotoSlotState = 'approved' | 'pending' | 'none';
export type PhotoSlot = { slot: string; state: PhotoSlotState; photoId: string | null };

// 10 상대 프로필에서 넘겨 볼 사진 쪽(Q5A-04 · F18 N1): 승인된 칸만 센다 — 확인 중 · 없음 칸은 쪽 수에 넣지 않는다(F18 조건 1: 승인 1장 + 확인 중 2장이면 승인 1장만 넘김 대상).
//  승인이 0장이면 기본 프로필 그림 한 쪽(화면요구사항 10 '사진 없음(K7)': '1 / 3' 표시와 넘기기 없음). 확인 중 칸이 있으면 그 쪽은 '확인 중' 모양(그림 아래 "사진 확인 중", NK03)
export function galleryPhotos(photos: readonly PhotoSlot[]): PhotoSlot[] {
  const approved = photos.filter((p) => p.state === 'approved');
  if (approved.length > 0) return approved;
  return [{ slot: 'face', state: photos.some((p) => p.state === 'pending') ? 'pending' : 'none', photoId: null }];
}
