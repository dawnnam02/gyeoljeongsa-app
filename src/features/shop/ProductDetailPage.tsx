// 16-2 상품 상세(수익/상점_화면.md 3-3 · 7-8, Figma 310:97 ~ 310:748). 상단 ‹ + 상품 이름, 탭바 · 원형 사진 없음.
//  이름 · 한 줄 · 가격(카피 16-B) → (등급 구독) 선택지 1개월 · 3개월(보류) → 공정성 안내(등급 구독 · 1회 매칭 NV45, 단품 NV13) → 구매 전 확인 블록(법정 문구 C1 · C2 · C3) → 판매자 정보 → 하단 버튼
//  버튼: 살 수 있음 [구매하기](등급 구독은 1개월을 고르기 전 비활성, V-R3) · 이용 중 [등급 구독 관리] · 1회 매칭 남은 명분 [지금 받기] · 보류 VP2 · 준비 중 VP1(테스트 화면은 [구매하기]로 미리보기)
//  F16(B15 · Q3c): 상점 닫힘(shop_status closed)이면 구매 단추 자리에 '지금은 구매할 수 없어요.' 한 줄. 등급 구독이 준비 중(sub_gate preparing, 구독 중이 아닐 때)이면 구매 단추 · 가격 · 선택지 · 구매 전 확인 없이
//   '나보다 위 등급 분을 먼저 추천받는 구독은 함께하는 분이 더 모이면 열려요. 지금은 구매할 수 없어요.' 안내만(서버 값 그대로, 사람 수 · 날짜 없음)
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { CTA_PADDING, CtaFade } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pressable } from '@/components/Pressable';
import { BEFORE_BUY, REFUND_GUIDE, SHOP16 } from '@/content/shopCopy';
import type { ShopProduct, ShopState } from '@/lib/shopApi';
import { layout } from '@/theme/layout';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { matchLineOf } from './ProductCards';
import { LegalLines, RiskNote, sellerText } from './parts';
import { beforeBuyKind, formatDay, iconOf, lineOf, nameOf, priceOf, riskReasonOf, shopClosed, showsRiskLabel, subPreparing, subViewOf } from './shopLogic';

type Props = {
  product: ShopProduct;
  shop: ShopState;
  threeMonth: ShopProduct | null;
  onBuy: () => void;
  onTake: () => void;
  onManage: () => void;
  onRefund: () => void;
  onDocs: () => void;
};

