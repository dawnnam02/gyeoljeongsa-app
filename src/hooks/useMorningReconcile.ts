// 탭 묶음이 열릴 때 한 번: 서버 스위치 saju_morning(또는 오늘 하루 saju_today)이 꺼져 있으면 기기에 걸어 둔 사주 아침 알림 예약을 취소하고 기록을 지운다(QF2 Q2-04).
//  스위치를 읽지 못한 동안(처음값)은 아무것도 하지 않는다 — 읽은 값이 '꺼짐'일 때만 취소. 웹 · 알림 모듈이 없는 환경에서는 조용히 끝난다
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { isOn } from '@/lib/featureFlagsApi';
import { forgetMorning } from '@/lib/morningNotice';

import { appFlagsStore } from './useFeatureFlags';

export function useMorningReconcile(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    void (async () => {
      try {
        const flags = await appFlagsStore().refresh();
        if (!alive) return;
        if (!isOn(flags, 'saju_morning') || !isOn(flags, 'saju_today')) await forgetMorning();
      } catch {
        // 스위치를 못 읽으면 그대로 둔다(다음에 열 때 다시)
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
}
