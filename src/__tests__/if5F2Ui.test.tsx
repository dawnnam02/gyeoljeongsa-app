// IF5-F2 화면 시험 — 마일리지 · 내역 · 확인 시트 셋 · 잔액 부족 · AI 맞춤 칸 · 사주 이야기 · 동의 시트(CK17A ③④⑤ · CK17D · CK19 · CK20).
//  화면 × 상태 5종(빈 · 불러오는 중 · 오류 · 범위 밖 · 시각 모름) 가운데 F2 몫. 모의 서버(0048 모양) + 모의 AI 응답만 쓴다(실호출 0 · 실결제 0).
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { CK17D, CK19, CK20, CK17_EXTRA } from '@/content/if5ConsentContent';
import { IF5_TEXT } from '@/content/if5Copy';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createDemoSaju } from '@/demo/sajuDemo';
import { createIf5ConsentStore, setIf5ConsentForTest } from '@/features/consent/if5Consent';
import { Ck17dSheet, Ck19Sheet, Ck20Block, visibleFull, visibleSummary } from '@/features/consent/If5ConsentSheets';
import { rpcOf } from '@/features/inflight/inflightApi';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi } from '@/features/mileage/mileageApi';
import { MileageLogScreen } from '@/features/mileage/MileageLogScreen';
import { MileageScreen } from '@/features/mileage/MileageScreen';
import { BigChargeSheet, ConfirmSpendSheet, LowBalance, TalkStartSheet } from '@/features/mileage/MileageSheets';
import type { MileageDeps } from '@/features/mileage/mileageService';
import { createAiResults } from '@/features/saju/ai/aiResults';
import type { AiServices } from '@/features/saju/ai/aiService';
import { createInputStore, memoryInputStorage, type InputStore } from '@/features/saju/deviceInput';
import { createSajuApi } from '@/features/saju/sajuApi';
import { SajuMadangScreen } from '@/features/saju/SajuMadangScreen';
import type { SajuDeps } from '@/features/saju/sajuService';
import { CRISIS_CLOSE_AT, REST_AFTER_ANSWERS, SajuTalkScreen } from '@/features/saju/SajuTalkScreen';
import { Ck17Sheet } from '@/features/inflight/If2Sheets';
import featureKeysJson from '@/config/featureKeys.json';
import { IF5_CONSENT_VERSIONS, IF5_KEEP_NOTE_ON } from '@/config/laterConsent';
import type { AitResult } from '@/features/ait/aitTypes';
import { AIT_TEXT } from '@/content/aitCopy';
import { newRequestId, runAi } from '@/features/saju/ai/aiRun';
import { classifyHit as classifyHitClient } from '@/saju5/ait/lexicon';
import { classifyHit as classifyHitServer } from '@/server/ait/lexicon';

import { allTexts, has, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: () => undefined, Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
const mockForced = jest.fn();
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: (on: boolean) => mockForced(on) }));
jest.mock('@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ flags: { loaded: true }, isOn: () => true }) }));

jest.setTimeout(90_000);
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
});

const NOW = Date.parse('2027-03-20T03:00:00Z');
const flagsAll = (over: Record<string, boolean> = {}) => ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over }) as Record<string, boolean>;
const user = (email = 'sj@email.com') => ({ id: 'u-f2', email });

function mileageRig(opts: { email?: string; flags?: Record<string, boolean>; rounds?: number } = {}) {
  const flags = flagsAll(opts.flags);
  const demo = createDemoMileage({ flags: async () => flags, boardedRounds: async () => opts.rounds ?? 0 });
  const calls: string[] = [];
  const call = async (fn: string, args: Record<string, unknown> = {}) => (calls.push(fn), demo.rpc(user(opts.email), fn, args));
  const api = createMileageApi(call);
  const edge = createLedgerEdge(call);
  const deps: MileageDeps = { api, edge, isOn: (k) => flags[k] === true };
  return { deps, api, edge, calls, flags };
}