export function ProductDetailBody({ product, shop, threeMonth, onBuy, onTake, onManage, onRefund, onDocs }: Props) {
  const kind = beforeBuyKind(product);
  const [picked, setPicked] = useState(false); // 등급 구독 1개월 선택(미리 골라 두지 않는다)
  const subView = subViewOf(shop);
  const subActive = subView !== 'none' && subView !== 'ended';
  const isGrade = product.catalogId === 'N01';
  const isMatch = product.catalogId === 'N02';
  const included = subActive && (product.catalogId === 'G1' || product.catalogId === 'G2');
  const end = shop.subscription?.periodEnd ?? null;
  const date = end === null ? '' : formatDay(end);
  const live = shop.paymentMode === 'live';
  const match = matchLineOf(shop);
  const lines = kind === 'grade' ? BEFORE_BUY.grade : kind === 'match' ? BEFORE_BUY.match : kind === 'single' ? BEFORE_BUY.single : null;
  // 공정성 안내: 등급 구독 NV45 / 1회 매칭 NV45 / 단품 NV13(구독하면 추천 순서가 바뀌므로 단품 칸에만, B11 R1)
  const fair = isGrade ? SHOP16.gradeCard.note : isMatch ? SHOP16.matchCard.note : kind === 'single' ? SHOP16.fairSingle : null;
  const closed = shopClosed(shop);
  const preparing = isGrade && !subActive && subPreparing(product, shop); // F16: 구독 판매 문턱 미만 → 준비 중(구매 막힘)
  const buyable = !closed && !preparing && (product.state === 'available' || (product.state === 'coming' && !live));
  // 하단 버튼
  let bottom: React.ReactNode = null;
  if (isGrade && subActive) {
    bottom = <Button label={SHOP16.manageButton} onPress={onManage} testID="detail-manage" />;
  } else if (isMatch && shop.matchOnce.slotsLeft > 0 && match.kind !== 'daily') {
    bottom = <Button label={SHOP16.takeNow} onPress={onTake} testID="detail-take" />;
  } else if (product.state === 'held') {
    bottom = <Button label={SHOP16.held} dimmed testID="detail-held" />;
  } else if (closed) {
    bottom = (
      <AppText variant="body" tone="text" style={styles.centered} testID="detail-closed">
        {SHOP16.closed}
      </AppText>
    ); // D-65 ①: 구매 단추 자리의 한 줄
  } else if (preparing) {
    bottom = null; // 구매 단추 없음 — 안내는 위(detail-prep)에 있다
  } else if (buyable) {
    const blockedToday = isMatch && (match.kind === 'daily' || match.kind === 'none');
    const needPick = isGrade && !picked;
    bottom = <Button label={SHOP16.buy} dimmed={needPick || blockedToday} onPress={needPick || blockedToday ? undefined : onBuy} testID="detail-buy" />;
  } else if (product.state === 'coming') {
    bottom = <Button label={SHOP16.comingButton} dimmed testID="detail-soon" />;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.body} testID="detail-body">
        <View style={styles.head}>
          {iconOf(product.catalogId) ? <Image source={iconOf(product.catalogId)} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
          <View style={styles.headText}>
            <AppText variant="title" testID="detail-name">
              {nameOf(product)}
            </AppText>
            <AppText variant="body" tone="text" testID="detail-line">
              {lineOf(product)}
            </AppText>
            {preparing ? null : (
              <AppText variant="bodyBold" testID="detail-price">
                {priceOf(product)}
              </AppText>
            )}
          </View>
        </View>
        {showsRiskLabel(product, shop) ? <RiskNote reason={riskReasonOf(product)} testID="detail-risk" /> : null}

        {isGrade ? (
          subActive ? (
            <AppText variant="body" tone="text" testID="detail-status">
              {subView === 'renew-off' ? SHOP16.subRenewOff(date) : SHOP16.subActive(date)}
            </AppText>
          ) : preparing ? (
            <AppText variant="body" tone="text" testID="detail-prep">
              {SHOP16.subPrepDetail}
            </AppText>
          ) : closed ? null : (
            <View style={styles.options} testID="detail-options">
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`${SHOP16.optionOneMonth}, ${priceOf(product)}`}
                accessibilityState={{ selected: picked }}
                aria-selected={picked}
                onPress={() => setPicked(true)}
                effect="scale"
                testID="detail-option-1m"
                style={[styles.option, picked ? styles.optionOn : null]}>
                <AppText variant="bodyBold">{SHOP16.optionOneMonth}</AppText>
                <AppText variant="caption" tone="text">
                  {priceOf(product)}
                </AppText>
              </Pressable>
              {threeMonth ? (
                <View style={[styles.option, styles.optionHeld]} accessible accessibilityState={{ disabled: true }} testID="detail-option-3m">
                  <AppText variant="bodyBold">{SHOP16.optionThreeMonth}</AppText>
                  <AppText variant="caption" tone="text">
                    {priceOf(threeMonth)}
                  </AppText>
                  <AppText variant="caption">{SHOP16.held}</AppText>
                </View>
              ) : null}
            </View>
          )
        ) : null}

        {isMatch ? (
          <AppText variant="body" tone="text" testID="detail-match-status">
            {match.text}
          </AppText>
        ) : null}
        {included ? (
          <AppText variant="body" tone="accent" testID="detail-included">
            {SHOP16.alreadyIncluded}
          </AppText>
        ) : null}

        {fair ? (
          <AppText variant="body" tone="text" testID="detail-fair">
            {fair}
          </AppText>
        ) : null}

        {lines && !preparing ? ( // 준비 중에는 구매 전 확인(법정 문구 C1)과 판매자 줄을 구매가 열릴 때만 보인다(카피 16-O)
          <Card style={styles.legalCard} testID="detail-before">
            <LegalLines lines={lines} testID="detail-before-lines" />
            {kind === 'grade' ? (
              <Pressable accessibilityLabel={BEFORE_BUY.refundLink} onPress={onRefund} effect="none" testID="detail-refund-link" style={styles.link}>
                <AppText variant="captionMedium" tone="accent">
                  {BEFORE_BUY.refundLink}
                </AppText>
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel={BEFORE_BUY.docsLink} onPress={onDocs} effect="none" testID="detail-docs-link" style={styles.link}>
              <AppText variant="captionMedium" tone="accent">
                {BEFORE_BUY.docsLink}
              </AppText>
            </Pressable>
          </Card>
        ) : null}
        {lines && !preparing ? (
          <AppText variant="caption" testID="detail-seller">
            {sellerText(REFUND_GUIDE.seller) ?? SHOP16.sellerSoon}
          </AppText>
        ) : null}
      </View>
      {bottom ? (
        <View style={styles.footer} testID="detail-footer">
        <CtaFade />
          {bottom}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { gap: space.s16 },
  head: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
  icon: { width: layout.shopRowIcon, height: layout.shopRowIcon, marginTop: space.s4 },
  headText: { flex: 1, gap: space.s8 },
  options: { flexDirection: 'row', gap: space.s12 },
  option: { flex: 1, minHeight: size.touchMin, gap: space.s4, padding: space.s12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.bg },
  optionHeld: { opacity: alpha.disabled },
  legalCard: { gap: space.s12 },
  link: { minHeight: size.touchMin, justifyContent: 'center', alignSelf: 'flex-start' },
  footer: { paddingTop: CTA_PADDING.paddingTop, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
  centered: { textAlign: 'center' },
});
