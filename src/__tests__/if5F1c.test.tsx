// IF5-F1c 시험 — ⓐ 상대와 함께 보기 새 규칙(함께 무난한 날) ⓑ 윤달 줄 ⓒ 충전 잠김 두 줄 ⓓ 내 원국 없음 길 · 상대 값 일지 하나 · 네트워크 0
import fs from 'node:fs';
import path from 'node:path';

import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createDemoSaju } from '@/demo/sajuDemo';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi } from '@/features/mileage/mileageApi';
import { MileageScreen } from '@/features/mileage/MileageScreen';
import type { MileageDeps } from '@/features/mileage/mileageService';
import { partnerBranch } from '@/features/saju/partnerLocal';
import { PartnerSheet } from '@/features/saju/PartnerSheet';
import { SajuCalendarScreen } from '@/features/saju/SajuCalendarScreen';
import { createSajuApi } from '@/features/saju/sajuApi';
import { lunarOf } from '@/features/saju/sajuLogic';
import { day_branch_of_pillar, pair_ok_days_iso, partner_day_branch } from '@/saju5/pair5';
import { build_chart } from '@/saju5/saju_calc5';
import { lunarToSolar } from '@/saju5/lunar5';

import { allTexts, has, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, useFocusEffect: () => undefined, Redirect: () => null }));
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
  mockRouter.push.mockClear();
  for (const k of Object.keys(mockParams)) delete mockParams[k];
});
const NOW = Date.parse('2027-03-20T03:00:00Z');
const TODAY = '2027-03-20';
const pad = (n: number) => String(n).padStart(2, '0');
const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const flagsOn = () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])) as Record<string, boolean>;

type Call = { fn: string; args: Record<string, unknown> };
/** 내 생일(데모 계정) → 서버 모의 api. calls 에 서버로 간 요청을 모은다. */
function rigApi(birthDate: string | null, consentOn = true) {
  const flags = flagsOn();
  const demo = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate, consentOn: () => consentOn }), today: () => TODAY });
  const calls: Call[] = [];
  const api = createSajuApi(async (fn, args = {}) => (calls.push({ fn, args }), demo.rpc({ id: 'u', email: 'sj@email.com' }, fn, args)));
  return { api, calls };
}
const dayBranchOfBirth = (iso: string): number => partner_day_branch({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)), hour: null, minute: null });

/** 날짜 고르기를 열고 상대 생일을 넣어 합쳐 본 뒤, 달력에서 '함께 무난한 날' 라벨이 붙은 날 번호 집합을 돌려준다 */
async function bothDaysOnScreen(mineBirth: string, partnerDigits: string, use = 0) {
  const { api, calls } = rigApi(mineBirth);
  const tree = keep(await mount(<SajuCalendarScreen api={api} now={() => NOW} mode="pick" use={use} consent={createIf5ConsentStore()} />));
  await wait(60);
  await press(tree, 'saju-cal-partner-open');
  await wait(40);
  await press(tree, 'saju-cal-partner-sheet-ck20-check');
  await typeInto(tree, 'saju-cal-partner-sheet-birth', partnerDigits);
  await press(tree, 'saju-cal-partner-sheet-go');
  await wait(40);
  const label = IF5_TEXT['SAJU.pick.partner.both'];
  const days = new Set(
    tree.root
      .findAll((n) => /^saju-cal-day-\d+$/.test(String(n.props.testID ?? '')) && String(n.props.accessibilityLabel ?? '').includes(label))
      .map((n) => Number(String(n.props.testID).slice('saju-cal-day-'.length))),
  );
  const rests = new Set(
    tree.root
      .findAll((n) => /^saju-cal-day-\d+$/.test(String(n.props.testID ?? '')) && String(n.props.accessibilityLabel ?? '').includes(IF5_TEXT['SAJU.pick.rest']))
      .map((n) => Number(String(n.props.testID).slice('saju-cal-day-'.length))),
  );
  return { tree, calls, days, rests };
}
const expectedBoth = (mineBirth: string, partnerDigits: string, purpose: string): Set<number> => {
  const mine = dayBranchOfBirth(mineBirth);
  const theirs = dayBranchOfBirth(`${partnerDigits.slice(0, 4)}-${partnerDigits.slice(4, 6)}-${partnerDigits.slice(6, 8)}`);
  return new Set(
    pair_ok_days_iso('2027-03-01', '2027-03-31', purpose, mine, theirs)
      .filter((d) => d.both_ok)
      .map((d) => Number(d.date.slice(8, 10))),
  );
};

