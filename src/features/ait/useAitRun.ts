// 단발 AI 기능(궁합 카드 · 문장 다듬기 · 별자리 풀이) 한 번 부르기의 상태 흐름(AIT-F ⑤ ⑥).
//  코드 없음 → 서버 요청 0(nocode) → 시험자 동의(없으면) → 부르는 중 → 답 / 고정 카드 / 오류.
//  · 코드가 없으면 네트워크 호출 0(ATF-06) · 동의 전에는 호출 0
//  · 오류는 code 만 본다. auth · spend_limit · limit 은 다시 시도 0, rate 는 잠깐 잠김(남은 시간 글 0)
//  · RS2-01: 호출 길은 aiCall.ts aiRouteOf 가 고른다 — 모의(코드 없는 데모 판)는 지금처럼 nocode, 실서버 판은 ai-run(코드 없이 로그인 토큰 · Idempotency-Key), AI 서버 판은 /api/ai/*.
//    새 코드: low_balance(마일리지 길) · already_done(앞 답이 있으면 그대로 두고 조용히) · daily_limit. charge.state 가 settled 일 때만 onSettled(잔액 다시 읽기)
import { useCallback, useEffect, useRef, useState } from 'react';

import { aiRouteOf, createKeyKeeper, type KeyKeeper } from './aiCall';
import { aitStore, hasConsent } from './aitStore';
import { callAit } from './aitClient';
import { shouldReloadBalance } from './aitCharge';
import type { AitCard, AitFeature } from './aitTypes';
import { isErrorCode, type AitErrorCode } from './AitParts';

export type AitPhase<T> =
  | { k: 'idle' }
  | { k: 'nocode' }
  | { k: 'consent' }
  | { k: 'loading' }
  | { k: 'ok'; data: T }
  | { k: 'card'; card: AitCard }
  | { k: 'error'; code: AitErrorCode; lockMs: number; noCharge?: boolean; need?: number | null; have?: number | null };

const RATE_LOCK_MIN = 3_000;
const RATE_LOCK_MAX = 60_000;

export function useAitRun<T>(feature: AitFeature, parse: (display: unknown) => T | null, opts: { onSettled?: () => void } = {}) {
  const [phase, setPhase] = useState<AitPhase<T>>({ k: 'idle' });
  const [locked, setLocked] = useState(false);
  const pending = useRef<Record<string, unknown> | null>(null);
  const keys = useRef<KeyKeeper | null>(null); // 실서버 길의 Idempotency-Key 통(메모리에만) — 한 번의 누름 = 키 하나
  const lastOk = useRef<T | null>(null); // 앞 답(이미 처리됨이 오면 이걸 그대로 둔다)
  const onSettled = useRef(opts.onSettled);
  useEffect(() => {
    onSettled.current = opts.onSettled;
  });
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current); // 닫으면 잠금 타이머도 거둔다
    };
  }, []);

  const fail = useCallback((code: AitErrorCode, retryAfterSec: number | null, info: { noCharge?: boolean; need?: number | null; have?: number | null } = {}) => {
    const lockMs = code === 'rate' ? Math.min(RATE_LOCK_MAX, Math.max(RATE_LOCK_MIN, (retryAfterSec ?? 30) * 1000)) : 0;
    setPhase({ k: 'error', code, lockMs, ...info });
    if (lockMs > 0) {
      setLocked(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => alive.current && setLocked(false), lockMs);
    } else setLocked(false);
  }, []);

  const execute = useCallback(
    async (body: Record<string, unknown>) => {
      const code = aitStore.get().code;
      const route = aiRouteOf({ code });
      if (route === 'mock') return setPhase({ k: 'nocode' }); // 코드 없는 데모 판 → 서버 요청 0
      setPhase({ k: 'loading' });
      keys.current ??= createKeyKeeper();
      const res = await callAit(feature, body, { route, code, keys: keys.current });
      if (!alive.current) return;
      if (res.kind === 'offline') return fail('unavailable', null, { noCharge: false });
      const r = res.reply;
      if (shouldReloadBalance(r)) onSettled.current?.(); // 확정된 요청만 잔액을 다시 읽는다
      const noCharge = r.charge?.state === 'none';
      if (r.code === 'ok') {
        const data = parse(r.display);
        if (!data) return fail('bad_request', null, { noCharge: false });
        lastOk.current = data;
        return setPhase({ k: 'ok', data });
      }
      if ((r.code === 'crisis' || r.code === 'refused_intent') && r.card) return setPhase({ k: 'card', card: r.card });
      if (r.code === 'low_balance') return fail('low_balance', null, { need: r.charge?.need ?? null, have: r.charge?.have ?? null });
      if (r.code === 'already_done') return lastOk.current !== null ? setPhase({ k: 'ok', data: lastOk.current }) : fail('already_done', null);
      // 실서버 길의 401 은 로그인이 끝난 것 — 접근 코드 안내가 아니라 일반 안내(로그인 화면으로는 화면 가드가 보낸다)
      const shown = route === 'ai-run' && r.code === 'auth' ? 'unavailable' : isErrorCode(r.code) ? r.code : 'unavailable';
      return fail(shown, r.retryAfterSec, { noCharge });
    },
    [feature, parse, fail],
  );

  const run = useCallback(
    async (body: Record<string, unknown>) => {
      await aitStore.load();
      if (aiRouteOf({ code: aitStore.get().code }) === 'mock') return setPhase({ k: 'nocode' });
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
