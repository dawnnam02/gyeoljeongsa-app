// 단발 AI 기능(궁합 카드 · 문장 다듬기 · 별자리 풀이) 한 번 부르기의 상태 흐름(AIT-F ⑤ ⑥).
//  코드 없음 → 서버 요청 0(nocode) → 시험자 동의(없으면) → 부르는 중 → 답 / 고정 카드 / 오류.
//  · 코드가 없으면 네트워크 호출 0(ATF-06) · 동의 전에는 호출 0
//  · 오류는 code 만 본다. auth · spend_limit · limit 은 다시 시도 0, rate 는 잠깐 잠김(남은 시간 글 0)
import { useCallback, useEffect, useRef, useState } from 'react';

import { aitStore, hasConsent } from './aitStore';
import { postAit } from './aitClient';
import type { AitCard, AitFeature } from './aitTypes';
import { isErrorCode, type AitErrorCode } from './AitParts';

export type AitPhase<T> =
  | { k: 'idle' }
  | { k: 'nocode' }
  | { k: 'consent' }
  | { k: 'loading' }
  | { k: 'ok'; data: T }
  | { k: 'card'; card: AitCard }
  | { k: 'error'; code: AitErrorCode; lockMs: number };

const RATE_LOCK_MIN = 3_000;
const RATE_LOCK_MAX = 60_000;

export function useAitRun<T>(feature: AitFeature, parse: (display: unknown) => T | null) {
  const [phase, setPhase] = useState<AitPhase<T>>({ k: 'idle' });
  const [locked, setLocked] = useState(false);
  const pending = useRef<Record<string, unknown> | null>(null);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current); // 닫으면 잠금 타이머도 거둔다
    };
  }, []);

  const fail = useCallback((code: AitErrorCode, retryAfterSec: number | null) => {
    const lockMs = code === 'rate' ? Math.min(RATE_LOCK_MAX, Math.max(RATE_LOCK_MIN, (retryAfterSec ?? 30) * 1000)) : 0;
    setPhase({ k: 'error', code, lockMs });
    if (lockMs > 0) {
      setLocked(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => alive.current && setLocked(false), lockMs);
    } else setLocked(false);
  }, []);

  const execute = useCallback(
    async (body: Record<string, unknown>) => {
      const code = aitStore.get().code;
      if (!code) return setPhase({ k: 'nocode' }); // 코드 없음 → 서버 요청 0
      setPhase({ k: 'loading' });
      const res = await postAit(feature, body, code);
      if (!alive.current) return;
      if (res.kind === 'offline') return fail('unavailable', null);
      const r = res.reply;
      if (r.code === 'ok') {
        const data = parse(r.display);
        return data ? setPhase({ k: 'ok', data }) : fail('bad_request', null);
      }
      if ((r.code === 'crisis' || r.code === 'refused_intent') && r.card) return setPhase({ k: 'card', card: r.card });
      return fail(isErrorCode(r.code) ? r.code : 'unavailable', r.retryAfterSec);
    },
    [feature, parse, fail],
  );

  const run = useCallback(
    async (body: Record<string, unknown>) => {
      await aitStore.load();
      if (!aitStore.get().code) return setPhase({ k: 'nocode' });
      if (!hasConsent(aitStore.get())) {
        pending.current = body;
        return setPhase({ k: 'consent' });
      }
      await execute(body);
    },
    [execute],
  );

  const confirmConsent = useCallback(async () => {
    await aitStore.setConsent();
    const body = pending.current;
    pending.current = null;
    if (body) await execute(body);
    else setPhase({ k: 'idle' });
  }, [execute]);

  const cancelConsent = useCallback(() => {
    pending.current = null;
    setPhase({ k: 'idle' });
  }, []);

  const reset = useCallback(() => {
    pending.current = null;
    setPhase({ k: 'idle' });
  }, []);

  return { phase, locked, run, confirmConsent, cancelConsent, reset };
}
