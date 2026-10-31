// IF5-F1b 시험 — F1 이 비운 칸 채우기: ⓐ 음력 줄 ⓑ 숨은 글자 ⓒ G-06 만난 날의 하늘 ⓓ READ_GUIDE 연결 ⓔ 날짜 고르기 상대와 합쳐 보기 + 새 키 12 ⓕ 디자인 아이콘 22 ⓖ 서버 스위치 14키 · 월운 달 이름 + M-F2 둘(충전 잠김 · 종합 풀이 이름)
import fs from 'node:fs';
import path from 'node:path';

import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import featureKeysJson from '@/config/featureKeys.json';
import { IF3_TEXT } from '@/content/if3Copy';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { IF5_KEEP_NOTE_ON } from '@/config/laterConsent';
import { guardSystemPath, LINK_HOME, MAX_LINK_CHARS } from '@/lib/linkGuard';
import { redirectSystemPath } from '@/app/+native-intent';
import { logRecord5 } from '@/server/ait/sajuRoute';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createDemoSaju } from '@/demo/sajuDemo';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import { createDeviceNotes, memoryNoteStorage } from '@/features/inflight/deviceNotes';
import { MemoSheet } from '@/features/inflight/If2Sheets';
import { MEET_SKY_RANGE, meetSkyOf } from '@/features/inflight/if3Logic';
import { MeetSky } from '@/features/inflight/MeetSky';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi } from '@/features/mileage/mileageApi';
import { MileageScreen } from '@/features/mileage/MileageScreen';
import type { MileageDeps } from '@/features/mileage/mileageService';
import { SUPPORT } from '@/content/copy';
import { takeSettingsPage } from '@/features/settings/settingsIntent';
import { ReadGuide, readGuideEntries } from '@/features/inflight/ReadGuide';
import { SkyBookScreen } from '@/features/inflight/SkyBookScreen';
import { IF5_ICON_NAMES } from '@/features/saju/If5Icon';
import { IF5_ICON_PATHS } from '@/features/saju/if5IconPaths';
import { partnerRest } from '@/features/saju/partnerLocal';
import { SajuCalendarScreen } from '@/features/saju/SajuCalendarScreen';
import { createSajuApi, parseMyLuck } from '@/features/saju/sajuApi';
import { ageSpan, chartOf, hiddenRows, lunarOf, yearView, type ReadyChart, type ReadyLuck } from '@/features/saju/sajuLogic';
import { hiddenStems, hiddenStemSipsung } from '@/saju5/jijanggan5';
import { leapMonthOf, lunarToSolar, solarToLunar } from '@/saju5/lunar5';

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
const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const pad = (n: number) => String(n).padStart(2, '0');

// ── ⓐ 음력 줄 ───────────────────────────────────────────────────────────────
describe('IF5-F1b ⓐ 음력 줄', () => {
  test('양력 ↔ 음력 바꾸기: 알려진 날(2025-01-29 = 음력 1월 1일) · 윤달은 달 앞에 윤 · 범위(1960-01-01 ~ 2051-12-31) 밖은 줄 숨김(null)', () => {
    expect(solarToLunar(2025, 1, 29)).toEqual({ year: 2025, month: 1, day: 1, leap: false });
    expect(lunarOf('2025-01-29')).toEqual({ month: '1', day: 1 });
    expect(leapMonthOf(2025)).toBe(6);
    const s = lunarToSolar(2025, 6, 1, true);
    expect(lunarOf(`${s.year}-${pad(s.month)}-${pad(s.day)}`)).toEqual({ month: '윤6', day: 1 });
    expect(lunarOf('1959-12-31')).toBeNull();
    expect(lunarOf('2052-01-01')).toBeNull();
    expect(lunarOf('2027-02-30')).toBeNull(); // 없는 날
    expect(lunarOf('아무말')).toBeNull();
    expect(lunarOf('1960-01-01')).not.toBeNull();
    expect(lunarOf('2051-12-31')).not.toBeNull();
  });
  test('만세력 달력: 날짜를 누르면 그날 한 장에 음력 줄(카피 SAJU.cal.day.lunar 틀) · 경계 달 단서 글 0', async () => {
    const tree = keep(await mount(<SajuCalendarScreen api={{ taekil: jest.fn() }} now={() => NOW} mode="cal" />));
    await wait(40);
    await press(tree, 'saju-cal-day-5');
    const lunar = textOf(tree, 'saju-cal-day-lunar') ?? '';
    expect(lunar).toMatch(/^음력 윤?\d+월 \d+일$/);
    const l = lunarOf('2027-03-05');
    expect(lunar).toBe(t5('SAJU.cal.day.lunar', { 월: String(l?.month), 일: l?.day ?? 0 }));
    expect(allTexts(tree).join(' ')).not.toMatch(/경계|절기 달|이 달은/); // 경계 달 단서 0
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.cal.hint']); // 힌트의 '음력' 약속이 이제 지켜진다
  });
});

