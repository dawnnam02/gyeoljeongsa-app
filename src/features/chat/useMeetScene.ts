// 대화방(/chat/[id]) 첫 상태로 만남 장면을 띄울지 정하는 훅(D46 · 화면 T4S 판단 순서 · 정책 P4-21 ~ P4-28). 대화방이 이미 읽는 방 · 글을 그대로 받아 판단한다(서버 요청 더하기 0).
//  · 판단은 방마다 한 번 · 처음 정한 뒤로는 바꾸지 않는다(장면 도중 새 글이 와도 끝 줄 그대로)
//  · 판단하는 동안은 바탕만(글 · 뼈대 깜빡임 0), 1초를 넘기면 대화방 뼈대(K27 3-1)
//  · deps 가 없으면(시험 · 다른 화면) 기능 0 — 장면 · 기억 줄 모두 없다
import { useCallback, useEffect, useState } from 'react';

import { appFlagsStore, type FlagsStore } from '@/hooks/useFeatureFlags';
import { isOn } from '@/lib/featureFlagsApi';
import { useScreenReader } from '@/lib/screenReader';
import { useReduceMotion } from '@/motion';
import { scene2 } from '@/theme/motion';

import type { Message, Room } from './chatApi';
import { decideMeet, MEET_SWITCH, meetModeOf, metAtLine, type MeetLoad, type MeetMode, type MeetScenePlan } from './meetLogic';
import { createMeetSeen, meetSeenStore, useMeetSeen, type MeetSeen } from './meetSeen';

export type MeetDeps = { switchOn: () => Promise<boolean>; seen: MeetSeen };

// 기능 스위치 meet_scene(config/featureKeys.json: live 꺼짐 · 데모 켜짐). 아직 못 읽었으면 한 번 읽고, 못 읽으면 live 값(꺼짐)
export async function meetSwitchOn(store: FlagsStore): Promise<boolean> {
  const cur = store.get();
  const flags = cur.loaded ? cur : await store.refresh();
  return isOn(flags, MEET_SWITCH);
}

let appDeps: MeetDeps | null = null;
export function appMeetDeps(): MeetDeps {
  if (!appDeps) appDeps = { switchOn: () => meetSwitchOn(appFlagsStore()), seen: meetSeenStore() };
  return appDeps;
}

const OFF_SEEN = createMeetSeen(); // deps 가 없을 때 훅 자리만 채운다(읽지도 쓰지도 않음)

type State = { kind: 'wait' } | { kind: 'none'; mark: boolean } | { kind: 'scene'; plan: MeetScenePlan; mode: MeetMode };
export type MeetView = {
  scene: { plan: MeetScenePlan; mode: MeetMode } | null; // 지금 장면을 보여 줄 때
  cover: boolean; // 판단 중 바탕만(1초까지)
  metAt: string | null; // 대화방 맨 위 기억 한 줄(스위치 켜짐일 때 · 열린 방 · 닫힌 방 모두)
  done: () => void; // 끝 · [건너뛰기] · [대화방으로 가기] · 앱이 뒤로 감
};

export function useMeetScene(deps: MeetDeps | undefined, input: { id: string; load: MeetLoad; room: Room | null; messages: readonly Message[]; now: () => number }): MeetView {
  const { id, load, room, messages, now } = input;
  const reduce = useReduceMotion();
  const reader = useScreenReader();
  const seen = deps?.seen ?? OFF_SEEN;
  const snap = useMeetSeen(seen);
  const [switchOn, setSwitchOn] = useState<boolean | null>(deps ? null : false);
  const [state, setState] = useState<State>(deps ? { kind: 'wait' } : { kind: 'none', mark: false });
  const [late, setLate] = useState(false);

  useEffect(() => {
    if (!deps) return undefined;
    let alive = true;
    deps
      .switchOn()
      .then((v) => alive && setSwitchOn(v))
      .catch(() => alive && setSwitchOn(false));
    return () => {
      alive = false;
    };
  }, [deps]);

  // 판단: 기다리는 동안만 셈하고, 정해지면 그 값을 굳힌다(그린 중에 상태를 맞추는 React 방식 — 효과 안 setState 0)
  if (deps && state.kind === 'wait') {
    const d = decideMeet({ switchOn, seen: snap.ready ? snap.ids.includes(id) : null, load, room, messages, now: now() });
    if (d.kind === 'none') setState({ kind: 'none', mark: d.mark });
    else if (d.kind === 'scene') setState({ kind: 'scene', plan: d.plan, mode: meetModeOf(reduce, reader) });
  }

  // 기록은 장면이 시작될 때(P4-22 — 도중에 앱이 꺼져도 다음엔 바로 대화방) · 내 글이 있는 방도 남긴다. 기기 기록(바깥 저장소)에 쓰는 일이라 효과에서
  const markNow = !!deps && (state.kind === 'scene' || (state.kind === 'none' && state.mark));
  useEffect(() => {
    if (markNow && deps) deps.seen.mark(id);
  }, [markNow, deps, id]);

  useEffect(() => {
    if (state.kind !== 'wait') return undefined;
    const timer = setTimeout(() => setLate(true), scene2.meet.waitCover);
    return () => clearTimeout(timer);
  }, [state.kind]);

  const done = useCallback(() => setState({ kind: 'none', mark: false }), []); // 기록은 장면 시작 때 이미 남았다
  return {
    scene: state.kind === 'scene' ? { plan: state.plan, mode: state.mode } : null,
    cover: !!deps && state.kind === 'wait' && !late,
    metAt: deps && switchOn === true && room ? metAtLine(room.openedAt) : null,
    done,
  };
}
