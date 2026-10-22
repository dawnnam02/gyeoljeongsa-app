// 08 내 프로필(F4 통과 조건 1 · 3 · 4 · 5 · 6): 토글 9개와 처음값 · 구간 표시 · 잠금(N15) · 바뀐 토글만 저장 · 저장 실패/오프라인 ·
// 배지(인증 대기 · 사진 확인 중 · 사진 다시 올리기) · 처음 한 번 확인 · 사진 3칸 · 등급 · 점수 · 진행 단계 표시 0
import { PROFILE, PROFILE_DRAFT, COMMON } from '@/content/copy';
import { ProfileScreen, type ProfileDeps } from '@/features/profile/ProfileScreen';
import { ageOn, availability, diffToggles, initialToggles, maskedName, photoBadges, photoViews, TOGGLE_DEFS } from '@/features/profile/profileLogic';
import type { LoadResult, ProfileData, SaveResult } from '@/lib/profileApi';

import { allTexts, find, has, hasText, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { setParams: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
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
jest.mock('@/lib/services', () => ({ likesApi: {}, profileApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

jest.setTimeout(30_000);

const NOW = Date.UTC(2026, 9, 15, 3, 0, 0);
const baseData = (over: Partial<ProfileData> = {}): ProfileData => ({
  name: '이하나',
  birthDate: '1995-03-12',
  region: '서울 마포구',
  verification: 'pending',
  photos: [
    { slot: 'face', status: 'pending', id: 'p1' },
    { slot: 'full', status: 'pending', id: 'p2' },
    { slot: 'free', status: 'pending', id: 'p3' },
  ],
  visibility: initialToggles(),
  answers: { A06: '무교', A07: '초혼', A08: '없음', B02: '한국대학교', C02: null, C05: '4천만~6천만 원', C06: '1억~3억 원', D03: '대졸', D04: '답하지 않음' },
  ...over,
});

function setup(data: ProfileData = baseData(), first: LoadResult | null = null) {
  const load = jest.fn<Promise<LoadResult>, []>(async () => first ?? { ok: true, data });
  const saveVisibility = jest.fn<Promise<SaveResult>, Parameters<ProfileDeps['api']['saveVisibility']>>(async () => ({ ok: true }));
  const photoUrl = jest.fn<Promise<string | null>, [string]>(async (id) => `https://example.test/${id}.jpg`);
  const ackReview = jest.fn<Promise<void>, []>(async () => undefined);
  const deps: ProfileDeps = { api: { load, saveVisibility, photoUrl, ackReview }, now: () => NOW };
  return { deps, load, saveVisibility, photoUrl, ackReview };
}
const show = (s: ReturnType<typeof setup>) => mount(<ProfileScreen deps={s.deps} />);

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
});

describe('08 내 프로필 규칙 함수', () => {
  test('토글 9개: 처음값 켜짐 7 · 꺼짐 2(출신 학교 · 직장명), 문항 A06 A07 A08 B02 C02 C05 C06 D03 D04', () => {
    expect(TOGGLE_DEFS).toHaveLength(9);
    const initial = initialToggles();
    expect(Object.values(initial).filter(Boolean)).toHaveLength(7);
    expect(Object.entries(initial).filter(([, on]) => !on).map(([k]) => k)).toEqual(['school', 'employer']);
    expect(TOGGLE_DEFS.map((d) => d.question).join(' ')).toBe('A06 A07 A08 B02 C02 C05 C06 D03 D04');
    expect(TOGGLE_DEFS.filter((d) => d.range).map((d) => d.question)).toEqual(['C05', 'C06', 'D03', 'D04']);
  });

  test('값이 없거나 "답하지 않음"이면 잠긴다 · 저장은 바뀐 열만 · 잠긴 토글은 보내지 않는다', () => {
    const answers = { A06: '무교', A07: '답하지 않음', A08: null, B02: '', C02: '회사', C05: '구간', C06: '구간', D03: '구간', D04: '구간' };
    const available = availability(answers);
    expect(Object.entries(available).filter(([, ok]) => !ok).map(([k]) => k)).toEqual(['maritalHistory', 'children', 'school']);
    const saved = initialToggles();
    expect(diffToggles(saved, { ...saved, employer: true, religion: false }, available)).toEqual({ c02_employer: true, a06_religion: false });
    expect(diffToggles(saved, { ...saved, maritalHistory: false }, available)).toEqual({});
  });

  test('이름은 성 1자 + OO · 만 나이 · 사진 칸 상태', () => {
    expect(maskedName('이하나')).toBe('이OO');
    expect(ageOn('1995-03-12', '2026-10-15')).toBe(31);
    expect(ageOn('1995-12-31', '2026-10-15')).toBe(30);
    const views = photoViews([
      { id: 'a', slot: 'face', status: 'approved', submitted_at: '2026-10-01' },
      { id: 'b', slot: 'face', status: 'pending', submitted_at: '2026-10-10' },
      { id: 'c', slot: 'full', status: 'replaced', submitted_at: '2026-10-01' },
    ]);
    expect(views.map((v) => `${v.slot}:${v.status}`)).toEqual(['face:pending', 'full:none', 'free:none']);
    expect(photoBadges(views)).toEqual({ checking: true, retry: false });
  });
});

describe('08 내 프로필 화면', () => {
  test('머리 · 배지 · 공개 범위 제목과 부제 · 토글 9개를 원본 글 그대로 보인다', async () => {
    const s = setup();
    const tree = await show(s);
    expect(has(tree, 'screen-08')).toBe(true);
    expect(textOf(tree, 'profile-head-text')).toBe('이OO · 31 · 서울 마포구'); // R3 · D8 3차 M3: 나이에 '세' 없음, 15 Bold
    expect(find(tree, 'profile-head-text')?.props.variant).toBe('bodyBold');
    expect(find(tree, 'profile-visibility-subtitle')?.props.variant).toBe('body'); // M2: 부제 15 sub
    expect(hasText(tree, PROFILE.badgeVerifyPending)).toBe(true);
    expect(hasText(tree, PROFILE.badgePhotoChecking)).toBe(true);
    expect(hasText(tree, PROFILE.badgePhotoRetry)).toBe(false);
    expect(textOf(tree, 'profile-visibility-title')).toBe('공개 범위');
    expect(textOf(tree, 'profile-visibility-subtitle')).toBe(PROFILE.visibilitySubtitle);
    for (const d of TOGGLE_DEFS) expect(has(tree, `toggle-${d.key}`)).toBe(true);
    expect(hasText(tree, PROFILE_DRAFT.rangeNote)).toBe(true);
    expect(allTexts(tree).filter((t) => t === PROFILE_DRAFT.rangeNote)).toHaveLength(4);
    expect(has(tree, 'profile-first-box')).toBe(false);
  });

  test('토글: 처음값이 켜짐 7 · 꺼짐 2이고, 답하지 않은 항목(직장명 · 부모님 자산)은 꺼짐 · 잠금이며 누르면 N15 를 보인다', async () => {
    const s = setup();
    const tree = await show(s);
    const checked = (key: string) => must(tree, `toggle-${key}`).props.on as boolean;
    expect(TOGGLE_DEFS.filter((d) => checked(d.key)).map((d) => d.key)).toEqual(['religion', 'maritalHistory', 'children', 'income', 'assets', 'parentEducation']);
    expect(must(tree, 'toggle-employer').props.locked).toBe(true);
    expect(must(tree, 'toggle-parentAssets').props.locked).toBe(true);
    await press(tree, 'toggle-parentAssets');
    expect(textOf(tree, 'profile-message')).toBe(PROFILE.toggleLocked);
    expect(checked('parentAssets')).toBe(false);
    await press(tree, 'profile-save');
    expect(s.saveVisibility).not.toHaveBeenCalled();
  });

  test('저장: 바뀐 토글의 열만 보내고 "저장했어요."를 보인다. 안 바꿨으면 저장은 흐리고 눌러도 아무것도 보내지 않는다', async () => {
    const s = setup();
    const tree = await show(s);
    expect(must(tree, 'profile-save').props.dimmed).toBe(true);
    await press(tree, 'toggle-school'); // 꺼짐 → 켜짐
    await press(tree, 'toggle-religion'); // 켜짐 → 꺼짐
    expect(must(tree, 'profile-save').props.dimmed).toBe(false);
    await press(tree, 'profile-save');
    expect(s.saveVisibility).toHaveBeenCalledTimes(1);
    expect(s.saveVisibility).toHaveBeenCalledWith({ b02_school: true, a06_religion: false });
    expect(textOf(tree, 'profile-message')).toBe(PROFILE.saved);
    expect(must(tree, 'profile-save').props.dimmed).toBe(true); // 저장된 값이 새 기준
  });

  test('저장 실패: 서버 오류는 "저장하지 못했어요", 인터넷 문제는 공통 오프라인 문구 · 바꾼 토글은 그대로', async () => {
    const s = setup();
    const tree = await show(s);
    await press(tree, 'toggle-school');
    s.saveVisibility.mockResolvedValueOnce({ ok: false, reason: 'server' });
    await press(tree, 'profile-save');
    expect(textOf(tree, 'profile-message')).toBe(PROFILE.saveFailed);
    expect(must(tree, 'toggle-school').props.on).toBe(true);
    s.saveVisibility.mockResolvedValueOnce({ ok: false, reason: 'network' });
    await press(tree, 'profile-save');
    expect(textOf(tree, 'profile-message')).toBe(COMMON.offline);
  });

  test('불러오기 실패(오프라인 · 서버): 문구와 [다시 시도], 누르면 다시 읽는다', async () => {
    const s = setup(baseData(), { ok: false, reason: 'network' });
    const tree = await show(s);
    expect(has(tree, 'screen-08-loading')).toBe(true);
    expect(hasText(tree, COMMON.offline)).toBe(true);
    s.load.mockResolvedValueOnce({ ok: true, data: baseData() });
    await press(tree, 'profile-retry');
    expect(has(tree, 'screen-08')).toBe(true);
    expect(s.load).toHaveBeenCalledTimes(2);
  });

  test('배지: 사진 반려는 "사진 다시 올리기"로 바뀌고 설명 시트의 [사진 다시 올리기]가 05 다시 올리기 상태로 보낸다', async () => {
    const data = baseData({ photos: [{ slot: 'face', status: 'rejected', id: 'p1' }, { slot: 'full', status: 'approved', id: 'p2' }, { slot: 'free', status: 'approved', id: 'p3' }] });
    const s = setup(data);
    const tree = await show(s);
    expect(hasText(tree, PROFILE.badgePhotoChecking)).toBe(false);
    expect(hasText(tree, PROFILE.badgePhotoRetry)).toBe(true);
    await press(tree, 'badge-photo-retry');
    expect(hasText(tree, PROFILE.badgePhotoRetryNote)).toBe(true);
    await press(tree, 'badge-note-reupload');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/photos', params: { mode: 'reupload' } });
  });

  test('배지를 누르면 설명이 열린다: 인증 대기 · 사진 확인 중', async () => {
    const s = setup();
    const tree = await show(s);
    await press(tree, 'badge-verify');
    expect(hasText(tree, PROFILE.badgeVerifyPendingNote)).toBe(true);
    await press(tree, 'badge-photo-checking');
    expect(hasText(tree, PROFILE.badgePhotoCheckingNote)).toBe(true);
    expect(hasText(tree, PROFILE.badgeVerifyPendingNote)).toBe(false);
  });

  test('사진 3칸: 칸 이름 · 상태 · 서명 URL 로 미리보기, 반려 칸에는 다시 올리기', async () => {
    const data = baseData({ photos: [{ slot: 'face', status: 'rejected', id: 'p1' }, { slot: 'full', status: 'approved', id: 'p2' }, { slot: 'free', status: 'none', id: null }] });
    const s = setup(data);
    const tree = await show(s);
    expect(s.photoUrl).toHaveBeenCalledTimes(2);
    for (const slot of ['face', 'full', 'free']) expect(has(tree, `photo-${slot}`)).toBe(true);
    expect(must(tree, 'photo-face').props.accessibilityLabel).toBe('얼굴 정면, 다시 올려 주세요');
    expect(must(tree, 'photo-free').props.accessibilityLabel).toBe('자유, 아직 없어요');
    await press(tree, 'photo-face-reupload');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/photos', params: { mode: 'reupload' } });
  });

  test('처음 한 번(07 확정 직후): 안내 상자 + [확인했어요]가 저장 자리에 오고, 바뀐 토글을 저장한 뒤 기록하고 09 로 간다', async () => {
    mockParams.first = '1';
    const s = setup();
    const tree = await show(s);
    expect(has(tree, 'screen-08-first')).toBe(true);
    expect(hasText(tree, PROFILE.firstTitle)).toBe(true);
    expect(has(tree, 'profile-save')).toBe(false);
    await press(tree, 'toggle-income');
    await press(tree, 'profile-first-confirm');
    expect(s.saveVisibility).toHaveBeenCalledWith({ c05_income: false });
    expect(s.ackReview).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/recommendations');
    expect(mockRouter.setParams).toHaveBeenCalledWith({ first: undefined });
  });

  test('처음 한 번: 바꾼 것이 없어도 [확인했어요]는 눌리고 저장 없이 기록 후 09 로 간다 · 저장이 실패하면 가지 않는다', async () => {
    mockParams.first = '1';
    const s = setup();
    const tree = await show(s);
    await press(tree, 'profile-first-confirm');
    expect(s.saveVisibility).toHaveBeenCalledWith({});
    expect(mockRouter.replace).toHaveBeenCalledWith('/recommendations');

    mockRouter.replace.mockClear();
    const s2 = setup();
    const tree2 = await show(s2);
    await press(tree2, 'toggle-income');
    s2.saveVisibility.mockResolvedValueOnce({ ok: false, reason: 'server' });
    await press(tree2, 'profile-first-confirm');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(s2.ackReview).not.toHaveBeenCalled();
    expect(textOf(tree2, 'profile-message')).toBe(PROFILE.saveFailed);
  });

  test('F11: 탭 밖 화면 — ‹ 는 들어온 화면으로(쌓인 화면이 있으면 뒤로 · 없으면 09), 원형 프로필 버튼은 없다', async () => {
    const s = setup();
    const tree = await show(s);
    expect(has(tree, 'profile-header-back')).toBe(true);
    expect(has(tree, 'profile-button')).toBe(false);
    await press(tree, 'profile-header-back');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await press(tree, 'profile-header-back');
    expect(mockRouter.replace).toHaveBeenCalledWith('/recommendations');
    mockParams.first = '1';
    mockRouter.replace.mockClear();
    mockRouter.canGoBack.mockReturnValueOnce(false);
    const first = await show(setup());
    await press(first, 'profile-header-back'); // 처음 한 번 확인 상태의 뒤로 = 09 (2-5 T5)
    expect(mockRouter.replace).toHaveBeenCalledWith('/recommendations');
  });

  test('F11: 얼굴 사진이 확인 중이면 큰 사진 칸에 사진, 반려 · 없음이면 기본 프로필 그림(R16)', async () => {
    const pending = await show(setup());
    expect(has(pending, 'profile-face-avatar-default')).toBe(false);
    const rejected = await show(setup(baseData({ photos: [{ slot: 'face', status: 'rejected', id: 'p1' }, { slot: 'full', status: 'none', id: null }, { slot: 'free', status: 'none', id: null }] })));
    expect(has(rejected, 'profile-face-avatar-default')).toBe(true);
    const none = await show(setup(baseData({ photos: [{ slot: 'face', status: 'none', id: null }, { slot: 'full', status: 'none', id: null }, { slot: 'free', status: 'none', id: null }] })));
    expect(has(none, 'profile-face-avatar-default')).toBe(true);
  });

  test('등급 · 점수 · 순위 · 평가 · 진행 단계를 보이지 않는다', async () => {
    const s = setup();
    const tree = await show(s);
    for (const text of allTexts(tree)) expect(text).not.toMatch(/등급|점수|순위|평가|단계|progress/i);
    expect(find(tree, 'profile-grade')).toBeNull();
  });
});