describe('IF5-F2 ⑨ 마일리지 화면 (IF-MILE) — 상태 5종 중 빈 · 불러오는 중 · 오류', () => {
  test('잔액 · 한 줄 설명 · 횟수 제한 없이 쓴 만큼 · 상품 넷(서버 값) · 소모형 · 현금 불가 · 환불 안내 · 시험용 한 줄 · 새 점 · 보너스 0', async () => {
    const r = mileageRig({ rounds: 1 });
    const tree = keep(await mount(<MileageScreen deps={r.deps} />));
    await wait();
    expect(textOf(tree, 'mileage-total')).toBe('1,200');
    expect(textOf(tree, 'mileage-split')).toBe('무료 1,200 · 유료 0');
    expect(textOf(tree, 'mileage-lead')).toBe(IF5_TEXT['MILEAGE.shop.lead']);
    expect(textOf(tree, 'mileage-unlimited')).toBe(IF5_TEXT['MILEAGE.unlimited']);
    expect(textOf(tree, 'mileage-nocash')).toBe(IF5_TEXT['MILEAGE.noCash']);
    expect(textOf(tree, 'mileage-notice')).toBe(IF5_TEXT['MILEAGE.shop.notice']);
    expect(textOf(tree, 'mileage-trial')).toBe(IF5_TEXT['MILEAGE.shop.trial']);
    for (const sku of ['mileage_3300', 'mileage_5500', 'mileage_11000', 'mileage_33000']) expect(has(tree, `mileage-product-${sku}`)).toBe(true);
    expect(allTexts(tree)).toContain('3,300원에 3,300 마일리지');
    const all = allTexts(tree).join(' ');
    expect(all).not.toMatch(/[!！]|보너스|할인|인기|한정|서두르|남은 시간|마지막|무제한|지급됨/);
    expect(has(tree, 'mileage-header')).toBe(true);
  });
  test('충전: 누르면 서버 응답 뒤 잔액을 다시 읽는다(낙관적 증가 0) · 큰 충전은 한 줄 확인 시트 → [충전하기]', async () => {
    const r = mileageRig();
    const tree = keep(await mount(<MileageScreen deps={r.deps} />));
    await wait();
    expect(textOf(tree, 'mileage-total')).toBe('1,000');
    await press(tree, 'mileage-product-mileage_3300');
    await wait();
    expect(textOf(tree, 'mileage-total')).toBe('4,300');
    expect(allTexts(tree).join(' ')).not.toContain('지급됨');
    await press(tree, 'mileage-product-mileage_33000');
    expect(isOpen(tree, 'mileage-big')).toBe(true);
    expect(textOf(tree, 'mileage-big-line')).toBe(IF5_TEXT['MILEAGE.big.line']);
    expect(textOf(tree, 'mileage-total')).toBe('4,300'); // 확인 전에는 그대로
    await press(tree, 'mileage-big-cancel');
    expect(textOf(tree, 'mileage-total')).toBe('4,300');
    await press(tree, 'mileage-product-mileage_33000');
    await press(tree, 'mileage-big-go');
    await wait();
    expect(textOf(tree, 'mileage-total')).toBe('37,300');
    expect(r.calls.filter((c) => c === 'demo_mileage_charge')).toHaveLength(2);
  });
  test('오류: 한 줄 + [다시 시도](사용자가 눌러야) · 스위치 mileage_charge 꺼짐은 점검 한 줄 · 충전 숨김', async () => {
    const r = mileageRig({ email: 'mfail@email.com' });
    const tree = keep(await mount(<MileageScreen deps={r.deps} />));
    await wait();
    expect(allTexts(tree)).toContain(IF5_TEXT['SAJU.status.balanceFailed']); // 24-15-2 마침표 있는 글
    expect(r.calls.filter((c) => c === 'get_mileage')).toHaveLength(1); // 자동 재시도 0
    await press(tree, 'mileage-fail-retry');
    await wait();
    expect(r.calls.filter((c) => c === 'get_mileage')).toHaveLength(2);
    const off = mileageRig({ flags: { mileage_charge: false } });
    const t2 = keep(await mount(<MileageScreen deps={off.deps} />));
    await wait();
    expect(has(t2, 'mileage-maint')).toBe(true);
    expect(has(t2, 'mileage-products')).toBe(false);
  });
  test('빈 잔액 0: 숫자 0 + 상품 줄 · 재촉 0', async () => {
    const r = mileageRig({ email: 'mzero@email.com' });
    const tree = keep(await mount(<MileageScreen deps={r.deps} />));
    await wait();
    expect(textOf(tree, 'mileage-total')).toBe('0');
    expect(has(tree, 'mileage-products')).toBe(true);
  });
});

describe('IF5-F2 ⑨ 내역 (IF-MILE-LOG)', () => {
  test('날짜순 목록 · 종류 · +/− · 무료/산 분 · 쓰는 차례 한 줄 · 순위 · 배지 0 · 끝에 [충전하기]', async () => {
    const r = mileageRig({ rounds: 1 });
    await r.api.charge('mileage_5500');
    const h = await r.edge.hold({ feature: 'saju_chat_turn', chars: 0, requestId: 'req-log-0001' });
    if (h.kind === 'held') await r.edge.settle(h.holdId);
    const tree = keep(await mount(<MileageLogScreen deps={r.deps} />));
    await wait(60);
    expect(textOf(tree, 'mileage-log-order')).toBe(IF5_TEXT['MILEAGE.log.order']);
    expect(textOf(tree, 'mileage-log-total')).toBe('6,500');
    const kinds = [...new Map(tree.root.findAll((n) => typeof n.props.testID === 'string' && /^mileage-log-kind-/.test(n.props.testID)).map((n) => [n.props.testID as string, String(n.props.children)])).values()];
    expect(kinds).toEqual(['사용 · 사주 이야기', '충전', '탑승 적립', '가입 선물']);
    expect(allTexts(tree).join(' ')).toMatch(/−200/);
    expect(allTexts(tree).join(' ')).toMatch(/\+5,500/);
    expect(allTexts(tree).join(' ')).toContain(IF5_TEXT['MILEAGE.log.tagFree']);
    expect(allTexts(tree).join(' ')).not.toMatch(/연속|순위|배지|합계/);
    await press(tree, 'mileage-log-charge');
    expect(mockRouter.replace).toHaveBeenCalledWith('/mileage');
  });
  test('빈 내역 · 불러오기 실패 + [다시 시도]', async () => {
    const tree = keep(await mount(<MileageLogScreen deps={mileageRig({ email: 'mzero@email.com' }).deps} />));
    await wait(60);
    expect(textOf(tree, 'mileage-log-empty')).toBe(IF5_TEXT['MILEAGE.log.empty']);
    const bad = keep(await mount(<MileageLogScreen deps={mileageRig({ email: 'mfail@email.com' }).deps} />));
    await wait(60);
    expect(has(bad, 'mileage-log-fail')).toBe(true);
    expect(has(bad, 'mileage-log-retry')).toBe(true);
  });
});

