// AIT-A · 업체 요청 꼴(Messages API) 만들기. 이 파일은 업체를 부르지 않고, 키 · 접근 코드 · 요청 머리를 다루지 않는다.
// 앱 서버 함수(AIT-F)가 공식 SDK로 부른다:   client.messages.create(body)   (maxRetries: 0 · AbortSignal 60초 · 도구 0 — 보안 AC-23 · 28 · 33)
// 요청 꼴은 서버가 정한다(AC-20): 모델 · max_tokens · effort · 지시문은 여기서만 정해지고 앱은 정하지 못한다.
//
// 지키는 것(스킬 2026-10-30):
//  - Sonnet 5.5 · Opus 5.5 · Haiku 5.5: thinking 끌 수 없음 → thinking 필드를 보내지 않는다. 깊이는 output_config.effort로만.
//  - temperature · top_p · top_k · tool_choice · prefill 보내지 않는다. 도구 0.
//  - 서버측 fallback 끔(AC-24): fallbacks 필드 · 베타 머리 없음.
//  - 챗봇은 effort를 세션 내내 같게 둔다(effort가 바뀌면 메시지 캐시가 식는다). 최상위 cache_control로 자동 캐시 + 시스템 지시문 블록에 따로 중단점(AI-FIX7 ⑩).

import type { ApiMessage, ModelId } from './types.ts';
import { CHAT_MODEL_ALT, FEATURE_MODEL } from './types.ts';
import type { Plan } from './chat.ts';
import { priceOf } from './cost.ts';
import type { Effort, OneShotSpec } from './features.ts';

/** 시스템 지시문 블록. 챗봇 본 호출은 이 블록 끝에 따로 캐시 중단점을 둔다(AI-FIX7 ⑩) */
export interface SystemBlock { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
export interface MessagesBody {
  model: ModelId;
  max_tokens: number;
  system: string | SystemBlock[];
  messages: ApiMessage[];
  output_config: { effort: Effort; format: { type: 'json_schema'; schema: Record<string, unknown> } };
  cache_control?: { type: 'ephemeral' };
}

export const CHAT_EFFORT: Effort = 'medium';

/** 챗봇 모델 고르기: 기본 Sonnet 5.5. 설정(AIT_CHAT_MODEL)이 opus 5.5 또는 sonnet 5.5일 때만 그 값. 그 밖의 값은 무시하고 기본값 */
export function pickChatModel(setting: string | undefined | null): ModelId {
  if (setting === CHAT_MODEL_ALT) return CHAT_MODEL_ALT;
  return FEATURE_MODEL.chat;
}

export function buildChatRequest(args: {
  model: ModelId; system: string; messages: ApiMessage[]; plan: Plan; schema: Record<string, unknown>;
}): MessagesBody {
  priceOf(args.model);                      // 단가표에 없는 모델이면 던진다(호출 거부)
  return {
    model: args.model,
    max_tokens: args.plan.maxTokens,
    // AI-FIX7 ⑩: 시스템 지시문(약 11.5K 토큰)에 **따로** 캐시 중단점. 최상위 cache_control 만 있으면 첫 사용자 글까지 한 덩어리로 캐시돼, 새 세션 첫 호출이 지시문 전체를 새로 써야 했다(캐시 쓰기 1.25배).
    //  지시문 블록에 중단점을 따로 두면 다른 세션이 5분 안에 써 둔 지시문 캐시를 새 세션 첫 호출이 읽는다. 지시문 문구 · 순서는 그대로여야 캐시가 맞는다.
    system: [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }],
    messages: args.messages,
    output_config: { effort: CHAT_EFFORT, format: { type: 'json_schema', schema: args.schema } },
    cache_control: { type: 'ephemeral' },
  };
}

export function buildOneShotRequest(args: { spec: OneShotSpec; system: string; userContent: string; schema: Record<string, unknown> }): MessagesBody {
  priceOf(args.spec.model);
  return {
    model: args.spec.model,
    max_tokens: args.spec.maxTokens,
    system: args.system,
    messages: [{ role: 'user', content: args.userContent }],
    output_config: { effort: args.spec.effort, format: { type: 'json_schema', schema: args.schema } },
  };
}

/** 요청 본문에 들어가면 안 되는 필드(시험이 확인한다) */
export const FORBIDDEN_BODY_KEYS: readonly string[] = [
  'tools', 'tool_choice', 'temperature', 'top_p', 'top_k', 'thinking', 'fallbacks', 'betas', 'stream', 'metadata', 'mcp_servers', 'container',
];
