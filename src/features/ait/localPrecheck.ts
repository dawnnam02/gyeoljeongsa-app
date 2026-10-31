// 화면 쪽 위기 앞거름(IF5-QF · 검수 F-01 · F-03 / IF5-QF2) — 서버와 한 벌인 낱말 사전(src/saju5/ait/lexicon.ts = ai/AIT/ts/lexicon.ts 순수 사본)과
//  갈래 겹침 합치기(src/saju5/ait/safety.ts 사본)로 동의 · 잔액 · 접근 코드를 확인하기 **전에** 글을 먼저 본다. 네트워크 0 · 저장 0 · 걸린 낱말을 내보내지 않는다(어느 종류인지만).
//  · 위기 · 가해 의도 · 폭력 · 미성년 → 안전 카드 한 장(여러 갈래가 걸리면 서버와 같게 바탕 카드에 다른 갈래의 확정 번호 줄만 덧붙임 · 미성년이 끼면 세션을 마침) / 오용 → 거절 카드
//  · 순서는 서버 prepareChatText(input5)와 같다: 안전 카드(미성년 바탕 빼고) → 오용 → 미성년만. 한 갈래 카드는 lines 를 비워 두고(카피 23-5 키로 그림) 가해 의도 · 겹침 카드는 줄을 채운다(safetyCard.ts)
//  · 데모(코드 없음)도 실서버도 같은 사전 — 사전이 바뀌면 `node scripts/sync-if5.mjs` 로 사본을 다시 맞춘다(--check 가 어긋남을 잡는다)
import { classifyHits } from '@/saju5/ait/lexicon';
import { composeSafety } from '@/saju5/ait/safety';

import type { AitCard } from './aitTypes';

/** 글이 위기 · 가해 의도 · 폭력 · 오용 · 미성년 낱말에 걸리면 고정 카드(차감 0), 아니면 null */
export function localPrecheckCard(text: string): AitCard | null {
  const hits = classifyHits(text);
  if (hits.length === 0) return null;
  const safe = composeSafety(hits);
  if (safe && safe.kinds[0] !== 'minor') return toCard(safe.card.id, safe.card.lines, safe.card.options, safe.card.also, safe.kinds.length > 1 || safe.kinds[0] === 'harm_intent', safe.endSession);
  if (hits.includes('misuse')) return { id: 'misuse', lines: [], options: ['continue', 'end'] };
  if (safe) return toCard(safe.card.id, safe.card.lines, safe.card.options, safe.card.also, safe.kinds.length > 1, true);
  return null;
}

function toCard(id: string, lines: readonly string[], options: readonly ('continue' | 'end')[], also: readonly string[] | undefined, withLines: boolean, ends: boolean): AitCard {
  const card: AitCard = { id, lines: withLines ? [...lines] : [], options: ends ? ['end'] : [...options] };
  if (also?.length) card.also = [...also];
  return card;
}
