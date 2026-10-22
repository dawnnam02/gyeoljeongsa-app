// 16 상점 목록의 카드 · 줄(Figma D20 307:73 ~ 308:434). 서버가 준 상품 목록 순서 그대로 그린다(R5).
//  · 등급 구독 카드: 혜택 4줄(첫 줄 '나보다 위 등급 분을 먼저 추천받기') · 가격 · 안내 NV45 · [자세히] / 이용 중이면 상태 + [내 등급 보기] · [등급 구독 관리]
//  · 1회 매칭 카드: 설명 · 가격 · 오늘 가능 인원(NV50 · NV50b · NV21 · NV59) · 남은 명분(NV60) · 안내 NV45
//  · 그 밖 상품 줄: 이름 · 한 줄 · 가격 + 오른쪽 상태(준비 중 · 구독에 포함 · 무료 · 보류). 테스트 화면의 위험 C 상품에는 빨간 라벨 + 이유
//  · F16(B15 · Q3c): 등급 구독 카드가 준비 중(구독 판매 문턱 미만, 구독 중이 아닐 때)이면 '함께하는 분이 더 모이면 열려요' + 흐린 [준비 중이에요](누르면 상세의 준비 중 안내). 상점 닫힘이면 구매 단추 자리에 '지금은 구매할 수 없어요.' 한 줄
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { SHOP16 } from '@/content/shopCopy';
import type { ShopProduct, ShopState } from '@/lib/shopApi';
import { layout } from '@/theme/layout';
import { colors, size, space } from '@/theme/tokens';

import { RiskNote } from './parts';
import { formatDay, iconOf, lineOf, nameOf, priceOf, riskReasonOf, rowModeOf, rowOpens, shopClosed, showsRiskLabel, subPreparing, type SubView } from './shopLogic';

// 1회 매칭 카드 · 상세가 쓰는 오늘 상태 글(상점_화면 7-8 상태 표). 어느 글인지 정하는 규칙만 있다
export type MatchLine = { kind: 'balance' | 'full' | 'partial' | 'none' | 'daily'; text: string };
export function matchLineOf(shop: ShopState): MatchLine {
  const m = shop.matchOnce;
  if (m.usesToday >= m.dailyMax) return { kind: 'daily', text: SHOP16.matchDailyMax };
  if (m.slotsLeft > 0) return { kind: 'balance', text: SHOP16.matchBalance(m.slotsLeft) };
  if (m.availableToday >= 3) return { kind: 'full', text: SHOP16.matchAvailable };
  if (m.availableToday >= 1) return { kind: 'partial', text: SHOP16.matchPartial(m.availableToday, 3 - m.availableToday) };
  return { kind: 'none', text: SHOP16.matchNone };
}

