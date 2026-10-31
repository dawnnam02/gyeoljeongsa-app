// IF5-F1 ② ③ ⑥ 사주 마당 시험 — 서버 4함수 응답 읽기(오류 7종) · 모의 서버 모양 · 기기 저장(withKeyIndex) · 상대 생일(기기 계산 · 네트워크 0 · 19세 미만 0) · 화면 상태 5종 · 캡처 막기 · 점수 · 퍼센트 · 판정 0 · F2 몫 0
//  보안 앱 시험 IFF5-17 ~ 22 · 24 · 28 ~ 34 가운데 F1 몫. 서버 대신 데모 모의 서버(0048 모양)를 같은 파서로 읽는다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { IF5_TEXT } from '@/content/if5Copy';
import { createDemoSaju } from '@/demo/sajuDemo';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { rpcOf } from '@/features/inflight/inflightApi';
import { createInputStore, INPUT_KEYS, memoryInputStorage, type InputStore } from '@/features/saju/deviceInput';
import { matchPartner } from '@/features/saju/partnerLocal';
import { PartnerSheet } from '@/features/saju/PartnerSheet';
import { SajuCalendarScreen } from '@/features/saju/SajuCalendarScreen';
import { createSajuApi, parseMyChart, SAJU_FAIL_CODES, type SajuApi } from '@/features/saju/sajuApi';
import { chartOf, idx60, monthGrid, pairText, todayBaseLine, type ReadyChart } from '@/features/saju/sajuLogic';
import { SajuMadangScreen } from '@/features/saju/SajuMadangScreen';
import type { SajuDeps } from '@/features/saju/sajuService';
import { SajuTodayScreen } from '@/features/saju/SajuTodayScreen';
import { build_chart } from '@/saju5/saju_calc5';

import { allTexts, has, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, useFocusEffect: () => undefined, Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
const mockForced = jest.fn();
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: (on: boolean) => mockForced(on) }));

jest.setTimeout(90_000);

const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockRouter.push.mockClear();
  mockForced.mockClear();
  for (const k of Object.keys(mockParams)) delete mockParams[k];
});

const NOW = Date.parse('2027-03-20T03:00:00Z'); // 한국 2027-03-20 정오
const flagsAll = (over: Record<string, boolean> = {}) => ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over }) as Record<string, boolean>;

function rig(opts: { birth?: string | null; ck17?: boolean; flags?: Record<string, boolean>; email?: string } = {}) {
  const user = { id: 'u-saju', email: opts.email ?? 'sj@email.com' };
  const flags = flagsAll(opts.flags);
  const demo = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate: opts.birth === undefined ? '1994-03-14' : opts.birth, consentOn: (c) => (c === 'CK17A' ? opts.ck17 !== false : false) }), today: () => '2027-03-20' });
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const call = async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    return demo.rpc(user, fn, args);
  };
  const api = createSajuApi(call);
  const ck17: Ck17Api = {
    load: async () => ({ ok: true, data: { a: opts.ck17 !== false, b: false } }),
    record: jest.fn(async () => ({ ok: true as const })),
    revoke: jest.fn(async () => ({ ok: true as const })),
  };
  const isOn = (k: string) => flags[k] === true;
  // IF5-F2: 시각 · 곳 · 성별은 CK17A ③ ④ ⑤ 에 동의한 분만 쓴다 — 이 시험의 사람은 셋 다 동의한 것으로 둔다
  const consent = createIf5ConsentStore();
  void consent.setItems({ time: true, place: true, gender: true });
  const deps: SajuDeps = { api, ck17, isOn, now: () => NOW, birthDate: async () => '1994-03-14', consent };
  return { user, demo, calls, api, ck17, deps, isOn, flags };
}
const freshStore = (answered = false): InputStore => {
  const s = createInputStore(memoryInputStorage(), []);
  if (answered) void s.save({ time: null, place: null, saveTime: false, savePlace: false });
  return s;
};

