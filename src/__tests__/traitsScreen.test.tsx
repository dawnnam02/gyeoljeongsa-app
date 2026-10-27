// 07 내 성향 화면(F3 통과 조건 3 · 4 · 5 · 6): 스키마 값 그대로 표시 · 태그 삭제 · 추가(최대 5) · 요약 수정 · 축 조정 · 저장은 user_edited 만 ·
// 이대로 확정 · 직접 입력 모드 · 근거 접기/펼치기 · 등급 · 점수 0
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { BackHandler } from 'react-native';

import { COMMON, TRAITS } from '@/content/copy';
import { AXIS_NAMES, AXIS_ORDER, EVIDENCE_LABELS } from '@/content/traitsContent';
import { manualOfferStore } from '@/features/ai/manualOffer';
import { snapTrait } from '@/features/ai/traitsLogic';
import { TraitsScreen, type TraitsDeps } from '@/features/ai/TraitsScreen';
import type { LoadLatest, RunOutcome } from '@/lib/aiApi';
import { DEMO_AI_RESULT } from '@/lib/demoAiSample';
import type { AiRow } from '@/types/ai';

import { allTexts, has, hasText, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Stack: { Screen: () => null },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/store', () => ({ useSignupStore: { getState: () => ({ setStage: jest.fn() }) } }));
jest.mock('@/lib/services', () => ({ likesApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

jest.setTimeout(30_000);

const ORIGINAL = {
  traits: { ...DEMO_AI_RESULT.traits },
  tags: [...DEMO_AI_RESULT.tags],
  summary: DEMO_AI_RESULT.summary,
  evidence: JSON.parse(JSON.stringify(DEMO_AI_RESULT.evidence)),
};
const okRow = (over: Partial<AiRow> = {}): AiRow => ({ id: 'r1', status: 'ok', source: 'ai', retryCount: 0, createdAt: null, confirmedAt: null, original: ORIGINAL, edited: null, ...over });

function setup(first: LoadLatest) {
  const loadLatest = jest.fn<Promise<LoadLatest>, []>(async () => first);
  const saveEdited = jest.fn<ReturnType<TraitsDeps['api']['saveEdited']>, Parameters<TraitsDeps['api']['saveEdited']>>(async () => ({ ok: true }));
  const confirm = jest.fn<ReturnType<TraitsDeps['api']['confirm']>, [string]>(async () => ({ ok: true }));
  const manual = jest.fn<Promise<RunOutcome>, Parameters<TraitsDeps['api']['manual']>>(async () => ({ kind: 'ok', resultId: 'r1' }));
  const setStage = jest.fn();
  const deps: TraitsDeps = { api: { loadLatest, saveEdited, confirm, manual }, setStage };
  return { deps, loadLatest, saveEdited, confirm, manual, setStage };
}

const show = (s: ReturnType<typeof setup>) => mount(<TraitsScreen deps={s.deps} />);
type Tree = Awaited<ReturnType<typeof mount>>;
// testID 가 컴포넌트와 그 안의 View 둘에 붙어 있을 때 실제 View(접근성 속성이 붙은 쪽)를 찾는다
const host = (tree: Tree, id: string) => {
  const node = tree.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
  if (!node) throw new Error(`testID "${id}" View 가 없어요`);
  return node;
};
const action = async (tree: Tree, id: string, name: 'increment' | 'decrement') => {
  await act(async () => {
    host(tree, id).props.onAccessibilityAction({ nativeEvent: { actionName: name } });
  });
};

let backHandlers: (() => boolean | null | undefined)[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  manualOfferStore.clear();
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
    backHandlers.push(h as () => boolean);
    return { remove: () => undefined };
  });
});
afterEach(() => jest.restoreAllMocks());

// QP-09: 막대 옆 숫자 글자는 화면에 그리지 않는다 — 값은 스크린리더 값(accessibilityValue.now)으로 읽는다
const valueOf = (tree: ReactTestRenderer, id: string): string | null => {
  const node = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith(id) && n.props.accessibilityValue?.now !== undefined)[0];
  return node ? String(node.props.accessibilityValue.now) : null;
};

