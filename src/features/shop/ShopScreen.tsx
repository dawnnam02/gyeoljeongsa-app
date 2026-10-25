// 화면 ID 16 상점(K7 · F11 · F13 · 기획 화면_요구사항 16 · 수익/상점_화면.md · Figma D20 305:48 · 카피.md 16).
//  목록(탭 화면): 테스트 화면 띠(NV56) → ① 등급 구독 카드(+ 3개월 보류) → ② 1회 매칭 카드 → ③ 필요할 때 하나씩(서버 순서 그대로) → ④ 무료로 볼 수 있어요 → ⑤ 링크 3
//  하위 쪽(탭바 · 원형 사진 없음, 12 설정처럼 이 화면 안의 쪽): 16-2 상품 상세 · 16-G1 내 등급 · 16-G2 변화 기록 · 16-G3 목표 · 16-G4 해설 · 16-8 이용권 · 16-10 안내 · 16-12 구독 관리
//  시트: 16-3 구매 확인 → 16-D 데모 결제 → 16-4 확인 중 → 16-5 완료 · 16-6 실패 · 16-11 제한 / 16-M 1회 매칭 사용 / 16-G5 내 등급 알려 주세요
//  앱은 서버가 준 상품 · 판정만 그린다(R5). 결제는 데모 결제만이다(실결제 · live 모드 금지).
//  다른 화면에서 쪽을 바로 열려면 주소 /shop?page=product&key=… 처럼 page(product · grade · grade-how · inventory · refund · manage)를 준다(10 의 NV47 줄).
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { backToShopOpener, shopOpenerOf, type ShopOpener } from '@/navigation/go';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Pressable } from '@/components/Pressable';
import { Icon } from '@/components/Icon';
import { OfflineArt, StateArt } from '@/components/StateArt';
import { TabHeader } from '@/components/TabHeader';
import { SkeletonCard, TOAST_MS, useCollapsingTitle, WaitState } from '@/motion';
import { Toast } from '@/components/Toast';
import { COMMON, SHOP } from '@/content/copy';
import { GRADE16, REPORT16, SHOP16 } from '@/content/shopCopy';
import { LegalReader } from '@/features/consent/LegalReader';
import { AccessSheet } from '@/features/grade/AccessSheet';
import { GoalBody, GradeBody, HistoryBody, HowBody } from '@/features/grade/GradePages';
import { SubPage } from '@/features/settings/SettingsParts';
import { useLoad } from '@/features/settings/useLoad';
import { newRequestId } from '@/lib/requestId';
import { aiApi, gradeApi, shopApi } from '@/lib/services';
import type { ShopProduct, ShopState } from '@/lib/shopApi';
import { setToast as passToast } from '@/lib/toastBus';
import { useHideTabBar } from '@/store/chromeStore';
import { layout } from '@/theme/layout';
import { colors, size, space } from '@/theme/tokens';
import { SHOP_ICONS, STATE_ART } from '@/theme/uiAssets';

import { MatchOnceSheet } from './MatchOnceSheet';
import { GradeSubCard, MatchCard, ProductRow, ThreeMonthCard } from './ProductCards';
import { ProductDetailBody } from './ProductDetailPage';
import { PurchaseSheet } from './PurchaseSheet';
import { ReportBody } from './ReportPage';
import { InventoryBody, ManageBody, RefundBody } from './SubPages';
import { LinkRow, SectionTitle, TestBand } from './parts';
import { nameOf, sectionsOf, shopClosed, subViewOf } from './shopLogic';
import type { ShopDeps, ShopNav, ShopPage } from './shopTypes';

const defaultDeps: ShopDeps = { api: shopApi, ai: aiApi, grade: gradeApi, now: Date.now, newId: () => newRequestId(), toastMs: TOAST_MS, slowMs: 30_000 };

const PAGE_TITLES: Record<Exclude<ShopPage['name'], 'list' | 'product'>, string> = {
  grade: GRADE16.title,
  'grade-history': GRADE16.historyTitle,
  'grade-goal': GRADE16.goalTitle,
  'grade-how': GRADE16.howTitle,
  inventory: SHOP16.inventoryTitle,
  refund: SHOP16.refundTitle,
  manage: SHOP16.manageTitle,
  report: REPORT16.title,
};
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PARAM_PAGES = ['product', 'grade', 'grade-history', 'grade-goal', 'grade-how', 'inventory', 'refund', 'manage', 'report'] as const;