// ── ② 서버 응답 읽기 · 오류 코드 7종 ──────────────────────────────────────────
describe('IF5-F1 ② 서버 4함수 응답 읽기 — 오류 코드 7종', () => {
  const failWith = (data: unknown, error: { code?: string; message?: string } | null = null) => createSajuApi(async () => ({ data, error }));
  test('consent_required · invalid_value · invalid_time · not_ready 는 서버 코드 그대로', async () => {
    for (const code of ['consent_required', 'invalid_value', 'invalid_time', 'not_ready'] as const) {
      expect(await failWith({ ok: false, code }).chart({ hour: null, minute: null, place: null })).toEqual({ ok: false, code });
    }
  });
  test('feature_off · forbidden(42501) · network(끊김) · 모르는 코드는 not_ready — 일곱 코드 모두 한 종류씩', async () => {
    const input = { hour: null, minute: null, place: null };
    expect(await failWith(null, { code: '42501', message: 'feature_off' }).chart(input)).toEqual({ ok: false, code: 'feature_off' });
    expect(await failWith(null, { code: '42501', message: 'forbidden' }).luck(input)).toEqual({ ok: false, code: 'forbidden' });
    expect(await createSajuApi(async () => { throw new Error('offline'); }).day(input)).toEqual({ ok: false, code: 'network' });
    expect(await failWith({ ok: false, code: 'weird' }).chart(input)).toEqual({ ok: false, code: 'not_ready' });
    expect(await failWith({ ok: true, state: 'ready' }).chart(input)).toEqual({ ok: false, code: 'not_ready' }); // 모양이 틀린 응답
    expect([...SAJU_FAIL_CODES]).toHaveLength(7);
  });
  test('요청 인자는 시각 · 곳뿐 — 생년월일 · 상대 · 회원 id 인자 0 · 자동 재시도 0(한 번 부름)', async () => {
    const r = rig();
    await r.api.chart({ hour: 15, minute: 20, place: '서울' });
    await r.api.luck({ hour: null, minute: null, place: null }, 2027);
    await r.api.day({ hour: null, minute: null, place: null }, '2027-03-20');
    await r.api.taekil({ purpose: 'moving', start: '2027-03-01', end: '2027-03-31', personal: false, hour: null, minute: null, place: null });
    expect(r.calls.map((c) => c.fn)).toEqual(['get_my_saju', 'get_my_luck', 'get_my_day', 'get_taekil']);
    expect(r.calls[0].args).toEqual({ p_hour: 15, p_minute: 20, p_place: '서울' });
    for (const c of r.calls) for (const k of Object.keys(c.args)) expect(k).toMatch(/^p_(hour|minute|place|year|date|purpose|start|end|personal)$/);
    const failing = jest.fn(async () => ({ data: { ok: false, code: 'not_ready' }, error: null }));
    await createSajuApi(failing).chart({ hour: null, minute: null, place: null });
    expect(failing).toHaveBeenCalledTimes(1);
  });
  test('rpcOf 는 클라이언트 rpc 를 그대로(이름 · 인자)', async () => {
    const rpc = jest.fn(async () => ({ data: { ok: true, state: 'none' }, error: null }));
    const api = createSajuApi(rpcOf({ rpc } as never));
    expect(await api.chart({ hour: 3, minute: 5, place: null })).toEqual({ ok: true, data: { state: 'none' } });
    expect(rpc).toHaveBeenCalledWith('get_my_saju', { p_hour: 3, p_minute: 5, p_place: null });
  });
});

describe('IF5-F1 ② 모의 서버(0048 응답 모양) — 계산은 기기 안', () => {
  test('get_my_saju: 시각 있음 4기둥 · 시각 모름 3기둥 + hour null · 입춘일은 두 가지 · 생년월일 원값 0', async () => {
    const r = rig();
    const known = await r.api.chart({ hour: 15, minute: 20, place: '서울' });
    expect(known.ok && known.data.state === 'ready' && known.data.hourKnown && known.data.hour !== null).toBe(true);
    const unknown = await r.api.chart({ hour: null, minute: null, place: null });
    expect(unknown.ok && unknown.data.state === 'ready' && !unknown.data.hourKnown && unknown.data.hour === null).toBe(true);
    const raw = await r.demo.rpc(r.user, 'get_my_saju', {});
    expect(JSON.stringify(raw.data)).not.toMatch(/1994|birth/);
    const cusp = rig({ birth: '2025-02-03' });
    const c = await cusp.api.chart({ hour: null, minute: null, place: null });
    expect(c.ok && c.data.state === 'ready' ? c.data.options.length : 0).toBe(2);
  });
  test('get_my_luck: 대운 9 · 세운 · 월운 12 / 성별 없음이면 대운 null / get_my_day · get_taekil 모양', async () => {
    const r = rig();
    const l = await r.api.luck({ hour: null, minute: null, place: null }, 2027);
    expect(l.ok && l.data.state === 'ready' && l.data.daewoon?.items.length === 9 && l.data.wolun.length === 12 && l.data.seun?.year === 2027).toBe(true);
    const nog = await rig({ email: 'sjnog@email.com' }).api.luck({ hour: null, minute: null, place: null }, 2027);
    expect(nog.ok && nog.data.state === 'ready' && nog.data.daewoon === null).toBe(true);
    const d = await r.api.day({ hour: null, minute: null, place: null }, '2027-03-20');
    expect(d.ok && d.data.state === 'ready' && d.data.officer !== null && d.data.date === '2027-03-20').toBe(true);
    const t = await r.api.taekil({ purpose: 'moving', start: '2027-03-01', end: '2027-03-31', personal: false, hour: null, minute: null, place: null });
    expect(t.ok && t.data.days.length === 31 && t.data.days.every((x) => ['good', 'neutral', 'rest'].includes(x.tone))).toBe(true);
  });
  test('오류: CK17A 꺼짐 consent_required · 스위치 꺼짐 feature_off · 모르는 지점 invalid_value · 1961-08-10 이전 out_of_range · 생년월일 없음 none · 62일 넘는 날짜 고르기 invalid_value', async () => {
    const input = { hour: null, minute: null, place: null };
    expect(await rig({ ck17: false }).api.chart(input)).toEqual({ ok: false, code: 'consent_required' });
    expect(await rig({ flags: { saju_yard: false } }).api.chart(input)).toEqual({ ok: false, code: 'feature_off' });
    expect(await rig().api.chart({ hour: 3, minute: 0, place: '화성' })).toEqual({ ok: false, code: 'invalid_value' });
    expect(await rig({ birth: '1950-05-05' }).api.chart(input)).toEqual({ ok: true, data: { state: 'out_of_range' } });
    expect(await rig({ birth: null }).api.chart(input)).toEqual({ ok: true, data: { state: 'none' } });
    expect(await rig().api.taekil({ purpose: 'moving', start: '2027-01-01', end: '2027-04-01', personal: false, ...input })).toEqual({ ok: false, code: 'invalid_value' });
    expect(await rig().api.taekil({ purpose: 'abortion', start: '2027-03-01', end: '2027-03-02', personal: false, ...input })).toEqual({ ok: false, code: 'invalid_value' }); // 용도 목록 밖 0
  });
  test('기둥 번호 ↔ 60갑자 변환 · 서버 기둥으로 세운 원국 = 기기에서 직접 만든 원국', async () => {
    const r = rig();
    const res = await r.api.chart({ hour: 15, minute: 20, place: '서울' });
    if (!res.ok || res.data.state !== 'ready') throw new Error('x');
    const direct = build_chart({ year: 1994, month: 3, day: 14, hour: 15, minute: 20, place: '서울', gender: 'F' });
    const viaServer = chartOf(res.data as ReadyChart);
    expect(viaServer?.pillars).toEqual(direct.pillars);
    expect(idx60(0, 0)).toBe(0);
    expect(idx60(1, 0)).toBe(-1);
    expect(parseMyChart({ state: 'ready', day: { stem: 0, branch: 1 } })).toBeNull();
    expect(pairText({ stem: 0, branch: 0 })).toBe('갑자');
  });
});

