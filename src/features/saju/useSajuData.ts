// 사주 마당이 서버에서 받는 값 묶음(IF5-F1 ②): 동의(CK17A) 한 번 + 내 네 기둥 · 올해 운 · 오늘(이번 달) 셋.
//  · 열 때 계산 한 번(서버 즉석 · 응답 no-store) — 시각 · 곳은 기기 값을 요청 인자로만 싣는다. 앱 자동 재시도 0(실패하면 사용자가 [다시 시도]를 눌러야 다시 부른다 — IFF5-06)
//  · 값은 이 화면의 메모리뿐(저장 0). 입력이 바뀌면 다시 받는다. 불러오는 중 · 쉬는 상태는 '이번 요청의 답이 아직 없음'으로 끌어낸다(효과 안에서 상태를 먼저 바꾸지 않는다)
import { useCallback, useEffect, useState } from 'react';

import type { Ck17State } from '@/features/inflight/inflightService';

import { requestInputOf, type DeviceInput } from './deviceInput';
import type { MyChart, MyDay, MyLuck, SajuFailCode, SajuResult } from './sajuApi';
import { nowIso } from './sajuLogic';
import type { SajuDeps } from './sajuService';

export type Slot<T> = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; data: T } | { kind: 'fail'; code: SajuFailCode };
const IDLE = { kind: 'idle' } as const;
const LOADING = { kind: 'loading' } as const;

export type Ck17Slot = { kind: 'loading' } | { kind: 'on' } | { kind: 'off' } | { kind: 'fail' };
export function useCk17(deps: Pick<SajuDeps, 'ck17'>): { slot: Ck17Slot; reload: () => void } {
  const [res, setRes] = useState<{ tries: number; slot: Ck17Slot }>({ tries: -1, slot: { kind: 'loading' } });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let alive = true;
    void deps.ck17.load().then((r) => {
      if (!alive) return;
      setRes({ tries, slot: r.ok ? ((r.data as Ck17State).a ? { kind: 'on' } : { kind: 'off' }) : { kind: 'fail' } });
    });
    return () => {
      alive = false;
    };
  }, [deps.ck17, tries]);
  return { slot: res.tries === tries ? res.slot : { kind: 'loading' }, reload: useCallback(() => setTries((n) => n + 1), []) };
}

const toSlot = <T,>(r: SajuResult<T>): Slot<T> => (r.ok ? { kind: 'ready', data: r.data } : { kind: 'fail', code: r.code });

type Done = { runKey: string; chart?: Slot<MyChart>; luck?: Slot<MyLuck>; day?: Slot<MyDay> };

export function useSajuData(deps: Pick<SajuDeps, 'api' | 'now'>, input: DeviceInput, enabled: boolean): { chart: Slot<MyChart>; luck: Slot<MyLuck>; day: Slot<MyDay>; reload: () => void } {
  const [done, setDone] = useState<Done>({ runKey: '' });
  const [tries, setTries] = useState(0);
  const req = requestInputOf(input);
  const runKey = `${req.hour}|${req.minute}|${req.place}|${tries}`;
  const nowFn = deps.now ?? Date.now;
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const today = nowIso(nowFn());
    const year = Number(today.slice(0, 4));
    // 달력 해를 그대로 보낸다 — 서버가 p_year 기준 월운 12개를 준다
    const put = (patch: Partial<Done>) => alive && setDone((d) => ({ ...(d.runKey === runKey ? d : { runKey }), ...patch }));
    void deps.api.chart(req).then((r) => put({ chart: toSlot(r) }));
    void deps.api.luck(req, year).then((r) => put({ luck: toSlot(r) }));
    void deps.api.day(req, today).then((r) => put({ day: toSlot(r) }));
    return () => {
      alive = false;
    };
    // req 는 runKey 로 비교한다(시각 · 곳이 바뀌거나 [다시 시도]를 누를 때만 다시 받는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, runKey, deps.api]);
  const pick = <T,>(v: Slot<T> | undefined): Slot<T> => (!enabled ? IDLE : done.runKey === runKey && v ? v : LOADING);
  return { chart: pick(done.chart), luck: pick(done.luck), day: pick(done.day), reload: useCallback(() => setTries((n) => n + 1), []) };
}
