// AI직원 0원 문구 라이브러리(앱 사본 content/if2Library.json — scripts/gen-if2-assets.mjs 가 ai/IF2/문구_라이브러리.json 에서 만든다)를 id 로 꺼낸다.
//  · 서버(0043)는 문구 id(zw · sw · col · cs · cst · ct · ch · q)와 카드 번호만 준다 — 앱은 그 id 의 미리 쓴 글을 그린다(AI 호출 0 · PF-20)
//  · 같은 취미 이름: 코드 → 설문 v2 E11 보기 글 그대로(PF-49) · 묶인 갈래 → IF2 글 PAIR_CARD.hobbyGroup.<move · out · home>
//  · 일간 글자 · 생년월일은 이 파일에 없다(보안 S-4 — 라이브러리 사본에서 뺌)
import lib from '@/content/if2Library.json';
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';

import type { HobbyItem, TalkDepth } from './inflightApi';
import { fill, tx, txSeq } from './if2Text';

type Lib = typeof lib;
export type TarotCard = Lib['tarot'][number];
export type Column = Lib['column'][number];

const byId = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((x) => [x.id, x]));
const zodiac = byId(lib.zodiac);
const sajuWeek = byId(lib.sajuWeek);
const columns = byId(lib.column);
const questions = byId(lib.questions);
const compat = byId([...lib.compat.saju, ...lib.compat.star, ...lib.compat.topic, ...lib.compat.common]);
const chips = byId(lib.chips);

export const tarotOf = (no: number): TarotCard | null => lib.tarot.find((t) => t.no === no) ?? null;
export const zodiacText = (id: string): string | null => zodiac.get(id)?.text ?? null;
export const sajuText = (id: string): string | null => sajuWeek.get(id)?.text ?? null;
export const stemIntro = (stem: number): string | null => lib.stemIntro.find((s) => s.stem === stem)?.text ?? null;
export const columnOf = (id: string): Column | null => columns.get(id) ?? null;
export const questionText = (id: string): string | null => questions.get(id)?.text ?? null;
export const signName = (code: string): string | null => lib.codes.signs.find((s) => s.code === code)?.name ?? null;
export const element5Name = (code: string): string | null => lib.codes.elements5.find((e) => e.code === code)?.name ?? null;

// 질문 id 'q-깊이-번호' → 깊이 이름(가볍게 · 취향 · 생활 · 결혼관)
export const DEPTH_OF_NO: Readonly<Record<string, TalkDepth>> = { '1': 'light', '2': 'taste', '3': 'life', '4': 'values' };
export const depthOfQuestion = (id: string): TalkDepth | null => DEPTH_OF_NO[(/^q-(\d)-/.exec(id) ?? [])[1] ?? ''] ?? null;
export const questionsOfDepth = (d: TalkDepth): string[] => lib.questions.filter((q) => DEPTH_OF_NO[String(q.depth)] === d).map((q) => q.id);

// 같은 취미 이름(PF-49): 코드 = E11 보기 글(조사는 앱이 받침으로) · 갈래는 이름이 아니라 문장 하나(hobbyGroupLine)
export function hobbyName(h: HobbyItem): string | null {
  return 'code' in h ? (QUESTION_COPY.E11?.opt?.[h.code] ?? null) : null;
}
export function hobbyGroupLine(group: string): string | null {
  if (group === 'move') return tx('PAIR_CARD.hobbyGroup.move');
  if (group === 'out') return tx('PAIR_CARD.hobbyGroup.out');
  if (group === 'home') return tx('PAIR_CARD.hobbyGroup.home');
  return null;
}