// ── ⓑ 숨은 글자 ─────────────────────────────────────────────────────────────
describe('IF5-F1b ⓑ 숨은 글자(통설 표)', () => {
  const chartReady = { state: 'ready', hourKnown: true, day: { stem: 2, branch: 4 }, hour: { stem: 8, branch: 2 }, options: [{ year: { stem: 6, branch: 10 }, month: { stem: 8, branch: 2 } }], flags: [] } as ReadyChart;
  test('지지마다 숨은 천간 2 ~ 3개 · 줄마다 쉬운 이름(한자 · 갈래 · 여기 중기 정기 낱말 0)', () => {
    for (let b = 0; b < 12; b += 1) expect([2, 3]).toContain(hiddenStems(b).length);
    expect(hiddenStemSipsung(2, 0)).toHaveLength(2);
    const chart = chartOf(chartReady);
    if (!chart) throw new Error('chart');
    const rows = hiddenRows(chart);
    expect(rows.map((r) => r.pos)).toEqual(['해', '달', '날', '시']);
    for (const r of rows) {
      expect(r.text).toMatch(/^[가-힣]\([가-힣 ]+\)(, [가-힣]\([가-힣 ]+\))*$/);
      expect(r.text).not.toMatch(/[一-鿿]|갈래|여기|중기|정기|가안/);
    }
  });
  test('갈래(variants)는 화면 코드 어디서도 부르지 않는다 · 숨은 글자 줄은 카피 SAJU.table.row.hidden 이름으로', () => {
    for (const f of ['features/saju/SajuMadangScreen.tsx', 'features/saju/SajuParts.tsx', 'features/saju/sajuLogic.ts']) expect(src(f)).not.toMatch(/hiddenStemVariants|HIDDEN_STEM_STATUS|jijanggan5.json/);
    expect(src('features/saju/SajuMadangScreen.tsx')).toContain('SAJU.table.row.hidden');
  });
});

