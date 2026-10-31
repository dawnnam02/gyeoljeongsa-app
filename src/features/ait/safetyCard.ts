// 안전 카드 그리기 규칙(IF5-QF2 · 가해 의도 카드 · 갈래 겹침) — 화면은 서버 고정 카드의 줄을 그대로 그린다.
//  · 까닭: 카피 23-13-4(가해 의도 카드 글 · 겹침 위로 줄)는 아직 생성기가 읽는 23-5 표 밖이라 카피 사본(content/aitCopy.ts)에 키가 없다.
//    서버 고정 카드(ai/AIT/ts/fixed.ts = 화면 쪽 순수 사본 src/saju5/ait/fixed.ts)가 같은 글을 갖고 있고 check:copy 가 23-13-4 표와 한 글자씩 대조한다 → 글이 둘로 갈라지지 않는다.
//  · 한 갈래 카드(위기 · 폭력 · 거절 · 미성년)는 지금처럼 카피 23-5 키로 그린다. 가해 의도 카드 · 겹침 카드(위기 + 폭력 …)만 줄을 그대로 그린다.
//  · 네트워크 0 · 저장 0 · 걸린 낱말을 내보내지 않는다.
import { BRIDGE_MINOR, BRIDGE_VIOLENCE, HARM_INTENT_CARD, LINE_1388 } from '@/saju5/ait/fixed';

import type { AitCard } from './aitTypes';

/** 겹침 카드인가: 서버가 also 를 주었거나, 줄 안에 겹침 위로 줄이 있다(서버가 also 를 안 보내는 판에서도 알아본다) */
export function isComposed(card: AitCard): boolean {
  return (card.also?.length ?? 0) > 0 || card.lines.includes(BRIDGE_VIOLENCE) || card.lines.includes(BRIDGE_MINOR);
}

/** 줄을 그대로 그려야 하면 그 줄, 아니면 null(카피 키로 그린다). 가해 의도 카드는 줄이 비어 있어도 고정 카드의 줄을 쓴다 */
export function cardLinesOverride(card: AitCard): readonly string[] | null {
  if (card.id === 'harm_intent') return card.lines.length > 0 ? card.lines : HARM_INTENT_CARD.lines;
  if (isComposed(card) && card.lines.length > 0) return card.lines;
  return null;
}

/** 미성년이 한 갈래라도 끼었나 — 끼었으면 그 세션을 마친다(이어서 이야기하기 단추 0 · 닫기만) */
export function cardEndsSession(card: AitCard): boolean {
  return card.id === 'minor' || (card.also ?? []).includes('minor') || (isComposed(card) && card.lines.includes(LINE_1388));
}
