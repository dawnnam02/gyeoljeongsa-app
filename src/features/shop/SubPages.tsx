// 16 상점의 하위 쪽 셋(수익/상점_화면.md 3-6 · 3-7 · 3-9 · 7-9, Figma 312:97 ~ 312:786)
//  16-8  내 이용권 · 구매 내역: 구독 상태 · 남은 이용권 · [구매 복원](16-9 결과 시트) · [등급 구독 관리] · [결제 · 환불 안내]
//         구매 내역(날짜 · 상품 · 금액 · 상태)은 서버 list_my_purchases(S8d)를 그대로 그린다. 상품 이름은 서버 = 카피
//  16-9  구매 복원: 서버 demo_restore_purchases(S8d) 결과 — restored → NV29, nothing_to_restore → NV30, 호출 실패 → 실패 글
//  16-10 결제 · 환불 안내(법무 C4, 읽기 전용) · 판매자 정보
//  16-12 등급 구독 관리: 이용 중 · 갱신 꺼짐 · 결제 문제 · 가격 인상 동의 대기 · 끝남. 테스트 화면은 [구독 관리] 아래에 테스트 단추(자동 갱신 끄기 · 지금 끝내기 · 환불 처리)
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RollingNumber } from '@/motion';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StateArt } from '@/components/StateArt';
import { COMMON } from '@/content/copy';
import { PURCHASES16, REFUND_GUIDE, SHOP16 } from '@/content/shopCopy';
import { LoadState } from '@/features/settings/SettingsParts';
import { useLoad } from '@/features/settings/useLoad';
import type { CreditKind, PurchaseItem, ShopState, SubscriptionEnd } from '@/lib/shopApi';
import { CREDIT_KINDS } from '@/lib/shopApi';
import { layout } from '@/theme/layout';
import { space } from '@/theme/tokens';
import { H2_DONE_ART, H2_EMPTY_ART } from '@/theme/uiAssets';

import { sellerText } from './parts';
import { formatDay, subViewOf } from './shopLogic';
import type { ShopDeps } from './shopTypes';

// 구독 상태 글 한 줄(목록 카드 · 16-8 · 16-12가 같은 규칙)
export function subStatusText(shop: ShopState): string | null {
  const view = subViewOf(shop);
  const end = shop.subscription?.periodEnd ?? null;
  const date = end === null ? '' : formatDay(end);
  switch (view) {
    case 'active':
    case 'price-up':
      return date === '' ? '이용 중' : SHOP16.subActive(date); // Q5A-12: 서버가 끝나는 날을 안 주면 날짜 자리를 비우지 않고 사실만
    case 'renew-off':
      return date === '' ? '이용 중' : SHOP16.subRenewOff(date);
    case 'problem':
      return SHOP16.payProblem;
    case 'ended':
      return SHOP16.endedSub;
    default:
      return null;
  }
}

// ── 16-8 ────────────────────────────────────────────────────────────
const won = (n: number): string => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;

