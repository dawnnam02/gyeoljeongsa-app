// 09 오늘의 추천 · 13 추천 없음 · 10 상대 프로필 · 신고 · 차단 시트(F5 통과 조건 1~7)
//  규칙 함수(남은 시간 · 맞는 점 이름 · 표 "비공개") · 서버 응답 모양(점수 · 등급 · 순위 키 0) · 화면(3장 카드 · 0명 · 오류 · 만료 · 공개/비공개 · 넘김 · 호감 · 신고 · 차단)
import { SCREEN_CAPTURE_BLOCK_DEFAULT } from '@/config/flags';
import { LIKES } from '@/content/likesCopy';
import { CANDIDATE, COMMON, RECS, REPORT_SHEET, SAFETY } from '@/content/copy';
import { CandidateScreen, type CandidateDeps } from '@/features/recs/CandidateScreen';
import { RecommendationsScreen, type RecsDeps } from '@/features/recs/RecommendationsScreen';
import { REPORT_CODES } from '@/features/safety/reportLogic';
import { cardInfoLine, detailInfoLine, emptyKind, firstWaitText, formatRemaining, galleryPhotos, headLine, headLineDetail, REASON_NAMES, reasonNames, subtitleFor, tableRows, whySentence, widenCount, withSubject } from '@/features/recs/recsLogic';
import { createDemoRecs } from '@/lib/demoRecs';
import { parseCandidate, parseToday, type CandidateData, type RecCard, type TodayData } from '@/lib/recsApi';
import { takeToast } from '@/lib/toastBus';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { onHaptic, scene } from '@/motion';

import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';

import { APP_DIR, outsidePath, whenOutside } from './helpers/outsideDocs';
import { allTexts, find, has, hasText, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

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
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, gradeApi: { partnerGrade: async () => null }, profileApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때 시간 초과를 막는다(F2L · F6 통합 10-16)

// 진짜 시계로 ms 만큼 기다린다(F17: 편지가 떠나는 700ms 등)
const wait = (ms: number) => act(async () => void (await new Promise((resolve) => setTimeout(resolve, ms))));

beforeEach(() => {
  jest.clearAllMocks();
  takeToast();
  mockParams.id = 'demo-cand-1';
});

const face = (state: 'approved' | 'pending' | 'none' = 'pending', photoId: string | null = null) => ({ slot: 'face', state, photoId });
const card = (over: Partial<RecCard> = {}): RecCard => ({ id: 'c1', head: '김OO · 32 · 서울 강남', info: '대기업 · 석사 · 기독교 · 초혼', reasons: ['지역', '자녀 계획', '맞벌이'], face: face(), source: 'free', gradeNo: null, liked: false, connected: false, passed: false, ...over });
const NEXT = Date.UTC(2026, 9, 16, 0, 0, 0);
const today = (cards: RecCard[], nextAt = NEXT, over: Partial<TodayData> = {}): TodayData => ({ day: '2026-10-15', ready: true, firstListPending: false, regionHint: false, nextAt, offset: 0, cards, ...over });

describe('규칙 함수', () => {
  test('남은 시간: 1시간 이상 "n시간 m분"(분 0이면 "n시간") · 1시간 미만 "m분" · 1분 미만', () => {
    expect(formatRemaining((14 * 60 + 32) * 60_000)).toBe('14시간 32분');
    expect(formatRemaining(3 * 3_600_000)).toBe('3시간');
    expect(formatRemaining(45 * 60_000 + 59_000)).toBe('45분');
    expect(formatRemaining(59_000)).toBe('1분 미만');
    expect(formatRemaining(-5)).toBe('1분 미만');
    expect(RECS.remaining(formatRemaining(60 * 60_000))).toBe('다음 추천까지 1시간');
  });

  test('맞는 점 이름: 정책 2-4 의 19개만 · 같은 이름 한 번 · 최대 수 · 이/가', () => {
    expect(Object.keys(REASON_NAMES)).toHaveLength(19);
    expect(reasonNames(['F06', 'E02', 'E03', 'F07'], 3)).toEqual(['지역', '자녀 계획', '맞벌이']);
    expect(reasonNames(['E04', 'E08', 'F11', 'F06', 'F06', 7, null], 5)).toEqual(['지역']); // 가사 분담 · E08 이후 · 외모 관련은 쓰지 않는다
    expect(withSubject('지역')).toBe('지역이');
    expect(withSubject('맞벌이')).toBe('맞벌이가');
    expect(whySentence(['지역', '종교', '맞벌이'])).toBe('지역 · 종교 · 맞벌이가 맞아요.');
    expect(whySentence([])).toBe('');
  });

  test('09 부제는 장수에 따라 · 한 줄 정보는 서버가 준 항목만', () => {
    expect(subtitleFor(3)).toBe('조건과 성향을 살펴 고른 세 분이에요.');
    expect(subtitleFor(2)).toBe('조건과 성향을 살펴 고른 두 분이에요.');
    expect(subtitleFor(1)).toBe('조건과 성향을 살펴 고른 한 분이에요.');
    const answers = { A12: '박OO', A01: 30, A03: { sido: '경기', sigungu: '성남시' }, C01: '전문직', B01: '대졸', A07: '초혼', A09: '비흡연', A05: 165 };
    expect(headLine(answers)).toBe('박OO · 30 · 경기 성남시');
    expect(headLineDetail(answers)).toBe('박OO · 30 · 경기 성남시');
    expect(cardInfoLine(answers)).toBe('전문직 · 대졸 · 초혼'); // 종교는 가려서 줄에서 뺀다
    expect(detailInfoLine(answers)).toBe('전문직 · 대졸 · 초혼 · 비흡연 · 165cm');
  });

  test('F16 지역 안내 규칙: 서버 region_hint 가 true 이고 무료 카드가 1~2장일 때만 카드 수를 돌려준다(0장 · 3장 · 힌트 false 는 null)', () => {
    expect(widenCount(true, 1)).toBe(1);
    expect(widenCount(true, 2)).toBe(2);
    expect(widenCount(true, 0)).toBeNull();
    expect(widenCount(true, 3)).toBeNull();
    expect(widenCount(false, 1)).toBeNull();
    expect(widenCount(false, 2)).toBeNull();
    expect(RECS.widenNote(1)).toBe('오늘은 1분만 추천했어요. 지역 조건을 넓히면 추천이 달라질 수 있어요.');
    expect(RECS.widenNote(2)).toBe('오늘은 2분만 추천했어요. 지역 조건을 넓히면 추천이 달라질 수 있어요.');
    expect(RECS.widenOwnNote).toBe('조건은 내가 직접 바꿀 때만 달라져요.');
    expect(RECS.widenButton).toBe('지역 조건 바꾸기');
  });

  test('10 표 3줄은 항상 있고 가렸거나 답하지 않은 값은 "비공개"', () => {
    const rows = tableRows({ C05: '7천만~1억 원', D03: '대졸 (구간)' });
    expect(rows.map((r) => r.label)).toEqual(['연봉 구간', '부모님 학력', '부모님 자산']);
    expect(rows.map((r) => r.value)).toEqual(['7천만~1억 원', '대졸 (구간)', '비공개']);
  });
});

describe('서버 응답 모양 (조건 7: 점수 · 등급 · 순위 키 0)', () => {
  const FORBIDDEN = /^(grade|score|rank|rating|percent|match_score|level)$/i;
  const keysOf = (node: unknown, out: string[] = []): string[] => {
    if (Array.isArray(node)) node.forEach((v) => keysOf(v, out));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) {
      out.push(k);
      keysOf(v, out);
    }
    return out;
  };

  test('모의 서버의 목록 · 상세 응답 전체에 grade · score · rank 같은 키가 없다', () => {
    const recs = createDemoRecs(() => Date.UTC(2026, 9, 15, 3, 0, 0));
    const list = recs.list('u1', 'a@email.com').data;
    const detail = recs.candidate('u1', 'a@email.com', 'demo-cand-1').data;
    const keys = [...keysOf(list), ...keysOf(detail)];
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((k) => FORBIDDEN.test(k))).toEqual([]);
    expect(JSON.stringify([list, detail])).not.toMatch(/등급|점수|순위/);
  });

  test('앱은 아는 키만 읽는다: 서버가 순위 · 점수를 실수로 보내도 앱 데이터에는 없다', () => {
    const parsed = parseToday(
      { day: 'd', next_at: '2026-10-16T00:00:00Z', items: [{ candidate_id: 'x', rank: 1, score: 98, grade: 5, passed: false, liked: false, connected: false, profile: { A12: '김OO', A01: 32, grade: 5 }, photos: [], reasons: ['F06'] }] },
      Date.now(),
    );
    expect(parsed?.cards).toHaveLength(1);
    expect(keysOf(parsed).filter((k) => FORBIDDEN.test(k))).toEqual([]);
    const detail = parseCandidate({ user_id: 'x', answers: { A12: '김OO' }, photos: [], reasons: ['F06'], score: 3 });
    expect(keysOf(detail).filter((k) => FORBIDDEN.test(k))).toEqual([]);
    expect(parseToday({ next_at: 'bad', items: [] }, 0)).toBeNull();
  });

  test('모의 서버: 신고하면 목록에서 사라지고 한 상대는 한 번만 신고 · 설명 규칙', () => {
    const recs = createDemoRecs(() => Date.now());
    expect(recs.report('u', 'a@x.com', 'demo-cand-1', 'RP9', null).error?.message).toBe('invalid_reason');
    expect(recs.report('u', 'a@x.com', 'demo-cand-1', 'RP8', '짧음').error?.message).toBe('description_required');
    expect(recs.report('u', 'a@x.com', 'demo-cand-1', 'RP3', null).error).toBeNull();
    expect(recs.report('u', 'a@x.com', 'demo-cand-1', 'RP3', null).error?.message).toBe('already_reported');
    const ids = (recs.list('u', 'a@x.com').data as { items: { candidate_id: string }[] }).items.map((i) => i.candidate_id);
    expect(ids).toEqual(['demo-cand-2', 'demo-cand-3']);
  });
});

