// F13 조건 2: 내 등급(16-G1 · G2 · G3 · G4 · G5). 모의 서버(lib/shopDemo)를 실제 gradeApi 위에서 돌린다.
//  3부-사: 모의 서버 get_my_grade = 0039 v5(모든 회원 풍경 키 하나 · 숫자 · 점수 · 기여 · 구독 잠금 0). 잠금 화면은 옛 서버({locked:true})일 때만 — 그 시험은 loadMine 을 바꿔 끼운다
import fs from 'node:fs';
import path from 'node:path';

import { Image } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { Icon } from '@/components/Icon';
import { COMMON } from '@/content/copy';
import { GRADE16, SHOP16 } from '@/content/shopCopy';
import { areaBars, barRatio, goalChoices, goalTasks, ptsText, reasonText, upTasks } from '@/features/grade/gradeLogic';
import { ShopScreen } from '@/features/shop/ShopScreen';
import type { ShopDeps } from '@/features/shop/shopTypes';
import { GI } from '@/features/grade/iconCopy';
import { takeToast } from '@/lib/toastBus';
import { STATE_ART } from '@/theme/uiAssets';

import { allTexts, has, hasText, isOpen, mount, must, press, textOf } from './renderHelpers';
import { makeShopRig } from './shopRig';

jest.setTimeout(90_000);

const mockRouter = { setParams: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ shopApi: {}, gradeApi: {}, profileApi: { facePhotoUrl: async () => null }, settingsApi: {}, recsApi: {}, likesApi: {}, supabase: {} }));

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of shown.splice(0)) tree.unmount();
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  takeToast();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
});

const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const tap = async (tree: ReactTestRenderer, id: string) => {
  await press(tree, id);
  await flush();
};
// page 값으로 바로 연다(10 · 12 같은 다른 화면에서 들어오는 길)
async function open(scene: string, page = 'grade', over?: (deps: ShopDeps) => Partial<ShopDeps>) {
  mockParams.page = page;
  const rig = await makeShopRig(scene);
  if (over) Object.assign(rig.deps, over(rig.deps));
  const tree = await mount(<ShopScreen deps={rig.deps} />);
  shown.push(tree);
  await flush();
  return { tree, ...rig };
}

describe('규칙 함수', () => {
  test('막대 3줄은 서버가 준 areas 값 그대로(S8d, 앱이 더하지 않는다) · areas 가 없으면 숫자 없이 이름만', () => {
    const bars = areaBars({ cond: 46.2, verify: 3.5, sincere: 4.8 });
    expect(bars.map((b) => b.name)).toEqual(['조건', '인증', '답변 성실도']);
    expect(bars.map((b) => b.pts)).toEqual([46.2, 3.5, 4.8]);
    expect(areaBars(null).every((b) => b.pts === null)).toBe(true);
    expect(barRatio(30, 30)).toBe(1);
    expect(barRatio(1.5, 30)).toBeCloseTo(0.05);
    expect(barRatio(null, 30)).toBe(0);
    expect(barRatio(0.1, 100)).toBe(0.02); // 너무 짧아 안 보이는 일은 없다
  });

  test('점수 글: 1 이상이면 정수, 1 미만이면 소수 한 자리', () => {
    expect([ptsText(41.3), ptsText(2.4), ptsText(0.6), ptsText(1)]).toEqual(['41', '2', '0.6', '1']);
  });

  test('올리는 방법: 서류 인증 3종은 한 줄로 합치고 최대 3줄, 항목이 없으면 줄이 없다', () => {
    const tasks = upTasks([{ item: 'v_sch', pts: 2.1 }, { item: 'v_job', pts: 1.5 }, { item: 'ans', pts: 2.4 }, { item: 'act', pts: 0.6 }]);
    expect(tasks.map((t) => t.text)).toEqual(['서류 인증하기', '프로필 선택 항목 채우기', '앱에 접속하기']);
    expect(tasks[0].upTo).toBeCloseTo(3.6);
    expect(upTasks([{ item: 'mnr', pts: 1 }, { item: 'edu', pts: 5 }])).toEqual([]); // 바꿀 수 없는 조건 · 매너는 할 일로 넣지 않는다
    expect(upTasks([])).toEqual([]);
  });

  test('목표 후보는 지금보다 위(숫자가 작은) 등급 전부, 1등급은 없다 · 체크는 올릴 여지가 없는 일', () => {
    expect(goalChoices(4)).toEqual([3, 2, 1]);
    expect(goalChoices(1)).toEqual([]);
    const tasks = goalTasks([{ item: 'ans', pts: 2.4 }]);
    expect(tasks.map((t) => [t.key, t.done, t.doneText])).toEqual([['verify', true, '인증 완료'], ['ans', false, '입력 완료'], ['act', true, '최근 접속']]);
  });

  test('변화 기록 이유 글: 아는 코드만(모르는 코드는 이유를 붙이지 않는다)', () => {
    expect(['answer_edit', 'verification', 'activity', 'manner', 'age_band', 'cut_refresh', 'recompute'].map(reasonText)).toEqual(['답 수정', '서류 인증', '활동', '매너 반영', '나이대 경계', '계산 기준 갱신', '계산 기준 갱신']);
    expect(reasonText('first')).toBeNull();
    expect(reasonText('weird')).toBeNull();
  });
});

