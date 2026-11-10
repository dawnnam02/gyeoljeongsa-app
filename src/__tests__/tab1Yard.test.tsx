// TAB-1 하단 탭 '사주 마당' 첫 화면(메뉴) — 상태 한 칸 3가지(동의 전 · 생일 전 · 준비됨) · 메뉴 줄이 스위치대로 나타남 · 사라짐 · 줄이 가는 곳 ·
//  준비 안 된 분이 줄을 눌러도 막다른 길 없음 · 마일리지 값은 서버가 준 것만 · 맨 아래 길 · 글 규칙(운세 · 타로 · 궁합 · 점 · 재촉 · 느낌표 · 새 점 0) · 접근성 이름.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { IF5_TEXT } from '@/content/if5Copy';
import { SETTINGS } from '@/content/settingsCopy';
import { createDemoMileage } from '@/demo/mileageDemo';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { tx } from '@/features/inflight/if2Text';
import { createMileageApi, type MileageState } from '@/features/mileage/mileageApi';
import { costOf, fmt } from '@/features/mileage/mileageLogic';
import { takeSettingsPage } from '@/features/settings/settingsIntent';
import { createInputStore, memoryInputStorage, type InputStore } from '@/features/saju/deviceInput';
import { createSajuApi } from '@/features/saju/sajuApi';
import { nowIso, todayBaseLine } from '@/features/saju/sajuLogic';
import { clearSajuSection, peekSajuSection } from '@/features/saju/sajuSection';
import { yardRows } from '@/features/saju/sajuYardLogic';
import { YARD } from '@/features/saju/sajuYardCopy';
import { SajuYardScreen, type YardDeps } from '@/features/saju/SajuYardScreen';

import { allTexts, find, has, isOpen, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
  Redirect: () => null,
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));

jest.setTimeout(90_000);

const NOW = Date.parse('2027-03-20T03:00:00Z'); // 한국 2027-03-20 정오
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  for (const fn of Object.values(mockRouter)) (fn as jest.Mock).mockClear();
  clearSajuSection();
  takeSettingsPage();
});

const flagsAll = (over: Record<string, boolean> = {}) => ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over }) as Record<string, boolean>;
const freshStore = (answered = false): InputStore => {
  const s = createInputStore(memoryInputStorage());
  if (answered) void s.save({ time: null, saveTime: false });
  return s;
};

// 서버가 준 마일리지 상태(데모 모의 서버 — 0048 모양)
function mileageOf(rounds = 0) {
  const flags = flagsAll({ mileage: true });
  const demo = createDemoMileage({ flags: async () => flags, boardedRounds: async () => rounds });
  const user = { id: 'u-yard', email: 'yard@email.com' };
  const api = createMileageApi(async (fn: string, args: Record<string, unknown> = {}) => demo.rpc(user, fn, args));
  const load = async (): Promise<MileageState | null> => {
    const r = await api.state();
    return r.ok ? r.data : null;
  };
  return { load, api };
}

function deps(opts: { ck17?: boolean; flags?: Record<string, boolean>; ai?: boolean; mileage?: YardDeps['mileage'] } = {}): YardDeps {
  const flags = flagsAll(opts.flags);
  const ck17: Ck17Api = {
    load: async () => ({ ok: true, data: { a: opts.ck17 !== false, b: false } }),
    record: jest.fn(async () => ({ ok: true as const })),
    revoke: jest.fn(async () => ({ ok: true as const })),
  };
  return {
    api: createSajuApi(async () => ({ data: null, error: null })),
    ck17,
    isOn: (k: string) => flags[k] === true,
    now: () => NOW,
    birthDate: async () => '1994-03-14',
    ai: (opts.ai === false ? undefined : {}) as never,
    mileage: opts.mileage,
  };
}

async function open(d: YardDeps, store: InputStore) {
  const tree = keep(await mount(<SajuYardScreen deps={d} store={store} />));
  await wait(80);
  return tree;
}

