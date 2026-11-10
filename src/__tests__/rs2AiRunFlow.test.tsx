// RS2-01 순 3 [나][다][라] 화면 시험 — 실서버 길(ai-run)에서 AI 가 코드별로 화면에 어떻게 보이는가, 앱이 마일리지 장부를 부르지 않는가, 잔액을 settled 때만 다시 읽는가.
//  서버는 가짜 fetch(ai-run 응답 흉내)가 대신한다 — 실서버 접속 0 · 실 Supabase 호출 0 · 유료 0. 마일리지 읽기는 데모 모의 서버(0048 모양)다.
//  본인 계정 시험: 약관 제10조 ⑨ — 한 번에 보낼 수 있는 글 길이(413)와 하루 호출 한도(429)는 화면에 알리고, 그 요청은 처리하지 않고, 마일리지는 쓰이지 않는다(잔액 그대로).
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { AIT_TEXT } from '@/content/aitCopy';
import { AI_RUN } from '@/content/aiRunCopy';
import { IF5_TEXT } from '@/content/if5Copy';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createDemoSaju } from '@/demo/sajuDemo';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import { setAiRunEnvForTest, type AiRunEnv } from '@/features/ait/aiCall';
import { ConcernChat } from '@/features/ait/ConcernChat';
import { StarAiBlock } from '@/features/ait/StarAiBlock';
import { aitStore } from '@/features/ait/aitStore';
import { rpcOf } from '@/features/inflight/inflightApi';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi } from '@/features/mileage/mileageApi';
import { createAiResults } from '@/features/saju/ai/aiResults';
import type { AiServices } from '@/features/saju/ai/aiService';
import { createInputStore, memoryInputStorage, type InputStore } from '@/features/saju/deviceInput';
import { createSajuApi } from '@/features/saju/sajuApi';
import { SajuMadangScreen } from '@/features/saju/SajuMadangScreen';
import type { SajuDeps } from '@/features/saju/sajuService';
import { SajuTalkScreen } from '@/features/saju/SajuTalkScreen';

import { allTexts, has, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, get router() { return mockRouter; }, useLocalSearchParams: () => ({}), useFocusEffect: () => undefined, Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: () => undefined }));
jest.mock('@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ flags: { loaded: true }, isOn: () => true }) }));
const mockMem = new Map<string, string>();
jest.mock('@/lib/secureStorage', () => ({
  secureStore: { get: async (k: string) => mockMem.get(k) ?? null, set: async (k: string, v: string) => void mockMem.set(k, v), del: async (k: string) => void mockMem.delete(k) },
}));

jest.setTimeout(90_000);
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockRouter.push.mockClear();
  setAiRunEnvForTest(null);
});

const NOW = Date.parse('2027-03-20T03:00:00Z');
const flagsAll = () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])) as Record<string, boolean>;

// ── 가짜 서버 (ai-run 응답 흉내) ────────────────────────────────────────────────
type Served = { status: number; body: unknown } | 'throw';
const reply = (status: number, code: string, charge: unknown, extra: Record<string, unknown> = {}): Served => ({ status, body: { ok: code === 'ok', code, mode: 'mock', charge, ...extra } });
const OK_READING = reply(200, 'ok', { state: 'settled' }, { display: { headline: '결을 읽어요', sections: [{ title: '한 줄', body: '차분히 쌓아 가는 결이에요.' }] } });
const OK_OFF = reply(200, 'ok', { state: 'off' }, { display: { headline: '결을 읽어요', sections: [] } });
const OK_CHAT = reply(200, 'ok', { state: 'settled' }, { display: { reply: '차분히 이어 가 볼게요.', ask: '', flags: [], turns: 1, summarized: false } });
const NONE = { state: 'none' };
const LOW = (need: number | null, have: number | null) => reply(402, 'low_balance', { state: 'low', ...(need === null ? {} : { need, have }) });
const ALREADY = reply(409, 'already_done', NONE);
const DAILY = reply(429, 'daily_limit', NONE);
const TOO_LONG = reply(413, 'too_long', NONE);
const CLOSED = reply(403, 'unavailable', NONE);
const NO_LOGIN = reply(401, 'auth', NONE);
const BLOCKED = reply(200, 'blocked_output', NONE);

