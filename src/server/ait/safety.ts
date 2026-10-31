// A-QF2 · 갈래 겹침 처리(법무 17-2 ⑦). 순수 함수 · 가져오는 것은 고정 글과 낱말 문의 갈래 이름뿐.
//
// 한 글에 두 갈래가 걸릴 수 있다: '남편이 때려서 죽고 싶어요'(위기 + 폭력) · '저는 고2인데 죽고싶어요'(위기 + 미성년).
// classifyHits 가 걸린 갈래를 안전한 순서로 모두 돌려주고, 여기서 **가장 먼저 처리할 카드 하나**를 고른 뒤
// 다른 갈래의 **확정 번호 줄만** 그 카드에 덧붙인다(새 번호 글 0 · 새로 쓴 글은 마케팅 23-13-4의 위로 두 줄뿐).
//
//   바탕 카드 고르기:  위기 > 가해 의도 > 폭력 > 미성년        (오용은 겹침에 합치지 않는다 — 거절 카드는 따로)
//   덧붙는 줄:         폭력 → BRIDGE_VIOLENCE + LINE_1366   (바탕에 1366 이 없을 때)
//                      미성년 → BRIDGE_MINOR + LINE_1388      (바탕에 1388 이 없을 때) · 세션을 마친다
//                      위기 → (바탕에 109 · 112/119 가 없을 때) LINE_109 · LINE_112_119
//                      가해 의도 → 바탕에 112 · 109 가 없을 때만 그 줄
//   덧붙는 자리:       바탕 카드의 마지막 줄(안전 확인) 바로 앞.
//   폭력 + 가해 의도:  가해 의도 카드를 바탕으로 두고 1366 을 덧붙인다('맞아서 죽여버리고 싶어요' — 법무 확인 거리). 폭력 카드 4번째 줄('상대를 이해하려고 …')은 나가지 않는다.
//
// 걸린 말 · 판정은 어디에도 저장하지 않는다(로그 0). 돌려주는 것은 카드 · 세션을 마칠지 · 겹친 카드 id 뿐이다.

import type { HitClass } from './lexicon.ts';
import {
  BRIDGE_MINOR, BRIDGE_VIOLENCE, CRISIS_CARD, HARM_INTENT_CARD, LINE_109, LINE_112, LINE_112_119, LINE_1366, LINE_1388, MINOR_CARD, VIOLENCE_CARD,
} from './fixed.ts';
import type { FixedCard } from './fixed.ts';

export type SafetyKind = 'crisis' | 'harm_intent' | 'violence' | 'minor';

export interface SafetyOutcome {
  /** 바탕 카드 + 덧붙인 줄(원본 카드는 바꾸지 않는다) */
  card: FixedCard;
  /** 응답 코드: 미성년만 걸렸으면 refused_intent, 나머지는 crisis(안전 카드) */
  code: 'crisis' | 'refused_intent';
  /** 미성년이 한 갈래라도 걸렸으면 그 세션을 마친다 */
  endSession: boolean;
  /** 걸린 안전 갈래(바탕이 맨 앞) */
  kinds: readonly SafetyKind[];
}

const kindOf = (h: HitClass): SafetyKind | null =>
  h === 'crisis_db' || h === 'crisis_ext' ? 'crisis' : h === 'harm_intent' ? 'harm_intent' : h === 'violence' ? 'violence' : h === 'minor' ? 'minor' : null;

const BASE: Record<SafetyKind, FixedCard> = { crisis: CRISIS_CARD, harm_intent: HARM_INTENT_CARD, violence: VIOLENCE_CARD, minor: MINOR_CARD };
const ORDER: readonly SafetyKind[] = ['crisis', 'harm_intent', 'violence', 'minor'];

/** 안전 카드가 필요한 갈래를 모아 카드 하나로 합친다. 안전 갈래(위기 · 가해 의도 · 폭력 · 미성년)가 없으면 null(오용 · 없음은 호출하는 쪽이 처리) */
export function composeSafety(hits: readonly HitClass[]): SafetyOutcome | null {
  const kinds = ORDER.filter((k) => hits.some((h) => kindOf(h) === k));
  if (!kinds.length) return null;
  const base = kinds[0];
  const lines = [...BASE[base].lines];
  const closing = lines.pop() as string;            // 마지막 줄(안전 확인)은 맨 끝에 둔다. 미성년 바탕은 마지막 줄이 번호 줄이라 아래에서 따로 처리
  const baseIsMinor = base === 'minor';
  if (baseIsMinor) lines.push(closing);
  const has = (line: string): boolean => lines.includes(line) || (line === LINE_112 && lines.includes(LINE_112_119));
  const extra: string[] = [];
  const add = (...ls: string[]): void => { for (const l of ls) if (!has(l) && !extra.includes(l)) extra.push(l); };

  for (const k of kinds.slice(1)) {
    if (k === 'crisis') add(LINE_109, LINE_112_119);
    else if (k === 'harm_intent') add(LINE_112, LINE_109);
    else if (k === 'violence') { if (!has(LINE_1366)) add(BRIDGE_VIOLENCE, LINE_1366); }
    else if (k === 'minor') { if (!has(LINE_1388)) add(BRIDGE_MINOR, LINE_1388); }
  }
  const out = baseIsMinor ? lines : [...lines, ...extra, closing];
  // 한 갈래만 걸렸으면 고정 카드 원본 그대로(같은 객체) — 겹쳤을 때만 새 카드를 만든다
  const card: FixedCard = kinds.length === 1 ? BASE[base] : { ...BASE[base], lines: out, also: kinds.slice(1).map((k) => BASE[k].id) };
  const onlyMinor = kinds.length === 1 && base === 'minor';
  return { card, code: onlyMinor ? 'refused_intent' : 'crisis', endSession: kinds.includes('minor'), kinds };
}

/** 모델 표지(flags)로 같은 합치기를 한다: crisis → 위기, harm_intent → 가해 의도, violence · stalking → 폭력, minor → 미성년 */
export function composeSafetyFromFlags(flags: readonly string[]): SafetyOutcome | null {
  const hits: HitClass[] = [];
  if (flags.includes('crisis')) hits.push('crisis_ext');
  if (flags.includes('violence') || flags.includes('stalking')) hits.push('violence');
  if (flags.includes('harm_intent')) hits.push('harm_intent');
  if (flags.includes('minor')) hits.push('minor');
  return composeSafety(hits);
}