function recsDeps(initial: TodayData | 'network' | 'server', over: Partial<RecsDeps> = {}) {
  const loadToday = jest.fn(async () => (typeof initial === 'string' ? { ok: false as const, reason: initial } : { ok: true as const, data: initial }));
  const photoUrl = jest.fn(async (id: string) => `https://example.test/${id}.jpg`);
  const deps: RecsDeps = { api: { loadToday, photoUrl }, now: () => Date.UTC(2026, 9, 15, 9, 28, 0), tickMs: 20, toastMs: 50, ...over };
  return { deps, loadToday, photoUrl };
}

describe('F17 09 움직임 · 바탕(D25 장면 3 · 6)', () => {
  const flatStyle = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

  test('바탕 bgGrad 높이 300(09) · 13 은 기본 260', async () => {
    const tree = await mount(<RecommendationsScreen deps={recsDeps(today([card({ id: 'a' })])).deps} />);
    const height = (t: typeof tree) => flatStyle(t.root.findAll((n) => typeof n.type === 'string' && n.props?.testID === 'screen-backdrop')[0]).height;
    expect(height(tree)).toBe(300);
    const empty = await mount(<RecommendationsScreen deps={recsDeps(today([])).deps} forceEmpty />);
    expect(height(empty)).toBe(260);
  });

  test('처음 불러오는 동안 카드와 같은 틀의 뼈대 3장(스피너 대신) · 글 "불러오는 중이에요"', async () => {
    let release: (v: unknown) => void = () => undefined;
    const loadToday = jest.fn(() => new Promise((resolve) => (release = resolve)));
    const tree = await mount(<RecommendationsScreen deps={{ api: { loadToday: loadToday as never, photoUrl: jest.fn() as never }, now: () => NEXT - 3_600_000, tickMs: 1_000, toastMs: 50 }} />);
    expect(has(tree, 'recs-skeleton')).toBe(true);
    expect(must(tree, 'recs-skeleton').props.accessibilityLabel).toBe(COMMON.loading);
    await act(async () => release({ ok: true, data: today([card({ id: 'a' }), card({ id: 'b' })]) }));
    expect(has(tree, 'recs-skeleton')).toBe(false);
    expect(has(tree, 'rec-card-1')).toBe(true);
  });

  test('목록이 오면 카드가 편지처럼 놓인다: 처음 그려질 때 오른쪽 위(10, -30) · 3° 안 기울기 · 0.97배 · 투명에서 시작', async () => {
    const tree = await mount(<RecommendationsScreen deps={recsDeps(today([card({ id: 'a' }), card({ id: 'b' })])).deps} />);
    const landed = tree.root.findAll((n) => typeof n.type === 'string' && JSON.stringify(flatStyle(n).transform ?? null).includes('"translateY":-30'));
    expect(landed.length).toBe(2);
    expect(flatStyle(landed[0]).transform).toEqual([{ translateX: 10 }, { translateY: -30 }, { rotate: `${scene.today.tilts[0]}deg` }, { scale: 0.97 }]);
  });

  test('당겨서 새로고침을 놓으면 Light 햅틱(D25 4장)', async () => {
    const heard: string[] = [];
    const off = onHaptic((k) => heard.push(k));
    const s = recsDeps(today([card({ id: 'a' })]));
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    const scroll = tree.root.findAll((n) => n.props?.testID === 'screen-09' && n.props.refreshControl)[0];
    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh();
    });
    expect(heard).toEqual(['light']);
    expect(s.loadToday).toHaveBeenCalledTimes(2);
    off();
  });
});