export function GradeSubCard({
  shop,
  product,
  view,
  onDetail,
  onMyGrade,
  onManage,
}: {
  shop: ShopState;
  product: ShopProduct;
  view: SubView;
  onDetail: () => void;
  onMyGrade: () => void;
  onManage: () => void;
}) {
  const using = view !== 'none' && view !== 'ended';
  const closed = shopClosed(shop);
  const preparing = !using && subPreparing(product, shop);
  const end = shop.subscription?.periodEnd ?? null;
  const date = end === null ? '' : formatDay(end);
  const status =
    view === 'renew-off' ? SHOP16.subRenewOff(date) : view === 'problem' ? null : view === 'price-up' || view === 'active' ? SHOP16.subActive(date) : null;
  return (
    <Card variant="paper" style={styles.card} testID="shop-card-grade">
      <View style={styles.titleRow}>
        <Image source={iconOf('N01')} style={styles.cardIcon} resizeMode="contain" accessibilityIgnoresInvertColors />
        <AppText variant="bodyBold" style={styles.flex} testID="shop-grade-name">
          {nameOf(product)}
        </AppText>
        {using ? <Chip label={SHOP16.inUse} variant="tag" testID="shop-grade-inuse" /> : null}
      </View>
      {showsRiskLabel(product, shop) ? <RiskNote reason={riskReasonOf(product)} testID="shop-grade-risk" /> : null}
      {using ? (
        <>
          {status ? (
            <AppText variant="body" tone="text" testID="shop-grade-status">
              {status}
            </AppText>
          ) : null}
          <View style={styles.buttons}>
            <View style={styles.half}>
              <Button label={SHOP16.myGrade} onPress={onMyGrade} testID="shop-grade-my" />
            </View>
            <View style={styles.half}>
              <Button label={SHOP16.manageButton} variant="secondary" onPress={onManage} testID="shop-grade-manage" />
            </View>
          </View>
        </>
      ) : preparing ? (
        <>
          <AppText variant="caption" testID="shop-grade-prep">
            {SHOP16.subPrepLine}
          </AppText>
          <Button label={SHOP16.comingButton} dimmed onPress={onDetail} testID="shop-grade-soon" />
        </>
      ) : (
        <>
          <View style={styles.bullets} testID="shop-grade-benefits">
            {SHOP16.gradeCard.benefits.map((line, i) => (
              <View key={line} style={styles.bullet}>
                <AppText variant="body" tone="accent" accessibilityElementsHidden importantForAccessibility="no">
                  •
                </AppText>
                <AppText variant="body" tone="text" style={styles.flex} testID={`shop-grade-benefit-${i}`}>
                  {line}
                </AppText>
              </View>
            ))}
          </View>
          <View style={styles.priceRow}>
            <AppText variant="bodyBold" testID="shop-grade-price">
              {priceOf(product)}
            </AppText>
            <AppText variant="caption">{SHOP16.gradeCard.vat}</AppText>
          </View>
          <AppText variant="caption" testID="shop-grade-note">
            {SHOP16.gradeCard.note}
          </AppText>
          {closed ? (
            <AppText variant="caption" tone="text" testID="shop-grade-closed">
              {SHOP16.closed}
            </AppText>
          ) : (
            <Button label={SHOP16.more} onPress={onDetail} testID="shop-grade-detail" />
          )}
        </>
      )}
    </Card>
  );
}

// 3개월권(N03): 카드는 보이고 버튼은 보류(VP2)
export function ThreeMonthCard({ shop, product }: { shop: ShopState; product: ShopProduct }) {
  return (
    <Card variant="paper" style={styles.card} testID="shop-card-three">
      <AppText variant="bodyBold" testID="shop-three-name">
        {nameOf(product)}
      </AppText>
      <AppText variant="caption" testID="shop-three-line">
        {lineOf(product)}
      </AppText>
      {showsRiskLabel(product, shop) ? <RiskNote reason={riskReasonOf(product)} /> : null}
      <View style={styles.priceRow}>
        <AppText variant="bodyBold">{priceOf(product)}</AppText>
        <AppText variant="caption">{SHOP16.gradeCard.vat}</AppText>
      </View>
      <Button label={SHOP16.held} dimmed testID="shop-three-held" />
    </Card>
  );
}

export function MatchCard({ shop, product, onDetail, onTake }: { shop: ShopState; product: ShopProduct; onDetail: () => void; onTake: () => void }) {
  const line = matchLineOf(shop);
  const canTake = shop.matchOnce.slotsLeft > 0 && shop.matchOnce.usesToday < shop.matchOnce.dailyMax && shop.matchOnce.availableToday > 0;
  return (
    <Card variant="paper" style={styles.card} testID="shop-card-match">
      <View style={styles.titleRow}>
        <Image source={iconOf('N02')} style={styles.cardIcon} resizeMode="contain" accessibilityIgnoresInvertColors />
        <AppText variant="bodyBold" style={styles.flex} testID="shop-match-name">
          {nameOf(product)}
        </AppText>
      </View>
      {showsRiskLabel(product, shop) ? <RiskNote reason={riskReasonOf(product)} testID="shop-match-risk" /> : null}
      <AppText variant="body" tone="text" testID="shop-match-line">
        {SHOP16.matchCard.line}
      </AppText>
      <AppText variant="bodyBold" testID="shop-match-price">
        {priceOf(product)}
      </AppText>
      <AppText variant="caption" tone="text" testID="shop-match-status">
        {line.text}
      </AppText>
      <AppText variant="caption" testID="shop-match-note">
        {SHOP16.matchCard.note}
      </AppText>
      {/* 한 화면에 주 버튼 하나(D36 #3 · 16 후): 주 버튼은 첫 카드(등급 구독)만 — 둘째 카드는 보조 · 텍스트 버튼 */}
      {canTake ? <Button label={SHOP16.takeNow} variant="secondary" onPress={onTake} testID="shop-match-take" /> : null}
      {shopClosed(shop) ? (
        <AppText variant="caption" tone="text" testID="shop-match-closed">
          {SHOP16.closed}
        </AppText>
      ) : (
        <Button label={SHOP16.more} variant={canTake ? 'text' : 'secondary'} onPress={onDetail} testID="shop-match-detail" />
      )}
    </Card>
  );
}