const ROW_ORDER = ['today', 'pillars', 'year', 'season', 'love', 'partner', 'talk']; // 준비 전(동의 전 · 생일 전)에 그리는 줄
const READY_ROWS = ROW_ORDER.filter((k) => k !== 'today'); // 준비됨: 상태 칸(오늘 하루 한 줄)이 '오늘 하루'로 가는 문이라 메뉴에서는 그 줄이 빠진다(QF2-B8)
const rowKeys = (tree: ReactTestRenderer) => ['today', 'pillars', 'year', 'season', 'love', 'partner', 'talk', 'pick', 'calendar'].filter((k) => has(tree, `saju-yard-row-${k}`));

describe('TAB-1 사주 마당 탭 · 상태 한 칸(한 번에 하나만)', () => {
  test('준비됨(동의 + 내 정보): 오늘 하루 한 줄이 상태 칸 — 오늘 날짜의 바탕만 · 동의 · 생일 칸은 없다', async () => {
    const tree = await open(deps(), freshStore(true));
    expect(has(tree, 'saju-yard-status-today')).toBe(true);
    expect(textOf(tree, 'saju-yard-today-line')).toBe(todayBaseLine(nowIso(NOW)));
    expect(has(tree, 'saju-yard-status-consent')).toBe(false);
    expect(has(tree, 'saju-yard-status-birth')).toBe(false);
    await press(tree, 'saju-yard-status-today');
    expect(mockRouter.push).toHaveBeenCalledWith('/saju-today');
  });
  test('준비됨이어도 스위치 saju_today 가 꺼지면 상태 칸 자체가 없다(빈 칸 · 빈 카드 0)', async () => {
    const tree = await open(deps({ flags: { saju_today: false } }), freshStore(true));
    expect(has(tree, 'saju-yard-status-today')).toBe(false);
    expect(has(tree, 'saju-yard-status-consent')).toBe(false);
    expect(has(tree, 'saju-yard-status-birth')).toBe(false);
  });
  test('동의 전(CK17A 꺼짐): 안내 한 줄 + [동의하고 보기] · 저절로 시트 0', async () => {
    const tree = await open(deps({ ck17: false }), freshStore(true));
    expect(has(tree, 'saju-yard-status-consent')).toBe(true);
    expect(allTexts(tree)).toContain(tx('FUN.ck17.offBody'));
    expect(allTexts(tree)).toContain(tx('FUN.ck17.agreeView'));
    expect(has(tree, 'saju-yard-status-today')).toBe(false);
    expect(has(tree, 'saju-yard-status-birth')).toBe(false);
    expect(isOpen(tree, 'if2-ck17')).toBe(false);
    await press(tree, 'saju-yard-agree');
    expect(isOpen(tree, 'if2-ck17')).toBe(true);
  });
  test('생일 전(동의는 했고 내 정보가 없음): 안내 한 줄 + [내 정보 넣기] · 저절로 시트 0', async () => {
    const tree = await open(deps(), freshStore());
    expect(has(tree, 'saju-yard-status-birth')).toBe(true);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.madang.empty']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.madang.fillIn']);
    expect(has(tree, 'saju-yard-status-consent')).toBe(false);
    expect(isOpen(tree, 'saju-in')).toBe(false);
    await press(tree, 'saju-yard-fill');
    expect(isOpen(tree, 'saju-in')).toBe(true);
  });
  test('불러오는 중 · 읽기 실패: 상태 칸 한 곳에 뼈대 · 오류 한 줄 + [다시 시도](자동 재시도 0)', async () => {
    let release: () => void = () => undefined;
    const slow = deps();
    slow.ck17 = { ...slow.ck17, load: () => new Promise((res) => (release = () => res({ ok: true, data: { a: true, b: false } }))) } as Ck17Api;
    const loading = keep(await mount(<SajuYardScreen deps={slow} store={freshStore(true)} />));
    await wait(30);
    expect(has(loading, 'saju-yard-loading')).toBe(true);
    await act(async () => release());
    await wait(30);
    expect(has(loading, 'saju-yard-loading')).toBe(false);
    const bad = deps();
    const failing = jest.fn(async () => ({ ok: false as const, code: 'network' as const }));
    bad.ck17 = { ...bad.ck17, load: failing } as unknown as Ck17Api;
    const tree = await open(bad, freshStore(true));
    expect(has(tree, 'saju-yard-error')).toBe(true);
    expect(failing).toHaveBeenCalledTimes(1); // 앱 자동 재시도 0
    await press(tree, 'saju-yard-error-retry');
    await wait(30);
    expect(failing).toHaveBeenCalledTimes(2);
  });
});