// 궁합 카드 ① '두 분 다' 줄(3부-자 QP-49 · 카피 21-9): 머리 '두 분 다'를 줄에서 되풀이하지 않는다 — '…을 좋아해요' 틀.
//  코드 하나 = same.one · 코드 둘 = same.two(이름 차례) · 갈래 = 문장 하나(코드 줄과 따로 한 줄). 서버가 최대 2개 → 두 줄까지. 같은 값이 없으면 줄 0(① 칸째 숨김)
export function sameLines(items: readonly HobbyItem[]): string[] {
  const codes = items.map(hobbyName).filter((n): n is string => !!n);
  const groups = items.flatMap((h) => ('group' in h ? [hobbyGroupLine(h.group)] : [])).filter((n): n is string => !!n);
  const out: string[] = [];
  if (codes.length >= 2) out.push(txSeq('PAIR_CARD.same.two', { 취미: [codes[0], codes[1]] }));
  else if (codes.length === 1) out.push(tx('PAIR_CARD.same.one', { 취미: codes[0] }));
  out.push(...groups);
  return out.slice(0, 2);
}

// 관계 문장(cs-… 사주 · cst-… 별자리 원소) — 별자리 이름 · 일간 글자 0(라이브러리 글이 원소 · 오행 관계 문장뿐)
export const compatText = (id: string): string | null => compat.get(id)?.text ?? null;

// 첫마디 실마리 칩 글: ct-..(같은 취미 소재 틀, {v} = 취미 이름 — 코드일 때만) · ch-..(첫 인사 칩)
export function chipText(id: string, hobby: HobbyItem | null): string | null {
  if (id.startsWith('ch-')) return chips.get(id)?.text ?? null;
  const tpl = compat.get(id)?.text;
  const name = hobby ? hobbyName(hobby) : null; // 갈래(group)는 이름 글이 없어(3부-자 QP-49: 문장으로 바뀜) 소재 틀({v})에 못 넣는다 → 그 칩은 건너뜀
  return tpl && name ? fill(tpl, { v: name }) : null;
}

// ── 내 여행 타입 12 · 짐 싸기 7 · 이번 여행지 12(3부-자 — 라이브러리 원본 그대로) ──────────────────────────────
//  타입 id 'tt-01' ~ 'tt-12'(계산명세 10-1 차례). 앞면 한 줄(line) · 설명 세 줄(desc) · 노선 두 역(routes[].to = 타입 id, why = 역 까닭) · 대화 팁(tip — 1.0 화면에 안 그림)
export type TravelTypeLib = Lib['travelTypes'][number];
const travelTypes = byId(lib.travelTypes);
export const travelTypeOf = (id: string | null): TravelTypeLib | null => (id ? (travelTypes.get(id) ?? null) : null);
export const TRAVEL_TYPE_IDS: readonly string[] = lib.travelTypes.map((t) => t.id);

// 짐 싸기 7문항(보기 3) — 고른 짐 코드는 기기에만(deviceNotes typeBag), 엽서 앞면 소품 그림에만 들어간다(정책 PF-31)
export type PackQuestion = Lib['packQuiz'][number];
export const PACK_QUIZ: readonly PackQuestion[] = lib.packQuiz;
export const PACK_COUNT = lib.packQuiz.length;
export const packItemLabel = (item: string): string | null => {
  for (const q of lib.packQuiz) {
    const o = q.options.find((x) => x.item === item);
    if (o) return o.label;
  }
  return null;
};
// 저장된 고른 짐을 문항 차례의 코드로 바로잡는다(모르는 코드 · 다른 문항의 코드는 버림). 일곱 문항을 다 마쳤을 때만 '짐을 쌌다'
export function packedItems(bag: readonly string[]): (string | null)[] {
  return lib.packQuiz.map((q) => q.options.find((o) => bag.includes(o.item))?.item ?? null);
}
export const isPacked = (bag: readonly string[]): boolean => packedItems(bag).every((x) => x !== null);

// 기내지 ⑤ 이번 여행지: 서버 trip_no(1 ~ 12) → 여행지 글 한 편 + 둘이 하기 좋은 일 한 줄(계산명세 10-2 · 모든 회원 같은 글)
export type TripPlace = Lib['tripPlaces'][number];
export const tripPlaceOf = (tripNo: number | null): TripPlace | null => (tripNo === null ? null : (lib.tripPlaces.find((p) => p.trip_no === tripNo) ?? null));

export const LIBRARY_EDITION = lib['판'];
