// 구매 시트(수익/상점_화면.md 3-4 ~ 3-8 · 7-10, Figma 16-3 ~ 16-6 · 16-11 · 16-D). 데모 결제만이다 — 돈이 나가거나 스토어를 부르는 일이 없다.
//  confirm(16-3 '이대로 구매할까요?') → [결제하기] → 서버 can_purchase 판정(살 수 있는 상품만) → demo(16-D '데모 결제예요. 돈은 나가지 않아요.') → [데모로 구매]
//  → checking(16-4 '결제를 확인하고 있어요', 30초 넘으면 '확인이 늦어지고 있어요') → done(16-5 완료) · preview(준비 중 상품 NV58) · failed(16-6 NV22) · blocked(16-11 연령 · 판매 안 함 · 이미 이용 중 · 하루 한도 · 오늘 0명 · F16: 상점 닫힘 closed · 구독 문턱 미만 sub_not_ready)
//  실결제 모드(payment_mode = live)에서는 구매를 시작하지 않는다(NV32). 같은 구매의 [다시 시도]는 같은 요청 ID 를 쓴다(서버가 한 번만 지급, R9).
//  구매 완료(D25 장면 7 · D31, F17): 지급이 확인된 순간 Success 햅틱 + 로고 타일이 찍히고(700) 500ms 뒤 글이 올라온다(250). 실패는 Error 햅틱. 동작 줄이기: 투명도만
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { StateArt } from '@/components/StateArt';
import { BEFORE_BUY, SHOP16 } from '@/content/shopCopy';
import { haptic, logoTile, Rise, scene, StampTile } from '@/motion';
import type { ShopProduct, ShopState } from '@/lib/shopApi';
import { layout } from '@/theme/layout';
import { colors, space } from '@/theme/tokens';
import { STATE_ART } from '@/theme/uiAssets';

import { RiskNote } from './parts';
import { beforeBuyKind, blockedTextOf, formatDay, iconOf, nameOf, priceOf, riskReasonOf, shopClosed, showsRiskLabel, subjectOf, subPreparing } from './shopLogic';
import type { ShopDeps } from './shopTypes';

type Step = 'confirm' | 'demo' | 'checking' | 'done' | 'preview' | 'failed' | 'blocked';
type Blocked = ReturnType<typeof blockedTextOf>;

