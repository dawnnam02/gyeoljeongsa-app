// 16-1 내 성향 리포트(무료, 카피 16-M). 이미 확정한 성향을 한 장에 다시 보여 준다. 새로 AI를 부르지 않는다(비용 0).
//  머리 글(NV11 · NV12) → 5축 막대 → 막대 아래 한 줄 → '말로 풀어 보면' + 축마다 해설 한 문장.
//  값은 수정본이 있으면 수정본, 없으면 AI 원본. 구간 이름은 화면에 쓰지 않는다. 순위 · 견줌 · 점수 말 없음.
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { REPORT16 } from '@/content/shopCopy';
import { AXIS_NAMES, AXIS_ORDER } from '@/content/traitsContent';
import { LoadState } from '@/features/settings/SettingsParts';
import { useLoad } from '@/features/settings/useLoad';
import { TraitBar } from '@/features/ai/TraitBar';
import { aiApi } from '@/lib/services';
import type { AiRow, Traits } from '@/types/ai';
import { space } from '@/theme/tokens';

import type { ShopDeps } from './shopTypes';

// 0~33 낮은 쪽 · 34~66 가운데 · 67~100 높은 쪽
export const bandOf = (value: number): 0 | 1 | 2 => (value <= 33 ? 0 : value <= 66 ? 1 : 2);
export const explainOf = (axis: (typeof AXIS_ORDER)[number], value: number): string => REPORT16[axis][bandOf(value)];

// 카피.md 에 없는 글(마케팅 확인 대기): 확정한 성향이 아직 없을 때

type Mine = { traits: Traits; manual: boolean } | null;

export function ReportBody({ deps }: { deps: Pick<ShopDeps, 'ai'> }) {
  const ai = deps.ai ?? aiApi;
  const read = useCallback(async () => {
    const r = await ai.loadLatest();
    if (!r.ok) return r;
    const row: AiRow | null = r.row;
    const view = row && row.status === 'ok' && row.confirmedAt !== null ? (row.edited ?? row.original) : null;
    return { ok: true as const, data: (view ? { traits: view.traits, manual: row?.source === 'manual' } : null) as Mine };
  }, [ai]);
  const { phase, data, reload } = useLoad<Mine>(read);

  if (phase !== 'ready') return <LoadState state={phase === 'loading' ? 'loading' : phase} onRetry={reload} testID="report" />;
  if (!data) return <LoadState state="empty" empty={REPORT16.emptyNote} onRetry={reload} testID="report" />;
  return (
    <View style={styles.page} testID="report-body">
      <AppText variant="bodyBold" testID="report-note">
        {data.manual ? REPORT16.manualNote : REPORT16.aiNote}
      </AppText>
      <Card style={styles.card}>
        {AXIS_ORDER.map((k) => (
          <TraitBar key={k} name={AXIS_NAMES[k]} value={data.traits[k]} testID={`report-bar-${k}`} />
        ))}
        <AppText variant="caption" testID="report-bar-note">
          {REPORT16.barNote}
        </AppText>
      </Card>
      <AppText variant="bodyBold" testID="report-explain-title">
        {REPORT16.explainTitle}
      </AppText>
      <Card style={styles.card}>
        {AXIS_ORDER.map((k) => (
          <View key={k} style={styles.line}>
            <AppText variant="bodyMedium">{AXIS_NAMES[k]}</AppText>
            <AppText variant="body" tone="text" testID={`report-explain-${k}`}>
              {explainOf(k, data.traits[k])}
            </AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.s16 },
  card: { gap: space.s12 },
  line: { gap: space.s4 },
});