// ── ⓒ G-06 만난 날의 하늘 ───────────────────────────────────────────────────
describe('IF5-F1b ⓒ 만난 날의 하늘', () => {
  test('일별 표 범위 2027-01-01 ~ 2028-12-31 · 안은 달 모양 + 절기만 한 줄 · 밖은 null', () => {
    expect(MEET_SKY_RANGE).toEqual({ first: '2027-01-01', last: '2028-12-31' });
    expect(meetSkyOf('2026-12-31')).toBeNull();
    expect(meetSkyOf('2029-01-01')).toBeNull();
    expect(meetSkyOf(null)).toBeNull();
    expect(meetSkyOf('2027-02-30')).toBeNull();
    const day = meetSkyOf('2027-01-05'); // 소한이 든 날
    expect(day?.term).toBe('그날은 스물네 절기 중 소한이었어요.');
    const week = meetSkyOf('2027-01-06'); // 소한이 든 주(목 ~ 수)
    expect(week?.term).toBe('그날이 든 주에는 스물네 절기 중 소한이 있었어요.');
    const none = meetSkyOf('2027-01-12');
    expect(none?.term).toBeNull();
    expect(none?.line).toBe(none?.moon);
    expect(meetSkyOf('2027-02-04')?.term).toMatch(/입춘이었어요/); // 받침 있는 절기
  });
  test('전 범위 731일: 한 줄이 있고 별자리 · 숫자 · 판정 · 인연 말 0 · 조사 자리({ }) 남지 않음', () => {
    const t0 = Date.UTC(2027, 0, 1);
    for (let i = 0; i < 731; i += 1) {
      const d = new Date(t0 + i * 86400000).toISOString().slice(0, 10);
      const m = meetSkyOf(d);
      expect(m).not.toBeNull();
      expect(m?.line).not.toMatch(/\d|\{|\}|별자리|운세|좋은 날|나쁜|인연/);
    }
  });
  test('MeetSky 칸: 빈 → 고르기 → 한 줄(날짜 + 하늘) → 지우기 · 표 밖 날은 unavailable · 오늘 뒤 날은 못 누름', async () => {
    let day: string | null = null;
    const changes: (string | null)[] = [];
    const render = (d: string | null) => <MeetSky day={d} onChange={(v) => (changes.push(v), (day = v))} now={() => NOW} />;
    const tree = keep(await mount(render(null)));
    expect(textOf(tree, 'meet-sky-empty')).toBe(IF3_TEXT['MEET_SKY.empty']);
    expect(textOf(tree, 'meet-sky-title')).toBe(IF3_TEXT['MEET_SKY.title']);
    expect(textOf(tree, 'meet-sky-note')).toBe(IF3_TEXT['MEET_SKY.note']);
    await press(tree, 'meet-sky-pick');
    expect(has(tree, 'meet-sky-picker')).toBe(true);
    expect(must(tree, 'meet-sky-day-25').props.disabled).toBe(true);
    await press(tree, 'meet-sky-day-5');
    expect(changes).toEqual(['2027-03-05']);
    await act(async () => tree.update(render(day)));
    expect(has(tree, 'meet-sky-picker')).toBe(false);
    expect(textOf(tree, 'meet-sky-date')).toBe('3월 5일');
    expect(textOf(tree, 'meet-sky-text')).toBe(meetSkyOf('2027-03-05')?.line);
    expect(String(must(tree, 'meet-sky-line').props.accessibilityLabel)).toBe(`만난 날의 하늘, 3월 5일, ${meetSkyOf('2027-03-05')?.line}`);
    await press(tree, 'meet-sky-clear');
    expect(changes[changes.length - 1]).toBeNull();
    await act(async () => tree.update(render('2026-05-05'))); // 표 밖
    expect(textOf(tree, 'meet-sky-unavailable')).toBe(IF3_TEXT['MEET_SKY.unavailable']);
    expect(has(tree, 'meet-sky-text')).toBe(false);
  });
  test('돌아보기 메모: 스위치 meet_sky 켜짐 → 고른 날이 메모와 함께 기기 저장소에만 남는다 · 꺼짐이면 칸 0', async () => {
    const notes = createDeviceNotes(memoryNoteStorage());
    await notes.load();
    const toast = jest.fn();
    const onClose = jest.fn();
    const tree = keep(await mount(<MemoSheet visible roomId="room-1" closedAt={null} onClose={onClose} onToast={toast} notes={notes} skyOn now={() => NOW} />));
    expect(has(tree, 'if2-memo-sky')).toBe(true);
    await press(tree, 'if2-memo-sky-pick');
    await press(tree, 'if2-memo-sky-day-8');
    await press(tree, 'if2-memo-save');
    expect(notes.get().memos['room-1']?.skyDay).toBe('2027-03-08');
    const off = keep(await mount(<MemoSheet visible roomId="room-2" closedAt={null} onClose={onClose} onToast={toast} notes={notes} now={() => NOW} />));
    expect(has(off, 'if2-memo-sky')).toBe(false);
  });
  test('G-06 는 서버 · 네트워크를 부르지 않는다(정적) · 생성 사본 skyDaily.json 은 달 모양 + 절기만', () => {
    for (const f of ['features/inflight/MeetSky.tsx', 'features/inflight/if3Logic.ts']) expect(src(f)).not.toMatch(/fetch\(|\.rpc\(|supabase|safeLog|console\./);
    const d = JSON.parse(src('content/skyDaily.json')) as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(['alt', 'days', 'stage', 'start', 'terms', '범위'].sort());
    expect(JSON.stringify(d)).not.toMatch(/sign|별자리|zodiac/);
  });
});

// ── ⓓ READ_GUIDE ────────────────────────────────────────────────────────────
describe('IF5-F1b ⓓ 읽는 법 연결', () => {
  test('접힌 채 시작 · 펼침을 기억하지 않음(다시 만들면 접힘) · 낱말 풀이 30편(hw-01 · 23 뺌) · 읽기 이름 {낱말}, {풀이}', async () => {
    const tree = keep(await mount(<ReadGuide />));
    expect(String(must(tree, 'read-guide-toggle').props.accessibilityLabel)).toBe(IF3_TEXT['READ_GUIDE.a11y.open']);
    expect(has(tree, 'read-guide-body')).toBe(false);
    await press(tree, 'read-guide-toggle');
    expect(has(tree, 'read-guide-body')).toBe(true);
    expect(String(must(tree, 'read-guide-toggle').props.accessibilityLabel)).toBe(IF3_TEXT['READ_GUIDE.a11y.close']);
    expect(textOf(tree, 'read-guide-lead')).toBe(IF3_TEXT['READ_GUIDE.lead']);
    const entries = readGuideEntries();
    expect(entries).toHaveLength(30);
    expect(entries.map((e) => e.id)).not.toContain('hw-01');
    expect(entries.map((e) => e.id)).not.toContain('hw-23');
    expect(String(must(tree, 'read-guide-hw-02').props.accessibilityLabel)).toBe(`${entries[0].word}, ${entries[0].text}`);
    await act(async () => tree.unmount());
    const again = keep(await mount(<ReadGuide />));
    expect(has(again, 'read-guide-body')).toBe(false);
  });
  test('하늘 도감 머리: guide(스위치 read_guide)가 켜져야만 · 기내지 ① 쪽 · 도감 라우트도 같은 스위치(소스 점검)', async () => {
    const on = keep(await mount(<SkyBookScreen guide />));
    expect(has(on, 'book-read-guide')).toBe(true);
    expect(allTexts(on)).toContain(IF3_TEXT['READ_GUIDE.title']);
    const off = keep(await mount(<SkyBookScreen />));
    expect(has(off, 'book-read-guide')).toBe(false);
    expect(src('features/inflight/MagazineScreen.tsx')).toContain("isOn('read_guide') ? <ReadGuide");
    expect(src('app/sky-book.tsx')).toContain("guide={isOn('read_guide')}");
  });
});

// ── ⓔ 상대와 합쳐 보기 + 새 키 ──────────────────────────────────────────────
describe('IF5-F1b ⓔ 날짜 고르기 상대와 합쳐 보기', () => {
  test('새 키 12(24-15-1) + M-F2 둘이 사본에 있고 글이 카피 표와 같다', () => {
    const keys = ['SAJU.pillars.col.year', 'SAJU.pillars.col.month', 'SAJU.pillars.col.day', 'SAJU.pillars.col.hour', 'SAJU.pillars.col.a11y', 'SAJU.input.hourUnit', 'SAJU.input.minUnit', 'SAJU.life.age', 'SAJU.pick.partner.toggle', 'SAJU.pick.partner.hint', 'SAJU.pick.partner.both', 'SAJU.pick.partner.need'] as const;
    expect(keys).toHaveLength(12);
    for (const k of keys) expect(typeof IF5_TEXT[k]).toBe('string');
    expect(Object.keys(IF5_TEXT)).toHaveLength(332);
    expect([IF5_TEXT['SAJU.pillars.col.year'], IF5_TEXT['SAJU.pillars.col.month'], IF5_TEXT['SAJU.pillars.col.day'], IF5_TEXT['SAJU.pillars.col.hour']]).toEqual(['해', '달', '날', '시']);
    expect(ageSpan(10, 20)).toBe('10세 ~ 20세');
    expect(IF5_TEXT['MILEAGE.shop.locked']).toBe('지금은 마일리지를 충전할 수 없어요.');
    expect(IF5_TEXT['SAJU.full.label']).toBe('사주 종합 풀이');
  });
  test('partnerRest: 기기 계산 · 만 19세 미만 · 범위 밖 · 쉬어 가는 날만 가른다(생일 · 기둥을 돌려주지 않는다) · 네트워크 · 저장 0(정적)', () => {
    const ok = partnerRest({ birthDigits: '19920802', time: null }, '2027-03-20');
    expect(ok.kind).toBe('ok');
    expect(Object.keys(ok).sort()).toEqual(['kind', 'restOn']);
    if (ok.kind !== 'ok') return;
    let rest = 0;
    for (let d = 1; d <= 31; d += 1) if (ok.restOn(`2027-03-${pad(d)}`, 'moving')) rest += 1;
    expect(rest).toBeGreaterThan(0);
    expect(rest).toBeLessThan(31);
    expect(partnerRest({ birthDigits: '20100101', time: null }, '2027-03-20').kind).toBe('minor');
    expect(partnerRest({ birthDigits: '19600101', time: null }, '2027-03-20').kind).toBe('outOfRange');
    expect(partnerRest({ birthDigits: '123', time: null }, '2027-03-20').kind).toBe('outOfRange');
    expect(src('features/saju/partnerLocal.ts')).not.toMatch(/fetch\(|\.rpc\(|supabase|AsyncStorage|SecureStore|safeLog|console\./);
  });
  test('화면: 상대 생일이 없으면 need 한 줄 + 넣기 단추 → 시트에서 확인 뒤 입력하면 스위치가 켜지고 달력에 겹침 표시 · 네트워크 0 · 점수 · 판정 · 이름 0', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
    const flags = Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)]));
    const demo = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate: '1994-03-14', consentOn: () => true }), today: () => '2027-03-20' });
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const api = createSajuApi(async (fn, args = {}) => (calls.push({ fn, args }), demo.rpc({ id: 'u', email: 'sj@email.com' }, fn, args)));
    const consent = createIf5ConsentStore();
    const tree = keep(await mount(<SajuCalendarScreen api={api} now={() => NOW} mode="pick" use={0} consent={consent} />));
    await wait(60);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.pick.partner.need']);
    expect(has(tree, 'saju-cal-partner-toggle')).toBe(false);
    await press(tree, 'saju-cal-partner-open');
    await press(tree, 'saju-cal-partner-sheet-ck20-check');
    await typeInto(tree, 'saju-cal-partner-sheet-birth', '19920802');
    await press(tree, 'saju-cal-partner-sheet-go');
    await wait(30);
    expect(has(tree, 'saju-cal-partner-toggle')).toBe(true);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.pick.partner.hint']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.pick.partner.toggle']);
    const bothLabel = IF5_TEXT['SAJU.pick.partner.both'];
    const both = tree.root.findAll((n) => /^saju-cal-day-\d+$/.test(String(n.props.testID ?? '')) && String(n.props.accessibilityLabel ?? '').includes(bothLabel));
    expect(both.length).toBeGreaterThan(0);
    expect(has(tree, 'saju-cal-legend-both')).toBe(true);
    expect(allTexts(tree)).toContain(bothLabel);
    await press(tree, 'saju-cal-partner-toggle'); // 끄면 겹침 표시 0
    expect(tree.root.findAll((n) => String(n.props.accessibilityLabel ?? '').includes(bothLabel)).length).toBe(0);
    expect(has(tree, 'saju-cal-legend-both')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/점수|퍼센트|%|판정|이름을|잘 맞/);
    expect(calls.every((c) => c.fn === 'get_taekil')).toBe(true); // 서버로 가는 건 내 날짜 고르기뿐 — 상대 생일 인자 0
    expect(JSON.stringify(calls)).not.toMatch(/1992|0802/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  test('만 19세 미만 상대는 합쳐 보기 0(스위치가 생기지 않고 부드러운 한 줄)', async () => {
    const consent = createIf5ConsentStore();
    const tree = keep(await mount(<SajuCalendarScreen api={{ taekil: jest.fn(async () => ({ ok: true as const, data: { purpose: 'moving', days: [] } })) }} now={() => NOW} mode="pick" use={0} consent={consent} />));
    await wait(40);
    await press(tree, 'saju-cal-partner-open');
    await press(tree, 'saju-cal-partner-sheet-ck20-check');
    await typeInto(tree, 'saju-cal-partner-sheet-birth', '20100101');
    await press(tree, 'saju-cal-partner-sheet-go');
    expect(has(tree, 'saju-cal-partner-sheet-minor')).toBe(true);
    expect(has(tree, 'saju-cal-partner-toggle')).toBe(false);
  });
});

