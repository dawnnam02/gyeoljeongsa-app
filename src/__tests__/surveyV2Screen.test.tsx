// F20 조건 1~4: 정식 설문 v2 화면 — 시작 안내 · 한 쪽 한 문항 · 막는 검증 · 자동 넘김 · 저장 뒤 이동 · 뒤로 가기 값 유지 · 임시 저장 ·
//  이어서 하기(서버 + 기기) · 학교 검색 자동완성 · '말하고 싶지 않아요' 안내 · 종교 '그 외' 안내 · 세부사항 증빙 · 검토 · 고치기 · 제출 → 05.
//  화면은 데모 모의 서버(실서버와 같은 API 길)와 메모리 로컬 저장소로 돈다.
import { act } from 'react-test-renderer';
import { AppState, BackHandler } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createDemoV2Memory, createSurveyV2DemoClient, type DemoV2Memory } from '@/demo/surveyV2Backend';
import { createSurveyV2Api } from '@/features/surveyV2/api';
import { SV2 } from '@/features/surveyV2/copy';
import { createLocalDraftStore } from '@/features/surveyV2/localDraft';
import { SurveyV2Screen } from '@/features/surveyV2/SurveyV2Screen';
import type { SurveyV2Deps } from '@/features/surveyV2/deps';
import type { V2Value } from '@/features/surveyV2/types';
import { chunkedStorage } from '@/lib/chunkedStorage';

import { createMemoryStore } from './memoryStore';
import { allTexts, find, has, mount, must, press, textOf, typeInto } from './renderHelpers';

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

function rig(opts: { id?: string; email?: string; memory?: DemoV2Memory; store?: ReturnType<typeof createMemoryStore> } = {}) {
  const memory = opts.memory ?? createDemoV2Memory();
  const store = opts.store ?? createMemoryStore();
  const api = createSurveyV2Api(createSurveyV2DemoClient(base(opts.id ?? 'u1', opts.email ?? 'f20@email.com'), { memory }), { demo: true, proofUpload: true, schoolSearch: 'server' });
  const deps: SurveyV2Deps = { api, local: createLocalDraftStore(chunkedStorage(store.store)), now: () => 1 };
  return { memory, store, deps, api };
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const show = async (deps: SurveyV2Deps) => {
  const tree = await mount(<SurveyV2Screen deps={deps} />);
  await wait(30);
  return tree;
};
const tap = async (tree: Tree, id: string) => {
  await press(tree, id);
  await wait(10);
};
const question = (tree: Tree) => textOf(tree, 'v2-question');
// 같은 testID 가 감싸개(Stepper)와 입력 칸에 함께 있으면 글을 받는 칸을 고른다
const typeField = async (tree: Tree, id: string, value: string) => {
  const node = tree.root.findAll((n) => n.props.testID === id && typeof n.props.onChangeText === 'function')[0];
  if (!node) throw new Error(`입력 칸 ${id} 가 없어요`);
  await act(async () => {
    node.props.onChangeText(value);
  });
};
const answersOf = (m: DemoV2Memory, id = 'u1') => m.users.get(id)?.answers ?? {};

// 여성 · 대학교 · 대기업 기준으로 필수 흐름을 모두 채운 답(검토 화면 시험용)
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

describe('시작 · 한 쪽 한 문항 · 막는 검증 · 자동 넘김', () => {
  test('처음이면 시작 안내 다섯 줄 → [시작하기] → 이름', async () => {
    const { deps } = rig();
    const tree = await show(deps);
    expect(has(tree, 'v2-intro')).toBe(true);
    expect(SV2.intro.points.every((p) => allTexts(tree).includes(p))).toBe(true);
    expect(has(tree, 'v2-progress')).toBe(false);
    await tap(tree, 'v2-start');
    expect(question(tree)).toBe('이름을 알려 주세요');
    expect(textOf(tree, 'v2-step')).toBe('기본 · 1/7'); // 성별을 고르기 전에는 병역이 보이지 않는다(남성이면 8)
    expect(has(tree, 'v2-section-head')).toBe(true);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([SV2.common.vis.private, SV2.common.noAi]));
  });

  test('빈 칸으로 [다음] → 이동하지 않고 이유, 맞게 쓰면 저장한 뒤 다음 문항', async () => {
    const { deps, memory } = rig();
    const tree = await show(deps);
    await tap(tree, 'v2-start');
    expect(must(tree, 'v2-next').props.dimmed).toBe(true);
    await tap(tree, 'v2-next');
    expect(textOf(tree, 'v2-error')).toBe(SV2.error.requiredText);
    expect(question(tree)).toBe('이름을 알려 주세요');
    await typeInto(tree, 'v2-A12-input', '김하나');
    await tap(tree, 'v2-next');
    expect(answersOf(memory)).toEqual({ A12: '김하나' });
    expect(question(tree)).toBe('성별을 알려 주세요');
  });

  test('하나 고르기는 고른 뒤 잠깐 있다가 저장하고 넘어간다 · 여성이면 병역을 건너뛰고 자동 na', async () => {
    const { deps, memory } = rig();
    const tree = await show(deps);
    await tap(tree, 'v2-start');
    await typeInto(tree, 'v2-A12-input', '김하나');
    await tap(tree, 'v2-next');
    await tap(tree, 'v2-A02-opt-female');
    expect(question(tree)).toBe('성별을 알려 주세요');
    await wait(700);
    expect(question(tree)).toBe('지금 어디에 살고 있나요?');
    expect(answersOf(memory)).toMatchObject({ A02: 'female', A11: 'na' });
    await tap(tree, 'v2-A03-sido-sejong'); // 세종: 시·군·구 자동
    await tap(tree, 'v2-next');
    await typeField(tree, 'v2-A05-input', '165');
    await tap(tree, 'v2-next');
    expect(question(tree)).toBe('종교를 골라 주세요');
    expect(allTexts(tree)).toContain(SV2.common.sensitive);
  });
});

