// 06 AI 정리 중의 동작(상태 확인 · 다시 시도 · 직접 입력). 화면(AnalysisScreen)은 이 훅이 주는 값만 그린다.
//  · 처음: 가장 최근 AI 건을 읽는다 → 끝났으면 07, 실패면 오류 상태, 처리 중이면 3초 간격으로 계속 읽는다
//  · 건이 하나도 없으면 정리를 시작한다(05 가 이미 시작했어야 하지만, 앱을 다시 열어 건이 없는 경우의 안전장치)
//  · 60초가 넘으면 안내, 120초 안에 결과가 없으면 실패로 보고 오류 상태(서버는 105초 안에 끝낸다)
//  · [다시 시도]: 3초 동안은 다시 눌러도 요청이 늘지 않는다. 서버는 처리가 끝나야 응답하므로 응답을 기다리지 않고 계속 읽는다
import { useCallback, useEffect, useRef, useState } from 'react';

import { failureFromRetryCount, type AiApi } from '@/lib/aiApi';
import type { AiRow, FailureInfo } from '@/types/ai';

import { currentStep, GIVE_UP_AFTER_MS, isGiveUp, isSlow, POLL_INTERVAL_MS, progressRatio, RETRY_LOCK_MS } from './analysisLogic';
import { manualOfferStore } from './manualOffer';

export type AnalysisDeps = {
  api: Pick<AiApi, 'loadLatest' | 'start' | 'retry'>;
  now?: () => number;
  setStage: (stage: 'ai-processing' | 'ai-failed' | 'traits-pending') => void;
};

export type AnalysisPhase = 'loading' | 'processing' | 'failed';
export type AnalysisDest = 'traits' | 'traits-manual' | 'consent' | null;

export function useAnalysis(deps: AnalysisDeps, onNavigate: (dest: Exclude<AnalysisDest, null>) => void) {
  const { api, setStage } = deps;
  const now = deps.now ?? Date.now;
  const [phase, setPhase] = useState<AnalysisPhase>('loading');
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState<FailureInfo | null>(null);
  const [offline, setOffline] = useState(false);
  const [problem, setProblem] = useState<'network' | 'server' | null>(null); // 다시 시도 응답이 실패한 이유
  const [retryBusy, setRetryBusy] = useState(false);

  const rowRef = useRef<AiRow | null>(null);
  const startedAt = useRef(now());
  const phaseRef = useRef<AnalysisPhase>('loading');
  const alive = useRef(true);
  const navigated = useRef(false);
  const retryLockedUntil = useRef(0);

  const changePhase = useCallback((next: AnalysisPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const go = useCallback(
    (dest: Exclude<AnalysisDest, null>) => {
      if (navigated.current) return;
      navigated.current = true;
      onNavigate(dest);
    },
    [onNavigate],
  );

  const toFailed = useCallback(
    (info: FailureInfo) => {
      setFailure((prev) => (prev && prev.stage === info.stage && prev.manual && !info.manual ? prev : info)); // 응답에서 받은 직접 입력 재료를 읽기로 덮어쓰지 않는다
      setStage('ai-failed');
      changePhase('failed');
    },
    [changePhase, setStage],
  );

  const toProcessing = useCallback(() => {
    startedAt.current = now();
    setElapsed(0);
    setProblem(null);
    setStage('ai-processing');
    changePhase('processing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changePhase, setStage]);

  // 서버가 알려 준 한 줄로 화면을 맞춘다
  const apply = useCallback(
    (row: AiRow) => {
      rowRef.current = row;
      if (row.status === 'ok') {
        setStage('traits-pending');
        go('traits');
      } else if (row.status === 'failed') {
        if (now() < retryLockedUntil.current) return; // 다시 시도를 막 눌렀다: 서버가 처리 중으로 바꾸기 전의 옛 상태는 무시한다
        toFailed(failureFromRetryCount(row.retryCount));
      } else if (phaseRef.current !== 'processing') {
        toProcessing();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [go, setStage, toFailed, toProcessing],
  );

  const handleLatest = useCallback(
    (result: Awaited<ReturnType<AnalysisDeps['api']['loadLatest']>>) => {
    if (!alive.current) return;
    if (!result.ok) {
      setOffline(result.reason === 'network'); // 정리는 서버에서 계속된다. 연결이 돌아오면 다시 읽는다
      if (result.reason === 'server' && phaseRef.current === 'loading') {
        setProblem('server');
        toFailed(failureFromRetryCount(0));
      }
      return;
    }
    setOffline(false);
    if (result.row) apply(result.row);
    else if (phaseRef.current === 'loading') {
      // 건이 없다: 정리를 시작한다
      toProcessing();
      void api.start().then((outcome) => {
        if (!alive.current) return;
        if (outcome.kind === 'failed') toFailed(outcome.info);
        else if (outcome.kind === 'consent') go('consent');
        else if (outcome.kind === 'error') setProblem(outcome.reason);
      });
    }
    },
    [api, apply, go, toFailed, toProcessing],
  );
  const refresh = useCallback(() => api.loadLatest().then(handleLatest), [api, handleLatest]);

  // 처음 한 번 읽기
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 처리 중에는 3초마다 상태를 읽고, 1초마다 경과 시간을 갱신한다
  useEffect(() => {
    if (phase !== 'processing') return undefined;
    const poll = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const tick = setInterval(() => {
      const ms = now() - startedAt.current;
      setElapsed(ms);
      if (isGiveUp(ms) && phaseRef.current === 'processing') {
        // 120초 안에 결과가 없으면 실패로 본다. 서버는 120초 지난 처리 중 건을 닫고 이어받는다
        toFailed(failureFromRetryCount(rowRef.current?.retryCount ?? 0));
      }
    }, 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, refresh, toFailed]);

  const retry = useCallback(() => {
    const row = rowRef.current;
    if (!row || now() < retryLockedUntil.current) return;
    retryLockedUntil.current = now() + RETRY_LOCK_MS;
    setRetryBusy(true);
    setTimeout(() => alive.current && setRetryBusy(false), RETRY_LOCK_MS);
    toProcessing();
    void api.retry(row.id).then((outcome) => {
      if (!alive.current) return;
      if (outcome.kind === 'ok') {
        setStage('traits-pending');
        go('traits');
      } else if (outcome.kind === 'failed') {
        manualOfferStore.set(row.id, outcome.info.manual);
        toFailed(outcome.info);
      } else if (outcome.kind === 'limit') {
        toFailed({ stage: 4, retriesLeft: 0, showRetry: false, showManual: true, manual: null });
      } else if (outcome.kind === 'consent') {
        go('consent');
      } else if (outcome.kind === 'error') {
        setProblem(outcome.reason);
        toFailed(failureFromRetryCount(row.retryCount));
      }
    });
  }, [api, go, now, setStage, toFailed, toProcessing]);

  const manual = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    manualOfferStore.set(row.id, failure?.manual ?? null);
    go('traits-manual');
  }, [failure, go]);

  return {
    phase,
    elapsed,
    slow: phase === 'processing' && isSlow(elapsed),
    step: currentStep(elapsed),
    ratio: progressRatio(elapsed),
    failure,
    offline,
    problem,
    retryBusy,
    giveUpAfterMs: GIVE_UP_AFTER_MS,
    retry,
    manual,
  };
}