describe('조건 2 · 16-G1 내 등급 (0039 v5 — 모든 회원)', () => {
  test('W9 · D-154: 내 무리(풍경 아이콘 + 이름 + 나만 보여요) + NV71 · NV40 — 단계 숫자 · 방향 문구 · 숫자 그림 없음', async () => {
    const { tree } = await open('shopsub');
    expect(has(tree, 'shop-page-grade')).toBe(true);
    expect(textOf(tree, 'grade-flock-name')).toBe('다리'); // 서버 grade_icon 'bridge' 그대로(iconBridge 를 지나지 않음)
    expect(must(tree, 'grade-flock-mine').props.accessibilityLabel).toBe('내 무리 아이콘, 다리');
    expect(has(tree, 'grade-flock-icon-bridge')).toBe(true);
    expect(textOf(tree, 'grade-flock-note')).toBe(GI.flockNote);
    expect(has(tree, 'grade-direction')).toBe(false);
    expect(textOf(tree, 'grade-reference')).toBe('결혼 조건을 중심으로 본 참고 값이라, 내 인생을 대변하지는 않아요.');
    expect(textOf(tree, 'grade-shown')).toBe('10월 16일 새벽에 반영했어요.');
    expect(fs.existsSync(path.join(__dirname, '..', '..', 'assets', 'icons', 'tier'))).toBe(false); // 숫자 그림 tier-N.png 는 지웠다(D42-C)
    expect(has(tree, 'grade-merged')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/\d\s*등급|숫자가 작을수록|위 등급|\d+점/);
  });

  test('W9 · 0039: 점수 막대 · 총점 문구 · 매너 줄 · 바뀔 수 있는 일(올릴 여지)이 없다 — 서버가 그 키를 보내지 않는다', async () => {
    const { tree } = await open('shopsub');
    expect(has(tree, 'grade-bars')).toBe(false);
    expect(has(tree, 'grade-bar-cond-text')).toBe(false);
    expect(hasText(tree, '내 등급을 받친 항목')).toBe(false);
    expect(has(tree, 'grade-manner')).toBe(false);
    expect(has(tree, 'grade-up')).toBe(false);
    expect(hasText(tree, '올리는 방법')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/총점|원점수|\d+점|퍼센트|%/);
  });

  test('옛 서버가 올릴 여지(actionable)를 주면: 바뀔 수 있는 일 3줄 + [하러 가기] + NV42 — 점수 없음', async () => {
    const { tree } = await open('shopsub', 'grade', (deps) => ({
      grade: { ...deps.grade, loadMine: async () => ({ ok: true as const, data: { kind: 'ready' as const, icon: 'sea' as const, band: '28-32', bandMerged: false, shownAt: null, nextAt: null, areas: null, top: [], mannerOk: true, actionable: [{ item: 'v_sch' as const, pts: 2 }, { item: 'ans' as const, pts: 2 }, { item: 'act' as const, pts: 1 }], verifyOn: false } }) },
    }));
    expect(hasText(tree, GI.tasksTitle)).toBe(true);
    for (const text of ['서류 인증하기', '프로필 선택 항목 채우기', '앱에 접속하기']) expect(hasText(tree, text)).toBe(true);
    expect(allTexts(tree).some((t) => t.startsWith('최대 +'))).toBe(false);
    expect(textOf(tree, 'grade-up-note')).toBe('등급이 바뀔지는 같은 나이대 회원들과 함께 정해져요.');
    expect(textOf(tree, 'grade-manner')).toBe('매너: 신고 없이 잘 지내고 있어요.');
    await tap(tree, 'grade-up-ans-go');
    expect(mockRouter.push).toHaveBeenCalledWith('/profile');
    await tap(tree, 'grade-up-verify-go');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
    await tap(tree, 'grade-up-act-go');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/boarding'); // v5 홈(탑승권 탭) — 옛 09 는 숨김
    expect(allTexts(tree).filter((t) => /학력|연봉|고용|직업군/.test(t) && /하기|하면|채우기/.test(t))).toEqual([]);
  });

  test('서류 인증(GI7): 학교 · 직업 · 자산 인증 + 1차에는 NV43 · 링크 4 · 한계 문구(NV44) 맨 아래', async () => {
    const { tree } = await open('shopsub');
    expect(hasText(tree, '인증으로 올리기')).toBe(false);
    for (const text of [GI.verifyTitle, '학교 인증', '직업 인증', '자산 인증']) expect(hasText(tree, text)).toBe(true);
    expect(textOf(tree, 'grade-verify-soon')).toBe('서류 인증은 준비 중이에요. 시작되면 여기에서 할 수 있어요.');
    expect(has(tree, 'grade-verify-go')).toBe(false);
    for (const [id, label] of [['grade-link-access', '내 등급 알려 주세요'], ['grade-link-history', '등급 변화 기록'], ['grade-link-goal', '목표 정하기'], ['grade-link-how', '등급은 어떻게 정해지나요?'], ['grade-link-review', '설명 · 검토 요청']] as const) {
      expect(must(tree, id).props.label).toBe(label);
    }
    expect(textOf(tree, 'grade-limits')).toBe(GRADE16.limits);
    expect(GRADE16.limits).toContain('등급은 그 사람의 인생을 대변하지 않아요.');
    expect(GRADE16.limits).toContain('등급 계산에는 외모 · 종교 · 출신 지역 · 다른 회원의 반응 · 결제 여부를 쓰지 않고');
    await tap(tree, 'grade-link-review');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
  });

  test('나이대 합침(NV48 — 0039 v5 는 키 없음) · 첫 계산 전(NV46) · 읽기 실패(공통 오류 + 다시 시도)', async () => {
    const band = await open('shopsub-gradeband');
    expect(has(band.tree, 'grade-merged')).toBe(false);
    const first = await open('shopsub-gradenew');
    expect(has(first.tree, 'grade-pending-art')).toBe(true);
    expect(first.tree.root.findAll((n) => n.props.testID === 'grade-pending-art').at(-1)!.findAllByType(Image)[0].props.source).toBe(STATE_ART.noTier);
    expect(textOf(first.tree, 'grade-first')).toBe('첫 등급은 10월 17일 아침에 볼 수 있어요.');
    expect(has(first.tree, 'grade-flock')).toBe(false);
    expect(must(first.tree, 'grade-pending-access').props.label).toBe('내 등급 알려 주세요'); // 계산 전에도 무료 열람 요청 길
    const bad = await open('shopsub-gradefail');
    expect(textOf(bad.tree, 'grade-error-text') ?? '').toBe('');
    expect(has(bad.tree, 'grade-error')).toBe(true);
    expect(hasText(bad.tree, COMMON.server)).toBe(true);
    expect(has(bad.tree, 'grade-retry')).toBe(true);
  });

  test('등급 계산을 멈춘 회원(0039 state paused)의 화면은 NV87 · NV88 · NV89 + [설정으로 가기] · 올리는 방법 · 막대 없음', async () => {
    const rig = await makeShopRig('shopsub');
    await rig.gradeApi.setProcessing(false);
    mockParams.page = 'grade';
    const tree = await mount(<ShopScreen deps={rig.deps} />);
    shown.push(tree);
    await flush();
    expect(textOf(tree, 'grade-stopped-big')).toBe('등급 계산을 멈췄어요');
    expect(textOf(tree, 'grade-stopped')).toBe('내 등급은 지워졌고, 다시 켜기 전까지 탑승권을 살 수 없어요.'); // NV88 v5(카피 14-1, QP-A)
    expect(textOf(tree, 'grade-stopped-how')).toBe("설정에서 '등급 계산 멈추기'를 끄면 다시 계산해요.");
    expect(has(tree, 'grade-stopped-first')).toBe(false); // 0039 멈춤 응답에는 first_ready_at 이 없다(다시 켜기 전까지 계산 0)
    expect(has(tree, 'grade-pending-access')).toBe(true);
    await tap(tree, 'grade-stopped-go');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
    expect(has(tree, 'grade-flock')).toBe(false);
    expect(has(tree, 'grade-bars')).toBe(false);
  });
});

