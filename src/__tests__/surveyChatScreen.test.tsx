// V6-F 대화형 설문 화면 — 데모 모의 서버(실서버와 같은 API 길) · 메모리 기기 저장으로 돈다. 실제 호출 0.
//  1. 저장 키 대조: 1부 전체를 대화로 답하면 저장된 키 · 값이 설문 v2 와 같다(설문 v2 화면 시험의 FULL 과 한 칸씩)
//  2. CK16 없이 행동 숫자 0(요청에 behavior 키 없음 · 서버 저장 0) · 동의하면 숫자 6개만
//  3. 25턴 상한 · 4. 이어서 하기(1부 · 2부) · 5. 지난 답 고치기 · 6. 늦음 · 실패에도 멈춤 0 · 7. 내 성향 고치기 → user_edited
import { act } from 'react-test-renderer';
import { BackHandler } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

import { CHAT_V6 } from '@/content/surveyChatCopy';
import { createDemoChatMemory, createSurveyChatDemoClient, MAX_USER_TURNS, type DemoChatMemory } from '@/demo/surveyChatBackend';
import { demoV2Seed } from '@/demo/surveyV2Backend';
import type { ScriptTurn } from '@/demo/surveyChatScripts';
import { DEMO_ANALYSIS, DEMO_SCRIPTS } from '@/demo/surveyChatScripts';
import { createSurveyChatApi } from '@/features/surveyChat/api';
import type { SurveyChatDeps } from '@/features/surveyChat/deps';
import { createLocalChatStore } from '@/features/surveyChat/localChat';
import { SurveyChatScreen } from '@/features/surveyChat/SurveyChatScreen';
import { createSurveyV2Api } from '@/features/surveyV2/api';
import { createLocalDraftStore } from '@/features/surveyV2/localDraft';
import { emptyDraft, qOf } from '@/features/surveyV2/model';
import { createPoliticsApi } from '@/features/surveyV2/politics';
import { SIGUNGU } from '@/features/surveyV2/regions';
import type { V2Value } from '@/features/surveyV2/types';
import { chunkedStorage } from '@/lib/chunkedStorage';

import { createMemoryStore } from './memoryStore';
import { allTexts, has, mount, press, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: () => undefined }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/lib/services', () => ({ supabase: {} }));
jest.mock('@/lib/log', () => ({ safeLog: jest.fn() }));

jest.setTimeout(180_000);

type Tree = Awaited<ReturnType<typeof mount>>;
const base = (id: string, email: string) => ({ auth: { getSession: async () => ({ data: { session: { user: { id, email } } }, error: null }) } }) as unknown as Pick<SupabaseClient, 'auth'>;

