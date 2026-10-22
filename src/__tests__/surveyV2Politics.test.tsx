// W8 정치성향 문항: 끌기 막대(0~100 · 가운데 · 키보드 · 스크린리더) · 5칸 변환(서버와 같은 식) · CK15 별도 동의 없으면 저장 거부 ·
//  설문 v2 흐름 안 단계(동의 → 막대 → [다음] → 저장) · 검토 줄(답했는지만) · 화면에 숫자 · 칸 0. 데모 모의 서버(0029 이름) 위에서 돈다.
import { act } from 'react-test-renderer';
import { BackHandler } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createDemoV2Memory, createSurveyV2DemoClient, type DemoV2Memory } from '@/demo/surveyV2Backend';
import { createSurveyV2Api } from '@/features/surveyV2/api';
import type { SurveyV2Deps } from '@/features/surveyV2/deps';
import { createLocalDraftStore } from '@/features/surveyV2/localDraft';
import { bandOf, bandsMatch, createPoliticsApi } from '@/features/surveyV2/politics';
import { POL } from '@/features/surveyV2/politicsCopy';
import { PoliticsSlider, keyStep, politicsWords } from '@/features/surveyV2/PoliticsSlider';
import { SurveyV2Screen } from '@/features/surveyV2/SurveyV2Screen';
import type { V2Value } from '@/features/surveyV2/types';
import { chunkedStorage } from '@/lib/chunkedStorage';

import { createMemoryStore } from './memoryStore';
import { allTexts, has, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: () => undefined }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/lib/services', () => ({ supabase: {} }));
jest.mock('@/lib/log', () => ({ safeLog: jest.fn() }));

jest.setTimeout(120_000);

type Tree = Awaited<ReturnType<typeof mount>>;
const base = (id: string, email: string) => ({ auth: { getSession: async () => ({ data: { session: { user: { id, email } } }, error: null }) } }) as unknown as Pick<SupabaseClient, 'auth'>;
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const tap = async (tree: Tree, id: string) => {
  await press(tree, id);
  await wait(10);
};
const NO_NUMBER = /\d/; // 막대 · 동의 · 검토 글에 숫자가 없다(날짜 · 판 번호도 이 단계에는 없다)

function rig(memory: DemoV2Memory = createDemoV2Memory(), email = 'w8@email.com') {
  const client = createSurveyV2DemoClient(base('u1', email), { memory });
  const api = createSurveyV2Api(client, { demo: true, proofUpload: true, schoolSearch: 'server' });
  const politics = createPoliticsApi(client);
  const deps: SurveyV2Deps = { api, local: createLocalDraftStore(chunkedStorage(createMemoryStore().store)), now: () => 1, politics };
  return { memory, client, api, politics, deps };
}

const FULL: Record<string, V2Value> = {
  A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165, A06: 'none', A07: 'never', A08: 'none', A11: 'na',
  B01: 'univ', B02: { school_key: 'K0138' }, B06: 'grad', B07: 'no', B04: 'none',
  C01: 'large', C02: '한빛전자', C03: 'staff', C04: 'regular', C05: 'inc05', C06: 'ast04',
  D08: 'unknown', D09: 'no_college', D04: 'pas02', D05: '1', D06: 'first',
  E14: 3, E15: 3, A09: 'no', A10: 'rare', E12: 'morning', E11: ['travel'],
  E10: 'talk_now', E13: ['family', 'work', 'money', 'leisure', 'health'], E16: 3, E08: 3, E09: 3,
  E01: 'y1', E02: 'yes', E03: 3, E04: 3, E05: 3, E06: 'seoul', E07: 'joint',
  F01: 'any', F02: 'any', F03: 'univ', F04: ['any'], F05: 'any', F06: ['any'], F07: ['any'], F08: ['any'], F09: ['any'], F10: ['any'], F14: 'any', F15: 'any', F16: 'any', F11: 3, F13: ['F03'],
};
const TEXTS = { T01: '조용한 주말을 좋아하고 산책을 자주 하는 편이에요.', T02: '평일 저녁에는 같이 밥을 먹고 주말에는 함께 걷고 싶어요.', T03: '서로 존중하는 마음이에요.' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }));
});
afterEach(() => jest.restoreAllMocks());

