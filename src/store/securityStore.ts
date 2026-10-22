// 보안 설정: 상대 화면 캡처 차단(가정 D-23 BD-4, 기본 끔). 켜고 끄는 스위치는 12 보안 화면(F7, features/settings/InfoPages.tsx)이 이 값을 바꾼다.
// 켜면 다른 회원의 프로필이 나오는 09 · 10 · 11 이 열려 있는 동안만 화면 캡처 · 녹화가 막힌다(lib/captureBlock.ts).
// 값은 이 기기에 저장한다(SecureStore 조각 저장소, 팀장 결정 10-15 ⑥ · U24). 개인정보가 아니라 기기 설정이라 로그아웃 · 탈퇴 때 지우지 않는다.
// 웹은 secureStorage 가 메모리라 페이지를 닫으면 처음값(끔)으로 돌아간다.
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { SCREEN_CAPTURE_BLOCK_DEFAULT } from '@/config/flags';
import { securityStorage } from '@/lib/secureStorage';

export const SECURITY_STORE_KEY = 'gyeoljeongsa.security';

type SecurityState = { captureBlock: boolean; setCaptureBlock: (on: boolean) => void };

export function createSecurityStore(storage: StateStorage) {
  return create<SecurityState>()(
    persist(
      (set) => ({
        captureBlock: SCREEN_CAPTURE_BLOCK_DEFAULT,
        setCaptureBlock: (on) => set({ captureBlock: on }),
      }),
      {
        name: SECURITY_STORE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ captureBlock: state.captureBlock }), // 함수는 저장하지 않는다
      },
    ),
  );
}

export const useSecurityStore = createSecurityStore(securityStorage);