describe('09 오늘의 추천 (조건 1 · 2)', () => {
  test('카드 3장: 사진 칸 · 이름 줄 · 한 줄 정보 · "맞는 점" + 칩, 우측 "다음 추천까지 14시간 32분", 부제', async () => {
    const cards = [card({ id: 'a' }), card({ id: 'b', head: '박OO · 30 · 경기 성남', info: '전문직 · 대졸 · 무교 · 초혼', reasons: ['종교', '부모 부양'], face: face('pending') }), card({ id: 'c', head: '최OO · 33 · 서울 송파', reasons: [] })];
    const s = recsDeps(today(cards, Date.UTC(2026, 9, 16, 0, 0, 0)));
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    expect(has(tree, 'screen-09')).toBe(true);
    expect(textOf(tree, 'recs-remaining')).toBe('다음 추천까지 14시간 32분');
    // F11: 머리 오른쪽에는 원형 프로필 사진이 오고, 시간은 부제 바로 아래 줄이다(D19 5장)
    expect(has(tree, 'profile-button')).toBe(true);
    expect(find(tree, 'recs-header')?.findAll((n) => n.props.testID === 'recs-remaining')).toHaveLength(0);
    expect(textOf(tree, 'recs-subtitle')).toBe('조건과 성향을 살펴 고른 세 분이에요.');
    for (let i = 0; i < 3; i += 1) expect(has(tree, `rec-card-${i}`)).toBe(true);
    expect(textOf(tree, 'rec-head-0')).toBe('김OO · 32 · 서울 강남');
    expect(textOf(tree, 'rec-info-1')).toBe('전문직 · 대졸 · 무교 · 초혼');
    expect(textOf(tree, 'rec-match-0')).toBe('맞는 점');
    expect(hasText(tree, '지역') && hasText(tree, '자녀 계획') && hasText(tree, '맞벌이')).toBe(true);
    expect(has(tree, 'rec-match-2')).toBe(false); // 맞는 점이 없으면 줄과 칩을 통째로 뺀다
    expect(has(tree, 'rec-chips-2')).toBe(false);
    expect(hasText(tree, RECS.photoChecking)).toBe(true); // NK03
    expect(allTexts(tree).join(' ')).not.toMatch(/등급|점수|순위/);
  });

  test('카드를 누르면 10 으로 간다. 넘긴 카드는 흐리게 "넘김"이고 눌러도 열리지 않는다. 호감 보낸 카드는 "호감 보냄"', async () => {
    const s = recsDeps(today([card({ id: 'a' }), card({ id: 'b', passed: true }), card({ id: 'c', liked: true })]));
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    await press(tree, 'rec-card-0');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/candidate/[id]', params: { id: 'a' } });
    mockRouter.push.mockClear();
    await press(tree, 'rec-card-1');
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(has(tree, 'rec-status-1') && hasText(tree, '넘김')).toBe(true);
    expect(has(tree, 'rec-status-2') && hasText(tree, '호감 보냄')).toBe(true);
    expect(has(tree, 'rec-status-0')).toBe(false);
  });

  test('카드가 1~2장이면 부제가 N16 글이고, 카드를 모두 보냈거나 넘기면 "오늘 추천은 여기까지예요…"가 아래에 붙는다', async () => {
    const s = recsDeps(today([card({ id: 'a', liked: true }), card({ id: 'b', passed: true })], Date.UTC(2026, 9, 15, 11, 28, 0)));
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    expect(textOf(tree, 'recs-subtitle')).toBe('조건과 성향을 살펴 고른 두 분이에요.');
    expect(textOf(tree, 'recs-done')).toBe('오늘 추천은 여기까지예요. 다음 추천까지 2시간 남았어요.');
    const s2 = recsDeps(today([card({ id: 'a' })]));
    const tree2 = await mount(<RecommendationsScreen deps={s2.deps} />);
    expect(has(tree2, 'recs-done')).toBe(false);
  });

  test('F16 지역 안내: region_hint 가 true 이고 1~2장이면 카드 아래 3줄(글 2 + [지역 조건 바꾸기]), 부제는 한 분 · 두 분. 누르면 12 희망 조건 수정 길로 이동만 하고 서버를 다시 부르지 않는다', async () => {
    for (const [cards, n, who] of [[[card({ id: 'a' })], 1, '한 분'], [[card({ id: 'a' }), card({ id: 'b' })], 2, '두 분']] as const) {
      const s = recsDeps(today([...cards], NEXT, { regionHint: true }));
      const tree = await mount(<RecommendationsScreen deps={s.deps} />);
      expect(textOf(tree, 'recs-subtitle')).toBe(`조건과 성향을 살펴 고른 ${who}이에요.`);
      expect(has(tree, 'recs-widen')).toBe(true);
      expect(textOf(tree, 'recs-widen-note')).toBe(`오늘은 ${n}분만 추천했어요. 지역 조건을 넓히면 추천이 달라질 수 있어요.`);
      expect(textOf(tree, 'recs-widen-own')).toBe('조건은 내가 직접 바꿀 때만 달라져요.');
      expect(hasText(tree, '지역 조건 바꾸기')).toBe(true);
      expect(allTexts(tree).join(' ')).not.toMatch(/등급|점수|순위|넓혀 드릴/);
      const loads = s.loadToday.mock.calls.length;
      mockRouter.push.mockClear();
      await press(tree, 'recs-widen-button');
      expect(mockRouter.push).toHaveBeenCalledTimes(1);
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/survey/[step]', params: { step: '25', mode: 'edit-preferences', from: 'recommendations' } });
      expect(s.loadToday.mock.calls.length).toBe(loads); // 누르기만 해서는 아무것도 바뀌지 않는다
    }
  });

  test('F16 지역 안내는 서버가 true 라고 한 때만: false 이면 1~2장이어도 없고, 3장 · 0장이면 true 여도 없다. 부제는 장수대로', async () => {
    const off = await mount(<RecommendationsScreen deps={recsDeps(today([card({ id: 'a' }), card({ id: 'b' })], NEXT, { regionHint: false })).deps} />);
    expect(has(off, 'recs-widen')).toBe(false);
    expect(textOf(off, 'recs-subtitle')).toBe('조건과 성향을 살펴 고른 두 분이에요.');
    const three = await mount(<RecommendationsScreen deps={recsDeps(today([card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })], NEXT, { regionHint: true })).deps} />);
    expect(has(three, 'recs-widen')).toBe(false);
    expect(textOf(three, 'recs-subtitle')).toBe('조건과 성향을 살펴 고른 세 분이에요.');
    const zero = await mount(<RecommendationsScreen deps={recsDeps(today([], NEXT, { regionHint: true })).deps} />);
    expect(has(zero, 'recs-widen')).toBe(false); // 0명은 기존 빈 상태 글(카피 09)
    expect(has(zero, 'recs-empty')).toBe(true);
  });

  test('F16 1회 매칭으로 받은 카드는 세지 않는다: 무료 1장 + 추가 3장이어도 부제 · 안내는 1명 기준', async () => {
    const extra = (id: string) => card({ id, source: 'match_once' });
    const s = recsDeps(today([card({ id: 'a' }), extra('x'), extra('y'), extra('z')], NEXT, { regionHint: true }));
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    expect(textOf(tree, 'recs-subtitle')).toBe('조건과 성향을 살펴 고른 한 분이에요.');
    expect(textOf(tree, 'recs-widen-note')).toContain('오늘은 1분만');
    expect(has(tree, 'recs-extra-title')).toBe(true);
  });

  test('F16 모의 서버: recone · rectwo 장면이 region_hint 를 주고 3장 · 0장 · 준비 중은 각자 맞게 준다. 앱 읽기는 region_hint 만 true 로 본다', () => {
    const at = Date.UTC(2026, 9, 15, 3, 0, 0);
    const recs = createDemoRecs(() => at);
    const list = (name: string) => recs.list(`u-${name}`, `${name}@email.com`).data as { region_hint: boolean; items: unknown[] };
    expect(list('recone').region_hint).toBe(true);
    expect(list('recone').items).toHaveLength(1);
    expect(list('rectwo').items).toHaveLength(2);
    expect(list('rectwo').region_hint).toBe(true);
    expect(list('plain').region_hint).toBe(false);
    expect(list('plain').items).toHaveLength(3);
    expect(list('rec0').region_hint).toBe(true); // 서버는 0명이어도 true — 앱은 0명이면 빈 상태 글을 쓴다
    expect(list('recprep').region_hint).toBe(false);
    expect(list('recfirst').region_hint).toBe(false);
    expect(parseToday({ day: 'd', next_at: '2026-10-16T00:00:00Z', region_hint: true, items: [] }, at)?.regionHint).toBe(true);
    expect(parseToday({ day: 'd', next_at: '2026-10-16T00:00:00Z', region_hint: 'yes', items: [] }, at)?.regionHint).toBe(false);
    expect(parseToday({ day: 'd', next_at: '2026-10-16T00:00:00Z', items: [] }, at)?.regionHint).toBe(false);
  });

  test('0명이면 빈 상태(그림 · 제목 · 본문)이고 남은 시간은 그대로, 임시 설문(F2L) 동안 보조 한 줄 · [희망 조건 보기]는 숨긴다(D-48)', async () => {
    const s = recsDeps(today([]));
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    expect(has(tree, 'recs-empty')).toBe(true);
    expect(has(tree, 'rec-card-0')).toBe(false);
    for (const t of [RECS.emptyTitle, RECS.emptyBody]) expect(hasText(tree, t)).toBe(true);
    expect(has(tree, 'recs-remaining')).toBe(true);
    expect(has(tree, 'recs-empty-prefs')).toBe(false);
    expect(hasText(tree, RECS.emptyHint) || hasText(tree, RECS.emptyButton)).toBe(false);
  });

  test('0장: first_list_pending 이면 첫 추천 대기(NK01 제목 + 보조, ready 와 상관없이) · 아니고 ready=false 면 준비 중(NK02 제목 + 보조) · 남은 시간은 그대로', async () => {
    // 기기 시각 = 2026-10-15 18:28 KST, next_at = 10-16 09:00 KST
    const prep = recsDeps(today([], NEXT, { ready: false }));
    const tree = await mount(<RecommendationsScreen deps={prep.deps} />);
    expect(has(tree, 'recs-preparing')).toBe(true);
    expect(textOf(tree, 'recs-wait-title')).toBe(RECS.preparing);
    expect(textOf(tree, 'recs-wait-note')).toBe(RECS.preparingNote);
    expect(has(tree, 'recs-empty')).toBe(false);
    expect(has(tree, 'recs-remaining')).toBe(true);
    expect(has(tree, 'recs-empty-art')).toBe(true);
    for (const ready of [true, false]) {
      const first = recsDeps(today([], NEXT, { ready, firstListPending: true }));
      const tree2 = await mount(<RecommendationsScreen deps={first.deps} />);
      expect(has(tree2, 'recs-first-wait')).toBe(true);
      expect(textOf(tree2, 'recs-wait-title')).toBe('첫 추천은 15시간 뒤에 도착해요.');
      expect(textOf(tree2, 'recs-wait-note')).toBe(RECS.firstWaitNote);
    }
    const ready = recsDeps(today([], NEXT, { ready: true }));
    const tree3 = await mount(<RecommendationsScreen deps={ready.deps} />);
    expect(has(tree3, 'recs-empty')).toBe(true);
    const cards = recsDeps(today([card()], NEXT, { ready: false, firstListPending: true })); // 카드가 있으면 신호를 보지 않는다
    const tree4 = await mount(<RecommendationsScreen deps={cards.deps} />);
    expect(has(tree4, 'rec-card-0')).toBe(true);
  });

  test('NK01 글: 오늘 09:00 전이면 "오늘 오전 9시에 도착해요." · 1시간 미만은 분 · 그 밖은 시간(올림) / 가르기 규칙', () => {
    const kst = (d: number, h: number, m = 0) => Date.UTC(2026, 9, d, h - 9, m);
    expect(firstWaitText(kst(16, 9), kst(16, 2))).toBe(RECS.firstWaitToday);
    expect(firstWaitText(kst(16, 9), kst(15, 23, 30))).toBe('첫 추천은 10시간 뒤에 도착해요.');
    expect(firstWaitText(kst(16, 9), kst(15, 23, 59))).toBe('첫 추천은 10시간 뒤에 도착해요.');
    expect(firstWaitText(kst(16, 9), kst(16, 8, 20))).toBe(RECS.firstWaitToday);
    expect(firstWaitText(kst(17, 9), kst(17, 8, 20))).toBe(RECS.firstWaitToday);
    expect(firstWaitText(kst(16, 9), kst(16, 9, -25))).toBe(RECS.firstWaitToday);
    expect(firstWaitText(kst(16, 14), kst(16, 13, 35))).toBe('첫 추천은 25분 뒤에 도착해요.'); // 1시간 미만(첫 목록 시각이 09:00 이 아닌 경우를 대비)
    expect(emptyKind(true, true)).toBe('first');
    expect(emptyKind(true, false)).toBe('first');
    expect(emptyKind(false, false)).toBe('preparing');
    expect(emptyKind(false, true)).toBe('empty');
  });

  test('서버 응답의 ready · first_list_pending · now: 없으면 true · false, now 로 기기 시계 차이를 지운다', () => {
    const at = Date.UTC(2026, 9, 15, 5, 0, 0);
    const p = parseToday({ day: 'd', now: new Date(at).toISOString(), ready: false, first_list_pending: true, next_at: '2026-10-16T00:00:00Z', items: [] }, at - 60_000);
    expect(p?.ready).toBe(false);
    expect(p?.firstListPending).toBe(true);
    expect(p?.offset).toBe(60_000);
    expect(parseToday({ day: 'd', next_at: '2026-10-16T00:00:00Z', items: [] }, at)?.ready).toBe(true);
    expect(parseToday({ day: 'd', next_at: '2026-10-16T00:00:00Z', items: [] }, at)?.firstListPending).toBe(false);
  });

  test('D8 4차: 카드 이름 15 Bold(M6) · "맞는 점" 12 Medium(M8) · 넘김 카드는 카드 전체 40%(M9) · 빈 상태 그림 + 본문 sub(M10)', async () => {
    const s = recsDeps(today([card({ id: 'a' }), card({ id: 'b', passed: true })]));
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    expect(find(tree, 'rec-head-0')?.props.variant).toBe('bodyBold');
    expect(find(tree, 'rec-match-0')?.props.variant).toBe('captionMedium');
    const flat = (style: unknown): Record<string, unknown> => (Array.isArray(style) ? Object.assign({}, ...style.flat(5).filter(Boolean)) : ((style as Record<string, unknown>) ?? {}));
    expect(flat(find(tree, 'rec-card-1')?.props.style).opacity).toBe(0.4);
    expect(flat(find(tree, 'rec-card-0')?.props.style).opacity).toBeUndefined();
    const empty = recsDeps(today([]));
    const tree2 = await mount(<RecommendationsScreen deps={empty.deps} />);
    expect(has(tree2, 'recs-empty-art')).toBe(true);
    expect(find(tree2, 'recs-empty-body')?.props.tone).toBe('sub');
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const path = jest.requireActual<typeof import('node:path')>('node:path');
    const ORIGINAL = '디자인/아이콘/투명/20_빈상태_추천없음.png';
    whenOutside([ORIGINAL], () => {
      expect(fs.readFileSync(path.join(APP_DIR, 'assets', 'icons', 'ui', 'empty_recs.png')).equals(fs.readFileSync(outsidePath(ORIGINAL)))).toBe(true);
    });
  });

  test('13 은 같은 화면의 빈 상태: 서버에 카드가 있어도 카드 자리를 비운다', async () => {
    const s = recsDeps(today([card()]));
    const tree = await mount(<RecommendationsScreen deps={s.deps} forceEmpty />);
    expect(has(tree, 'recs-empty')).toBe(true);
    expect(has(tree, 'rec-card-0')).toBe(false);
    expect(has(tree, 'screen-13')).toBe(true);
  });

  test('불러오기 실패: 서버 문제는 카피 글 + [다시 시도], 인터넷 문제는 공통 오프라인 글. 다시 시도하면 카드가 나온다', async () => {
    const s = recsDeps('server');
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    expect(textOf(tree, 'recs-error')).toBe(RECS.loadFailed);
    s.loadToday.mockResolvedValueOnce({ ok: true, data: today([card()]) } as never);
    await press(tree, 'recs-retry');
    expect(has(tree, 'rec-card-0')).toBe(true);
    const off = recsDeps('network');
    const tree2 = await mount(<RecommendationsScreen deps={off.deps} />);
    expect(textOf(tree2, 'recs-error')).toBe(COMMON.offline);
  });

  test('시간이 0 이 되면 자동으로 다시 불러와 새 목록으로 바뀐다(만료)', async () => {
    let t = Date.UTC(2026, 9, 15, 9, 0, 0);
    const first = today([card({ id: 'old', head: '옛OO · 30 · 서울 종로' })], t + 30);
    const second = today([card({ id: 'new', head: '새OO · 31 · 서울 마포' })], t + 24 * 3_600_000);
    const s = recsDeps(first, { now: () => t, tickMs: 10 });
    s.loadToday.mockResolvedValueOnce({ ok: true, data: first } as never).mockResolvedValue({ ok: true, data: second } as never);
    const tree = await mount(<RecommendationsScreen deps={s.deps} />);
    expect(textOf(tree, 'rec-head-0')).toBe('옛OO · 30 · 서울 종로');
    expect(textOf(tree, 'recs-remaining')).toBe('다음 추천까지 1분 미만');
    t += 100;
    await new Promise((resolve) => setTimeout(resolve, 1300));
    await mount(<></>);
    expect(s.loadToday.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(textOf(tree, 'rec-head-0')).toBe('새OO · 31 · 서울 마포');
  });

  test('다른 회원 화면 캡처 차단 훅이 붙어 있다(기본 끔 — 설정 값은 F7 스위치)', async () => {
    expect(SCREEN_CAPTURE_BLOCK_DEFAULT).toBe(false);
  });
});

