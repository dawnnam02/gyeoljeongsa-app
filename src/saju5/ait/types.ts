// AIT-A · 공통 타입과 상수. 의존성 0.

export type Feature = 'chat' | 'compat' | 'coach' | 'horoscope';
export type ModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';
export type StageId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export type Kind =
  | 'restate' | 'problem_line' | 'summary'
  | 'trait' | 'reason' | 'counter' | 'check'
  | 'direction' | 'because' | 'option' | 'first_action' | 'change_if'
  | 'question';

export const KINDS: readonly Kind[] = [
  'restate', 'problem_line', 'summary', 'trait', 'reason', 'counter', 'check',
  'direction', 'because', 'option', 'first_action', 'change_if', 'question',
];

export type Strength = '-' | '보통' | '약함';
export type ModelFlag =
  | 'crisis' | 'violence' | 'stalking' | 'minor' | 'diagnosis_request' | 'verdict_request'
  | 'manipulation_request' | 'contact_info' | 'injection_suspected' | 'off_topic' | 'harm_intent';
export const MODEL_FLAGS: readonly ModelFlag[] = [
  'crisis', 'violence', 'stalking', 'minor', 'diagnosis_request', 'verdict_request',
  'manipulation_request', 'contact_info', 'injection_suspected', 'off_topic', 'harm_intent',   // A-QF2: harm_intent = 누군가를 해치고 싶다는 말(IF5 사주 이야기와 같게)
];

export interface Quote { n: number; q: string }
export interface ChatSentence { kind: Kind; text: string; strength: Strength; refs: string[]; quotes: Quote[] }

export interface ChatSlots {
  fact: string; my_reading: string; wish: string; problem_line: string;
  other_obs: string[]; my_guess: string; context: string; traits: string[];
  my_need: string; my_line: string; deadline: string;
}
export interface ChatModelOutput { stage: StageId; sentences: ChatSentence[]; slots: ChatSlots; flags: ModelFlag[] }

export type ApiMessage = { role: 'user' | 'assistant'; content: string | unknown[] };

/** 서버가 요청 꼴을 정한다(AC-20). 모델은 기능별 상수. */
export const FEATURE_MODEL: Readonly<Record<Feature, ModelId>> = {
  chat: 'claude-sonnet-5-5',        // 본인 선택(월 1만 원 예산). Opus는 설정으로만(CHAT_MODEL_ALT)
  compat: 'claude-haiku-5-5',
  coach: 'claude-sonnet-5-5',
  horoscope: 'claude-haiku-5-5',
};
export const CHAT_MODEL_ALT: ModelId = 'claude-opus-5-5';
