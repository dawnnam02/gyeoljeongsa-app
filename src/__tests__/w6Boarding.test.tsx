// V5 W6: 탑승권 · 기다림 · 공개 순간 · 크레딧 — 서버 응답 읽기(아는 키만) · 화면 고르기 · 날 단위 · 글 규칙(재촉 · 숫자 순번 0) · 데모 서버 · 화면.
import { act } from 'react-test-renderer';

import { createDemoBoarding } from '@/demo/boardingDemo';
import { createBoardingApi, parseBoarding, parseLedger, type BoardingState } from '@/features/boarding/boardingApi';
import { ARRIVE, BOARDING, CREDITS, REVEAL } from '@/features/boarding/boardingCopy';
import { arriveWhen, boardingView, daysUntil, nextSaleOpen, whenText } from '@/features/boarding/boardingLogic';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { CreditScreen } from '@/features/boarding/CreditScreen';
import { createOpenedRounds } from '@/features/boarding/openedRounds';
import { RevealScreen } from '@/features/boarding/RevealScreen';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';

import { allTexts, has, mount, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: async () => null }, likesApi: {}, recsApi: {}, gradeApi: {}, aiApi: {}, authApi: {}, supabase: {} }));
jest.setTimeout(120_000);

const MATCH = Date.parse('2026-12-23T18:00:00+09:00');
const base = (over: Partial<BoardingState> = {}): BoardingState => ({ now: MATCH - 3 * 86_400_000, offset: 0, round: { no: 1, matchAt: MATCH, saleOpenAt: Date.parse('2026-12-17T00:00:00+09:00'), saleCloseAt: null }, phase: 'on_sale', regionName: '수도권', seat: 'open', ticket: null, credits: 0, ineligible: null, result: null, past: [], ...over });

async function demoClient(email: string) {
  const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) }));
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return client;
}