const detail = (over: Partial<CandidateData> = {}): CandidateData => ({
  id: 'demo-cand-1',
  answers: { A12: '김OO', A01: 32, A03: { sido: '서울', sigungu: '강남구' }, C01: '대기업', B01: '석사', A06: '기독교', A07: '초혼', A09: '비흡연', A05: 178, C05: '7천만~1억 원', D03: '대졸 (구간)' },
  photos: [face('approved', 'p1'), { slot: 'full', state: 'approved', photoId: 'p2' }, { slot: 'free', state: 'pending', photoId: null }],
  reasons: ['지역', '종교', '자녀 계획'],
  gradeNo: null,
  ...over,
});

function candDeps(data: CandidateData | null | 'network', over: Partial<CandidateDeps['api']> = {}) {
  const loadCandidate = jest.fn(async () => (data === 'network' ? { ok: false as const, reason: 'network' as const } : { ok: true as const, data }));
  const api = {
    loadCandidate,
    pairState: jest.fn(async () => ({ state: 'none' as const, likesLeft: 3 })),
    photoUrl: jest.fn(async (id: string) => `https://example.test/${id}.jpg`),
    pass: jest.fn(async () => ({ ok: true as const })),
    sendLike: jest.fn(async () => ({ ok: true as const, data: { connected: false } })),
    report: jest.fn(async () => ({ ok: true as const })),
    block: jest.fn(async () => ({ ok: true as const })),
    ...over,
  } as unknown as CandidateDeps['api'];
  return { deps: { api, grade: { partnerGrade: jest.fn(async () => null) }, toastMs: 50 } as CandidateDeps, api: api as unknown as Record<string, jest.Mock> };
}

