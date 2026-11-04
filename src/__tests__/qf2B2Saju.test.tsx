// QF2-B2 — 상대 생일 음력(Q2-09) · 사주 아침 알림(Q2-04) · 마일리지 가격표(Q2-10d) · 정적 점검
//  보는 것: 음력 원값이 서버 · AI 로 안 감(변환된 양력만) · 변환 줄이 늘 보임 · 기본 꺼짐 · 켜기 전 권한 요청 0 · 예약 1개 · 끄면 취소 · 사주 폴더 알림 금지는 이 예외 하나만
import fs from 'node:fs';
import path from 'node:path';

import { act, type ReactTestRenderer } from 'react-test-renderer';

import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { NOTIFY_PRIME } from '@/content/qf2Copy';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import { priceRows } from '@/features/mileage/mileageLogic';
import { convertBirth } from '@/features/saju/lunarInput';
import { MorningRow } from '@/features/saju/MorningRow';
import { partnerBranch } from '@/features/saju/partnerLocal';
import { PartnerSheet } from '@/features/saju/PartnerSheet';
import { daysInLunarMonth, lunarToSolar } from '@/saju5/lunar5';
import { createMorning, memoryMorningStorage, MORNING_HOURS, MORNING_KEY, MORNING_KIND, type MorningDevice, type MorningPermission } from '@/lib/morningNotice';

import { allTexts, has, isOpen as sheetOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: () => undefined }));

jest.setTimeout(90_000);
const wait = (ms = 20) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
});

const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const walk = (d: string): string[] => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : [])) : []);

// ── 1. 음력 변환 (기기 안 · 순수) ─────────────────────────────────────────
describe('Q2-09 음력 변환', () => {
  test('양력으로 넣으면 그대로 · 없는 양력 날짜는 오류 · 8자리 전에는 안내', () => {
    expect(convertBirth('19920802', 'solar', false)).toEqual({ kind: 'ok', mode: 'solar', year: 1992, month: 8, day: 2, solarDigits: '19920802' });
    expect(convertBirth('19920230', 'solar', false)).toEqual({ kind: 'error', key: 'invalid' });
    expect(convertBirth('1992', 'solar', false)).toEqual({ kind: 'hint' });
    expect(convertBirth('1992080', 'lunar', false)).toEqual({ kind: 'hint' });
  });
  test('음력 → 양력: 알려진 값(2023-01-01 음력 = 양력 2023-01-22) · 윤달(2023 윤2월 1일 = 양력 2023-03-22) · 표와 같은 값', () => {
    expect(convertBirth('20230101', 'lunar', false)).toMatchObject({ kind: 'ok', mode: 'lunar', solarDigits: '20230122', year: 2023, month: 1, day: 22 });
    expect(convertBirth('20230201', 'lunar', true)).toMatchObject({ kind: 'ok', solarDigits: '20230322' });
    const s = lunarToSolar(1985, 7, 15, false);
    expect(convertBirth('19850715', 'lunar', false)).toMatchObject({ kind: 'ok', year: s.year, month: s.month, day: s.day });
  });
  test('오류 4갈래: 없는 날짜 · 표 밖 해 · 그 해에 윤달 없음 · 그 달에 그 날 없음', () => {
    expect(convertBirth('19921340', 'lunar', false)).toEqual({ kind: 'error', key: 'invalid' }); // 13월 40일
    expect(convertBirth('19590505', 'lunar', false)).toEqual({ kind: 'error', key: 'range' });
    expect(convertBirth('20520101', 'lunar', false)).toEqual({ kind: 'error', key: 'range' });
    expect(convertBirth('20240301', 'lunar', true)).toEqual({ kind: 'error', key: 'leapMonth' }); // 2024 에는 윤달이 없다
    let shortMonth = 0;
    for (let m = 1; m <= 12; m += 1) if (daysInLunarMonth(2024, m, false) === 29) shortMonth = m;
    expect(shortMonth).toBeGreaterThan(0);
    expect(convertBirth(`2024${String(shortMonth).padStart(2, '0')}30`, 'lunar', false)).toEqual({ kind: 'error', key: 'day' });
  });
});