// ── ① 기기 저장 ──────────────────────────────────────────────────────────────
describe('IF5-F1 ① 시각 · 곳은 이 휴대폰에만 — 저장 칸을 켠 항목만 · 열쇠 이름', () => {
  test('저장 칸을 켠 칸만 저장소에 쓴다 · 끈 칸은 메모리뿐 · 새 저장소(앱을 다시 켬)에서 저장본만 돌아온다', async () => {
    const storage = memoryInputStorage();
    const a = createInputStore(storage, ['서울']);
    await a.save({ time: { hour: 15, minute: 20 }, place: '서울', saveTime: true, savePlace: false });
    expect(a.get().time).toEqual({ hour: 15, minute: 20 });
    expect(a.get().place).toBe('서울'); // 이번 앱 실행 동안은 메모리에
    expect(await storage.getItem(INPUT_KEYS.time)).not.toBeNull();
    expect(await storage.getItem(INPUT_KEYS.place)).toBeNull();
    const b = createInputStore(storage, ['서울']);
    await b.load();
    expect(b.get()).toMatchObject({ time: { hour: 15, minute: 20 }, place: null, saveTime: true, savePlace: false, answered: true });
    await b.clearAll();
    expect(b.get()).toMatchObject({ time: null, place: null, answered: false });
    const c = createInputStore(storage, ['서울']);
    await c.load();
    expect(c.get().time).toBeNull(); // 로그아웃 · 탈퇴 뒤에는 저장본도 0
  });
  test('열쇠 이름에 birth · partner · saju · mileage 낱말 0 · 모양이 틀린 저장본 · 목록에 없는 지점 id 는 버린다', async () => {
    for (const k of Object.values(INPUT_KEYS)) expect(k).not.toMatch(/birth|partner|saju|mileage/i);
    const storage = memoryInputStorage();
    await storage.setItem(INPUT_KEYS.time, '{"hour":99,"minute":1}');
    await storage.setItem(INPUT_KEYS.place, '"화성"');
    const s = createInputStore(storage, ['서울']);
    await s.load();
    expect(s.get()).toMatchObject({ time: null, place: null });
  });
});