// 그 밖 상품 줄. 오른쪽 상태: 살 수 있음 = 가격 · 준비 중 = VP1 · 보류 = VP2 · 구독에 포함 / 무료 = 가격 칸의 글
export function ProductRow({ product, shop, onOpen }: { product: ShopProduct; shop: ShopState; onOpen: () => void }) {
  const mode = rowModeOf(product);
  const opens = rowOpens(product, shop.paymentMode);
  const body = (
    <View style={styles.rowBody}>
      <View style={styles.rowText}>
        <AppText variant="bodyBold" testID={`shop-row-name-${product.catalogId}`}>
          {nameOf(product)}
        </AppText>
        <AppText variant="caption" testID={`shop-row-line-${product.catalogId}`}>
          {lineOf(product)}
        </AppText>
        {showsRiskLabel(product, shop) ? <RiskNote reason={riskReasonOf(product)} testID={`shop-row-risk-${product.catalogId}`} /> : null}
      </View>
      <View style={styles.rowSide}>
        <AppText variant="captionMedium" tone="text" style={styles.rowPrice} testID={`shop-row-price-${product.catalogId}`}>
          {priceOf(product)}
        </AppText>
        {mode === 'soon' ? <Chip label={SHOP16.comingButton} variant="inactive" testID={`shop-row-soon-${product.catalogId}`} /> : null}
        {mode === 'held' ? <Chip label={SHOP16.held} variant="inactive" testID={`shop-row-held-${product.catalogId}`} /> : null}
        {mode === 'included' ? <Chip label={SHOP16.included} variant="tag" testID={`shop-row-included-${product.catalogId}`} /> : null}
        {mode === 'free' ? <Chip label={SHOP16.free} variant="tag" testID={`shop-row-free-${product.catalogId}`} /> : null}
      </View>
    </View>
  );
  const icon = iconOf(product.catalogId);
  const inner = (
    <View style={styles.rowWrap}>
      {icon ? <Image source={icon} style={styles.rowIcon} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
      {body}
    </View>
  );
  const label = `${nameOf(product)}. ${lineOf(product)} ${priceOf(product)}`;
  return opens ? (
    <Card onPress={onOpen} accessibilityLabel={label} style={styles.rowCard} testID={`shop-row-${product.catalogId}`}>
      {inner}
    </Card>
  ) : (
    <Card accessible accessibilityLabel={label} style={styles.rowCard} testID={`shop-row-${product.catalogId}`}>
      {inner}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.s12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  cardIcon: { width: layout.shopCardIcon, height: layout.shopCardIcon },
  flex: { flex: 1, flexShrink: 1 },
  bullets: { gap: space.s8 },
  bullet: { flexDirection: 'row', gap: space.s8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.s8 },
  buttons: { flexDirection: 'row', gap: space.s12 },
  half: { flex: 1 },
  rowCard: { padding: space.s16 },
  rowWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12 },
  rowIcon: { width: layout.shopRowIcon, height: layout.shopRowIcon, marginTop: space.s4 },
  rowBody: { flex: 1, flexDirection: 'row', gap: space.s12, alignItems: 'flex-start', minWidth: 0 },
  rowText: { flex: 1, minWidth: 0, gap: space.s4 },
  rowSide: { alignItems: 'flex-end', gap: space.s4, maxWidth: size.touchMin * 3 },
  rowPrice: { textAlign: 'right', color: colors.text },
});
