// 설문 v2 화면이 기본으로 쓰는 연결: 데모 모드면 모의 서버(src/demo/surveyV2Backend.ts)를 넣은 같은 API, 아니면 실서버.
// 로컬 저장은 민감한 값 저장소(lib/secureStorage appStateStorage = SecureStore 조각 저장, 웹은 메모리)만 쓴다 — AsyncStorage 에 두지 않는다(보안/구성.md 4-1).
// 처음 부를 때 한 번만 만든다. 화면 시험은 이 파일 대신 deps 를 직접 넣는다.
import { env } from '@/config/env';
import { createSurveyV2DemoClient, DEMO_V2_GUEST } from '@/demo/surveyV2Backend';
import { appStateStorage } from '@/lib/secureStorage';
import { supabase } from '@/lib/services';

import { createSurveyV2Api, type SurveyV2Api } from './api';
import { createLocalDraftStore, type LocalDraftStore } from './localDraft';
import { createPoliticsApi, type PoliticsApi } from './politics';

// politics(W8): 있으면 설문 흐름 끝에 정치성향 단계(CK15 별도 동의 + 끌기 막대)를 넣는다. 없으면 그 단계가 없다(옛 시험 그대로)
export type SurveyV2Deps = { api: SurveyV2Api; local: LocalDraftStore; now: () => number; politics?: PoliticsApi };

let instance: SurveyV2Deps | null = null;

export function surveyV2Deps(): SurveyV2Deps {
  if (!instance) {
    const client = env.demoMode ? createSurveyV2DemoClient(supabase, { latencyMs: 120 }) : supabase;
    const api = env.demoMode
      ? createSurveyV2Api(client, { demo: true, proofUpload: true, schoolSearch: 'server' })
      : createSurveyV2Api(client, { demo: false, proofUpload: false, schoolSearch: 'local' });
    instance = { api, local: createLocalDraftStore(appStateStorage), now: Date.now, politics: createPoliticsApi(client, 'app', env.demoMode ? { guestUserId: DEMO_V2_GUEST } : {}) };
  }
  return instance;
}
