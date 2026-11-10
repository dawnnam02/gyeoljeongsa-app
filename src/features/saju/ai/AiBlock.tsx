// AI 맞춤 한 칸(IF5-F2 ⑩ · 화면 요구 IF-SJ-CARD 'AI 맞춤 추가 상태' · 디자인 SUM-2 · 3 · 카피 24-2 `SAJU.card.ai*` · `SAJU.status.ai*`).
//  결과 한 장 아래에 이어 붙는다: [AI 맞춤 풀이 받기 · 마일리지 N](**숫자는 이 버튼 옆 한 곳**) → (처음이면) CK17D 동의 시트 → (300 이상이면) 확인 시트 → 만드는 중 → 'AI가 쓴 글' + 글.
//  · 잔액이 모자라면 확인 시트를 열지 않고 사실 한 줄(필요 · 지금 가진 수) + [충전하러 가기](IF5-QF F-04)
//  · 동의 → 마일리지 → 사용 순서: 동의하기 전에는 마일리지가 쓰이지 않고 서버도 부르지 않는다. 같은 결과를 다시 열면 저장본 재열람 무료('다시 열어도 마일리지는 들지 않아요') · '다시 뽑기' 0
//  · 검사 탈락 · 끊김은 차감 0('이번엔 글을 만들지 못했어요. 마일리지는 쓰이지 않았어요.') + [다시 시도](같은 요청 번호). 잔액 부족은 사실 한 줄 + [충전하러 가기]. 점검(장부 꺼짐)은 한 줄 · 차감 0
//  · RS2-01 실서버 길(ai-run): 예치 · 확정 · 해제는 서버가 한다(여기서 edge 호출 0). 응답 charge.state 가 settled 일 때만 잔액을 다시 읽는다. 새 코드: 이미 처리됨(409 — 앞 답이 있으면 그대로 두고 조용히) ·
//    오늘 한도(429) · 글이 길다(413) · 서버가 닫음(403 → 점검 한 줄). '마일리지는 쓰이지 않았어요'는 응답이 차감 없음(none)이라고 알릴 때만 쓴다(닿았는지 모르면 쓰지 않는다)
//  · 평문만(마크다운 · 링크 해석 0) · 공유 · 복사 단추 0 · 점수 · 퍼센트 · 숫자 막대 0. 끝줄은 앱 한 곳(SAJU.card.footer)에서만 — 여기서는 붙이지 않는다
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { AI_RUN } from '@/content/aiRunCopy';
import { IF5_TEXT } from '@/content/if5Copy';
import { aiRouteOf, createKeyKeeper, type KeyKeeper } from '@/features/ait/aiCall';
import { ait } from '@/features/ait/aitText';
import { Ck17dSheet } from '@/features/consent/If5ConsentSheets';
import { fmt, costOf } from '@/features/mileage/mileageLogic';
import { MILEAGE_HREF } from '@/features/mileage/MileageScreen';
import { ConfirmSpendSheet, LowBalance } from '@/features/mileage/MileageSheets';
import type { CostInfo } from '@/features/mileage/mileageApi';
import { useMileageState } from '@/features/mileage/useMileage';
import { colors, space } from '@/theme/tokens';

import { COST_FEATURE, newRequestId, runAi, type AiKind } from './aiRun';
import type { AiResultFeature } from './aiResults';
import type { AiServices } from './aiService';

type Phase =
  | { k: 'idle' }
  | { k: 'consent' }
  | { k: 'quoting' }
  | { k: 'confirm'; cost: CostInfo; balance: number }
  | { k: 'running' }
  | { k: 'done'; display: unknown; stored: boolean }
  | { k: 'low'; need: number | null; have: number | null }
  | { k: 'blocked'; noCharge?: boolean }
  | { k: 'failed'; noCharge?: boolean }
  | { k: 'already' }
  | { k: 'daily'; noCharge: boolean }
  | { k: 'tooLong'; noCharge: boolean }
  | { k: 'balanceFailed' }
  | { k: 'maint' };

type Props = {
  id: string;
  kind: Exclude<AiKind, 'chat'>;
  svc: AiServices;
  /** 지금 사실 묶음을 만든다(보낼 수 없으면 null — 그러면 칸을 그리지 않는다) */
  facts: () => Record<string, unknown> | null;
  /** 종합 풀이는 세 사실이 필요하다 */
  fullFacts?: () => { reading: Record<string, unknown>; daewoon: Record<string, unknown> | null; sinyeon: Record<string, unknown> | null } | null;
  /** 저장본 열쇠(내 풀이만 — 상대 값이 든 결과 · 날짜 설명은 저장 0) + 같은 결과인지 가르는 표(예: 올해) */
  store?: { feature: AiResultFeature; tag: string };
  /** 입력 글자 수(날짜 설명 등 길이 가산 대상이 있을 때만) */
  chars?: number;
  /** 버튼 글(기본 SAJU.card.aiButton) — 날짜 설명은 SAJU.pick.ai */
  buttonLabel?: string;
  /** 종합 풀이처럼 기능 이름을 칸 위에 보인다(서버 차감표의 이름 그대로) */
  showLabel?: boolean;
  /** 쓴 뒤 호출 — 홈 잔액을 다시 읽게 */
  onSpent?: () => void;
};

