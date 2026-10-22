// F13 조건 1: 16 상점 — 무료 구역 · 등급 구독 카드(혜택 4줄 첫 줄) · 1회 매칭 카드 · 그 밖 상품(준비 중 · 보류) · 불러오는 중/오류 · 상품 상세 · 구매 확인(법정 문구 C1 · C2) · 완료 · 실패 · 복원 — 데모 결제로 끝까지
//  모의 서버(lib/shopDemo)를 실제 shopApi 위에서 돌리고 화면을 그린다. 장면은 이메일 앞부분으로 고른다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { COMMON } from '@/content/copy';
import { PRODUCT_COPY, RISK_REASONS, SHOP_DROPPED } from '@/content/productCopy';
import { BEFORE_BUY, GRADE16, REFUND_GUIDE, SHOP16 } from '@/content/shopCopy';
import { resetOpenRequestIds } from '@/features/shop/PurchaseSheet';
import { ShopScreen } from '@/features/shop/ShopScreen';
import type { ShopDeps } from '@/features/shop/shopTypes';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createGradeApi } from '@/lib/gradeApi';
import { createShopApi } from '@/lib/shopApi';
import { takeToast } from '@/lib/toastBus';
import { useChromeStore } from '@/store/chromeStore';
import { onHaptic } from '@/motion';

import { allTexts, find, has, hasText, isOpen, mount, must, press, textOf } from './renderHelpers';

jest.setTimeout(90_000);

const mockRouter = { setParams: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismiss: jest.fn() };
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ shopApi: {}, gradeApi: {}, profileApi: { facePhotoUrl: async () => null }, settingsApi: {}, recsApi: {}, likesApi: {}, supabase: {} }));

const START = Date.UTC(2026, 9, 16, 3, 0, 0); // 한국 시각 10월 16일 12:00 → 30일 뒤 11월 15일

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of shown.splice(0)) tree.unmount();
  });
});
beforeEach(() => {
  resetOpenRequestIds();
  jest.clearAllMocks();
  takeToast();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
});