// ── ⓕ 아이콘 22 ─────────────────────────────────────────────────────────────
describe('IF5-F1b ⓕ 디자인 아이콘 22', () => {
  test('원본 22개가 경로 표로 옮겨져 있다 · 색 글자(#…) 0 · 모든 경로가 24 격자 글자만', () => {
    expect(IF5_ICON_NAMES).toHaveLength(22);
    const text = src('features/saju/if5IconPaths.ts');
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|stroke=|fill="/);
    for (const n of IF5_ICON_NAMES) {
      expect(IF5_ICON_PATHS[n].parts.length).toBeGreaterThan(0);
      for (const p of IF5_ICON_PATHS[n].parts) expect(p.d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/);
    }
  });
  test('디자인 원본 폴더가 있으면 svg 22개와 이름이 같다', () => {
    const dir = path.join(__dirname, '..', '..', '..', '디자인', 'IF5', '원본');
    if (!fs.existsSync(dir)) return;
    const names = fs.readdirSync(dir).filter((f) => /^icon_.+\.svg$/.test(f)).map((f) => f.replace(/^icon_|\.svg$/g, ''));
    expect(names.sort()).toEqual([...IF5_ICON_NAMES].sort());
  });
});

// ── ⓖ 서버 스위치 14키 · 월운 달 이름 ───────────────────────────────────────
describe('IF5-F1b ⓖ 서버 스위치 이름 · 월운 달 이름', () => {
  const SERVER_14 = ['saju_home', 'saju_reading', 'saju_season', 'saju_year', 'saju_calendar', 'saju_today', 'saju_pickday', 'saju_partner', 'pair_card_saju', 'saju_ai', 'saju_talk', 'mileage_spend', 'mileage_gift', 'rest_hint'];
  test('앱 IF5 그룹 17키 = 서버 0048 의 3키 + 0050 의 14키 (이름 하나도 다르지 않다)', () => {
    const app = (featureKeysJson.keys as { key: string; group: string }[]).filter((k) => k.group === 'IF5').map((k) => k.key);
    expect(app).toHaveLength(17);
    expect(new Set(app)).toEqual(new Set(['saju_yard', 'mileage', 'mileage_charge', ...SERVER_14]));
    const sql = path.join(__dirname, '..', '..', '..', 'backend', 'migrations', '0050_if5_switches_luck_notice.sql');
    if (fs.existsSync(sql)) {
      const text = fs.readFileSync(sql, 'utf8');
      const block = text.slice(text.indexOf('insert into private.if5_switch_keys'), text.indexOf('on conflict (key) do nothing'));
      const server = [...block.matchAll(/\('([a-z0-9_]+)'\s*,/g)].map((m) => m[1]);
      expect([...server].sort()).toEqual([...SERVER_14].sort());
    }
  });
  test('get_my_luck 월운: 서버 month_name(인월 ~ 축월)을 읽는다 · 데모 모의 서버도 같은 꼴 · 근사 코드(monthOfK) 0', async () => {
    const flags = Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)]));
    const demo = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate: '1994-03-14', consentOn: () => true }), today: () => '2027-03-20' });
    const raw = await demo.rpc({ id: 'u', email: 'sj@email.com' }, 'get_my_luck', { p_year: 2027 });
    const wolun = (raw.data as { wolun: { month_k: number; month_name: string }[] }).wolun;
    expect(wolun.map((w) => w.month_name)).toEqual(['인월', '묘월', '진월', '사월', '오월', '미월', '신월', '유월', '술월', '해월', '자월', '축월']);
    expect(wolun.map((w) => w.month_k)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const luck = parseMyLuck(raw.data);
    if (!luck || luck.state !== 'ready') throw new Error('luck');
    expect(luck.wolun.map((w) => w.monthName)).toEqual(wolun.map((w) => w.month_name));
    // 이름이 없거나 틀린 월운(옛 서버)은 이름을 만들어 내지 않는다
    const bare = parseMyLuck({ state: 'ready', wolun: [{ month_k: 0, stem: 0, branch: 2 }, { month_k: 1, stem: 1, branch: 3, month_name: '엉터리' }] });
    expect(bare && bare.state === 'ready' && bare.wolun.map((w) => w.monthName)).toEqual([null, null]);
    expect(src('features/saju/sajuLogic.ts')).not.toMatch(/monthOfK/);
    const chart = chartOf({ state: 'ready', hourKnown: false, day: { stem: 2, branch: 4 }, hour: null, options: [{ year: { stem: 6, branch: 10 }, month: { stem: 8, branch: 2 } }], flags: [] } as ReadyChart);
    if (!chart) throw new Error('chart');
    const y = yearView(chart, luck as ReadyLuck);
    for (const m of [...(y?.best ?? []), ...(y?.rest ?? [])]) expect(m).toMatch(/^[자축인묘진사오미신유술해]월$/);
  });
});