describe('서버 응답 읽기(가정 이름 get_boarding_state · buy_ticket · list_credit_ledger)', () => {
  test('아는 키만: 남은 좌석 수 · 정원 · 순번 · 점수 키는 버린다 · 모르는 phase 는 살 수 없는 쪽(closed) · 음수 크레딧은 0', () => {
    const s = parseBoarding({ now: '2026-12-20T09:00:00Z', round: { no: 1, match_at: '2026-12-23T09:00:00Z', seats_left: 3 }, phase: 'weird', seat: 'full', seats_left: 3, capacity: 200, queue_no: 41, credits: -2, score: 88 }, 0);
    expect(s).toMatchObject({ phase: 'closed', seat: 'full', credits: 0, ticket: null, result: null });
    expect(JSON.stringify(s)).not.toMatch(/seats_left|capacity|queue|score|41|88/);
    expect(parseBoarding('x', 0)).toBeNull();
    expect(parseBoarding({ round: { no: 0, match_at: 'x' } }, 0)?.round).toBeNull();
  });

  test('공개 결과: 만난 분(이름 · 나이 · 지역 · 얼굴 사진 id 만) · 찾지 못함(이유)', () => {
    const m = parseBoarding({ phase: 'revealed', result: { round_no: 1, kind: 'matched', partner_id: 'u2', chat_id: 'c1', partner: { name: '문OO', age: 32, region: { sido: '서울', sigungu: '마포구' }, face_photo_id: 'p', score: 9 } } }, 0);
    expect(m?.result).toEqual({ roundNo: 1, kind: 'matched', partnerId: 'u2', chatId: 'c1', partner: { name: '문OO', age: 32, region: { sido: '서울', sigungu: '마포구' }, facePhotoId: 'p' } });
    expect(parseBoarding({ phase: 'revealed', result: { round_no: 1, kind: 'no_match', reason: 'no_fit' } }, 0)?.result).toEqual({ roundNo: 1, kind: 'no_match', reason: 'no_fit' });
    expect(parseLedger({ balance: 1, items: [{ at: '2026-12-23T09:00:00Z', delta: 1, reason: 'balance', round_no: 1 }, { at: 'x', delta: 1, reason: 'used' }, { at: '2026-12-24T00:00:00Z', delta: 0, reason: 'used' }] })?.items).toHaveLength(1);
  });

  test('화면 고르기: 공개 > 탑승 > 살 수 없음 > 판매 전 · 판매 중(좌석 모두 참) · 판매 끝', () => {
    expect(boardingView(base())).toBe('on_sale');
    expect(boardingView(base({ seat: 'full' }))).toBe('full');
    expect(boardingView(base({ phase: 'before_sale' }))).toBe('before_sale');
    expect(boardingView(base({ phase: 'closed' }))).toBe('closed');
    expect(boardingView(base({ ineligible: 'politics_missing' }))).toBe('ineligible');
    expect(boardingView(base({ ticket: { roundNo: 1, boughtAt: 0, paidWith: 'store' } }))).toBe('boarded');
    expect(boardingView(base({ phase: 'revealed', result: { roundNo: 1, kind: 'no_match', reason: null } }))).toBe('no_match');
  });

  test('도착 화면 날짜 알약: "12월 23일(수) 18:00"(정해진 시각 한 줄)', () => {
    expect(arriveWhen(MATCH)).toBe('12월 23일(수) 18:00');
  });

  test('열어 본 회차 저장소: 한 회차 한 번 · 지우기 · 기기 저장에서 읽기', async () => {
    const saved: number[][] = [];
    const store = createOpenedRounds({ read: async () => [3], write: async (r) => void saved.push(r) });
    expect(store.get().ready).toBe(false);
    await store.load();
    expect(store.get()).toEqual({ ready: true, rounds: [3] });
    store.mark(4);
    store.mark(4);
    expect(store.get().rounds).toEqual([3, 4]);
    store.forget(3);
    expect(store.get().rounds).toEqual([4]);
    expect(saved).toEqual([[3, 4], [4]]);
  });

  test('시각 글 · 날 단위: "12월 23일 수요일 오후 6시" · 사흘 전 3 · 당일 0 · 지난 뒤 0 · 다음 판매 = 목요일 0시', () => {
    expect(whenText(MATCH)).toBe('12월 23일 수요일 오후 6시');
    expect(daysUntil(MATCH, MATCH - 3 * 86_400_000)).toBe(3);
    expect(daysUntil(MATCH, Date.parse('2026-12-23T00:30:00+09:00'))).toBe(0);
    expect(daysUntil(MATCH, MATCH + 86_400_000)).toBe(0);
    expect(whenText(nextSaleOpen(MATCH))).toBe('12월 24일 목요일 오전 0시');
  });
});

describe('글 규칙', () => {
  const texts = (o: unknown): string[] => (typeof o === 'string' ? [o] : typeof o === 'function' ? [String((o as (...a: unknown[]) => unknown)(2, '12월 23일 수요일 오후 6시'))] : o && typeof o === 'object' ? Object.values(o).flatMap(texts) : []);
  const all = [...texts(BOARDING), ...texts(REVEAL), ...texts(CREDITS), ...texts(ARRIVE)];
  test('느낌표 · 재촉(남은 자리 · 매진 임박 · 서두르 · 마감 임박 · 지금 바로) · 순번 · 카운트다운 · 등급 · 점수 · 사과 · 합니다체 0', () => {
    const bad = all.filter((t) => /[!！]|남은 (자리|좌석|시간)|매진|서두르|마감 임박|지금 바로|놓치지|\d+번째|\d+:\d\d|초 후|등급|점수|순위|죄송|미안|(습니다|입니다|합니다)\.?$/.test(t));
    expect(bad).toEqual([]);
    expect(BOARDING.noMatch.title).toBe('완벽한 사람을 찾지 못했어요'); // 결정 14
  });
});