function rig(opts: { id?: string; email?: string; memory?: DemoChatMemory; store?: ReturnType<typeof createMemoryStore>; politics?: boolean; script?: readonly ScriptTurn[]; slowMs?: number; failTurns?: number; dropReplies?: number } = {}) {
  const memory = opts.memory ?? createDemoChatMemory();
  const store = opts.store ?? createMemoryStore();
  const id = opts.id ?? 'u1';
  demoV2Seed(memory.v2, id, { ck4: true }); // 3부-사: 03 에서 CK4 를 하고 온 회원(카드 없이 A06 — 카드 시험은 s3saReligion)
  const client = createSurveyChatDemoClient(base(id, opts.email ?? 'v6f@email.com'), { memory, scriptScale: 0, script: opts.script, failTurns: opts.failTurns, dropReplies: opts.dropReplies });
  const api = createSurveyV2Api(client, { demo: true, proofUpload: false, schoolSearch: 'server' });
  const clock = { t: 0 };
  const deps: SurveyChatDeps = {
    v2: { api, local: createLocalDraftStore(chunkedStorage(store.store)), now: () => 1_761_000_000_000, ...(opts.politics ? { politics: createPoliticsApi(client, 'test') } : {}) },
    chat: createSurveyChatApi(client, 'test'),
    store: createLocalChatStore(chunkedStorage(store.store)),
    device: 'phone',
    slowMs: opts.slowMs ?? 5_000,
    monotonic: () => (clock.t += 150),
  };
  return { memory, store, deps, api, client, id };
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const show = async (deps: SurveyChatDeps) => {
  const tree = await mount(<SurveyChatScreen deps={deps} />);
  await wait(40);
  return tree;
};
const tap = async (tree: Tree, id: string) => {
  await press(tree, id);
  await wait(15);
};
const typeField = async (tree: Tree, id: string, value: string) => {
  const node = tree.root.findAll((n) => n.props.testID === id && typeof n.props.onChangeText === 'function')[0];
  if (!node) throw new Error(`입력 칸 ${id} 가 없어요`);
  await act(async () => {
    node.props.onChangeText(value);
  });
};
const currentCard = (tree: Tree): string | null => {
  const n = tree.root.findAll((x) => typeof x.props.testID === 'string' && x.props.testID.startsWith('chat-card-'))[0];
  return n ? String(n.props.testID).slice('chat-card-'.length) : null;
};
const v2Answers = (m: DemoChatMemory, id = 'u1') => m.v2.users.get(id)?.answers ?? {};
const v2Texts = (m: DemoChatMemory, id = 'u1') => m.v2.users.get(id)?.texts ?? {};
const chatUser = (m: DemoChatMemory, id = 'u1') => m.users.get(id);

// 설문 v2 화면 시험(surveyV2Screen.test FULL)과 같은 답 — 여성 · 대학교 · 대기업 · 희망 조건 대부분 '상관없어요'(F03 만 활성)
const FULL: Record<string, V2Value> = {
  A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165, A06: 'none', A07: 'never', A08: 'none', A11: 'na',
  B01: 'univ', B02: { school_key: 'K0138' }, B06: 'grad', B07: 'no', B04: 'none',
  C01: 'large', C02: '한빛전자', C03: 'staff', C04: 'regular', C05: 'inc05', C06: 'ast04',
  D08: 'unknown', D09: 'no_college', D04: 'pas02', D05: '1', D06: 'first',
  E14: 3, E15: 3, A09: 'no', A10: 'rare', E12: 'morning', E11: ['travel'],
  E10: 'talk_now', E13: ['family', 'work', 'money', 'leisure', 'health'], E16: 3, E08: 3, E09: 3,
  E01: 'y1', E02: 'yes', E03: 3, E04: 3, E05: 3, E06: 'seoul', E07: 'joint',
  F01: 'any', F02: 'any', F03: 'univ', F04: ['any'], F05: 'any', F06: ['any'], F08: ['any'], F09: ['any'], F10: ['any'], F14: 'any', F15: 'any', F16: 'any', F11: 3, F13: ['F03'],
};

// 지금 카드의 문항에 FULL 값으로 답한다(사람처럼 누른다)
async function answerCurrent(tree: Tree, id: string) {
  const v = FULL[id];
  const send = () => tap(tree, 'chat-send');
  const q = qOf(id);
  if (id === 'B03' || id === 'F12') return tap(tree, 'chat-skip');
  if (q.format === 'choice') return tap(tree, `v2-${id}-opt-${String(v)}`);
  if (q.format === 'bucket') {
    await tap(tree, `v2-${id}-opt-${String(v)}`);
    return send();
  }
  if (q.format === 'line') {
    await typeInto(tree, `v2-${id}-input`, String(v));
    return send();
  }
  if (id === 'A03') {
    await tap(tree, 'v2-A03-sido-seoul');
    await tap(tree, `v2-A03-sigungu-${SIGUNGU.seoul.indexOf('강남구')}`);
    return send();
  }
  if (id === 'A05') {
    await typeField(tree, 'v2-A05-input', '165');
    return send();
  }
  if (id === 'B02') {
    await typeInto(tree, 'v2-B02-search', '연대');
    await wait(400);
    await tap(tree, 'v2-B02-hit-0');
    return send();
  }
  if (q.format === 'school') {
    await tap(tree, `v2-${id}-opt-${String(v)}`);
    return send();
  }
  if (q.format === 'scale5') {
    await tap(tree, `v2-${id}-opt-${String(v)}`);
    return send();
  }
  if (q.format === 'multi') {
    for (const c of v as string[]) await tap(tree, `v2-${id}-opt-${c}`);
    return send();
  }
  if (q.format === 'range') {
    await tap(tree, `v2-${id}-any`);
    return send();
  }
  if (id === 'E13') {
    await tap(tree, 'v2-E13-keep');
    return send();
  }
  if (id === 'F13') {
    await tap(tree, 'v2-F13-opt-F03');
    return send();
  }
  throw new Error(`답하는 법이 없는 문항 ${id}`);
}

async function answerPart1(tree: Tree) {
  const order: string[] = [];
  for (let guard = 0; guard < 80; guard += 1) {
    const id = currentCard(tree);
    if (!id || id === 'POL') break;
    order.push(id);
    await answerCurrent(tree, id);
    if (currentCard(tree) === id) throw new Error(`${id} 에서 넘어가지 않았어요: ${allTexts(tree).slice(-4).join(' / ')}`);
  }
  return order;
}

// 1부 답을 미리 넣어 둔다(2부 시험용) — 같은 저장 길(save_answers)
async function seed(r: ReturnType<typeof rig>) {
  const { B02: _b, ...rest } = FULL;
  const res = await r.api.save({ answers: { ...rest, B02: 'unlisted_kr' } });
  expect(res.ok).toBe(true);
}

async function toPart2(tree: Tree, agree: boolean) {
  await tap(tree, 'chat-resume-go');
  await wait(60);
  expect(has(tree, 'chat-ck16')).toBe(true);
  await tap(tree, agree ? 'chat-ck16-agree' : 'chat-ck16-skip');
  await wait(60);
  expect(has(tree, 'chat-composer-input')).toBe(true);
}

// 한 글자씩 조합하며 치고 보낸다
async function say(tree: Tree, text: string) {
  let acc = '';
  for (const ch of text) {
    acc += ch;
    await typeInto(tree, 'chat-composer-input', acc);
  }
  await tap(tree, 'chat-composer-send');
  await wait(40);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }));
});
afterEach(() => jest.restoreAllMocks());