// ── ⓘ M-F2: 충전 잠김 글 · 종합 풀이 이름 ────────────────────────────────────
describe('IF5-F1b ⓘ 충전 잠김(MILEAGE.shop.locked) · 종합 풀이 이름(SAJU.full.label)', () => {
  const rig = (email: string, over: Record<string, boolean> = {}) => {
    const flags = { ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over } as Record<string, boolean>;
    const demo = createDemoMileage({ flags: async () => flags, boardedRounds: async () => 0 });
    const call = async (fn: string, args: Record<string, unknown> = {}) => demo.rpc({ id: 'u-lock', email }, fn, args);
    const deps: MileageDeps = { api: createMileageApi(call), edge: createLedgerEdge(call), isOn: (k) => flags[k] === true };
    return deps;
  };
  test('서버가 충전을 잠그면(charge_locked) 사실 한 문장 + 글자 단추 고객센터 · 점검 글 대신 · 상품 줄 0 · 잔액 · 내역은 그대로', async () => {
    const tree = keep(await mount(<MileageScreen deps={rig('mbig@email.com')} />));
    await wait(40);
    expect(has(tree, 'mileage-locked')).toBe(true);
    expect(textOf(tree, 'mileage-locked-text')).toBe(IF5_TEXT['MILEAGE.shop.locked']);
    expect(has(tree, 'mileage-maint')).toBe(false);
    expect(has(tree, 'mileage-products')).toBe(false);
    expect(has(tree, 'mileage-balance')).toBe(true);
    expect(has(tree, 'mileage-to-log')).toBe(true);
    expect(allTexts(tree)).not.toContain(IF5_TEXT['SAJU.status.maint']);
    expect(String(must(tree, 'mileage-locked-support').props.accessibilityLabel ?? SUPPORT.rowName)).toBe(SUPPORT.rowName);
    await press(tree, 'mileage-locked-support');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
    expect(takeSettingsPage()).toBe('support');
    expect(allTexts(tree).join(' ')).not.toMatch(/90일|환불 횟수|\d+회/); // 까닭 · 기간 · 숫자를 글에 풀지 않는다
  });
  test('스위치 mileage_charge 꺼짐은 점검 글 그대로(잠김 글 0)', async () => {
    const tree = keep(await mount(<MileageScreen deps={rig('sj@email.com', { mileage_charge: false })} />));
    await wait(40);
    expect(has(tree, 'mileage-maint')).toBe(true);
    expect(has(tree, 'mileage-locked')).toBe(false);
  });
  test('종합 풀이 이름은 서버 차감표 글 대신 카피 SAJU.full.label(같은 글) — AI 칸 · 쓰기 확인 시트', () => {
    expect(src('features/saju/ai/AiBlock.tsx')).toContain("p.kind === 'full' ? IF5_TEXT['SAJU.full.label']");
    expect(IF5_TEXT['SAJU.full.label']).toBe('사주 종합 풀이');
  });
});