// ── 상대 생일 ────────────────────────────────────────────────────────────────
describe('IF5-F1 ② ③ 상대 생일 — 늘 기기 계산 · 서버 전송 0 · 저장 0 · 19세 미만 0', () => {
  const mine = build_chart({ year: 1994, month: 3, day: 14, hour: 15, minute: 20, place: '서울', gender: 'F' });
  test('결과는 닮은 점 · 다른 점 · 부딪힐 때 쓰는 말 세 줄 + 펼침 · 점수 · 퍼센트 0', () => {
    const r = matchPartner(mine, { birthDigits: '19920802', time: null }, '2027-03-20');
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.card.three).toHaveLength(3);
    expect(r.hourUnknown).toBe(true);
    expect([r.card.one, ...r.card.three, ...r.card.more].join(' ')).not.toMatch(/\d+\s*%|점수|순위|판정|궁합 ?점/);
  });
  test('만 19세 미만 → 계산 없이 minor(생일 당일부터 19세) · 1961-08-10 이전 · 없는 날짜 · 미래 → outOfRange', () => {
    expect(matchPartner(mine, { birthDigits: '20080321', time: null }, '2027-03-20').kind).toBe('minor'); // 만 19세 생일 하루 전 = 만 18세
    expect(matchPartner(mine, { birthDigits: '20080320', time: null }, '2027-03-20').kind).toBe('ok'); // 만 19세 생일 당일부터 맞춰 본다
    expect(matchPartner(mine, { birthDigits: '20100101', time: null }, '2027-03-20').kind).toBe('minor');
    expect(matchPartner(mine, { birthDigits: '19600101', time: null }, '2027-03-20').kind).toBe('outOfRange');
    expect(matchPartner(mine, { birthDigits: '20010231', time: null }, '2027-03-20').kind).toBe('outOfRange');
    expect(matchPartner(mine, { birthDigits: '20990101', time: null }, '2027-03-20').kind).toBe('outOfRange');
    expect(matchPartner(mine, { birthDigits: '1992', time: null }, '2027-03-20').kind).toBe('outOfRange');
  });

  let pConsent = createIf5ConsentStore(); // CK20 확인 기록은 이 기기에 한 번(시험마다 새 메모리 저장소)
  beforeEach(() => {
    pConsent = createIf5ConsentStore();
  });
  const sheet = async (mineChart: ReturnType<typeof build_chart> | null = mine) => {
    const closed = jest.fn();
    const tree = keep(await mount(<PartnerSheet visible mine={mineChart} today={() => '2027-03-20'} onClose={closed} consent={pConsent} />));
    return { tree, closed };
  };
  test('시트: CK20 확인 전엔 입력칸이 잠김 · 이름 · 성별 · 별명 · 연락처 칸 0 · 자동완성 · 자동수정 끔', async () => {
    const { tree } = await sheet();
    const birth = must(tree, 'saju-partner-birth');
    expect(birth.props.disabled).toBe(true);
    expect(must(tree, 'saju-partner-go').props.disabled).toBe(true);
    const inputs = tree.root.findAll((n) => typeof n.props.onChangeText === 'function' && String(n.type) === 'TextInput');
    expect(inputs.length).toBeLessThanOrEqual(1); // 생년월일 칸 하나뿐
    for (const i of inputs) {
      expect(i.props.autoCorrect).toBe(false);
      expect(i.props.autoComplete).toBe('off');
    }
    const texts = allTexts(tree).join(' ');
    expect(texts).not.toMatch(/이름을|별명|연락처 ?칸|성별/);
    expect(textOf(tree, 'saju-partner-notice')).toBe(IF5_TEXT['SAJU.partner.notice']);
    expect(textOf(tree, 'saju-partner-gone')).toBe(IF5_TEXT['SAJU.partner.gone']);
  });
  test('확인 → 8자리 → [맞춰 보기] → 결과 · 네트워크 호출 0 · 닫으면 값이 사라진다(다시 열면 빈 칸)', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
    const { tree } = await sheet();
    await press(tree, 'saju-partner-ck20-check');
    await typeInto(tree, 'saju-partner-birth', '1992-08-02'); // 숫자만 남긴다
    expect(must(tree, 'saju-partner-birth').props.value).toBe('19920802');
    await press(tree, 'saju-partner-go');
    expect(has(tree, 'saju-partner-result')).toBe(true);
    expect(textOf(tree, 'saju-partner-result-gone')).toBe(IF5_TEXT['SAJU.partner.result.gone']);
    expect(textOf(tree, 'saju-partner-hour-unknown')).toBe(IF5_TEXT['SAJU.partner.hourUnknown']);
    expect(mockForced).toHaveBeenCalledWith(true); // 캡처 막기
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    await act(async () => tree.update(<PartnerSheet visible={false} mine={mine} today={() => '2027-03-20'} onClose={() => undefined} consent={pConsent} />));
    await act(async () => tree.update(<PartnerSheet visible mine={mine} today={() => '2027-03-20'} onClose={() => undefined} consent={pConsent} />));
    expect(must(tree, 'saju-partner-birth').props.value).toBe('');
    expect(has(tree, 'saju-partner-result')).toBe(false);
  });
  test('만 19세 미만 → 부드러운 한 줄만 · 결과 0 · 다른 생일을 권하는 단추 0', async () => {
    const { tree, closed } = await sheet();
    await press(tree, 'saju-partner-ck20-check');
    await typeInto(tree, 'saju-partner-birth', '20100101');
    await press(tree, 'saju-partner-go');
    expect(has(tree, 'saju-partner-minor')).toBe(true);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.partner.minor']);
    expect(has(tree, 'saju-partner-result')).toBe(false);
    expect(has(tree, 'saju-partner-again')).toBe(false);
    await press(tree, 'saju-partner-minor-close');
    expect(closed).toHaveBeenCalled();
  });
  test('1961-08-10 이전 → 범위 한 줄 + [생일 다시 넣기] · 계산 실패 칸은 값 보존(다시 넣기 누르면 입력 화면)', async () => {
    const { tree } = await sheet();
    await press(tree, 'saju-partner-ck20-check');
    await typeInto(tree, 'saju-partner-birth', '19500505');
    await press(tree, 'saju-partner-go');
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.range.partner']);
    await press(tree, 'saju-partner-again');
    expect(has(tree, 'saju-partner-birth')).toBe(true);
  });
});

