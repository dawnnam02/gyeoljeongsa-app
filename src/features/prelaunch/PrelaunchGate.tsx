// 탭 자리 분기(F22 · K20 4-5): 서버 get_launch_state 로 '사전 오픈 화면'과 원래 화면(children) 중 하나를 그린다. 앱은 날짜 · 시계로 판단하지 않는다(서버 값만).
//  09 PrelaunchGate:
//   · 스위치 prelaunch 가 켜져 있으면 서버 phase 가 prelaunch 라서 대기 화면. 끈 뒤에도 출시일 03:00 전(prelaunch) · 03:00~09:00(warming)에는 대기 화면,
//     출시 뒤 권역이 아직 열리지 않았으면 대기 화면(내 지역 안내)
//   · 서버에 함수가 아직 없거나 로그인이 없으면 지금 동작 그대로 오늘의 추천. 인터넷 · 서버 문제는 이번 실행에서 열림을 본 적이 있으면 오늘의 추천, 아니면 대기 화면 틀 + 다시 시도
//  11 · 16 PrelaunchTabGate: 출시일 09:00 전(prelaunch · warming)에만 사전 오픈 빈 상태(호감 · 상점 · 등급). 권역 기다림은 추천만 막는다(S18 6장)
//  · 다시 읽는 때: 처음 · 탭으로 돌아올 때(원래 화면을 그리는 중이 아닐 때만) · 앱이 앞으로 올 때 · 잇기 · 먼저 시작 뒤 · (데모) 장면을 바꿀 때. 시각 타이머 · 카운트다운 0
//  · 상태는 저장소(launchStore) 하나를 세 탭이 나눠 쓴다(요청 하나)
//  · (데모, F24) 열린 09 위에 끼리끼리 데모 줄 — 끼리끼리 장면 계정만 보인다. 누르면 원래 화면을 새로 그려 새 추천을 읽는다
//  · 불러오는 동안: 0.3초까지 빈 바탕, 그 뒤 카드 뼈대 1장(D25 10-2 대기 단계 · K20 4-1 '카드 스켈레톤 1장')
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { KinDemoChip } from '@/demo/kinDemo';
import { PrelaunchDemoBar, PrelaunchDemoReopen } from '@/demo/prelaunchDemoBar';
import { SkeletonCard, SkeletonPulse, waitStage } from '@/motion';
import { size, space } from '@/theme/tokens';

import { decideGate, decideTabGate, deferNoticeDue } from './launchLogic';
import { useLaunch } from './launchStore';
import { PrelaunchScreen } from './PrelaunchScreen';
import { PrelaunchTabScreen } from './PrelaunchTabScreen';
import { prelaunchServices, type PrelaunchServices } from './prelaunchServices';

// 다시 읽기: 처음 · 포커스(원래 화면이 아닐 때) · 앱이 앞으로 · 데모 장면
function useLaunchRefresh(services: PrelaunchServices, showingChildren: boolean) {
  const { store, demo } = services;
  const reload = useCallback(() => void store.refresh(), [store]);
  const showing = useRef(false);
  useEffect(() => {
    showing.current = showingChildren;
  }, [showingChildren]);
  useFocusEffect(
    useCallback(() => {
      if (!showing.current) reload();
      return undefined;
    }, [reload]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reload();
    });
    return () => sub.remove();
  }, [reload]);
  useEffect(() => demo?.subscribe(reload), [demo, reload]);
  return reload;
}

function Loading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), waitStage.blank);
    return () => clearTimeout(t);
  }, []);
  return (
    <Screen edges={['top']} backdrop="recommendations" testID="prelaunch-loading">
      {slow ? (
        <View style={styles.skeleton}>
          <SkeletonPulse>
            <SkeletonCard testID="prelaunch-skeleton" />
          </SkeletonPulse>
        </View>
      ) : null}
    </Screen>
  );
}

// confirmedOpens(V5 W6): 탑승권 탭 — 확정이면 출시 전에도 원래 화면(탑승권 판매 전 상태)을 그린다. 09 는 지금처럼 출시 뒤에만
export function PrelaunchGate({ children, deps, confirmedOpens = false }: { children: ReactNode; deps?: PrelaunchServices; confirmedOpens?: boolean }) {
  const [services] = useState<PrelaunchServices>(() => deps ?? prelaunchServices());
  const snap = useLaunch(services.store);
  const view = decideGate(snap.load, snap.seenOpen, confirmedOpens);
  const reload = useLaunchRefresh(services, view === 'open');
  const [kinRound, setKinRound] = useState(0);
  const { demo, store, kin } = services;

  if (view === 'loading') return <Loading />;
  if (view === 'open') {
    const reopen = demo?.sceneAccount() ? <PrelaunchDemoReopen onReopen={() => demo.setScene('prelaunch')} /> : null;
    if (!reopen && !kin) return <>{children}</>;
    return (
      <View style={styles.fill}>
        <View key={kinRound} style={styles.fill}>
          {children}
        </View>
        {reopen}
        {kin ? <KinDemoChip kin={kin} onChanged={() => setKinRound((n) => n + 1)} /> : null}
      </View>
    );
  }
  const load = snap.load;
  const state = load?.ok ? load.state : null;
  return (
    <PrelaunchScreen
      state={state}
      failure={load && !load.ok ? (load.reason === 'network' ? 'network' : 'server') : null}
      onRetry={reload}
      onChanged={reload}
      api={services.api}
      flags={services.flags}
      deferDue={state ? deferNoticeDue(state.deferredCount, snap.deferSeen) : false}
      onDeferSeen={() => {
        if (state) store.markDeferSeen(state.deferredCount);
      }}
      linkedHere={snap.linkedHere}
      onLinkedHere={store.markLinked}
      demoBar={demo ? <PrelaunchDemoBar onScene={(scene) => demo.setScene(scene)} /> : undefined}
    />
  );
}

// 11 호감 · 16 상점(+ 16-G 등급) 탭: 출시일 09:00 전에만 사전 오픈 빈 상태
export function PrelaunchTabGate({ kind, children, deps }: { kind: 'likes' | 'shop'; children: ReactNode; deps?: PrelaunchServices }) {
  const [services] = useState<PrelaunchServices>(() => deps ?? prelaunchServices());
  const snap = useLaunch(services.store);
  const view = decideTabGate(snap.load);
  useLaunchRefresh(services, view === 'open');
  if (view === 'loading') return <Loading />;
  if (view === 'open') return <>{children}</>;
  const state = snap.load?.ok ? snap.load.state : null;
  return <PrelaunchTabScreen kind={kind} launchDay={state?.launchDay ?? null} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skeleton: { paddingHorizontal: size.screenPadding, paddingTop: space.s24 },
});