// ── 2. 상대 생일 시트 ─────────────────────────────────────────────────────
describe('Q2-09 상대 생일 시트', () => {
  const TODAY = '2027-03-20';
  const openSheet = async (lunarOn: boolean) => {
    const pick = jest.fn();
    const consent = createIf5ConsentStore();
    const tree = keep(await mount(<PartnerSheet visible mine={null} today={() => TODAY} onClose={jest.fn()} consent={consent} pick={pick} lunarOn={lunarOn} />));
    await wait();
    await press(tree, 'saju-partner-ck20-check');
    await wait();
    return { tree, pick };
  };
  test('스위치 꺼짐: 선택 칸 · 변환 줄 없음(기존 그대로)', async () => {
    const { tree } = await openSheet(false);
    expect(has(tree, 'saju-partner-cal')).toBe(false);
    expect(has(tree, 'saju-partner-cal-line')).toBe(false);
  });
  test('켜짐: 처음값 양력 · 날짜 전에는 안내 · 양력은 "계산해요" 줄 · 음력은 바뀐 양력 줄 · 윤달 칸은 음력일 때만', async () => {
    const { tree } = await openSheet(true);
    expect(has(tree, 'saju-partner-cal')).toBe(true);
    expect(textOf(tree, 'saju-partner-cal-line-text')).toBe(IF5_TEXT['SAJU.partner.cal.hint']);
    expect(has(tree, 'saju-partner-cal-leap')).toBe(false);
    await typeInto(tree, 'saju-partner-birth', '19920802');
    expect(textOf(tree, 'saju-partner-cal-line-text')).toBe(t5('SAJU.partner.cal.lineSolar', { 년: 1992, 월: 8, 일: 2 }));
    await press(tree, 'saju-partner-cal-lunar');
    expect(has(tree, 'saju-partner-cal-leap')).toBe(true);
    const s = lunarToSolar(1992, 8, 2, false);
    expect(textOf(tree, 'saju-partner-cal-line-text')).toBe(t5('SAJU.partner.cal.lineLunar', { 년: s.year, 월: s.month, 일: s.day }));
    expect(textOf(tree, 'saju-partner-cal-note')).toBe(IF5_TEXT['SAJU.partner.cal.note']);
  });
  test('음력으로 넣고 [계산]을 누르면 넘어가는 값은 변환된 양력의 일지 하나 — 음력 원값으로 계산하지 않는다', async () => {
    const { tree, pick } = await openSheet(true);
    await press(tree, 'saju-partner-cal-lunar');
    await typeInto(tree, 'saju-partner-birth', '19920802');
    await press(tree, 'saju-partner-go');
    const s = lunarToSolar(1992, 8, 2, false);
    const want = partnerBranch({ birthDigits: `${s.year}${String(s.month).padStart(2, '0')}${String(s.day).padStart(2, '0')}`, time: null }, TODAY);
    expect(pick).toHaveBeenCalledTimes(1);
    expect(pick.mock.calls[0][0]).toEqual(want);
    // 원값 19920802 를 양력으로 읽었을 때와 다른 날이어야 이 시험이 뜻이 있다
    expect(want).not.toEqual(partnerBranch({ birthDigits: '19920802', time: null }, TODAY));
  });
  test('오류: 없는 음력 날짜면 입력칸 오류 글 + 계산 단추 잠김(누르지 않음)', async () => {
    const { tree, pick } = await openSheet(true);
    await press(tree, 'saju-partner-cal-lunar');
    await typeInto(tree, 'saju-partner-birth', '19921340');
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.partner.cal.errors.invalid']);
    expect(has(tree, 'saju-partner-cal-line')).toBe(false);
    expect(must(tree, 'saju-partner-go').props.disabled).toBe(true);
    await press(tree, 'saju-partner-go');
    expect(pick).not.toHaveBeenCalled();
  });
  test('음력 원값이 서버 · 저장 · 클립보드로 가는 코드가 없다(정적)', () => {
    const t = src('features/saju/PartnerSheet.tsx') + src('features/saju/lunarInput.ts');
    const code = t.replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/fetch\(|supabase|rpc\(|AsyncStorage|SecureStore|expo-clipboard|setItem|safeLog|console\./);
  });
});

// ── 3. 아침 알림 (저장소 · 기기 가짜) ─────────────────────────────────────
function fakeDevice(over: Partial<{ permission: MorningPermission; grant: MorningPermission; supported: boolean }> = {}) {
  const calls: string[] = [];
  const scheduled = new Map<string, { hour: number }>();
  let seq = 0;
  let perm: MorningPermission = over.permission ?? 'undetermined';
  const device: MorningDevice = {
    supported: over.supported ?? true,
    permission: async () => (calls.push('permission'), perm),
    request: async () => (calls.push('request'), (perm = over.grant ?? 'granted')),
    scheduleDaily: async (hour) => {
      calls.push(`schedule:${hour}`);
      seq += 1;
      scheduled.set(`n${seq}`, { hour });
      return `n${seq}`;
    },
    cancel: async (id) => (calls.push(`cancel:${id}`), void scheduled.delete(id)),
    cancelAllMorning: async () => (calls.push('cancelAll'), scheduled.clear()),
  };
  return { device, calls, scheduled };
}

describe('Q2-04 아침 알림 저장소', () => {
  test('기본 꺼짐 · 읽기만으로 권한 요청 0 · 예약 0', async () => {
    const f = fakeDevice();
    const s = createMorning(f.device, memoryMorningStorage());
    await s.load();
    expect(s.get()).toMatchObject({ on: false, id: null });
    expect(f.calls).toEqual([]);
  });
  test('켜기: 권한을 이때 처음 묻고 · 허락하면 예약 1개 + 기록 · 시각만 바꿔도 예약은 1개', async () => {
    const f = fakeDevice();
    const storage = memoryMorningStorage();
    const s = createMorning(f.device, storage);
    await s.load();
    expect(await s.enable(8)).toBe('on');
    expect(f.calls).toEqual(['permission', 'request', 'cancelAll', 'schedule:8']);
    expect(f.scheduled.size).toBe(1);
    expect(JSON.parse((await storage.getItem(MORNING_KEY)) ?? '{}')).toMatchObject({ on: true, hour: 8 });
    expect(await s.setHour(10)).toBe('on');
    expect(f.scheduled.size).toBe(1); // 하루 1건
    expect([...f.scheduled.values()][0].hour).toBe(10);
    expect(s.get()).toMatchObject({ on: true, hour: 10 });
  });
  test('거부하면 켜지 않는다(예약 0 · 기록 0) · 이미 허락한 기기는 권한 창을 다시 띄우지 않는다', async () => {
    const denied = fakeDevice({ grant: 'denied' });
    const s = createMorning(denied.device, memoryMorningStorage());
    expect(await s.enable(9)).toBe('denied');
    expect(denied.scheduled.size).toBe(0);
    expect(s.get().on).toBe(false);
    const granted = fakeDevice({ permission: 'granted' });
    const g = createMorning(granted.device, memoryMorningStorage());
    expect(await g.enable(9)).toBe('on');
    expect(granted.calls).not.toContain('request');
  });
  test('끄기 · 로그아웃 · 탈퇴 · 철회(cancelAll)는 예약을 취소하고 기록을 지운다 · 웹은 켤 수 없다', async () => {
    const f = fakeDevice({ permission: 'granted' });
    const storage = memoryMorningStorage();
    const s = createMorning(f.device, storage);
    await s.enable(9);
    await s.disable();
    expect(f.scheduled.size).toBe(0);
    expect(await storage.getItem(MORNING_KEY)).toBeNull();
    expect(s.get().on).toBe(false);
    await s.enable(11);
    await s.cancelAll();
    expect(f.scheduled.size).toBe(0);
    const web = createMorning(fakeDevice({ supported: false }).device, memoryMorningStorage());
    expect(await web.enable(9)).toBe('unsupported');
    expect(web.supported()).toBe(false);
  });
  test('선택지는 오전 8 · 9 · 10 · 11시뿐(8시 이전 0) · 알림 표시 이름에 사주 · 생일 낱말 0', () => {
    expect([...MORNING_HOURS]).toEqual([8, 9, 10, 11]);
    expect(MORNING_KEY + MORNING_KIND).not.toMatch(/saju|birth|사주|생일|mileage/i);
  });
  test('알림 글은 모든 회원에게 같은 고정 한 줄 — 사주 값 · 이름 · 점수 · 숫자 · 연속 · 놓치지 · 운세 낱말 0', () => {
    for (const k of ['SAJU.morning.push.title', 'SAJU.morning.push.body'] as const) expect(IF5_TEXT[k]).not.toMatch(/\d|사주|운세|점수|연속|놓치|출석|도장|!/);
  });
});

// ── 4. 아침 알림 줄 (화면) ────────────────────────────────────────────────
describe('Q2-04 아침 알림 줄', () => {
  const rig = (device = fakeDevice()) => {
    const store = createMorning(device.device, memoryMorningStorage());
    return { store, device };
  };
  test('스위치 꺼짐 · 웹(알림 없음)이면 줄 자체가 없다', async () => {
    const off = keep(await mount(<MorningRow isOn={() => false} store={rig().store} />));
    expect(has(off, 'saju-morning')).toBe(false);
    const web = keep(await mount(<MorningRow isOn={() => true} store={rig(fakeDevice({ supported: false })).store} />));
    expect(has(web, 'saju-morning')).toBe(false);
  });
  test('기본 꺼짐 · 줄만 보여서는 권한을 묻지 않는다 · 켜는 순간 안내 시트(이유 · 담기지 않는 것) → [알림 받기] → 예약 + 토스트', async () => {
    const r = rig();
    const tree = keep(await mount(<MorningRow isOn={() => true} store={r.store} toastMs={60_000} />));
    await wait();
    expect(has(tree, 'saju-morning')).toBe(true);
    expect(r.device.calls).toEqual([]); // 보이기만 해서는 권한 요청 0
    expect(must(tree, 'saju-morning-toggle').props.accessibilityState.checked).toBe(false);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.morning.name']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.morning.sub']);
    await press(tree, 'saju-morning-toggle');
    expect(sheetOpen(tree, 'saju-morning-prime')).toBe(true);
    expect(textOf(tree, 'saju-morning-prime-body')).toBe(IF5_TEXT['SAJU.morning.prime.body']);
    expect(r.device.calls).toEqual([]); // 안내 시트가 시스템 창보다 먼저
    await press(tree, 'saju-morning-prime-allow');
    await wait();
    expect(r.device.scheduled.size).toBe(1);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.morning.onToast']);
    expect(must(tree, 'saju-morning-toggle').props.accessibilityState.checked).toBe(true);
  });
  test('[나중에]는 아무것도 하지 않는다 · 거부하면 켜지 않고 안내 한 줄 + [설정 열기]', async () => {
    const later = rig();
    const t1 = keep(await mount(<MorningRow isOn={() => true} store={later.store} />));
    await press(t1, 'saju-morning-toggle');
    await press(t1, 'saju-morning-prime-later');
    await wait();
    expect(later.device.calls).toEqual([]);
    const denied = rig(fakeDevice({ grant: 'denied' }));
    const t2 = keep(await mount(<MorningRow isOn={() => true} store={denied.store} />));
    await press(t2, 'saju-morning-toggle');
    await press(t2, 'saju-morning-prime-allow');
    await wait();
    expect(denied.device.scheduled.size).toBe(0);
    expect(allTexts(t2)).toContain(IF5_TEXT['SAJU.morning.denied']);
    expect(must(t2, 'saju-morning-open-settings').props.label).toBe(NOTIFY_PRIME.openSettings);
    expect(must(t2, 'saju-morning-toggle').props.accessibilityState.checked).toBe(false);
  });
  test('시각 칩 4개(오전 8 ~ 11시) · 켜 둔 뒤 시각을 바꾸면 예약은 그대로 1개 · 끄면 예약 0 + 토스트', async () => {
    const r = rig(fakeDevice({ permission: 'granted' }));
    const tree = keep(await mount(<MorningRow isOn={() => true} store={r.store} toastMs={60_000} />));
    await wait();
    for (const h of MORNING_HOURS) expect(has(tree, `saju-morning-hour-${h}`)).toBe(true);
    expect(has(tree, 'saju-morning-hour-7')).toBe(false);
    await press(tree, 'saju-morning-hour-11'); // 켜기 전에 시각만 고름 — 권한 요청 0
    expect(r.device.calls).toEqual([]);
    await press(tree, 'saju-morning-toggle');
    await press(tree, 'saju-morning-prime-allow');
    await wait();
    expect([...r.device.scheduled.values()].map((v) => v.hour)).toEqual([11]);
    await press(tree, 'saju-morning-hour-9');
    await wait();
    expect([...r.device.scheduled.values()].map((v) => v.hour)).toEqual([9]);
    await press(tree, 'saju-morning-toggle');
    await wait();
    expect(r.device.scheduled.size).toBe(0);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.morning.offToast']);
    expect(allTexts(tree).join(' ')).not.toMatch(/연속|놓치|출석|도장|뽑기|!/);
  });
});