describe('TAB-1 메뉴 줄 · 스위치대로 나타남 · 사라짐', () => {
  test('데모 처음 스위치: 오늘 하루 · 내 네 기둥과 결 읽기 · 올해 흐름 · 인생 계절표 · 인연 이야기 · 둘이 맞춰 보기 · 사주 이야기 나누기 순서 — 달력 · 날짜 고르기(꺼짐)는 줄 0', async () => {
    const notReady = await open(deps(), freshStore());
    expect(rowKeys(notReady)).toEqual(ROW_ORDER); // 생일 전: 오늘 하루 줄도 그린다(누르면 다음 걸음)
    expect(textOf(notReady, 'saju-yard-row-today-line')).toBe(YARD.rows.today.line);
    const noConsent = await open(deps({ ck17: false }), freshStore(true));
    expect(rowKeys(noConsent)).toEqual(ROW_ORDER); // 동의 전도 같다
    const tree = await open(deps(), freshStore(true));
    expect(rowKeys(tree)).toEqual(READY_ROWS); // 준비됨: '오늘 하루'가 상태 칸과 메뉴 줄 두 번 나오지 않는다
    expect(has(tree, 'saju-yard-row-today')).toBe(false);
    expect(allTexts(tree).filter((t) => t === IF5_TEXT['SAJU.today.title'])).toHaveLength(1); // 글 '오늘 하루'는 상태 칸의 작은 이름 한 번뿐
    expect(allTexts(tree)).toContain(YARD.rows.pillars.name);
    expect(textOf(tree, 'saju-yard-row-pillars-line')).toBe(YARD.rows.pillars.line);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.year.label']);
    expect(textOf(tree, 'saju-yard-row-year-line')).toBe(IF5_TEXT['SAJU.madang.card.year']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.life.title']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.love.label']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.partner.card']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.talk.entry.title']);
    expect(textOf(tree, 'saju-yard-row-talk-line')).toBe(IF5_TEXT['SAJU.talk.entry.body']);
  });
  test('꺼진 기능은 줄을 그리지 않는다 — 스위치 하나씩 끄면 그 줄만 없다', () => {
    const base = { isOn: (k: string) => flagsAll()[k] === true, aiAvailable: true };
    expect(yardRows(base).map((r) => r.key)).toEqual(ROW_ORDER);
    const without = (flag: string, off: string[]) => {
      const flags = flagsAll({ [flag]: false });
      return yardRows({ isOn: (k) => flags[k] === true, aiAvailable: true }).map((r) => r.key).filter((k) => !ROW_ORDER.includes(k) || off.includes(k) === false);
    };
    expect(without('saju_today', ['today'])).toEqual(ROW_ORDER.filter((k) => k !== 'today'));
    expect(without('saju_year', ['year'])).toEqual(ROW_ORDER.filter((k) => k !== 'year'));
    expect(without('saju_season', ['season'])).toEqual(ROW_ORDER.filter((k) => k !== 'season'));
    expect(without('saju_partner', ['partner'])).toEqual(ROW_ORDER.filter((k) => k !== 'partner'));
    expect(without('saju_talk', ['talk'])).toEqual(ROW_ORDER.filter((k) => k !== 'talk'));
    // 결 읽기(saju_reading)가 꺼지면 인연 이야기 줄이 없고, 네 기둥 스위치가 켜져 있으면 합친 줄은 남는다
    const noReading = flagsAll({ saju_reading: false });
    expect(yardRows({ isOn: (k) => noReading[k] === true, aiAvailable: true }).map((r) => r.key)).toEqual(ROW_ORDER.filter((k) => k !== 'love'));
    const noPillarsNoReading = flagsAll({ saju_reading: false, three_pillars: false });
    expect(yardRows({ isOn: (k) => noPillarsNoReading[k] === true, aiAvailable: true }).map((r) => r.key)).toEqual(ROW_ORDER.filter((k) => k !== 'love' && k !== 'pillars'));
    // AI 연결이 없으면(시험판 AI 꺼짐 · 못 만듦) 사주 이야기 나누기 줄 0
    expect(yardRows({ isOn: base.isOn, aiAvailable: false }).map((r) => r.key)).toEqual(ROW_ORDER.filter((k) => k !== 'talk'));
    // 상태 칸이 오늘 하루의 문일 때(준비됨)는 오늘 하루 줄이 빠지고, 스위치가 꺼지면 어느 쪽이든 줄 0
    expect(yardRows({ ...base, todayIsStatus: true }).map((r) => r.key)).toEqual(READY_ROWS);
    const noToday = flagsAll({ saju_today: false });
    expect(yardRows({ isOn: (k) => noToday[k] === true, aiAvailable: true, todayIsStatus: false }).map((r) => r.key)).toEqual(READY_ROWS);
    expect(yardRows({ isOn: (k) => noToday[k] === true, aiAvailable: true, todayIsStatus: true }).map((r) => r.key)).toEqual(READY_ROWS);
  });
  test('날짜 고르기 · 만세력 달력은 스위치가 켜졌을 때만 줄이 생긴다(끝에)', async () => {
    const tree = await open(deps({ flags: { saju_pickday: true, saju_calendar: true } }), freshStore(true));
    expect(rowKeys(tree)).toEqual([...READY_ROWS, 'pick', 'calendar']);
    await press(tree, 'saju-yard-row-calendar');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/saju-calendar', params: { mode: 'cal' } });
    await press(tree, 'saju-yard-row-pick');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/saju-calendar', params: { mode: 'pick' } });
  });
  test('모든 줄 스위치가 꺼지면 줄 묶음 자체가 없다(빈 상자 0)', async () => {
    const off = { saju_today: false, three_pillars: false, saju_reading: false, saju_year: false, saju_season: false, saju_partner: false, saju_talk: false };
    const tree = await open(deps({ flags: off }), freshStore(true));
    expect(rowKeys(tree)).toEqual([]);
    expect(has(tree, 'saju-yard-rows')).toBe(false);
    expect(has(tree, 'saju-yard-bottom')).toBe(true); // 맨 아래 길은 그대로
  });
});

