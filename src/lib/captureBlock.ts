// 다른 회원의 프로필이 나오는 화면(09 · 10 · 11)에서 화면 캡처 · 녹화 막기(R14, 가정 D-23 BD-4). 설정이 켜져 있을 때만, 화면이 열려 있는 동안만.
// 웹에는 이 기능이 없어 아무것도 하지 않는다. 다른 기기로 찍는 것은 막을 수 없다.
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSecurityStore } from '@/store/securityStore';

import { safeLog } from './log';

const KEY = 'candidate-screens';

export function useCaptureBlock(): void {
  const on = useSecurityStore((s) => s.captureBlock);
  useEffect(() => {
    if (!on || Platform.OS === 'web') return undefined;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const capture = require('expo-screen-capture') as typeof import('expo-screen-capture');
    capture.preventScreenCaptureAsync(KEY).catch(() => safeLog({ event: 'capture.block.fail' }));
    return () => {
      capture.allowScreenCaptureAsync(KEY).catch(() => safeLog({ event: 'capture.allow.fail' }));
    };
  }, [on]);
}

// 나만 보는 하늘 읽기 화면(G-04 · G-07 · 정책 PG-03a · 보안 IC3-16)은 12 보안 설정과 상관없이 처음부터 캡처 · 녹화를 막는다(자기 생일을 좁히는 값이 모이는 곳이라서).
// active 가 참인 동안만(그 칸이 화면에 있을 때) · 웹은 아무것도 하지 않는다 · 모듈이 없거나 실패해도 화면은 그대로(조용히 건너뜀). 다른 기기로 찍는 것은 막을 수 없다.
const OWN_KEY = 'own-sky-screens';

export function useAlwaysCaptureBlock(active: boolean): void {
  useEffect(() => {
    if (!active || Platform.OS === 'web') return undefined;
    let capture: typeof import('expo-screen-capture') | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      capture = require('expo-screen-capture') as typeof import('expo-screen-capture');
      capture.preventScreenCaptureAsync(OWN_KEY).catch(() => safeLog({ event: 'capture.block.fail' }));
    } catch {
      safeLog({ event: 'capture.block.fail' });
      return undefined;
    }
    return () => {
      try {
        capture?.allowScreenCaptureAsync(OWN_KEY).catch(() => safeLog({ event: 'capture.allow.fail' }));
      } catch {
        safeLog({ event: 'capture.allow.fail' });
      }
    };
  }, [active]);
}