describe('1. 1부 저장 키 · 값 = 설문 v2', () => {
  test('시작 → 1부 전부 대화로 → 정치 나중에 → CK16 거절 → 2부 → 여기까지 → 정리 → 내 성향 → 글 문항 → 답 한눈에 보기', async () => {
    const r = rig({ politics: true });
    const tree = await show(r.deps);
    expect(has(tree, 'chat-intro')).toBe(true);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([CHAT_V6['CHAT.START.title'], CHAT_V6['CHAT.START.points.1']]));
    await tap(tree, 'chat-start');
    expect(currentCard(tree)).toBe('A12');
    expect(allTexts(tree).join(' ')).toContain('지금 이야기 · 기본');
    const order = await answerPart1(tree);
    // 보이는 문항만 물었다(여성 → 병역 없음 · 활성 조건 F03 → F12 · F13 물음 · T01~T03 은 2부)
    expect(order).not.toContain('A11');
    expect(order.filter((x) => ['T01', 'T02', 'T03'].includes(x))).toEqual([]);
    expect(order).toEqual(expect.arrayContaining(['B03', 'F12', 'F13']));
    // 저장 키 · 값 대조(B02 는 검색 결과의 학교 키)
    const saved = v2Answers(r.memory);
    const e13 = emptyDraft(qOf('E13'), 'u1'); // '이대로 괜찮아요' = 사람마다 섞인 처음 순서(설문 v2 와 같은 씨앗)
    const want = { ...FULL, E13: e13.kind === 'rankAll' ? e13.order : [], B02: saved.B02 };
    expect(saved).toEqual(want);
    expect(saved.B02).toEqual({ school_key: expect.any(String) });
    // 정치 막대 → 나중에
    expect(currentCard(tree)).toBe('POL');
    await tap(tree, 'chat-pol-later');
    await wait(80);
    // CK16 카드: 같은 무게 버튼 둘 · 다섯 가지 안내
    expect(has(tree, 'chat-ck16')).toBe(true);
    for (const k of ['what', 'why', 'keys', 'keep', 'optional']) expect(has(tree, `chat-ck16-${k}`)).toBe(true);
    const agree = tree.root.findAll((n) => n.props.testID === 'chat-ck16-agree')[0];
    const skip = tree.root.findAll((n) => n.props.testID === 'chat-ck16-skip')[0];
    expect(agree.props.variant).toBe(skip.props.variant);
    await tap(tree, 'chat-ck16-skip');
    await wait(60);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([CHAT_V6['CHAT.BRIDGE.2'], CHAT_V6['CHAT.BRIDGE.3']]));
    expect(allTexts(tree)).not.toContain(CHAT_V6['CHAT.CK16.done']);
    await say(tree, '주변에서는 조용하지만 맡은 일은 끝까지 한다고 해요.');
    expect(allTexts(tree).join(' ')).toContain('지금 이야기 · 일과 하루');
    // CK16 없이 행동 숫자 0: 요청에 behavior 가 없고 서버 저장도 0
    expect(chatUser(r.memory)?.behaviorsReceived).toBe(0);
    expect(chatUser(r.memory)?.behaviorsSaved).toBe(0);
    // [여기까지 할게요] → 바로 정리(확인 시트 0) → 내 성향
    await tap(tree, 'chat-header-right');
    await wait(80);
    expect(has(tree, 'chat-traits')).toBe(true);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([CHAT_V6['CHAT.TRAITS.title'], DEMO_ANALYSIS.summary, DEMO_ANALYSIS.facts.T01, CHAT_V6['CHAT.TRAITS.style.warm']]));
    expect(allTexts(tree).join(' ')).not.toMatch(/\d+점|점수|등급/);
    await tap(tree, 'chat-traits-ok');
    await wait(40);
    expect(v2Texts(r.memory).T01).toBe(DEMO_ANALYSIS.facts.T01);
    // T02 · T03: AI 초안이 칸에 들어 있고 본인이 확인해 보낸다
    expect(currentCard(tree)).toBe('T02');
    await tap(tree, 'chat-send');
    expect(currentCard(tree)).toBe('T03');
    await tap(tree, 'chat-send');
    expect(v2Texts(r.memory)).toMatchObject({ T02: DEMO_ANALYSIS.facts.T02, T03: DEMO_ANALYSIS.facts.T03 });
    expect(has(tree, 'chat-review')).toBe(true);
    await tap(tree, 'chat-review');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/survey/[step]', params: { step: 'v2' } });
  });
});