// 옛 서버(0023) 비구독자 응답 { locked:true } — 0039 v5 서버 · 데모는 보내지 않는다
const LOCKED = (deps: ShopDeps): Partial<ShopDeps> => ({ grade: { ...deps.grade, loadMine: async () => ({ ok: true as const, data: { kind: 'locked' as const } }) } });

describe('조건 2 · 16-G1 옛 서버 잠금 · 16-G5 무료 열람 요청', () => {
  test('0039 v5: 구독하지 않은 회원도 잠금이 아니라 내 풍경 하나 + [내 등급 알려 주세요] 링크', async () => {
    const { tree } = await open('plain');
    expect(has(tree, 'grade-locked')).toBe(false);
    expect(textOf(tree, 'grade-flock-name')).toBe('다리');
    expect(must(tree, 'grade-link-access').props.label).toBe('내 등급 알려 주세요');
    expect(allTexts(tree).join(' ')).not.toMatch(/구독|\d등급/);
  });

  test('잠김 그림 · [내 등급 알려 주세요] 첫째 · 링크 — v5(QP-A, 카피 14-1): 구독 잠금 안내(GI5) · [구독 알아보기] 없음 · 등급 값 · 막대 · 흐린 배지 없음', async () => {
    const { tree } = await open('plain', 'grade', LOCKED);
    expect(has(tree, 'grade-locked')).toBe(true);
    expect(has(tree, 'grade-locked-text')).toBe(false);
    expect('locked' in GI).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/구독/);
    const art = tree.root.findAll((n) => n.props.testID === 'grade-locked-art').at(-1)!;
    expect(tree.root.findAllByType(Icon).find((n) => n.props.testID === 'grade-locked-art')?.props).toMatchObject({ name: 'grade_locked', size: 64 });
    expect(art).toBeTruthy();
    expect(must(tree, 'grade-locked-access').props.label).toBe('내 등급 알려 주세요');
    expect(has(tree, 'grade-locked-sub')).toBe(false);
    expect(must(tree, 'grade-locked-how').props.label).toBe('등급은 어떻게 정해지나요?');
    expect(has(tree, 'grade-flock')).toBe(false);
    expect(has(tree, 'grade-bars')).toBe(false);
    expect(tree.root.findAllByType(Icon).some((i) => /^tier/.test(String(i.props.name)) && i.props.name !== 'tier_subscription')).toBe(false); // 번호 배지는 하나도 없다(tier-N.png 는 지웠다)
    expect(allTexts(tree).join(' ')).not.toMatch(/\d등급/);
  });

  test('구독이 끝난 사람의 잠금 화면 맨 위에는 NV65(내 등급은 계속 계산되고…)가 있다', async () => {
    const { tree } = await open('shopend', 'grade', LOCKED);
    expect(textOf(tree, 'grade-ended')).toBe(SHOP16.endedSub);
  });

  test('[내 등급 알려 주세요] → 시트(NV67 · NV68) → [요청하기] → 토스트 NV69 · 다시 요청하면 NV70(같은 요청을 합칠 뿐 막지 않는다)', async () => {
    const { tree, backend, email } = await open('plain');
    await tap(tree, 'grade-link-access');
    expect(isOpen(tree, 'access-sheet')).toBe(true);
    expect(textOf(tree, 'access-title')).toBe('내 등급 알려 주세요');
    expect(textOf(tree, 'access-body')).toBe('내 등급과 계산에 쓰인 항목을 무료로 알려 드려요. 요청한 날부터 10일 안에 답해 드려요.');
    expect(must(tree, 'access-send').props.label).toBe('요청하기');
    expect(must(tree, 'access-cancel').props.label).toBe('취소');
    await tap(tree, 'access-send');
    expect(isOpen(tree, 'access-sheet')).toBe(false);
    expect(hasText(tree, '요청을 받았어요. 10월 26일까지 알려 드릴게요.')).toBe(true);
    expect(backend.peek.shop(email)?.accessRequested).toBe(true);
    await tap(tree, 'grade-link-access');
    await tap(tree, 'access-send');
    expect(hasText(tree, '이미 받은 요청이 있어요. 10월 26일까지 알려 드릴게요.')).toBe(true);
  });

  test('요청 실패는 오류 글만 보이고 시트가 남는다 · 취소하면 요청이 없다', async () => {
    const { tree } = await open('plain', 'grade', (deps) => ({ grade: { ...deps.grade, requestAccess: async () => ({ ok: false as const, reason: 'network' as const }) } }));
    await tap(tree, 'grade-link-access');
    await tap(tree, 'access-send');
    expect(isOpen(tree, 'access-sheet')).toBe(true);
    expect(textOf(tree, 'access-error')).toBe(COMMON.offline);
    await tap(tree, 'access-cancel');
    expect(isOpen(tree, 'access-sheet')).toBe(false);
  });

  test('v5(QP-A): 잠금 화면에서 등급 구독 상세로 가는 줄([구독 알아보기])이 없다', async () => {
    const { tree } = await open('plain');
    expect(has(tree, 'grade-locked-sub')).toBe(false);
    expect(has(tree, 'shop-page-product')).toBe(false);
  });

  test('상점 목록의 "내 등급 알려 주세요"(무료 구역)도 같은 시트를 연다 — 구독 여부로 막지 않는다', async () => {
    delete mockParams.page;
    const rig = await makeShopRig('shopsub');
    const tree = await mount(<ShopScreen deps={rig.deps} />);
    shown.push(tree);
    await flush();
    await tap(tree, 'shop-free-access');
    expect(isOpen(tree, 'access-sheet')).toBe(true);
  });
});