describe('보기 상태 (조건 3: 스키마 값 그대로)', () => {
  test('제목 · 부제 · 막대 아래 안내 · 칩 소제목 · 요약 제목 · 버튼이 카피.md 07 그대로다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    for (const t of [TRAITS.headerTitle, TRAITS.title, TRAITS.subtitle, TRAITS.axisNote, TRAITS.tagsTitle, TRAITS.summaryTitle, TRAITS.edit, TRAITS.confirm]) {
      expect(hasText(tree, t)).toBe(true);
    }
    expect(has(tree, 'screen-07')).toBe(true);
  });

  test('막대 5개의 이름과 숫자가 AI 결과(traits) 그대로다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    for (const key of AXIS_ORDER) {
      expect(hasText(tree, AXIS_NAMES[key])).toBe(true);
      expect(valueOf(tree, `trait-bar-${key}`)).toBe(String(ORIGINAL.traits[key]));
      expect(host(tree, `trait-bar-${key}`).props.accessibilityValue).toEqual({ min: 0, max: 100, now: ORIGINAL.traits[key] });
    }
  });

  test('태그 5개가 #을 붙여 그대로 보이고 요약 세 문장이 그대로 보인다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    for (const tag of ORIGINAL.tags) expect(hasText(tree, `#${tag}`)).toBe(true);
    expect(ORIGINAL.tags.length).toBeLessThanOrEqual(5);
    expect(textOf(tree, 'traits-summary')).toBe(ORIGINAL.summary);
  });

  test('수정본(user_edited)이 있으면 수정본을 보인다', async () => {
    const edited = { traits: { ...ORIGINAL.traits, extraversion: 45 }, tags: ['차분함'], summary: '고친 요약이에요. 계획을 세우고 지키는 편이에요. 가족과 보내는 시간이 중요해요.' };
    const tree = await show(setup({ ok: true, row: okRow({ edited }) }));
    expect(valueOf(tree, 'trait-bar-extraversion')).toBe('45');
    expect(hasText(tree, '#차분함')).toBe(true);
    expect(hasText(tree, '#가족 중심')).toBe(false);
  });

  test('조건 6: 화면의 모든 글에 등급 · 점수 · 순위 말이 없다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    for (const text of allTexts(tree)) expect(text).not.toMatch(/등급|점수|순위/);
  });

  test('결과가 없거나 끝나지 않았으면 06 으로 되돌린다', async () => {
    await show(setup({ ok: true, row: null }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/analysis');
    mockRouter.replace.mockClear();
    await show(setup({ ok: true, row: okRow({ status: 'pending' }) }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/analysis');
  });

  test('읽기 실패: 안내 문구 + [다시 시도]', async () => {
    const s = setup({ ok: false, reason: 'network' });
    const tree = await show(s);
    expect(hasText(tree, COMMON.offline)).toBe(true);
    s.loadLatest.mockResolvedValue({ ok: true, row: okRow() });
    await press(tree, 'traits-retry');
    expect(has(tree, 'screen-07')).toBe(true);
  });
});

describe('근거 문항 접기 · 펼치기 (조건 5)', () => {
  test('처음에는 접혀 있고, 누르면 5축마다 근거 문항의 질문 글이 보이며, 다시 누르면 접힌다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    expect(has(tree, 'evidence-list')).toBe(false);
    expect(hasText(tree, TRAITS.evidenceShow)).toBe(true);
    await press(tree, 'evidence-toggle');
    expect(has(tree, 'evidence-list')).toBe(true);
    expect(hasText(tree, TRAITS.evidenceHide)).toBe(true);
    for (const id of ORIGINAL.evidence.extraversion as string[]) expect(hasText(tree, `· ${EVIDENCE_LABELS[id]}`)).toBe(true);
    for (const key of AXIS_ORDER) expect(allTexts(tree).filter((t) => t === AXIS_NAMES[key]).length).toBeGreaterThanOrEqual(2); // 막대 이름 + 근거 제목
    await press(tree, 'evidence-toggle');
    expect(has(tree, 'evidence-list')).toBe(false);
  });

  test('근거에는 질문 글만 보이고 설문 답은 보이지 않는다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    await press(tree, 'evidence-toggle');
    for (const t of allTexts(tree)) expect(t).not.toMatch(/\bE\d\d\b|\bT0\d\b/); // 문항 번호도 노출하지 않는다
  });
});

