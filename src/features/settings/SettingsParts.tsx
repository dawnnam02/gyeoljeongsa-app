// 12 설정 화면 조각(Figma 12 3:473 · 12b~12q): 줄 묶음 카드 · 이동 줄(›) · 스위치 줄 · 하위 화면 틀 · 불러오기/오류/빈 상태 · 윤곽 버튼.
// 누르는 것은 모두 공통 Pressable. 색 · 글자 · 간격은 토큰만. 줄 글은 flex 로 줄어들어 360 폭에서도 가로로 넘치지 않는다(긴 글은 줄바꿈).
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OfflineArt, StateArt } from '@/components/StateArt';
import { Toggle } from '@/components/Toggle';
import { COMMON } from '@/content/copy';
import { SETTINGS } from '@/content/settingsCopy';
import { dist, haptic, Rise, scene, SkeletonLines, WaitState } from '@/motion';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

// 줄 묶음 카드(card 면 · 둥글기 16 · 줄 사이 line 1)
export function RowGroup({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View style={styles.group} testID={testID}>
      {children}
    </View>
  );
}

export function GroupLabel({ text, testID }: { text: string; testID?: string }) {
  return (
    <AppText variant="caption" style={styles.groupLabel} testID={testID}>
      {text}
    </AppText>
  );
}

// 이동 줄: 왼쪽 이름 · 오른쪽 보조 글(예: "준비 중") 또는 ›(D42-C 1안 chevron 20 · sub)
const CHEVRON = 20;
export function NavRow({ label, right, last = false, onPress, testID }: { label: string; right?: string; last?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      accessibilityLabel={right ? `${label}, ${right}` : label}
      accessibilityHint={right ? undefined : SETTINGS.rowA11yHint}
      onPress={onPress}
      effect="none"
      testID={testID}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}>
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      {right ? <AppText variant="caption">{right}</AppText> : <Icon name="chevron" size={CHEVRON} color={colors.sub} testID={testID ? `${testID}-chevron` : undefined} />}
    </Pressable>
  );
}

// 스위치 줄(08 ToggleRow 와 같은 모양 · 같은 눌림): 줄 전체가 터치 영역, 이름 아래 작은 글(선택)
export function SwitchRow({ label, note, on, last = false, disabled = false, onPress, testID }: { label: string; note?: string; on: boolean; last?: boolean; disabled?: boolean; onPress: () => void; testID?: string }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      accessibilityValue={{ text: on ? SETTINGS.switchOn : SETTINGS.switchOff }}
      aria-checked={on}
      aria-disabled={disabled}
      disabled={disabled}
      offLook="own" // QP-16: 잠긴 줄도 글은 그대로 읽히게(대비 4.5 이상) — 흐림은 스위치에만
      onPress={() => {
        haptic.selection(); // 스위치를 바꿈(D25 10-5 새 자리)
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      effect="none"
      testID={testID}
      style={[styles.row, !last && styles.divider]}>
      <View style={styles.flex}>
        <AppText variant="body">{label}</AppText>
        {note ? <AppText variant="caption">{note}</AppText> : null}
      </View>
      <View style={disabled ? styles.offToggle : null}>
        <Toggle on={on} pressed={pressed && !disabled} testID={testID ? `${testID}-toggle` : undefined} />
      </View>
    </Pressable>
  );
}

// 하위 화면 틀: ‹ 상단 바 + 세로 스크롤. Android 뒤로가기도 ‹ 와 같다(12 로 돌아옴)
export function SubPage({ title, onBack, children, testID }: { title: string; onBack: () => void; children: ReactNode; testID?: string }) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  return (
    <Rise axis="x" distance={dist.m} duration={scene.list.dur} style={styles.page} testID={testID}>
      <ScreenHeader title={title} onBack={onBack} testID={testID ? `${testID}-header` : undefined} />
      <ScrollView contentContainerStyle={styles.pageBody}>{children}</ScrollView>
    </Rise>
  );
}

// 불러오는 중 · 읽기 실패(+ 다시 시도) · 빈 상태
export function LoadState({ state, empty, art, onRetry, testID }: { state: 'loading' | 'network' | 'server' | 'empty'; empty?: string; art?: ImageSourcePropType; onRetry: () => void; testID?: string }) {
  if (state === 'loading') {
    return (
      <View style={styles.wait} accessible accessibilityLabel={COMMON.loading} accessibilityLiveRegion="polite" testID={testID ? `${testID}-loading` : undefined}>
        <WaitState waiting skeleton={<SkeletonLines />} note={<AppText variant="caption">{COMMON.loading}</AppText>} />
      </View>
    );
  }
  if (state === 'empty') {
    return (
      <View style={styles.center} testID={testID ? `${testID}-empty` : undefined}>
        {art ? <StateArt source={art} testID={testID ? `${testID}-empty-art` : undefined} /> : null}
        <AppText variant="body" tone="sub">
          {empty}
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.center} testID={testID ? `${testID}-error` : undefined}>
      <OfflineArt show={state === 'network'} />
      <AppText variant="body" tone="text" accessibilityRole="alert" style={styles.centerText}>
        {state === 'network' ? COMMON.offline : COMMON.server}
      </AppText>
      <Button label={COMMON.retry} variant="secondary" inline onPress={onRetry} testID={testID ? `${testID}-retry` : undefined} />
    </View>
  );
}

// 윤곽 버튼(Figma 12b 로그아웃 · 12l 차단 해제): bg 면 + accent 1px 선 + accent 글자. 작은 것은 높이 32(터치 44)
export function OutlineButton({ label, small = false, busy = false, accessibilityLabel, onPress, testID }: { label: string; small?: boolean; busy?: boolean; accessibilityLabel?: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      accessibilityLabel={busy ? COMMON.loading : (accessibilityLabel ?? label)}
      aria-busy={busy}
      disabled={busy}
      onPress={onPress}
      effect="both"
      testID={testID}
      style={small ? styles.smallTouch : undefined}>
      <View style={[styles.outline, small ? styles.outlineSmall : styles.outlineLarge]}>
        {busy ? <ActivityIndicator color={colors.accent} /> : <AppText variant={small ? 'captionMedium' : 'bodyMedium'} tone="accent">{label}</AppText>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  groupLabel: { paddingHorizontal: space.s4 },
  row: { minHeight: size.listRow, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s8 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { backgroundColor: colors.line },
  flex: { flex: 1, flexShrink: 1 },
  offToggle: { opacity: alpha.disabled }, // QP-16: 잠긴 스위치만 흐리게
  page: { flex: 1 }, // 바탕은 화면 감싸개(Screen)의 bgGrad 가 보이게 투명(F17)
  pageBody: { paddingHorizontal: size.screenPadding, paddingTop: space.s8, paddingBottom: space.s32, gap: space.s16 },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingVertical: space.s40 },
  wait: { minHeight: (size.listRow + space.s4) * 3, alignSelf: 'stretch' }, // 대기 단계표(F21): 줄 뼈대 3개 자리
  centerText: { textAlign: 'center' },
  smallTouch: { minHeight: size.touchMin, justifyContent: 'center' },
  outline: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.bg, borderRadius: radius.md },
  outlineLarge: { minHeight: size.button, paddingHorizontal: space.s16 },
  outlineSmall: { minHeight: size.buttonSmall, paddingHorizontal: space.s12, borderRadius: radius.sm },
});