describe('10 상대 프로필 (조건 3 · 4)', () => {
  test('공개 항목만: 이름 줄 · 한 줄 정보 · 표 3줄(없는 값은 "비공개") · 사진 1 / 2(승인 2장만 센다) · 서류 확인 안내 · 안전 안내', async () => {
    const s = candDeps(detail());
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    expect(has(tree, 'screen-10')).toBe(true);
    expect(textOf(tree, 'candidate-head')).toBe('김OO · 32 · 서울 강남구');
    expect(textOf(tree, 'candidate-info')).toBe('대기업 · 석사 · 기독교 · 초혼 · 비흡연 · 178cm');
    expect(hasText(tree, '7천만~1억 원')).toBe(true);
    expect(hasText(tree, '대졸 (구간)')).toBe(true);
    expect(allTexts(tree).filter((t) => t === '비공개')).toHaveLength(1); // 부모님 자산만 비공개
    expect(textOf(tree, 'candidate-photo-index')).toBe('사진 1 / 2');
    expect(textOf(tree, 'candidate-disclaimer')).toBe(CANDIDATE.disclaimer);
    expect(textOf(tree, 'candidate-safety')).toBe(SAFETY.line);
    expect(has(tree, 'candidate-photo-2')).toBe(false); // 확인 중 칸은 세지도 넘기지도 않는다(F18 N1)
    expect(allTexts(tree).join(' ')).not.toMatch(/순위|퍼센트/);
  });

  test('F12 · 공개 항목 15개(정책 2-5 순서): 서버가 준 것만 줄로, 값은 서버 글 그대로(구간 포함) · 하나도 없으면 구역을 뺀다', async () => {
    const all = { A04: '부산', A10: '월 1~2회', A11: '군필', A08: '없음', D05: '1명', D06: '첫째(장남·장녀)', B03: '경영학', B04: '없음', C03: '대리·과장급', C04: '정규직', C06: '1억~3억', B02: '한국대', C02: '가나다 회사', G02: '보통', G03: ['단정', '캐주얼'] };
    const full = await mount(<CandidateScreen deps={candDeps(detail({ answers: { ...detail().answers, ...all } })).deps} />);
    expect(textOf(full, 'candidate-open-title')).toBe('공개한 정보');
    const ids = full.root.findAll((n) => typeof n.props.testID === 'string' && /^candidate-open-[A-Z]\d\d$/.test(n.props.testID)).map((n) => n.props.testID);
    expect([...new Set(ids)]).toEqual(['A04', 'A10', 'A11', 'A08', 'D05', 'D06', 'B03', 'B04', 'C03', 'C04', 'C06', 'B02', 'C02', 'G02', 'G03'].map((x) => `candidate-open-${x}`));
    expect(hasText(full, '1억~3억')).toBe(true); // 본인 자산은 구간 그대로
    expect(hasText(full, '단정, 캐주얼')).toBe(true);
    expect(hasText(full, '본인 자산')).toBe(true);
    const few = await mount(<CandidateScreen deps={candDeps(detail({ answers: { ...detail().answers, A04: '서울', C06: '5억~10억' } })).deps} />);
    expect(has(few, 'candidate-open-A04')).toBe(true);
    expect(has(few, 'candidate-open-C06')).toBe(true);
    expect(has(few, 'candidate-open-A10')).toBe(false); // 상대가 가린 항목은 줄이 없다
    const none = await mount(<CandidateScreen deps={candDeps(detail()).deps} />);
    expect(has(none, 'candidate-open')).toBe(false);
  });

  test('"왜 추천했나요": 맞은 항목 ≥1 이면 이름 · 문장 · 법무 유지 문장, 0이면 박스를 통째로 뺀다', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail()).deps} />);
    expect(hasText(tree, '왜 추천했나요')).toBe(true);
    expect(textOf(tree, 'candidate-why-body')).toBe('지역 · 종교 · 자녀 계획이 맞아요.');
    expect(textOf(tree, 'candidate-why-note')).toBe(CANDIDATE.whyNote);
    // J13 · B7 A7: 둘째 문장은 유지 — 법무 L10 W1 · 마케팅 B7 이 확정한 "추천 점수는 보여주지 않아요." 가 한 번 그려지고(빠지면 실패),
    // 그 문장 밖에는 등급 · 점수 말이 없으며 10 화면 어디에도 '등급'은 없다
    expect(CANDIDATE.whyNote).toBe('추천 점수는 보여주지 않아요.');
    expect(allTexts(tree).filter((t) => t === CANDIDATE.whyNote)).toHaveLength(1);
    expect(allTexts(tree).filter((t) => t !== CANDIDATE.whyNote && /등급|점수/.test(t))).toEqual([]);
    expect(allTexts(tree).join(' ')).not.toMatch(/등급/);
    const none = await mount(<CandidateScreen deps={candDeps(detail({ reasons: [] })).deps} />);
    expect(has(none, 'candidate-why')).toBe(false);
    expect(hasText(none, '왜 추천했나요')).toBe(false);
  });

  test('사진 넘김: 다음 · 이전 버튼으로 "사진 2 / 3" … 처음과 끝에서는 그 방향 버튼이 없다', async () => {
    const three = [face('approved', 'p1'), { slot: 'full', state: 'approved' as const, photoId: 'p2' }, { slot: 'free', state: 'approved' as const, photoId: 'p3' }];
    const tree = await mount(<CandidateScreen deps={candDeps(detail({ photos: three })).deps} />);
    expect(has(tree, 'candidate-photo-prev')).toBe(false);
    await press(tree, 'candidate-photo-next');
    expect(textOf(tree, 'candidate-photo-index')).toBe('사진 2 / 3');
    await press(tree, 'candidate-photo-next');
    expect(textOf(tree, 'candidate-photo-index')).toBe('사진 3 / 3');
    expect(has(tree, 'candidate-photo-next')).toBe(false);
    await press(tree, 'candidate-photo-prev');
    expect(textOf(tree, 'candidate-photo-index')).toBe('사진 2 / 3');
  });

  test('볼 수 없는 프로필 · 불러오기 실패', async () => {
    const gone = await mount(<CandidateScreen deps={candDeps(null).deps} />);
    expect(hasText(gone, CANDIDATE.unavailable)).toBe(true);
    await press(gone, 'candidate-unavailable-ok');
    expect(mockRouter.back).toHaveBeenCalled();
    const off = await mount(<CandidateScreen deps={candDeps('network').deps} />);
    expect(textOf(off, 'candidate-error')).toBe(COMMON.offline);
  });
});