let counter = 0;
async function setup(scene = 'plain', over: Partial<ShopDeps> | ((deps: ShopDeps) => Partial<ShopDeps>) = {}, before?: (deps: ShopDeps) => Promise<void>) {
  counter += 1;
  const backend = createDemoBackend({ now: () => START });
  const client = createDemoClient(backend);
  const email = `${scene}${counter}@email.co`;
  await backend.invoke('otp-gate', { body: { action: 'send', email } });
  await backend.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  let n = 0;
  const deps: ShopDeps = {
    api: createShopApi(client),
    grade: createGradeApi(client),
    now: () => START,
    newId: () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`,
    toastMs: 50,
    slowMs: 30_000,
  };
  Object.assign(deps, typeof over === 'function' ? over(deps) : over);
  if (before) await before(deps);
  const tree = await mount(<ShopScreen deps={deps} />);
  shown.push(tree);
  await flush();
  return { tree, deps, backend, email };
}
const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const tap = async (tree: ReactTestRenderer, id: string) => {
  await press(tree, id);
  await flush();
};

describe('조건 1 · 목록 (구독 전)', () => {
  test('테스트 화면 띠 · 등급 구독 카드: 혜택 4줄(첫 줄 "나보다 위 등급 분을 먼저 추천받기") · 가격 · 부가세 · 안내 · [자세히]', async () => {
    const { tree } = await setup();
    expect(has(tree, 'screen-16')).toBe(true);
    expect(textOf(tree, 'shop-test-band-text') ?? hasText(tree, SHOP16.testBand)).toBeTruthy();
    expect(hasText(tree, SHOP16.testBand)).toBe(true);
    expect(textOf(tree, 'shop-grade-name')).toBe('등급 구독');
    expect([0, 1, 2, 3].map((i) => textOf(tree, `shop-grade-benefit-${i}`))).toEqual([
      '나보다 위 등급 분을 먼저 추천받기',
      '추천에 뜬 분의 등급 보기(등급을 공개한 분만)',
      '등급 변화 기록 · 올리는 방법 · 인증으로 올리기',
      '내 등급과 항목별 기여를 앱에서 바로 보기',
    ]);
    expect(textOf(tree, 'shop-grade-price')).toBe('월 14,900원');
    expect(hasText(tree, '부가세 포함')).toBe(true);
    expect(textOf(tree, 'shop-grade-note')).toBe('결제는 내 등급을 올리지 않아요.');
    expect(has(tree, 'shop-grade-detail')).toBe(true);
    expect(has(tree, 'shop-grade-my')).toBe(false); // 구독 전에는 [내 등급 보기]가 없다
  });

  test('3개월권(N03)은 카드는 보이고 버튼은 "지금은 준비하지 않아요"(보류)', async () => {
    const { tree } = await setup();
    expect(textOf(tree, 'shop-three-name')).toBe('등급 구독 3개월');
    expect(textOf(tree, 'shop-three-line')).toBe('3개월 동안 등급 구독을 이용해요.');
    expect(must(tree, 'shop-three-held').props.label).toBe('지금은 준비하지 않아요');
    expect(must(tree, 'shop-three-held').props.dimmed).toBe(true);
  });

  test('1회 매칭 카드: 설명 · 가격 · 오늘 3명(NV50) · 안내(NV45)', async () => {
    const { tree } = await setup();
    expect(textOf(tree, 'shop-match-name')).toBe('1회 매칭');
    expect(textOf(tree, 'shop-match-line')).toBe('오늘 추천 목록에 3명을 더 보여 드려요.');
    expect(textOf(tree, 'shop-match-price')).toBe('4,900원 · 3명');
    expect(textOf(tree, 'shop-match-status')).toBe('오늘 3명을 더 보여 드릴 수 있어요.');
    expect(textOf(tree, 'shop-match-note')).toBe('구매해도 내 등급은 달라지지 않아요.');
    expect(has(tree, 'shop-match-take')).toBe(false); // 명분이 없으면 [지금 받기]가 없다
  });

  test('그 밖 상품 33줄: 서버 순서 그대로 · 이름은 카피 글(서버의 옛 이름이 아님) · 살 수 있는 것 외에는 준비 중 · 구독에 포함 · 무료', async () => {
    const { tree } = await setup();
    const rows = tree.root.findAll((n) => typeof n.props.testID === 'string' && /^shop-row-[A-Z]\d+$/.test(n.props.testID));
    const ids = [...new Set(rows.map((n) => (n.props.testID as string).replace('shop-row-', '')))];
    expect(ids).toHaveLength(33); // S19(D-122): 40 → 33
    expect(ids.slice(0, 3)).toEqual(['G1', 'G2', 'G3']); // 서버 순서
    expect(ids).not.toContain('N01');
    expect(ids).not.toContain('N02');
    expect(ids).not.toContain('N03');
    expect(ids).not.toContain('N04');
    expect(ids).not.toContain('N07'); // D-62: 뺀 상품
    expect(ids).not.toContain('G9'); // D-85: 뺀 상품
    expect(ids).not.toContain('N14'); // D-85: 뺀 상품
    for (const id of ['X12', 'X13', 'X15', 'X16', 'X17', 'X18', 'N15']) expect(ids).not.toContain(id); // D-122: 내린 카드 7개
    // 이름 · 한 줄 · 가격 표기가 카피 16-B 와 같다(서버 이름 '등급 분포 속 내 위치(상위 %)' 가 아니라 카피 이름)
    for (const copy of PRODUCT_COPY.filter((p) => !['N01', 'N02', 'N03', ...SHOP_DROPPED].includes(p.id))) {
      expect(textOf(tree, `shop-row-name-${copy.id}`)).toBe(copy.name);
      expect(textOf(tree, `shop-row-line-${copy.id}`)).toBe(copy.line);
      expect(textOf(tree, `shop-row-price-${copy.id}`)).toBe(copy.price);
    }
    expect(textOf(tree, 'shop-row-name-N11')).toBe('내 등급 자리 보기');
    expect(has(tree, 'shop-row-soon-G3')).toBe(true);
    expect(must(tree, 'shop-row-soon-G3').props.label).toBe('준비 중이에요');
    expect(has(tree, 'shop-row-included-G5')).toBe(true);
    expect(textOf(tree, 'shop-row-price-G5')).toBe('구독에 포함');
    expect(has(tree, 'shop-row-free-N08')).toBe(true);
    expect(has(tree, 'shop-row-soon-G1')).toBe(false); // 살 수 있는 상품에는 준비 중 칩이 없다
  });

  test('테스트 화면: 위험 C 상품 20개에 빨간 라벨(NV57) + 카피 이유 한 줄(N16 은 D-85 로 C — 카피 16-C 이유 줄이 생기기 전에는 라벨만)', async () => {
    const { tree } = await setup();
    // 카드 둘(N01 · N02) + 상품 줄. D-122 로 내린 7개(모두 C)는 이유 줄이 카피 대조용으로 남아 있어도 화면에 없다
    expect(textOf(tree, 'shop-grade-risk-reason')).toBe(RISK_REASONS.N01);
    expect(textOf(tree, 'shop-match-risk-reason')).toBe(RISK_REASONS.N02);
    const rowIds = Object.keys(RISK_REASONS).filter((id) => id !== 'N01' && id !== 'N02' && !SHOP_DROPPED.includes(id));
    expect(rowIds).toHaveLength(17);
    for (const id of ['X12', 'X13', 'X15', 'X16', 'X17', 'X18', 'N15']) expect(has(tree, `shop-row-risk-${id}`)).toBe(false);
    for (const id of rowIds) expect(textOf(tree, `shop-row-risk-${id}-reason`)).toBe(RISK_REASONS[id]);
    expect(has(tree, 'shop-row-risk-N16')).toBe(true); // D-85: N16 프로필 꾸미기 빨간 라벨
    expect(has(tree, 'shop-row-risk-N16-reason')).toBe(RISK_REASONS.N16 !== undefined);
    expect(has(tree, 'shop-row-risk-G1')).toBe(false); // 위험 A 는 라벨이 없다
    expect(allTexts(tree).filter((t) => t === SHOP16.riskLabel)).toHaveLength(20);
  });

  test('④ 무료로 볼 수 있어요: 내 성향 리포트(무료) · 등급은 어떻게 정해지나요? · 내 등급 알려 주세요 + ⑤ 링크 3', async () => {
    const { tree } = await setup();
    expect(hasText(tree, '무료로 볼 수 있어요')).toBe(true);
    expect(textOf(tree, 'shop-report-title')).toBe('내 성향 리포트');
    expect(hasText(tree, '무료')).toBe(true);
    expect(must(tree, 'shop-free-how').props.label).toBe('등급은 어떻게 정해지나요?');
    expect(must(tree, 'shop-free-access').props.label).toBe('내 등급 알려 주세요');
    expect(must(tree, 'shop-link-inventory').props.label).toBe('내 이용권 · 구매 내역');
    expect(must(tree, 'shop-link-refund').props.label).toBe('결제 · 환불 안내');
    expect(must(tree, 'shop-link-seller').props.label).toBe('판매자 정보');
  });

  test('목록 글에 금지어가 없다: 순위 · 퍼센트 · % · 인기 · 상위 · 하위 · 최고 · 등수 · 결혼 · 중매 · 주선 · 보장 · 매니저 · 정회원 · 가입비 · 회비', async () => {
    const { tree } = await setup();
    const all = allTexts(tree).join(' ');
    expect(all).not.toMatch(/순위|퍼센트|%|인기|상위|하위|최고|등수|결혼|중매|주선|맞선|성혼|보장|매니저|정회원|가입비|회비|배우자/);
    expect(all.match(/매칭/g)?.length).toBeGreaterThan(0);
    // '매칭'은 상품 이름 '1회 매칭' 자리에서만 나온다
    for (const text of allTexts(tree)) if (text.includes('매칭')) expect(text).toMatch(/1회 매칭/);
  });
});

describe('조건 1 · 불러오는 중 · 오류', () => {
  test('불러오는 동안 "불러오는 중이에요", 읽기 실패(server)는 공통 오류 + 무료 구역은 그대로 + [다시 시도]', async () => {
    let release!: (v: unknown) => void;
    const slow = new Promise((resolve) => (release = resolve));
    const { tree: loading } = await setup('plain', (deps) => ({ api: { ...deps.api, loadShop: () => slow as never } as ShopDeps['api'] }));
    expect(has(loading, 'shop-loading')).toBe(true);
    // F21 대기 단계표: 처음 0.3초는 빈 자리 — 스크린리더에는 "불러오는 중이에요"를 알린다
    expect(find(loading, 'shop-loading')?.props.accessibilityLabel).toBe(COMMON.loading);
    release({ ok: false, reason: 'server' });
    await flush();
    expect(has(loading, 'shop-loading')).toBe(false);
    expect(has(loading, 'shop-error')).toBe(true);

    const { tree } = await setup('shopfail');
    expect(textOf(tree, 'shop-error-text')).toBe(COMMON.server);
    expect(has(tree, 'shop-free')).toBe(true); // 상품을 못 읽어도 무료 구역은 보인다
    expect(has(tree, 'shop-card-grade')).toBe(false);
  });

  test('인터넷 끊김: 공통 오류 + 끊김 그림, [다시 시도]로 다시 읽으면 목록이 뜬다', async () => {
    const { tree } = await setup('shopflaky');
    expect(textOf(tree, 'shop-error-text')).toBe(COMMON.offline);
    expect(has(tree, 'offline-art')).toBe(true);
    await tap(tree, 'shop-retry');
    expect(has(tree, 'shop-error')).toBe(false);
    expect(has(tree, 'shop-card-grade')).toBe(true);
  });

  test('켜진 상품 0개: 무료 구역만 있고 빈 화면은 아니다', async () => {
    const { tree } = await setup('shopzero');
    expect(has(tree, 'shop-card-grade')).toBe(false);
    expect(has(tree, 'shop-free')).toBe(true);
    expect(has(tree, 'shop-error')).toBe(false);
  });
});

describe('조건 1 · 구독 중 카드', () => {
  test('이용 중: 상태 글(NV08) · [내 등급 보기] · [등급 구독 관리] · 3개월 카드는 숨김', async () => {
    const { tree } = await setup('shopsub');
    expect(textOf(tree, 'shop-grade-status')).toBe('이용 중 · 11월 7일에 갱신돼요'); // 22일 뒤
    expect(has(tree, 'shop-grade-my')).toBe(true);
    expect(has(tree, 'shop-grade-manage')).toBe(true);
    expect(has(tree, 'shop-grade-benefits')).toBe(false);
    expect(has(tree, 'shop-card-three')).toBe(false);
    expect(has(tree, 'shop-problem')).toBe(false);
  });

  test('갱신 꺼짐(NV09) · 결제 문제 띠(NV10) · 가격 인상 대기', async () => {
    const off = await setup('shopoff');
    expect(textOf(off.tree, 'shop-grade-status')).toBe('10월 25일까지 이용할 수 있어요');
    const grace = await setup('shopgrace');
    expect(textOf(grace.tree, 'shop-problem-text')).toBe(SHOP16.payProblem);
    await tap(grace.tree, 'shop-problem-go');
    expect(has(grace.tree, 'manage-body')).toBe(true);
    const up = await setup('shopprice');
    await tap(up.tree, 'shop-grade-manage');
    expect(has(up.tree, 'manage-price-up')).toBe(true);
  });
});

describe('조건 1 · 상품 상세 → 구매 확인 → 데모 결제 → 완료 (등급 구독)', () => {
  test('상세: 선택지 1개월 · 3개월(보류) · 고르기 전 [구매하기] 비활성 · 공정성 안내 · 구매 전 확인(C1) 글자 그대로 · 판매자 정보', async () => {
    const { tree } = await setup();
    await tap(tree, 'shop-grade-detail');
    expect(has(tree, 'shop-page-product')).toBe(true);
    expect(useChromeStore.getState().tabBarHidden).toBe(true); // 하위 쪽은 탭바가 없다
    expect(has(tree, 'profile-button')).toBe(false); // 원형 사진도 없다
    expect(textOf(tree, 'detail-name')).toBe('등급 구독');
    expect(textOf(tree, 'detail-fair')).toBe('결제는 내 등급을 올리지 않아요.');
    expect(has(tree, 'detail-option-1m')).toBe(true);
    expect(has(tree, 'detail-option-3m')).toBe(true);
    expect(must(tree, 'detail-buy').props.dimmed).toBe(true); // 미리 골라 두지 않는다(V-R3)
    for (const line of BEFORE_BUY.grade.filter((l) => l.label !== '환불')) expect(hasText(tree, line.text)).toBe(true);
    expect(hasText(tree, '내용: 나보다 위 등급 분을 먼저 추천받고') || allTexts(tree).some((t) => t.includes('1등급이면 1등급 분을 먼저 추천받아요.'))).toBeTruthy();
    expect(hasText(tree, BEFORE_BUY.grade[1].text)).toBe(true);
    expect(allTexts(tree).some((t) => t.includes('{운영자 상호 또는 성명}'))).toBe(false); // Q5A-03: 비워 둔 판매자 값은 변수 글을 숨기고 '준비 중' 한 줄
    expect(allTexts(tree).some((t) => t.includes('판매자 정보는 준비 중이에요'))).toBe(true);
    expect(must(tree, 'detail-docs-link').props.accessibilityLabel).toBe('이용약관 · 개인정보 처리방침');
  });

  test('1개월을 고르고 [구매하기] → 16-3 "이대로 구매할까요?" → [결제하기] → 16-D "데모 결제예요…" → [데모로 구매] → 완료 → 구독 중', async () => {
    const { tree, backend, email } = await setup();
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    expect(must(tree, 'detail-buy').props.dimmed).toBeFalsy();
    await tap(tree, 'detail-buy');
    expect(isOpen(tree, 'purchase-sheet')).toBe(true);
    expect(textOf(tree, 'purchase-title')).toBe('이대로 구매할까요?');
    expect(textOf(tree, 'purchase-price')).toContain('월 14,900원');
    expect(hasText(tree, `철회: ${BEFORE_BUY.grade[4].text}`)).toBe(true);
    await tap(tree, 'purchase-pay');
    expect(textOf(tree, 'purchase-demo-title')).toBe('데모 결제예요. 돈은 나가지 않아요.');
    expect(backend.peek.shop(email)?.sub).toBeNull(); // 아직 아무것도 지급되지 않았다
    const heard: string[] = [];
    const off = onHaptic((k) => heard.push(k));
    await tap(tree, 'purchase-demo-buy');
    expect(textOf(tree, 'purchase-done-text')).toBe('등급 구독을 시작했어요. 다음 결제일은 11월 15일이에요.');
    expect(has(tree, 'purchase-done-art')).toBe(true); // F17: 체크 그림 대신 로고 타일이 찍힌다(D31)
    expect(has(tree, 'purchase-done-art-tile')).toBe(true);
    expect(heard).toEqual(['success']); // 지급이 확인된 순간 Success 한 번(D25 4장)
    off();
    expect(backend.peek.shop(email)?.sub).toMatchObject({ status: 'active', productKey: 'grade_sub_1m' });
    await tap(tree, 'purchase-done-ok');
    expect(isOpen(tree, 'purchase-sheet')).toBe(false);
    // 상세도 이용 중으로 바뀌고 [구매하기] 대신 [등급 구독 관리]
    expect(has(tree, 'detail-buy')).toBe(false);
    expect(has(tree, 'detail-manage')).toBe(true);
  });

  test('취소하면 아무것도 지급되지 않는다', async () => {
    const { tree, backend, email } = await setup();
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-cancel');
    expect(backend.peek.shop(email)?.sub).toBeNull();
  });

  test('결제 확인 중(NV16)은 시트를 닫을 수 없고, 30초를 넘기면 NV17 + [확인]', async () => {
    let release!: (v: unknown) => void;
    const demoPurchase = jest.fn(() => new Promise((resolve) => (release = resolve)));
    const { tree } = await setup('plain', (deps) => ({ slowMs: 20, api: { ...deps.api, demoPurchase } as ShopDeps['api'] }));
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    await act(async () => void must(tree, 'purchase-demo-buy').props.onPress?.()); // 끝나기를 기다리지 않는다
    expect(textOf(tree, 'purchase-checking-text')).toBe('결제를 확인하고 있어요');
    expect(has(tree, 'purchase-slow')).toBe(false);
    must(tree, 'purchase-sheet').props.onRequestClose?.(); // Android 뒤로가기도 닫지 못한다
    expect(isOpen(tree, 'purchase-sheet')).toBe(true);
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 60))));
    expect(textOf(tree, 'purchase-slow')).toBe('확인이 늦어지고 있어요. 결제가 끝났다면 잠시 뒤 자동으로 반영돼요.');
    await act(async () => release({ ok: true, data: { kind: 'granted' } }));
    await flush();
    expect(demoPurchase).toHaveBeenCalledTimes(1);
    expect(has(tree, 'purchase-done')).toBe(true);
  });
});

describe('조건 1 · 실패 · 제한 · 미리보기', () => {
  test('Q5A-10: 실패 뒤 시트를 닫았다가 같은 상품을 다시 사도 같은 요청 ID', async () => {
    const calls: string[] = [];
    const { tree } = await setup('payfail', (deps) => {
      const real = deps.api;
      return { api: { ...real, demoPurchase: async (key: string, id: string) => (calls.push(id), real.demoPurchase(key, id)) } as ShopDeps['api'] };
    });
    for (let i = 0; i < 2; i++) {
      await tap(tree, i === 0 ? 'shop-grade-detail' : 'detail-buy');
      if (i === 0) await tap(tree, 'detail-option-1m');
      if (i === 0) await tap(tree, 'detail-buy');
      await tap(tree, 'purchase-pay');
      await tap(tree, 'purchase-demo-buy');
      await tap(tree, 'purchase-failed-close');
    }
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBe(calls[1]);
  });

  test('결제 실패(server): NV22 + [다시 시도]는 같은 요청 ID 로 다시 보낸다 · [닫기]', async () => {
    const calls: string[] = [];
    const { tree } = await setup('payfail', (deps) => {
      const real = deps.api;
      return { api: { ...real, demoPurchase: async (key: string, id: string) => (calls.push(id), real.demoPurchase(key, id)) } as ShopDeps['api'] };
    });
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    await tap(tree, 'purchase-demo-buy');
    expect(textOf(tree, 'purchase-failed-text')).toBe('결제가 끝나지 않았어요. 다시 시도해 주세요.');
    expect(has(tree, 'purchase-failed-art')).toBe(true);
    await tap(tree, 'purchase-failed-retry');
    expect(textOf(tree, 'purchase-failed-text')).toBe('결제가 끝나지 않았어요. 다시 시도해 주세요.');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBe(calls[1]); // 같은 요청 ID
    await tap(tree, 'purchase-failed-close');
    expect(isOpen(tree, 'purchase-sheet')).toBe(false);
  });

  test('구매 제한: 연령(NV31)', async () => {
    const { tree } = await setup('shopage');
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    expect(textOf(tree, 'purchase-blocked-text')).toBe(SHOP16.ageLimit);
  });

  test('이미 이용 중인데 구매를 시작하면(다른 기기에서 산 경우) "이미 등급 구독을 이용하고 있어요." + [등급 구독 관리]', async () => {
    const { tree, deps } = await setup('plain');
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await deps.api.demoPurchase('grade_sub_1m', 'other-device-id-000000000000'.padEnd(36, '0')); // 다른 기기에서 먼저 산 것
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    expect(textOf(tree, 'purchase-blocked-text')).toBe('이미 등급 구독을 이용하고 있어요.');
    await tap(tree, 'purchase-blocked-manage');
    expect(has(tree, 'manage-body')).toBe(true);
  });

  test('준비 중 상품은 테스트 화면에서 열려 [구매하기] → 데모 결제 → 미리보기 안내(NV58), 지급 0', async () => {
    const { tree, backend, email } = await setup();
    await tap(tree, 'shop-row-G3');
    expect(textOf(tree, 'detail-name')).toBe('깊은 성향 리포트');
    expect(textOf(tree, 'detail-fair')).toBeNull(); // NV13 은 단품(열람권 · 편지)에만 — 리포트는 C3 대상이 아니라 아래에서 따로
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    await tap(tree, 'purchase-demo-buy');
    expect(textOf(tree, 'purchase-preview-text')).toBe('이 기능은 아직 만들지 않았어요. 어떤 상품인지 보여 주는 미리보기예요.');
    expect(backend.peek.shop(email)?.credits.report).toBe(0);
  });

  test('실결제 모드(live)에서는 준비 중 줄이 눌리지 않고, 구매를 시작해도 "지금은 이 상품을 살 수 없어요."로 끝나며 띠 · 빨간 라벨도 없다', async () => {
    const { tree, backend, email } = await setup('shoplive');
    expect(has(tree, 'shop-test-band')).toBe(false);
    expect(allTexts(tree).filter((t) => t === SHOP16.riskLabel)).toHaveLength(0);
    expect(find(tree, 'shop-row-G3')?.props.onPress).toBeUndefined();
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    expect(textOf(tree, 'purchase-blocked-text')).toBe(SHOP16.notSellable);
    expect(backend.peek.shop(email)?.sub).toBeNull();
  });

  test('등급 구독 상세의 빨간 라벨 · 이유 문장은 테스트 화면(demo)에만 있고 실사용자(live)에는 둘 다 없다(D-50)', async () => {
    const demo = await setup();
    await tap(demo.tree, 'shop-grade-detail');
    expect(has(demo.tree, 'detail-risk')).toBe(true);
    expect(allTexts(demo.tree).some((t) => t === SHOP16.riskLabel)).toBe(true);
    expect(allTexts(demo.tree).some((t) => t.includes('법무 검토는 앱 완성 뒤예요'))).toBe(true);
    const live = await setup('shoplive');
    await tap(live.tree, 'shop-grade-detail');
    expect(has(live.tree, 'detail-risk')).toBe(false);
    expect(allTexts(live.tree).some((t) => t === SHOP16.riskLabel)).toBe(false);
    expect(allTexts(live.tree).some((t) => t.includes('법무 검토는 앱 완성 뒤예요'))).toBe(false);
  });

  test('단품(지난 추천 열람권) 상세: NV13 · C3 철회 · 구매 → "지난 추천 열람권 1장이 들어왔어요."', async () => {
    const { tree } = await setup();
    await tap(tree, 'shop-row-G1');
    expect(textOf(tree, 'detail-fair')).toBe('이 상품을 사도 추천 순서나 다른 분에게 보이는 내 모습은 달라지지 않아요.');
    expect(hasText(tree, BEFORE_BUY.single[0].text)).toBe(true);
    expect(textOf(tree, 'detail-seller')).toBe('판매자 정보는 준비 중이에요.'); // Q5A-03
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    await tap(tree, 'purchase-demo-buy');
    expect(textOf(tree, 'purchase-done-text')).toBe('지난 추천 열람권 1장이 들어왔어요.');
  });
});

describe('조건 1 · 이용권 · 복원 · 환불 안내 · 구독 관리', () => {
  test('16-8 이용권: 편지 1통 · 복원(없음) · 복원(구독 있음) · 빈 이용권', async () => {
    const { tree, deps } = await setup();
    await tap(tree, 'shop-link-inventory');
    expect(has(tree, 'inventory-empty')).toBe(true);
    expect(textOf(tree, 'inventory-empty')).toBe('남은 이용권이 없어요.');
    await tap(tree, 'inventory-restore');
    expect(isOpen(tree, 'restore-sheet')).toBe(true);
    expect(textOf(tree, 'restore-text')).toBe('다시 연결할 구매가 없어요. 이용권은 계정에 저장돼 있어 그대로예요.');
    await tap(tree, 'restore-ok');
    expect(isOpen(tree, 'restore-sheet')).toBe(false);
    await deps.api.demoPurchase('grade_sub_1m', '22222222-2222-4222-8222-222222222222');
    await tap(tree, 'inventory-restore');
    expect(textOf(tree, 'restore-text')).toBe('다시 연결할 구매가 없어요. 이용권은 계정에 저장돼 있어 그대로예요.'); // S8d: 이미 연결돼 있으면 nothing_to_restore
  });

  test('16-8 구매 내역(S8d list_my_purchases) · 16-9 복원: 구독 거래는 있는데 연결이 없는 계정은 "다시 연결했어요"(NV29)', async () => {
    const { tree } = await setup('shoprestore');
    await tap(tree, 'shop-link-inventory');
    expect(textOf(tree, 'inventory-tx-name-demo-tx-seed-restore')).toBe('등급 구독');
    expect(textOf(tree, 'inventory-tx-line-demo-tx-seed-restore')).toMatch(/^\d+월 \d+일 · 14,900원$/);
    expect(has(tree, 'inventory-sub')).toBe(false);
    await tap(tree, 'inventory-restore');
    expect(textOf(tree, 'restore-text')).toBe('등급 구독을 다시 연결했어요.');
    await tap(tree, 'restore-ok');
    expect(has(tree, 'inventory-sub')).toBe(true); // 연결이 살아나 구독 카드가 보인다
  });

  test('16-8 구매 내역이 없으면 빈 글 · 복원 호출이 실패하면 실패 글', async () => {
    const empty = await setup();
    await tap(empty.tree, 'shop-link-inventory');
    expect(has(empty.tree, 'inventory-history-empty')).toBe(true);
    const bad = await setup('restfail');
    await tap(bad.tree, 'shop-link-inventory');
    await tap(bad.tree, 'inventory-restore');
    expect(textOf(bad.tree, 'restore-text')).toBe('잠시 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.');
  });

  test('16-10 결제 · 환불 안내: 법무 C4 일곱 줄 + 판매자 정보', async () => {
    const { tree } = await setup();
    await tap(tree, 'shop-link-refund');
    expect(has(tree, 'refund-body')).toBe(true);
    REFUND_GUIDE.lines.forEach((line, i) => expect(textOf(tree, `refund-line-${i}`)).toBe(line));
    expect(textOf(tree, 'refund-seller')).toBe('판매자 정보는 준비 중이에요.'); // Q5A-03: 값이 비면 변수 글 대신 준비 중
  });

  test('16-12 구독 관리(테스트 화면): [구독 관리] → 테스트 단추 → 지금 끝내기 → 끝남(NV65) → [다시 시작]은 상세로', async () => {
    const { tree } = await setup('shopsub');
    await tap(tree, 'shop-grade-manage');
    expect(textOf(tree, 'manage-status')).toBe('이용 중 · 11월 7일에 갱신돼요');
    expect(has(tree, 'manage-test')).toBe(false);
    await tap(tree, 'manage-store');
    expect(has(tree, 'manage-test')).toBe(true);
    await tap(tree, 'manage-test-cancel');
    expect(textOf(tree, 'manage-renew-off')).toBe('11월 7일까지 등급을 볼 수 있어요. 그 뒤에는 잠겨요.');
    await tap(tree, 'manage-test-expire');
    expect(textOf(tree, 'manage-ended')).toBe(SHOP16.endedSub);
    await tap(tree, 'manage-restart');
    expect(has(tree, 'detail-option-1m')).toBe(true);
  });
});

describe('조건 4 · 1회 매칭 구매 → 사용 → 09', () => {
  test('상세에서 [구매하기] → 데모 결제 → 완료 [지금 받기] → "지금 3명을 받을까요?" → [받기] → 09 로 이동 + 토스트 NV62', async () => {
    const { tree, backend, email } = await setup();
    await tap(tree, 'shop-match-detail');
    expect(textOf(tree, 'detail-name')).toBe('1회 매칭');
    expect(textOf(tree, 'detail-fair')).toBe('구매해도 내 등급은 달라지지 않아요.');
    expect(textOf(tree, 'detail-match-status')).toBe('오늘 3명을 더 보여 드릴 수 있어요.');
    expect(hasText(tree, BEFORE_BUY.match[1].text)).toBe(true);
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    await tap(tree, 'purchase-demo-buy');
    expect(textOf(tree, 'purchase-done-text')).toBe('1회 매칭 3명분이 들어왔어요.');
    expect(backend.peek.shop(email)?.credits.match_slot).toBe(3);
    await tap(tree, 'purchase-done-take');
    expect(isOpen(tree, 'match-sheet')).toBe(true);
    expect(textOf(tree, 'match-confirm-text')).toBe('지금 3명을 받을까요? 받은 분들은 오늘 하루 볼 수 있어요.');
    await tap(tree, 'match-take');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/recommendations');
    expect(takeToast()).toBe('3명을 더 보여 드렸어요.');
    expect(backend.peek.shop(email)).toMatchObject({ credits: { match_slot: 0 }, matchUses: [{ added: 3 }] });
  });

  test('남은 명분이 있으면 목록 카드에 NV60 + [지금 받기], 하루 2번을 다 쓰면 NV59 로 막힌다', async () => {
    const { tree } = await setup('moslot');
    expect(textOf(tree, 'shop-match-status')).toBe('1회 매칭 3명분이 남아 있어요.');
    await tap(tree, 'shop-match-take');
    await tap(tree, 'match-take');
    expect(takeToast()).toBe('3명을 더 보여 드렸어요.');
    // 두 번 쓴 계정으로 열면 막혀 있다
    const second = await setup('moslot', {}, async (deps) => {
      await deps.api.useMatchOnce('33333333-3333-4333-8333-333333333333');
      await deps.api.demoPurchase('match_once', '44444444-4444-4444-8444-444444444444');
      await deps.api.useMatchOnce('55555555-5555-4555-8555-555555555555');
    });
    expect(textOf(second.tree, 'shop-match-status')).toBe('1회 매칭은 하루 2번까지예요. 내일 09:00에 다시 쓸 수 있어요.');
    expect(has(second.tree, 'shop-match-take')).toBe(false);
    await tap(second.tree, 'shop-match-detail');
    expect(textOf(second.tree, 'detail-match-status')).toBe('1회 매칭은 하루 2번까지예요. 내일 09:00에 다시 쓸 수 있어요.');
    expect(must(second.tree, 'detail-buy').props.dimmed).toBe(true);
  });

  test('오늘 2명뿐(mopart): NV50b 안내 · 구매 뒤 "지금 2명을 받을까요?" · 받으면 09 로 + 남은 1명분은 카드에 남는다', async () => {
    const { tree, backend, email } = await setup('mopart');
    expect(textOf(tree, 'shop-match-status')).toBe('오늘은 2명만 보여 드릴 수 있어요. 나머지 1명분은 이용권으로 남아 다음에 쓸 수 있어요.');
    await tap(tree, 'shop-match-detail');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    await tap(tree, 'purchase-demo-buy');
    await tap(tree, 'purchase-done-take');
    expect(textOf(tree, 'match-confirm-text')).toBe('지금 2명을 받을까요? 받은 분들은 오늘 하루 볼 수 있어요.');
    await tap(tree, 'match-take');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/recommendations');
    expect(takeToast()).toBe('2명을 더 보여 드렸어요.');
    expect(backend.peek.shop(email)?.credits.match_slot).toBe(1); // 받은 수만큼만 차감
  });

  test('못 채움(mofew): 3명을 받으려는데 2명만 나오면 시트에서 "2명을 더 보여 드렸어요." + NV50b(나머지 1명분)를 보여 주고 확인하면 09 로', async () => {
    const { tree, backend, email } = await setup('mofew', {}, async (deps) => void (await deps.api.demoPurchase('match_once', '66666666-6666-4666-8666-666666666666')));
    await tap(tree, 'shop-match-take');
    expect(textOf(tree, 'match-confirm-text')).toBe('지금 3명을 받을까요? 받은 분들은 오늘 하루 볼 수 있어요.');
    await tap(tree, 'match-take');
    expect(textOf(tree, 'match-partial-done')).toBe('2명을 더 보여 드렸어요.');
    expect(textOf(tree, 'match-partial-note')).toBe('오늘은 2명만 보여 드릴 수 있어요. 나머지 1명분은 이용권으로 남아 다음에 쓸 수 있어요.');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await tap(tree, 'match-partial-ok');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/recommendations');
    expect(takeToast()).toBe('2명을 더 보여 드렸어요.');
    expect(backend.peek.shop(email)).toMatchObject({ credits: { match_slot: 1 }, matchUses: [{ added: 2 }] });
  });

  test('오늘 0명이면 NV21 · 구매 버튼 비활성', async () => {
    const { tree } = await setup('monone');
    expect(textOf(tree, 'shop-match-status')).toBe('오늘은 더 보여 드릴 분이 없어요.');
    await tap(tree, 'shop-match-detail');
    expect(must(tree, 'detail-buy').props.dimmed).toBe(true);
  });
});

describe('다른 화면에서 쪽을 바로 열기 · 탭바 · 목록으로 돌아오기', () => {
  test('주소 값 page=product&key=grade_sub_1m 이면 상세가 바로 열리고, 값은 주소에서 지운다', async () => {
    mockParams.page = 'product';
    mockParams.key = 'grade_sub_1m';
    const { tree } = await setup();
    expect(has(tree, 'shop-page-product')).toBe(true);
    expect(textOf(tree, 'detail-name')).toBe('등급 구독');
    expect(mockRouter.setParams).toHaveBeenCalledWith({ page: undefined, key: undefined, from: undefined });
  });

  test('Q5A-14 · F18: 10 이 연 상세(from=10)의 ‹ 는 탭의 뒤로(09)가 아니라 쌓인 탭 묶음을 걷어 10 으로 — 진짜 router 흐름은 f18Back.test', async () => {
    mockParams.page = 'product';
    mockParams.key = 'grade_sub_1m';
    mockParams.from = '10';
    const { tree } = await setup();
    expect(has(tree, 'shop-page-product')).toBe(true);
    await tap(tree, 'shop-sub-header-back');
    expect(mockRouter.dismiss).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test('F18: 12 가 연 쪽(from=12)의 ‹ 는 설정 탭으로 · 모르는 from 은 상점 안 뒤로(목록)', async () => {
    mockParams.page = 'inventory';
    mockParams.from = '12';
    const { tree } = await setup();
    expect(has(tree, 'shop-page-inventory')).toBe(true);
    await tap(tree, 'shop-sub-header-back');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
    expect(mockRouter.back).not.toHaveBeenCalled();
    mockParams.page = 'inventory';
    mockParams.from = 'outside';
    const other = await setup();
    await tap(other.tree, 'shop-sub-header-back');
    expect(has(other.tree, 'screen-16')).toBe(true);
    expect(mockRouter.dismiss).not.toHaveBeenCalled();
  });

  test('‹ 로 목록으로 돌아오면 탭바 표시를 다시 켠다', async () => {
    const { tree } = await setup();
    expect(useChromeStore.getState().tabBarHidden).toBe(false);
    await tap(tree, 'shop-link-refund');
    expect(useChromeStore.getState().tabBarHidden).toBe(true);
    await tap(tree, 'shop-sub-header-back');
    expect(has(tree, 'screen-16')).toBe(true);
    expect(useChromeStore.getState().tabBarHidden).toBe(false);
  });

  test('등급 말(GRADE16)이 상점 목록에 새지 않는다: 비구독자 목록에 "N등급" 값 · 자물쇠가 없다', async () => {
    const { tree } = await setup();
    expect(allTexts(tree).join(' ')).not.toMatch(/\d등급/);
    expect(hasText(tree, GRADE16.title)).toBe(false);
  });
});
