// QF2-A 시험: 운세 정리(D-245) 끔 · 켜면 돌아옴 / 연타 막기(같은 틱) / 시트 단추 바닥 고정(구조) / 결제 닫힘 한 줄 / 없는 주소 화면 / 이번 회차 마감 글.
//  서버 대신 가짜 응답. 화면 위치(3폭에서 화면 안)는 웹 점검 scripts/web-qf2a.mjs 가 본다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, demoSceneDefault, FEATURE_KEYS, FEATURE_KEY_LIST, liveDefault, LV2_OFF_KEYS } from '@/config/featureKeys';
import { FORTUNE_TRIM } from '@/config/fortuneTrim';
import { NOT_FOUND } from '@/content/copy';
import { createDemoSaju } from '@/demo/sajuDemo';
import type { BoardingState } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import { MagazineScreen } from '@/features/inflight/MagazineScreen';
import type { Magazine } from '@/features/inflight/inflightApi';
import { Ck17Sheet } from '@/features/inflight/If2Sheets';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { createInputStore, memoryInputStorage } from '@/features/saju/deviceInput';
import { SajuMadangScreen } from '@/features/saju/SajuMadangScreen';
import type { SajuDeps } from '@/features/saju/sajuService';
import { createSajuApi } from '@/features/saju/sajuApi';
import NotFoundRoute from '@/app/+not-found';

import { allTexts, find, has, mount, must, press } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]), Redirect: () => null };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: () => undefined }));
jest.setTimeout(90_000);

const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockRouter.replace.mockClear();
  Object.assign(FORTUNE_TRIM, { workMoneyPeople: false, fullReading: false, zodiacLine: false, inflightAiTrial: false });
});

const isDescendant = (root: ReactTestRenderer, ancestorId: string, id: string): boolean => {
  const a = find(root, ancestorId);
  return !!a && a.findAll((n) => n.props.testID === id).length > 0;
};

