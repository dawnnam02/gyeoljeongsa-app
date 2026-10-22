// 가입 진행 상태 저장소(zustand). 저장소를 바깥에서 넣어 주므로 앱 재시작 시험을 메모리 저장소로 할 수 있다.
//  - stage  : 서버가 알려 준 진행 단계의 마지막 값(K2 2-3). 서버가 원본이라 기기에 저장하지 않는다.
//  - survey : 설문 임시 저장분(K2 04). 설문 답은 AsyncStorage 에 두지 않으므로(보안/구성.md 4-1)
//             SecureStore 조각 저장소에 둔다. 로그아웃 · 탈퇴 때는 resetAll() 로 지운다(점검표 A-14).
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { SurveyStep } from '@/navigation/surveySteps';
import type { ProgressStage } from '@/types/account';
import type { QuestionId, SurveyAnswer, SurveyDraft } from '@/types/survey';

export const SIGNUP_STORE_KEY = 'gyeoljeongsa.signup';

const EMPTY_SURVEY: SurveyDraft = { answers: {}, lastStep: null, updatedAt: null };

export type SignupState = {
  stage: ProgressStage | null;
  survey: SurveyDraft;
  setStage: (stage: ProgressStage | null) => void;
  setAnswer: (id: QuestionId, value: SurveyAnswer) => void;
  removeAnswer: (id: QuestionId) => void;
  setLastStep: (step: SurveyStep) => void;
  clearSurvey: () => void;
  resetAll: () => void;
};

export function createSignupStore(storage: StateStorage) {
  const store = create<SignupState>()(
    persist(
      (set) => ({
        stage: null,
        survey: EMPTY_SURVEY,
        setStage: (stage) => set({ stage }),
        setAnswer: (id, value) =>
          set((s) => ({
            survey: { ...s.survey, answers: { ...s.survey.answers, [id]: value }, updatedAt: Date.now() },
          })),
        removeAnswer: (id) =>
          set((s) => ({
            survey: {
              ...s.survey,
              answers: Object.fromEntries(Object.entries(s.survey.answers).filter(([key]) => key !== id)),
              updatedAt: Date.now(),
            },
          })),
        setLastStep: (step) => set((s) => ({ survey: { ...s.survey, lastStep: step } })),
        clearSurvey: () => set({ survey: EMPTY_SURVEY }),
        resetAll: () => {
          set({ stage: null, survey: EMPTY_SURVEY });
          void store.persist.clearStorage(); // 저장소의 줄 세우기 덕분에 위 저장이 끝난 뒤 지운다
        },
      }),
      {
        name: SIGNUP_STORE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ survey: state.survey }), // stage 와 함수는 저장하지 않는다
      },
    ),
  );
  return store;
}
