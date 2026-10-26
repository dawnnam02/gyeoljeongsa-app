// 대화형 설문 스위치(survey_chat, V6 · 0033 [0]) 읽기 한 곳. 꺼져 있으면 지금 설문 v2 화면 그대로.
//  · 서버가 스위치를 알려 주면(loaded) 그 값 — 단 설문 v2 가 켜져 있을 때만(대화형은 v2 문항 · 저장 키를 그대로 쓴다)
//  · 못 읽었을 때: 데모는 데모 처음값(featureKeys demo — 켜짐), 실제 앱은 닫힌 쪽(꺼짐)
import { env } from '@/config/env';
import { demoDefault } from '@/config/featureKeys';
import { surveyV2On } from '@/features/surveyV2/switch';
import { isOn, type FeatureFlags } from '@/lib/featureFlagsApi';

export function surveyChatOn(flags: FeatureFlags, demoMode: boolean = env.demoMode): boolean {
  if (!surveyV2On(flags, demoMode)) return false;
  if (flags.loaded) return isOn(flags, 'survey_chat');
  return demoMode ? demoDefault('survey_chat') : false;
}