// ── 5. 마일리지 가격표 규칙 ───────────────────────────────────────────────
describe('Q2-10d 마일리지 가격표', () => {
  test('서버 차감표에서 쓰는 흐름 순서 세 줄(풀이 · 사주 이야기 · 날짜 설명) · 풀이처럼 값이 갈리면 "부터" · 없는 기능의 줄은 빠짐', () => {
    const costs = [
      { feature: 'saju_reading', cost: 800 },
      { feature: 'saju_full', cost: 2000 },
      { feature: 'saju_chat_turn', cost: 200 },
      { feature: 'taekil_explain', cost: 30 },
      { feature: 'polish_short', cost: 10 },
    ];
    expect(priceRows(costs)).toEqual([
      { key: 'read', cost: 800, from: true },
      { key: 'talk', cost: 200, from: false },
      { key: 'pick', cost: 30, from: false },
    ]);
    expect(priceRows([{ feature: 'saju_reading', cost: 800 }])).toEqual([{ key: 'read', cost: 800, from: false }]);
    expect(priceRows([])).toEqual([]);
  });

  test('QF2-B5 FA3-12: 시험판 기능이 있을 때만 연애 고민 정리 · 문장 다듬기 두 줄이 더해진다(값은 서버 응답, 다듬기는 길이에 따라 다르면 "부터")', () => {
    const costs = [
      { feature: 'saju_reading', cost: 800 },
      { feature: 'saju_chat_turn', cost: 200 },
      { feature: 'taekil_explain', cost: 30 },
      { feature: 'counsel_turn', cost: 250 },
      { feature: 'polish_short', cost: 10 },
      { feature: 'polish_long', cost: 300 },
    ];
    expect(priceRows(costs).map((r) => r.key)).toEqual(['read', 'talk', 'pick']);
    expect(priceRows(costs, true)).toEqual([
      { key: 'read', cost: 800, from: false },
      { key: 'talk', cost: 200, from: false },
      { key: 'pick', cost: 30, from: false },
      { key: 'concern', cost: 250, from: false },
      { key: 'polish', cost: 10, from: true },
    ]);
    expect(priceRows([{ feature: 'polish_short', cost: 10 }], true)).toEqual([{ key: 'polish', cost: 10, from: false }]);
    expect(priceRows([{ feature: 'counsel_turn', cost: 250 }])).toEqual([]);
  });

  test('쓰는 곳 한 줄은 시험판 기능이 있을 때만 다섯 곳을 말하고, 줄 이름은 내역 낱말과 같다', () => {
    expect(IF5_TEXT['MILEAGE.shop.lead']).toBe('AI 맞춤 풀이 · 사주 이야기 · 날짜 설명에 써요. 탑승권에는 쓰지 않아요.');
    expect(IF5_TEXT['MILEAGE.shop.leadAit']).toBe('AI 맞춤 풀이 · 사주 이야기 · 날짜 설명 · 연애 고민 정리 · 문장 다듬기에 써요. 탑승권에는 쓰지 않아요.');
    expect(IF5_TEXT['MILEAGE.table.polish']).toBe(IF5_TEXT['MILEAGE.log.use.polish']);
    expect(IF5_TEXT['MILEAGE.table.concern']).toContain(IF5_TEXT['MILEAGE.log.use.concern']);
    expect(`${IF5_TEXT['MILEAGE.shop.lead']}${IF5_TEXT['MILEAGE.shop.leadAit']}`).not.toMatch(/[0-9!]/);
  });
});

