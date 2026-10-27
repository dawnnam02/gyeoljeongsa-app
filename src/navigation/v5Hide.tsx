// V5 숨김(D-152 결정 22 · V5 파도 1 W10): 티켓 매칭 전환으로 v4 화면 셋을 스위치로 끈다. 코드 · 시험은 그대로 두고, 켜면 다시 보인다.
//  · v4_daily_recs = 09 하루 세 분(+ 13 추천 없음) · v4_likes = 11 호감(+ 14 호감 없음) · v4_shop = 16 상점 · 등급 구독 · 1회 매칭
//  · 스위치 키는 config/featureKeys.json(group V5, live · demo 모두 꺼짐). 데모 이메일 앞부분에 v4on 이 있으면 켜진 장면(예전 화면 점검)
//  · 꺼진 화면: 탭바 칸이 없고(app/(tabs)/_layout), 주소로 와도 그리지 않고 V5_HOME 으로 보낸다(V4Gate), 들어가는 버튼(12 구매 · 등급 구독 줄 · 10 등급 구독 줄)도 없다
//  · 스위치를 읽는 동안은 빈 화면(숨긴 화면이 한 번 비치지 않게)
//  · V5_HOME: 새 탭(탑승권 — 앱 C W6)이 생기기 전까지는 12 설정. 탑승권 탭이 생기면 여기 한 줄만 바꾼다
import { Redirect, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { V5_HIDE_KEYS } from '@/config/featureKeys';
import { appFlagsStore, createFlagsStore, useFeatureFlags, type FlagsStore } from '@/hooks/useFeatureFlags';
import { FLAGS_FALLBACK, isOn, type FeatureFlags } from '@/lib/featureFlagsApi';

export type V4Screen = keyof typeof V5_HIDE_KEYS;
export const V5_HOME: Href = '/boarding' as Href; // V5 W6: 탑승권 탭이 생겨 여기로(앱 C)

export const v4ScreenOn = (flags: FeatureFlags, screen: V4Screen): boolean => isOn(flags, V5_HIDE_KEYS[screen]);

// 앱 기본 저장소. 서버 설정이 없어 만들 수 없으면(시험 환경 등) live 값(꺼짐)만 주는 저장소 — 숨김이 닫힌 쪽으로
let fallbackStore: FlagsStore | null = null;
function defaultStore(): FlagsStore {
  try {
    return appFlagsStore();
  } catch {
    fallbackStore ??= createFlagsStore(async () => FLAGS_FALLBACK);
    return fallbackStore;
  }
}

// 스위치를 한 번 읽어 본 뒤(ready) 화면 셋이 켜졌는지. 못 읽으면 live 값(꺼짐)
export function useV4Screens(store?: FlagsStore): { ready: boolean; dailyRecs: boolean; likes: boolean; shop: boolean } {
  const { flags, refresh } = useFeatureFlags(store ?? defaultStore());
  const [tried, setTried] = useState(flags.loaded);
  useEffect(() => {
    if (tried) return undefined;
    let alive = true;
    void refresh().finally(() => {
      if (alive) setTried(true);
    });
    return () => {
      alive = false;
    };
  }, [tried, refresh]);
  const ready = tried || flags.loaded;
  return { ready, dailyRecs: v4ScreenOn(flags, 'dailyRecs'), likes: v4ScreenOn(flags, 'likes'), shop: v4ScreenOn(flags, 'shop') };
}

// 숨긴 화면의 라우트를 감싼다: 켜져 있으면 그대로, 꺼져 있으면 그리지 않고 V5_HOME 으로.
//  screen 을 여러 개 주면 하나라도 켜져 있을 때 연다(10 상대 프로필 = 09 · 11 어느 쪽에서든 들어오는 화면)
export function V4Gate({ screen, children, store }: { screen: V4Screen | readonly V4Screen[]; children: ReactNode; store?: FlagsStore }) {
  const s = useV4Screens(store);
  if (!s.ready) return <View style={{ flex: 1 }} testID="v4-gate-wait" />;
  const screens: readonly V4Screen[] = typeof screen === 'string' ? [screen] : screen;
  if (!screens.some((k) => s[k])) return <Redirect href={V5_HOME} />;
  return <>{children}</>;
}

// 10 상대 프로필 라우트의 문(3부-바 · QP-01 후속): 공개 순간(T3)에서 온 길(from=reveal)은 v5 길이라 늘 연다.
//  그 밖(09 카드 · 11 호감 행 · 주소를 직접 친 웹)은 v4 화면 09 · 11 중 하나가 켜져 있을 때만 — 꺼져 있으면 그리지 않고 V5_HOME 으로
export const CANDIDATE_V4_SCREENS: readonly V4Screen[] = ['dailyRecs', 'likes'];
export function CandidateGate({ from, children, store }: { from?: string | string[]; children: ReactNode; store?: FlagsStore }) {
  if (from === 'reveal') return <>{children}</>;
  return (
    <V4Gate screen={CANDIDATE_V4_SCREENS} store={store}>
      {children}
    </V4Gate>
  );
}