describe('5칸 변환 · 매칭 규칙(0029 politics_band · politics_compatible 와 같은 식)', () => {
  test('경계는 오른쪽 칸: 0–19 · 20–39 · 40–59 · 60–79 · 80–100', () => {
    expect([0, 19, 20, 39, 40, 50, 59, 60, 79, 80, 100].map(bandOf)).toEqual([1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5]);
    expect([-5, 140, 19.6].map(bandOf)).toEqual([1, 5, 2]); // 범위 밖은 끝으로 · 반올림
  });
  test('같은 칸 또는 바로 옆 칸만 맞음(가운데는 양옆까지)', () => {
    expect(bandsMatch(50, 30)).toBe(true);
    expect(bandsMatch(50, 70)).toBe(true);
    expect(bandsMatch(50, 10)).toBe(false);
    expect(bandsMatch(0, 39)).toBe(true);
    expect(bandsMatch(0, 40)).toBe(false);
    expect(bandsMatch(100, 60)).toBe(true);
  });
});

describe('끌기 막대 부품', () => {
  test('키보드: 값이 없으면 첫 화살표는 가운데 · ← → 조금 · PageUp/Down 크게 · Home/End 끝 · 모르는 키는 무시', () => {
    expect(keyStep('ArrowRight', null)).toBe(50);
    expect(keyStep('ArrowLeft', null)).toBe(50);
    expect(keyStep('ArrowRight', 50)).toBe(55);
    expect(keyStep('ArrowDown', 50)).toBe(45);
    expect(keyStep('PageUp', 90)).toBe(100);
    expect(keyStep('PageDown', 10)).toBe(0);
    expect(keyStep('Home', 70)).toBe(0);
    expect(keyStep('End', null)).toBe(100);
    expect(keyStep('a', 50)).toBeNull();
  });

  test('스크린리더: 조절 역할 · 값은 말(진보 쪽 · 가운데 …) · 올리기/내리기 동작으로 움직인다', async () => {
    const onChange = jest.fn();
    const tree = await mount(<PoliticsSlider value={50} onChange={onChange} />);
    const track = must(tree, 'pol-slider-track');
    expect(track.props.accessibilityRole).toBe('adjustable');
    expect(track.props.accessibilityLabel).toBe(POL.sliderLabel);
    expect(track.props.accessibilityValue.text).toBe('가운데');
    expect(track.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['increment', 'decrement']);
    await act(async () => track.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(onChange).toHaveBeenLastCalledWith(55);
    await act(async () => track.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(onChange).toHaveBeenLastCalledWith(45);
    expect([0, 25, 50, 70, 100].map(politicsWords)).toEqual(['진보 쪽', '조금 진보 쪽', '가운데', '조금 보수 쪽', '보수 쪽']);
    expect(politicsWords(null)).toBe(POL.unset);
  });

  test('끌기: 누른 자리로 놓이고 끄는 만큼 따라온다 · 화면 글에 숫자 · 눈금 없음', async () => {
    const onChange = jest.fn();
    const tree = await mount(<PoliticsSlider value={null} onChange={onChange} />);
    const track = must(tree, 'pol-slider-track');
    await act(async () => track.props.onLayout({ nativeEvent: { layout: { width: 200, height: 48, x: 0, y: 0 } } }));
    const t = must(tree, 'pol-slider-track');
    expect(t.props.onStartShouldSetResponder()).toBe(true);
    await act(async () => t.props.onResponderGrant({ nativeEvent: { locationX: 100, pageX: 300 } }));
    expect(onChange).toHaveBeenLastCalledWith(50); // 가운데
    await act(async () => t.props.onResponderMove({ nativeEvent: { locationX: 0, pageX: 340 } }));
    expect(onChange).toHaveBeenLastCalledWith(70);
    await act(async () => t.props.onResponderMove({ nativeEvent: { locationX: 0, pageX: 900 } }));
    expect(onChange).toHaveBeenLastCalledWith(100); // 끝을 넘지 않는다
    expect(has(tree, 'pol-slider-thumb')).toBe(false); // 값이 없으면 손잡이 없이 '아직 정하지 않았어요'
    expect(textOf(tree, 'pol-slider-unset')).toBe(POL.unset);
    expect(allTexts(tree).join(' ')).not.toMatch(NO_NUMBER);
  });

  test('막힘(동의 전): 누르기 · 동작 · 키 모두 값을 바꾸지 않는다', async () => {
    const onChange = jest.fn();
    const tree = await mount(<PoliticsSlider value={50} onChange={onChange} disabled />);
    const t = must(tree, 'pol-slider-track');
    expect(t.props.onStartShouldSetResponder()).toBe(false);
    await act(async () => t.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(onChange).not.toHaveBeenCalled();
    expect(t.props.accessibilityState.disabled).toBe(true);
  });
});

describe('서버 몫(데모 모의 서버 = 0029 이름 · 모양)', () => {
  test('CK15 없으면 저장 거부(consent_required) → 동의 기록 → 저장 · 읽기(칸 번호 없음) → 철회하면 답이 지워진다', async () => {
    const { politics, memory, client } = rig();
    expect(await politics.save(63)).toEqual({ ok: false, reason: 'consent' });
    expect(memory.users.get('u1')?.politics).toBeNull();
    expect((await politics.agree()).ok).toBe(true);
    expect(await politics.save(63.4)).toEqual({ ok: true, data: 63 });
    const loaded = await politics.load();
    expect(loaded).toEqual({ ok: true, data: { consent: true, answered: true, position: 63 } });
    expect(Object.keys(loaded.ok ? loaded.data : {})).not.toContain('band');
    await client.rpc('revoke_consent', { p_item: 'CK15' });
    expect(await politics.load()).toEqual({ ok: true, data: { consent: false, answered: false, position: null } });
  });

  test('0~100 정수 밖은 서버가 거부하고, 앱은 늘 0~100 정수로 보낸다 · 인터넷 문제는 network', async () => {
    const { politics, client } = rig();
    await politics.agree();
    const raw = await client.rpc('set_politics', { p_position: 101 });
    expect(raw.error?.message).toBe('invalid_value');
    expect(await politics.save(140)).toEqual({ ok: true, data: 100 });
    const off = rig(createDemoV2Memory(), 'v2savefail@email.com');
    await off.politics.agree();
    expect(await off.politics.save(50)).toEqual({ ok: false, reason: 'network' });
  });

  test('정치 값은 설문 답(survey_answers)에 들어가지 않는다', async () => {
    const { politics, memory, api } = rig();
    await politics.agree();
    await politics.save(20);
    await api.save({ answers: FULL, texts: TEXTS });
    const answers = memory.users.get('u1')?.answers ?? {};
    expect(Object.values(answers)).not.toContain(20);
    expect(Object.keys(answers).some((k) => /pol/i.test(k))).toBe(false);
  });
});

describe('설문 v2 흐름 안 정치성향 단계', () => {
  async function reviewTree(memory?: DemoV2Memory) {
    const r = rig(memory);
    await r.api.save({ answers: FULL, texts: TEXTS });
    const tree = await mount(<SurveyV2Screen deps={r.deps} />);
    await wait(40);
    return { tree, ...r };
  }

  test('검토 줄: 아직이면 탑승권 안내 · [고치기] → 동의 안내(CK15) · 막대 흐림 → [다음]은 이유만', async () => {
    const { tree, memory } = await reviewTree();
    expect(has(tree, 'v2-review')).toBe(true);
    expect(textOf(tree, 'v2-review-politics-state')).toBe(POL.reviewTodo);
    await tap(tree, 'v2-review-politics-edit');
    expect(has(tree, 'v2-politics')).toBe(true);
    expect(textOf(tree, 'v2-question')).toBe(POL.question);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([POL.consentTitle, POL.consentBody, POL.consentNote, POL.left, POL.right]));
    expect(must(tree, 'v2-pol-slider-track').props.accessibilityState.disabled).toBe(true);
    await tap(tree, 'v2-next');
    expect(textOf(tree, 'v2-pol-reason')).toBe(POL.needConsent);
    expect(memory.users.get('u1')?.ck15).toBe(false); // 누르기 전 · 막힌 동안 저장 0
    await tap(tree, 'v2-pol-check');
    expect(must(tree, 'v2-pol-slider-track').props.accessibilityState.disabled).toBe(false);
    await tap(tree, 'v2-next');
    expect(textOf(tree, 'v2-pol-reason')).toBe(POL.needValue);
    expect(memory.users.get('u1')?.ck15).toBe(false);
  });

  test('동의 + 막대 → [다음] → CK15 기록 · 저장 → 검토로 돌아와 "답했어요"(위치 · 숫자 없음)', async () => {
    const { tree, memory } = await reviewTree();
    await tap(tree, 'v2-review-politics-edit');
    await tap(tree, 'v2-pol-check');
    const track = must(tree, 'v2-pol-slider-track');
    await act(async () => track.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } })); // 없음 → 가운데
    expect(must(tree, 'v2-pol-slider-track').props.accessibilityValue.text).toBe('가운데');
    await act(async () => must(tree, 'v2-pol-slider-track').props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    await tap(tree, 'v2-next');
    await wait(30);
    expect(memory.users.get('u1')).toMatchObject({ ck15: true, politics: 45 });
    expect(has(tree, 'v2-review')).toBe(true);
    expect(textOf(tree, 'v2-review-politics-state')).toBe(POL.reviewDone);
    expect(textOf(tree, 'v2-review-politics-state')).not.toMatch(NO_NUMBER);
  });

  test('이미 동의 · 답한 분: 체크 칸 대신 "별도 동의를 마쳤어요" · 막대에 저장값 · [나중에 할게요]는 저장 없이 돌아간다', async () => {
    const memory = createDemoV2Memory();
    const pre = rig(memory);
    await pre.politics.agree();
    await pre.politics.save(80);
    const { tree } = await reviewTree(memory);
    expect(textOf(tree, 'v2-review-politics-state')).toBe(POL.reviewDone);
    await tap(tree, 'v2-review-politics-edit');
    expect(textOf(tree, 'v2-pol-consent-done')).toBe(POL.consentDone);
    expect(has(tree, 'v2-pol-check')).toBe(false);
    expect(must(tree, 'v2-pol-slider-track').props.accessibilityValue.text).toBe('보수 쪽');
    await tap(tree, 'v2-pol-later');
    expect(has(tree, 'v2-review')).toBe(true);
    expect(memory.users.get('u1')?.politics).toBe(80);
    expect(memory.users.get('u1')?.calls.set_politics).toBe(1);
  });

  test('뒤로: 결혼 이야기 앞이 정치성향 단계 · 그 앞이 흐름 마지막 문항', async () => {
    const { tree } = await reviewTree();
    await tap(tree, 'v2-review-politics-edit');
    await tap(tree, 'v2-pol-later'); // 검토에서 왔으므로 검토로
    // 검토 → 세부사항 → 결혼 이야기 → 정치성향 → 흐름 마지막
    const back = async () => {
      const header = tree.root.findAll((n) => n.props.testID === 'v2-header' && typeof n.props.onBack === 'function')[0];
      await act(async () => header.props.onBack());
      await wait(10);
    };
    await back();
    await back();
    expect(has(tree, 'v2-story')).toBe(true);
    await back();
    expect(has(tree, 'v2-politics')).toBe(true);
    await back();
    expect(has(tree, 'v2-politics')).toBe(false);
    expect(textOf(tree, 'v2-question')).not.toBe(POL.question);
  });

  test('저장 실패(인터넷): 단계에 머물고 저장 실패 문구', async () => {
    const memory = createDemoV2Memory();
    const r = rig(memory, 'v2savefail@email.com');
    memory.users.set('u1', { answers: { ...FULL }, texts: { ...TEXTS }, prompts: new Map(), visibility: {}, proofs: {}, failedProofs: [], calls: {}, ck15: false, politics: null });
    const tree = await mount(<SurveyV2Screen deps={r.deps} />);
    await wait(40);
    await tap(tree, 'v2-review-politics-edit');
    await tap(tree, 'v2-pol-check');
    await act(async () => must(tree, 'v2-pol-slider-track').props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    await tap(tree, 'v2-next');
    await wait(30);
    expect(has(tree, 'v2-politics')).toBe(true);
    expect(has(tree, 'v2-save-error')).toBe(true);
    expect(memory.users.get('u1')?.politics).toBeNull();
  });
});