// ── ③ 사주 마당 화면 · 상태 5종 ──────────────────────────────────────────────
describe('IF5-F1 ③ 사주 마당 한 화면 — 상태 5종(빈 · 불러오는 중 · 오류 · 범위 밖 · 시각 모름)', () => {
  const hub = async (r: ReturnType<typeof rig>, store: InputStore) => {
    const tree = keep(await mount(<SajuMadangScreen deps={r.deps} store={store} />));
    await wait(80);
    return tree;
  };
  test('빈(내 정보 없음): 안내 한 줄 + [내 정보 넣기] · 개인 카드 0 · 계산 서버 호출 0 · 날짜 고르기 · 달력 · 읽는 법은 보임', async () => {
    const r = rig();
    const tree = await hub(r, freshStore());
    expect(has(tree, 'saju-empty')).toBe(true);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.madang.empty']);
    expect(has(tree, 'saju-fill')).toBe(true);
    expect(has(tree, 'saju-pillars')).toBe(false);
    expect(r.calls).toHaveLength(0);
    expect(has(tree, 'saju-pick')).toBe(true);
    expect(has(tree, 'saju-cal-card')).toBe(true);
    expect(has(tree, 'saju-guide-card')).toBe(true);
    expect(has(tree, 'saju-partner-card')).toBe(true);
    // 첫 진입에서 입력 시트를 저절로 열지 않는다 — 누를 때만
    expect(isOpen(tree, 'saju-in')).toBe(false);
    await press(tree, 'saju-fill');
    expect(isOpen(tree, 'saju-in')).toBe(true);
  });
  test('빈(CK17A 꺼짐): 카드 대신 안내 한 줄 + [동의하고 보기](저절로 시트 0) · 서버 호출 0', async () => {
    const r = rig({ ck17: false });
    const tree = await hub(r, freshStore(true));
    expect(has(tree, 'saju-ck17-off')).toBe(true);
    expect(isOpen(tree, 'if2-ck17')).toBe(false);
    expect(r.calls).toHaveLength(0);
    expect(has(tree, 'saju-partner-card')).toBe(false); // 계산이 필요한 카드는 안 보임
    await press(tree, 'saju-ck17-agree');
    expect(isOpen(tree, 'if2-ck17')).toBe(true);
  });
  test('불러오는 중: 정지 뼈대 한 줄 + 글 · 깜빡임 0', async () => {
    const r = rig();
    let release: () => void = () => undefined;
    const slow: SajuApi = { ...r.api, chart: () => new Promise((res) => { release = () => res({ ok: true, data: { state: 'none' } }); }) };
    const tree = keep(await mount(<SajuMadangScreen deps={{ ...r.deps, api: slow }} store={freshStore(true)} />));
    await wait(40);
    expect(has(tree, 'saju-loading')).toBe(true);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.status.loadLab']);
    await act(async () => release());
  });
  test('시각 모름: 세 기둥 + 점선 칸 + 한 줄 + [시각 넣기] · 막지 않음 · 경고 색 · 느낌표 0 → 시각을 넣으면 네 기둥', async () => {
    const r = rig();
    const store = freshStore(true);
    const tree = await hub(r, store);
    expect(has(tree, 'saju-pillars')).toBe(true);
    expect(has(tree, 'saju-pillar-table-hour-unknown')).toBe(true);
    expect(has(tree, 'saju-hour-unknown')).toBe(true);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.hour.unknown']);
    expect(allTexts(tree).join(' ')).not.toMatch(/[!！]/);
    expect(mockForced).toHaveBeenCalledWith(true); // 사주 값이 보이는 동안 캡처 막기
    // 시각을 넣고 저장 → 서버에 시각이 요청 인자로 간다
    await press(tree, 'saju-hour-add');
    await press(tree, 'saju-in-time-pick');
    await press(tree, 'saju-in-timegrid-h-15');
    await press(tree, 'saju-in-timegrid-m-20');
    await press(tree, 'saju-in-save-time');
    await press(tree, 'saju-in-save');
    await wait(80);
    expect(r.calls.some((c) => c.fn === 'get_my_saju' && c.args.p_hour === 15 && c.args.p_minute === 20)).toBe(true);
    expect(has(tree, 'saju-pillar-table-hour')).toBe(true);
    expect(has(tree, 'saju-pillar-table-hour-unknown')).toBe(false);
  });
  test('범위 밖(1961-08-10 이전 출생): 해당 칸 한 줄 + 나머지 카드(날짜 고르기 · 달력 · 읽는 법)는 그대로', async () => {
    const r = rig({ birth: '1950-05-05' });
    const tree = await hub(r, freshStore(true));
    expect(has(tree, 'saju-range')).toBe(true);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.range.before']);
    expect(has(tree, 'saju-pillars')).toBe(false);
    expect(has(tree, 'saju-pick')).toBe(true);
    expect(has(tree, 'saju-guide-card')).toBe(true);
  });
  test('오류 코드 7종이 각각 화면에 있다: consent_required(동의 안내) · invalid_value · invalid_time(내 정보 다시) · not_ready · network(다시 시도) · feature_off · forbidden(다시 시도 단추 0)', async () => {
    const r = rig();
    for (const code of SAJU_FAIL_CODES) {
      const api: SajuApi = { ...r.api, chart: async () => ({ ok: false, code }), luck: async () => ({ ok: false, code }), day: async () => ({ ok: false, code }) };
      const tree = await hub({ ...r, deps: { ...r.deps, api } }, freshStore(true));
      const id = code === 'consent_required' ? 'saju-fail-consent' : `saju-fail-${code}`;
      expect(has(tree, id)).toBe(true);
      const retry = has(tree, `${id}-retry`);
      expect(retry).toBe(code === 'not_ready' || code === 'network');
      if (code === 'invalid_value' || code === 'invalid_time') expect(has(tree, 'saju-fill')).toBe(true);
      if (code === 'consent_required') expect(has(tree, 'saju-ck17-agree')).toBe(true);
      await act(async () => tree.unmount());
      mounted.splice(mounted.indexOf(tree), 1);
    }
  });
  test('다시 시도 = 사용자가 눌러야 다시 부른다(자동 재시도 0)', async () => {
    const r = rig();
    let n = 0;
    const api: SajuApi = { ...r.api, chart: async (i) => (n++ === 0 ? { ok: false, code: 'not_ready' } : r.api.chart(i)) };
    const tree = await hub({ ...r, deps: { ...r.deps, api } }, freshStore(true));
    await wait(120);
    expect(n).toBe(1);
    await press(tree, 'saju-fail-not_ready-retry');
    await wait(80);
    expect(n).toBe(2);
    expect(has(tree, 'saju-pillars')).toBe(true);
  });

  test('카드: 내 네 기둥 · 내 결 · 올해 · 이번 달 · 인연 · 일돈사람 · 인생 계절표 · 날짜 · 상대 · 달력 · 읽는 법 + 끝줄 · 순서 · 재회 0 · 점수 · 퍼센트 · 순위 · 판정 · 숫자 배지 0', async () => {
    const r = rig();
    const tree = await hub(r, freshStore(true));
    const ids = ['saju-pillars', 'saju-kyeol', 'saju-year', 'saju-month', 'saju-love', 'saju-work', 'saju-season', 'saju-pick', 'saju-partner-card', 'saju-cal-card', 'saju-guide-card', 'saju-end'];
    for (const id of ids) expect(has(tree, id)).toBe(true);
    // 위에서 아래 차례
    const order = tree.root.findAll((n) => typeof n.props.testID === 'string' && ids.includes(n.props.testID)).map((n) => n.props.testID as string);
    expect([...new Set(order)]).toEqual(ids);
    const texts = allTexts(tree).join(' ');
    expect(texts).not.toMatch(/재회|점수|순위|판정|퍼센트|\d+\s*%|무제한|상담(?!이나)/);
    expect(texts).not.toMatch(/잔액|마일리지 ?\d/); // 잔액 · 숫자는 마일리지 화면에만(머리 [마일리지] 입구는 F2)
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.card.fun']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.card.end']);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.madang.notUsed']);
    // 오행 막대는 길이뿐 — 숫자 라벨 0
    expect(has(tree, 'saju-bars-목')).toBe(true);
    expect(allTexts(tree).filter((t) => /^\d+$/.test(t))).toEqual([]); // 숫자만 있는 글(막대 라벨 · 배지) 0
    // 펼침: 기억하지 않는다 — 열고 닫으면 접힘
    await press(tree, 'saju-kyeol-toggle');
    expect(has(tree, 'saju-kyeol-body')).toBe(true);
    await press(tree, 'saju-kyeol-toggle');
    expect(has(tree, 'saju-kyeol-body')).toBe(false);
    // 마일리지 · AI 맞춤 · 사주 이야기 입구 0(F2)
    expect(has(tree, 'saju-talk')).toBe(false);
    expect(tree.root.findAll((n) => /share|copy|공유|복사/i.test(String(n.props.testID ?? ''))).length).toBe(0);
  });
  test('접근성: 네 기둥 표는 이름만 읽고 칸 글자(사주 값)는 숨긴다 · 오행 막대 라벨에 값 0 · 날 기둥 굵은 테두리 안내', async () => {
    const r = rig();
    const tree = await hub(r, freshStore(true));
    const table = must(tree, 'saju-pillar-table');
    expect(table.props.accessible).toBe(true);
    expect(table.props.accessibilityLabel).toBe(IF5_TEXT['SAJU.pillars.group']);
    expect(must(tree, 'saju-pillar-table-day').props.importantForAccessibility).toBe('no-hide-descendants');
    expect(must(tree, 'saju-bars-목').props.importantForAccessibility).toBe('no-hide-descendants');
    const labels = tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => String(n.props.accessibilityLabel));
    const chart = await r.api.chart({ hour: null, minute: null, place: null });
    if (!chart.ok || chart.data.state !== 'ready') throw new Error('x');
    for (const l of labels) expect(l).not.toContain(pairText(chart.data.day)); // 날 기둥 글자가 어떤 읽기 이름에도 없다
  });
  test('[?] 낱말 풀이 시트: 다섯 기운 → 제목 틀 + 쉬운 말 풀이 · 한자 0', async () => {
    const r = rig();
    const tree = await hub(r, freshStore(true));
    await press(tree, 'saju-guide-help-1');
    expect(isOpen(tree, 'saju-guide')).toBe(true);
    expect(textOf(tree, 'saju-guide-title')).toBe('다섯 기운 이 뭐예요?');
    expect(allTexts(tree).join(' ')).not.toMatch(/[一-鿿]/);
  });
  test('날짜 고르기 칩 → [달력에서 고르기] → 달력 화면(용도 번호) · 만세력 달력 [달력 열기]', async () => {
    const r = rig();
    const tree = await hub(r, freshStore(true));
    await press(tree, 'saju-pick-use-3');
    await press(tree, 'saju-pick-open');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/saju-calendar', params: { mode: 'pick', use: '3' } });
    await press(tree, 'saju-cal-open');
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/saju-calendar', params: { mode: 'cal' } });
  });
  test('스위치: 카드 스위치가 꺼지면 그 카드만 0(무료 층은 다른 키가 켜진 만큼 그대로)', async () => {
    const r = rig({ flags: { saju_year: false, saju_pickday: false, read_guide: false } });
    const tree = await hub(r, freshStore(true));
    expect(has(tree, 'saju-year')).toBe(false);
    expect(has(tree, 'saju-pick')).toBe(false);
    expect(has(tree, 'saju-guide-card')).toBe(false);
    expect(has(tree, 'saju-kyeol')).toBe(true);
  });
  test('입력 시트: 시각 모름이 처음값(미리 체크 0) · 지점 23곳 + 모름 + 한국 밖 · 성별은 읽기 안내만 · 저장 칸 둘 미리 체크 0 · 비워도 저장 · 한국 밖은 범위 안내', async () => {
    const r = rig();
    const store = freshStore();
    const tree = await hub(r, store);
    await press(tree, 'saju-fill');
    expect(must(tree, 'saju-in-time-unknown').props.variant).toBe('selected');
    expect(must(tree, 'saju-in-save-time').props.on).toBe(false);
    expect(must(tree, 'saju-in-save-place').props.on).toBe(false);
    expect(textOf(tree, 'saju-in-birth')).toBe('1994년 3월 14일');
    expect(textOf(tree, 'saju-in-gender-note')).toBe(IF5_TEXT['SAJU.input.genderNote']);
    await press(tree, 'saju-in-place-pick');
    const chips = tree.root.findAll((n) => /^saju-in-place-\d+$/.test(String(n.props.testID ?? '')));
    expect(new Set(chips.map((c) => c.props.testID)).size).toBe(23);
    await press(tree, 'saju-in-place-abroad');
    expect(textOf(tree, 'saju-in-abroad')).toBe(IF5_TEXT['SAJU.range.abroad']);
    await press(tree, 'saju-in-save'); // 아무것도 안 골라도 눌린다
    await wait(60);
    expect(store.get()).toMatchObject({ time: null, place: null, answered: true });
  });
});