type Props = {
  visible: boolean;
  product: ShopProduct | null;
  shop: ShopState;
  deps: ShopDeps;
  onClose: () => void;
  onReload: () => Promise<ShopState | null>; // 지급 뒤 상점 상태를 다시 읽는다(구독 · 남은 이용권)
  onManage: () => void; // 이미 이용 중 → 16-12
  onTakeMatch: () => void; // 1회 매칭 구매 뒤 [지금 받기]
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Q5A-10: 상품마다 요청 ID 를 시트가 닫혀도 이어 쓴다. 확인 중에 닫았다가 같은 상품을 다시 사도 서버가 같은 요청으로 알아봐 두 번 지급하지 않는다.
// 끝난 요청(성공 · 사지 못함)이면 지워서 다음 구매는 새 ID 를 쓴다.
const openRequestIds = new Map<string, string>();
export const resetOpenRequestIds = () => openRequestIds.clear();

export function PurchaseSheet({ visible, product, shop, deps, onClose, onReload, onManage, onTakeMatch }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [blocked, setBlocked] = useState<Blocked>('sold');
  const [slow, setSlow] = useState(false);
  const [doneText, setDoneText] = useState('');
  const failedFrom = useRef<'pay' | 'buy'>('buy'); // 어느 단계에서 실패했나: [다시 시도]가 그 단계를 다시 한다
  const requestId = useRef<string | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // 확인 중이 오래 걸리면 안내를 바꾼다(NV17)
  useEffect(() => {
    if (step !== 'checking') return undefined;
    const timer = setTimeout(() => setSlow(true), deps.slowMs);
    return () => clearTimeout(timer);
  }, [step, deps.slowMs]);

  if (!product) return null;
  const kind = beforeBuyKind(product);
  const withdraw = kind === 'grade' ? BEFORE_BUY.grade[4] : kind === 'match' ? BEFORE_BUY.match[4] : kind === 'single' ? BEFORE_BUY.single[0] : null;
  const live = shop.paymentMode === 'live';
  const coming = product.state === 'coming';

  const pay = async () => {
    if (busy.current) return;
    if (shopClosed(shop)) {
      setBlocked('closed'); // F16: 상점이 닫혀 있으면 서버에 묻지 않고 막는다(서버도 closed 로 거절한다)
      setStep('blocked');
      return;
    }
    if (live) {
      setBlocked('sold'); // 실결제는 아직 연결하지 않는다
      setStep('blocked');
      return;
    }
    if (subPreparing(product, shop)) {
      setBlocked('sub-not-ready'); // F16: 구독 판매 문턱 미만(화면은 이 단추를 안 보이지만 막아 둔다 — 준비 중 상품의 데모 미리보기로도 열리지 않는다)
      setStep('blocked');
      return;
    }
    if (coming) {
      setStep('demo'); // 준비 중 상품은 서버가 판정 없이 미리보기를 준다(demo_purchase)
      return;
    }
    busy.current = true;
    const result = await deps.api.canPurchase(product.key);
    busy.current = false;
    if (!alive.current) return;
    if (!result.ok) {
      failedFrom.current = 'pay';
      haptic.error(); // 결제 실패(D25 4장)
      setStep('failed');
      return;
    }
    if (!result.data.ok) {
      setBlocked(blockedTextOf(result.data.reason));
      setStep('blocked');
      return;
    }
    setStep('demo');
  };

  const buy = async () => {
    if (busy.current) return;
    busy.current = true;
    setSlow(false);
    setStep('checking');
    if (requestId.current === null) requestId.current = openRequestIds.get(product.key) ?? deps.newId();
    openRequestIds.set(product.key, requestId.current);
    const result = await deps.api.demoPurchase(product.key, requestId.current);
    busy.current = false;
    if (result.ok || !(result.reason === 'network' || result.reason === 'server' || result.reason === 'other')) openRequestIds.delete(product.key);
    if (!alive.current) return;
    if (!result.ok) {
      const reason = result.reason;
      if (reason === 'network' || reason === 'server' || reason === 'other') {
        failedFrom.current = 'buy';
        haptic.error(); // 결제 실패(D25 4장)
        setStep('failed');
        return;
      }
      setBlocked(blockedTextOf(reason));
      setStep('blocked');
      return;
    }
    if (result.data.kind === 'preview') {
      setStep('preview');
      return;
    }
    const fresh = await onReload();
    if (!alive.current) return;
    if (product.section === 'grade_sub') {
      const end = fresh?.subscription?.periodEnd ?? deps.now() + 30 * DAY_MS;
      setDoneText(SHOP16.gotGrade(formatDay(end)));
    } else if (product.section === 'match_once') {
      setDoneText(SHOP16.gotItem(nameOf(product), subjectOf('3명분')));
    } else {
      setDoneText(SHOP16.gotItem(nameOf(product), subjectOf(product.catalogId === 'G2' ? '1통' : '1장')));
    }
    haptic.success(); // 구매가 확인된 순간(누른 때가 아니라 지급이 확인된 때, D25 4장)
    setStep('done');
  };

  const blockedText: Record<Blocked, string> = {
    age: SHOP16.ageLimit,
    sold: SHOP16.notSellable,
    already: SHOP16.already,
    daily: SHOP16.matchDailyMax,
    'none-today': SHOP16.matchNone,
    closed: SHOP16.closed,
    'sub-not-ready': SHOP16.subPrepDetail,
  };

  const price = (
    <View style={styles.summary} testID="purchase-summary">
      <View style={styles.nameRow}>
        {iconOf(product.catalogId) ? <Image source={iconOf(product.catalogId)} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
        <AppText variant="bodyBold" testID="purchase-name">
          {nameOf(product)}
        </AppText>
      </View>
      <AppText variant="body" tone="text" testID="purchase-price">
        {priceOf(product)}
        {kind === 'grade' || kind === 'match' ? ` · ${SHOP16.gradeCard.vat}` : ''}
      </AppText>
      {showsRiskLabel(product, shop) ? <RiskNote reason={riskReasonOf(product)} testID="purchase-risk" /> : null}
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} dismissable={step !== 'checking'} testID="purchase-sheet">
      {step === 'confirm' ? (
        <>
          <AppText variant="title" accessibilityRole="header" testID="purchase-title">
            {SHOP16.confirmTitle}
          </AppText>
          {price}
          {withdraw ? (
            <AppText variant="caption" tone="text" testID="purchase-withdraw">
              {`${withdraw.label}: ${withdraw.text}`}
            </AppText>
          ) : null}
          <Button label={SHOP16.pay} onPress={pay} testID="purchase-pay" />
          <Button label={SHOP16.cancel} variant="secondary" onPress={onClose} testID="purchase-cancel" />
        </>
      ) : null}

      {step === 'demo' ? (
        <>
          <AppText variant="title" accessibilityRole="header" testID="purchase-demo-title">
            {SHOP16.demoSheet}
          </AppText>
          {price}
          <Button label={SHOP16.demoBuy} onPress={buy} testID="purchase-demo-buy" />
          <Button label={SHOP16.cancel} variant="secondary" onPress={onClose} testID="purchase-demo-cancel" />
        </>
      ) : null}

      {step === 'checking' ? (
        <View style={styles.center} accessibilityLiveRegion="polite" testID="purchase-checking">
          <ActivityIndicator color={colors.accent} />
          <AppText variant="bodyBold" style={styles.centered} testID="purchase-checking-text">
            {SHOP16.checking}
          </AppText>
          {slow ? (
            <>
              <AppText variant="body" tone="sub" style={styles.centered} testID="purchase-slow">
                {SHOP16.checkingSlow}
              </AppText>
              <Button label={SHOP16.ok} variant="secondary" onPress={onClose} testID="purchase-slow-ok" />
            </>
          ) : null}
        </View>
      ) : null}

      {step === 'done' ? (
        <View style={styles.center} testID="purchase-done">
          <StampTile size={logoTile.sheet} testID="purchase-done-art" />
          <Rise delay={scene.buy.textDelay} duration={scene.toast.in}>
            <AppText variant="bodyBold" style={styles.centered} testID="purchase-done-text">
              {doneText}
            </AppText>
          </Rise>
          {product.section === 'match_once' ? <Button label={SHOP16.takeNow} onPress={onTakeMatch} testID="purchase-done-take" /> : null}
          <Button label={SHOP16.ok} variant={product.section === 'match_once' ? 'secondary' : 'primary'} onPress={onClose} testID="purchase-done-ok" />
        </View>
      ) : null}

      {step === 'preview' ? (
        <View style={styles.center} testID="purchase-preview">
          <AppText variant="body" tone="text" style={styles.centered} testID="purchase-preview-text">
            {SHOP16.preview}
          </AppText>
          <Button label={SHOP16.ok} onPress={onClose} testID="purchase-preview-ok" />
        </View>
      ) : null}

      {step === 'failed' ? (
        <View style={styles.center} testID="purchase-failed">
          <StateArt source={STATE_ART.shopFail} size={layout.sheetArt} testID="purchase-failed-art" />
          <AppText variant="body" tone="text" style={styles.centered} accessibilityRole="alert" testID="purchase-failed-text">
            {SHOP16.failed}
          </AppText>
          <Button label={SHOP16.retry} onPress={() => (failedFrom.current === 'pay' ? void pay() : void buy())} testID="purchase-failed-retry" />
          <Button label={SHOP16.close} variant="secondary" onPress={onClose} testID="purchase-failed-close" />
        </View>
      ) : null}

      {step === 'blocked' ? (
        <View style={styles.center} testID="purchase-blocked">
          <AppText variant="body" tone="text" style={styles.centered} accessibilityRole="alert" testID="purchase-blocked-text">
            {blockedText[blocked]}
          </AppText>
          {blocked === 'already' ? <Button label={SHOP16.manageButton} onPress={onManage} testID="purchase-blocked-manage" /> : null}
          <Button label={SHOP16.close} variant={blocked === 'already' ? 'secondary' : 'primary'} onPress={onClose} testID="purchase-blocked-close" />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: { gap: space.s8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  icon: { width: layout.shopCardIcon, height: layout.shopCardIcon },
  center: { gap: space.s12, alignItems: 'stretch', paddingVertical: space.s8 },
  centered: { textAlign: 'center' },
});
