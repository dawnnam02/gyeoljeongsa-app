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
