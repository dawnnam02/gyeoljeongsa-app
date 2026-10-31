// 기내 서비스 · 연애 기능 1.0 규칙(순수 함수 · IF2-F). 정책 PF장 · 화면_요구사항 'T2 홈 — 새 구성' · 'T4 대화방 칸'.
//  · 홈 블록 자리 고정 B1 → B7 · 블록 5 이하 · 단계에 따라 보이는 블록만(PF-81 ~ PF-83)
//  · 숫자 · 판정 · 상대 정보 0(PF-02 · PF-03 · PF-08) — 여기서 만드는 글은 모두 IF2 글(tx) 또는 날짜 글
//  · 안전 안내 카드 판정은 기기에서만(저장 · 전송 · 로그 0, PF-56 · IFF-09)
import { MONEY_SAFETY_LURES, MONEY_SAFETY_STEMS, MONEY_SAFETY_WORDS } from '@/content/moneySafetyWords';
import { tripName } from '@/features/lounge/loungeLogic';

import type { Notes } from './deviceNotes';
import type { HomeBlock, HomeStage, HomeState, TalkDepth } from './inflightApi';

export const HOME_ORDER: readonly HomeBlock[] = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'];
export const BLOCK_MAX = 5;

// 홈 상태 코드(화면_요구사항 셈표 1.0 — 10): 서버 stage + 기기 메모(돌아보기)
export type HomeCode = 'loading' | 'error' | HomeStage | 'reflect';

// 기기에 남은 돌아보기 메모(방이 닫힌 뒤 + 30일 안 — 서버 reflect_ok)
export const hasReflectMemo = (s: HomeState, notes: Notes, now: number): boolean =>
  s.reflectOk && Object.values(notes.memos).some((m) => m.room !== s.pair?.roomId && m.texts.some((t) => t.trim() !== '') && (m.closedAt === null || now < m.closedAt + 30 * 86_400_000));

// 보이는 블록(자리 고정 · 5 이하). B4 돌아보기는 탑승 전 · 짝 없음 단계에 기기 메모가 남았을 때 앱이 더한다(0043 11-4)
export function homeBlocks(s: HomeState, notes: Notes, now: number): HomeBlock[] {
  const set = new Set<HomeBlock>(s.blocks.filter((b) => b !== 'T1'));
  set.add('B1');
  set.add('B7');
  if ((s.stage === 'before' || s.stage === 'noMatch') && !set.has('B4') && hasReflectMemo(s, notes, now)) set.add('B4');
  if (set.has('B2') && set.has('B5')) set.delete('B5'); // B2 · B5 는 함께 나오지 않는다(PF-81)
  const out = HOME_ORDER.filter((b) => set.has(b));
  while (out.length > BLOCK_MAX) out.splice(out.length - 2, 1); // 넘치면 B7 바로 앞 블록부터 뺀다(서버가 5 이하라 오지 않는 길)
  return out;
}

export function homeCode(s: HomeState, blocks: readonly HomeBlock[]): HomeCode {
  if ((s.stage === 'before' || s.stage === 'noMatch') && blocks.includes('B4')) return 'reflect';
  return s.stage;
}

// B4 머리: 서버 head(arrival · landing · meet) · 앱이 더한 돌아보기
export type StatusHead = 'arrival' | 'landing' | 'meet' | 'reflect';

// B7 접힘 줄 안 줄(PF-85, 끝 있는 목록 · 8 이하)
export type FoldRow = 'profile' | 'survey' | 'avoid' | 'chats' | 'memo' | 'type' | 'preview' | 'saju';
// sajuRow(IF5-F1 · 정책 PS-34): B6 에 '사주 마당' 칸이 못 들어갈 때(칸 3 이하) 접힘 줄 하나로 — 줄 8 이하 그대로
export function foldRows(s: HomeState, opts: { hasPastChat: boolean; memoElsewhere: boolean; typeOn: boolean; previewOn: boolean; sajuRow?: boolean }): FoldRow[] {
  const rows: FoldRow[] = ['profile', 'survey', 'avoid'];
  if (opts.hasPastChat) rows.push('chats');
  if (opts.memoElsewhere) rows.push('memo');
  if (opts.sajuRow) rows.push('saju');
  if (s.stage === 'matched' || s.stage === 'overlap') {
    if (opts.typeOn) rows.push('type');
    if (opts.previewOn) rows.push('preview');
  }
  return rows;
}

// ── 기내지 일곱 쪽(PF-22 — 표지 + 6쪽, 끝 쪽 뒤 넘김 0 · 쪽 번호 0) ────────────
export const MAG_PAGES = ['cover', 'skyGrain', 'card', 'love', 'question', 'place', 'back'] as const;
export type MagPage = (typeof MAG_PAGES)[number];
export const magNext = (p: MagPage): MagPage | null => MAG_PAGES[MAG_PAGES.indexOf(p) + 1] ?? null;
export const magPrev = (p: MagPage): MagPage | null => MAG_PAGES[MAG_PAGES.indexOf(p) - 1] ?? null;

export const tripOf = (tripNo: number | null): string | null => tripName(tripNo);

// 서버 get_magazine 은 '이번 회차에 안 탄 분'과 '탄 뒤 닫힌 분'이 같은 none 이라 앱이 탑승권 상태로 가른다(3부-자 QP-43 · 정책 PF-21):
//  판매 중 · 마감 뒤 공개 전(on_sale · closed)인데 탑승권(자리)이 없으면 notBoarded, 그 밖(공개 뒤 · 탑승 취소 · 상태를 못 읽음)은 closed
export function magazineNoneKind(b: { phase: string; ticket: unknown } | null): 'notBoarded' | 'closed' {
  return b !== null && b.ticket === null && (b.phase === 'on_sale' || b.phase === 'closed') ? 'notBoarded' : 'closed';
}

// ── 대화 깊이(PF-52) — 서버가 그날 열린 깊이를 준다. 앱은 이름 차례만 ─────────
export const DEPTH_ORDER: readonly TalkDepth[] = ['light', 'taste', 'life', 'values'];

// ── 미리 알려 두는 나(PF-53): 칸마다 하나 · 셋 칸까지 → 서버 ref 'reply0,upset2' ──────
export const ABOUT_CATS = ['reply', 'upset', 'pace', 'heart'] as const;
export type AboutCat = (typeof ABOUT_CATS)[number];
export const ABOUT_MAX = 3;
export const aboutRef = (picks: Partial<Record<AboutCat, number>>): string =>
  ABOUT_CATS.filter((c) => picks[c] !== undefined)
    .map((c) => `${c}${picks[c]}`)
    .join(',');

// ── 안전 안내 카드(F-39 · PF-56) — 받은 글 판정. 기기에서만 · 막지 않음 · 저장 · 전송 0 ──────────
const flat = (t: string) => t.toLowerCase().replace(/[\s.,!?~·'"()[\]{}<>\-_/]+/g, '');
export function moneySafetyHit(text: string): boolean {
  if (!text) return false;
  const f = flat(text);
  const lower = text.toLowerCase();
  if (MONEY_SAFETY_WORDS.some((w) => f.includes(flat(w)))) return true;
  if (MONEY_SAFETY_LURES.some((w) => lower.includes(w))) return true;
  return MONEY_SAFETY_STEMS.some((w) => f.includes(w));
}

// ── 날짜 글(KST · '10월 28일' 꼴 — 미리 답한 날 · 메모 지워지는 날) ───────────
const KST = 9 * 3_600_000;
export function kstDateText(ms: number): string {
  const d = new Date(ms + KST);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
export const MEMO_KEEP_MS = 30 * 86_400_000;
