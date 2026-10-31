// IF-MILE 마일리지(IF5-F2 ⑨ · 화면 요구 IF-MILE · 정책 PS-41 ~ PS-47 · 디자인 MI-1 · MI-2 · 카피 24-10). 새 탭 0 · 상점 탭 0 — 들어오는 길은 사주 마당 머리 [마일리지] · 12 설정 '마일리지' 줄 · 잔액 부족 [충전하러 가기] · 내역 [충전하기]뿐.
//  · 머리 '마일리지' + 잔액(숫자 · 이 화면 한 곳) → 한 줄 설명 → '횟수 제한 없이 쓴 만큼' → 상품 줄(가격 · 수는 서버 응답 — 하드코딩 0) → 소모형 안내 → 현금으로 바꿀 수 없어요 → 충전 전 고지 → [내역 보기]
//  · 큰 충전 한 줄: 카피 `MILEAGE.big.line` 이 말하는 가격(예 33,000원)을 누르면 확인 한 줄 시트(월 합계 상한 0). 그 밖의 상품은 바로 충전
//  · P0 는 기기 안 가상 잔액 — 결제 호출 0(consumeAsync · acknowledgePurchase 0). 충전은 데모 모의 서버의 가상 충전(시험용 한 줄 `MILEAGE.shop.trial`). 서버 지급 응답이 오기 전에는 '지급됨' 글 0 — 응답 뒤 잔액을 다시 읽을 뿐
//  · 보너스 · 할인 · 인기 · 한정 · 서두르세요 · 남은 시간 · 빨간 배지 · 숫자 굴리기 0. 재촉 0 · 푸시 0
import { Redirect, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextButton } from '@/components/TextButton';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { SUPPORT } from '@/content/copy';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { If5Icon } from '@/features/saju/If5Icon';
import { openSettingsPage } from '@/features/settings/settingsIntent';
import { colors, radius, size, space } from '@/theme/tokens';

import type { MileageProduct } from './mileageApi';
import { fmt, splitLine } from './mileageLogic';
import { mileageServices, type MileageDeps } from './mileageService';
import { BigChargeSheet } from './MileageSheets';
import { useMileageState } from './useMileage';

export const MILEAGE_HREF = '/mileage';
export const MILEAGE_LOG_HREF = '/mileage-log';

export function MileageScreen({ deps }: { deps?: MileageDeps }) {
  return deps ? <Shop deps={deps} /> : <ShopWithDefaults />;
}
function ShopWithDefaults() {
  const { flags, isOn } = useFeatureFlags();
  const svc = mileageServices();
  const deps = useMemo(() => ({ ...svc, isOn }), [svc, isOn]);
  if (flags.loaded && !isOn('mileage')) return <Redirect href={'/boarding' as Href} />; // 스위치 꺼짐: 주소로 와도 홈으로(PF-93 · PS-94)
  return <Shop deps={deps} />;
}

/** 카피 `MILEAGE.big.line` 이 말하는 가격이면 큰 충전 — 숫자는 카피 한 줄에서만 읽는다(앱 코드에 가격 0) */
export const isBigCharge = (p: MileageProduct): boolean => IF5_TEXT['MILEAGE.big.line'].startsWith(`${fmt(p.price)}원`);

