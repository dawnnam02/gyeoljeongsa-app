// QF2-B6 — 마일리지 D-244(서버 0058 · Q2-17): 내역 사유 글 8줄(글표 11장 Q2-D244-01 ~ 08) · 새 차감 키 받기 · 탑승권 구매 시트의 포함분 한 줄(Q2-D244-09)
//  보는 것: 옛 '탑승 적립'과 '탑승권 포함분'이 한 줄에 같이 나오지 않는다 · 회수 줄은 거뒀다고 말하고 쓴 몫은 그대로라고 밝힌다 · 포함분이 없으면 안내 한 줄도 없다 ·
//  구매 시트 한 줄은 서버 값이 있을 때만(없으면 줄째 없음) · 크레딧만으로 타는 시트(결제 닫힘) · 리허설 회차(서버 값 0)에는 없다 · 연애 풀이 화면은 만들지 않는다
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { createBoardingApi, parseTicketState, type BoardingApi, type BoardingState } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import type { LedgerEdge } from '@/features/mileage/ledgerEdge';
import { isMileageFeature, MILEAGE_FEATURES, parseHistory, parseMileageState, type HistoryItem, type MileageApi } from '@/features/mileage/mileageApi';
import { bundleKeys, costOf, hasBundle, priceRows } from '@/features/mileage/mileageLogic';
import { MileageLogScreen, rowLabel } from '@/features/mileage/MileageLogScreen';
import type { MileageDeps } from '@/features/mileage/mileageService';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';

import fs from 'node:fs';
import path from 'node:path';

import { allTexts, has, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]), Redirect: () => null };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: async () => null }, likesApi: {}, recsApi: {}, gradeApi: {}, aiApi: {}, authApi: {}, supabase: {} }));
jest.mock('@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ flags: { loaded: true }, isOn: () => true }) }));
jest.setTimeout(90_000);

const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  jest.clearAllMocks();
});

// ── 1. 내역 사유 8줄 ─────────────────────────────────────────────────────────
const item = (id: number, over: Partial<HistoryItem>): HistoryItem => ({ id, at: '2026-12-23T09:00:00Z', kind: 'gift', amount: 1000, feature: null, state: null, reason: null, ...over });
const ITEMS: HistoryItem[] = [
  item(5, { kind: 'recovered', amount: -8040, reason: 'bundle_cancel' }), // 판매 마감 전 취소 — 8,700 중 660 쓰고 취소 → −8,040 (서버 시험 D1)
  item(4, { kind: 'recovered', amount: -8300, reason: 'bundle_refund', at: '2026-12-22T09:00:00Z' }), // 스토어 환불 — 400 쓰고 환불 → −8,300 (D2)
  item(3, { kind: 'boarding', amount: 8700, reason: 'bundle', at: '2026-12-21T09:00:00Z' }),
  item(2, { kind: 'boarding', amount: 200, reason: null, at: '2026-12-20T09:00:00Z' }), // 옛 탑승 적립(0058 뒤에는 더 지급하지 않음 — 이미 쌓인 옛 줄)
  item(1, { kind: 'gift', amount: 1000, at: '2026-12-19T09:00:00Z' }),
];

function logDeps(items: HistoryItem[]): MileageDeps {
  const api: MileageApi = {
    state: async () => ({ ok: true, data: { paid: 0, free: 9000, total: 9000, held: 0, chargeLocked: false, products: [], costs: [], rules: { confirmFrom: 300, freeChars: 1000, stepChars: 1000, stepCost: 70 } } }),
    history: async () => ({ ok: true, data: { items, next: null } }),
    cost: async () => ({ ok: false, code: 'unknown_feature' }),
    charge: async () => ({ ok: false, code: 'forbidden' }),
  };
  return { api, edge: {} as LedgerEdge, isOn: () => true };
}
const itemTexts = (tree: ReactTestRenderer, id: number): string[] => {
  const row = must(tree, `mileage-log-item-${id}`);
  return row.findAll((n) => typeof n.props.children === 'string' && n.props.children !== '').map((n) => String(n.props.children));
};

