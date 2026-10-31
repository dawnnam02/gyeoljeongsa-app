// AIT-A · 근거 카드: 읽기 · 검사 · 지시문 줄 만들기 · 화면용 출처 글.
// 모델은 번호(K-n)만 쓴다. 저자 · 연도 · 제목은 여기서 번호로 찾아 서버가 붙인다.

import type { StageId } from './types.ts';

export type ReviewStatus = 'pending_human' | 'human_verified' | 'retired';

export interface EvidenceCard {
  id: string;                       // 'K-12'
  draft_id: string;
  concept: string;
  summary_ko: string;               // 카드 글(우리 말, 원문 인용 0)
  must_not_say: string[];
  limit: string;
  use_in: StageId[];
  safety_only?: boolean;
  level: string;
  in_prompt: boolean;
  source: { authors: string; year: number; title: string; venue: string; publisher: string; doi_or_isbn: string | null };
  verification: { status: string; checked_on: string; method: string; urls: string[]; note: string };
  review: { status: ReviewStatus; by: string | null; on: string | null };
}

const STAGES: readonly string[] = ['S1', 'S2', 'S3', 'S4', 'S5'];
const ID_RE = /^K-[1-9][0-9]?$/;

/** 카드 JSON(evidence_cards.json)을 읽어 모양을 검사한다. 모양이 틀리면 던진다(고정 문구). */
export function parseCards(json: unknown): EvidenceCard[] {
  const root = json as { cards?: unknown };
  if (!root || !Array.isArray(root.cards)) throw new Error('cards:shape');
  const seen = new Set<string>();
  const out: EvidenceCard[] = [];
  for (const raw of root.cards as Record<string, unknown>[]) {
    const id = String(raw.id ?? '');
    if (!ID_RE.test(id)) throw new Error('cards:id');
    if (seen.has(id)) throw new Error('cards:dup');
    seen.add(id);
    const useIn = raw.use_in;
    if (!Array.isArray(useIn) || !useIn.every((s) => STAGES.includes(String(s)))) throw new Error('cards:use_in');
    if (typeof raw.summary_ko !== 'string' || raw.summary_ko.length < 10) throw new Error('cards:summary');
    const review = raw.review as { status?: string } | undefined;
    if (!review || !['pending_human', 'human_verified', 'retired'].includes(String(review.status))) throw new Error('cards:review');
    const src = raw.source as Record<string, unknown> | undefined;
    if (!src || typeof src.authors !== 'string' || typeof src.year !== 'number' || typeof src.title !== 'string') throw new Error('cards:source');
    const ver = raw.verification as { status?: string } | undefined;
    if (!ver || ver.status !== '대조함') throw new Error('cards:verification');
    out.push(raw as unknown as EvidenceCard);
  }
  return out;
}

/** 지시문에 넣을 수 있는 카드. allowPending=true(비공개 시험)면 사람 검수 대기 카드도 쓴다. 공개 전에는 false. */
export function activeCards(cards: readonly EvidenceCard[], opts: { allowPending: boolean }): EvidenceCard[] {
  return cards.filter((c) => c.in_prompt && c.review.status !== 'retired' && (c.review.status === 'human_verified' || opts.allowPending));
}

/** 번호 -> 카드 (활성 카드만) */
export function cardIndex(cards: readonly EvidenceCard[]): Map<string, EvidenceCard> {
  return new Map(cards.map((c) => [c.id, c]));
}

/** 지시문 한 줄: 번호 | 말해도 되는 것 | 단계 | 하지 말 것 */
export function renderCardLines(cards: readonly EvidenceCard[]): string {
  return cards
    .map((c) => {
      const stages = c.safety_only ? c.use_in.map((s) => s + '(안전 트랙만)').join(' ') : c.use_in.join(' ');
      return `${c.id} | ${c.summary_ko} | ${stages} | ${c.must_not_say.join('; ')}`;
    })
    .join('\n');
}

/** 시스템 지시문 만들기: 템플릿의 {{CARDS}} 자리를 카드 줄로 바꾼다. 카드 목록이 바뀌면 지시문 앞부분이 바뀌어 캐시가 한 번 식는다. */
export function buildChatSystem(template: string, cards: readonly EvidenceCard[]): string {
  if (!template.includes('{{CARDS}}')) throw new Error('prompt:no_cards_slot');
  return template.replace('{{CARDS}}', renderCardLines(cards));
}

/** 화면에 붙일 출처 글: 저자 (연도). 제목. 매체 */
export function citationFor(card: EvidenceCard): string {
  const s = card.source;
  return `${s.authors} (${s.year}). ${s.title}. ${s.venue}`;
}

/** 실무 모델(연구 근거가 약한 카드)인가 — 화면에 '연구보다는 실무에서 쓰는 방법이에요' 표시 */
export function isPractical(card: EvidenceCard): boolean {
  return card.level.includes('실무') || card.level.includes('대중서');
}