export function InventoryBody({ shop, deps, onReload, onManage, onRefund }: { shop: ShopState; deps: Pick<ShopDeps, 'api'>; onReload: () => Promise<ShopState | null>; onManage: () => void; onRefund: () => void }) {
  const [restore, setRestore] = useState<'idle' | 'checking' | 'found' | 'none' | 'failed'>('idle');
  const status = subStatusText(shop);
  const owned = CREDIT_KINDS.filter((k) => shop.credits[k] > 0);
  const readPurchases = useCallback(() => deps.api.loadPurchases(), [deps]);
  const history = useLoad<PurchaseItem[]>(readPurchases);

  const run = async () => {
    if (restore === 'checking') return;
    setRestore('checking');
    const result = await deps.api.restorePurchases(); // 서버가 판정한다: restored → NV29 · nothing_to_restore → NV30
    if (!result.ok) {
      setRestore('failed');
      return;
    }
    await onReload(); // 연결이 살아났으면 상점 상태도 새로 읽는다
    void history.reload();
    setRestore(result.data.result === 'restored' ? 'found' : 'none');
  };

  return (
    <View style={styles.page}>
      {shop.subscription ? (
        <Card style={styles.card} testID="inventory-sub">
          <AppText variant="bodyBold">{SHOP16.gradeCard.name}</AppText>
          <AppText variant="body" tone="text" testID="inventory-sub-status">
            {status}
          </AppText>
          <Button label={SHOP16.manageButton} variant="secondary" onPress={onManage} testID="inventory-manage" />
        </Card>
      ) : null}

      <Card style={styles.card} testID="inventory-credits">
        <AppText variant="bodyBold">{SHOP16.inventoryCredits}</AppText>
        {owned.length === 0 ? (
          <View style={styles.empty}>
            <StateArt source={H2_EMPTY_ART.emptyPass} size={layout.stateArt} testID="inventory-empty-art" />
            <AppText variant="body" tone="sub" testID="inventory-empty">
              {SHOP16.noCredit}
            </AppText>
          </View>
        ) : (
          owned.map((k: CreditKind) => (
            <View key={k} style={styles.creditRow} testID={`inventory-credit-${k}`}>
              <AppText variant="body" style={styles.flex}>
                {SHOP16.creditNames[k]}
              </AppText>
              <RollingNumber value={shop.credits[k]} suffix={SHOP16.creditUnit[k]} testID={`inventory-count-${k}`} />
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card} testID="inventory-history">
        <AppText variant="bodyBold">{PURCHASES16.title}</AppText>
        {history.phase !== 'ready' ? (
          <LoadState state={history.phase} onRetry={history.reload} testID="inventory-history-state" />
        ) : (history.data ?? []).length === 0 ? (
          <AppText variant="body" tone="sub" testID="inventory-history-empty">
            {PURCHASES16.empty}
          </AppText>
        ) : (
          (history.data ?? []).map((p) => (
            <View key={p.txId} style={styles.creditRow} testID={`inventory-tx-${p.txId}`}>
              <View style={styles.flex}>
                <AppText variant="body" testID={`inventory-tx-name-${p.txId}`}>
                  {p.name}
                </AppText>
                <AppText variant="caption" testID={`inventory-tx-line-${p.txId}`}>
                  {PURCHASES16.line(p.purchasedAt === null ? '' : formatDay(p.purchasedAt), won(p.priceKrw))}
                </AppText>
              </View>
              {PURCHASES16.status[p.status] ? (
                <AppText variant="captionMedium" tone="sub" testID={`inventory-tx-status-${p.txId}`}>
                  {PURCHASES16.status[p.status]}
                </AppText>
              ) : null}
            </View>
          ))
        )}
      </Card>

      <Button label={SHOP16.restore} variant="secondary" loading={restore === 'checking'} onPress={run} testID="inventory-restore" />
      {restore === 'checking' ? (
        <AppText variant="caption" accessibilityLiveRegion="polite" testID="inventory-restoring">
          {SHOP16.restoring}
        </AppText>
      ) : null}
      <Button label={SHOP16.refundTitle} variant="secondary" onPress={onRefund} testID="inventory-refund" />

      <BottomSheet visible={restore === 'found' || restore === 'none' || restore === 'failed'} onClose={() => setRestore('idle')} testID="restore-sheet">
        <View style={styles.sheet} testID="restore-result">
          <StateArt source={restore === 'found' ? H2_DONE_ART.donePassRestore : H2_EMPTY_ART.emptyRestore} size={layout.sheetArt} testID="restore-art" />
          <AppText variant="bodyBold" style={styles.centered} testID="restore-text">
            {restore === 'found' ? SHOP16.restored : restore === 'none' ? SHOP16.restoreNone : SHOP16.restoreFailed}
          </AppText>
          <Button label={SHOP16.ok} onPress={() => setRestore('idle')} testID="restore-ok" />
        </View>
      </BottomSheet>
    </View>
  );
}

// ── 16-10 ───────────────────────────────────────────────────────────
export function RefundBody() {
  return (
    <View style={styles.page} testID="refund-body">
      <Card style={styles.card}>
        <AppText variant="caption" tone="text" testID="refund-seller">
          {sellerText(REFUND_GUIDE.seller) ?? SHOP16.sellerSoon}
        </AppText>
      </Card>
      <Card style={styles.card}>
        {REFUND_GUIDE.lines.map((line, i) => (
          <AppText key={line} variant="caption" tone="text" testID={`refund-line-${i}`}>
            {line}
          </AppText>
        ))}
      </Card>
    </View>
  );
}

// ── 16-12 ───────────────────────────────────────────────────────────
export function ManageBody({ shop, deps, onReload, onRestart }: { shop: ShopState; deps: ShopDeps; onReload: () => Promise<ShopState | null>; onRestart: () => void }) {
  const [testOpen, setTestOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = subViewOf(shop);
  const end = shop.subscription?.periodEnd ?? null;
  const date = end === null ? '' : formatDay(end);

  const end_ = async (how: SubscriptionEnd) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await deps.api.endSubscription(how);
    if (!result.ok) {
      setBusy(false);
      setError(result.reason === 'network' ? COMMON.offline : COMMON.server);
      return;
    }
    await onReload();
    setBusy(false);
  };

  const demo = shop.paymentMode === 'demo';
  return (
    <View style={styles.page} testID="manage-body">
      <Card style={styles.card}>
        {view === 'active' || view === 'renew-off' || view === 'price-up' || view === 'problem' ? (
          <>
            <AppText variant="bodyBold" testID="manage-status">
              {view === 'renew-off' ? SHOP16.subRenewOff(date) : view === 'problem' ? SHOP16.payProblem : SHOP16.subActive(date)}
            </AppText>
            {view === 'renew-off' ? (
              <AppText variant="body" tone="text" testID="manage-renew-off">
                {SHOP16.renewOff(date)}
              </AppText>
            ) : null}
            {view === 'price-up' ? (
              <AppText variant="body" tone="text" testID="manage-price-up">
                {SHOP16.priceUp(date)}
              </AppText>
            ) : null}
            {view === 'active' ? (
              <AppText variant="caption" testID="manage-cancel-note">
                {SHOP16.cancelNote(date)}
              </AppText>
            ) : null}
            <Button label={SHOP16.manageStore} variant="secondary" onPress={() => setTestOpen((v) => !v)} testID="manage-store" />
            {demo && testOpen ? (
              <View style={styles.test} testID="manage-test">
                <Button label={SHOP16.testEnd.cancel} variant="secondary" loading={busy} onPress={() => end_('cancel')} testID="manage-test-cancel" />
                <Button label={SHOP16.testEnd.expire} variant="secondary" loading={busy} onPress={() => end_('expire')} testID="manage-test-expire" />
                <Button label={SHOP16.testEnd.refund} variant="secondary" loading={busy} onPress={() => end_('refund')} testID="manage-test-refund" />
                {error ? (
                  <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="manage-test-error">
                    {error}
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <AppText variant="body" tone="text" testID="manage-ended">
              {view === 'ended' ? SHOP16.endedSub : SHOP16.endedShort}
            </AppText>
            <Button label={SHOP16.restart} onPress={onRestart} testID="manage-restart" />
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.s16 },
  card: { gap: space.s12 },
  empty: { alignItems: 'center', gap: space.s8, paddingVertical: space.s8 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  flex: { flex: 1 },
  sheet: { gap: space.s12, paddingVertical: space.s8 },
  centered: { textAlign: 'center' },
  test: { gap: space.s8 },
});