describe('2. CK16 동의자만 행동 숫자', () => {
  test('동의하면 메시지마다 숫자 6개만 저장(키 이름만 확인 · 글 0) · 동의 완료 줄', async () => {
    const r = rig();
    await seed(r);
    const tree = await show(r.deps);
    await toPart2(tree, true);
    expect(allTexts(tree)).toContain(CHAT_V6['CHAT.CK16.done']);
    await say(tree, '가까운 사람들은 저를 차분하다고 말해요.');
    expect(chatUser(r.memory)?.ck16).toBe(true);
    expect(chatUser(r.memory)?.behaviorsSaved).toBe(1);
    expect(chatUser(r.memory)?.savedKeys).toEqual(['chars_per_sec_x10', 'compose_ms', 'delete_ratio_pm', 'first_key_ms', 'pauses_3s', 'rewrites']);
  });
});

describe('3. 25턴 상한', () => {
  test('모델이 끝내지 않아도 내 답 25번이면 정리로 넘어가고 더 보내지 못한다', async () => {
    const endless: ScriptTurn[] = Array.from({ length: 40 }, (_, i) => ({ flow: 'normal', ms: 0, source: 'model', say: `받아 주는 말이에요. 질문 ${i + 1}이에요?`, slot: 'rest', filled: [], done: false }));
    const r = rig({ script: endless });
    await seed(r);
    const tree = await show(r.deps);
    await toPart2(tree, false);
    for (let i = 0; i < MAX_USER_TURNS; i += 1) {
      expect(has(tree, 'chat-composer-input')).toBe(true);
      await say(tree, `답 ${i + 1}`);
    }
    await wait(80);
    expect(has(tree, 'chat-composer-input')).toBe(false);
    expect(r.memory.users.get('u1')?.sessions[0].userTurns).toBe(MAX_USER_TURNS);
    expect(has(tree, 'chat-traits')).toBe(true);
  });
});

