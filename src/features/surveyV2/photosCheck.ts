// 05 사진 등록의 '설문에 빈 문항이 있나' 검사(F20 · 팀장 결정 D-123). 05(PhotosLite, F21 주인)는 이 함수 하나만 부른다.
//  · 스위치 survey_v2 가 켜져 있으면(features/surveyV2/switch — 못 읽으면 데모는 켜짐 · 실제는 꺼짐) 정식 설문 v2 의 진행(필수 흐름의 첫 빈 문항)으로 보고, 빈 곳이 있으면 'v2'(→ /survey/v2?notice=missing)
//  · 꺼져 있으면 지금까지처럼 임시 설문(lite) 답으로 첫 빈 쪽 번호
//  · v2 답을 읽지 못하면 막지 않는다(null) — 서버 get_progress 와 AI 시작이 다시 본다
import { firstMissingPage, LITE_PAGES } from '@/features/surveyLite/liteModel';
import { appFlagsStore } from '@/hooks/useFeatureFlags';
import type { FeatureFlags } from '@/lib/featureFlagsApi';
import type { LiteAnswers } from '@/lib/surveyLiteApi';

import type { SurveyV2Api } from './api';
import { surveyV2Deps } from './deps';
import { firstMissing } from './model';
import { surveyV2On } from './switch';

export type PhotosCheckDeps = { flags: () => Promise<FeatureFlags>; api: () => Pick<SurveyV2Api, 'load'> };

const appDeps = (): PhotosCheckDeps => ({
  flags: async () => {
    const store = appFlagsStore();
    return store.get().loaded ? store.get() : store.refresh();
  },
  api: () => surveyV2Deps().api,
});

export async function photosSurveyMissing(liteAnswers: LiteAnswers, deps: PhotosCheckDeps = appDeps()): Promise<string | null> {
  if (!surveyV2On(await deps.flags())) {
    const i = firstMissingPage(liteAnswers);
    return i === null ? null : LITE_PAGES[i].step;
  }
  const r = await deps.api().load();
  if (!r.ok) return null;
  return firstMissing(r.data.answers) ? 'v2' : null;
}
