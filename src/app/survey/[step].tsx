import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { DemoSkipBar } from '@/features/ai/DemoSkipBar';
import { liteEntryOf } from '@/features/surveyLite/liteModel';
import { SurveyLiteScreen } from '@/features/surveyLite/SurveyLiteScreen';
import { SurveyV2Screen } from '@/features/surveyV2/SurveyV2Screen';
import { surveyV2On } from '@/features/surveyV2/switch';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { isSurveyStep } from '@/navigation/surveySteps';

// 화면 ID 04 설문. [step] 값은 04- 뒤 두 자리(01~32, 12는 결번) 또는 v2.
// F20(팀장 결정 D-123): 스위치 survey_v2 가 켜져 있으면(features/surveyV2/switch: 못 읽으면 데모 켜짐 · 실제 꺼짐) 01~32 모두 정식 설문 v2(features/surveyV2) — v2 는 자리를 화면 안에서 정한다(첫 빈 필수 문항부터).
//  꺼져 있으면 임시(F2L) 짧은 설문: 32(05 의 ‹) = 마지막 쪽, notice=missing(05 에서 빠진 문항) = 처음 빈 쪽 + N12, 그 밖 = 처음 빈 쪽.
//  /survey/v2 는 스위치와 상관없이 v2(05 가 v2 빈 문항으로 보내는 곳 · 웹 점검 web-f20). 스위치를 읽는 동안은 빈 화면(한 번 깜빡임 방지)
// 데모 모드에서만 아래에 '설문 완료로 건너뛰기'(06 으로 가는 길)가 그대로 붙는다(F3 · check:f3 · f4 · f5 가 쓴다) — v2 에서도 같다.
export default function SurveyScreen() {
  const { step, notice } = useLocalSearchParams<{ step: string; notice?: string }>();
  const { flags, refresh } = useFeatureFlags();
  const [ready, setReady] = useState(flags.loaded);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    void refresh().finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ready, refresh]);

  const v2Entry = notice === 'missing' ? 'missing' : 'resume';
  if (step === 'v2') return <SurveyV2Screen key={`v2-${notice ?? ''}`} entry={v2Entry} />;
  if (!isSurveyStep(step)) {
    return <Redirect href={{ pathname: '/survey/[step]', params: { step: '01' } }} />;
  }
  const body = !ready ? <View style={{ flex: 1 }} testID="survey-flags-wait" /> : surveyV2On(flags) ? <SurveyV2Screen key={`v2-${notice ?? ''}`} entry={v2Entry} /> : <SurveyLiteScreen key={`${step}-${notice ?? ''}`} entry={liteEntryOf(step, notice)} />;
  return (
    <View style={{ flex: 1 }}>
      {body}
      <DemoSkipBar />
    </View>
  );
}