describe('IF5-F1 ③ 만세력 달력 · 날짜 고르기', () => {
  const cal = async (props: Parameters<typeof SajuCalendarScreen>[0]) => {
    const tree = keep(await mount(<SajuCalendarScreen now={() => NOW} {...props} />));
    await wait(60);
    return tree;
  };
  test('만세력 달력: 한 달 · 앞 뒤 달 이동만 · 칸마다 그날의 글자 · 서버 호출 0 · 날짜를 누르면 아래에 그날 한 장(글자 · 절기) · 캡처 막기', async () => {
    const taekil = jest.fn();
    const tree = await cal({ api: { taekil }, mode: 'cal' });
    expect(textOf(tree, 'saju-cal-month')).toBe('2027년 3월');
    await press(tree, 'saju-cal-day-5'); // 경칩 부근(3월 6일 아님) — 아무 날
    expect(has(tree, 'saju-cal-day-card')).toBe(true);
    expect(textOf(tree, 'saju-cal-day-glyph')).toMatch(/^그날의 글자 · [가-힣]{2}$/);
    await press(tree, 'saju-cal-next');
    expect(textOf(tree, 'saju-cal-month')).toBe('2027년 4월');
    await press(tree, 'saju-cal-prev');
    await press(tree, 'saju-cal-prev');
    expect(textOf(tree, 'saju-cal-month')).toBe('2027년 2월');
    expect(taekil).not.toHaveBeenCalled();
    expect(mockForced).toHaveBeenCalledWith(true);
    expect(allTexts(tree).join(' ')).not.toMatch(/음력 \d/); // 음양력 표가 없어 음력 날짜 줄을 만들지 않는다(카피 힌트 글에는 '음력'이 있다 — 마케팅 확인 요청)
  });
  test('절기가 든 날 표시 · 달력 칸 읽기 이름 {날짜}, {그날의 글자}, {쉬어 가는 날} · 개수 · 순번 읽기 0', async () => {
    const weeks = monthGrid(2027, 3).flat().filter((c) => c);
    const jeol = weeks.filter((c) => c?.jeol);
    expect(jeol.length).toBe(1);
    expect(jeol[0]?.jeol).toBe('경칩');
    expect(jeol[0]?.iso).toBe('2027-03-06');
    const tree = await cal({ api: { taekil: jest.fn() }, mode: 'cal' });
    const label = String(must(tree, 'saju-cal-day-6').props.accessibilityLabel);
    expect(label).toMatch(/^3월 6일, [가-힣]{2}(, 쉬어 가는 날)?$/);
  });
  test('날짜 고르기: 용도 칩 7(의료 · 소송 · 투자 · 대출 0) · 용도를 고르면 서버 get_taekil(목적 코드 · 그 달 범위 · 개인 맞춤 0) → 달력에 색 두 가지 + 모양', async () => {
    const r = rig();
    const tree = await cal({ api: r.api, mode: 'pick' });
    expect(new Set(tree.root.findAll((n) => /^saju-cal-use-\d$/.test(String(n.props.testID ?? ''))).map((n) => n.props.testID)).size).toBe(7);
    expect(allTexts(tree).join(' ')).not.toMatch(/의료|소송|투자 용도|대출 용도/);
    await press(tree, 'saju-cal-use-0');
    await wait(60);
    const call = r.calls.find((c) => c.fn === 'get_taekil');
    expect(call?.args).toMatchObject({ p_purpose: 'moving', p_start: '2027-03-01', p_end: '2027-03-31', p_personal: false, p_hour: null, p_place: null });
    const marks = tree.root.findAll((n) => /^saju-cal-day-\d+$/.test(String(n.props.testID ?? '')) && /좋은|쉬어 가는/.test(String(n.props.accessibilityLabel ?? '')));
    expect(marks.length).toBeGreaterThan(0);
    expect(new Set(marks.map((m) => (/좋은/.test(String(m.props.accessibilityLabel)) ? 'good' : 'rest'))).size).toBe(2); // 색 두 가지(글자 + 모양이 함께라 색만으로 전하지 않음)
    await press(tree, 'saju-cal-day-9');
    expect(has(tree, 'saju-cal-day-card')).toBe(true);
    expect(textOf(tree, 'saju-cal-day-tone')).toMatch(/고르기 좋은 날|무난해요|쉬어 가는 날/);
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.pick.scope']);
    expect(allTexts(tree).join(' ')).not.toMatch(/흉|점수|잔액/);
  });
  test('날짜 고르기 오류 → 다시 시도(사용자가 눌러야) · 지원 범위 밖 달은 범위 한 줄 · 서버 호출 0', async () => {
    let n = 0;
    const taekil = jest.fn(async () => (n++ === 0 ? ({ ok: false, code: 'not_ready' } as const) : ({ ok: true, data: { purpose: 'moving', days: [] } } as const)));
    const tree = await cal({ api: { taekil: taekil as unknown as SajuApi['taekil'] }, mode: 'pick', use: 0 });
    expect(has(tree, 'saju-cal-error')).toBe(true);
    await press(tree, 'saju-cal-error-retry');
    await wait(50);
    expect(taekil).toHaveBeenCalledTimes(2);
    const old = await cal({ api: { taekil: jest.fn() }, mode: 'pick', use: 0, now: () => Date.parse('1961-06-15T03:00:00Z') }); // 지원 범위(1961-08-10) 앞 달
    expect(has(old, 'saju-cal-range')).toBe(true);
  });
});

