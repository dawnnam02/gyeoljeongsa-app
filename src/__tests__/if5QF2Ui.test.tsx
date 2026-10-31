// IF5-QF2 위기 사전 2차 — 사주 이야기와 연애 고민 정리 화면: 가해 의도 카드 · 갈래 겹침 카드(위로 줄 bridge) · 미성년이 끼면 세션 마침.
//  팀장이 직접 넣어 확인한 문장이 화면에서 같은 카드로 나오는지 본다. 모의 서버(0048 모양) + 모의 AI 응답만(실호출 0 · 실결제 0).
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { AIT_TEXT } from '@/content/aitCopy';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createDemoSaju } from '@/demo/sajuDemo';
import { ConcernChat } from '@/features/ait/ConcernChat';
import { aitStore } from '@/features/ait/aitStore';
import type { AitResult } from '@/features/ait/aitTypes';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import { rpcOf } from '@/features/inflight/inflightApi';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi } from '@/features/mileage/mileageApi';
import { newRequestId, runAi } from '@/features/saju/ai/aiRun';
import { createAiResults } from '@/features/saju/ai/aiResults';
import type { AiServices } from '@/features/saju/ai/aiService';
import { createInputStore, memoryInputStorage, type InputStore } from '@/features/saju/deviceInput';
import { createSajuApi } from '@/features/saju/sajuApi';
import type { SajuDeps } from '@/features/saju/sajuService';
import { CRISIS_CLOSE_AT, SajuTalkScreen } from '@/features/saju/SajuTalkScreen';

import { allTexts, has, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: () => undefined, Redirect: () => null }));
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
});

const NOW = Date.parse('2027-03-20T03:00:00Z');
const flagsAll = () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])) as Record<string, boolean>;
const okReply = (display: unknown): AitResult => ({ kind: 'reply', reply: { ok: true, code: 'ok', mode: 'mock', display, card: null, bundle: null, retryAfterSec: null } });