describe('Q2-D244-01 ~ 08 내역 사유 글', () => {
  test('서버 reason → 카피 키: bundle(종류 boarding) · bundle_cancel · bundle_refund(종류 recovered)만 포함분 줄이고 종류가 어긋나거나 reason 이 없으면 옛 종류 이름 그대로', () => {
    expect(bundleKeys({ kind: 'boarding', reason: 'bundle' })).toEqual({ name: 'MILEAGE.log.reason.bundle', sub: 'MILEAGE.log.reason.bundle.sub' });
    expect(bundleKeys({ kind: 'recovered', reason: 'bundle_cancel' })?.name).toBe('MILEAGE.log.reason.bundleCancel');
    expect(bundleKeys({ kind: 'recovered', reason: 'bundle_refund' })?.name).toBe('MILEAGE.log.reason.bundleRefund');
    expect(bundleKeys({ kind: 'boarding', reason: null })).toBeNull();
    expect(bundleKeys({ kind: 'boarding', reason: undefined })).toBeNull();
    expect(bundleKeys({ kind: 'use', reason: 'bundle' })).toBeNull();
    expect(bundleKeys({ kind: 'recovered', reason: 'bundle' })).toBeNull();
    expect(bundleKeys({ kind: 'boarding', reason: 'bundle_refund' })).toBeNull();
    expect(bundleKeys({ kind: 'recovered', reason: 'other' })).toBeNull();
    expect(hasBundle(ITEMS)).toBe(true);
    expect(hasBundle(ITEMS.filter((x) => x.reason === null))).toBe(false);
  });

  test('줄 이름: 포함분 줄은 사유 이름만 — 옛 "탑승 적립"과 "탑승권 포함분"이 한 줄에 같이 나오지 않는다 · 옛 줄은 옛 이름 그대로', () => {
    const bundle = rowLabel(ITEMS[2]);
    expect(bundle).toEqual({ kind: '탑승권 포함분', sub: null, note: '탑승권을 사면 한 장마다 한 번 함께 드려요.' });
    expect(`${bundle.kind} ${bundle.note}`).not.toContain(IF5_TEXT['MILEAGE.log.kind.boarding']); // '탑승 적립'
    expect(rowLabel(ITEMS[3])).toEqual({ kind: '탑승 적립', sub: null });
    expect(rowLabel(ITEMS[0]).kind).toBe('탑승 취소 · 안 쓴 분 회수');
    expect(rowLabel(ITEMS[1]).kind).toBe('스토어 환불 · 안 쓴 분 회수');
    expect(rowLabel(ITEMS[0]).note).toBe('탑승이 취소되어 포함분 가운데 쓰지 않은 마일리지를 거뒀어요. 이미 쓴 마일리지는 그대로예요.');
    expect(rowLabel(ITEMS[1]).note).toBe('탑승권이 스토어에서 환불되어 포함분 가운데 쓰지 않은 마일리지를 거뒀어요. 이미 쓴 마일리지는 그대로예요.');
    // 충전 환불 회수(옛 종류 refundBack)와 이름이 겹치지 않는다
    expect(rowLabel(item(9, { kind: 'recovered', amount: -500 })).kind).toBe(IF5_TEXT['MILEAGE.log.kind.refundBack']);
    expect(IF5_TEXT['MILEAGE.log.reason.bundleRefund']).not.toBe(IF5_TEXT['MILEAGE.log.kind.refundBack']);
  });

  test('글 규칙: 8줄 모두 느낌표 0 · 점수 · 등급 · 재촉 · 차감 · 사라져요 · 빼앗 0 · 숫자 0(값은 내역 줄에 이미 보임)', () => {
    const keys = ['MILEAGE.log.reason.bundle', 'MILEAGE.log.reason.bundle.sub', 'MILEAGE.log.reason.bundleCancel', 'MILEAGE.log.reason.bundleCancel.sub', 'MILEAGE.log.reason.bundleRefund', 'MILEAGE.log.reason.bundleRefund.sub', 'MILEAGE.log.bundleNote', 'MILEAGE.log.reason.a11y'] as const;
    expect(keys).toHaveLength(8);
    for (const k of keys) {
      expect(IF5_TEXT[k]).not.toMatch(/[!！]|점수|등급|순위|서둘|지금 바로|차감|사라져요|빼앗|\d/);
      expect(IF5_TEXT[k].length).toBeGreaterThan(0);
    }
    expect(IF5_TEXT['MILEAGE.log.bundleNote']).toBe('탑승권에 포함된 마일리지는 취소나 환불이 되면 쓰지 않은 분만 거둬요.');
  });

  test('화면: 포함분 줄마다 사유 이름 + 작은 글 · 금액은 +/− · 안내 한 줄은 한 번만 · 한 줄에 옛 이름과 새 이름이 같이 나오지 않는다 · 읽기 이름은 절댓값 + "마이너스" 0', async () => {
    const tree = keep(await mount(<MileageLogScreen deps={logDeps(ITEMS)} />));
    await act(async () => new Promise((r) => setTimeout(r, 30)));
    expect(textOf(tree, 'mileage-log-kind-3')).toBe('탑승권 포함분');
    expect(textOf(tree, 'mileage-log-note-3')).toBe(IF5_TEXT['MILEAGE.log.reason.bundle.sub']);
    expect(textOf(tree, 'mileage-log-kind-5')).toBe('탑승 취소 · 안 쓴 분 회수');
    expect(textOf(tree, 'mileage-log-kind-4')).toBe('스토어 환불 · 안 쓴 분 회수');
    expect(textOf(tree, 'mileage-log-amount-3')).toBe('+8,700');
    expect(textOf(tree, 'mileage-log-amount-5')).toBe('−8,040');
    expect(textOf(tree, 'mileage-log-amount-4')).toBe('−8,300');
    expect(textOf(tree, 'mileage-log-kind-2')).toBe('탑승 적립'); // 이미 쌓인 옛 줄
    expect(has(tree, 'mileage-log-note-2')).toBe(false);
    expect(has(tree, 'mileage-log-note-1')).toBe(false);
    for (const id of [1, 2, 3, 4, 5]) {
      const joined = itemTexts(tree, id).join(' ');
      expect(joined.includes('탑승 적립') && joined.includes('탑승권 포함분')).toBe(false);
    }
    expect(allTexts(tree).filter((t) => t === IF5_TEXT['MILEAGE.log.bundleNote'])).toHaveLength(1);
    expect(must(tree, 'mileage-log-item-5').props.accessibilityLabel).toBe(t5('MILEAGE.log.reason.a11y', { 사유: '탑승 취소 · 안 쓴 분 회수', N: '8,040', 날짜: '12월 23일' }));
    expect(must(tree, 'mileage-log-item-5').props.accessibilityLabel).not.toMatch(/마이너스|−|-/);
    expect(must(tree, 'mileage-log-item-3').props.accessibilityLabel).toBe('탑승권 포함분, 8,700 마일리지, 12월 21일');
    expect(allTexts(tree).join(' ')).not.toMatch(/연속|순위|배지|[!！]/);
  });

  test('포함분 줄이 없으면(옛 내역뿐 · 빈 내역) 안내 한 줄도 없다', async () => {
    const old = keep(await mount(<MileageLogScreen deps={logDeps(ITEMS.filter((x) => x.reason === null))} />));
    await act(async () => new Promise((r) => setTimeout(r, 30)));
    expect(has(old, 'mileage-log-bundle-note')).toBe(false);
    expect(allTexts(old)).not.toContain(IF5_TEXT['MILEAGE.log.bundleNote']);
    const empty = keep(await mount(<MileageLogScreen deps={logDeps([])} />));
    await act(async () => new Promise((r) => setTimeout(r, 30)));
    expect(has(empty, 'mileage-log-bundle-note')).toBe(false);
    expect(textOf(empty, 'mileage-log-empty')).toBe(IF5_TEXT['MILEAGE.log.empty']);
  });

  test('서버 응답 읽기: reason 은 문자열 하나만 읽고 없으면 null — 값(금액)은 서버 것 그대로', () => {
    const raw = { state: 'ready', items: [{ id: 3, at: '2026-12-21T09:00:00Z', kind: 'boarding', amount: 8700, reason: 'bundle' }, { id: 2, at: '2026-12-20T09:00:00Z', kind: 'boarding', amount: 200 }], next: null };
    const h = parseHistory(raw);
    expect(h?.items.map((x) => x.reason)).toEqual(['bundle', null]);
    expect(h?.items.map((x) => x.amount)).toEqual([8700, 200]);
  });
});