describe('4. 이어서 하기', () => {
  test('1부 중간에 나갔다 오면 멈춘 날 · 이어서 하기 · 지난 답은 그대로', async () => {
    const memory = createDemoChatMemory();
    const store = createMemoryStore();
    const r1 = rig({ memory, store });
    const t1 = await show(r1.deps);
    await tap(t1, 'chat-start');
    await answerCurrent(t1, 'A12');
    await answerCurrent(t1, 'A02');
    expect(currentCard(t1)).toBe('A03');
    t1.unmount();
    const r2 = rig({ memory, store });
    const t2 = await show(r2.deps);
    expect(allTexts(t2)).toContain(CHAT_V6['CHAT.RESUME.part1']);
    expect(has(t2, 'chat-stopped')).toBe(true);
    expect(has(t2, 'chat-me-A12')).toBe(true);
    await tap(t2, 'chat-resume-go');
    expect(currentCard(t2)).toBe('A03');
  });

  test('2부 중간에 나갔다 오면 나눈 이야기가 위에 그대로 · 이어 갈게요 줄 · 글 입력', async () => {
    const memory = createDemoChatMemory();
    const store = createMemoryStore();
    const r1 = rig({ memory, store });
    await seed(r1);
    const t1 = await show(r1.deps);
    await toPart2(t1, false);
    await say(t1, '조용한 편이에요.');
    t1.unmount();
    const t2 = await show(rig({ memory, store }).deps);
    await wait(60);
    expect(allTexts(t2)).toEqual(expect.arrayContaining(['조용한 편이에요.', CHAT_V6['CHAT.RESUME.part2']]));
    expect(has(t2, 'chat-composer-input')).toBe(true);
  });
});

describe('5. 지난 답 눌러 고치기', () => {
  test('내 답을 누르면 그 자리에서 다시 고르고 [바꾸기] → 저장 · 고친 답으로 바꿔 두었어요 · [그대로 둘게요]는 그대로', async () => {
    const r = rig();
    const tree = await show(r.deps);
    await tap(tree, 'chat-start');
    for (const id of ['A12', 'A02', 'A03']) await answerCurrent(tree, id);
    expect(v2Answers(r.memory).A02).toBe('female');
    await tap(tree, 'chat-me-A02');
    expect(has(tree, 'chat-edit-start')).toBe(true);
    await tap(tree, 'v2-A02-opt-male'); // 고치는 중에는 눌러도 바로 보내지 않는다
    expect(v2Answers(r.memory).A02).toBe('female');
    await tap(tree, 'chat-edit-change');
    expect(v2Answers(r.memory).A02).toBe('male');
    expect(allTexts(tree)).toContain(CHAT_V6['CHAT.EDIT.done']);
    expect(currentCard(tree)).toBe('A05');
    await tap(tree, 'chat-me-A12');
    await tap(tree, 'chat-edit-keep');
    expect(v2Answers(r.memory).A12).toBe('김하나');
    expect(has(tree, 'chat-edit-start')).toBe(false);
  });
});