// ── ⓐ 새 규칙: 사람마다 달라진다 ──────────────────────────────────────────────
describe('IF5-F1c ⓐ 상대와 함께 보기 — 함께 무난한 날', () => {
  const MINE_A = '1994-03-14';
  const PARTNER = '19920802';
  // 일지가 다른 내 생일을 하나 더 찾는다(데모 가상 사람)
  const MINE_B = (() => {
    const a = dayBranchOfBirth(MINE_A);
    for (let d = 1; d <= 28; d += 1) {
      const iso = `1990-05-${pad(d)}`;
      const b = dayBranchOfBirth(iso);
      if (b !== a && (b - a + 12) % 12 !== 6) return iso;
    }
    throw new Error('no second birth');
  })();

  test('내 일지가 다르면 표시되는 날이 다르다(쉬어 가는 날은 모두에게 같음 — 사람마다 다른 것은 자기 일지와의 부딪힘)', async () => {
    expect(dayBranchOfBirth(MINE_A)).not.toBe(dayBranchOfBirth(MINE_B));
    const a = await bothDaysOnScreen(MINE_A, PARTNER);
    const b = await bothDaysOnScreen(MINE_B, PARTNER);
    expect(a.days.size).toBeGreaterThan(0);
    expect(b.days.size).toBeGreaterThan(0);
    expect([...a.days].sort((x, y) => x - y)).not.toEqual([...b.days].sort((x, y) => x - y));
    // 화면 표시 = pair5.pair_ok_days_iso 의 both_ok 그대로
    expect([...a.days].sort((x, y) => x - y)).toEqual([...expectedBoth(MINE_A, PARTNER, 'moving')].sort((x, y) => x - y));
    expect([...b.days].sort((x, y) => x - y)).toEqual([...expectedBoth(MINE_B, PARTNER, 'moving')].sort((x, y) => x - y));
  });
  test('상대가 다르면 다르다 · 쉬어 가는 날은 함께 무난한 날이 아니다 · 목적마다 쉬어 가는 날이 다르면 표시도 따른다', async () => {
    const p1 = await bothDaysOnScreen(MINE_A, '19920802');
    const p2 = await bothDaysOnScreen(MINE_A, '19881125');
    expect([...p1.days].sort((x, y) => x - y)).not.toEqual([...p2.days].sort((x, y) => x - y));
    for (const r of p1.rests) expect(p1.days.has(r)).toBe(false);
    for (const r of p2.rests) expect(p2.days.has(r)).toBe(false);
    const wed = await bothDaysOnScreen(MINE_A, '19920802', 6); // 결혼식 용도
    expect([...wed.days].sort((x, y) => x - y)).toEqual([...expectedBoth(MINE_A, '19920802', 'wedding')].sort((x, y) => x - y));
  });
  test('규칙 자체: 두 사람 모두 일지 충 0 + 쉬어 가는 날 아님(상대를 안 주면 나 혼자 기준) · 점수 · 판정 · 순위 필드 0', () => {
    const mine = dayBranchOfBirth(MINE_A);
    const theirs = dayBranchOfBirth('1992-08-02');
    const solo = pair_ok_days_iso('2027-03-01', '2027-03-31', 'moving', mine, null);
    const both = pair_ok_days_iso('2027-03-01', '2027-03-31', 'moving', mine, theirs);
    expect(both).toHaveLength(31);
    expect(Object.keys(both[0]).sort()).toEqual(['both_ok', 'date']);
    both.forEach((d, i) => expect(!d.both_ok || solo[i].both_ok).toBe(true)); // 둘이 보면 나 혼자 보다 좁아질 뿐
    expect(both.filter((d) => d.both_ok).length).toBeLessThanOrEqual(solo.filter((d) => d.both_ok).length);
    expect(day_branch_of_pillar(0)).toBe(0);
    expect(day_branch_of_pillar(59)).toBe(11);
  });
  test('화면 글: 스위치 · 범례는 카피 그대로(함께 보기 · 둘 다 편한 날 — 기본 범례 '무난해요'와 낱말이 겹치지 않는다, IF5-QF M-QF) · 점수 · 퍼센트 · 판정 · 이름 0 · 켜면 범례 · 끄면 표시 0', async () => {
    const a = await bothDaysOnScreen(MINE_A, PARTNER);
    const texts = allTexts(a.tree);
    expect(texts).toContain(IF5_TEXT['SAJU.pick.partner.toggle']);
    expect(IF5_TEXT['SAJU.pick.partner.toggle']).toBe('상대와 함께 보기');
    expect(IF5_TEXT['SAJU.pick.partner.both']).toBe('둘 다 편한 날');
    expect(IF5_TEXT['SAJU.pick.partner.both']).not.toContain(IF5_TEXT['SAJU.pick.plain']);
    expect(has(a.tree, 'saju-cal-legend-both')).toBe(true);
    expect(texts.join(' ')).not.toMatch(/점수|퍼센트|%|판정|이름을|잘 맞|궁합/);
    await press(a.tree, 'saju-cal-partner-toggle');
    expect(a.tree.root.findAll((n) => String(n.props.accessibilityLabel ?? '').includes(IF5_TEXT['SAJU.pick.partner.both'])).length).toBe(0);
    expect(has(a.tree, 'saju-cal-legend-both')).toBe(false);
  });
});

