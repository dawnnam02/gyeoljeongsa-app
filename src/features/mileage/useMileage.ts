// 마일리지 잔액 · 내역을 읽는 훅(IF5-F2 ⑨). 열 때 한 번 부른다 — 자동 재시도 0(실패하면 사용자가 [다시 시도]를 눌러야 다시 부른다 — IFF5-06). 값은 이 화면의 메모리뿐(저장 0).
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HistoryItem, MileageApi, MileageFailCode, MileageState } from './mileageApi';
import { mergeHistory } from './mileageLogic';

export type MileageSlot = { kind: 'loading' } | { kind: 'ready'; state: MileageState } | { kind: 'fail'; code: MileageFailCode };

export function useMileageState(api: MileageApi, enabled = true): { slot: MileageSlot; reload: () => Promise<MileageState | null>; retry: () => void } {
  const [slot, setSlot] = useState<MileageSlot>({ kind: 'loading' });
  const [tries, setTries] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    void api.state().then((r) => {
      if (live) setSlot(r.ok ? { kind: 'ready', state: r.data } : { kind: 'fail', code: r.code });
    });
    return () => {
      live = false;
    };
  }, [api, enabled, tries]);
  /** 쓴 뒤 잔액을 서버에서 다시 읽는다(낙관적 차감 0 — 서버 확인 뒤 갱신) */
  const reload = useCallback(async (): Promise<MileageState | null> => {
    const r = await api.state();
    if (alive.current) setSlot(r.ok ? { kind: 'ready', state: r.data } : { kind: 'fail', code: r.code });
    return r.ok ? r.data : null;
  }, [api]);
  /** [다시 시도]: 처음 상태로 돌려 다시 부른다(사용자가 누를 때만) */
  const retry = useCallback(() => {
    setSlot({ kind: 'loading' });
    setTries((n) => n + 1);
  }, []);
  return { slot, reload, retry };
}

export type HistorySlot = { kind: 'loading' } | { kind: 'ready'; items: HistoryItem[]; next: number | null; more: boolean } | { kind: 'fail'; code: MileageFailCode };
export function useMileageHistory(api: MileageApi): { slot: HistorySlot; older: () => void; retry: () => void } {
  const [slot, setSlot] = useState<HistorySlot>({ kind: 'loading' });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    void api.history(null).then((r) => {
      if (live) setSlot(r.ok ? { kind: 'ready', items: r.data.items, next: r.data.next, more: false } : { kind: 'fail', code: r.code });
    });
    return () => {
      live = false;
    };
  }, [api, tries]);
  const older = useCallback(() => {
    if (slot.kind !== 'ready' || slot.next === null || slot.more) return;
    const { items, next } = slot;
    setSlot({ ...slot, more: true }); // 한 번에 한 묶음 — 연타로 두 번 부르지 않게
    void api.history(next).then((r) => {
      setSlot(r.ok ? { kind: 'ready', items: mergeHistory(items, r.data.items), next: r.data.next, more: false } : { kind: 'fail', code: r.code });
    });
  }, [api, slot]);
  const retry = useCallback(() => {
    setSlot({ kind: 'loading' });
    setTries((n) => n + 1);
  }, []);
  return { slot, older, retry };
}
