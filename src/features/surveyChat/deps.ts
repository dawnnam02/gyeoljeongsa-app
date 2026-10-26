// 대화형 설문 화면이 기본으로 쓰는 연결: 데모 모드면 모의 서버(src/demo/surveyChatBackend.ts — 1부는 설문 v2 모의 서버를 그대로 지남), 아니면 실서버.
//  1부 저장 · 학교 검색 · 정치는 설문 v2 API(같은 함수 · 같은 키)를, 2부 · CK16 · 정리는 surveyChat api 를 쓴다. 처음 부를 때 한 번만 만든다. 시험은 deps 를 직접 넣는다
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { createSurveyChatDemoClient } from '@/demo/surveyChatBackend';
import { DEMO_V2_GUEST } from '@/demo/surveyV2Backend';
import { createSurveyV2Api } from '@/features/surveyV2/api';
import { createLocalDraftStore } from '@/features/surveyV2/localDraft';
import { createPoliticsApi } from '@/features/surveyV2/politics';
import type { SurveyV2Deps } from '@/features/surveyV2/deps';
import { appStateStorage } from '@/lib/secureStorage';
import { supabase } from '@/lib/services';

import { createSurveyChatApi, type SurveyChatApi } from './api';
import { createLocalChatStore, type LocalChatStore } from './localChat';

export type SurveyChatDeps = {
  v2: SurveyV2Deps; // 1부(설문 v2 와 같은 API · 기기 저장)
  chat: SurveyChatApi; // 2부 · CK16 · 정리
  store: LocalChatStore; // 대화 자리(이어서 하기)
  device: 'phone' | 'pc'; // PC · 웹은 서버가 pace 를 계산하지 않는다(D-164 ④)
  slowMs: number; // 이보다 늦으면 '답을 천천히 읽고 있어요.'
  monotonic?: () => number; // 행동 숫자 시계(시험)
};

export const SLOW_MS = 6_000; // ai/V6/예비질문.md iv.slow '6초 넘게'(카피 메모는 8초 가정 — V6-A 값을 따름)

let instance: SurveyChatDeps | null = null;

export function surveyChatDeps(): SurveyChatDeps {
  if (!instance) {
    const client = env.demoMode ? createSurveyChatDemoClient(supabase, { latencyMs: 120 }) : supabase;
    const api = env.demoMode
      ? createSurveyV2Api(client, { demo: true, proofUpload: true, schoolSearch: 'server' })
      : createSurveyV2Api(client, { demo: false, proofUpload: false, schoolSearch: 'local' });
    const guest = env.demoMode ? { guestUserId: DEMO_V2_GUEST } : {};
    instance = {
      v2: { api, local: createLocalDraftStore(appStateStorage), now: Date.now, politics: createPoliticsApi(client, 'app', guest) },
      chat: createSurveyChatApi(client, 'app', guest),
      store: createLocalChatStore(appStateStorage),
      device: Platform.OS === 'web' ? 'pc' : 'phone',
      slowMs: SLOW_MS,
    };
  }
  return instance;
}