describe('데모 서버(demo/boardingDemo)', () => {
  const u = (email: string) => ({ id: `id-${email}`, email });
  test('장면: 기본 판매 중 · boardfull 좌석 모두 참 · boardon 탑승 · boardmatch 만난 분(끼리끼리 첫 분) · boardnone 찾지 못함 + 크레딧', async () => {
    const d = createDemoBoarding();
    const read = async (email: string) => parseBoarding((await d.rpc(u(email), 'get_boarding_state')).data, 0) as BoardingState;
    expect(boardingView(await read('a@email.com'))).toBe('on_sale');
    expect(boardingView(await read('boardfull@email.com'))).toBe('full');
    expect(boardingView(await read('boardon@email.com'))).toBe('boarded');
    const m = await read('boardmatch@email.com');
    expect(m.result).toMatchObject({ kind: 'matched', partnerId: 'demo-cand-4', partner: { name: '문OO' } }); // '나' 4 와 같은 수준 · 같은 종교
    const n = await read('boardnone@email.com');
    expect([boardingView(n), n.credits]).toEqual(['no_match', 1]);
    expect(boardingView(await read('boardpolitics@email.com'))).toBe('ineligible');
  });

  test('사기: 판매 중이면 탑승(같은 요청은 한 번) · 크레딧으로 타면 1장 줄고 내역 · 좌석 모두 참 sold_out · 정치 빈칸 not_eligible · 이미 탑승 already', async () => {
    const d = createDemoBoarding();
    const api = createBoardingApi({ rpc: ((name: string, args?: Record<string, unknown>) => d.rpc(u('a@email.com'), name, args)) as never });
    expect(await api.buy('r1', false)).toEqual({ ok: true, roundNo: 1 });
    expect(await api.buy('r1', false)).toEqual({ ok: true, roundNo: 1 });
    expect(await api.buy('r2', false)).toEqual({ ok: false, reason: 'already' });
    const credit = createBoardingApi({ rpc: ((name: string, args?: Record<string, unknown>) => d.rpc(u('boardcredit@email.com'), name, args)) as never });
    expect(await credit.buy('c1', true)).toEqual({ ok: true, roundNo: 2 });
    const ledger = await credit.ledger();
    expect(ledger.ok && [ledger.balance, ledger.items.map((x) => x.reason)]).toEqual([0, ['used', 'balance']]);
    const full = createBoardingApi({ rpc: ((name: string, args?: Record<string, unknown>) => d.rpc(u('boardfull@email.com'), name, args)) as never });
    expect(await full.buy('f1', false)).toEqual({ ok: false, reason: 'sold_out' });
    const pol = createBoardingApi({ rpc: ((name: string, args?: Record<string, unknown>) => d.rpc(u('boardpolitics@email.com'), name, args)) as never });
    expect(await pol.buy('p1', false)).toEqual({ ok: false, reason: 'not_eligible' });
  });

  test('데모 백엔드에 이어져 있다(로그인 계정) · 데모 줄 장면 바꾸기', async () => {
    const client = await demoClient('w6plain@email.com');
    const api = createBoardingApi(client);
    const first = await api.load();
    expect(first.ok && boardingView(first.state)).toBe('on_sale');
    expect((await client.rpc('demo_boarding_scene', { p_scene: 'matched' })).error).toBeNull();
    const after = await api.load();
    expect(after.ok && boardingView(after.state)).toBe('matched');
  });
});