export function AiBlock(p: Props) {
  const router = useRouter();
  const { slot, reload } = useMileageState(p.svc.mileage);
  const [phase, setPhase] = useState<Phase>({ k: 'idle' });
  const reqId = useRef<string | null>(null);
  const keys = useRef<KeyKeeper | null>(null); // 실서버 길의 Idempotency-Key 통(메모리에만) — 한 누름 = 키 하나
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const set = useCallback((ph: Phase): void => {
    if (alive.current) setPhase(ph);
  }, []);

  // 저장본 재열람(무료)
  useEffect(() => {
    if (!p.store) return;
    let live = true;
    void p.svc.results.get(p.store.feature).then((r) => {
      const v = r?.display as { tag?: string; display?: unknown } | undefined;
      if (live && v && v.tag === p.store?.tag && v.display) set({ k: 'done', display: v.display, stored: true });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.store?.feature, p.store?.tag]);

  const state = slot.kind === 'ready' ? slot.state : null;
  const feature = COST_FEATURE[p.kind];
  const baseCost = state ? costOf(state, feature) : null;
  // 종합 풀이 이름은 서버 차감표 글 대신 카피 `SAJU.full.label`(같은 글 · M-F2). 다른 기능 이름은 서버 차감표 label 그대로
  const label = p.kind === 'full' ? IF5_TEXT['SAJU.full.label'] : state?.costs.find((c) => c.feature === feature)?.label ?? '';

  const run = async (): Promise<void> => {
    const code = await p.svc.code();
    const route = p.svc.route ?? aiRouteOf({ code });
    const id = (reqId.current ??= (p.svc.newId ?? newRequestId)());
    keys.current ??= createKeyKeeper();
    const full = p.kind === 'full' ? p.fullFacts?.() : null;
    const facts = p.kind === 'full' ? full?.reading ?? null : p.facts();
    if (!facts) {
      set({ k: 'maint' });
      return;
    }
    set({ k: 'running' });
    const afterSpent = (): void => {
      void reload(); // 쓴 뒤 잔액은 서버에서 다시 읽는다(낙관적 차감 0)
      p.onSpent?.();
    };
    const out = await runAi(
      { edge: p.svc.edge, code: () => code, post: p.svc.post, route, keys: keys.current, env: p.svc.env, onSettled: afterSpent },
      { kind: p.kind, requestId: id, chars: p.chars ?? 0, facts, full: full ?? undefined },
    );
    if (out.kind === 'ok') {
      reqId.current = null;
      if (p.store) await p.svc.results.put(p.store.feature, { tag: p.store.tag, display: out.display });
      set({ k: 'done', display: out.display, stored: false });
    } else if (out.kind === 'low') set({ k: 'low', need: out.need, have: out.have });
    else if (out.kind === 'blocked') set({ k: 'blocked', noCharge: out.noCharge });
    else if (out.kind === 'failed') set({ k: 'failed', noCharge: out.noCharge });
    else if (out.kind === 'daily') set({ k: 'daily', noCharge: out.noCharge });
    else if (out.kind === 'tooLong') set({ k: 'tooLong', noCharge: out.noCharge });
    else if (out.kind === 'already') {
      // 같은 요청은 이미 처리됐다(다시 차감 0) — 앞 답이 저장돼 있으면 그대로 보여 주고, 없으면 한 줄만
      const v = p.store ? ((await p.svc.results.get(p.store.feature))?.display as { tag?: string; display?: unknown } | undefined) : undefined;
      if (p.store && v && v.tag === p.store.tag && v.display) set({ k: 'done', display: v.display, stored: true });
      else set({ k: 'already' });
    } else set({ k: 'maint' });
    if (route !== 'ai-run') afterSpent(); // 데모 장부는 매번 다시 읽는다(지금 그대로). 실서버 길은 settled 일 때만(onSettled)
  };

  const quote = async (): Promise<void> => {
    set({ k: 'quoting' });
    const c = await p.svc.mileage.cost(feature, p.chars ?? 0);
    if (!c.ok) {
      // 실서버 길: 마일리지 스위치가 꺼져 있으면 서버가 차감 없이 돌린다(본인 계정 시험) — 앱이 먼저 막지 않는다. 서버가 닫으면 403 이 와서 점검 한 줄이 된다
      if (c.code === 'feature_off' && (p.svc.route ?? aiRouteOf({ code: await p.svc.code() })) === 'ai-run') {
        await run();
        return;
      }
      set({ k: c.code === 'feature_off' || c.code === 'forbidden' ? 'maint' : 'balanceFailed' });
      return;
    }
    if (!c.data.confirm) {
      await run();
      return;
    }
    const b = await p.svc.mileage.state();
    if (!b.ok) {
      set({ k: 'balanceFailed' });
      return;
    }
    const need = c.data.base + c.data.extra;
    if (b.data.total < need) {
      set({ k: 'low', need, have: b.data.total }); // IF5-QF F-04: 모자라면 확인 시트를 열지 않는다 — '쓰고 나면 0' 같은 틀린 숫자 길 0 · 바로 부족 줄 + [충전하러 가기]
      return;
    }
    set({ k: 'confirm', cost: c.data, balance: b.data.total });
  };

  const start = async (): Promise<void> => {
    if (phase.k === 'running' || phase.k === 'quoting') return; // 연타 0
    await p.svc.consent.load();
    if (!p.svc.consent.get().d) {
      set({ k: 'consent' });
      return;
    }
    await quote();
  };

  const facts = p.kind === 'full' ? (p.fullFacts?.() ? {} : null) : p.facts();
  if (facts === null && phase.k !== 'done') return null; // 보낼 사실이 없으면(예: 대운 칸 없음) 칸 자체가 없다

  return (
    <View style={styles.box} testID={`${p.id}-ai`}>
      {p.showLabel && label ? (
        <AppText variant="bodyBold" accessibilityRole="header" testID={`${p.id}-ai-label`}>
          {label}
        </AppText>
      ) : null}
      {phase.k === 'done' ? (
        <View style={styles.gap} testID={`${p.id}-ai-done`}>
          <AppText variant="captionMedium" tone="accent" testID={`${p.id}-ai-tag`}>
            {IF5_TEXT['SAJU.card.aiTag']}
          </AppText>
          <AiResultView kind={p.kind} display={phase.display} id={`${p.id}-ai-result`} />
          {phase.stored ? (
            <AppText variant="caption" testID={`${p.id}-ai-reopen`}>
              {IF5_TEXT['SAJU.card.reopenFree']}
            </AppText>
          ) : null}
        </View>
      ) : (
        <>
          <Button
            label={p.buttonLabel ?? IF5_TEXT['SAJU.card.aiButton']}
            variant="secondary"
            loading={phase.k === 'running' || phase.k === 'quoting'}
            onPress={() => void start()}
            testID={`${p.id}-ai-btn`}
          />
          {baseCost !== null ? (
            <AppText variant="caption" testID={`${p.id}-ai-cost`}>
              {`${IF5_TEXT['SAJU.card.costTag']} ${fmt(baseCost)}`}
            </AppText>
          ) : null}
        </>
      )}
      {phase.k === 'running' ? (
        <AppText variant="caption" accessibilityRole="progressbar" testID={`${p.id}-ai-running`}>
          {IF5_TEXT['SAJU.status.aiRunning']}
        </AppText>
      ) : null}
      {phase.k === 'blocked' || phase.k === 'failed' ? (
        <View style={styles.gap}>
          <AppText variant="body" accessibilityRole="alert" testID={`${p.id}-ai-blocked`}>
            {phase.noCharge === false ? IF5_TEXT['SAJU.status.errTitle'] : IF5_TEXT['SAJU.status.aiBlocked']}
          </AppText>
          <Button label={IF5_TEXT['SAJU.status.retry']} variant="secondary" onPress={() => void run()} testID={`${p.id}-ai-retry`} />
        </View>
      ) : null}
      {phase.k === 'already' ? (
        <AppText variant="body" testID={`${p.id}-ai-already`}>
          {AI_RUN.alreadyDone}
        </AppText>
      ) : null}
      {phase.k === 'daily' ? (
        <View style={styles.gapSmall}>
          <AppText variant="body" accessibilityRole="alert" testID={`${p.id}-ai-daily`}>
            {AI_RUN.dailyLimit}
          </AppText>
          {phase.noCharge ? <AppText variant="caption" testID={`${p.id}-ai-daily-free`}>{AI_RUN.noCharge}</AppText> : null}
        </View>
      ) : null}
      {phase.k === 'tooLong' ? (
        <View style={styles.gapSmall}>
          <AppText variant="body" accessibilityRole="alert" testID={`${p.id}-ai-toolong`}>
            {ait('AIT.code.too_long')}
          </AppText>
          {phase.noCharge ? <AppText variant="caption" testID={`${p.id}-ai-toolong-free`}>{AI_RUN.noCharge}</AppText> : null}
        </View>
      ) : null}
      {phase.k === 'balanceFailed' ? (
        <AppText variant="body" accessibilityRole="alert" testID={`${p.id}-ai-balance-failed`}>
          {IF5_TEXT['SAJU.status.balanceFailed']}
        </AppText>
      ) : null}
      {phase.k === 'maint' ? (
        <AppText variant="body" testID={`${p.id}-ai-maint`}>
          {IF5_TEXT['SAJU.status.maint']}
        </AppText>
      ) : null}
      {phase.k === 'low' ? <LowBalance need={phase.need} have={phase.have} onCharge={() => router.push(MILEAGE_HREF as Href)} testID={`${p.id}-ai-low`} /> : null}

      <Ck17dSheet
        visible={phase.k === 'consent'}
        onClose={() => set({ k: 'idle' })}
        onNo={() => undefined}
        onYes={async () => {
          await p.svc.consent.agreeD();
          await quote();
        }}
        testID={`${p.id}-ck17d`}
      />
      <ConfirmSpendSheet
        visible={phase.k === 'confirm'}
        featureName={label}
        cost={phase.k === 'confirm' ? phase.cost.base + phase.cost.extra : 0}
        balance={phase.k === 'confirm' ? phase.balance : 0}
        onClose={() => set({ k: 'idle' })}
        onGo={() => void run()}
        testID={`${p.id}-ok`}
      />
    </View>
  );
}

// ── 결과 보여 주기(평문) ────────────────────────────────────────────────────
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const s = (v: unknown): string => (typeof v === 'string' ? v : '');
const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);

function Para({ text, bold, id }: { text: string; bold?: boolean; id?: string }) {
  return text ? (
    <AppText variant={bold ? 'bodyBold' : 'body'} testID={id}>
      {text}
    </AppText>
  ) : null;
}

export function AiResultView({ kind, display, id }: { kind: AiKind; display: unknown; id: string }) {
  if (!isRec(display)) return null;
  if (kind === 'full') {
    return (
      <View style={styles.gap} testID={id}>
        {(['reading', 'daewoon', 'sinyeon'] as const).map((k) => (isRec(display[k]) ? <AiResultView key={k} kind={k} display={display[k]} id={`${id}-${k}`} /> : null))}
      </View>
    );
  }
  const d = display;
  return (
    <View style={styles.gap} testID={id}>
      {kind === 'reading' || kind === 'compat' || kind === 'sinyeon' ? <Para text={s(d.headline)} bold /> : null}
      {kind === 'compat' ? <Para text={s(d.summary)} /> : null}
      {kind === 'daewoon' ? <Para text={s(d.overview)} /> : null}
      {kind === 'sinyeon' ? <Para text={s(d.flow)} /> : null}
      {kind === 'taekil' ? <Para text={s(d.intro)} /> : null}
      {list(d.sections).map((x, i) => (
        <View key={`s${i}`} style={styles.gapSmall}>
          <Para text={s(x.title)} bold />
          <Para text={s(x.body)} />
        </View>
      ))}
      {list(d.periods).map((x, i) => (
        <View key={`p${i}`} style={styles.gapSmall}>
          <Para text={[s(x.ages), s(x.theme)].filter(Boolean).join(' · ')} bold />
          <Para text={s(x.body)} />
        </View>
      ))}
      {list(d.months).map((x, i) => (
        <Para key={`m${i}`} text={`${s(x.month)} · ${s(x.body)}`} />
      ))}
      {list(d.picks).map((x, i) => (
        <Para key={`k${i}`} text={`${s(x.date)} · ${s(x.why)}`} />
      ))}
      {Array.isArray(d.tips) ? d.tips.map((t, i) => <Para key={`t${i}`} text={s(t)} />) : null}
      {kind === 'daewoon' ? <Para text={s(d.now)} /> : null}
      {kind === 'taekil' ? <Para text={s(d.rest)} /> : null}
      {kind === 'reading' ? <Para text={s(d.closing)} /> : null}
      {kind === 'sinyeon' ? <Para text={s(d.keep)} /> : null}
      {kind === 'taekil' ? <Para text={s(d.tip)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.s8, paddingTop: space.s8, borderTopWidth: 1, borderTopColor: colors.line },
  gap: { gap: space.s12 },
  gapSmall: { gap: space.s4 },
});