// ── Q2-20 운세 정리 ───────────────────────────────────────────────────────────
describe('Q2-20 운세 정리(D-245) — 스위치 7개 데모 꺼짐 · 서버 처음값(live)은 그대로', () => {
  const OFF = ['saju_calendar', 'saju_pickday', 'meet_sky', 'sky_book', 'sky_week', 'birth_card', 'inflight_tarot'];
  test('끔 표의 스위치 7개: demo false · live 는 원래대로 false', () => {
    for (const k of OFF) {
      expect(FEATURE_KEYS).toContain(k);
      expect(demoDefault(k)).toBe(false);
      expect(liveDefault(k)).toBe(false);
      expect(FEATURE_KEY_LIST.find((x) => x.key === k)?.demo).toBe(false);
    }
  });
  test('남김 표의 스위치는 데모 켜짐 그대로(연애 풀이 바탕 · 이야기 · 궁합 · 기내지 · 타입 카드)', () => {
    for (const k of ['three_pillars', 'read_guide', 'saju_reading', 'saju_season', 'saju_year', 'saju_today', 'saju_home', 'saju_partner', 'pair_card_saju', 'pair_card', 'saju_talk', 'inflight_mag', 'type_card', 'my_ways']) {
      expect(demoDefault(k)).toBe(true);
    }
  });
  test('웹 점검용 데모 장면 fortuneon: 끈 7개가 다시 켜지고, 다른 스위치 · 다른 이메일은 그대로', () => {
    for (const k of OFF) {
      expect(demoSceneDefault(k, 'sj1fortuneon@email.com')).toBe(true);
      expect(demoSceneDefault(k, 'sj1@email.com')).toBe(false);
    }
    expect(demoSceneDefault('meet_feedback', 'sj1fortuneon@email.com')).toBe(demoSceneDefault('meet_feedback', 'sj1@email.com'));
    expect(LV2_OFF_KEYS).toEqual(OFF);
  });
  test('스위치 없는 칸 4개는 코드 상수로 숨김 — 처음값 모두 false', () => {
    expect(FORTUNE_TRIM).toEqual({ workMoneyPeople: false, fullReading: false, zodiacLine: false, inflightAiTrial: false });
  });

  const NOW = Date.parse('2027-03-20T03:00:00Z');
  function sajuRig(over: Record<string, boolean>) {
    const user = { id: 'u-saju', email: 'sj@email.com' };
    const flags = { ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over } as Record<string, boolean>;
    const demo = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate: '1994-03-14', consentOn: (c) => c === 'CK17A' }), today: () => '2027-03-20' });
    const api = createSajuApi(async (fn, args = {}) => demo.rpc(user, fn, args));
    const ck17: Ck17Api = { load: async () => ({ ok: true, data: { a: true, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
    const consent = createIf5ConsentStore();
    void consent.setItems({ time: true, gender: true });
    const deps: SajuDeps = { api, ck17, isOn: (k) => flags[k] === true, now: () => NOW, birthDate: async () => '1994-03-14', consent };
    return deps;
  }
  const hub = async (deps: SajuDeps) => {
    const store = createInputStore(memoryInputStorage());
    void store.save({ time: null, saveTime: false});
    const tree = keep(await mount(<SajuMadangScreen deps={deps} store={store} />));
    await wait(80);
    return tree;
  };

  test('사주 마당 처음값: 일 · 돈 · 사람 카드 · 이번 달 · 날짜 고르기 · 달력 입구가 없고, 남김 칸은 있음', async () => {
    const tree = await hub(sajuRig({}));
    for (const id of ['saju-pillars', 'saju-kyeol', 'saju-year', 'saju-love', 'saju-season', 'saju-partner-card', 'saju-guide-card', 'saju-end']) expect(has(tree, id)).toBe(true);
    for (const id of ['saju-work', 'saju-month', 'saju-pick', 'saju-cal-card']) expect(has(tree, id)).toBe(false);
    expect(has(tree, 'saju-full-card')).toBe(false);
  });
  test('켜면 돌아옴: 일 · 돈 · 사람 카드(상수) · 이번 달 · 날짜 고르기 · 달력(스위치)', async () => {
    FORTUNE_TRIM.workMoneyPeople = true;
    const tree = await hub(sajuRig({ saju_calendar: true, saju_pickday: true }));
    for (const id of ['saju-work', 'saju-month', 'saju-pick', 'saju-cal-card']) expect(has(tree, id)).toBe(true);
  });
  test('띠 한 줄: 끔이면 올해 카드를 펼쳐도 글이 한 줄 적고, 켜면 한 줄 늘어 돌아옴', async () => {
    const opened = async () => {
      const tree = await hub(sajuRig({}));
      await press(tree, 'saju-year-toggle'); // 올해 카드의 [더 보기] — 띠 한 줄은 펼친 안쪽
      return allTexts(tree).length;
    };
    const offCount = await opened();
    FORTUNE_TRIM.zodiacLine = true;
    expect(await opened()).toBe(offCount + 1);
  });
});

describe('Q2-20 기내지 — 타로 쪽 · 별자리 사주 AI 시험판', () => {
  const issued: Magazine = { state: 'issued', issueDate: '2027-01-14', tripNo: 3, weekElement: 'wood', column: null, ck17a: true, sky: { signs: ['capricorn'], zodiacs: ['zw-capricorn-t01-v0'] }, grain: { stem: 0, saju: 'sw-0-wood-v1', relation: 'same' } };
  function deps(tarot: boolean) {
    const on = new Set(['inflight_mag', ...(tarot ? ['inflight_tarot'] : [])]);
    const api = {
      magazine: async () => ({ ok: true as const, data: issued }),
      weekCard: async () => ({ ok: true as const, data: { state: 'none' as const } }),
      pickWeekCard: async () => ({ ok: false as const, code: 'none' }),
      preQuestions: async () => ({ ok: true as const, data: { state: 'none' as const, questions: [] } }),
    };
    const ck17 = { load: async () => ({ ok: true as const, data: { a: true, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
    return { api, ck17, isOn: (k: string) => on.has(k) } as never;
  }
  const countPages = async (tarot: boolean) => {
    const tree = keep(await mount(<MagazineScreen deps={deps(tarot)} />));
    await wait();
    let n = 1;
    while (has(tree, 'mag-next') && n < 12) {
      await press(tree, 'mag-next');
      n += 1;
    }
    return n;
  };
  test('타로 꺼짐: 기내지가 6쪽(카드 쪽 없음) · 켜면 7쪽으로 돌아옴', async () => {
    expect(await countPages(false)).toBe(6);
    expect(await countPages(true)).toBe(7);
  });
  test('별자리 · 사주 AI 시험판 상수 처음값 꺼짐', () => {
    expect(FORTUNE_TRIM.inflightAiTrial).toBe(false);
  });
});

// ── Q2-T1 시트 단추 바닥 고정(구조) ─────────────────────────────────────────────
describe('Q2-T1 시트 단추는 스크롤 칸 밖(바닥 고정)', () => {
  const MATCH = Date.parse('2026-12-23T18:00:00+09:00');
  const state = (over: Partial<BoardingState> = {}): BoardingState => ({ now: MATCH - 3 * 86_400_000, offset: 0, round: { no: 1, matchAt: MATCH, saleOpenAt: Date.parse('2026-12-17T00:00:00+09:00'), saleCloseAt: null }, phase: 'on_sale', regionName: '수도권', seat: 'open', ticket: null, credits: 0, ineligible: null, result: null, past: [], ...over });
  const screen = async (st: BoardingState, buy: jest.Mock) => {
    const tree = keep(await mount(<BoardingScreen deps={{ api: { load: async () => ({ ok: true, state: st }), buy }, newId: () => 'req', toastMs: 10 }} />));
    await act(async () => undefined);
    await press(tree, 'boarding-buy');
    return tree;
  };
  test('탑승권 사기 시트: [결제하기] · 가격 · 마감 안내가 스크롤 칸 밖 바닥 줄에 있고 계약 요약은 스크롤 안에 있음', async () => {
    const tree = await screen(state(), jest.fn());
    for (const id of ['boarding-pay', 'boarding-sheet-price', 'boarding-sheet-deadline']) {
      expect(isDescendant(tree, 'boarding-sheet-footer', id)).toBe(true);
      expect(isDescendant(tree, 'boarding-sheet-scroll', id)).toBe(false);
    }
    expect(isDescendant(tree, 'boarding-sheet-scroll', 'boarding-contract-summary')).toBe(true);
    expect(isDescendant(tree, 'boarding-sheet-scroll', 'boarding-contract')).toBe(true);
  });
  test('Q2-21 결제 닫힘(payment_mode closed): [결제하기] 없이 사실 한 줄, 판매 종료 글과 다름', async () => {
    const tree = await screen(state({ paymentMode: 'closed' }), jest.fn());
    expect(has(tree, 'boarding-pay')).toBe(false);
    expect(allTexts(tree)).toContain(BOARDING.sheet.payClosed);
    expect(BOARDING.sheet.payClosed).not.toMatch(/끝났|종료|마감/);
    expect(has(tree, 'boarding-sheet-demo')).toBe(false);
  });
  test('결제 열림(live)·데모에서는 [결제하기]가 그대로 있음', async () => {
    const live = await screen(state({ paymentMode: 'live' }), jest.fn());
    expect(has(live, 'boarding-pay')).toBe(true);
    expect(has(live, 'boarding-sheet-payclosed')).toBe(false);
    const demo = await screen(state({ paymentMode: 'demo' }), jest.fn());
    expect(has(demo, 'boarding-pay')).toBe(true);
  });
  test('사주 동의 시트(IF-CK17): [이어 가기]가 스크롤 칸 밖 · 항목은 스크롤 안', async () => {
    const tree = keep(await mount(<Ck17Sheet visible onClose={() => undefined} onSave={async () => true} />));
    await wait();
    expect(isDescendant(tree, 'if2-ck17-scroll', 'if2-ck17-go')).toBe(false);
    expect(isDescendant(tree, 'if2-ck17-scroll', 'if2-ck17-a')).toBe(true);
    expect(has(tree, 'if2-ck17-go')).toBe(true);
  });
});

// ── Q2-T2 연타 막기 ──────────────────────────────────────────────────────────
describe('Q2-T2 같은 틱에 두 번 눌러도 한 번만(ref 잠금)', () => {
  const MATCH = Date.parse('2026-12-23T18:00:00+09:00');
  const state = (): BoardingState => ({ now: MATCH - 3 * 86_400_000, offset: 0, round: { no: 1, matchAt: MATCH, saleOpenAt: Date.parse('2026-12-17T00:00:00+09:00'), saleCloseAt: null }, phase: 'on_sale', regionName: '수도권', seat: 'open', ticket: null, credits: 0, ineligible: null, result: null, past: [], paymentMode: 'demo' });
  test('탑승권 [결제하기] 연타: 결제 호출 1번, 끝난 뒤 다시 누르면 새로 호출', async () => {
    let release: (v: { ok: false; reason: 'network' }) => void = () => undefined;
    const buy = jest.fn(() => new Promise<{ ok: false; reason: 'network' }>((res) => (release = res)));
    const tree = keep(await mount(<BoardingScreen deps={{ api: { load: async () => ({ ok: true, state: state() }), buy: buy as never }, newId: () => 'req', toastMs: 10 }} />));
    await act(async () => undefined);
    await press(tree, 'boarding-buy');
    await act(async () => {
      const onPress = must(tree, 'boarding-pay').props.onPress as () => void;
      onPress();
      onPress(); // 같은 틱 두 번째 — busy state 는 아직 바뀌기 전
    });
    expect(buy).toHaveBeenCalledTimes(1);
    await act(async () => release({ ok: false, reason: 'network' }));
    await act(async () => undefined);
    await act(async () => (must(tree, 'boarding-pay').props.onPress as () => void)());
    expect(buy).toHaveBeenCalledTimes(2);
  });
  test('동의 시트 [이어 가기] 연타: 저장 호출 1번', async () => {
    let done: (v: boolean) => void = () => undefined;
    const onSave = jest.fn(() => new Promise<boolean>((res) => (done = res)));
    const tree = keep(await mount(<Ck17Sheet visible onClose={() => undefined} onSave={onSave} />));
    await wait();
    await act(async () => {
      const onPress = must(tree, 'if2-ck17-go').props.onPress as () => void;
      onPress();
      onPress();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => done(false));
  });
});

// ── Q2-T3 글 · 없는 주소 ───────────────────────────────────────────────────────
describe('Q2-T3 이번 회차 마감 글 · 없는 주소 화면', () => {
  test('F-05: 매진·좌석 말 없이 마감 사실만(숫자 0)', () => {
    expect(BOARDING.full.title).toBe('이번 회차는 마감했어요');
    expect(BOARDING.buyErrors.sold_out).toBe('이번 회차는 마감했어요. 결제되지 않았어요.');
    expect(BOARDING.full.body('12월 24일')).toBe('다음 회차 탑승권은 12월 24일부터 살 수 있어요.');
    const all = [BOARDING.full.title, BOARDING.full.body('x'), BOARDING.buyErrors.sold_out].join(' ');
    expect(all).not.toMatch(/좌석|찼|매진|남은|\d/);
  });
  test('F-13: 앱 말투 안내 + [홈으로] → 앱 시작으로 이동(영어 기본 화면 아님)', async () => {
    const tree = keep(await mount(<NotFoundRoute />));
    expect(allTexts(tree)).toEqual(expect.arrayContaining([NOT_FOUND.title, NOT_FOUND.body, NOT_FOUND.home]));
    expect(allTexts(tree).join(' ')).not.toMatch(/Unmatched|Sitemap|Go back/);
    await press(tree, 'not-found-home');
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
