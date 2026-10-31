// IF5 F0-A3 · AI 로 보내는 사실 묶음의 관계 label 을 화면 말로 바꾼다(보내는 쪽 치환).
// 왜: 모델이 calc5 label('마주 보며 자극하는 관계' 등 내부값)을 글에 옮겨 쓰면 화면 글에 옛 말이 보인다. 모델이 옛 말을 아예 보지 못하게 한다.
// 바꾸는 말은 neutral_names5.json 의 relations[code].label(= 마케팅 24-8 화면 말) 한 목록이다. 같은 label 이면(합 · 자형 등) 그대로 둔다.
// 내부값 REL_LABEL · 앱 · 계산 응답 · 서명 묶음은 그대로다 — 이 함수는 업체 요청 글을 만드는 순간에만 쓴다(원본을 바꾸지 않고 복사본을 돌려준다).

import { REL_LABEL } from '../../saju5/saju_calc5.ts';
import { NAMES5 } from '../../saju5/names5.ts';

type Rec = Record<string, unknown>;

/** 내부 label → 화면 말. 값이 다른 것만 담는다(충 · 천간충 → 부딪히기 쉬운 결, 형 → 엇갈리기 쉬운 결). */
export const SCREEN_LABEL5: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  const rel = NAMES5.relations as unknown as Record<string, { label: string }>;
  for (const [code, internal] of Object.entries(REL_LABEL)) {
    const screen = rel[code]?.label;
    if (typeof screen === 'string' && screen !== '' && screen !== internal) out[internal] = screen;
  }
  return out;
})();

/** 사실 묶음 안 모든 `label` 칸(문자열)을 화면 말로. 상대 최소 사실처럼 code 없이 label 만 있는 칸도 label 글자로 바꾼다. 원본은 그대로. */
export function screenRelationLabels<T>(facts: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') {
      const o: Rec = {};
      for (const [k, x] of Object.entries(v as Rec)) o[k] = k === 'label' && typeof x === 'string' && Object.hasOwn(SCREEN_LABEL5, x) ? SCREEN_LABEL5[x] : walk(x);
      return o;
    }
    return v;
  };
  return walk(facts) as T;
}