function aiRig(opts: { code?: string | null; email?: string; post?: AiServices['post'] } = {}) {
  const flags = flagsAll();
  const mile = createDemoMileage({ flags: async () => flags });
  const saju = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate: '1994-03-14', consentOn: () => true }), today: () => '2027-03-20' });
  const u = { id: 'u-qf2', email: opts.email ?? 'sj@email.com' };
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const call = async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    return (mile.handles(fn) ? mile.rpc(u, fn, args) : saju.rpc(u, fn, args)) as never;
  };
  const posts: { kind: string; body: Record<string, unknown> }[] = [];
  const consent = createIf5ConsentStore();
  void consent.setItems({ time: true, place: true, gender: true });
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
        return okReply({ reply: '차분히 쌓아 가는 흐름이에요.', ask: '', flags: [], turns: 1, summarized: false });
      }),
    newId: () => 'req-' + Math.random().toString(36).slice(2, 12),
  };
  const ck17: Ck17Api = { load: async () => ({ ok: true, data: { a: true, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
  const deps: SajuDeps = { api: createSajuApi(rpcOf({ rpc: call } as never)), ck17, isOn: (k) => flags[k] === true, now: () => NOW, birthDate: async () => '1994-03-14', consent, ai };
  return { ai, deps, calls, posts, consent };
}
const answered = (): InputStore => {
  const s = createInputStore(memoryInputStorage(), []);
  void s.save({ time: { hour: 15, minute: 20 }, place: '서울', saveTime: false, savePlace: false });
  return s;
};

describe('IF5-QF2 사주 이야기: 가해 의도 카드 · 겹침 카드', () => {
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
  const lines = (tree: ReactTestRenderer, kind: string, n: number) => Array.from({ length: n }, (_, i) => textOf(tree, `saju-talk-cardview-${kind}-l${i + 1}`));
  const totalOf = async (r: ReturnType<typeof aiRig>) => {
    const s = await r.ai.mileage.state();
    return s.ok ? s.data.total : -1;
  };

  test('가해 의도(남편을 죽이고 싶어요): 제목 · 위로 · 112 · 109 · 상담 아님 5줄 · 1366 0 · 폭력 4번째 줄 0 · 차감 0 · 글이 남지 않음', async () => {
    const r = aiRig({ code: null }); // 동의 전 · 코드 없음 · 잔액 1,000
    const tree = await talk(r);
    await say(tree, '남편을 죽이고 싶어요');
    expect(has(tree, 'saju-talk-cardview-harm_intent')).toBe(true);
    expect(isOpen(tree, 'saju-talk-ck17d')).toBe(false);
    expect(lines(tree, 'harm_intent', 5)).toEqual(['지금 마음이 많이 격해졌나 봐요', '잠깐 그 자리에서 벗어나 숨을 고르셔도 돼요.', '지금 위험하다면 112에 바로 연락해 주세요.', AIT_TEXT['CONCERN_CARD.crisis.l2'], '저희가 전화 상담을 대신하지 않아요.']);
    expect(has(tree, 'saju-talk-cardview-harm_intent-l6')).toBe(false);
    const all = allTexts(tree).join(' ');
    expect(lines(tree, 'harm_intent', 5).join(' ')).not.toContain('1366'); // 카드 안(상시 한 줄의 1366은 화면 전체에 늘 있다)
    expect(all).not.toContain(AIT_TEXT['CONCERN_CARD.violence.l4']);
    expect(all).not.toContain('죽이고 싶어요');
    expect(must(tree, 'saju-talk-input').props.value).toBe('');
    expect(has(tree, 'saju-talk-cardview-harm_intent-continue')).toBe(true);
    expect(await totalOf(r)).toBe(1000);
    expect(r.posts).toHaveLength(0);
    expect(r.calls.filter((c) => c.fn === 'demo_mileage_hold')).toHaveLength(0);
  });

  test('가해 의도도 위기처럼 횟수에 센다: 5번째에 세션이 닫힌다(카드는 계속 보임)', async () => {
    const r = aiRig({ code: null, email: 'mzero@email.com' });
    const tree = await talk(r);
    for (let i = 0; i < CRISIS_CLOSE_AT - 1; i += 1) {
      await say(tree, '남편을 죽이고 싶어요');
      expect(has(tree, 'saju-talk-input')).toBe(true);
    }
    await say(tree, '남편을 죽이고 싶어요');
    expect(has(tree, 'saju-talk-closed')).toBe(true);
    expect(has(tree, 'saju-talk-input')).toBe(false);
    expect(has(tree, 'saju-talk-cardview-harm_intent')).toBe(true);
    expect(await totalOf(r)).toBe(0);
  });

  test('위기 + 폭력(남편이 때려서 죽고 싶어요): 위기 카드 + 위로 줄이 1366 바로 위 · 안전 확인 줄이 맨 끝 · 이어 갈 수 있다', async () => {
    const r = aiRig({ code: null });
    const tree = await talk(r);
    await say(tree, '남편이 때려서 죽고 싶어요');
    expect(has(tree, 'saju-talk-cardview-crisis')).toBe(true);
    expect(lines(tree, 'crisis', 6)).toEqual([
      AIT_TEXT['CONCERN_CARD.crisis.l1'],
      AIT_TEXT['CONCERN_CARD.crisis.l2'],
      AIT_TEXT['CONCERN_CARD.crisis.l3'],
      '함께 말씀해 주신 일이 걱정돼서, 아래 안내도 같이 드려요.',
      AIT_TEXT['CONCERN_CARD.violence.l2'],
      AIT_TEXT['CONCERN_CARD.crisis.l4'],
    ]);
    expect(allTexts(tree).join(' ')).not.toContain(AIT_TEXT['CONCERN_CARD.violence.l4']);
    expect(has(tree, 'saju-talk-input')).toBe(true);
    expect(has(tree, 'saju-talk-closed')).toBe(false);
    expect(has(tree, 'saju-talk-cardview-crisis-continue')).toBe(true);
    expect(await totalOf(r)).toBe(1000);
  });

  test('위기 + 미성년(저는 고2인데 죽고싶어요): 위로 줄이 1388 바로 위 · 세션을 마친다 · 이어서 단추 0 · 입력 칸 0 · [새로 시작]은 그대로', async () => {
    const r = aiRig({ code: null });
    const tree = await talk(r);
    await say(tree, '저는 고2인데 죽고싶어요');
    expect(lines(tree, 'crisis', 6)).toEqual([
      AIT_TEXT['CONCERN_CARD.crisis.l1'],
      AIT_TEXT['CONCERN_CARD.crisis.l2'],
      AIT_TEXT['CONCERN_CARD.crisis.l3'],
      '여기서 이야기를 이어 가기는 어려워서, 도움받을 곳을 하나 더 알려 드려요.',
      AIT_TEXT['CONCERN_CARD.minor.l2'],
      AIT_TEXT['CONCERN_CARD.crisis.l4'],
    ]);
    expect(has(tree, 'saju-talk-closed')).toBe(true);
    expect(has(tree, 'saju-talk-input')).toBe(false);
    expect(has(tree, 'saju-talk-cardview-crisis-continue')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/고2|죽고싶어요/);
    await press(tree, 'saju-talk-restart'); // 지금 있는 대로 둔다
    expect(has(tree, 'saju-talk-input')).toBe(true);
    expect(await totalOf(r)).toBe(1000);
  });

  test('팀장 확인 문장: 폭력 · 오용 · 카드 0 (만 5세 자녀 · 혼자 해요)', async () => {
    const t1 = await talk(aiRig({ code: null }));
    await say(t1, '남자친구가 제 위치를 추적하고 있어요');
    expect(has(t1, 'saju-talk-cardview-violence')).toBe(true);
    expect(has(t1, 'saju-talk-cardview-misuse')).toBe(false);
    const t2 = await talk(aiRig({ code: null }));
    await say(t2, '제가 남친 위치를 추적하고 있어요');
    expect(has(t2, 'saju-talk-cardview-misuse')).toBe(true);
    expect(has(t2, 'saju-talk-cardview-violence')).toBe(false);
    for (const text of ['우리 아이가 만 5세예요', '혼자 해요']) {
      const t = await talk(aiRig({ code: null }));
      await say(t, text);
      expect(allTexts(t).join(' ')).not.toContain('걱정돼서');
      expect(['crisis', 'harm_intent', 'violence', 'misuse', 'minor'].some((k) => has(t, `saju-talk-cardview-${k}`))).toBe(false);
      expect(has(t, 'saju-talk-closed')).toBe(false);
      expect(isOpen(t, 'saju-talk-ck17d')).toBe(true); // 평범한 글은 예전 그대로 동의 시트가 먼저
    }
  });

  test('코드 있는 길: 서버가 겹침 카드를 줘도(also 없이 줄만) 그대로 그리고 미성년이 끼면 세션을 마친다 · 차감 0', async () => {
    const composed = [
      AIT_TEXT['CONCERN_CARD.crisis.l1'],
      AIT_TEXT['CONCERN_CARD.crisis.l2'],
      AIT_TEXT['CONCERN_CARD.crisis.l3'],
      '여기서 이야기를 이어 가기는 어려워서, 도움받을 곳을 하나 더 알려 드려요.',
      AIT_TEXT['CONCERN_CARD.minor.l2'],
      AIT_TEXT['CONCERN_CARD.crisis.l4'],
    ];
    const post: AiServices['post'] = async (_k, body) =>
      body.precheck
        ? okReply(null)
        : { kind: 'reply', reply: { ok: false, code: 'crisis', mode: 'mock', display: null, card: { id: 'crisis', lines: composed, options: ['continue', 'end'] }, bundle: null, retryAfterSec: null } };
    const r = aiRig({ code: 'ait-code', post });
    await r.consent.agreeD();
    await r.consent.agreeT(false);
    const tree = await talk(r);
    await say(tree, '그냥 안부');
    await press(tree, 'saju-talk-start-go');
    await say(tree, '요즘 어떠세요');
    expect(lines(tree, 'crisis', 6)).toEqual(composed);
    expect(has(tree, 'saju-talk-closed')).toBe(true);
    expect(has(tree, 'saju-talk-cardview-crisis-continue')).toBe(false);
    expect(await totalOf(r)).toBe(1000);
  });

  test('runAi: 가해 의도는 코드 없는 길에서도 카드 · 차감 0', async () => {
    const r = aiRig({ code: null });
    const out = await runAi({ edge: r.ai.edge, code: () => null }, { kind: 'chat', requestId: newRequestId(), chars: 10, text: '남편을 죽이고 싶어요', facts: {} });
    expect(out.kind).toBe('card');
    if (out.kind === 'card') expect(out.card.id).toBe('harm_intent');
    expect(await totalOf(r)).toBe(1000);
  });
});

describe('IF5-QF2 연애 고민 정리: 가해 의도 카드 · 겹침 카드', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    mockMem.clear();
    aitStore.reset();
  });
  afterEach(() => {
    global.fetch = realFetch;
  });
  const flush = () => act(async () => new Promise((r) => setTimeout(r, 10)));
  const open = async () => {
    const tree = keep(await mount(<ConcernChat visible onClose={jest.fn()} onSettings={jest.fn()} />));
    await press(tree, 'concern-start');
    return tree;
  };
  const sendText = async (tree: ReactTestRenderer, text: string) => {
    await typeInto(tree, 'concern-mine', text);
    await press(tree, 'concern-send');
    await flush();
  };
  const cardLines = (tree: ReactTestRenderer, i: number, kind: string, n: number) => Array.from({ length: n }, (_, j) => textOf(tree, `concern-item-${i}-${kind}-l${j + 1}`));

  test('코드 없는 길: 가해 의도 카드 5줄 · 1366 0 · 요청 0 · 쓴 글 0', async () => {
    const f = jest.fn();
    global.fetch = f as unknown as typeof fetch;
    const tree = await open();
    await sendText(tree, '남편을 죽이고 싶어요 CANARY');
    expect(cardLines(tree, 0, 'harm_intent', 5)).toEqual(['지금 마음이 많이 격해졌나 봐요', '잠깐 그 자리에서 벗어나 숨을 고르셔도 돼요.', '지금 위험하다면 112에 바로 연락해 주세요.', AIT_TEXT['CONCERN_CARD.crisis.l2'], '저희가 전화 상담을 대신하지 않아요.']);
    const all = allTexts(tree).join(' ');
    expect(all).not.toContain('CANARY');
    expect(cardLines(tree, 0, 'harm_intent', 5).join(' ')).not.toContain('1366');
    expect(all).not.toContain(AIT_TEXT['CONCERN_CARD.violence.l4']);
    expect(must(tree, 'concern-mine').props.value).toBe('');
    expect(has(tree, 'concern-nocode')).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  test('위기 + 폭력 · 위기 + 미성년: 위로 줄 위치 · 미성년이 끼면 입력 칸이 닫힌다', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const tree = await open();
    await sendText(tree, '남편이 때려서 죽고 싶어요');
    expect(cardLines(tree, 0, 'crisis', 6)).toEqual([
      AIT_TEXT['CONCERN_CARD.crisis.l1'],
      AIT_TEXT['CONCERN_CARD.crisis.l2'],
      AIT_TEXT['CONCERN_CARD.crisis.l3'],
      '함께 말씀해 주신 일이 걱정돼서, 아래 안내도 같이 드려요.',
      AIT_TEXT['CONCERN_CARD.violence.l2'],
      AIT_TEXT['CONCERN_CARD.crisis.l4'],
    ]);
    expect(has(tree, 'concern-mine')).toBe(true);
    await sendText(tree, '저는 고2인데 죽고싶어요');
    expect(cardLines(tree, 1, 'crisis', 6)[3]).toBe('여기서 이야기를 이어 가기는 어려워서, 도움받을 곳을 하나 더 알려 드려요.');
    expect(cardLines(tree, 1, 'crisis', 6)[4]).toBe(AIT_TEXT['CONCERN_CARD.minor.l2']);
    expect(has(tree, 'concern-item-1-crisis-continue')).toBe(false);
    expect(allTexts(tree)).toContain(AIT_TEXT['CONCERN_CARD.minor.end']);
    expect(has(tree, 'concern-mine')).toBe(false);
  });

  test('팀장 확인 문장: 폭력 · 오용 · 카드 0', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const tree = await open();
    await sendText(tree, '남자친구가 제 위치를 추적하고 있어요');
    expect(has(tree, 'concern-item-0-violence-l1')).toBe(true);
    await sendText(tree, '제가 남친 위치를 추적하고 있어요');
    expect(has(tree, 'concern-item-1-misuse-l1')).toBe(true);
    await sendText(tree, '우리 아이가 만 5세예요');
    expect(has(tree, 'concern-item-2-minor-l1')).toBe(false);
    expect(has(tree, 'concern-nocode')).toBe(true);
  });
});