describe('IF5-F1 ③ 오늘 하루 — 홈 띠의 한 줄 · 화면', () => {
  test('띠의 한 줄은 오늘 날짜의 바탕만 — 모든 회원에게 같은 글 · 내 정보 0 · 같은 날 같은 글 · 날짜가 다르면 다른 글이 나올 수 있다', () => {
    const a = todayBaseLine('2027-03-20');
    expect(a).toBeTruthy();
    expect(todayBaseLine('2027-03-20')).toBe(a);
    const days = Array.from({ length: 10 }, (_, i) => todayBaseLine(`2027-03-${String(10 + i)}`));
    expect(new Set(days).size).toBeGreaterThan(1);
    expect(todayBaseLine('1950-01-01')).toBeNull(); // 범위 밖은 띠째 없음
  });
  test('화면: 오늘의 바탕 + (CK17A 켠 분만) 하루 쓰는 법 두 줄 · 점수 · 별점 · 행운 색 · 숫자 0 · [사주 마당 가기]', async () => {
    const r = rig();
    const store = freshStore(true);
    const tree = keep(await mount(<SajuTodayScreen deps={r.deps} store={store} />));
    await wait(100);
    expect(textOf(tree, 'saju-today-one')).toBe(todayBaseLine('2027-03-20'));
    expect(has(tree, 'saju-today-howto')).toBe(true);
    expect(has(tree, 'saju-today-l1')).toBe(true);
    expect(has(tree, 'saju-today-l2')).toBe(true);
    expect(has(tree, 'saju-today-l3')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/점수|별점|행운|\d+\s*%/);
    expect(mockForced).toHaveBeenCalledWith(true);
    await press(tree, 'saju-today-go');
    expect(mockRouter.push).toHaveBeenCalledWith('/saju');
    // CK17A 꺼짐: 바탕 한 줄만(권유 0 · 서버 계산 호출 0)
    const off = rig({ ck17: false });
    const t2 = keep(await mount(<SajuTodayScreen deps={off.deps} store={freshStore(true)} />));
    await wait(80);
    expect(has(t2, 'saju-today-one')).toBe(true);
    expect(has(t2, 'saju-today-howto')).toBe(false);
    expect(off.calls).toHaveLength(0);
  });
});