describe('수정 상태 (조건 4)', () => {
  const edit = async (s = setup({ ok: true, row: okRow() })) => {
    const tree = await show(s);
    await press(tree, 'traits-edit');
    return { s, tree };
  };

  test('[수정하기]를 누르면 막대가 끌 수 있는 막대로 바뀌고 버튼이 [취소] [저장]이 된다', async () => {
    const { tree } = await edit();
    expect(has(tree, 'screen-07-edit')).toBe(true);
    for (const key of AXIS_ORDER) expect(host(tree, `trait-slider-${key}`).props.accessibilityRole).toBe('adjustable');
    expect(hasText(tree, TRAITS.cancel)).toBe(true);
    expect(hasText(tree, TRAITS.save)).toBe(true);
    expect(hasText(tree, TRAITS.edit)).toBe(false);
  });

  test('막대는 0~100 안에서 5씩 움직인다', async () => {
    const { tree } = await edit();
    const key = 'planning';
    const start = ORIGINAL.traits[key];
    await action(tree, `trait-slider-${key}`, 'increment');
    expect(valueOf(tree, `trait-slider-${key}`)).toBe(String(snapTrait(start + 5))); // 5단위로 맞춰진다(74 → 80)
    await action(tree, `trait-slider-${key}`, 'decrement');
    await action(tree, `trait-slider-${key}`, 'decrement');
    expect(valueOf(tree, `trait-slider-${key}`)).toBe(String(snapTrait(snapTrait(start + 5) - 10)));
    for (let i = 0; i < 25; i += 1) await action(tree, `trait-slider-${key}`, 'increment');
    expect(valueOf(tree, `trait-slider-${key}`)).toBe('100');
  });

  test('태그를 ×로 지우면 줄고, 더하면 느는데 5개를 넘길 수 없다', async () => {
    const { tree } = await edit();
    await press(tree, `tag-remove-${ORIGINAL.tags[0]}`);
    expect(textOf(tree, 'traits-tag-count')).toBe(TRAITS.tagCount(4, 5));
    expect(has(tree, `tag-remove-${ORIGINAL.tags[0]}`)).toBe(false);
    await press(tree, 'tag-add');
    await typeInto(tree, 'tag-input', '유머러스');
    await press(tree, 'tag-add-done');
    expect(has(tree, 'tag-remove-유머러스')).toBe(true);
    expect(textOf(tree, 'traits-tag-count')).toBe(TRAITS.tagCount(5, 5));
    expect(has(tree, 'tag-add')).toBe(false); // 5개가 차면 더하기가 사라진다
    expect(has(tree, 'tag-input')).toBe(false);
  });

  test('N14 입력 오류: 글자 수 · 중복 · 전화번호와 링크', async () => {
    const { tree } = await edit();
    await press(tree, `tag-remove-${ORIGINAL.tags[0]}`);
    await press(tree, 'tag-add');
    await typeInto(tree, 'tag-input', '가');
    await press(tree, 'tag-add-done');
    expect(hasText(tree, TRAITS.errors.tagLength)).toBe(true);
    await typeInto(tree, 'tag-input', ORIGINAL.tags[1]);
    await press(tree, 'tag-add-done');
    expect(hasText(tree, TRAITS.errors.tagDuplicate)).toBe(true);
    await typeInto(tree, 'tag-input', '01012345678');
    await press(tree, 'tag-add-done');
    expect(hasText(tree, TRAITS.errors.contact)).toBe(true);
    await typeInto(tree, 'tag-input', 'abc.com');
    await press(tree, 'tag-add-done');
    expect(hasText(tree, TRAITS.errors.contact)).toBe(true);
    expect(textOf(tree, 'traits-tag-count')).toBe(TRAITS.tagCount(4, 5)); // 아무것도 더해지지 않았다
  });

  test('요약이 20자보다 짧으면 저장되지 않고 "20자 이상 써 주세요."가 보인다', async () => {
    const { s, tree } = await edit();
    await typeInto(tree, 'summary-input', '너무 짧아요.');
    await press(tree, 'traits-save');
    expect(hasText(tree, TRAITS.errors.summaryShort(20))).toBe(true);
    expect(s.saveEdited).not.toHaveBeenCalled();
    await typeInto(tree, 'summary-input', '연락은 010-1234-5678 로 주세요. 계획을 세우고 지키는 편이에요.');
    await press(tree, 'traits-save');
    expect(hasText(tree, TRAITS.errors.contact)).toBe(true);
    expect(s.saveEdited).not.toHaveBeenCalled();
  });

  test('[저장]: 고친 값을 수정본으로만 저장하고(원본 result 는 보내지 않는다) 보기 상태로 돌아간다. 확정이 아니다', async () => {
    const { s, tree } = await edit();
    await action(tree, 'trait-slider-extraversion', 'increment');
    await press(tree, `tag-remove-${ORIGINAL.tags[2]}`);
    const summary = '계획을 세우고 지키는 편이고, 가족과 보내는 시간을 중요하게 여겨요. 돈은 함께 관리해요.';
    await typeInto(tree, 'summary-input', summary);
    await press(tree, 'traits-save');
    expect(s.saveEdited).toHaveBeenCalledTimes(1);
    const [id, saved] = s.saveEdited.mock.calls[0];
    expect(id).toBe('r1');
    expect(saved).toEqual({ traits: { ...ORIGINAL.traits, extraversion: snapTrait(ORIGINAL.traits.extraversion + 5) }, tags: ORIGINAL.tags.filter((t) => t !== ORIGINAL.tags[2]), summary });
    expect(Object.keys(saved).sort()).toEqual(['summary', 'tags', 'traits']); // evidence · 원본 열은 없다
    expect(s.confirm).not.toHaveBeenCalled();
    expect(has(tree, 'screen-07')).toBe(true);
    expect(valueOf(tree, 'trait-bar-extraversion')).toBe(String(snapTrait(ORIGINAL.traits.extraversion + 5)));
    expect(textOf(tree, 'traits-summary')).toBe(summary);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('저장 실패: "저장하지 못했어요. 다시 시도해 주세요." — 고친 내용은 그대로 남는다', async () => {
    const s = setup({ ok: true, row: okRow() });
    s.saveEdited.mockResolvedValue({ ok: false, reason: 'server' });
    const { tree } = await edit(s);
    await action(tree, 'trait-slider-family', 'decrement');
    await press(tree, 'traits-save');
    expect(hasText(tree, TRAITS.saveFailed)).toBe(true);
    expect(has(tree, 'screen-07-edit')).toBe(true);
    expect(valueOf(tree, 'trait-slider-family')).toBe(String(snapTrait(ORIGINAL.traits.family - 5)));
  });

  test('[취소]: 고친 내용을 버리고 보기 상태로 돌아간다. 서버에는 아무것도 보내지 않는다', async () => {
    const { s, tree } = await edit();
    await action(tree, 'trait-slider-family', 'increment');
    await press(tree, 'traits-cancel');
    expect(has(tree, 'screen-07')).toBe(true);
    expect(valueOf(tree, 'trait-bar-family')).toBe(String(ORIGINAL.traits.family));
    expect(s.saveEdited).not.toHaveBeenCalled();
  });

  test('수정 상태에서 Android 뒤로가기는 [취소]와 같다', async () => {
    const { tree } = await edit();
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = backHandlers[backHandlers.length - 1]();
    });
    expect(handled).toBe(true);
    expect(has(tree, 'screen-07')).toBe(true);
  });
});