describe('IF5-F2 ⑨ 확인 시트 셋 · 잔액 부족', () => {
  test('① 쓰기 확인: 최종 마일리지 · 돌려받을 수 없어요 · 지금 / 쓰고 나면 · 미리 체크 0 · 체크 전 [쓰기] 비활성 · 연타 0', async () => {
    const onGo = jest.fn();
    const tree = keep(await mount(<ConfirmSpendSheet visible featureName="사주 풀이" cost={870} balance={2000} onClose={() => undefined} onGo={onGo} />));
    expect(textOf(tree, 'mileage-ok-what')).toBe('AI 맞춤 풀이 · 사주 풀이');
    expect(textOf(tree, 'mileage-ok-title')).toBe('870 마일리지를 써요'); // 기본 800 + 가산 70
    expect(textOf(tree, 'mileage-ok-norefund')).toBe(IF5_TEXT['MILEAGE.confirm.noRefund']);
    expect(textOf(tree, 'mileage-ok-bal')).toBe('지금 2,000 · 쓰고 나면 1,130');
    expect(must(tree, 'mileage-ok-go').props.disabled).toBe(true);
    await press(tree, 'mileage-ok-go');
    expect(onGo).not.toHaveBeenCalled();
    await press(tree, 'mileage-ok-check');
    await press(tree, 'mileage-ok-go');
    expect(onGo).toHaveBeenCalledTimes(1);
  });
  test('② 대화 시작: 카피 줄의 숫자가 서버 차감표와 같을 때만 그 줄 · 다르면 서버 숫자로 · 시작할 때 한 번', async () => {
    const same = keep(await mount(<TalkStartSheet visible kind="saju" cost={200} balance={1000} onClose={() => undefined} onGo={() => undefined} />));
    expect(textOf(same, 'mileage-talk-line')).toBe(IF5_TEXT['MILEAGE.talkStart.saju.line']);
    expect(textOf(same, 'mileage-talk-once')).toBe(IF5_TEXT['MILEAGE.talkStart.once']);
    const other = keep(await mount(<TalkStartSheet visible kind="saju" cost={230} balance={1000} onClose={() => undefined} onGo={() => undefined} />));
    expect(textOf(other, 'mileage-talk-line')).toBe('230 마일리지를 써요');
    const concern = keep(await mount(<TalkStartSheet visible kind="concern" cost={250} balance={1000} onClose={() => undefined} onGo={() => undefined} />));
    expect(textOf(concern, 'mileage-talk-line')).toBe(IF5_TEXT['MILEAGE.talkStart.concern.line']);
  });
  test('③ 잔액 부족: 사실 한 줄 + [충전하러 가기] · 채팅이면 쓰던 글 그대로 한 줄', async () => {
    const go = jest.fn();
    const tree = keep(await mount(<LowBalance need={1500} have={100} chat onCharge={go} />));
    expect(textOf(tree, 'mileage-low-need')).toBe('필요한 건 1,500, 지금 가진 건 100이에요.');
    expect(textOf(tree, 'mileage-low-chat')).toBe(IF5_TEXT['MILEAGE.low.chat']);
    await press(tree, 'mileage-low-go');
    expect(go).toHaveBeenCalled();
    const big = keep(await mount(<BigChargeSheet visible onClose={() => undefined} onGo={() => undefined} />));
    expect(textOf(big, 'mileage-big-line')).toBe(IF5_TEXT['MILEAGE.big.line']);
  });
});

// ── 동의 시트 ────────────────────────────────────────────────────────────────
describe('IF5-F2 ⑪ 동의 시트 — CK17A ③ ④ ⑤ · CK17D · CK19 · CK20', () => {
  test('CK17A 시트: ① ② + ③ ④ ⑤ 칸 · 미리 체크 0 · ①을 고르기 전엔 ③ ④ ⑤ 누를 수 없음 · 이어 가기로 항목별 기록', async () => {
    const store = createIf5ConsentStore();
    const onSave = jest.fn(async () => true);
    setIf5ConsentForTest(store);
    const tree = keep(await mount(<Ck17Sheet visible onClose={() => undefined} onSave={onSave} />));
    expect(allTexts(tree)).toEqual(expect.arrayContaining([CK17_EXTRA.time.check, CK17_EXTRA.place.check, CK17_EXTRA.gender.check]));
    for (const k of ['c', 'd', 'e']) {
      const box = tree.root.findAll((n) => n.props.testID === `if2-ck17-${k}` && n.props.accessibilityRole === 'checkbox')[0];
      expect(box.props.accessibilityState.checked).toBe(false); // 미리 체크 0
      expect(box.props.disabled).toBe(true); // ①을 고르기 전엔 누를 수 없음
    }
    await press(tree, 'if2-ck17-a');
    await press(tree, 'if2-ck17-c');
    await press(tree, 'if2-ck17-e');
    await press(tree, 'if2-ck17-go');
    await wait();
    expect(onSave).toHaveBeenCalledWith(true, false);
    expect(store.get().items).toEqual({ time: true, place: false, gender: true });
    setIf5ConsentForTest(null);
  });
  test('CK17D: 체크 전 [동의하고 이어 가기] 비활성 · 동의하지 않고 이어 가기 → 안내 한 줄 · 요약 / 전문 · 서버 저장 줄은 보안 시험 통과 전엔 꺼짐', async () => {
    const yes = jest.fn();
    const no = jest.fn();
    const tree = keep(await mount(<Ck17dSheet visible onClose={() => undefined} onYes={yes} onNo={no} />));
    expect(textOf(tree, 'if5-ck17d-lead')).toBe(CK17D.lead);
    expect(must(tree, 'if5-ck17d-yes').props.disabled).toBe(true);
    await press(tree, 'if5-ck17d-yes');
    expect(yes).not.toHaveBeenCalled();
    await press(tree, 'if5-ck17d-no');
    expect(no).toHaveBeenCalled();
    expect(textOf(tree, 'if5-ck17d-declined')).toBe(CK17D.declined);
    await press(tree, 'if5-ck17d-check');
    await press(tree, 'if5-ck17d-yes');
    expect(yes).toHaveBeenCalledTimes(1);
    await press(tree, 'if5-ck17d-more');
    expect(allTexts(tree).some((t) => t.startsWith('받는 곳: 미국의 Anthropic PBC'))).toBe(true); // 받는 업체 이름 밝힘
    expect(IF5_KEEP_NOTE_ON).toBe(true); // IF5-F1b ⓙ: 보안 S-F2 조건부 인정 뒤 켬
    expect(allTexts(tree).some((t) => t.startsWith('우리 쪽:'))).toBe(true);
    await press(tree, 'if5-ck17d-full-open');
    expect(allTexts(tree).join(' ')).toMatch(/서버에 저장하지 않습니다/);
    expect(visibleSummary(CK17D.summary, false).some((t) => t.startsWith('우리 쪽:'))).toBe(false); // 꺼진 판단 함수는 그대로 걸러낸다
    expect(visibleSummary(CK17D.summary, true).some((t) => t.startsWith('우리 쪽:'))).toBe(true);
    expect(visibleFull(CK17D.full, true).join(' ')).toMatch(/서버에 저장하지 않습니다/);
  });
  test('CK19: ①(이야기 국외 이전) 있어야 ②(건강 · 성생활)를 고를 수 있다 · 기록은 ②를 따로', async () => {
    const yes = jest.fn();
    const tree = keep(await mount(<Ck19Sheet visible onClose={() => undefined} onYes={yes} onNo={() => undefined} />));
    expect(must(tree, 'if5-ck19-b').props.disabled).toBe(true);
    expect(must(tree, 'if5-ck19-yes').props.disabled).toBe(true);
    await press(tree, 'if5-ck19-a');
    await press(tree, 'if5-ck19-b');
    await press(tree, 'if5-ck19-yes');
    expect(yes).toHaveBeenCalledWith(true);
    expect(allTexts(tree)).toContain(CK19.checkB);
  });
  test('CK20: 확인 전 안내 한 줄 · 확인하면 안내가 사라진다', async () => {
    const toggle = jest.fn();
    const tree = keep(await mount(<Ck20Block checked={false} onToggle={toggle} />));
    expect(textOf(tree, 'if5-ck20-not')).toBe(CK20.notChecked);
    await press(tree, 'if5-ck20-check');
    expect(toggle).toHaveBeenCalled();
    const done = keep(await mount(<Ck20Block checked onToggle={toggle} />));
    expect(has(done, 'if5-ck20-not')).toBe(false);
  });
  test('판 값 · 동의 기록: 판이 바뀌면 이전 기록은 없는 것 · 철회 · 지움 · 시트 없이 켜지는 길 0(스위치 키는 실서버 꺼짐 처음값)', async () => {
    const mem = memoryInputStorage();
    const s1 = createIf5ConsentStore(mem);
    await s1.agreeD();
    await s1.agreeT(true);
    await s1.agreeC20();
    await s1.setItems({ time: true, place: true, gender: false });
    const s2 = createIf5ConsentStore(mem);
    await s2.load();
    expect(s2.get().d?.version).toBe(IF5_CONSENT_VERSIONS.CK17D);
    expect(s2.get().t?.health).toBe(true);
    expect(s2.get().items).toEqual({ time: true, place: true, gender: false });
    await mem.setItem('ck.d.v1', JSON.stringify({ version: 'consent-2026.01.01-v1', at: 'x' }));
    const s3 = createIf5ConsentStore(mem);
    await s3.load();
    expect(s3.get().d).toBeNull(); // 옛 판은 다시 받는다
    await s2.revoke('t');
    expect(s2.get().t).toBeNull();
    await s2.clearAll();
    expect(s2.get().c20).toBeNull();
    expect(demoDefault('inflight_mag')).toBe(true); // 데모는 시트(③④⑤ 칸)가 생겨 켜 둔다
    const keys = featureKeysJson.keys as { key: string; live: boolean }[];
    for (const k of ['inflight_mag', 'pair_card', 'saju_ai', 'saju_talk', 'mileage', 'mileage_charge']) expect(keys.find((x) => x.key === k)?.live).toBe(false); // 실서버는 시트 · 법무 뒤에만
  });
});