describe("'그 외' · '말하고 싶지 않아요' · 뒤로 · 임시 저장 · 이어서 하기", () => {
  async function toReligion(deps: SurveyV2Deps) {
    const tree = await show(deps);
    await tap(tree, 'v2-start');
    await typeInto(tree, 'v2-A12-input', '김하나');
    await tap(tree, 'v2-next');
    await tap(tree, 'v2-A02-opt-female');
    await tap(tree, 'v2-next');
    await tap(tree, 'v2-A03-sido-seoul');
    await tap(tree, 'v2-A03-sigungu-22'); // 강남구
    await tap(tree, 'v2-next');
    await typeField(tree, 'v2-A05-input', '165');
    await tap(tree, 'v2-next');
    return tree;
  }

  test("종교 '그 외'를 고르면 같은 선택끼리 이어진다는 안내(카피 14-2 v5)가 보이고 자동으로 넘어가지 않는다", async () => {
    const { deps } = rig();
    const tree = await toReligion(deps);
    await tap(tree, 'v2-A06-opt-other');
    await wait(700);
    expect(question(tree)).toBe('종교를 골라 주세요');
    expect(textOf(tree, 'v2-other-note')).toBe("'그 외'를 고르면 '그 외'를 고른 분끼리 이어져요.");
    await tap(tree, 'v2-next');
    await tap(tree, 'v2-A07-opt-decline');
    expect(has(tree, 'v2-decline-hint')).toBe(false); // 혼인 · 자녀는 등급에 쓰지 않아 안내 없음
    await wait(700);
    expect(question(tree)).toBe('자녀가 있나요?');
  });

  test("'말하고 싶지 않아요'를 고르면 '답하면 등급이 오를 수 있어요.'(돈 문항) · 값은 null 로 저장", async () => {
    const { deps, memory, api } = rig();
    await api.save({ answers: { A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165, A06: 'none', A07: 'never', A08: 'none', A11: 'na', B01: 'hs', B04: 'none', C01: 'student' } });
    const tree = await show(deps);
    expect(question(tree)).toBe('한 해 소득은 어느 구간인가요?');
    expect(textOf(tree, 'v2-notice')).toBe(SV2.resume);
    await tap(tree, 'v2-C05-opt-decline');
    expect(textOf(tree, 'v2-decline-hint')).toBe('답하면 등급이 오를 수 있어요.');
    await tap(tree, 'v2-next');
    expect(answersOf(memory).C05).toBeNull();
    expect(question(tree)).toBe('모은 자산은 어느 구간인가요?');
  });

  test('‹ · [이전]은 저장 없이 앞 문항으로, 값은 남는다 · [임시 저장]은 머물고 토스트', async () => {
    const { deps } = rig();
    const tree = await toReligion(deps);
    await tap(tree, 'v2-prev');
    expect(question(tree)).toBe('키는 몇 cm인가요?');
    expect(tree.root.findAll((n) => n.props.testID === 'v2-A05-input' && typeof n.props.onChangeText === 'function')[0].props.value).toBe('165');
    await tap(tree, 'v2-header-right');
    expect(must(tree, 'v2-toast').props.text).toBe(SV2.savedToast);
    expect(question(tree)).toBe('키는 몇 cm인가요?');
  });

  test('다시 열면 서버 답 + 기기에 남은 답으로 첫 빈 문항부터(N03)', async () => {
    const first = rig();
    const tree = await toReligion(first.deps);
    await tap(tree, 'v2-A06-opt-none');
    await wait(50); // 자동 넘김 전에 앱을 닫는다 → 서버에는 A05 까지, 기기에는 A06 이 남는다
    await act(async () => {
      tree.unmount();
    });
    await wait(400);
    const again = rig({ memory: first.memory, store: first.store });
    const tree2 = await show(again.deps);
    expect(textOf(tree2, 'v2-notice')).toBe(SV2.resume);
    expect(question(tree2)).toBe('결혼한 적이 있나요?');
  });

  test('저장이 실패하면 머물고 문구(연결 문제)', async () => {
    const { deps } = rig({ id: 'u9', email: 'v2savefail@email.com' });
    const tree = await show(deps);
    await tap(tree, 'v2-start');
    await typeInto(tree, 'v2-A12-input', '김하나');
    await tap(tree, 'v2-next');
    expect(textOf(tree, 'v2-save-error')).toBe(SV2.saveFailed);
    expect(question(tree)).toBe('이름을 알려 주세요');
  });

  test('앱이 백그라운드로 가면 조용히 저장한다', async () => {
    let listener: ((s: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      listener = fn as (s: string) => void;
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    const { deps, memory } = rig();
    const tree = await show(deps);
    await tap(tree, 'v2-start');
    await typeInto(tree, 'v2-A12-input', '김하나');
    await act(async () => {
      listener?.('background');
    });
    await wait(30);
    expect(answersOf(memory)).toEqual({ A12: '김하나' });
  });
});

describe('학교 검색 자동완성', () => {
  test('2자부터 찾고 줄임말 · 옛 이름으로도 찾는다 → 고르면 한 장으로 접히고 [바꾸기] · 목록 밖 보기는 늘 보인다', async () => {
    const { deps, memory, api } = rig();
    await api.save({ answers: { A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165, A06: 'none', A07: 'never', A08: 'none', A11: 'na', B01: 'univ' } });
    const tree = await show(deps);
    expect(question(tree)).toBe('마지막으로 다닌 학교는 어디인가요?');
    expect(has(tree, 'v2-B02-opt-unlisted_kr')).toBe(true);
    await typeInto(tree, 'v2-B02-search', '연');
    await wait(250);
    expect(has(tree, 'v2-B02-results')).toBe(false); // 1자는 찾지 않는다
    await typeInto(tree, 'v2-B02-search', '관동대학교');
    await wait(250);
    expect(textOf(tree, 'v2-B02-hit-0-name')).toBe('가톨릭관동대학교');
    expect(textOf(tree, 'v2-B02-hit-0-sub')).toContain(SV2.search.oldName('관동대학교'));
    await typeInto(tree, 'v2-B02-search', '연대');
    await wait(250);
    expect(textOf(tree, 'v2-B02-hit-0-name')).toBe('연세대학교');
    await tap(tree, 'v2-B02-hit-0');
    expect(textOf(tree, 'v2-B02-picked-name')).toBe('연세대학교');
    await tap(tree, 'v2-next');
    expect(answersOf(memory).B02).toEqual({ school_key: 'K0138' });
    expect(question(tree)).toBe('그 학교는 졸업했나요?');
  });

  test('부모님 학교: 결과가 없으면 안내 + 목록 밖 보기(잘 몰라요 · 말하고 싶지 않아요)', async () => {
    const { deps, memory, api } = rig();
    const pre = Object.fromEntries(Object.entries(FULL).filter(([k]) => /^[ABC]/.test(k)));
    await api.save({ answers: pre });
    const tree = await show(deps);
    expect(question(tree)).toBe('아버지가 마지막으로 다니신 학교는 어디인가요?');
    await typeInto(tree, 'v2-D08-search', 'ㅋㅋㅋㅋ없는학교');
    await wait(250);
    expect(textOf(tree, 'v2-D08-empty')).toBe(SV2.search.empty);
    await tap(tree, 'v2-D08-opt-decline');
    expect(textOf(tree, 'v2-decline-hint')).toBe(SV2.common.declineHint);
    await tap(tree, 'v2-next');
    expect(answersOf(memory).D08).toBeNull();
  });
});

describe('선택 단계 · 검토 · 제출', () => {
  async function full(memory?: DemoV2Memory) {
    const r = rig({ memory });
    await r.api.save({ answers: FULL, texts: TEXTS });
    return r;
  }

  test('필수 흐름을 다 마쳤으면 검토 화면: 주제별 답 · 확인 문구 없음 · [제출하고 사진 올리기] → 05', async () => {
    const { deps, memory } = await full();
    const tree = await show(deps);
    expect(has(tree, 'v2-review')).toBe(true);
    expect(textOf(tree, 'v2-review-answer-A03')).toBe('서울 강남구');
    expect(textOf(tree, 'v2-review-answer-B02')).toBe('연세대학교');
    expect(textOf(tree, 'v2-review-answer-C05')).toBe('5천만~6천만 원');
    expect(has(tree, 'v2-review-warn')).toBe(false);
    await tap(tree, 'v2-submit');
    await wait(30);
    expect(mockRouter.push).toHaveBeenCalledWith('/photos');
    expect(answersOf(memory).A11).toBe('na');
  });

  test('[고치기]: 학력을 대학원으로 바꾸면 새로 생긴 학부 학교를 묻고 검토로 돌아온다', async () => {
    const { deps, memory } = await full();
    const tree = await show(deps);
    await tap(tree, 'v2-review-edit-B01');
    expect(question(tree)).toBe('최종 학력을 알려 주세요');
    await tap(tree, 'v2-B01-opt-master');
    await wait(700);
    expect(question(tree)).toBe('학부(4년제)는 어느 학교를 다녔나요?');
    await tap(tree, 'v2-B05-opt-unlisted_kr');
    await tap(tree, 'v2-next');
    expect(has(tree, 'v2-review')).toBe(true);
    expect(answersOf(memory)).toMatchObject({ B01: 'master', B05: 'unlisted_kr' });
  });

  test('확인 문구 W1(키)는 막지 않고 검토 위에 남는다', async () => {
    const { deps, api } = await full();
    await api.save({ answers: { A05: 139 } });
    const tree = await show(deps);
    expect(textOf(tree, 'v2-warn-W1')).toBe(SV2.warn.W1);
    expect(must(tree, 'v2-submit').props.dimmed).toBe(false);
  });

  test('결혼 이야기: 카드를 펼쳐 쓰면 미리보기, 9자 이하는 막고, 저장은 질문 소개 칸으로', async () => {
    const { deps, memory } = await full();
    const tree = await show(deps);
    await tap(tree, 'v2-review-story-edit');
    expect(has(tree, 'v2-story')).toBe(true);
    await tap(tree, 'v2-Q17-head');
    await typeInto(tree, 'v2-Q17-input', '짧아요');
    await tap(tree, 'v2-next');
    expect(textOf(tree, 'v2-Q17-error')).toBe(SV2.error.minChars(10));
    await typeInto(tree, 'v2-Q17-input', '양가를 번갈아 하루씩 다녀오고 싶어요.');
    expect(has(tree, 'v2-Q17-preview')).toBe(true);
    await tap(tree, 'v2-next');
    expect(has(tree, 'v2-review')).toBe(true);
    expect([...(memory.users.get('u1')?.prompts.values() ?? [])]).toEqual([{ code: 'Q17', answer: '양가를 번갈아 하루씩 다녀오고 싶어요.' }]);
  });

  test('세부사항: 유학이 있으면 T04 를 펼친 채 시작 · 증빙 올리기 → 확인 중 · 연락처 모양은 막지 않고 안내', async () => {
    const { deps, memory, api } = await full();
    await api.save({ answers: { B04: 'degree' } });
    const tree = await show(deps);
    await tap(tree, 'v2-review-appeal-edit');
    expect(has(tree, 'v2-appeal')).toBe(true);
    expect(has(tree, 'v2-T04-input')).toBe(true);
    await typeInto(tree, 'v2-T04-input', '미국에서 2년 동안 대학원 석사를 마쳤어요. 010-1234-5678');
    await wait(600);
    expect(has(tree, 'v2-T04-contact')).toBe(true);
    await tap(tree, 'v2-T04-upload');
    await wait(20);
    expect(textOf(tree, 'v2-T04-proof')).toBe(SV2.appeal.proof.pending);
    await tap(tree, 'v2-next');
    expect(memory.users.get('u1')?.texts.T04).toContain('미국에서 2년');
    expect(has(tree, 'v2-review')).toBe(true);
  });

  test('화면 글에 점수 · 등급 숫자가 없다(검토 · 문항 모두)', async () => {
    const { deps } = await full();
    const tree = await show(deps);
    const texts = allTexts(tree).join('\n');
    expect(texts).not.toMatch(/점수|등급\s*\d|\d\s*등급|tier|순위/);
    expect(find(tree, 'v2-review')).not.toBeNull();
  });
});