describe('IF5-QF M-QF 함께 보기 날 카드 한 줄', () => {
  test('◇ 날은 규칙 한 줄(bothCard) · 표시 없는 날은 사실 한 줄(noMark) · 쉬어 가는 날 · 끄면 두 줄 모두 0 · 판정 낱말 0', async () => {
    const a = await bothDaysOnScreen(MINE_A, PARTNER);
    const dayIds = (set: Set<number>) => [...set].sort((x, y) => x - y);
    const both = dayIds(a.days);
    expect(both.length).toBeGreaterThan(0);
    const allDays = Array.from({ length: 31 }, (_, i) => i + 1);
    const plain = allDays.filter((d) => !a.days.has(d) && !a.rests.has(d));
    expect(plain.length).toBeGreaterThan(0);
    await press(a.tree, `saju-cal-day-${both[0]}`);
    expect(textOf(a.tree, 'saju-cal-day-together')).toBe(IF5_TEXT['SAJU.pick.partner.bothCard']);
    await press(a.tree, `saju-cal-day-${plain[0]}`);
    expect(textOf(a.tree, 'saju-cal-day-together')).toBe(IF5_TEXT['SAJU.pick.partner.noMark']);
    if (a.rests.size > 0) {
      await press(a.tree, `saju-cal-day-${[...a.rests][0]}`);
      expect(has(a.tree, 'saju-cal-day-together')).toBe(false);
    }
    expect(`${IF5_TEXT['SAJU.pick.partner.bothCard']} ${IF5_TEXT['SAJU.pick.partner.noMark']}`).not.toMatch(/점수|퍼센트|%|판정|피하|부딪힌다|때문|추천|좋은|나쁜|!/);
    await press(a.tree, 'saju-cal-partner-toggle'); // 끔
    await press(a.tree, `saju-cal-day-${plain[0]}`);
    expect(has(a.tree, 'saju-cal-day-together')).toBe(false);
  });
});

