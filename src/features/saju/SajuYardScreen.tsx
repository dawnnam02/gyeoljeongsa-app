// IF-MADANG 사주 마당 — 하단 탭의 첫 화면(TAB-1 · D-254, 본인 지시 11-10 "운세 메뉴는 아래 하단 버튼으로, 설정 옆으로. 사용자 친화적으로").
//  탭 이름은 '사주 마당'(앱 안 글에 '운세 · 타로 · 궁합 · 점' 낱말 0 — 카피 21장). 긴 풀이 화면(SajuMadangScreen)은 /saju-detail 로 옮겼고, 이 화면은 짧은 메뉴다.
//  위에서 아래: 머리(이름 · 재미로 본다는 한 줄 · 마일리지 잔액) → 상태 한 칸(동의 전 / 생일 전 / 준비됨 = 오늘 하루 한 줄) → 메뉴 줄(아이콘 · 이름 · 한 줄 설명 · 서버가 준 마일리지 값)
//   → 맨 아래 읽는 법 · 내 정보 고치기 · 동의 관리.
//  · 꺼진 기능의 줄은 그리지 않는다(스위치 · FORTUNE_TRIM 이 끈 칸 · 이번 주 타로 · 달력 · 날짜 고르기 · 시험판 AI). 스위치 saju_yard 가 꺼지면 탭 칸이 없고 주소로 와도 홈으로(PF-93 · PS-94)
//  · 줄을 누르면 지금 있는 화면으로 간다: 오늘 하루 · 사주 이야기 나누기 · 달력은 그 화면으로, 나머지는 내 사주 자세히(/saju-detail)로 가서 그 구역이 맨 위에 오게 열린다(구역은 앱 안 메모리로 건넨다 — sajuSection).
//    준비가 안 된 분(동의 전 · 생일 전)이 줄을 누르면 막다른 길 없이 상태 칸의 다음 걸음(동의 시트 · 내 정보 시트)이 열린다
//  · 넣지 않는 것: 숫자 배지 · 새 점 · 깜빡임 · 진행 막대 · 점수 · 순위 · 남은 횟수 · '오늘만' 같은 재촉 말. 값(마일리지 수)은 서버가 준 것만 — 코드에 숫자 0
//  · 이 화면에는 내 사주 값이 없다(오늘 하루 한 줄은 오늘 날짜의 바탕만 — 모든 회원 같은 글). 그래서 캡처 막기는 사주 값이 보이는 내 사주 자세히 · 오늘 하루 화면이 그대로 맡는다
import { Redirect, useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { TabHeader } from '@/components/TabHeader';
import { IF5_TEXT } from '@/content/if5Copy';
import { SETTINGS } from '@/content/settingsCopy';
import { Ck17Sheet } from '@/features/inflight/If2Sheets';
import { tx } from '@/features/inflight/if2Text';
import type { MileageState } from '@/features/mileage/mileageApi';
import { costOf, fmt } from '@/features/mileage/mileageLogic';
import { MILEAGE_HREF } from '@/features/mileage/MileageScreen';
import { openSettingsPage } from '@/features/settings/settingsIntent';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { colors, radius, size, space } from '@/theme/tokens';

import { inputStore, useInputStore, type InputStore } from './deviceInput';
import { If5Icon } from './If5Icon';
import { SAJU_DETAIL_HREF, useSajuDeps } from './SajuMadangScreen';
import { SajuInputSheet } from './SajuInputSheet';
import { ErrorBlock, LoadingBlock, sajuStyles } from './SajuParts';
import { nowIso, todayBaseLine } from './sajuLogic';
import { clearSajuSection, handOffSajuSection } from './sajuSection';
import type { SajuDeps } from './sajuService';
import { costLine, yardRows, yardState, type YardRow } from './sajuYardLogic';
import { YARD } from './sajuYardCopy';
import { useCk17 } from './useSajuData';

// 시험은 deps 를 직접 넣는다. mileage = 서버가 준 마일리지 상태(잔액 · 차감표) 한 번 읽기 — 없거나 null 이면 잔액 · 값 글 0
export type YardDeps = SajuDeps & { mileage?: () => Promise<MileageState | null> };

async function defaultMileage(): Promise<MileageState | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mileageServices } = require('@/features/mileage/mileageService') as typeof import('@/features/mileage/mileageService');
    const r = await mileageServices().api.state();
    return r.ok ? r.data : null;
  } catch {
    return null;
  }
}

export function SajuYardScreen({ deps: injected, store }: { deps?: YardDeps; store?: InputStore }) {
  return injected ? <Yard deps={injected} store={store} /> : <YardWithDefaults />;
}

