// IF5-A · 업체 요청 꼴(Messages API) 만들기. 업체를 부르지 않고 키 · 접근 코드 · 요청 머리를 다루지 않는다.
// AIT request.ts 와 같은 선: 모델 · max_tokens · effort 는 서버 상수, thinking · temperature · tools · fallbacks 필드 없음, 알 수 없는 모델은 거절.
// 챗봇은 최상위 cache_control 로 자동 캐시. 효과: 앞부분(지시문 + 사실 + 요약)이 접기 사이에는 같아서 읽기 값으로 나간다.

import type { ApiMessage } from '../ait/types.ts';
import type { MessagesBody } from '../ait/request.ts';
import { priceOf } from '../ait/cost.ts';
import { PLAN5 } from '../../saju5/spec5.ts';
import type { Feature5 } from '../../saju5/spec5.ts';
import { SCHEMAS5, PROMPTS5, COMMON5 } from './generated5.ts';
import { screenRelationLabels } from './ai_facts5.ts';

/** 사용자에게 글을 쓰는 기능은 공통 지시문 + 기능 지시문, 내부 요약은 자기 지시문만(입력이 작아 원가가 낮다) */
export function systemFor(feature: Feature5): string {
  return feature === 'summary' ? PROMPTS5.summary : COMMON5 + '\n\n' + PROMPTS5[feature];
}

export function buildRequest5(feature: Feature5, messages: ApiMessage[]): MessagesBody {
  const plan = PLAN5[feature];
  priceOf(plan.model);                  // 단가표에 없으면 던진다(호출 거부)
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw new Error('last_message_must_be_user');
  const body: MessagesBody = {
    model: plan.model,
    max_tokens: plan.maxTokens,
    system: systemFor(feature),
    messages,
    output_config: { effort: plan.effort, format: { type: 'json_schema', schema: SCHEMAS5[feature] } },
  };
  if (plan.cache) body.cache_control = { type: 'ephemeral' };
  return body;
}

/** 단발 기능(풀이 · 궁합 · 대운 · 신년 · 월운 · 오늘 · 택일)의 사용자 메시지 */
export function oneShotMessages(facts: unknown): ApiMessage[] {
  return [{ role: 'user', content: '<사실>' + JSON.stringify(screenRelationLabels(facts)) + '</사실>' }];
}