function Shop({ deps }: { deps: MileageDeps }) {
  const router = useRouter();
  const { slot, reload, retry } = useMileageState(deps.api);
  const [big, setBig] = useState<MileageProduct | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [lockedNow, setLockedNow] = useState(false); // 충전을 눌렀더니 서버가 잠갔다고 답함(charge_locked) — 잔액을 다시 읽을 때까지 이 화면에서만
  const back = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));
  const charge = async (p: MileageProduct) => {
    if (busy) return; // 연타 0
    setBig(null);
    setBusy(p.sku);
    setFailed(false);
    const r = await deps.api.charge(p.sku);
    setBusy(null);
    if (!r.ok && r.code === 'charge_locked') setLockedNow(true); // 까닭 · 기간은 글에 풀지 않는다(M-F2)
    else if (!r.ok) setFailed(true);
    else await reload(); // 서버 응답 뒤 잔액을 다시 읽는다(낙관적 증가 0)
  };
  const canCharge = deps.isOn('mileage_charge');
  const s = slot.kind === 'ready' ? slot.state : null;

  return (
    <Screen edges={['top']} testID="screen-mileage">
      <ScreenHeader title={IF5_TEXT['MILEAGE.shop.title']} onBack={back} testID="mileage-header" />
      <ScrollView contentContainerStyle={styles.body} testID="mileage-scroll">
        {slot.kind === 'loading' ? (
          <View style={styles.card} accessible accessibilityLabel={IF5_TEXT['SAJU.status.loadLab']} testID="mileage-loading">
            <AppText variant="caption">{IF5_TEXT['SAJU.status.loadLab']}</AppText>
            <View style={[styles.skel, styles.skelWide]} />
            <View style={styles.skel} />
          </View>
        ) : null}
        {slot.kind === 'fail' ? (
          <View style={styles.card} testID="mileage-fail">
            <AppText variant="bodyBold" accessibilityRole="alert">
              {IF5_TEXT['SAJU.status.balanceFailed']}
            </AppText>
            {slot.code === 'feature_off' || slot.code === 'forbidden' ? null : <Button label={IF5_TEXT['SAJU.status.retry']} variant="secondary" onPress={retry} testID="mileage-fail-retry" />}
          </View>
        ) : null}
        {s ? (
          <>
            <View style={styles.card} testID="mileage-balance">
              <View style={styles.titleRow}>
                <If5Icon name="coin" size={20} color={colors.accent} />
                <AppText variant="caption">{IF5_TEXT['MILEAGE.shop.balance']}</AppText>
              </View>
              <AppText variant="title" testID="mileage-total">
                {fmt(s.total)}
              </AppText>
              <AppText variant="caption" testID="mileage-split">
                {splitLine(s.free, s.paid)}
              </AppText>
              <AppText variant="body" testID="mileage-lead">
                {IF5_TEXT['MILEAGE.shop.lead']}
              </AppText>
              <AppText variant="caption" testID="mileage-unlimited">
                {IF5_TEXT['MILEAGE.unlimited']}
              </AppText>
            </View>

            {canCharge && !s.chargeLocked && !lockedNow ? (
              <View style={styles.card} testID="mileage-products">
                <AppText variant="bodyBold" accessibilityRole="header">
                  {IF5_TEXT['MILEAGE.shop.head']}
                </AppText>
                {s.products.map((p) => (
                  <Pressable
                    key={p.sku}
                    accessibilityRole="button"
                    accessibilityLabel={t5('MILEAGE.shop.item', { 가격: fmt(p.price), 수: fmt(p.mileage) })}
                    accessibilityState={{ disabled: busy !== null, busy: busy === p.sku }}
                    onPress={() => (isBigCharge(p) ? setBig(p) : void charge(p))}
                    disabled={busy !== null}
                    effect="none"
                    style={styles.product}
                    testID={`mileage-product-${p.sku}`}>
                    <AppText variant="bodyMedium" style={styles.flex}>
                      {t5('MILEAGE.shop.item', { 가격: fmt(p.price), 수: fmt(p.mileage) })}
                    </AppText>
                  </Pressable>
                ))}
                {busy ? (
                  <AppText variant="caption" accessibilityRole="progressbar" testID="mileage-pending">
                    {IF5_TEXT['MILEAGE.shop.pending']}
                  </AppText>
                ) : null}
                {failed ? (
                  <AppText variant="caption" accessibilityRole="alert" testID="mileage-charge-fail">
                    {IF5_TEXT['SAJU.status.errBody']}
                  </AppText>
                ) : null}
                <AppText variant="caption" testID="mileage-once">
                  {IF5_TEXT['MILEAGE.shop.once']}
                </AppText>
                <AppText variant="caption" testID="mileage-noexpire">
                  {IF5_TEXT['MILEAGE.shop.noExpire']}
                </AppText>
              </View>
            ) : canCharge ? (
              // 서버가 충전을 잠갔을 때(charge_locked): 사실 한 문장 + 글자 단추 '고객센터'(기존 12 설정 줄 이름 · 새 글 0). 잔액 · 내역 · 쓰기는 그대로 열려 있다
              <View style={styles.card} testID="mileage-locked">
                <AppText variant="body" testID="mileage-locked-text">
                  {IF5_TEXT['MILEAGE.shop.locked']}
                </AppText>
                <TextButton label={SUPPORT.rowName} align="start" onPress={() => openSettingsPage(router, 'support')} testID="mileage-locked-support" />
              </View>
            ) : (
              <View style={styles.card} testID="mileage-maint">
                <AppText variant="body">{IF5_TEXT['SAJU.status.maint']}</AppText>
              </View>
            )}

            <AppText variant="caption" testID="mileage-nocash">
              {IF5_TEXT['MILEAGE.noCash']}
            </AppText>
            <View style={styles.gapSmall} testID="mileage-notice-box">
              <AppText variant="bodyMedium">{IF5_TEXT['MILEAGE.shop.refund.title']}</AppText>
              <AppText variant="caption" testID="mileage-notice">
                {IF5_TEXT['MILEAGE.shop.notice']}
              </AppText>
              <AppText variant="caption" testID="mileage-refund-sub">
                {IF5_TEXT['MILEAGE.shop.refund.sub']}
              </AppText>
            </View>
            <AppText variant="caption" testID="mileage-trial">
              {IF5_TEXT['MILEAGE.shop.trial']}
            </AppText>
            <TextButton label={IF5_TEXT['MILEAGE.shop.history']} align="start" onPress={() => router.push(MILEAGE_LOG_HREF as Href)} testID="mileage-to-log" />
          </>
        ) : null}
      </ScrollView>
      <BigChargeSheet visible={big !== null} onClose={() => setBig(null)} onGo={() => big && void charge(big)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.s20, gap: space.s16, paddingBottom: space.s32 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s16, gap: space.s8 },
  gapSmall: { gap: space.s8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  flex: { flex: 1 },
  product: { minHeight: size.touchMin, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space.s16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg },
  skel: { height: 14, borderRadius: radius.sm, backgroundColor: colors.line, width: '60%' },
  skelWide: { width: '85%' },
});