// ── 6. 정적 점검 ──────────────────────────────────────────────────────────
describe('Q2-04 정적 점검 — 사주 폴더 알림 금지는 아침 알림 호출 한 곳만 예외', () => {
  const sajuFiles = walk(path.join(__dirname, '..', 'features', 'saju'));
  test('사주 폴더 파일은 알림 모듈 · 예약 함수를 직접 부르지 않는다(IFF5-21 · 30 그대로) · 아침 알림은 lib/morningNotice 의 함수로만', () => {
    for (const f of sajuFiles) {
      const t = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
      expect(t).not.toMatch(/expo-notifications|scheduleNotification|scheduleDaily|getPermissionsAsync|requestPermissionsAsync/);
    }
  });
  test('알림 모듈을 부르는 파일은 정해진 몇 곳뿐 — 아침 알림은 lib/morningNotice.ts 한 파일에 모여 있고 서버 호출 · 토큰 등록 · 분석이 없다', () => {
    const user = (rel: string) => src(rel).replace(/\/\/.*$/gm, '');
    expect(user('lib/morningNotice.ts')).toMatch(/expo-notifications/);
    expect(user('lib/morningNotice.ts')).not.toMatch(/fetch\(|supabase|rpc\(|register_device|getExpoPushTokenAsync|safeLog|analytics/);
    const users = walk(path.join(__dirname, '..')).filter((f) => !f.includes(`${path.sep}__tests__${path.sep}`) && /expo-notifications/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')));
    expect(users.map((f) => path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/')).sort()).toEqual(['features/settings/deviceDeps.ts', 'lib/morningNotice.ts', 'lib/pushRegistration.ts']);
  });
  test('아침 알림 줄은 숫자 배지 · 새 점 · 연속 · 도장 표시가 없다', () => {
    const t = src('features/saju/MorningRow.tsx').replace(/\/\/.*$/gm, '');
    expect(t).not.toMatch(/setBadge|badge|streak|스트릭|연속|도장|출석/i);
  });
});