describe('10 넘기기 · 호감 보내기 (조건 5)', () => {
  test('[넘기기]: 확인창 없이 pass 를 부르고 09 로 돌아간다', async () => {
    const s = candDeps(detail());
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    await press(tree, 'candidate-pass');
    expect(s.api.pass).toHaveBeenCalledWith('demo-cand-1');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  test('[호감 보내기]: Light 햅틱 → 보내지면 "호감 보냄" + 편지가 떠나고(700ms) 09 로 돌아가며 토스트 글을 남긴다 / 서로 호감이면 연결 글 (F17 D25 장면 4)', async () => {
    const heard: string[] = [];
    const off = onHaptic((k) => heard.push(k));
    const s = candDeps(detail());
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    await press(tree, 'candidate-like');
    expect(s.api.sendLike).toHaveBeenCalledWith('demo-cand-1');
    expect(heard).toEqual(['light']);
    expect(must(tree, 'candidate-like').props.label).toBe(CANDIDATE.liked);
    expect(has(tree, 'candidate-mail')).toBe(true); // 편지 한 통
    expect(mockRouter.back).not.toHaveBeenCalled(); // 편지가 떠나는 동안은 머문다
    await wait(scene.like.mail + 100);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(takeToast()).toBe('호감을 보냈어요. 상대가 수락하면 알려 드릴게요.');
    const c = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: true as const, data: { connected: true } })) as never });
    const tree2 = await mount(<CandidateScreen deps={c.deps} />);
    await press(tree2, 'candidate-like');
    await wait(scene.like.mail + 100);
    expect(takeToast()).toBe('서로 수락했어요 · 연락 방법은 준비 중이에요');
    off();
  });

  test('동작 줄이기: 편지 없이 바로 09 + 토스트(F17 조건 5)', async () => {
    try {
      const s = candDeps(detail());
      const tree = await mount(<CandidateScreen deps={s.deps} />);
      await wait(10); // 기기 설정 첫 읽기가 끝난 뒤에 켠다
      await act(async () => reduceMotionStore.set(true));
      await press(tree, 'candidate-like');
      expect(has(tree, 'candidate-mail')).toBe(false);
      await wait(20);
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      takeToast();
    } finally {
      act(() => reduceMotionStore.set(false));
    }
  });

  test('햅틱 자리: 하루 한도 Warning · 보내기 실패 Error · 받은 호감 수락 Success(D25 4장)', async () => {
    const heard: string[] = [];
    const off = onHaptic((k) => heard.push(k));
    const lim = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: false as const, reason: 'limit' as const })) as never });
    await press(await mount(<CandidateScreen deps={lim.deps} />), 'candidate-like');
    expect(heard).toEqual(['light', 'warning']);
    heard.length = 0;
    const bad = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: false as const, reason: 'server' as const })) as never });
    await press(await mount(<CandidateScreen deps={bad.deps} />), 'candidate-like');
    expect(heard).toEqual(['light', 'error']);
    off();
  });

  test('중복 금지: 이미 보낸 분이면 "호감 보냄"으로 흐려지고 다시 보내지 않는다 / 한도는 NK04 / 실패 글', async () => {
    const dup = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: false as const, reason: 'already' as const })) as never });
    const tree = await mount(<CandidateScreen deps={dup.deps} />);
    await press(tree, 'candidate-like');
    expect(hasText(tree, '호감 보냄')).toBe(true);
    expect(must(tree, 'candidate-like').props.disabled).toBe(true);
    expect(mockRouter.back).not.toHaveBeenCalled();

    const lim = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: false as const, reason: 'limit' as const })) as never });
    const tree2 = await mount(<CandidateScreen deps={lim.deps} />);
    await press(tree2, 'candidate-like');
    expect(textOf(tree2, 'candidate-limit')).toBe(CANDIDATE.likeLimit);
    expect(must(tree2, 'candidate-like').props.dimmed).toBe(true);

    const bad = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: false as const, reason: 'server' as const })) as never });
    const tree3 = await mount(<CandidateScreen deps={bad.deps} />);
    await press(tree3, 'candidate-like');
    expect(textOf(tree3, 'candidate-action-error')).toBe(CANDIDATE.likeFailed);
    const off = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: false as const, reason: 'network' as const })) as never });
    const tree4 = await mount(<CandidateScreen deps={off.deps} />);
    await press(tree4, 'candidate-like');
    expect(textOf(tree4, 'candidate-action-error')).toBe(COMMON.offline);
  });

  test('호감을 보내는 동안 다시 눌러도 한 번만 보낸다', async () => {
    let release: () => void = () => undefined;
    const slow = jest.fn(() => new Promise((resolve) => (release = () => resolve({ ok: true, data: { connected: false } }))));
    const s = candDeps(detail(), { sendLike: slow as never });
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    const press1 = must(tree, 'candidate-like').props.onPress as () => Promise<void>;
    await act(async () => {
      void press1(); // 끝나기를 기다리지 않는다
    });
    expect(must(tree, 'candidate-like').props.disabled).toBe(true); // 보내는 동안 눌림이 잠긴다
    await act(async () => {
      void press1(); // 그래도 한 번 더 불러지면 안 된다
    });
    expect(slow).toHaveBeenCalledTimes(1);
    release();
    await wait(scene.like.mail + 100); // 편지가 떠난 뒤의 09 이동이 다음 시험으로 새지 않게 여기서 끝낸다
    takeToast();
  });
});

