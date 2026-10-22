// 하위 화면이 열릴 때 한 번 읽고, [다시 시도]로 다시 읽는다. 화면이 닫힌 뒤 도착한 응답은 버린다.
// read 는 바뀌지 않는 함수여야 한다(부르는 쪽이 useCallback 으로 넘긴다).
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Loaded, SettingsFailure } from '@/lib/settingsApi';

export type LoadPhase = 'loading' | SettingsFailure | 'ready';

export function useLoad<T>(read: () => Promise<Loaded<T>>) {
  const [phase, setPhase] = useState<LoadPhase>('loading');
  const [data, setData] = useState<T | null>(null);
  const alive = useRef(true);

  const apply = useCallback((result: Loaded<T>) => {
    if (!alive.current) return;
    if (result.ok) {
      setData(result.data);
      setPhase('ready');
    } else {
      setPhase(result.reason);
    }
  }, []);

  // 처음 한 번: 응답이 온 뒤에만 상태를 바꾼다
  useEffect(() => {
    alive.current = true;
    void read().then(apply);
    return () => {
      alive.current = false;
    };
  }, [read, apply]);

  // [다시 시도]
  const reload = useCallback(async () => {
    setPhase('loading');
    apply(await read());
  }, [read, apply]);

  return { phase, data, setData, reload, alive };
}