export function ShopScreen({ deps = defaultDeps }: { deps?: ShopDeps }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ page?: string; key?: string; from?: string }>();
  const read = useCallback(() => deps.api.loadShop(), [deps]);
  const { phase, data: shop, setData, reload } = useLoad<ShopState>(read);
  const [stack, setStack] = useState<ShopPage[]>([{ name: 'list' }]);
  const [opener, setOpener] = useState<ShopOpener | null>(null); // Q5A-14 · F18 N2: 10 · 12 가 연 쪽의 ‹ 는 그 화면으로 돌아간다
  const page = stack[stack.length - 1];
  const [buying, setBuying] = useState<ShopProduct | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [sessions, setSessions] = useState({ buy: 0, match: 0, access: 0 }); // 시트를 열 때마다 번호를 올려 새로 세운다(이전 진행 · 오류가 남지 않게)
  const [toast, setToast] = useState<string | null>(null);
  const alive = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useHideTabBar(page.name !== 'list'); // 하위 쪽은 탭 위에 열린다(탭바 없음)
  const collapse = useCollapsingTitle(); // 큰 제목 줄어듦(F21)

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback(
    (text: string) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(text);
      toastTimer.current = setTimeout(() => setToast(null), deps.toastMs);
    },
    [deps.toastMs],
  );

  // 조용히 다시 읽기: 불러오는 표시 없이 값만 바꾼다(구매 · 사용 뒤, 탭에 다시 들어올 때)
  const quiet = useCallback(async (): Promise<ShopState | null> => {
    const result = await deps.api.loadShop();
    if (!alive.current || !result.ok) return null;
    setData(result.data);
    return result.data;
  }, [deps.api, setData]);

  // 탭에 다시 들어오면 값을 새로 읽고, 탭을 떠나면 목록부터 다시 시작한다
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else void quiet();
      return () => {
        setStack([{ name: 'list' }]);
        setBuying(null);
        setMatchOpen(false);
        setAccessOpen(false);
      };
    }, [quiet]),
  );

  // 다른 화면이 쪽을 바로 열어 달라고 준 값(page · key)을 한 번 받아 쓴다(받은 뒤 주소에서 지운다)
  const pageParam = first(params.page);
  const keyParam = first(params.key);
  const wanted = pageParam && (PARAM_PAGES as readonly string[]).includes(pageParam) ? `${pageParam}:${keyParam ?? ''}` : null;
  const [seen, setSeen] = useState<string | null>(null);
  if (wanted !== seen) {
    setSeen(wanted);
    if (wanted !== null && pageParam) {
      const next: ShopPage = pageParam === 'product' ? { name: 'product', key: keyParam ?? '' } : ({ name: pageParam } as ShopPage);
      setStack([{ name: 'list' }, next]);
      setOpener(shopOpenerOf(first(params.from)));
    }
  }
  useEffect(() => {
    if (wanted !== null) router.setParams?.({ page: undefined, key: undefined, from: undefined });
  }, [wanted, router]);

  const bump = (kind: 'buy' | 'match' | 'access') => setSessions((v) => ({ ...v, [kind]: v[kind] + 1 }));
  const openBuy = (p: ShopProduct) => {
    bump('buy');
    setBuying(p);
  };
  const openMatch = () => {
    bump('match');
    setMatchOpen(true);
  };
  const openAccess = () => {
    bump('access');
    setAccessOpen(true);
  };

  const nav: ShopNav = {
    push: (p) => setStack((s) => [...s, p]),
    back: () => {
      if (opener && stack.length === 2) {
        setOpener(null);
        setStack([{ name: 'list' }]);
        backToShopOpener(router, opener);
        return;
      }
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    },
    toList: () => setStack([{ name: 'list' }]),
  };

  const openProduct = (p: ShopProduct) => nav.push({ name: 'product', key: p.key });
  const goMatches = (added: number) => {
    // 받음 → 09 '추가로 받은 추천' 구역 + 토스트(NV62)
    setMatchOpen(false);
    setBuying(null);
    passToast(SHOP16.matchDone(added));
    nav.toList();
    router.navigate('/recommendations');
  };

  const sheets = (
    <>
      {shop ? (
        <PurchaseSheet
          key={`buy-${sessions.buy}`}
          visible={buying !== null}
          product={buying}
          shop={shop}
          deps={deps}
          onClose={() => setBuying(null)}
          onReload={quiet}
          onManage={() => {
            setBuying(null);
            nav.push({ name: 'manage' });
          }}
          onTakeMatch={() => {
            setBuying(null);
            openMatch();
          }}
        />
      ) : null}
      {shop ? <MatchOnceSheet key={`match-${sessions.match}`} visible={matchOpen} status={shop.matchOnce} deps={deps} onClose={() => setMatchOpen(false)} onReload={quiet} onGo={goMatches} /> : null}
      <AccessSheet key={`access-${sessions.access}`} visible={accessOpen} deps={deps} onClose={() => setAccessOpen(false)} onToast={showToast} />
      <LegalReader visible={docsOpen} initial="terms" onClose={() => setDocsOpen(false)} />
    </>
  );

  // ④ 무료로 볼 수 있어요: 내 성향 리포트 · 등급은 어떻게 정해지나요? · 내 등급 알려 주세요 (모든 회원 무료, 상품이 0개여도 늘 보인다)
  const freeZone = (
    <>
      <SectionTitle text={SHOP16.freeTitle} testID="shop-free-title" />
      <Card style={styles.links} testID="shop-free">
        <Pressable accessibilityRole="button" accessibilityLabel={`${SHOP16.freeRows.report}, ${SHOP16.free}. ${SHOP.reportBody}`} onPress={() => nav.push({ name: 'report' })} effect="none" style={styles.reportRow} testID="shop-report">
          <Icon name={SHOP_ICONS.traitReport} size={layout.shopRowIcon} testID="shop-report-icon" />
          <View style={styles.reportText}>
            <View style={styles.reportTitle}>
              <AppText variant="bodyBold" testID="shop-report-title">
                {SHOP16.freeRows.report}
              </AppText>
              <Chip label={SHOP16.free} variant="tag" testID="shop-report-free" />
            </View>
            <AppText variant="caption" testID="shop-report-body">
              {SHOP.reportBody}
            </AppText>
          </View>
        </Pressable>
        <LinkRow label={SHOP16.freeRows.how} onPress={() => nav.push({ name: 'grade-how' })} testID="shop-free-how" />
        <LinkRow label={SHOP16.freeRows.access} icon={SHOP_ICONS.myTierView} onPress={openAccess} last testID="shop-free-access" />
      </Card>
    </>
  );

  // ── 하위 쪽 ──────────────────────────────────────────────────────
  if (page.name !== 'list') {
    const product = page.name === 'product' && shop ? shop.products.find((p) => p.key === page.key) : undefined;
    const title = page.name === 'product' ? (product ? nameOf(product) : SHOP.headerTitle) : PAGE_TITLES[page.name];
    let body: React.ReactNode = null;
    if (!shop) {
      body = phase === 'loading' ? <Loading /> : <ErrorPanel kind={phase === 'network' ? 'network' : 'server'} onRetry={reload} />;
    } else if (page.name === 'product') {
      const three = shop.products.find((p) => p.catalogId === 'N03') ?? null;
      body = product ? (
        <ProductDetailBody
          product={product}
          shop={shop}
          threeMonth={three}
          onBuy={() => openBuy(product)}
          onTake={openMatch}
          onManage={() => nav.push({ name: 'manage' })}
          onRefund={() => nav.push({ name: 'refund' })}
          onDocs={() => setDocsOpen(true)}
        />
      ) : (
        <AppText variant="body" tone="sub" testID="shop-product-missing">
          {shopClosed(shop) ? SHOP16.closed : SHOP16.notSellable}
        </AppText>
      );
    } else if (page.name === 'grade') {
      body = <GradeBody shop={shop} deps={deps} nav={nav} onAccess={openAccess} />;
    } else if (page.name === 'grade-history') {
      body = <HistoryBody deps={deps} />;
    } else if (page.name === 'grade-goal') {
      body = <GoalBody deps={deps} />;
    } else if (page.name === 'grade-how') {
      body = <HowBody />;
    } else if (page.name === 'inventory') {
      body = <InventoryBody shop={shop} deps={deps} onReload={quiet} onManage={() => nav.push({ name: 'manage' })} onRefund={() => nav.push({ name: 'refund' })} />;
    } else if (page.name === 'report') {
      body = <ReportBody deps={deps} />;
    } else if (page.name === 'refund') {
      body = <RefundBody />;
    } else if (page.name === 'manage') {
      body = <ManageBody shop={shop} deps={deps} onReload={quiet} onRestart={() => nav.push({ name: 'product', key: 'grade_sub_1m' })} />;
    }
    return (
      <Screen edges={['top']} testID={`shop-page-${page.name}`}>
        <SubPage title={title} onBack={nav.back} testID="shop-sub">
          {shop && shop.paymentMode === 'demo' ? <TestBand /> : null}
          {body}
        </SubPage>
        {sheets}
        <Toast text={toast} testID="shop-toast" />
      </Screen>
    );
  }

  // ── 목록 ──────────────────────────────────────────────────────────
  const list = (data: ShopState) => {
    const sections = sectionsOf(data);
    const view = subViewOf(data);
    const using = view === 'active' || view === 'renew-off' || view === 'problem' || view === 'price-up';
    return (
      <>
        {data.paymentMode === 'demo' ? <TestBand /> : null}
        {view === 'problem' ? (
          <Card style={styles.problem} testID="shop-problem">
            <AppText variant="body" tone="text" testID="shop-problem-text">
              {SHOP16.payProblem}
            </AppText>
            <Button label={SHOP16.payProblemButton} variant="secondary" onPress={() => nav.push({ name: 'manage' })} testID="shop-problem-go" />
          </Card>
        ) : null}
        {shopClosed(data) && !sections.grade && !sections.threeMonth && !sections.match && sections.singles.length === 0 ? (
          // 상점 닫힘(D-65 ①): 서버는 이때 상품 목록을 비워 준다 → 구매 단추 자리 대신 한 줄 안내(카드가 있으면 카드마다 같은 글이 단추 자리에 온다)
          <Card testID="shop-closed">
            <AppText variant="body" tone="text" testID="shop-closed-text">
              {SHOP16.closed}
            </AppText>
          </Card>
        ) : null}
        {sections.grade ? (
          <GradeSubCard
            shop={data}
            product={sections.grade}
            view={view}
            onDetail={() => sections.grade && openProduct(sections.grade)}
            onMyGrade={() => nav.push({ name: 'grade' })}
            onManage={() => nav.push({ name: 'manage' })}
          />
        ) : null}
        {sections.threeMonth && !using ? <ThreeMonthCard shop={data} product={sections.threeMonth} /> : null}
        {sections.match ? (
          <MatchCard shop={data} product={sections.match} onDetail={() => sections.match && openProduct(sections.match)} onTake={openMatch} />
        ) : null}
        {sections.singles.length > 0 ? (
          <>
            <SectionTitle text={SHOP16.singleTitle} testID="shop-singles-title" />
            {sections.singles.map((p) => (
              <ProductRow key={p.key} product={p} shop={data} onOpen={() => openProduct(p)} />
            ))}
          </>
        ) : null}
        {freeZone}
        <Card style={styles.links} testID="shop-links">
          <LinkRow label={SHOP16.links.inventory} onPress={() => nav.push({ name: 'inventory' })} testID="shop-link-inventory" />
          <LinkRow label={SHOP16.links.refund} onPress={() => nav.push({ name: 'refund' })} testID="shop-link-refund" />
          <LinkRow label={SHOP16.links.seller} onPress={() => nav.push({ name: 'refund' })} last testID="shop-link-seller" />
        </Card>
      </>
    );
  };

  return (
    <Screen edges={['top']} enter="tab">
      <TabHeader title={SHOP.headerTitle} collapse={collapse} testID="shop-header" />
      <Animated.ScrollView contentContainerStyle={styles.content} onScroll={collapse.onScroll} scrollEventThrottle={16} testID="screen-16">
        {shop ? (
          list(shop)
        ) : phase === 'loading' ? (
          <Loading />
        ) : (
          <>
            <ErrorPanel kind={phase === 'network' ? 'network' : 'server'} onRetry={reload} />
            {freeZone}
          </>
        )}
      </Animated.ScrollView>
      {sheets}
      <Toast text={toast} testID="shop-toast" />
    </Screen>
  );
}