describe('10 호감 버튼 상태 (get_pair_state)', () => {
  test('이미 보낸 분이면 처음부터 "호감 보냄"이고, 오늘 한도가 0이면 미리 흐리게 안내가 보인다', async () => {
    const sent = candDeps(detail(), { pairState: jest.fn(async () => ({ state: 'sent' as const, likesLeft: 2 })) as never });
    const tree = await mount(<CandidateScreen deps={sent.deps} />);
    expect(hasText(tree, '호감 보냄')).toBe(true);
    expect(must(tree, 'candidate-like').props.disabled).toBe(true);
    const none = candDeps(detail(), { pairState: jest.fn(async () => ({ state: 'none' as const, likesLeft: 0 })) as never });
    const tree2 = await mount(<CandidateScreen deps={none.deps} />);
    expect(textOf(tree2, 'candidate-limit')).toBe(CANDIDATE.likeLimit);
    expect(must(tree2, 'candidate-like').props.dimmed).toBe(true);
    const unknown = candDeps(detail(), { pairState: jest.fn(async () => null) as never });
    const tree3 = await mount(<CandidateScreen deps={unknown.deps} />);
    expect(has(tree3, 'candidate-limit')).toBe(false); // 못 읽으면 그대로 두고 서버가 막는다
  });

  const pairOf = (state: 'none' | 'sent' | 'received' | 'connected', likeId: string | null = null) => jest.fn(async () => ({ state, likesLeft: 2, likeId, matchId: state === 'connected' ? 'm1' : null, expiresAt: null })) as never;
  const likesMock = (over: Record<string, unknown> = {}) => ({ accept: jest.fn(async () => ({ ok: true as const, data: { matchId: 'm1', userId: 'demo-cand-1' } })), decline: jest.fn(async () => ({ ok: true as const })), ...over });

  test('F6 받은 호감(received): [거절][수락] — 수락하면 like_id 로 수락하고 토스트를 남긴 채 11 로 돌아간다, [넘기기] · [호감 보내기]는 없다', async () => {
    const s = candDeps(detail(), { pairState: pairOf('received', 'like-9') });
    const likes = likesMock();
    const tree = await mount(<CandidateScreen deps={{ ...s.deps, likes } as never} />);
    expect(hasText(tree, LIKES.accept) && hasText(tree, LIKES.decline)).toBe(true);
    expect(has(tree, 'candidate-like') || has(tree, 'candidate-pass')).toBe(false);
    await press(tree, 'candidate-accept');
    expect(likes.accept).toHaveBeenCalledWith('like-9');
    expect(takeToast()).toBe(LIKES.acceptDone);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  test('F6 받은 호감 거절 → "거절했어요." 토스트 · 11 로, 실패하면 머물고 이유(연결할 수 없음)', async () => {
    const s = candDeps(detail(), { pairState: pairOf('received', 'like-9') });
    const likes = likesMock();
    const tree = await mount(<CandidateScreen deps={{ ...s.deps, likes } as never} />);
    await press(tree, 'candidate-decline');
    expect(likes.decline).toHaveBeenCalledWith('like-9');
    expect(takeToast()).toBe(LIKES.declineDone);
    const bad = likesMock({ accept: jest.fn(async () => ({ ok: false as const, reason: 'unavailable' as const })) });
    const tree2 = await mount(<CandidateScreen deps={{ ...candDeps(detail(), { pairState: pairOf('received', 'like-8') }).deps, likes: bad } as never} />);
    mockRouter.back.mockClear();
    await press(tree2, 'candidate-accept');
    expect(textOf(tree2, 'candidate-action-error')).toBe(LIKES.unavailable);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test('F6 연결됨(connected): 버튼 없이 안내 한 줄', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail(), { pairState: pairOf('connected') }).deps} />);
    expect(textOf(tree, 'candidate-connected')).toBe(LIKES.connectedNote);
    expect(has(tree, 'candidate-like') || has(tree, 'candidate-accept')).toBe(false);
  });

  test('규칙 ②(0011 뒤 남는 것): 거절한 사람이 같은 날 연 상대 — none 이라 보냈는데 forbidden · 프로필은 그대로면 [호감 보내기]만 숨기고 글은 없다 / 프로필도 없으면 "볼 수 없어요"', async () => {
    const s = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: false as const, reason: 'unavailable' as const })) as never });
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    await press(tree, 'candidate-like');
    expect(has(tree, 'candidate-like')).toBe(false);
    expect(has(tree, 'candidate-action-error')).toBe(false);
    expect(has(tree, 'candidate-head')).toBe(true);
    const gone = candDeps(detail(), { sendLike: jest.fn(async () => ({ ok: false as const, reason: 'unavailable' as const })) as never });
    (gone.api.loadCandidate as jest.Mock).mockResolvedValueOnce({ ok: true, data: detail() }).mockResolvedValueOnce({ ok: true, data: null });
    const tree2 = await mount(<CandidateScreen deps={gone.deps} />);
    await press(tree2, 'candidate-like');
    expect(hasText(tree2, CANDIDATE.unavailable)).toBe(true);
  });

  test('0011: 내가 보낸 호감은 상대가 거절했어도 서버가 sent 를 준다 → 그대로 "호감 보냄"(거절을 드러내지 않는다)', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail(), { pairState: pairOf('sent', 'like-1') }).deps} />);
    expect(must(tree, 'candidate-like').props.label).toBe(CANDIDATE.liked);
  });
});

describe('신고 · 차단 (조건 6)', () => {
  const openSheet = async (tree: Awaited<ReturnType<typeof mount>>) => press(tree, 'candidate-header-right');

  test('상단 "신고 · 차단" → 시트(제목 · 신고하기 + 작은 글 · 차단하기 + 작은 글 · 취소)', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail()).deps} />);
    expect(isOpen(tree, 'report-menu')).toBe(false);
    await openSheet(tree);
    expect(isOpen(tree, 'report-menu')).toBe(true);
    for (const t of [REPORT_SHEET.title, REPORT_SHEET.report, REPORT_SHEET.reportHint, REPORT_SHEET.block, REPORT_SHEET.blockHint, REPORT_SHEET.cancel]) expect(hasText(tree, t)).toBe(true);
    await press(tree, 'report-menu-cancel');
    expect(isOpen(tree, 'report-menu')).toBe(false);
  });

  test('신고: 사유 8개 · 미성년자 아래 24시간 안내 · 익명 안내 → 사유 선택 → 제출하면 report 를 부르고 이 화면에 머물며 토스트', async () => {
    const s = candDeps(detail());
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    await openSheet(tree);
    await press(tree, 'report-menu-report');
    expect(isOpen(tree, 'report-reasons')).toBe(true);
    for (const r of REPORT_SHEET.reasons) expect(hasText(tree, r)).toBe(true);
    expect(REPORT_CODES).toHaveLength(8);
    expect(textOf(tree, 'report-minor-note')).toBe(REPORT_SHEET.reasonRP6Note);
    expect(textOf(tree, 'report-anonymous-note')).toBe(REPORT_SHEET.anonymousNote);
    await press(tree, 'report-submit'); // 사유 없이
    expect(textOf(tree, 'report-reason-error')).toBe(REPORT_SHEET.errors.noReason);
    expect(s.api.report).not.toHaveBeenCalled();
    await press(tree, 'report-reason-RP3');
    await typeInto(tree, 'report-desc', '  부적절한 사진이에요  ');
    await press(tree, 'report-submit');
    expect(s.api.report).toHaveBeenCalledWith('demo-cand-1', 'RP3', '부적절한 사진이에요');
    expect(isOpen(tree, 'report-reasons')).toBe(false);
    expect(hasText(tree, REPORT_SHEET.done)).toBe(true);
    expect(mockRouter.back).not.toHaveBeenCalled(); // 이 화면에 머문다
  });

  test('신고 검사: 기타는 설명 10자 이상 · 200자 초과 · 이미 신고 · 서버 실패 · 인터넷', async () => {
    const s = candDeps(detail());
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    await openSheet(tree);
    await press(tree, 'report-menu-report');
    await press(tree, 'report-reason-RP8');
    await typeInto(tree, 'report-desc', '짧아요');
    await press(tree, 'report-submit');
    expect(textOf(tree, 'report-desc-error')).toBe(REPORT_SHEET.errors.descShort);
    await typeInto(tree, 'report-desc', 'x'.repeat(201));
    await press(tree, 'report-submit');
    expect(textOf(tree, 'report-desc-error')).toBe(REPORT_SHEET.errors.descLong);
    expect(s.api.report).not.toHaveBeenCalled();
    await typeInto(tree, 'report-desc', '충분히 길게 적은 설명입니다');
    s.api.report.mockResolvedValueOnce({ ok: false, reason: 'already' });
    await press(tree, 'report-submit');
    expect(textOf(tree, 'report-error')).toBe(REPORT_SHEET.errors.already);
    s.api.report.mockResolvedValueOnce({ ok: false, reason: 'server' });
    await press(tree, 'report-submit');
    expect(textOf(tree, 'report-error')).toBe(REPORT_SHEET.errors.failed);
    s.api.report.mockResolvedValueOnce({ ok: false, reason: 'network' });
    await press(tree, 'report-submit');
    expect(textOf(tree, 'report-error')).toBe(COMMON.offline);
  });

  test('차단: 확인창(N17) → [차단하기] 로 block 을 부르고 진입한 화면으로 돌아간다 / [취소] 는 아무것도 하지 않는다', async () => {
    const s = candDeps(detail());
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    await openSheet(tree);
    await press(tree, 'report-menu-block');
    expect(isOpen(tree, 'report-block-confirm')).toBe(true);
    expect(textOf(tree, 'report-block-confirm-title')).toBe(REPORT_SHEET.blockConfirm);
    await press(tree, 'report-block-confirm-cancel');
    expect(isOpen(tree, 'report-block-confirm')).toBe(false);
    expect(s.api.block).not.toHaveBeenCalled();
    await openSheet(tree);
    await press(tree, 'report-menu-block');
    await press(tree, 'report-block-confirm-confirm');
    expect(s.api.block).toHaveBeenCalledWith('demo-cand-1');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(takeToast()).toBe(REPORT_SHEET.blockDone);
  });

  test('차단 실패: 서버 글 · 인터넷 글, 화면에 머문다', async () => {
    const s = candDeps(detail(), { block: jest.fn(async () => ({ ok: false as const, reason: 'server' as const })) as never });
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    await openSheet(tree);
    await press(tree, 'report-menu-block');
    await press(tree, 'report-block-confirm-confirm');
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(textOf(tree, 'report-menu-error')).toBe(REPORT_SHEET.blockFailed);
  });
});

