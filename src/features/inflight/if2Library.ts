// AI직원 0원 문구 라이브러리(앱 사본 content/if2Library.json — scripts/gen-if2-assets.mjs 가 ai/IF2/문구_라이브러리.json 에서 만든다)를 id 로 꺼낸다.
//  · 서버(0043)는 문구 id(zw · sw · col · cs · cst · ct · ch · q)와 카드 번호만 준다 — 앱은 그 id 의 미리 쓴 글을 그린다(AI 호출 0 · PF-20)
//  · 같은 취미 이름: 코드 → 설문 v2 E11 보기 글 그대로(PF-49) · 묶인 갈래 → IF2 글 PAIR_CARD.hobbyGroup.<move · out · home>
//  · 일간 글자 · 생년월일은 이 파일에 없다(보안 S-4 — 라이브러리 사본에서 뺌)
import lib from '@/content/if2Library.json';
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';

import type { HobbyItem, TalkDepth } from './inflightApi';
import { fill, tx } from './if2Text';

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

// 같은 취미 한 줄의 이름(PF-49): 코드 = E11 보기 글 · 갈래 = 마케팅 갈래 이름
export function hobbyName(h: HobbyItem): string | null {
  if ('code' in h) return QUESTION_COPY.E11?.opt?.[h.code] ?? null;
  if (h.group === 'move') return tx('PAIR_CARD.hobbyGroup.move');
  if (h.group === 'out') return tx('PAIR_CARD.hobbyGroup.out');
  if (h.group === 'home') return tx('PAIR_CARD.hobbyGroup.home');
  return null;
}

// 궁합 카드 ① '두 분 다' 줄(0원 틀 cc-hobby-1 · 2): 같은 취미 이름만 · 두 줄까지(서버가 최대 2개)
export function sameLine(items: readonly HobbyItem[]): string | null {
  const names = items.map(hobbyName).filter((n): n is string => !!n);
  if (names.length >= 2) return fill(compat.get('cc-hobby-2')?.text ?? '', { v1: names[0], v2: names[1] });
  if (names.length === 1) return fill(compat.get('cc-hobby-1')?.text ?? '', { v: names[0] });
  return null;
}

// 관계 문장(cs-… 사주 · cst-… 별자리 원소) — 별자리 이름 · 일간 글자 0(라이브러리 글이 원소 · 오행 관계 문장뿐)
export const compatText = (id: string): string | null => compat.get(id)?.text ?? null;

// 첫마디 실마리 칩 글: ct-..(같은 취미 소재 틀, {v} = 취미 이름) · ch-..(첫 인사 칩)
export function chipText(id: string, hobby: HobbyItem | null): string | null {
  if (id.startsWith('ch-')) return chips.get(id)?.text ?? null;
  const tpl = compat.get(id)?.text;
  const name = hobby ? hobbyName(hobby) : null;
  return tpl && name ? fill(tpl, { v: name }) : null;
}

export const LIBRARY_EDITION = lib['판'];