// ── ⓙ S-F2: 저장 0 줄 켬 · 사주 서버 로그 필터 · 긴 주소 막이 ───────────────────
describe('IF5-F1b ⓙ 보안 S-F2', () => {
  test('① IF5_KEEP_NOTE_ON = true(CK17D · CK19 요약 우리 쪽 줄 · 전문 저장 0 문장이 보인다)', () => {
    expect(IF5_KEEP_NOTE_ON).toBe(true);
  });
  test('② 사주 서버 emit 은 허용 키 필터(logRecord5)를 거친다 — 허용 밖 키 · 입력 글 · 사실 · 접근 코드 0 · 문자열 40자', () => {
    const rec = logRecord5({ t: 5, f: 's5_reading', ms: 12.4, mode: 'mock', code: 'ok', in: 10, out: 20, text: '내 생일은 1994-03-14', facts: { a: 1 }, code2: 'x', accessCode: 'SECRET', rid: 'ab c!d_e-f', ip: '1.2.3.4' });
    expect(Object.keys(rec).sort()).toEqual(['code', 'f', 'in', 'mode', 'ms', 'out', 'rid', 't']);
    expect(rec.rid).toBe('abcd_e-f');
    expect(JSON.stringify(rec)).not.toMatch(/1994|SECRET|1\.2\.3\.4/);
    expect(logRecord5({ f: 'weird', code: 'x'.repeat(100), mode: 'evil', ms: 'NaN' })).toEqual({ t: 0, f: 's5_unknown', code: 'x'.repeat(40) });
    expect(src('server/ait/sajuRoute.ts')).toContain('deps.log(logRecord5(');
    expect(src('server/ait/sajuRoute.ts')).not.toMatch(/deps\.log\((?!logRecord5)/);
  });
  test('③ 2,048자를 넘는 딥링크 · 첫 주소는 쿼리를 풀지 않고 홈으로 · 이하면 그대로 · 글이 아니면 홈', () => {
    expect(MAX_LINK_CHARS).toBe(2048);
    const base = 'gyeoljeongsa://saju?x=';
    const ok = base + 'a'.repeat(2048 - base.length);
    expect(ok).toHaveLength(2048);
    expect(guardSystemPath(ok)).toBe(ok);
    const long = ok + 'a';
    expect(guardSystemPath(long)).toBe(LINK_HOME);
    expect(guardSystemPath(undefined)).toBe(LINK_HOME);
    expect(guardSystemPath('/saju')).toBe('/saju');
    expect(redirectSystemPath({ path: long, initial: true })).toBe('/');
    expect(redirectSystemPath({ path: long, initial: false })).toBe('/');
    expect(redirectSystemPath({ path: '/saju?x=1', initial: true })).toBe('/saju?x=1');
    expect(src('lib/linkGuard.ts')).not.toMatch(/console\.|safeLog|fetch\(/); // 주소 내용을 읽거나 남기지 않는다
  });
});
