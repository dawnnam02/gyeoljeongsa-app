// 01 온보딩 마지막 장의 출시일 한 줄(K20 4-5 · P-D9 · NP-01): 사전 오픈 중이면 '지금은 출시 전이에요. 첫 추천은 {12월 25일}부터 시작해요.'
//  · 로그인 전이라 get_launch_state 대신 로그인 없이 읽는 출시일(get_launch_public — S18 4-5, D-132)을 한 번 읽는다
//  · 못 읽거나 · 함수가 없거나 · 출시 뒤(open)면 아무것도 그리지 않는다(자리 0). 남은 날 수 0
//  · 서버 연결을 만들지 못하는 환경(시험 · 서버 설정 없음)에서도 화면을 깨뜨리지 않는다 — 연결을 못 만들면 줄 0(F24 · 앞 일 정리)
//  · 놓는 곳: features/onboarding/OnboardingScreen 마지막 장 본문 아래(F21 이 넣음)
import { useEffect, useState } from 'react';

import { AppText } from '@/components/AppText';

import type { LaunchApi, LaunchPublic } from './launchApi';
import { monthDayText } from './launchLogic';
import { PRELAUNCH_TABS } from './prelaunchCopy';
import { prelaunchServices } from './prelaunchServices';

export const onboardingLineText = (pub: LaunchPublic | null): string | null => {
  if (!pub || pub.phase === 'open') return null;
  const md = monthDayText(pub.launchDay);
  return md ? PRELAUNCH_TABS.onboarding(md) : null;
};

// 기본 연결: 만들 수 없으면(서버 주소 없음 등) null — 줄을 그리지 않는다
const defaultSource = (): Pick<LaunchApi, 'loadPublic'> | null => {
  try {
    return prelaunchServices().api;
  } catch {
    return null;
  }
};

export function OnboardingLaunchLine({ api, testID = 'onboarding-launch-line' }: { api?: Pick<LaunchApi, 'loadPublic'>; testID?: string }) {
  const [pub, setPub] = useState<LaunchPublic | null>(null);
  const [source] = useState(() => api ?? defaultSource());
  useEffect(() => {
    if (!source) return undefined;
    let alive = true;
    void source
      .loadPublic()
      .then((p) => {
        if (alive) setPub(p);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [source]);
  const text = onboardingLineText(pub);
  if (!text) return null;
  return (
    <AppText variant="bodyMedium" tone="accent" testID={testID}>
      {text}
    </AppText>
  );
}