describe('조건 2 · 16-G2 변화 기록 · 16-G3 목표 · 16-G4 해설 (W9 아이콘)', () => {
  test('G2: 날짜 · 이유 줄 + 전/새 아이콘 그림(숫자 없음) · 첫 계산 줄 + 반영 일정(GI8)', async () => {
    const { tree } = await open('shopsub', 'grade-history');
    expect(textOf(tree, 'history-schedule')).toBe(GI.historySchedule);
    expect(textOf(tree, 'history-item-0')).toBe('10월 14일 아이콘이 바뀌었어요 · 서류 인증');
    expect(textOf(tree, 'history-item-1')).toBe('9월 6일 아이콘이 바뀌었어요 · 답 수정');
    expect(textOf(tree, 'history-item-2')).toBe('8월 17일 아이콘이 바뀌었어요 · 매너 반영');
    expect(textOf(tree, 'history-item-3')).toBe('7월 18일 첫 아이콘을 받았어요');
    expect(has(tree, 'history-item-4')).toBe(false);
    expect([has(tree, 'history-from-0'), has(tree, 'history-to-0'), has(tree, 'history-from-3'), has(tree, 'history-to-3')]).toEqual([true, true, false, true]);
    expect(allTexts(tree).join(' ')).not.toMatch(/\d\s*등급|내려갈|올라갈/);
  });

  test('G2: 기록이 없으면 NV52 + 빈 그림', async () => {
    const { tree } = await open('shopsub-gradeempty', 'grade-history');
    expect(hasText(tree, '아직 바뀐 기록이 없어요.')).toBe(true);
    expect(has(tree, 'history-empty-art')).toBe(true);
  });

  test('G3: 목표 단계 고르기(숫자 칩)는 없고, 도움이 되는 일 체크 + NV53', async () => {
    const { tree } = await open('shopsub', 'grade-goal');
    expect(textOf(tree, 'goal-pick')).toBe(GI.goalHead);
    expect(has(tree, 'goal-optional')).toBe(false);
    expect([1, 2, 3, 4].some((n) => has(tree, `goal-choice-${n}`))).toBe(false);
    expect(has(tree, 'goal-tasks')).toBe(true);
    expect(hasText(tree, '서류 인증하기')).toBe(true);
    expect(textOf(tree, 'goal-promise')).toBe('다 해도 목표 등급이 꼭 되는 건 아니에요. 같은 나이대 회원들과 함께 정해져요.');
    expect(allTexts(tree).join(' ')).not.toMatch(/\d\s*등급/);
  });

  test('G4(모든 회원 무료, 비구독자도): GI12 · GI14 · 공통 한 줄 · ① ~ ⑤(③은 GI13) · GI15 — 격자 · 방향 · NV83 · NV84 없음', async () => {
    const { tree } = await open('plain', 'grade-how');
    expect(textOf(tree, 'how-head')).toBe(GI.howHead);
    expect(textOf(tree, 'how-shapes')).toBe(GI.howShapes);
    expect(has(tree, 'how-direction')).toBe(false);
    expect(has(tree, 'how-grid')).toBe(false);
    for (let n = 1; n <= 9; n += 1) expect(has(tree, `how-cell-${n}`)).toBe(false);
    expect(textOf(tree, 'how-common')).toBe('정보와 활동이 쌓이면 등급이 달라질 수 있어요.');
    expect(textOf(tree, 'how-relation')).toBe(GI.payNote);
    expect(has(tree, 'how-top')).toBe(false);
    expect(has(tree, 'how-few')).toBe(false);
    expect(textOf(tree, 'how-part-0')).toContain('설정에서 멈추지 않은 모든 회원의 등급을 계산해요.');
    expect(textOf(tree, 'how-part-2')).toBe(GI.howProcess);
    expect(textOf(tree, 'how-part-4')).toContain('멈추면 내 등급이 지워지고 짝을 고르는 데도 더는 쓰이지 않아서, 다시 켜기 전까지 탑승권을 살 수 없어요.');
    expect(allTexts(tree).join(' ')).not.toMatch(/\d\s*등급|숫자가 작을수록|위 등급|내려갈/);
  });
});