describe('이대로 확정 (조건 4)', () => {
  test('보이는 값(수정본이 있으면 수정본)으로 confirm 을 부르고 08 로 간다', async () => {
    const s = setup({ ok: true, row: okRow() });
    const tree = await show(s);
    await press(tree, 'traits-confirm');
    expect(s.confirm).toHaveBeenCalledWith('r1');
    expect(s.saveEdited).not.toHaveBeenCalled(); // 고치지 않았으면 원본이 최종이다
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/profile', params: { first: '1' } });
  });

  test('저장한 수정본이 있는 채로 확정하면 같은 건을 확정한다', async () => {
    const s = setup({ ok: true, row: okRow() });
    const tree = await show(s);
    await press(tree, 'traits-edit');
    await action(tree, 'trait-slider-economy', 'decrement');
    await press(tree, 'traits-save');
    await press(tree, 'traits-confirm');
    expect(s.saveEdited).toHaveBeenCalledTimes(1);
    expect(s.confirm).toHaveBeenCalledWith('r1');
  });

  // B4: 확정 실패 4종 — 서버 오류 코드마다 확인창이 다르고, 버튼이 가는 곳도 다르다
  test.each([
    ['consent_missing', '/consent'],
    ['survey_incomplete', { pathname: '/survey/[step]', params: { step: '01' } }],
    ['photos_incomplete', '/photos'],
  ] as const)('확정 실패 %s: 확인창(제목 · 본문 · 버튼)을 보이고 [가기]를 누르면 해당 화면으로 간다 · [취소]는 07 에 머문다', async (reason, target) => {
    const s = setup({ ok: true, row: okRow() });
    s.confirm.mockResolvedValue({ ok: false, reason });
    const tree = await show(s);
    await press(tree, 'traits-confirm');
    const text = TRAITS.confirmErrors[reason];
    expect(hasText(tree, text.title)).toBe(true);
    expect(hasText(tree, text.body)).toBe(true);
    expect(hasText(tree, text.go)).toBe(true);
    expect(hasText(tree, text.cancel)).toBe(true);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await press(tree, 'traits-confirm-fail-confirm');
    expect(mockRouter.push).toHaveBeenCalledWith(target);
    expect(has(tree, 'traits-confirm-fail-confirm')).toBe(false);
  });

  test('확정 실패(그 밖): "확정하지 못했어요" 확인창, [다시 시도]는 확정을 다시 부르고 [취소]는 닫는다', async () => {
    const s = setup({ ok: true, row: okRow() });
    s.confirm.mockResolvedValueOnce({ ok: false, reason: 'server' });
    const tree = await show(s);
    await press(tree, 'traits-confirm');
    expect(hasText(tree, TRAITS.confirmErrors.other.title)).toBe(true);
    expect(hasText(tree, TRAITS.saveFailed)).toBe(false); // '저장'이 아니라 '확정'을 말한다
    await press(tree, 'traits-confirm-fail-cancel');
    expect(has(tree, 'traits-confirm-fail-confirm')).toBe(false);
    s.confirm.mockResolvedValueOnce({ ok: false, reason: 'network' });
    await press(tree, 'traits-confirm');
    s.confirm.mockResolvedValueOnce({ ok: true });
    await press(tree, 'traits-confirm-fail-confirm');
    expect(s.confirm).toHaveBeenCalledTimes(3);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/profile', params: { first: '1' } });
  });

  test('확정 실패 ai_not_ready: 문구 없이 06 으로 되돌린다', async () => {
    const s = setup({ ok: true, row: okRow() });
    s.confirm.mockResolvedValue({ ok: false, reason: 'not-ready' });
    const tree = await show(s);
    await press(tree, 'traits-confirm');
    expect(mockRouter.replace).toHaveBeenCalledWith('/analysis');
    expect(has(tree, 'traits-confirm-fail-confirm')).toBe(false);
  });

  test('‹ 는 05 로 간다(보기 상태)', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    await press(tree, 'traits-header-back');
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('직접 입력 상태 (06 [직접 입력하기] → 07, 조건 2)', () => {
  const failedRow = okRow({ status: 'failed', source: 'ai', retryCount: 2, original: null });
  const offer = { initialTraits: { extraversion: 30, planning: 70, family: 80, economy: 60, conflict: 70 }, tagCandidates: ['차분함', '계획적', '꼼꼼함', '즉흥적', '유연함', '독립적'] };

  const manual = async () => {
    mockParams.mode = 'manual';
    manualOfferStore.set('r1', offer);
    const s = setup({ ok: true, row: failedRow });
    const tree = await show(s);
    return { s, tree };
  };

  test('막대 5개는 서버가 준 처음값으로 시작하고 끌 수 있다. 칩은 후보 목록에서 고른다', async () => {
    const { tree } = await manual();
    expect(has(tree, 'screen-07-manual')).toBe(true);
    expect(hasText(tree, TRAITS.manualTitle)).toBe(true);
    for (const key of AXIS_ORDER) expect(valueOf(tree, `trait-slider-${key}`)).toBe(String(offer.initialTraits[key]));
    for (const tag of offer.tagCandidates) expect(has(tree, `tag-pick-${tag}`)).toBe(true);
    expect(has(tree, 'evidence-toggle')).toBe(false); // 직접 입력에는 근거가 없다
  });

  test('서버 재료가 없으면(앱을 다시 열었을 때) 처음값 50과 앱에 둔 후보 목록을 쓴다', async () => {
    mockParams.mode = 'manual';
    const tree = await show(setup({ ok: true, row: failedRow }));
    for (const key of AXIS_ORDER) expect(valueOf(tree, `trait-slider-${key}`)).toBe('50');
    expect(has(tree, 'tag-pick-차분함')).toBe(true);
  });

  test('칩을 고르고 다시 누르면 빠지며, 5개를 넘게 고를 수 없다', async () => {
    const { tree } = await manual();
    for (const tag of offer.tagCandidates) await press(tree, `tag-pick-${tag}`);
    expect(textOf(tree, 'traits-tag-count') ?? allTexts(tree).find((t) => t.includes('5 / 5'))).toBeTruthy();
    expect(must(tree, `tag-pick-${offer.tagCandidates[5]}`).props.variant).toBe('inactive'); // 6번째는 골라지지 않았다
    await press(tree, `tag-pick-${offer.tagCandidates[0]}`);
    expect(must(tree, `tag-pick-${offer.tagCandidates[0]}`).props.variant).toBe('inactive');
  });

  test('칩을 하나도 안 골랐으면 확정되지 않는다', async () => {
    const { s, tree } = await manual();
    await press(tree, 'traits-confirm');
    expect(hasText(tree, TRAITS.manualTagMin)).toBe(true);
    expect(s.manual).not.toHaveBeenCalled();
    expect(s.confirm).not.toHaveBeenCalled();
  });

  test('요약을 비워도 확정된다: 수정본을 서버에 저장(source=manual)한 뒤 확정하고 08 로 간다', async () => {
    const { s, tree } = await manual();
    await press(tree, 'tag-pick-차분함');
    await action(tree, 'trait-slider-extraversion', 'increment');
    await press(tree, 'traits-confirm');
    expect(s.manual).toHaveBeenCalledWith('r1', { traits: { ...offer.initialTraits, extraversion: 35 }, tags: ['차분함'], summary: '' });
    expect(s.confirm).toHaveBeenCalledWith('r1');
    expect(s.manual.mock.invocationCallOrder[0]).toBeLessThan(s.confirm.mock.invocationCallOrder[0]);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/profile', params: { first: '1' } });
    expect(manualOfferStore.get()).toBeNull();
  });

  test('직접 입력 저장이 거절되면 확정하지 않고 오류 문구를 보인다', async () => {
    const { s, tree } = await manual();
    s.manual.mockResolvedValue({ kind: 'error', reason: 'server' });
    await press(tree, 'tag-pick-차분함');
    await press(tree, 'traits-confirm');
    expect(s.confirm).not.toHaveBeenCalled();
    expect(hasText(tree, TRAITS.saveFailed)).toBe(true);
  });

  test('실패한 건이 아니면 06 으로 되돌린다', async () => {
    mockParams.mode = 'manual';
    await show(setup({ ok: true, row: okRow() }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/analysis');
  });
});

describe('접근성', () => {
  test('막대마다 이름과 값을 읽어 준다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    for (const key of AXIS_ORDER) expect(host(tree, `trait-bar-${key}`).props.accessibilityLabel).toBe(TRAITS.sliderValue(AXIS_NAMES[key], ORIGINAL.traits[key]));
  });

  test('수정 상태의 막대는 올리기 · 내리기 동작과 사용법 안내를 갖는다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    await press(tree, 'traits-edit');
    const slider = host(tree, 'trait-slider-conflict');
    expect(slider.props.accessibilityActions).toEqual([{ name: 'increment' }, { name: 'decrement' }]);
    expect(slider.props.accessibilityHint).toBe(TRAITS.sliderHint);
    expect(slider.props.accessibilityLabel).toBe(AXIS_NAMES.conflict);
  });

  test('칩 지우기 버튼은 "○○ 지우기" 라벨을 갖는다', async () => {
    const tree = await show(setup({ ok: true, row: okRow() }));
    await press(tree, 'traits-edit');
    const chip = must(tree, `tag-remove-${ORIGINAL.tags[0]}`);
    expect(chip.props.accessibilityLabel).toBe(TRAITS.removeTag(ORIGINAL.tags[0]));
  });
});