// ── 2. 차감표의 새 키 ─────────────────────────────────────────────────────────
describe('get_mileage.costs 의 새 키(love_reading · compat_glance · zodiac)', () => {
  const rawState = {
    state: 'ready', paid: 0, free: 0, total: 0, held: 0, charge_locked: false, products: [],
    costs: [
      { feature: 'saju_reading', label: '사주 풀이', cost: 400 },
      { feature: 'love_reading', label: '연애 풀이', cost: 2900 },
      { feature: 'compat_glance', label: '궁합 한눈에', cost: 10 },
      { feature: 'zodiac', label: '별자리', cost: 10 },
      { feature: 'counsel_turn', label: '고민 정리 1턴', cost: 330 },
    ],
    rules: { confirm_from: 300, length_free_chars: 1000, length_step_chars: 1000, length_step_cost: 70 },
  };

  test('받아서 읽을 수 있다 — 값은 서버 그대로(앱 하드코딩 0) · 아는 키 목록에 들어 있다', () => {
    const s = parseMileageState(rawState);
    expect(s?.costs.map((c) => c.feature)).toEqual(['saju_reading', 'love_reading', 'compat_glance', 'zodiac', 'counsel_turn']);
    expect(costOf(s!, 'love_reading')).toBe(2900);
    expect(costOf(s!, 'compat_glance')).toBe(10);
    expect(costOf(s!, 'zodiac')).toBe(10);
    for (const k of ['love_reading', 'compat_glance', 'zodiac']) expect(isMileageFeature(k)).toBe(true);
    expect(isMileageFeature('score')).toBe(false);
    expect(new Set(MILEAGE_FEATURES).size).toBe(MILEAGE_FEATURES.length);
  });

  test('서버가 모르는 키를 새 줄로 더해도 안 막는다(읽기는 키를 거르지 않는다)', () => {
    const s = parseMileageState({ ...rawState, costs: [...rawState.costs, { feature: 'future_feature', label: '새 기능', cost: 50 }] });
    expect(s?.costs.map((c) => c.feature)).toContain('future_feature');
  });

  test('가격표 · 내역에는 새 줄을 만들지 않는다(연애 풀이 화면은 본인 결정 대기) — 가격표는 풀이 · 이야기 · 날짜 · (시험판) 고민 · 다듬기뿐', () => {
    const s = parseMileageState(rawState)!;
    expect(priceRows(s.costs).map((r) => r.key)).toEqual(['read']);
    expect(priceRows(s.costs, true).map((r) => r.key)).toEqual(['read', 'concern']);
    expect(rowLabel(item(7, { kind: 'use', amount: -2900, feature: 'love_reading' }))).toEqual({ kind: '사용', sub: null }); // 쓴 곳 이름이 아직 없다 — 사용 한 줄로만
    const routes = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? routes(path.join(dir, e.name)).map((f) => `${e.name}/${f}`) : [e.name]));
    expect(routes(path.join(__dirname, '..', 'app')).filter((f) => /love|연애/i.test(f))).toEqual([]); // 연애 풀이 화면(라우트)은 만들지 않았다
  });
});