describe('화면', () => {
  beforeEach(() => jest.clearAllMocks());

  test('T1 판매 중 → [탑승권 사기] → 시트(회차 · 매칭 시각 · 26,900원 · 규칙 · 데모 결제 안내) → [결제하기] → 탑승 완료 · "3일 뒤에 만나요" · 할 일', async () => {
    const client = await demoClient('w6buy@email.com');
    const tree = await mount(<BoardingScreen deps={{ api: createBoardingApi(client), newId: () => 'req-1', toastMs: 10 }} />);
    await act(async () => undefined);
    expect(textOf(tree, 'boarding-status-title')).toBe(BOARDING.onSale.title);
    expect(textOf(tree, 'ticket-when')).toBe('12월 23일 수요일 오후 6시');
    expect(textOf(tree, 'ticket-status')).toBe(BOARDING.stateNone);
    await press(tree, 'boarding-buy');
    expect(textOf(tree, 'boarding-sheet-summary')).toBe('1회차 · 12월 23일 수요일 오후 6시 매칭');
    expect(textOf(tree, 'boarding-sheet-price')).toBe('26,900원');
    await press(tree, 'boarding-pay');
    await act(async () => undefined);
    expect(textOf(tree, 'boarding-status-title')).toBe(BOARDING.boarded.title);
    expect(textOf(tree, 'boarding-days')).toBe('3일 뒤에 만나요');
    expect(has(tree, 'boarding-task-profile') && has(tree, 'boarding-task-survey')).toBe(true);
    expect(allTexts(tree).join(' ')).not.toMatch(/남은 (자리|좌석)|매진|\d+:\d\d/);
    act(() => tree.unmount());
  });

  test('T1 크레딧 장면: 크레딧 줄 · [크레딧으로 타기] → 시트 [크레딧 1장으로 타기] → 탑승(크레딧으로 탑승)', async () => {
    const client = await demoClient('boardcredit@email.com');
    const tree = await mount(<BoardingScreen deps={{ api: createBoardingApi(client), newId: () => 'req-c', toastMs: 10 }} />);
    await act(async () => undefined);
    expect(textOf(tree, 'boarding-credit-note')).toBe('쓸 수 있는 크레딧이 1장 있어요.');
    await press(tree, 'boarding-buy');
    await press(tree, 'boarding-pay-credit');
    await act(async () => undefined);
    expect(textOf(tree, 'ticket-status')).toBe(BOARDING.stateCredit);
    act(() => tree.unmount());
  });

  test('T1 공개 뒤: 만난 분 있음 → [만난 분 보기] /reveal · 찾지 못함 → 제목 · 크레딧 안내 · [크레딧 보기] /credits · 좌석 모두 참은 다음 판매 시각만', async () => {
    // 도착 화면(D-178): 아직 안 연 회차는 도착 화면 → [지금 열어 보기] → 열어 봄 표시 + 공개 순간(?moment=1)
    const opened = createOpenedRounds();
    const matchApi = createBoardingApi(await demoClient('boardmatch@email.com'));
    const a = await mount(<BoardingScreen deps={{ api: matchApi, newId: () => 'x', opened }} />);
    await act(async () => undefined);
    expect(textOf(a, 'boarding-arrive-title')).toBe(ARRIVE.title);
    expect(textOf(a, 'boarding-arrive-body')).toBe(ARRIVE.body);
    expect(textOf(a, 'boarding-arrive-when')).toBe('12월 23일(수) 18:00');
    expect(has(a, 'boarding-arrive-art')).toBe(true);
    expect(has(a, 'boarding-status-matched')).toBe(false);
    await press(a, 'boarding-arrive-open');
    expect(mockRouter.push).toHaveBeenCalledWith('/reveal?moment=1');
    expect(opened.get().rounds).toEqual([1]);
    act(() => a.unmount());
    // 이미 열어 본 회차: 도착 화면 없이 지금처럼 만난 분 카드 → [만난 분 보기] /reveal
    const m = await mount(<BoardingScreen deps={{ api: matchApi, newId: () => 'x', opened }} />);
    await act(async () => undefined);
    expect(has(m, 'boarding-arrive')).toBe(false);
    await press(m, 'boarding-open-reveal');
    expect(mockRouter.push).toHaveBeenCalledWith('/reveal');
    act(() => m.unmount());
    const n = await mount(<BoardingScreen deps={{ api: createBoardingApi(await demoClient('boardnone@email.com')), newId: () => 'x', opened: createOpenedRounds() }} />);
    await act(async () => undefined);
    expect(has(n, 'boarding-arrive')).toBe(false); // 못 찾은 회차는 도착 화면 없이 크레딧 안내
    expect(textOf(n, 'boarding-status-title')).toBe('완벽한 사람을 찾지 못했어요');
    await press(n, 'boarding-open-credits');
    expect(mockRouter.push).toHaveBeenCalledWith('/credits');
    act(() => n.unmount());
    const f = await mount(<BoardingScreen deps={{ api: createBoardingApi(await demoClient('boardfull@email.com')), newId: () => 'x' }} />);
    await act(async () => undefined);
    expect(textOf(f, 'boarding-status-body')).toBe('같은 지역 남녀 수를 맞추느라 좌석을 정해 두고 있어요. 다음 회차 탑승권은 12월 24일 목요일 오전 0시부터 살 수 있어요.');
    expect(has(f, 'boarding-buy')).toBe(false);
    act(() => f.unmount());
  });

  test('T3 공개 순간: 회차 · 제목 · 만난 분 이름 줄 · [대화 시작하기] → /chat/{id} · [프로필 자세히 보기] → 10 / 찾지 못함 변형', async () => {
    const client = await demoClient('boardmatch@email.com');
    const opened = createOpenedRounds();
    const tree = await mount(<RevealScreen deps={{ api: createBoardingApi(client), photoUrl: async () => 'https://x/p.webp', opened }} />);
    await act(async () => undefined);
    // 푸시로 바로 온 아직 안 연 회차: 이 화면에서 먼저 도착 화면
    expect(textOf(tree, 'reveal-arrive-title')).toBe(ARRIVE.title);
    expect(has(tree, 'reveal-matched')).toBe(false);
    await press(tree, 'reveal-arrive-open');
    expect(opened.get().rounds).toEqual([1]);
    expect(has(tree, 'reveal-arrive')).toBe(false);
    expect(textOf(tree, 'reveal-kicker')).toBe('1회차 · 수요일 오후 6시');
    expect(textOf(tree, 'reveal-title')).toBe(REVEAL.title);
    expect(textOf(tree, 'reveal-name')).toBe('문OO · 32 · 서울 마포구');
    await press(tree, 'reveal-chat');
    expect(mockRouter.push).toHaveBeenCalledWith('/chat/demo-chat-1-4');
    await press(tree, 'reveal-profile');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/candidate/[id]', params: { id: 'demo-cand-4' } });
    expect(allTexts(tree).join(' ')).not.toMatch(/점수|등급|%|\d+점/);
    act(() => tree.unmount());
    const none = await mount(<RevealScreen deps={{ api: createBoardingApi(await demoClient('boardnone@email.com')), photoUrl: async () => null, opened: createOpenedRounds() }} />);
    await act(async () => undefined);
    expect(textOf(none, 'reveal-title')).toBe('완벽한 사람을 찾지 못했어요');
    expect(has(none, 'reveal-credits')).toBe(true);
    act(() => none.unmount());
  });

  test('T5 크레딧: 잔액 · 내역(이유 · 날짜 · 회차 · +1장) · 스토어 환불 한 줄', async () => {
    const tree = await mount(<CreditScreen deps={{ api: createBoardingApi(await demoClient('boardnone@email.com')) }} />);
    await act(async () => undefined);
    expect(textOf(tree, 'credits-balance')).toBe('1장');
    expect(allTexts(tree)).toContain('조건이 맞는 분이 없어 돌려받음');
    expect(textOf(tree, 'credits-row-0-delta')).toBe('+1장');
    expect(textOf(tree, 'credits-refund')).toBe(CREDITS.refund);
    act(() => tree.unmount());
  });
});