describe('TAB-1 줄을 누르면 — 지금 있는 화면으로 · 구역이 맨 위에 오게', () => {
  test('오늘 하루(준비됨: 상태 칸) → /saju-today · 사주 이야기 나누기 → /saju-talk', async () => {
    const tree = await open(deps(), freshStore(true));
    await press(tree, 'saju-yard-status-today');
    expect(mockRouter.push).toHaveBeenLastCalledWith('/saju-today');
    await press(tree, 'saju-yard-row-talk');
    expect(mockRouter.push).toHaveBeenLastCalledWith('/saju-talk');
  });
  test('긴 풀이 화면 줄은 /saju-detail 로 가고 열 구역을 앱 안 메모리로 건넨다(주소에 구역 이름 0)', async () => {
    const tree = await open(deps(), freshStore(true));
    const cases: [string, string][] = [['pillars', 'pillars'], ['year', 'year'], ['season', 'season'], ['love', 'love'], ['partner', 'partner']];
    for (const [row, section] of cases) {
      clearSajuSection();
      mockRouter.push.mockClear();
      await press(tree, `saju-yard-row-${row}`);
      expect(mockRouter.push).toHaveBeenCalledTimes(1);
      expect(mockRouter.push).toHaveBeenCalledWith('/saju-detail');
      expect(peekSajuSection()).toBe(section);
    }
  });
  test('준비가 안 된 분이 줄을 눌러도 막다른 길 없이 다음 걸음이 열린다 — 동의 전 = 동의 시트 · 생일 전 = 내 정보 시트 · 이동 0', async () => {
    const noConsent = await open(deps({ ck17: false }), freshStore(true));
    await press(noConsent, 'saju-yard-row-year');
    expect(isOpen(noConsent, 'if2-ck17')).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(peekSajuSection()).toBeNull();
    const noBirth = await open(deps(), freshStore());
    await press(noBirth, 'saju-yard-row-today');
    expect(isOpen(noBirth, 'saju-in')).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
  test('맨 아래 길: 읽는 법 → 내 사주 자세히(읽는 법 구역) · 내 정보 고치기(준비됨일 때만) → 내 정보 시트 · 동의 관리 → 설정의 동의 관리 쪽', async () => {
    const tree = await open(deps(), freshStore(true));
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.guide.title']);
    expect(allTexts(tree)).toContain(YARD.bottom.edit);
    expect(allTexts(tree)).toContain(SETTINGS.rows.consents);
    await press(tree, 'saju-yard-link-guide');
    expect(mockRouter.push).toHaveBeenLastCalledWith('/saju-detail');
    expect(peekSajuSection()).toBe('guide');
    await press(tree, 'saju-yard-link-edit');
    expect(isOpen(tree, 'saju-in')).toBe(true);
    await press(tree, 'saju-yard-link-consent');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
    expect(takeSettingsPage()).toBe('consent-management');
    const notReady = await open(deps(), freshStore());
    expect(has(notReady, 'saju-yard-link-edit')).toBe(false); // 내 정보가 없으면 '고치기'가 아니라 상태 칸의 [내 정보 넣기]
  });
});

describe('TAB-1 마일리지 값은 서버가 준 것만', () => {
  test('잔액(머리)과 AI 맞춤 풀이 · 이야기 한 번의 값이 서버 상태 그대로 나온다 — 누르면 마일리지 화면', async () => {
    const m = mileageOf(1);
    const state = (await m.load()) as MileageState;
    const tree = await open(deps({ mileage: m.load }), freshStore(true));
    expect(textOf(tree, 'saju-yard-balance-text')).toBe(YARD.balance(fmt(state.total)));
    expect(textOf(tree, 'saju-yard-row-year-cost')).toBe(YARD.cost.ai(fmt(costOf(state, 'sinyeon') as number)));
    expect(textOf(tree, 'saju-yard-row-season-cost')).toBe(YARD.cost.ai(fmt(costOf(state, 'daewoon') as number)));
    expect(textOf(tree, 'saju-yard-row-pillars-cost')).toBe(YARD.cost.ai(fmt(costOf(state, 'saju_reading') as number)));
    expect(textOf(tree, 'saju-yard-row-partner-cost')).toBe(YARD.cost.ai(fmt(costOf(state, 'compat') as number)));
    expect(textOf(tree, 'saju-yard-row-talk-cost')).toBe(YARD.cost.turn(fmt(costOf(state, 'saju_chat_turn') as number)));
    expect(has(tree, 'saju-yard-row-today-cost')).toBe(false); // 값이 없는 줄에는 값 글 0
    expect(has(tree, 'saju-yard-row-love-cost')).toBe(false);
    await press(tree, 'saju-yard-balance');
    expect(mockRouter.push).toHaveBeenCalledWith('/mileage');
  });
  test('서버가 값을 못 줬거나 스위치(mileage · saju_ai)가 꺼지면 잔액 · 값 글 0 — 코드에는 숫자가 없다', async () => {
    const none = await open(deps({ mileage: async () => null }), freshStore(true));
    expect(has(none, 'saju-yard-balance')).toBe(false);
    for (const k of ['pillars', 'year', 'season', 'partner', 'talk']) expect(has(none, `saju-yard-row-${k}-cost`)).toBe(false);
    const m = mileageOf();
    const noMileage = await open(deps({ flags: { mileage: false }, mileage: m.load }), freshStore(true));
    expect(has(noMileage, 'saju-yard-balance')).toBe(false);
    const noAi = await open(deps({ flags: { saju_ai: false }, mileage: m.load }), freshStore(true));
    expect(has(noAi, 'saju-yard-balance')).toBe(true); // 잔액은 스위치 mileage 몫
    for (const k of ['pillars', 'year', 'season', 'partner']) expect(has(noAi, `saju-yard-row-${k}-cost`)).toBe(false); // AI 맞춤 칸이 닫혀 있으면 값도 없다
    // 새 글 파일 · 로직에는 마일리지 숫자가 없다(값은 서버)
    for (const text of [YARD.rows.today.line, YARD.rows.pillars.name, YARD.rows.pillars.line, YARD.bottom.edit]) expect(text).not.toMatch(/\d/);
  });
});

describe('TAB-1 글 규칙 · 접근성', () => {
  test('화면 글에 운세 · 타로 · 궁합 · 점 · 점수 · 순위 · 재촉 · 느낌표 · 새 표시가 없다(모든 상태)', async () => {
    const m = mileageOf();
    const shown: string[] = [];
    for (const [d, s] of [
      [deps({ mileage: m.load }), freshStore(true)],
      [deps({ ck17: false }), freshStore(true)],
      [deps(), freshStore()],
    ] as [YardDeps, InputStore][]) {
      shown.push(...allTexts(await open(d, s)));
    }
    const joined = shown.join(' | ');
    expect(joined).not.toMatch(/운세|타로|궁합|점수|순위|서두르|서둘|빨리|오늘만|마감|남은|놓치|[!！]|새로운|\bNEW\b/i);
    expect(joined).not.toMatch(/점쳐|점괘|점술|점집|점보러|점 보러/); // 점술 뜻의 '점'(카피 21장) 0 — '다른 점' 같은 보통 말(이미 있는 카드 설명)은 따로 본다
    expect(YARD.cost.ai('800')).not.toMatch(/[!！]/);
  });
  test('탭 화면에 숫자 배지 · 새 점 · 진행 막대 · 깜빡임 요소가 없다(testID · 글 검사)', async () => {
    const tree = await open(deps({ mileage: mileageOf().load }), freshStore(true));
    const ids = tree.root.findAll((n) => typeof n.props.testID === 'string').map((n) => n.props.testID as string);
    expect(ids.filter((id) => /badge|dot|new|progress|blink/i.test(id))).toEqual([]);
  });
  test('줄 · 맨 아래 길은 모두 버튼 역할 · 이름(이름 + 한 줄 설명) · 열기 힌트를 가진다 · 한 줄에 아이콘이 있다', async () => {
    const tree = await open(deps({ mileage: mileageOf().load }), freshStore(true));
    const door = must(tree, 'saju-yard-status-today'); // 준비됨: 상태 칸이 오늘 하루로 가는 문 — 메뉴 줄과 같은 버튼 · 힌트 · chevron
    expect(door.props.accessibilityRole).toBe('button');
    expect(String(door.props.accessibilityLabel)).toBe(`${IF5_TEXT['SAJU.today.title']}. ${todayBaseLine(nowIso(NOW))}`);
    expect(door.props.accessibilityHint).toBe(SETTINGS.rowA11yHint);
    expect(has(tree, 'saju-yard-status-today-chevron')).toBe(true);
    for (const k of READY_ROWS) {
      const node = must(tree, `saju-yard-row-${k}`);
      expect(node.props.accessibilityRole).toBe('button');
      expect(String(node.props.accessibilityLabel)).toContain(textOf(tree, `saju-yard-row-${k}-line`) as string);
      expect(node.props.accessibilityHint).toBe(SETTINGS.rowA11yHint);
    }
    for (const k of ['guide', 'edit', 'consent']) {
      const node = must(tree, `saju-yard-link-${k}`);
      expect(node.props.accessibilityRole).toBe('button');
      expect(typeof node.props.accessibilityLabel).toBe('string');
    }
    expect(find(tree, 'saju-yard-header')).not.toBeNull();
  });
});