// ── 3. 탑승권 구매 시트의 포함분 한 줄 ────────────────────────────────────────
const BUNDLE_LINE = (n: string) => `탑승권을 사서 좌석이 확정되면 ${n} 마일리지가 함께 들어와요. 취소나 환불이 되면 그중 쓰지 않은 마일리지만 거둬요.`;

async function demoClient(email: string) {
  const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) }));
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return client;
}
function withState(base: BoardingApi, mut: Partial<BoardingState>): BoardingApi {
  return { ...base, load: async () => { const r = await base.load(); return r.ok ? { ok: true as const, state: { ...r.state, ...mut } } : r; } };
}
async function openSheet(email: string, mut: Partial<BoardingState>) {
  const api = withState(createBoardingApi(await demoClient(email)), mut);
  const tree = keep(await mount(<BoardingScreen deps={{ api, newId: () => 'req-b', toastMs: 10 }} />));
  await act(async () => undefined);
  await press(tree, 'boarding-buy');
  return tree;
}

describe('Q2-D244-09 구매 시트 포함분 한 줄', () => {
  test('글: 글표 그대로 한 글자도 안 다르고 {N} 자리만 서버 값 · 둘째 줄 · 혜택 강조(드려요 · 선물 · 무료) 0', () => {
    expect(BOARDING.sheet.bundle('{N}')).toBe(BUNDLE_LINE('{N}'));
    expect(BOARDING.sheet.bundle('8,700')).toBe('탑승권을 사서 좌석이 확정되면 8,700 마일리지가 함께 들어와요. 취소나 환불이 되면 그중 쓰지 않은 마일리지만 거둬요.');
    expect(BOARDING.sheet.bundle('8,700')).not.toMatch(/[!！]|드려요|선물|무료|혜택|공짜|덤|특별|서둘/);
    expect(Object.keys(BOARDING.sheet)).not.toContain('bundleNote'); // 둘째 줄(Q2-D244-11) 안 넣음
    expect(Object.keys(BOARDING.sheet)).not.toContain('bundleNoValue'); // 값 없는 글(Q2-D244-10)은 시험 화면용 — 출시 화면은 줄째 없음
  });

  test('서버 값 읽기: bundle_amount 가 양의 정수일 때만 값 · 0(리허설 회차) · 음수 · 문자열 · 없음은 값 없음', () => {
    const round = { round_no: 1, match_day: '2026-12-23', match_time: '18:00', sale_state: 'open' };
    const read = (extra: Record<string, unknown>) => parseTicketState({ round, ...extra }, 0)?.bundleAmount ?? null;
    expect(read({ bundle_amount: 8700 })).toBe(8700);
    expect(read({ bundle_amount: 0 })).toBeNull();
    expect(read({ bundle_amount: -100 })).toBeNull();
    expect(read({ bundle_amount: '8700' })).toBeNull();
    expect(read({ bundle_amount: 87.5 })).toBeNull();
    expect(read({ bundle_amount: null })).toBeNull();
    expect(read({})).toBeNull();
  });

  test('서버 값이 있으면 규칙 3줄 아래에 한 줄(천 단위 쉼표) — 한 번만 · 결제하기 단추와 한 화면', async () => {
    const tree = await openSheet('qf2b6a@email.com', { bundleAmount: 8700, paymentMode: 'live' });
    expect(textOf(tree, 'boarding-sheet-bundle')).toBe(BUNDLE_LINE('8,700'));
    expect(allTexts(tree).filter((t) => t.includes('마일리지가 함께 들어와요'))).toHaveLength(1);
    expect(has(tree, 'boarding-pay')).toBe(true);
    expect(allTexts(tree).join(' ')).not.toMatch(/점수|등급|순위|[!！]/);
    const texts = allTexts(tree); // 자리: 규칙 줄 바로 아래 · 계약 요약 블록 위
    const rules = BOARDING.sheet.rules;
    expect(texts.indexOf(rules[rules.length - 1])).toBeGreaterThanOrEqual(0);
    expect(texts.indexOf(BUNDLE_LINE('8,700'))).toBeGreaterThan(texts.indexOf(rules[rules.length - 1]));
    expect(texts.indexOf(BUNDLE_LINE('8,700'))).toBeLessThan(texts.indexOf(BOARDING.sheet.contractSummaryTitle));
  });

  test('값이 없으면(키 없음 · null · 0) 줄 자체를 그리지 않는다 — 값 없는 글도 안 그린다', async () => {
    for (const bundleAmount of [undefined, null, 0]) {
      const tree = await openSheet('qf2b6b@email.com', { bundleAmount, paymentMode: 'live' });
      expect(has(tree, 'boarding-sheet-bundle')).toBe(false);
      expect(allTexts(tree).join(' ')).not.toContain('마일리지가 함께 들어와요');
      expect(has(tree, 'boarding-pay')).toBe(true);
      await act(async () => tree.unmount());
      mounted.splice(mounted.indexOf(tree), 1);
    }
  });

  test('결제가 닫힌 때(크레딧으로만 타는 시트) · 결제 단추가 없을 때는 서버 값이 있어도 줄이 없다', async () => {
    const closed = await openSheet('qf2b6c@email.com', { bundleAmount: 8700, paymentMode: 'closed' });
    expect(has(closed, 'boarding-sheet-bundle')).toBe(false);
    expect(has(closed, 'boarding-pay')).toBe(false);
    expect(has(closed, 'boarding-sheet-payclosed')).toBe(true);
  });

  test('데모 서버는 get_ticket_state 에 bundle_amount 를 싣고 시트에 한 줄이 나온다(실서버에 이 키를 주는 이관이 생기기 전까지 데모만)', async () => {
    const tree = await openSheet('qf2b6d@email.com', {});
    expect(textOf(tree, 'boarding-sheet-bundle')).toBe(BUNDLE_LINE('8,700'));
  });
});