function server(served: Served[]) {
  const requests: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const lost = jest.fn();
  const queue = [...served];
  const env: AiRunEnv = {
    url: 'https://proj.example.test',
    apikey: 'pub-key-for-test',
    token: async () => 'tok-for-test',
    onAuthLost: lost,
    fetch: async (url, init) => {
      requests.push({ url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown> });
      const next = queue.shift();
      if (next === 'throw') throw new TypeError('network');
      return next ? { status: next.status, json: async () => next.body } : { status: 500, json: async () => ({}) };
    },
  };
  return { env, requests, lost };
}

function rig(served: Served[], opts: { route?: 'ai-run' | 'mock'; cost?: AiServices['mileage']['cost'] } = {}) {
  const flags = flagsAll();
  const mile = createDemoMileage({ flags: async () => flags });
  const saju = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate: '1994-03-14', consentOn: () => true }), today: () => '2027-03-20' });
  const u = { id: 'u-rs2', email: 'sj@email.com' };
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const call = async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    return (mile.handles(fn) ? mile.rpc(u, fn, args) : saju.rpc(u, fn, args)) as never;
  };
  const srv = server(served);
  const consent = createIf5ConsentStore();
  void consent.setItems({ time: true, gender: true });
  const api = createMileageApi(call);
  const ai: AiServices = {
    mileage: opts.cost ? { ...api, cost: opts.cost } : api,
    edge: createLedgerEdge(call),
    consent,
    results: createAiResults(memoryInputStorage()),
    code: async () => null,
    route: opts.route ?? 'ai-run',
    env: srv.env,
    newId: () => 'req-' + Math.random().toString(36).slice(2, 12),
  };
  const ck17: Ck17Api = { load: async () => ({ ok: true, data: { a: true, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
  const deps: SajuDeps = { api: createSajuApi(rpcOf({ rpc: call } as never)), ck17, isOn: (k) => flags[k] === true, now: () => NOW, birthDate: async () => '1994-03-14', consent, ai };
  const ledgerWrites = () => calls.filter((c) => /^demo_mileage_(hold|settle|release)$/.test(c.fn));
  const stateReads = () => calls.filter((c) => c.fn === 'get_mileage').length;
  const total = async () => {
    const s = await ai.mileage.state();
    return s.ok ? s.data.total : -1;
  };
  return { ai, deps, calls, consent, ...srv, ledgerWrites, stateReads, total };
}
const answered = (): InputStore => {
  const s = createInputStore(memoryInputStorage());
  void s.save({ time: { hour: 15, minute: 20 }, saveTime: false });
  return s;
};

// ═══ AI 맞춤 칸(사주 마당 · 결 읽기) ═════════════════════════════════════════════
describe('RS2-01 실서버 길 · AI 맞춤 칸(결 읽기)', () => {
  const open = async (r: ReturnType<typeof rig>) => {
    await r.consent.agreeD();
    const tree = keep(await mount(<SajuMadangScreen deps={r.deps} store={answered()} />));
    await wait(120);
    return tree;
  };
  /** 버튼 → (800 은 확인 시트) → 쓰기. 쓰기 직전의 잔액 읽기 횟수를 돌려준다 */
  const runKyeol = async (r: ReturnType<typeof rig>, tree: ReactTestRenderer): Promise<number> => {
    await press(tree, 'saju-kyeol-ai-btn');
    await wait(60);
    await press(tree, 'saju-kyeol-ok-check');
    const before = r.stateReads();
    await press(tree, 'saju-kyeol-ok-go');
    await wait(100);
    return before;
  };

  test('ok + settled: ai-run 으로 한 번 · 머리 넷 · 본문에 사용자 번호 · 차감 키 · 생일 0 · 장부(예치 · 확정 · 해제) 호출 0 · 확정된 요청만 잔액을 다시 읽는다', async () => {
    const r = rig([OK_READING]);
    const tree = await open(r);
    const before = await runKyeol(r, tree);
    expect(r.requests).toHaveLength(1);
    const q = r.requests[0];
    expect(q.url).toBe('https://proj.example.test/functions/v1/ai-run');
    expect(Object.keys(q.headers).sort()).toEqual(['apikey', 'authorization', 'content-type', 'idempotency-key']);
    expect(q.body.feature).toBe('s5_reading');
    expect(JSON.stringify(q.body)).not.toMatch(/user_id|cost_key|amount|hold|1994|birth|u-rs2|sj@email/);
    expect(allTexts(tree)).toContain('결을 읽어요');
    expect(r.ledgerWrites()).toHaveLength(0); // 예치 · 확정 · 해제는 서버가 한다
    expect(r.stateReads()).toBeGreaterThan(before); // settled → 잔액을 서버에서 다시 읽었다
  });

  test('ok + off(마일리지 스위치 꺼짐) · 차감 없음: 잔액을 다시 읽지 않는다 · 장부 호출 0', async () => {
    const r = rig([OK_OFF]);
    const tree = await open(r);
    const before = await runKyeol(r, tree);
    expect(has(tree, 'saju-kyeol-ai-done')).toBe(true);
    expect(r.stateReads()).toBe(before);
    expect(r.ledgerWrites()).toHaveLength(0);
  });

  test('402 low_balance: 모자람 사실 한 줄 + 마일리지 화면 길 · 서버가 숫자를 안 주면 제목과 길만', async () => {
    const r = rig([LOW(800, 100)]);
    const tree = await open(r);
    await runKyeol(r, tree);
    expect(textOf(tree, 'saju-kyeol-ai-low-title')).toBe(IF5_TEXT['MILEAGE.low.title']);
    expect(textOf(tree, 'saju-kyeol-ai-low-need')).toBe('필요한 건 800, 지금 가진 건 100이에요.');
    await press(tree, 'saju-kyeol-ai-low-go');
    expect(mockRouter.push).toHaveBeenCalledWith('/mileage');
    expect(r.ledgerWrites()).toHaveLength(0);

    const bare = rig([LOW(null, null)]);
    const t2 = await open(bare);
    await runKyeol(bare, t2);
    expect(has(t2, 'saju-kyeol-ai-low-title')).toBe(true);
    expect(has(t2, 'saju-kyeol-ai-low-need')).toBe(false);
    expect(has(t2, 'saju-kyeol-ai-low-go')).toBe(true);
  });

  test('409 already_done: 이미 처리됨 한 줄(다시 차감 0) · 다시 시도 단추 0', async () => {
    const r = rig([ALREADY]);
    const tree = await open(r);
    await runKyeol(r, tree);
    expect(textOf(tree, 'saju-kyeol-ai-already')).toBe(AI_RUN.alreadyDone);
    expect(has(tree, 'saju-kyeol-ai-retry')).toBe(false);
    expect(await r.total()).toBe(1000);
    expect(r.ledgerWrites()).toHaveLength(0);
  });

  test('429 daily_limit: 오늘은 여기까지 · 응답이 차감 없음(none)일 때만 "마일리지는 쓰이지 않았어요" · 잔액 그대로 · 재촉 0', async () => {
    const r = rig([DAILY]);
    const tree = await open(r);
    await runKyeol(r, tree);
    expect(textOf(tree, 'saju-kyeol-ai-daily')).toBe(AI_RUN.dailyLimit);
    expect(textOf(tree, 'saju-kyeol-ai-daily-free')).toBe(AI_RUN.noCharge);
    expect(has(tree, 'saju-kyeol-ai-retry')).toBe(false);
    expect(await r.total()).toBe(1000);
    // 차감 없음을 알리지 않은 응답(off)에는 그 말을 덧붙이지 않는다
    const off = rig([reply(429, 'daily_limit', { state: 'off' })]);
    const t2 = await open(off);
    await runKyeol(off, t2);
    expect(has(t2, 'saju-kyeol-ai-daily')).toBe(true);
    expect(has(t2, 'saju-kyeol-ai-daily-free')).toBe(false);
  });

  test('413 too_long: 글이 길다 안내(기존 글) · none 일 때만 "마일리지는 쓰이지 않았어요" · 잔액 그대로', async () => {
    const r = rig([TOO_LONG]);
    const tree = await open(r);
    await runKyeol(r, tree);
    expect(textOf(tree, 'saju-kyeol-ai-toolong')).toBe(AIT_TEXT['AIT.code.too_long']);
    expect(textOf(tree, 'saju-kyeol-ai-toolong-free')).toBe(AI_RUN.noCharge);
    expect(await r.total()).toBe(1000);
  });

  test('403 unavailable(서버가 닫음): 지금은 쓸 수 없어요(점검 한 줄) · 재시도 단추 0 · 장부 0', async () => {
    const r = rig([CLOSED]);
    const tree = await open(r);
    await runKyeol(r, tree);
    expect(textOf(tree, 'saju-kyeol-ai-maint')).toBe(IF5_TEXT['SAJU.status.maint']);
    expect(has(tree, 'saju-kyeol-ai-retry')).toBe(false);
    expect(r.ledgerWrites()).toHaveLength(0);
  });

  test('401: 로그인 끝 처리(가드와 같은 길) 한 번 · 화면은 차감 없음 안내', async () => {
    const r = rig([NO_LOGIN]);
    const tree = await open(r);
    await runKyeol(r, tree);
    expect(r.lost).toHaveBeenCalledTimes(1);
    expect(textOf(tree, 'saju-kyeol-ai-blocked')).toBe(IF5_TEXT['SAJU.status.aiBlocked']);
  });

  test('끊김은 차감 여부를 모른다: "마일리지는 쓰이지 않았어요" 대신 중립 한 줄 · 다시 시도는 같은 키 · 서버가 답한 뒤의 다시 시도는 새 키', async () => {
    const r = rig(['throw', BLOCKED, OK_READING]);
    const tree = await open(r);
    await runKyeol(r, tree);
    expect(textOf(tree, 'saju-kyeol-ai-blocked')).toBe(IF5_TEXT['SAJU.status.errTitle']);
    expect(allTexts(tree).join(' ')).not.toContain('마일리지는 쓰이지 않았어요');
    await press(tree, 'saju-kyeol-ai-retry');
    await wait(100);
    expect(textOf(tree, 'saju-kyeol-ai-blocked')).toBe(IF5_TEXT['SAJU.status.aiBlocked']); // 서버가 none 이라고 알렸다
    await press(tree, 'saju-kyeol-ai-retry');
    await wait(100);
    const keys = r.requests.map((q) => q.headers['idempotency-key']);
    expect(r.requests).toHaveLength(3);
    expect(keys[1]).toBe(keys[0]); // 끊긴 시도의 다시 시도 = 같은 키
    expect(keys[2]).not.toBe(keys[1]); // 서버가 답한(검사 탈락) 뒤의 다시 시도 = 새 키
    expect(has(tree, 'saju-kyeol-ai-done')).toBe(true);
    expect(r.ledgerWrites()).toHaveLength(0);
  });

  test('마일리지 읽기가 feature_off 여도 실서버 길은 서버에 맡긴다(차감 없이 도는 본인 계정 시험) — 데모 길은 지금처럼 점검 한 줄', async () => {
    const off = async () => ({ ok: false as const, code: 'feature_off' as const });
    const real = rig([OK_OFF], { cost: off });
    const t1 = await open(real);
    await press(t1, 'saju-kyeol-ai-btn');
    await wait(100);
    expect(real.requests).toHaveLength(1);
    expect(has(t1, 'saju-kyeol-ai-done')).toBe(true);

    const demo = rig([OK_OFF], { cost: off, route: 'mock' });
    const t2 = await open(demo);
    await press(t2, 'saju-kyeol-ai-btn');
    await wait(100);
    expect(demo.requests).toHaveLength(0);
    expect(textOf(t2, 'saju-kyeol-ai-maint')).toBe(IF5_TEXT['SAJU.status.maint']);
  });

  test('데모 길은 그대로: 모의 글 · 서버 요청 0 · 장부(예치 → 확정)를 앱이 부른다', async () => {
    const r = rig([], { route: 'mock' });
    const tree = await open(r);
    await runKyeol(r, tree);
    expect(r.requests).toHaveLength(0);
    expect(has(tree, 'saju-kyeol-ai-done')).toBe(true);
    expect(r.ledgerWrites().map((c) => c.fn)).toEqual(['demo_mileage_hold', 'demo_mileage_settle']);
  });
});

// ═══ 사주 이야기 ═══════════════════════════════════════════════════════════════
describe('RS2-01 실서버 길 · 사주 이야기', () => {
  const talk = async (r: ReturnType<typeof rig>) => {
    await r.consent.agreeD();
    await r.consent.agreeT(false);
    const tree = keep(await mount(<SajuTalkScreen deps={r.deps} store={answered()} />));
    await wait(150);
    return tree;
  };
  const say = async (tree: ReactTestRenderer, text: string) => {
    await typeInto(tree, 'saju-talk-input', text);
    await press(tree, 'saju-talk-send');
    await wait(100);
  };
  /** 첫 말에서 뜨는 시작 시트를 지나 한 번 보낸다 */
  const sayFirst = async (tree: ReactTestRenderer, text: string) => {
    await say(tree, text);
    if (isOpen(tree, 'saju-talk-start')) {
      await press(tree, 'saju-talk-start-go');
      await wait();
      await say(tree, text);
    }
  };

  test('ok + settled: s5_chat 한 번 · 장부 0 · 잔액 다시 읽기 / 위기 말은 서버 요청 0 으로 카드(서버가 같은 일을 다시 한다)', async () => {
    const r = rig([OK_CHAT]);
    const tree = await talk(r);
    const crisisReads = r.stateReads();
    await say(tree, '요즘 죽고 싶어요');
    expect(has(tree, 'saju-talk-cardview-crisis')).toBe(true);
    expect(r.requests).toHaveLength(0);
    expect(r.ledgerWrites()).toHaveLength(0);
    expect(r.stateReads()).toBe(crisisReads);
    await sayFirst(tree, '올해 일이 잘 풀릴까요?');
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0].body.feature).toBe('s5_chat');
    expect(Object.keys(r.requests[0].headers).sort()).toEqual(['apikey', 'authorization', 'content-type', 'idempotency-key']);
    expect(allTexts(tree).join(' ')).toContain('차분히 이어 가 볼게요.');
    expect(r.ledgerWrites()).toHaveLength(0);
    expect(r.stateReads()).toBeGreaterThan(crisisReads);
  });

  test('402 · 409 · 429 · 413 · 403: 코드별 한 줄 · 쓰던 글 그대로 · 잔액 그대로 · 장부 0', async () => {
    const r = rig([LOW(200, 50), ALREADY, DAILY, TOO_LONG, CLOSED]);
    const tree = await talk(r);
    await sayFirst(tree, '요즘 마음이 복잡해요');
    expect(textOf(tree, 'saju-talk-low-need')).toBe('필요한 건 200, 지금 가진 건 50이에요.');
    expect(must(tree, 'saju-talk-input').props.value).toBe('요즘 마음이 복잡해요');
    await press(tree, 'saju-talk-send');
    await wait(100);
    expect(textOf(tree, 'saju-talk-already')).toBe(AI_RUN.alreadyDone);
    await press(tree, 'saju-talk-send');
    await wait(100);
    expect(textOf(tree, 'saju-talk-daily')).toBe(AI_RUN.dailyLimit);
    expect(textOf(tree, 'saju-talk-free')).toBe(AI_RUN.noCharge);
    await press(tree, 'saju-talk-send');
    await wait(100);
    expect(textOf(tree, 'saju-talk-toolong')).toBe(AIT_TEXT['AIT.code.too_long']);
    expect(textOf(tree, 'saju-talk-free')).toBe(AI_RUN.noCharge);
    await press(tree, 'saju-talk-send');
    await wait(100);
    expect(textOf(tree, 'saju-talk-maint')).toBe(IF5_TEXT['SAJU.status.maint']);
    expect(must(tree, 'saju-talk-input').props.value).toBe('요즘 마음이 복잡해요');
    expect(await r.total()).toBe(1000);
    expect(r.ledgerWrites()).toHaveLength(0);
    expect(r.requests).toHaveLength(5);
  });
});

// ═══ 고민 정리(ait) · 별자리 ═══════════════════════════════════════════════════
describe('RS2-01 실서버 길 · 시험판 기능(고민 정리 · 별자리 풀이) — 접근 코드 없이 로그인으로', () => {
  beforeEach(async () => {
    mockMem.clear();
    aitStore.reset();
    await aitStore.load();
    await aitStore.setConsent(); // 시험자 동의만(코드는 없다)
  });

  const concern = async (served: Served[]) => {
    const s = server(served);
    setAiRunEnvForTest(s.env);
    const tree = keep(await mount(<ConcernChat visible onClose={jest.fn()} onSettings={jest.fn()} />));
    await press(tree, 'concern-start');
    return { tree, ...s };
  };
  const sendConcern = async (tree: ReactTestRenderer, text = '요즘 상대의 답이 늦어져서 마음이 쓰여요') => {
    await typeInto(tree, 'concern-mine', text);
    await press(tree, 'concern-send');
    await wait(100);
  };

  test('접근 코드가 없어도 실서버 길은 ai-run 으로 간다(코드 없음 안내 0) · 머리 넷 · feature chat', async () => {
    const { tree, requests } = await concern([reply(200, 'ok', { state: 'settled' }, { display: { stage: 'S1', sentences: [{ kind: 'summary', text: '말씀하신 마음을 정리해 볼게요.', refs: [], weak: false }], notes: [], chips: [], ended: false } })]);
    await sendConcern(tree);
    expect(has(tree, 'concern-nocode')).toBe(false);
    expect(requests).toHaveLength(1);
    expect(requests[0].body.feature).toBe('chat');
    expect(Object.keys(requests[0].headers).sort()).toEqual(['apikey', 'authorization', 'content-type', 'idempotency-key']);
    expect(JSON.stringify(requests[0].body)).not.toMatch(/user_id|cost_key|amount|hold/);
  });

  test('402 · 409 · 429 · 413 · 403 · 401 코드별 화면', async () => {
    const { tree, requests, lost } = await concern([LOW(330, 20), ALREADY, DAILY, TOO_LONG, CLOSED, NO_LOGIN]);
    await sendConcern(tree);
    expect(textOf(tree, 'concern-error-title')).toBe(IF5_TEXT['MILEAGE.low.title']);
    expect(textOf(tree, 'concern-error-need')).toBe('필요한 건 330, 지금 가진 건 20이에요.');
    await press(tree, 'concern-error-go');
    expect(mockRouter.push).toHaveBeenCalledWith('/mileage');
    await press(tree, 'concern-send');
    await wait(100);
    expect(textOf(tree, 'concern-error-text')).toBe(AI_RUN.alreadyDone);
    expect(has(tree, 'concern-error-retry')).toBe(false);
    await press(tree, 'concern-send');
    await wait(100);
    expect(textOf(tree, 'concern-error-text')).toBe(AI_RUN.dailyLimit);
    expect(textOf(tree, 'concern-error-free')).toBe(AI_RUN.noCharge);
    expect(has(tree, 'concern-error-retry')).toBe(false);
    await press(tree, 'concern-send');
    await wait(100);
    expect(textOf(tree, 'concern-error-text')).toBe(AIT_TEXT['AIT.code.too_long']);
    expect(textOf(tree, 'concern-error-free')).toBe(AI_RUN.noCharge);
    await press(tree, 'concern-send');
    await wait(100);
    expect(textOf(tree, 'concern-error-text')).toBe(AIT_TEXT['AIT.code.unavailable']);
    await press(tree, 'concern-send');
    await wait(100);
    expect(lost).toHaveBeenCalledTimes(1); // 401 → 로그인 끝 처리
    expect(textOf(tree, 'concern-error-text')).toBe(AIT_TEXT['AIT.code.unavailable']); // 접근 코드 안내가 아니다
    expect(requests).toHaveLength(6);
  });

  test('끊김 → 다시 시도는 같은 키 · 서버가 답한 뒤 새 누름은 새 키 · 끊김에는 "쓰이지 않았어요" 줄 0', async () => {
    const { tree, requests } = await concern(['throw', DAILY, TOO_LONG]);
    await sendConcern(tree);
    expect(has(tree, 'concern-error-free')).toBe(false);
    await press(tree, 'concern-send');
    await wait(100);
    await press(tree, 'concern-send');
    await wait(100);
    const keys = requests.map((q) => q.headers['idempotency-key']);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  test('별자리 풀이(useAitRun): 코드 없이 ai-run · 429 안내와 차감 없음 줄', async () => {
    const s = server([DAILY]);
    setAiRunEnvForTest(s.env);
    const tree = keep(await mount(<StarAiBlock signs={['leo']} stem={2} onSettings={jest.fn()} />));
    await press(tree, 'star-ai-go');
    await wait(100);
    expect(textOf(tree, 'star-ai-error-text')).toBe(AI_RUN.dailyLimit);
    expect(textOf(tree, 'star-ai-error-free')).toBe(AI_RUN.noCharge);
    expect(s.requests[0].body.feature).toBe('horoscope');
  });
});