describe('Q5A-04 사진 0장이면 기본 그림 하나', () => {
  const none = [{ slot: 'face', state: 'none' as const, photoId: null }, { slot: 'full', state: 'none' as const, photoId: null }, { slot: 'free', state: 'none' as const, photoId: null }];
  test('승인 · 확인 중 사진이 없으면 "1 / 3" · 화살표 없이 한 쪽', async () => {
    const s = candDeps(detail({ photos: none }));
    const tree = await mount(<CandidateScreen deps={s.deps} />);
    expect(has(tree, 'candidate-photo-index')).toBe(false);
    expect(has(tree, 'candidate-photo-0')).toBe(true);
    expect(has(tree, 'candidate-photo-1')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/사진 \d \/ 3/);
  });
});

// F18 조건 1 (Q5A-04 · Q6 N1): 넘겨 볼 쪽은 승인된 사진만 센다(F18 조건 1 · K7).
//  승인 0장이면 확인 중 칸 · 없음 칸 모두 빼고 기본 그림 한 쪽(확인 중이 있으면 그 아래 '사진 확인 중'), '사진 1 / 3' · 화살표 없음(화면요구사항 10 '사진 없음(K7)' 행).
//  승인 1장 + 확인 중 2장이면 승인 1장만 — 번호 · 화살표 없음.
describe('F18 · N1 승인 0장이면 사진 번호 · 화살표 없음', () => {
  const slot = (name: string, state: 'approved' | 'pending' | 'none', photoId: string | null = null) => ({ slot: name, state, photoId });
  const noIndex = (tree: Awaited<ReturnType<typeof mount>>) => {
    expect(has(tree, 'candidate-photo-index')).toBe(false);
    expect(has(tree, 'candidate-photo-next')).toBe(false);
    expect(has(tree, 'candidate-photo-prev')).toBe(false);
    expect(has(tree, 'candidate-photo-0')).toBe(true);
    expect(has(tree, 'candidate-photo-1')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/사진 \d \/ \d/);
  };

  test('승인 0장 · 확인 중 3장(데모 박OO): 기본 그림 한 쪽 + 그 아래 "사진 확인 중", "1 / 3" · 다음 화살표 없음', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail({ photos: [slot('face', 'pending'), slot('full', 'pending'), slot('free', 'pending')] })).deps} />);
    noIndex(tree);
    expect(textOf(tree, 'candidate-photo-0-checking')).toBe(RECS.photoChecking);
  });

  test('승인 0장 · 확인 중 1장 + 없음 2장: 한 쪽(확인 중 글), 번호 · 화살표 없음', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail({ photos: [slot('face', 'none'), slot('full', 'pending'), slot('free', 'none')] })).deps} />);
    noIndex(tree);
    expect(has(tree, 'candidate-photo-0-checking')).toBe(true);
  });

  test('승인 1장 + 없음 2장: 승인 사진 한 쪽만, 번호 · 화살표 없음', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail({ photos: [slot('face', 'approved', 'p1'), slot('full', 'none'), slot('free', 'none')] })).deps} />);
    noIndex(tree);
    expect(has(tree, 'candidate-photo-0-checking')).toBe(false);
  });

  test('승인 1장 + 확인 중 2장: 승인 1장만 넘김 대상 — 한 쪽, 번호 · 화살표 없음(확인 중 칸을 세지 않는다)', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail({ photos: [slot('face', 'approved', 'p1'), slot('full', 'pending'), slot('free', 'pending')] })).deps} />);
    noIndex(tree);
    expect(has(tree, 'candidate-photo-0-checking')).toBe(false);
  });

  test('승인 2장 + 확인 중 1장: 승인 2장만 "사진 1 / 2" → 다음 → "사진 2 / 2"(끝에서 다음 화살표 없음)', async () => {
    const tree = await mount(<CandidateScreen deps={candDeps(detail({ photos: [slot('face', 'approved', 'p1'), slot('full', 'pending'), slot('free', 'approved', 'p3')] })).deps} />);
    expect(textOf(tree, 'candidate-photo-index')).toBe('사진 1 / 2');
    expect(has(tree, 'candidate-photo-2')).toBe(false);
    await press(tree, 'candidate-photo-next');
    expect(textOf(tree, 'candidate-photo-index')).toBe('사진 2 / 2');
    expect(has(tree, 'candidate-photo-next')).toBe(false);
  });

  test('galleryPhotos 규칙: 승인 0장이면 한 쪽(확인 중이 있으면 확인 중 모양), 승인이 있으면 승인 칸만 · 칸 순서 그대로', () => {
    expect(galleryPhotos([])).toEqual([{ slot: 'face', state: 'none', photoId: null }]);
    expect(galleryPhotos([slot('face', 'none'), slot('full', 'none')])).toEqual([{ slot: 'face', state: 'none', photoId: null }]);
    expect(galleryPhotos([slot('face', 'pending'), slot('full', 'pending'), slot('free', 'pending')])).toEqual([{ slot: 'face', state: 'pending', photoId: null }]);
    expect(galleryPhotos([slot('face', 'none'), slot('full', 'pending', 'x')])).toEqual([{ slot: 'face', state: 'pending', photoId: null }]);
    expect(galleryPhotos([slot('face', 'approved', 'p1'), slot('full', 'none'), slot('free', 'pending')]).map((p) => `${p.slot}:${p.state}`)).toEqual(['face:approved']);
    expect(galleryPhotos([slot('face', 'pending'), slot('full', 'approved', 'p2'), slot('free', 'approved', 'p3')]).map((p) => `${p.slot}:${p.state}`)).toEqual(['full:approved', 'free:approved']);
  });
});