function YardWithDefaults() {
  const base = useSajuDeps();
  const { flags } = useFeatureFlags();
  const deps = useMemo<YardDeps>(() => ({ ...base, mileage: defaultMileage }), [base]);
  if (flags.loaded && !base.isOn('saju_yard')) return <Redirect href={'/boarding' as Href} />; // 스위치 꺼짐: 주소로 와도 홈으로(PF-93 · PS-94)
  return <Yard deps={deps} />;
}

// 마일리지 상태: 이 탭에 돌아올 때마다 한 번 읽는다(서버 값 그대로 · 저장 0). 스위치 mileage 가 꺼져 있으면 읽지 않는다
function useYardMileage(load: YardDeps['mileage'], enabled: boolean): MileageState | null {
  const [state, setState] = useState<MileageState | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !load) return undefined;
      let live = true;
      void load().then((s) => live && setState(s));
      return () => {
        live = false;
      };
    }, [enabled, load]),
  );
  return enabled ? state : null;
}

function Yard({ deps, store: injectedStore }: { deps: YardDeps; store?: InputStore }) {
  const router = useRouter();
  const store = injectedStore ?? inputStore();
  const input = useInputStore(store);
  const [loaded, setLoaded] = useState(store.ready());
  useEffect(() => {
    let alive = true;
    void store.load().then(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [store]);
  const ck = useCk17(deps);
  const [sheet, setSheet] = useState<'none' | 'in' | 'ck17'>('none');
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const on = deps.isOn;
  const state = yardState(ck.slot.kind, loaded, input.answered);
  // 준비됨 + 오늘 하루 스위치 켜짐: 상태 칸(오늘 하루 한 줄)이 '오늘 하루'로 가는 문이다 → 메뉴에서는 그 줄을 그리지 않는다(같은 곳으로 가는 두 칸 0, QF2-B8)
  const rows = useMemo(() => yardRows({ isOn: on, aiAvailable: !!deps.ai, todayIsStatus: state === 'ready' }), [on, deps.ai, state]);
  const mileage = useYardMileage(deps.mileage, on('mileage'));
  const nowFn = deps.now ?? Date.now;

  const openIn = () => {
    setSheet('in');
    if (deps.birthDate) void deps.birthDate().then(setBirthDate);
  };
  // 준비가 안 된 분이 줄을 눌렀을 때의 다음 걸음 = 상태 칸의 단추와 같은 길
  const nextStep = () => {
    if (state === 'consent') setSheet('ck17');
    else if (state === 'birth') openIn();
    else if (state === 'error') ck.reload();
  };
  const openDetail = (section: Parameters<typeof handOffSajuSection>[0]) => {
    clearSajuSection();
    handOffSajuSection(section);
    router.push(SAJU_DETAIL_HREF as Href);
  };
  const go = (row: YardRow) => {
    if (state !== 'ready') {
      nextStep();
      return;
    }
    if (row.to.kind === 'detail') openDetail(row.to.section);
    else router.push(row.to.href);
  };

  const status = (): ReactNode => {
    switch (state) {
      case 'loading':
        return <LoadingBlock id="saju-yard-loading" />;
      case 'error':
        return <ErrorBlock id="saju-yard-error" onRetry={ck.reload} />;
      case 'consent':
        return (
          <View style={styles.card} testID="saju-yard-status-consent">
            <AppText variant="body">{tx('FUN.ck17.offBody')}</AppText>
            <Button label={tx('FUN.ck17.agreeView')} variant="secondary" onPress={() => setSheet('ck17')} testID="saju-yard-agree" />
          </View>
        );
      case 'birth':
        return (
          <View style={styles.card} testID="saju-yard-status-birth">
            <AppText variant="body">{IF5_TEXT['SAJU.madang.empty']}</AppText>
            <Button label={IF5_TEXT['SAJU.madang.fillIn']} variant="secondary" onPress={openIn} testID="saju-yard-fill" />
          </View>
        );
      case 'ready':
        // 준비됨: 오늘 하루 한 줄(스위치 saju_today) — 오늘 날짜의 바탕만(내 정보 0 · 서버 호출 0). 꺼져 있으면 칸 자체가 없다
        return on('saju_today') ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${IF5_TEXT['SAJU.today.title']}. ${todayBaseLine(nowIso(nowFn()))}`}
            accessibilityHint={SETTINGS.rowA11yHint}
            onPress={() => router.push('/saju-today' as Href)}
            effect="none"
            style={[styles.card, styles.statusDoor]}
            testID="saju-yard-status-today">
            <View style={styles.rowText}>
              <AppText variant="captionMedium" tone="sub">
                {IF5_TEXT['SAJU.today.title']}
              </AppText>
              <AppText variant="body" testID="saju-yard-today-line">
                {todayBaseLine(nowIso(nowFn()))}
              </AppText>
            </View>
            <Icon name="chevron" size={20} color={colors.sub} testID="saju-yard-status-today-chevron" />
          </Pressable>
        ) : null;
    }
  };

  const balance = mileage ? YARD.balance(fmt(mileage.total)) : null;
  const bottom: { key: string; label: string; icon: 'document' | 'profile' | 'consent'; onPress: () => void }[] = [
    ...(on('read_guide') ? [{ key: 'guide', label: IF5_TEXT['SAJU.guide.title'], icon: 'document' as const, onPress: () => openDetail('guide') }] : []),
    ...(state === 'ready' ? [{ key: 'edit', label: YARD.bottom.edit, icon: 'profile' as const, onPress: openIn }] : []),
    { key: 'consent', label: SETTINGS.rows.consents, icon: 'consent' as const, onPress: () => openSettingsPage(router, 'consent-management') },
  ];

  return (
    <Screen edges={['top']} enter="tab" testID="screen-saju-yard">
      <TabHeader title={IF5_TEXT['SAJU.madang.title']} testID="saju-yard-header" />
      <ScrollView contentContainerStyle={styles.body} testID="saju-yard-scroll">
        <View style={sajuStyles.row}>
          <AppText variant="caption" tone="text" style={sajuStyles.flex} testID="saju-yard-fun">
            {IF5_TEXT['SAJU.card.fun']}
          </AppText>
          {balance ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={balance}
              accessibilityHint={SETTINGS.rowA11yHint}
              onPress={() => router.push(MILEAGE_HREF as Href)}
              effect="none"
              style={styles.balance}
              testID="saju-yard-balance">
              <AppText variant="captionMedium" tone="accent" testID="saju-yard-balance-text">
                {balance}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {status()}

        {rows.length > 0 ? (
          <View style={styles.group} testID="saju-yard-rows">
            {rows.map((row, i) => {
              const cost = row.costFeature && row.costKind && mileage ? costLine(row.costKind, costOf(mileage, row.costFeature), fmt) : null;
              return (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={[row.name, row.line, cost].filter(Boolean).join('. ')}
                  accessibilityHint={SETTINGS.rowA11yHint}
                  onPress={() => go(row)}
                  effect="none"
                  style={({ pressed }) => [styles.row, i < rows.length - 1 && styles.divider, pressed && styles.pressed]}
                  testID={`saju-yard-row-${row.key}`}>
                  <If5Icon name={row.icon} size={24} color={colors.text} />
                  <View style={styles.rowText}>
                    <AppText variant="bodyMedium">{row.name}</AppText>
                    <AppText variant="caption" testID={`saju-yard-row-${row.key}-line`}>
                      {row.line}
                    </AppText>
                    {cost ? (
                      <AppText variant="caption" tone="sub" testID={`saju-yard-row-${row.key}-cost`}>
                        {cost}
                      </AppText>
                    ) : null}
                  </View>
                  <Icon name="chevron" size={20} color={colors.sub} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.group} testID="saju-yard-bottom">
          {bottom.map((b, i) => (
            <Pressable
              key={b.key}
              accessibilityRole="button"
              accessibilityLabel={b.label}
              accessibilityHint={SETTINGS.rowA11yHint}
              onPress={b.onPress}
              effect="none"
              style={({ pressed }) => [styles.row, i < bottom.length - 1 && styles.divider, pressed && styles.pressed]}
              testID={`saju-yard-link-${b.key}`}>
              <Icon name={b.icon} size={24} color={colors.text} />
              <AppText variant="body" style={sajuStyles.flex}>
                {b.label}
              </AppText>
              <Icon name="chevron" size={20} color={colors.sub} />
            </Pressable>
          ))}
        </View>

        <AppText variant="caption" testID="saju-yard-not-used">
          {IF5_TEXT['SAJU.madang.notUsed']}
        </AppText>
      </ScrollView>

      <SajuInputSheet visible={sheet === 'in'} store={store} current={input} birthDate={birthDate} onClose={() => setSheet('none')} onSaved={() => setSheet('none')} />
      <Ck17Sheet
        visible={sheet === 'ck17'}
        onClose={() => setSheet('none')}
        onSave={async (a, b) => {
          const r = await deps.ck17.record(a, b, 'feature_sheet');
          if (r.ok) {
            setSheet('none');
            ck.reload();
          }
          return r.ok;
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, paddingBottom: space.s40, gap: space.s16 },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8 },
  statusDoor: { flexDirection: 'row', alignItems: 'center', gap: space.s12 }, // 상태 칸 오른쪽 chevron — 메뉴 줄과 같은 모양으로 누를 수 있는 칸임이 보이게
  group: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s12 },
  rowText: { flex: 1, gap: space.s4 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { backgroundColor: colors.accentSoft },
  balance: { minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s12 },
});
