// 정식 설문 v2 스위치(survey_v2, K19 S01) 읽기 한 곳(F20 · 팀장 결정 D-123).
//  · 서버가 스위치를 알려 주면(loaded) 그 값
//  · 못 읽었을 때: 데모 모드는 데모 처음값(config/featureKeys demoDefault = 켜짐 — 데모 모의 서버가 get_feature_flags 를 아직 내지 않는다),
//    실제 앱은 닫힌 쪽(꺼짐 = 임시 설문)
import { env } from '@/config/env';
import { demoDefault } from '@/config/featureKeys';
import { isOn, type FeatureFlags } from '@/lib/featureFlagsApi';

export function surveyV2On(flags: FeatureFlags, demoMode: boolean = env.demoMode): boolean {
  if (flags.loaded) return isOn(flags, 'survey_v2');
  return demoMode ? demoDefault('survey_v2') : false;
}