describe('6. 늦음 · 실패에도 멈춤 0', () => {
  test('늦으면 점 3개 아래 천천히 읽고 있어요 → 답이 오면 사라짐', async () => {
    const slow: ScriptTurn[] = [{ flow: 'slow', ms: 400, source: 'model', say: '천천히 들었어요. 쉬는 날은 어떻게 보내세요?', slot: 'rest', filled: ['intro'], done: false }];
    const r = rig({ script: slow, slowMs: 100 });
    await seed(r);
    const tree = await show(r.deps);
    await toPart2(tree, false);
    let acc = '';
    for (const ch of '조용한 편이에요.') {
      acc += ch;
      await typeInto(tree, 'chat-composer-input', acc);
    }
    await press(tree, 'chat-composer-send');
    await wait(200);
    expect(has(tree, 'chat-typing')).toBe(true);
    expect(allTexts(tree)).toContain(CHAT_V6['CHAT.TALK.slow']);
    await wait(400);
    expect(has(tree, 'chat-typing')).toBe(false);
    expect(allTexts(tree)).toContain('천천히 들었어요. 쉬는 날은 어떻게 보내세요?');
  });

  test('통신이 끊기면 다른 이야기로 이어 가 볼게요 + 다음 빈 칸 예비 질문, 입력은 그대로', async () => {
    const r = rig({ email: 'v6down@email.com' });
    await seed(r);
    const tree = await show(r.deps);
    await toPart2(tree, false);
    await say(tree, '조용한 편이에요.');
    expect(allTexts(tree)).toEqual(expect.arrayContaining([CHAT_V6['CHAT.TALK.fallbackLead'], CHAT_V6['CHAT.SLOT.work_day.fallback']]));
    expect(has(tree, 'chat-composer-input')).toBe(true);
    await say(tree, '아홉 시에 출근해요.');
    expect(allTexts(tree)).toContain(CHAT_V6['CHAT.SLOT.family_ties.fallback']);
  });

  test('못 보낸 글은 다음 턴 앞에 한 번 다시 보낸다(같은 번호는 서버가 한 번만) — 성공하면 표시 없음', async () => {
    const r = rig({ failTurns: 1 });
    await seed(r);
    const tree = await show(r.deps);
    await toPart2(tree, false);
    await say(tree, '첫 번째 답이에요.');
    expect(allTexts(tree)).toContain(CHAT_V6['CHAT.TALK.fallbackLead']);
    await say(tree, '두 번째 답이에요.');
    const s = r.memory.users.get('u1')?.sessions[0];
    expect(s?.turns.filter((x) => x.role === 'user').map((x) => x.text)).toEqual(['첫 번째 답이에요.', '두 번째 답이에요.']);
    expect(allTexts(tree)).not.toContain(CHAT_V6['CHAT.TALK.unsent']);
  });

  test('duplicate: 서버는 받았는데 응답을 잃은 턴은 다시 보내면 저장 없이 그때 AI 말이 와서 그 글 뒤에 이어 붙는다', async () => {
    const r = rig({ dropReplies: 1 });
    await seed(r);
    const tree = await show(r.deps);
    await toPart2(tree, false);
    await say(tree, '첫 번째 답이에요.');
    expect(allTexts(tree)).toContain(CHAT_V6['CHAT.TALK.fallbackLead']);
    await say(tree, '두 번째 답이에요.');
    const texts = allTexts(tree);
    const first = DEMO_SCRIPTS.P01[0].say;
    expect(texts).toContain(first);
    expect(texts.indexOf(first)).toBeLessThan(texts.indexOf('두 번째 답이에요.'));
    expect(r.memory.users.get('u1')?.sessions[0].turns.filter((x) => x.role === 'user').map((x) => x.text)).toEqual(['첫 번째 답이에요.', '두 번째 답이에요.']);
  });

  test('두 번 실패하면 그 자리에 보내지 못한 글 + 다시 보내기 → 누르면 저장 · 표시 사라짐', async () => {
    const r = rig({ failTurns: 3 });
    await seed(r);
    const tree = await show(r.deps);
    await toPart2(tree, false);
    await say(tree, '첫 번째 답이에요.');
    await say(tree, '두 번째 답이에요.');
    expect(allTexts(tree)).toContain(CHAT_V6['CHAT.TALK.unsent']);
    const btn = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('chat-resend-'))[0];
    await tap(tree, String(btn.props.testID));
    expect(allTexts(tree)).not.toContain(CHAT_V6['CHAT.TALK.unsent']);
    expect(r.memory.users.get('u1')?.sessions[0].turns.filter((x) => x.role === 'user').map((x) => x.text)).toEqual(['첫 번째 답이에요.']);
    expect(has(tree, 'chat-composer-input')).toBe(true);
  });

  test('스위치가 꺼지면(off) 2부 없이 글 문항을 1부 말로 묻는다', async () => {
    const r = rig({ email: 'v6off@email.com' });
    await seed(r);
    const tree = await show(r.deps);
    await tap(tree, 'chat-resume-go');
    await wait(60);
    expect(has(tree, 'chat-ck16')).toBe(false);
    expect(currentCard(tree)).toBe('T01');
  });
});

describe('7. 내 성향 고치기 → user_edited', () => {
  test('[고치기] → 요약 · 자기소개 고침 → [저장할게요] → 고친 값이 따로 남고 화면은 고친 글', async () => {
    const r = rig();
    await seed(r);
    const tree = await show(r.deps);
    await toPart2(tree, false);
    await say(tree, '조용한 편이에요.');
    await tap(tree, 'chat-header-right');
    await wait(80);
    await tap(tree, 'chat-traits-edit');
    await typeInto(tree, 'chat-traits-summary-input', '조용하지만 약속은 꼭 지키는 편이에요.');
    await tap(tree, 'chat-traits-original');
    expect(has(tree, 'chat-traits-original-text')).toBe(true);
    await tap(tree, 'chat-traits-save');
    await wait(40);
    expect(chatUser(r.memory)?.edited).toMatchObject({ summary: '조용하지만 약속은 꼭 지키는 편이에요.', facts: { T01: DEMO_ANALYSIS.facts.T01 } });
    expect(allTexts(tree)).toContain('조용하지만 약속은 꼭 지키는 편이에요.');
  });
});