// ── AI 맞춤 칸 · 사주 이야기 ──────────────────────────────────────────────────
const okReply = (display: unknown, bundle: unknown = null): AitResult => ({ kind: 'reply', reply: { ok: true, code: 'ok', mode: 'mock', display, card: null, bundle, retryAfterSec: null } });

function aiRig(opts: { code?: string | null; email?: string; birth?: string | null; post?: AiServices['post']; consent?: Parameters<typeof createIf5ConsentStore>[0]; items?: boolean } = {}) {
  const flags = flagsAll();
  const mile = createDemoMileage({ flags: async () => flags });
  const saju = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate: opts.birth === undefined ? '1994-03-14' : opts.birth, consentOn: () => true }), today: () => '2027-03-20' });
  const u = user(opts.email ?? 'sj@email.com');
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const call = async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    return (mile.handles(fn) ? mile.rpc(u, fn, args) : saju.rpc(u, fn, args)) as never;
  };
  const posts: { kind: string; body: Record<string, unknown> }[] = [];
  const consent = createIf5ConsentStore(opts.consent);
  if (opts.items !== false) void consent.setItems({ time: true, place: true, gender: true });
  const ai: AiServices = {
    mileage: createMileageApi(call),
    edge: createLedgerEdge(call),
    consent,
    results: createAiResults(memoryInputStorage()),
    code: async () => (opts.code === undefined ? null : opts.code),
    post:
      opts.post ??
      (async (kind, body) => {
        posts.push({ kind, body });
        return okReply(kind === 'chat' ? { reply: '차분히 쌓아 가는 흐름이에요.', ask: '', flags: [], turns: 1, summarized: false } : { headline: '결을 읽어요', sections: [{ title: '기본 결', body: '곧게 뻗는 결이에요.' }], closing: '한 걸음씩 가요.' });
      }),
    newId: () => 'req-' + Math.random().toString(36).slice(2, 12),
  };
  const ck17: Ck17Api = { load: async () => ({ ok: true, data: { a: true, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
  const deps: SajuDeps = { api: createSajuApi(rpcOf({ rpc: call } as never)), ck17, isOn: (k) => flags[k] === true, now: () => NOW, birthDate: async () => '1994-03-14', consent, ai };
  return { ai, deps, calls, posts, consent, flags };
}
const answered = (): InputStore => {
  const s = createInputStore(memoryInputStorage(), []);
  void s.save({ time: { hour: 15, minute: 20 }, place: '서울', saveTime: false, savePlace: false });
  return s;
};

describe('IF5-F2 ⑩ AI 맞춤 칸 (사주 마당 결 읽기)', () => {
  const open = async (r: ReturnType<typeof aiRig>) => {
    const tree = keep(await mount(<SajuMadangScreen deps={r.deps} store={answered()} />));
    await wait(120);
    return tree;
  };
  test('버튼 옆 마일리지 N(서버 차감표 값, 한 곳) · 열 때 AI 호출 0 · 머리 [마일리지] · 이야기 입구', async () => {
    const r = aiRig({ code: 'ait-code' });
    const tree = await open(r);
    expect(textOf(tree, 'saju-kyeol-ai-cost')).toBe('마일리지 800');
    expect(textOf(tree, 'saju-year-ai-cost')).toBe('마일리지 1,500');
    expect(textOf(tree, 'saju-season-ai-cost')).toBe('마일리지 1,000');
    expect(r.posts).toHaveLength(0);
    expect(r.calls.some((c) => c.fn.startsWith('demo_mileage_hold'))).toBe(false);
    await press(tree, 'saju-header-right');
    expect(mockRouter.push).toHaveBeenCalledWith('/mileage');
    await press(tree, 'saju-talk-open');
    expect(mockRouter.push).toHaveBeenCalledWith('/saju-talk');
    expect(mockForced).toHaveBeenCalledWith(true);
  });
  test('동의 → 확인 → 실행: 동의 전엔 예치 0 · 호출 0 / 확인 시트(300 이상) → 체크 → 쓰기 → AI 글 + AI가 쓴 글 표시 → 잔액은 서버 응답 뒤 / 저장본은 무료 재열람', async () => {
    const r = aiRig({ code: 'ait-code' });
    const tree = await open(r);
    await press(tree, 'saju-kyeol-ai-btn');
    await wait();
    expect(isOpen(tree, 'saju-kyeol-ck17d')).toBe(true);
    expect(r.calls.some((c) => c.fn === 'demo_mileage_hold')).toBe(false); // 동의 전 예치 0
    expect(r.posts).toHaveLength(0);
    await press(tree, 'saju-kyeol-ck17d-check');
    await press(tree, 'saju-kyeol-ck17d-yes');
    await wait(60);
    expect(isOpen(tree, 'saju-kyeol-ok')).toBe(true); // 800 ≥ 300
    expect(textOf(tree, 'saju-kyeol-ok-title')).toBe('800 마일리지를 써요');
    expect(r.calls.some((c) => c.fn === 'demo_mileage_hold')).toBe(false);
    await press(tree, 'saju-kyeol-ok-check');
    await press(tree, 'saju-kyeol-ok-go');
    await wait(80);
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0].kind).toBe('reading');
    expect(JSON.stringify(r.posts[0].body)).not.toMatch(/start_date|end_date|1994|birth/);
    expect(textOf(tree, 'saju-kyeol-ai-tag')).toBe(IF5_TEXT['SAJU.card.aiTag']);
    expect(allTexts(tree)).toContain('결을 읽어요');
    expect((await r.ai.mileage.state()).ok && (await r.ai.mileage.state())).toMatchObject({ data: { total: 200 } });
    // 다시 열기: 저장본 무료 · 다시 뽑기 0
    const again = keep(await mount(<SajuMadangScreen deps={r.deps} store={answered()} />));
    await wait(150);
    expect(has(again, 'saju-kyeol-ai-btn')).toBe(false);
    expect(textOf(again, 'saju-kyeol-ai-reopen')).toBe(IF5_TEXT['SAJU.card.reopenFree']);
    expect(r.posts).toHaveLength(1);
  });
  test('검사 탈락: 차감 0 · 한 줄 + [다시 시도] / 코드 없음: 서버 요청 0 · 데모 글 / 잔액 부족: 사실 한 줄', async () => {
    const blocked = aiRig({ code: 'ait-code', post: async () => ({ kind: 'reply', reply: { ok: false, code: 'blocked_output', mode: 'mock', display: null, card: null, bundle: null, retryAfterSec: null } }) });
    await blocked.consent.agreeD();
    await blocked.ai.mileage.charge('mileage_3300'); // 올해 풀이 1,500 은 가입 선물 1,000 보다 크다
    const tree = await open(blocked);
    await press(tree, 'saju-year-ai-btn');
    await wait(60);
    await press(tree, 'saju-year-ok-check');
    await press(tree, 'saju-year-ok-go');
    await wait(80);
    expect(textOf(tree, 'saju-year-ai-blocked')).toBe(IF5_TEXT['SAJU.status.aiBlocked']);
    expect((await blocked.ai.mileage.state()).ok && (await blocked.ai.mileage.state())).toMatchObject({ data: { total: 4300 } }); // 차감 0
    expect(has(tree, 'saju-year-ai-retry')).toBe(true);

    const demo = aiRig({ code: null });
    await demo.consent.agreeD();
    const t2 = await open(demo);
    await press(t2, 'saju-kyeol-ai-btn');
    await wait(60);
    await press(t2, 'saju-kyeol-ok-check');
    await press(t2, 'saju-kyeol-ok-go');
    await wait(80);
    expect(demo.posts).toHaveLength(0); // 코드 없음 → 서버 요청 0
    expect(has(t2, 'saju-kyeol-ai-done')).toBe(true); // 데모 글

    const low = aiRig({ code: 'ait-code', email: 'mlow@email.com' });
    await low.consent.agreeD();
    const t3 = await open(low);
    await press(t3, 'saju-year-ai-btn');
    await wait(80);
    // IF5-QF F-04: 잔액이 모자라면 확인 시트를 열지 않고 바로 부족 줄 — 시트의 '쓰고 나면' 숫자가 틀리게 나오는 길 0
    expect(isOpen(t3, 'saju-year-ok')).toBe(false);
    expect(has(t3, 'saju-year-ok-bal')).toBe(false);
    expect(textOf(t3, 'saju-year-ai-low-need')).toBe('필요한 건 1,500, 지금 가진 건 100이에요.');
    expect(has(t3, 'saju-year-ai-low-go')).toBe(true);
    expect(low.posts).toHaveLength(0);
    expect((await low.ai.mileage.state()).ok && (await low.ai.mileage.state())).toMatchObject({ data: { total: 100 } }); // 차감 0
  });
  test('③ 시각 · ⑤ 성별 동의가 없으면 시각은 요청에 안 실리고 대운 칸은 안내 한 줄뿐(AI 칸 0)', async () => {
    const r = aiRig({ code: 'ait-code', items: false });
    const tree = await open(r);
    expect(r.calls.some((c) => c.fn === 'get_my_saju' && c.args.p_hour !== null)).toBe(false);
    expect(textOf(tree, 'saju-luck-off')).toBe(CK17_EXTRA.noLuck);
    expect(has(tree, 'saju-season-ai')).toBe(false);
    expect(has(tree, 'saju-full-card')).toBe(false);
  });
});

describe('IF5-F2 ⑩ 사주 이야기 나누기 (IF-SJ-TALK)', () => {
  const talk = async (r: ReturnType<typeof aiRig>) => {
    const tree = keep(await mount(<SajuTalkScreen deps={r.deps} store={answered()} />));
    await wait(150);
    return tree;
  };
  const say = async (tree: ReactTestRenderer, text: string) => {
    await typeInto(tree, 'saju-talk-input', text);
    await press(tree, 'saju-talk-send');
    await wait(80);
  };
  test('처음: CK17D → CK19 → 시작 시트 한 번 → 대화 · 이후 시트 0 · 줄어드는 숫자 0 · 캡처 막기 · 끝줄 한 곳', async () => {
    const r = aiRig({ code: 'ait-code' });
    const tree = await talk(r);
    expect(mockForced).toHaveBeenCalledWith(true);
    await say(tree, '올해 일이 잘 풀릴까요?');
    expect(isOpen(tree, 'saju-talk-ck17d')).toBe(true);
    expect(r.posts.filter((p) => !p.body.precheck)).toHaveLength(0);
    await press(tree, 'saju-talk-ck17d-check');
    await press(tree, 'saju-talk-ck17d-yes');
    await wait();
    expect(isOpen(tree, 'saju-talk-ck19')).toBe(true);
    await press(tree, 'saju-talk-ck19-a');
    await press(tree, 'saju-talk-ck19-yes');
    await wait();
    expect(isOpen(tree, 'saju-talk-start')).toBe(true);
    expect(textOf(tree, 'saju-talk-start-line')).toBe(IF5_TEXT['MILEAGE.talkStart.saju.line']);
    await press(tree, 'saju-talk-start-go');
    await say(tree, '올해 일이 잘 풀릴까요?');
    const turns = () => r.posts.filter((p) => !p.body.precheck); // 위기 앞거름 호출은 따로 센다
    expect(turns()).toHaveLength(1);
    expect(turns()[0].body.facts).toBeDefined(); // 첫 턴은 사실, 이어서는 서명 묶음
    await say(tree, '사람 관계는요?');
    expect(isOpen(tree, 'saju-talk-start')).toBe(false); // 이후 턴은 시트 0
    expect(turns()).toHaveLength(2);
    expect(turns()[1].body.bundle).toBeUndefined(); // 이 시험 응답은 묶음을 안 준다 → 사실로 다시 시작
    const all = allTexts(tree).join(' ');
    expect(all).not.toMatch(/남은|\d+\s*번 남|잔액|마일리지 \d/);
    expect(allTexts(tree).filter((t) => t === IF5_TEXT['SAJU.card.footer'])).toHaveLength(1); // 끝줄은 한 곳
    expect(allTexts(tree).filter((t) => t === IF5_TEXT['SAJU.card.aiTag'])).toHaveLength(2); // 답마다 AI가 쓴 글
    expect((await r.ai.mileage.state()).ok && (await r.ai.mileage.state())).toMatchObject({ data: { total: 600 } }); // 200 × 2
  });
  test('잔액 부족: 그 턴만 멈추고 한 줄 + [충전하러 가기] · 쓰던 글 그대로', async () => {
    const r = aiRig({ code: 'ait-code', email: 'mlow@email.com' });
    await r.consent.agreeD();
    await r.consent.agreeT(false);
    const tree = await talk(r);
    await say(tree, '요즘 마음이 복잡해요');
    expect(isOpen(tree, 'saju-talk-start')).toBe(true);
    await press(tree, 'saju-talk-start-go');
    await say(tree, '요즘 마음이 복잡해요');
    expect(has(tree, 'saju-talk-low')).toBe(true);
    expect(must(tree, 'saju-talk-input').props.value).toBe('요즘 마음이 복잡해요');
    await press(tree, 'saju-talk-low-go');
    expect(mockRouter.push).toHaveBeenCalledWith('/mileage');
  });
  test('위기 카드: 차감 0 · 잔액 0이어도 · 쓴 글이 말풍선에 안 남음 · 닫으면 대화 계속 · 5번째면 세션이 닫힌다', async () => {
    const r = aiRig({ code: null, email: 'mzero@email.com' });
    await r.consent.agreeD();
    await r.consent.agreeT(false);
    const tree = await talk(r);
    await say(tree, '그냥 안부');
    await press(tree, 'saju-talk-start-go');
    expect(CRISIS_CLOSE_AT).toBe(5);
    for (let i = 1; i <= 4; i += 1) {
      await say(tree, '죽고 싶어요');
      expect(has(tree, 'saju-talk-input')).toBe(true);
    }
    expect(allTexts(tree).join(' ')).not.toContain('죽고 싶어요');
    expect((await r.ai.mileage.state()).ok && (await r.ai.mileage.state())).toMatchObject({ data: { total: 0 } });
    await say(tree, '죽고 싶어요'); // 5번째
    expect(has(tree, 'saju-talk-closed')).toBe(true);
    expect(has(tree, 'saju-talk-input')).toBe(false);
    expect(has(tree, 'saju-talk-cardview-crisis')).toBe(true); // 카드 · 번호는 계속 보인다
    await press(tree, 'saju-talk-restart');
    expect(has(tree, 'saju-talk-input')).toBe(true);
  });
  test('30번째 답 뒤 쉬어 가요 한 줄 한 번 · 닫으면 다시 안 뜸 · 막지 않음', async () => {
    const r = aiRig({ code: null });
    await r.consent.agreeD();
    await r.consent.agreeT(false);
    await r.ai.mileage.state();
    for (let i = 0; i < 3; i += 1) await r.ai.mileage.charge('mileage_11000');
    const tree = await talk(r);
    await say(tree, '안녕하세요');
    await press(tree, 'saju-talk-start-go');
    expect(REST_AFTER_ANSWERS).toBe(30);
    for (let i = 1; i <= 29; i += 1) await say(tree, `이야기 ${i}`);
    expect(has(tree, 'saju-talk-rest')).toBe(false);
    await say(tree, '이야기 30');
    expect(allTexts(tree)).toContain(IF5_TEXT['REST_HINT.line']);
    await press(tree, 'saju-talk-rest-close');
    expect(has(tree, 'saju-talk-rest')).toBe(false);
    expect(has(tree, 'saju-talk-input')).toBe(true);
    await say(tree, '이야기 31');
    expect(has(tree, 'saju-talk-rest')).toBe(false); // 한 번뿐
    expect(allTexts(tree).join(' ')).not.toMatch(/\d+\s*번째|남은/);
  });
  test('범위 밖(1961-08-10 이전)이면 사주 사실 없이 대화 길 0 · 한 줄', async () => {
    const r = aiRig({ code: 'ait-code', birth: '1950-05-05' });
    const tree = await talk(r);
    expect(textOf(tree, 'saju-talk-norange')).toBe(IF5_TEXT['SAJU.talk.noRange']);
    expect(has(tree, 'saju-talk-input')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// IF5-QF 검수 찾은 것 고치기 — F-01 위기 앞거름이 동의 · 잔액 · 접근 코드 확인보다 먼저 / F-02 상시 한 줄 / F-04 잔액 부족 시트 전 부족 줄 / 데모 위기 사전
describe('IF5-QF F-01 · F-02 사주 이야기: 위기 앞거름이 먼저 · 상시 한 줄', () => {
  const talk = async (r: ReturnType<typeof aiRig>) => {
    const tree = keep(await mount(<SajuTalkScreen deps={r.deps} store={answered()} />));
    await wait(150);
    return tree;
  };
  const say = async (tree: ReactTestRenderer, text: string) => {
    await typeInto(tree, 'saju-talk-input', text);
    await press(tree, 'saju-talk-send');
    await wait(80);
  };
  const totalOf = async (r: ReturnType<typeof aiRig>) => {
    const s = await r.ai.mileage.state();
    return s.ok ? s.data.total : -1;
  };
  const holds = (r: ReturnType<typeof aiRig>) => r.calls.filter((c) => c.fn === 'demo_mileage_hold');

  test('동의 전 · 잔액 0 · 접근 코드 없음: 위기 말 → 동의 시트 없이 바로 카드 · 쓴 글 0 · 차감 0 · 서버 요청 0 · 예치 호출 0', async () => {
    const r = aiRig({ code: null, email: 'mzero@email.com' }); // 동의를 하나도 안 했다(CK17D · CK19 둘 다 없음)
    const tree = await talk(r);
    await say(tree, '요즘 죽고 싶어요');
    expect(has(tree, 'saju-talk-cardview-crisis')).toBe(true);
    expect(isOpen(tree, 'saju-talk-ck17d')).toBe(false);
    expect(isOpen(tree, 'saju-talk-ck19')).toBe(false);
    expect(isOpen(tree, 'saju-talk-start')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toContain('죽고 싶어요');
    expect(must(tree, 'saju-talk-input').props.value).toBe('');
    expect(r.posts).toHaveLength(0);
    expect(holds(r)).toHaveLength(0);
    expect(await totalOf(r)).toBe(0);
    expect(r.consent.get().d).toBeFalsy(); // 카드 때문에 동의가 켜지지도 않는다
  });
  test('접근 코드가 있어도 동의 전이면 서버 요청 0 · 카드(예전엔 동의 시트가 먼저 떴다)', async () => {
    const r = aiRig({ code: 'ait-code' });
    const tree = await talk(r);
    await say(tree, '자살하고 싶다는 생각이 나요');
    expect(has(tree, 'saju-talk-cardview-crisis')).toBe(true);
    expect(isOpen(tree, 'saju-talk-ck17d')).toBe(false);
    expect(r.posts).toHaveLength(0); // 동의 전에는 위기 앞거름 호출도 없다 — 사전은 화면 쪽 사본
    expect(await totalOf(r)).toBe(1000);
  });
  test('평범한 글은 그대로 동의 시트가 먼저(순서가 앞서는 것은 위기 · 폭력 · 오용 · 미성년 글뿐)', async () => {
    const r = aiRig({ code: null });
    const tree = await talk(r);
    await say(tree, '올해 일이 잘 풀릴까요?');
    expect(isOpen(tree, 'saju-talk-ck17d')).toBe(true);
    expect(has(tree, 'saju-talk-cardview-crisis')).toBe(false);
  });
  test('폭력 · 미성년 카드도 같은 자리에서 — 폭력은 계속 이어 갈 수 있고 미성년은 세션이 닫힌다(차감 0)', async () => {
    const r = aiRig({ code: null, email: 'mzero@email.com' });
    const tree = await talk(r);
    await say(tree, '남자친구가 어제 저를 때렸어요');
    expect(has(tree, 'saju-talk-cardview-violence')).toBe(true);
    expect(has(tree, 'saju-talk-input')).toBe(true);
    await say(tree, '저는 고등학생이에요');
    expect(has(tree, 'saju-talk-cardview-minor')).toBe(true);
    expect(has(tree, 'saju-talk-closed')).toBe(true);
    expect(has(tree, 'saju-talk-input')).toBe(false);
    expect(await totalOf(r)).toBe(0);
    expect(allTexts(tree).join(' ')).not.toMatch(/때렸|고등학생/);
  });
  test('동의 전 위기 5번 → 5번째에 세션이 닫힌다(카드 · 번호는 계속 보임)', async () => {
    const r = aiRig({ code: null, email: 'mzero@email.com' });
    const tree = await talk(r);
    for (let i = 0; i < 5; i += 1) await say(tree, i % 2 === 0 ? '죽고 싶어요' : '사라지고 싶어요');
    expect(has(tree, 'saju-talk-closed')).toBe(true);
    expect(has(tree, 'saju-talk-cardview-crisis')).toBe(true);
    expect(allTexts(tree).filter((t) => t === AIT_TEXT['CONCERN.always'])).toHaveLength(1);
  });
  test('F-02 상시 한 줄(CONCERN.always)이 어느 상태에서도 보인다 — 대화 · 카드 · 범위 밖', async () => {
    const r = aiRig({ code: null });
    const tree = await talk(r);
    expect(textOf(tree, 'saju-talk-always')).toBe(AIT_TEXT['CONCERN.always']);
    await say(tree, '죽고 싶어요');
    expect(textOf(tree, 'saju-talk-always')).toBe(AIT_TEXT['CONCERN.always']);
    const range = aiRig({ code: 'ait-code', birth: '1950-05-05' });
    const t2 = await talk(range);
    expect(has(t2, 'saju-talk-norange')).toBe(true);
    expect(textOf(t2, 'saju-talk-always')).toBe(AIT_TEXT['CONCERN.always']);
    expect(allTexts(t2).filter((t) => t === IF5_TEXT['SAJU.card.footer'])).toHaveLength(1); // 끝줄은 여전히 한 곳
  });
});

describe('IF5-QF 데모 위기 사전: 서버 사전 사본을 쓴다(예전 5낱말 목록 대신)', () => {
  const demo = (email = 'mzero@email.com') => aiRig({ code: null, email });
  test('예전 5낱말에 없던 서버 사전 낱말도 코드 없는 길에서 카드(위기 확장 · 폭력 · 오용 · 미성년)', async () => {
    const cases: [string, string][] = [
      ['더 이상 살고 싶지 않아요', 'crisis'],
      ['세상을 떠나고 싶어요', 'crisis'],
      ['남자친구가 저를 때렸어요', 'violence'],
      ['그 사람 휴대폰을 몰래 보고 싶어요', 'misuse'],
      ['저는 고등학생이에요', 'minor'],
    ];
    for (const [text, id] of cases) {
      const r = demo();
      const out = await runAi({ edge: r.ai.edge, code: () => null }, { kind: 'chat', requestId: newRequestId(), chars: 10, text, facts: {} });
      expect(out.kind).toBe('card');
      if (out.kind === 'card') expect(out.card.id).toBe(id);
    }
  });
  test('일상 말투는 카드가 아니다 — 데모 글이 나간다', async () => {
    const r = demo('sj@email.com');
    const out = await runAi({ edge: r.ai.edge, code: () => null }, { kind: 'chat', requestId: newRequestId(), chars: 10, text: '배고파 죽겠어요 점심 뭐 먹을까요', facts: {} });
    expect(out.kind).toBe('ok');
  });
  test('화면 쪽 사전 사본 = 서버 사전(같은 함수 · 같은 결과)', () => {
    const samples = ['죽고 싶어요', '때렸어요', '몰래 따라가고 싶어요', '만 15세예요', '평범한 하루였어요', '자해', '번개탄', '죽겠어요 배고파서'];
    for (const s of samples) expect(classifyHitClient(s)).toBe(classifyHitServer(s));
  });
});

describe('IF5-QF F-04 AI 맞춤: 잔액이 모자라면 확인 시트 전에 부족 줄', () => {
  const open = async (r: ReturnType<typeof aiRig>) => {
    const tree = keep(await mount(<SajuMadangScreen deps={r.deps} store={answered()} />));
    await wait(120);
    return tree;
  };
  test('잔액 100 · 풀이 800: 시트가 열리지 않고 부족 줄 · 차감 0 · 서버 요청 0 / 잔액이 충분하면 시트에 정확한 숫자', async () => {
    const low = aiRig({ code: 'ait-code', email: 'mlow@email.com' });
    await low.consent.agreeD();
    const t = await open(low);
    await press(t, 'saju-kyeol-ai-btn');
    await wait(80);
    expect(isOpen(t, 'saju-kyeol-ok')).toBe(false);
    expect(textOf(t, 'saju-kyeol-ai-low-need')).toBe('필요한 건 800, 지금 가진 건 100이에요.');
    expect(low.posts).toHaveLength(0);
    expect(low.calls.some((c) => c.fn === 'demo_mileage_hold')).toBe(false);
    await press(t, 'saju-kyeol-ai-low-go');
    expect(mockRouter.push).toHaveBeenCalledWith('/mileage');

    const ok = aiRig({ code: 'ait-code' }); // 가입 선물 1,000
    await ok.consent.agreeD();
    const t2 = await open(ok);
    await press(t2, 'saju-kyeol-ai-btn');
    await wait(80);
    expect(isOpen(t2, 'saju-kyeol-ok')).toBe(true);
    expect(textOf(t2, 'saju-kyeol-ok-bal')).toBe('지금 1,000 · 쓰고 나면 200');
  });
  test('빈 잔액(0)도 같다', async () => {
    const zero = aiRig({ code: null, email: 'mzero@email.com' });
    await zero.consent.agreeD();
    const t = await open(zero);
    await press(t, 'saju-kyeol-ai-btn');
    await wait(80);
    expect(isOpen(t, 'saju-kyeol-ok')).toBe(false);
    expect(textOf(t, 'saju-kyeol-ai-low-need')).toBe('필요한 건 800, 지금 가진 건 0이에요.');
  });
});
