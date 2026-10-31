// 화면 쪽 위기 앞거름(IF5-QF · 검수 F-01 · F-03) — 서버와 한 벌인 낱말 사전(src/saju5/ait/lexicon.ts = ai/AIT/ts/lexicon.ts 순수 사본)으로
//  동의 · 잔액 · 접근 코드를 확인하기 **전에** 글을 먼저 본다. 네트워크 0 · 저장 0 · 걸린 낱말을 내보내지 않는다(어느 종류인지만).
//  · 위기 · 폭력 → 위기 카드 / 오용 → 거절 카드 / 미성년 → 미성년 카드(서버 prepareChatText 와 같은 대응). 카드 글은 카피(AIT_TEXT CONCERN_CARD)에서 id 로 읽는다
//  · 데모(코드 없음)도 실서버도 같은 사전 — 사전이 바뀌면 `node scripts/sync-if5.mjs` 로 사본을 다시 맞춘다(--check 가 어긋남을 잡는다)
import { classifyHit } from '@/saju5/ait/lexicon';

import type { AitCard } from './aitTypes';

/** 글이 위기 · 폭력 · 오용 · 미성년 낱말에 걸리면 고정 카드(차감 0), 아니면 null */
export function localPrecheckCard(text: string): AitCard | null {
  const hit = classifyHit(text);
  if (hit === null) return null;
  if (hit === 'crisis_db' || hit === 'crisis_ext') return { id: 'crisis', lines: [], options: ['continue', 'end'] };
  if (hit === 'violence') return { id: 'violence', lines: [], options: ['continue', 'end'] };
  if (hit === 'misuse') return { id: 'misuse', lines: [], options: ['continue', 'end'] };
  return { id: 'minor', lines: [], options: ['end'] };
}