// 대기 단계표(F21 · D25 10-2 원칙 4): 0.3초 안 아무것도 → 카드 틀 뼈대 → 반짝임 → 10초 넘으면 멈춤 + 글. 가운데 큰 스피너 단독 0
function Loading() {
  return (
    <View style={styles.wait} accessible accessibilityLabel={COMMON.loading} accessibilityLiveRegion="polite" testID="shop-loading">
      <WaitState
        waiting
        skeleton={
          <View style={styles.waitCards}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        }
        note={<AppText variant="body" tone="sub">{COMMON.loading}</AppText>}
        testID="shop-wait"
      />
    </View>
  );
}

function ErrorPanel({ kind, onRetry }: { kind: 'network' | 'server'; onRetry: () => void }) {
  return (
    <View style={styles.center} testID="shop-error">
      {kind === 'network' ? <OfflineArt show /> : <StateArt source={STATE_ART.error15} size={layout.stateArt} testID="shop-error-art" />}
      <AppText variant="body" tone="text" accessibilityRole="alert" style={styles.centered} testID="shop-error-text">
        {kind === 'network' ? COMMON.offline : COMMON.server}
      </AppText>
      <Button label={COMMON.retry} variant="secondary" inline onPress={onRetry} testID="shop-retry" />
    </View>
  );
}

const styles = StyleSheet.create({
  wait: { minHeight: (layout.cardPhotoHeight + space.s24) * 2 + space.s12, alignSelf: 'stretch' }, // 뼈대 카드 두 장 높이(0.3초 안 빈칸에서도 자리를 지킨다)
  waitCards: { gap: space.s12 },
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s8, paddingBottom: space.s32, gap: space.s16 },
  problem: { gap: space.s12 },
  links: { padding: 0, overflow: 'hidden' },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12, padding: space.s16, borderBottomWidth: 1, borderBottomColor: colors.line },
  reportText: { flex: 1, minWidth: 0, gap: space.s8 },
  reportTitle: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingVertical: space.s40 },
  centered: { textAlign: 'center' },
});