// ── ⓓ 상대 값은 일지 숫자 하나 · 네트워크 · 저장 0 ───────────────────────────────
describe('IF5-F1c 상대 값 일지 하나 · fetch · rpc · 저장 0', () => {
  test('partnerBranch 가 돌려주는 것은 {kind, branch} 뿐 · 같은 날 태어난 사람은 시각이 있든 없든 같은 숫자', () => {
    const r = partnerBranch({ birthDigits: '19920802', time: null }, TODAY);
    expect(r.kind).toBe('ok');
    expect(Object.keys(r).sort()).toEqual(['branch', 'kind']);
    const withTime = partnerBranch({ birthDigits: '19920802', time: { hour: 14, minute: 30 } }, TODAY);
    expect(withTime).toEqual(r);
    expect(JSON.stringify(r)).not.toMatch(/1992|0802|stem|pillar|ganji/);
    expect(partnerBranch({ birthDigits: '20100101', time: null }, TODAY)).toEqual({ kind: 'minor' });
    expect(partnerBranch({ birthDigits: '19600101', time: null }, TODAY)).toEqual({ kind: 'outOfRange' });
    expect(partnerBranch({ birthDigits: '20271231', time: null }, TODAY)).toEqual({ kind: 'outOfRange' }); // 미래
    expect(partnerBranch({ birthDigits: '19920230', time: null }, TODAY)).toEqual({ kind: 'outOfRange' }); // 없는 날
  });
  test('시트가 화면에 넘기는 것도 {kind, branch} 하나뿐(생일 · 시각 · 기둥 0)', async () => {
    const pick = jest.fn();
    const tree = keep(await mount(<PartnerSheet visible mine={null} today={() => TODAY} onClose={() => undefined} consent={createIf5ConsentStore()} pick={pick} testID="ps" />));
    await press(tree, 'ps-ck20-check');
    await typeInto(tree, 'ps-birth', '19920802');
    await press(tree, 'ps-go');
    expect(pick).toHaveBeenCalledTimes(1);
    const got = pick.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(got).sort()).toEqual(['branch', 'kind']);
    expect(typeof got.branch).toBe('number');
    expect(JSON.stringify(got)).not.toMatch(/1992|0802/);
  });
  test('화면 상태: 상대 칸은 숫자 하나(PartnerBranch.branch) · 쉬어 가는 날 가르개 · 차트 쥐기 0 — 소스 점검', () => {
    const cal = src('features/saju/SajuCalendarScreen.tsx');
    expect(cal).toContain('const [partner, setPartner] = useState<number | null>(null)');
    expect(cal).not.toMatch(/restOn|partnerRest|build_chart|facts_compat/);
    expect(src('features/saju/partnerLocal.ts')).not.toMatch(/restOn|taekil\(/);
  });
  test('네트워크 0: 합쳐 보는 동안 fetch 0 · 서버 요청은 날짜 고르기와 내 원국 읽기뿐(내 시각 · 곳 null) · 상대 생일 · 일지가 인자에 없음 · 저장 소스 0', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
    const { calls, days } = await bothDaysOnScreen('1994-03-14', '19920802');
    expect(days.size).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(new Set(calls.map((c) => c.fn))).toEqual(new Set(['get_my_saju', 'get_taekil']));
    const mineCall = calls.find((c) => c.fn === 'get_my_saju');
    expect(mineCall?.args).toEqual({ p_hour: null, p_minute: null, p_place: null });
    expect(JSON.stringify(calls)).not.toMatch(/1992|0802|19920802/);
    expect(calls.filter((c) => c.fn === 'get_my_saju')).toHaveLength(1); // 한 번 읽고 다시 읽지 않는다
    const pair = src('saju5/pair5.ts');
    expect(pair).not.toMatch(/fetch\(|\.rpc\(|supabase|AsyncStorage|SecureStore|localStorage|console\.|safeLog/);
    expect(src('features/saju/partnerLocal.ts')).not.toMatch(/fetch\(|\.rpc\(|supabase|AsyncStorage|SecureStore|safeLog|console\./);
    expect(src('features/saju/SajuCalendarScreen.tsx')).not.toMatch(/AsyncStorage|SecureStore|localStorage|safeLog|console\./);
  });
});

// ── ⓓ 내 원국이 없는 길 ──────────────────────────────────────────────────────
describe('IF5-F1c 내 원국 없음 — 함께 보기 전에 내 칸 입력부터', () => {
  const missingCase = async (api: Parameters<typeof SajuCalendarScreen>[0]['api']) => {
    const tree = keep(await mount(<SajuCalendarScreen api={api} now={() => NOW} mode="pick" use={0} consent={createIf5ConsentStore()} />));
    await wait(60);
    await press(tree, 'saju-cal-partner-open');
    await wait(40);
    return tree;
  };
  const expectGuide = async (tree: ReactTestRenderer) => {
    expect(has(tree, 'saju-cal-mine-missing')).toBe(true);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.status.empty']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.madang.fillIn']);
    expect(has(tree, 'saju-cal-partner-sheet-birth')).toBe(false); // 상대 생일 시트는 열리지 않는다
    expect(has(tree, 'saju-cal-partner-toggle')).toBe(false);
    expect(has(tree, 'saju-cal-partner-open')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/점수|판정|%/);
    await press(tree, 'saju-cal-mine-fill');
    expect(mockRouter.push).toHaveBeenCalledWith('/saju');
  };
  test('동의 안 함(CK17A 꺼짐 → consent_required)', async () => {
    const { api, calls } = rigApi('1994-03-14', false);
    await expectGuide(await missingCase(api));
    expect(calls.filter((c) => c.fn === 'get_my_saju')).toHaveLength(1);
  });
  test('미입력(생년월일 없음 → state none)', async () => {
    const { api } = rigApi(null);
    await expectGuide(await missingCase(api));
  });
  test('범위 밖(1961-08-10 이전 출생 → out_of_range)', async () => {
    const { api } = rigApi('1950-01-01');
    await expectGuide(await missingCase(api));
  });
  test('원국 읽기 연결이 없는 화면(주입 api 에 chart 없음)도 같은 안내', async () => {
    await expectGuide(await missingCase({ taekil: jest.fn(async () => ({ ok: true as const, data: { purpose: 'moving', days: [] } })) }));
  });
  test('읽다가 끊기면 안내 대신 잠시 뒤 다시 한 줄 · 단추는 그대로 있어 다시 누를 수 있다(자동 재시도 0)', async () => {
    const chart = jest.fn(async () => ({ ok: false as const, code: 'network' as const }));
    const tree = await missingCase({ taekil: jest.fn(async () => ({ ok: true as const, data: { purpose: 'moving', days: [] } })), chart });
    expect(has(tree, 'saju-cal-mine-missing')).toBe(false);
    expect(textOf(tree, 'saju-cal-mine-fail')).toBe(IF5_TEXT['SAJU.status.errBody']);
    expect(has(tree, 'saju-cal-partner-open')).toBe(true);
    expect(chart).toHaveBeenCalledTimes(1);
    await wait(100);
    expect(chart).toHaveBeenCalledTimes(1);
    await press(tree, 'saju-cal-partner-open');
    await wait(30);
    expect(chart).toHaveBeenCalledTimes(2);
  });
  test('원국이 있으면 안내 0 · 단추를 누르면 상대 생일 시트가 열린다', async () => {
    const { api } = rigApi('1994-03-14');
    const tree = await missingCase(api);
    expect(has(tree, 'saju-cal-mine-missing')).toBe(false);
    expect(has(tree, 'saju-cal-partner-sheet-birth')).toBe(true);
    expect(has(tree, 'saju-cal-partner-sheet-ck20-check')).toBe(true);
  });
  test('내 일지는 원국의 일주에서만(day_branch_of_pillar) — 서버 모의 응답의 일지와 생일 계산이 같다', () => {
    const chart = build_chart({ year: 1994, month: 3, day: 14, hour: null, minute: null });
    expect(day_branch_of_pillar(chart.pillars.day)).toBe(dayBranchOfBirth('1994-03-14'));
    expect(src('features/saju/SajuCalendarScreen.tsx')).toContain('day_branch_of_pillar(idx)');
  });
});

// ── ⓑ 윤달 줄 ───────────────────────────────────────────────────────────────
describe('IF5-F1c ⓑ 윤달 표기', () => {
  const lunarLine = async (solar: { year: number; month: number; day: number }) => {
    const now = Date.parse(`${solar.year}-${pad(solar.month)}-${pad(solar.day)}T03:00:00Z`);
    const tree = keep(await mount(<SajuCalendarScreen api={{ taekil: jest.fn() }} now={() => now} mode="cal" />));
    await wait(40);
    await press(tree, `saju-cal-day-${solar.day}`);
    return textOf(tree, 'saju-cal-day-lunar');
  };
  test('lunarOf 는 달 번호와 윤달 여부를 따로 준다', () => {
    const s = lunarToSolar(2025, 6, 1, true);
    expect(lunarOf(`${s.year}-${pad(s.month)}-${pad(s.day)}`)).toEqual({ month: 6, leap: true, day: 1 });
    expect(lunarOf('2025-01-29')).toEqual({ month: 1, leap: false, day: 1 });
  });
  test('윤달 날은 "음력 윤{월}월 {일}일"(SAJU.cal.day.lunarLeap) · 평달은 "음력 {월}월 {일}일"(SAJU.cal.day.lunar)', async () => {
    expect(IF5_TEXT['SAJU.cal.day.lunarLeap']).toBe('음력 윤{월}월 {일}일');
    const s = lunarToSolar(2025, 6, 1, true);
    expect(await lunarLine(s)).toBe('음력 윤6월 1일');
    const l = lunarOf(`${s.year}-${pad(s.month)}-${pad(s.day)}`);
    expect(await lunarLine(s)).toBe(t5('SAJU.cal.day.lunarLeap', { 월: String(l?.month), 일: l?.day ?? 0 }));
    const plain = await lunarLine({ year: 2025, month: 1, day: 29 });
    expect(plain).toBe('음력 1월 1일');
    expect(plain).not.toContain('윤');
  });
  test('윤달인 해의 같은 번호 평달은 윤 글자 0(2025 음력 6월 1일)', async () => {
    const s = lunarToSolar(2025, 6, 1, false);
    const line = await lunarLine(s);
    expect(line).toBe('음력 6월 1일');
  });
});

// ── ⓒ 충전 잠김 두 줄 ───────────────────────────────────────────────────────
describe('IF5-F1c ⓒ 충전 잠김 — 이유 한 줄 + 둘째 줄', () => {
  const rig = (email: string, over: Record<string, boolean> = {}) => {
    const flags = { ...flagsOn(), ...over };
    const demo = createDemoMileage({ flags: async () => flags, boardedRounds: async () => 0 });
    const call = async (fn: string, args: Record<string, unknown> = {}) => demo.rpc({ id: 'u-lock', email }, fn, args);
    const deps: MileageDeps = { api: createMileageApi(call), edge: createLedgerEdge(call), isOn: (k) => flags[k] === true };
    return deps;
  };
  test('잠기면 첫 줄 MILEAGE.shop.locked 아래에 둘째 줄 MILEAGE.shop.lockedKeep · 그 아래 고객센터 단추 · 순서', async () => {
    const tree = keep(await mount(<MileageScreen deps={rig('mbig@email.com')} />));
    await wait(40);
    expect(textOf(tree, 'mileage-locked-text')).toBe('최근 스토어 환불이 여러 번 있어서 지금은 충전이 멈춰 있어요.');
    expect(textOf(tree, 'mileage-locked-keep')).toBe('가진 마일리지는 그대로 쓸 수 있어요.');
    expect(textOf(tree, 'mileage-locked-keep')).toBe(IF5_TEXT['MILEAGE.shop.lockedKeep']);
    const card = must(tree, 'mileage-locked');
    const order = card.findAll((n) => typeof n.props.testID === 'string' && String(n.props.testID).startsWith('mileage-locked')).map((n) => String(n.props.testID));
    const uniq = [...new Set(order)].filter((t) => t !== 'mileage-locked');
    expect(uniq).toEqual(['mileage-locked-text', 'mileage-locked-keep', 'mileage-locked-support']);
    expect(has(tree, 'mileage-products')).toBe(false);
    expect(has(tree, 'mileage-balance')).toBe(true);
    expect(allTexts(tree).join(' ')).not.toMatch(/90일|환불 횟수|\d+회/);
  });
  test('잠기지 않았으면 둘째 줄 0 · 점검 글에도 0', async () => {
    const ok = keep(await mount(<MileageScreen deps={rig('sj@email.com')} />));
    await wait(40);
    expect(has(ok, 'mileage-locked-keep')).toBe(false);
    const maint = keep(await mount(<MileageScreen deps={rig('sj@email.com', { mileage_charge: false })} />));
    await wait(40);
    expect(has(maint, 'mileage-locked-keep')).toBe(false);
    expect(allTexts(maint)).not.toContain(IF5_TEXT['MILEAGE.shop.lockedKeep']);
  });
});
