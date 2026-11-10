// QF2-B6 Q2-01 — 왜 이 분인지 카드: 공개 순간 T3(최대 3줄)와 10 상대 프로필(최대 5줄)이 같은 부품 하나를 쓴다.
//  보는 것: 서버가 준 이유 ID 중 줄이 있는 것만 · 서버 순서 그대로 · 이유 0개 / 스위치 꺼짐 / 오류 / 불러오는 중이면 카드째 없음(빈 카드 0) ·
//  돈 · 집안 · 필수 일치(지역 · 종교) 줄은 서버가 걷지만 앱도 그리지 않는다(이중 막기) · 점수 · 등급 · 순위 · 우열 말 0 · 공개 화면과 상대 프로필 양쪽
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { CANDIDATE } from '@/content/copy';
import { WHY, WHY_MAX_PROFILE, WHY_MAX_REVEAL } from '@/content/qf2Copy';
import { parseWeeklyMatch, type BoardingLoad, type BoardingState } from '@/features/boarding/boardingApi';
import { RevealScreen, type RevealDeps } from '@/features/boarding/RevealScreen';
import { createOpenedRounds } from '@/features/boarding/openedRounds';
import { CandidateScreen, type CandidateDeps } from '@/features/recs/CandidateScreen';
import { WhyCard } from '@/features/recs/WhyCard';
import { readReasonIds, WHY_NEVER, whyLines } from '@/features/recs/recsLogic';
import { parseCandidate, type CandidateData } from '@/lib/recsApi';

import { allTexts, has, mount, textOf } from './renderHelpers';

const mockRouter = { setParams: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, gradeApi: { partnerGrade: async () => null }, profileApi: {}, aiApi: {}, authApi: {}, supabase: {} }));
jest.setTimeout(90_000);

const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockParams)) delete mockParams[k];
});
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
});

// 점수 · 등급 · 순위 · 우열 · 퍼센트 · 재촉 · 마음 표현 말 — 카드 글 어디에도 없어야 한다
const BAN = /점수|등급|순위|퍼센트|%|판정|가장|최고|제일|더 |높|낮|상위|하위|서둘|빨리|놓치|설레|마음에 들|[!！]|\d/;
const ALL_IDS = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10', 'F14', 'F15', 'F16', 'E01', 'E02', 'E03', 'E05', 'E06', 'E07'];

// ── 1. 줄 고르기 (순수) ─────────────────────────────────────────────────────
describe('Q2-01 줄 고르기: whyLines · readReasonIds', () => {
  test('줄이 있는 ID 만 · 서버가 준 순서 그대로 · 같은 줄 한 번 · 최대 수에서 자른다', () => {
    expect(whyLines(['E02', 'F01', 'E02', 'E03', 'F02'], 3)).toEqual([WHY.line.E02, WHY.line.F01, WHY.line.E03]);
    expect(whyLines(['F01', 'F02', 'F03', 'F04', 'F08', 'F09', 'F10'], WHY_MAX_PROFILE)).toHaveLength(5);
    expect(whyLines([], 3)).toEqual([]);
    expect(WHY_MAX_REVEAL).toBe(3);
    expect(WHY_MAX_PROFILE).toBe(5);
  });

  test('모르는 ID · 문자열 아닌 값 · 점수처럼 보이는 키는 줄이 없어 저절로 빠진다', () => {
    expect(whyLines(['score', 'grade', 'rank', 'F99', 'E04', 7, null, { score: 9 }, 'F01'], 5)).toEqual([WHY.line.F01]);
  });

  test('이중 막기: 돈 · 집안(F05 F14 F15 F16)과 필수 일치(F06 지역 · F07 종교)는 서버가 보내도 한 줄도 그리지 않는다 — 줄 표에도 없고 막는 목록에도 있다', () => {
    expect([...WHY_NEVER].sort()).toEqual(['F05', 'F06', 'F07', 'F14', 'F15', 'F16']);
    for (const id of WHY_NEVER) expect(Object.keys(WHY.line)).not.toContain(id);
    expect(whyLines(['F05', 'F06', 'F07', 'F14', 'F15', 'F16'], 5)).toEqual([]);
    expect(whyLines(['F06', 'F07', 'F05', 'F01', 'F16', 'E01'], 5)).toEqual([WHY.line.F01, WHY.line.E01]);
    // 줄 표에 누가 잘못 더해도 막는 목록이 이긴다
    const lines = WHY.line as unknown as Record<string, string>;
    lines.F05 = '연봉이 바란 조건에 맞아요.';
    try {
      expect(whyLines(['F05'], 5)).toEqual([]);
    } finally {
      delete lines.F05;
    }
  });

  test('글 규칙: 제목 + 줄 13개 모두 해요체 · 느낌표 0 · 숫자 0 · 점수 · 등급 · 순위 · 우열 · 재촉 말 0 · 체크 표시 0', () => {
    const texts = [WHY.title, ...Object.values(WHY.line)];
    expect(texts).toHaveLength(14);
    expect(Object.keys(WHY.line)).toHaveLength(13);
    for (const t of texts) {
      expect(t).not.toMatch(BAN);
      expect(t).not.toMatch(/[✓✔]/);
    }
    for (const t of Object.values(WHY.line)) expect(t).toMatch(/해요\.$|맞아요\.$/);
    expect(WHY.title).toBe('이 분과 맞는 점');
    expect(CANDIDATE.whyNote).toBe('추천 점수는 보여주지 않아요.'); // 옛 글(v4 길)은 그대로 — 새 카드는 이 문장을 쓰지 않는다(법무 L1 기본값)
    expect(texts).not.toContain(CANDIDATE.whyNote);
  });

  test('서버 응답 읽기: 문자열 ID 만 · 중복 뺌 · 12개까지 / 배열이 아니면 빈 목록', () => {
    expect(readReasonIds(['F01', 'F01', 3, null, 'E02'])).toEqual(['F01', 'E02']);
    expect(readReasonIds(undefined)).toEqual([]);
    expect(readReasonIds('F01')).toEqual([]);
    expect(readReasonIds(Array.from({ length: 30 }, (_, i) => `X${i}`))).toHaveLength(12);
  });

  test('get_weekly_match(matched)의 reasons: 키가 없으면 [] · 점수 키는 읽지 않는다 / get_candidate_profile 의 reasons → reasonIds', () => {
    const base = { state: 'matched', round_no: 1, partner_id: 'u2', room_id: 'c1', partner: { A12: '문OO', A01: 32, A03: { sido: '서울', sigungu: '마포구' } } };
    const none = parseWeeklyMatch(base);
    expect(none).toMatchObject({ kind: 'matched', reasons: [] });
    const some = parseWeeklyMatch({ ...base, reasons: ['F01', 'E02'], score: 88, grade: 3, rank: 1 });
    expect(some).toMatchObject({ kind: 'matched', reasons: ['F01', 'E02'] });
    expect(JSON.stringify(some)).not.toMatch(/score|grade|rank|88/);
    expect(parseWeeklyMatch({ state: 'not_found', round_no: 1, credited: true })).toEqual({ roundNo: 1, kind: 'no_match', reason: null });
    const cand = parseCandidate({ user_id: 'u2', answers: {}, photos: [], reasons: ['F01', 'E02', 'F06'] });
    expect(cand?.reasonIds).toEqual(['F01', 'E02', 'F06']); // 읽기는 거르지 않는다 — 그릴 때 줄 표와 막는 목록이 거른다
    expect(cand?.reasons).toEqual(['나이', '자녀 계획', '지역']); // 옛 칩 이름(v4 길)은 그대로
    expect(parseCandidate({ user_id: 'u2' })?.reasonIds).toEqual([]);
  });
});

// ── 2. 부품 하나 ───────────────────────────────────────────────────────────
describe('WhyCard: 제목 + 줄 · 누르는 곳 0', () => {
  test('줄이 있으면 제목 + 줄(점 하나씩) · 줄이 0개이거나 꺼짐(on=false)이면 카드째 없다', async () => {
    const t = keep(await mount(<WhyCard ids={['F01', 'E02']} max={3} testID="w" />));
    expect(textOf(t, 'w-title')).toBe(WHY.title);
    expect(textOf(t, 'w-line-0')).toBe(WHY.line.F01);
    expect(textOf(t, 'w-line-1')).toBe(WHY.line.E02);
    expect(has(t, 'w-line-2')).toBe(false);
    for (const id of ['w-title', 'w-line-0']) expect(t.root.findAll((n) => n.props.testID === id).some((n) => typeof n.props.onPress === 'function')).toBe(false);
    // 부품이 null 을 그려도 테스트 트리에는 부품 자신이 testID 로 남으므로 '카드째 없음'은 제목 · 줄 · 글이 없는 것으로 본다
    const off = keep(await mount(<WhyCard ids={['F01']} max={3} on={false} testID="w" />));
    expect(has(off, 'w-title')).toBe(false);
    expect(allTexts(off)).toEqual([]);
    const empty = keep(await mount(<WhyCard ids={['F06', 'F07', 'F05']} max={3} testID="w" />));
    expect(has(empty, 'w-title')).toBe(false);
    expect(allTexts(empty)).toEqual([]);
  });
});

// ── 3. 공개 순간 T3 ────────────────────────────────────────────────────────
const MATCH = Date.parse('2026-12-23T18:00:00+09:00');
const stateWith = (reasons: string[]): BoardingState => ({
  now: MATCH + 60_000,
  offset: 0,
  round: { no: 1, matchAt: MATCH, saleOpenAt: Date.parse('2026-12-17T00:00:00+09:00'), saleCloseAt: null },
  phase: 'on_sale',
  regionName: '수도권',
  seat: 'open',
  ticket: { roundNo: 1, boughtAt: MATCH - 86_400_000, paidWith: 'store' },
  credits: 0,
  ineligible: null,
  result: { roundNo: 1, kind: 'matched', partnerId: 'u2', chatId: 'c1', partner: { name: '문OO', age: 32, region: { sido: '서울', sigungu: '마포구' }, facePhotoId: null }, reasons },
  past: [],
});
function revealDeps(load: BoardingLoad | Promise<BoardingLoad>): RevealDeps {
  const opened = createOpenedRounds();
  opened.mark(1); // 이미 열어 본 회차 — 도착 화면 없이 바로 상대 화면
  return { api: { load: async () => load }, photoUrl: async () => null, opened };
}
const okReveal = (reasons: string[]): BoardingLoad => ({ ok: true, state: stateWith(reasons) });
const showReveal = async (load: BoardingLoad, whyOn: boolean | undefined) => {
  const t = keep(await mount(<RevealScreen deps={revealDeps(load)} whyOn={whyOn} />));
  await act(async () => undefined); // 비동기 읽기 한 번 흘려 보냄
  return t;
};

describe('T3 공개 순간: 이름 카드 바로 아래, 최대 3줄', () => {
  test('스위치 켜짐 + 이유 ≥ 1: 제목 + 맞는 점 줄 — 서버 순서 그대로 위에서부터 3줄에서 자름 · 지역 · 종교 · 돈 · 집안 줄 0 · 점수 · 등급 말 0', async () => {
    const t = await showReveal(okReveal(['F06', 'F07', 'F01', 'F05', 'E02', 'E03', 'E01', 'E07']), true);
    expect(textOf(t, 'reveal-why-title')).toBe(WHY.title);
    expect(textOf(t, 'reveal-why-line-0')).toBe(WHY.line.F01);
    expect(textOf(t, 'reveal-why-line-1')).toBe(WHY.line.E02);
    expect(textOf(t, 'reveal-why-line-2')).toBe(WHY.line.E03);
    expect(has(t, 'reveal-why-line-3')).toBe(false);
    const texts = allTexts(t);
    for (const bad of ['연봉', '지역이', '종교', '부모님', '자산']) expect(texts.join(' ')).not.toContain(bad);
    expect(texts.join(' ')).not.toMatch(/점수|등급|순위|퍼센트|%/);
    // 자리: 이름 줄 다음 · [대화 시작하기] 앞
    const at = (s: string) => texts.indexOf(s);
    expect(at('문OO · 32 · 서울 마포구')).toBeGreaterThanOrEqual(0);
    expect(at(WHY.title)).toBeGreaterThan(at('문OO · 32 · 서울 마포구'));
    expect(at(WHY.title)).toBeLessThan(at('대화 시작하기'));
    expect(textOf(t, 'reveal-name')).toBe('문OO · 32 · 서울 마포구');
  });

  test('스위치 꺼짐(live 기본) · whyOn 안 넘김 → 서버가 이유를 줘도 카드 0', async () => {
    const off = await showReveal(okReveal(['F01', 'E02']), false);
    expect(has(off, 'reveal-why')).toBe(false);
    expect(allTexts(off)).not.toContain(WHY.title);
    const none = await showReveal(okReveal(['F01', 'E02']), undefined);
    expect(has(none, 'reveal-why')).toBe(false);
    expect(has(none, 'reveal-chat')).toBe(true); // 카드가 없어도 공개 화면은 그대로 — [대화 시작하기] 눌림
  });

  test('이유 0개 · 그릴 줄이 하나도 없는 이유뿐(지역 · 종교 · 돈 · 집안 · 모르는 ID) → 카드째 없다 · 빈 카드 · "이유 없음" 글 0', async () => {
    for (const reasons of [[], ['F06', 'F07'], ['F05', 'F14', 'F15', 'F16'], ['score', 'F99']]) {
      const t = await showReveal(okReveal(reasons), true);
      expect(has(t, 'reveal-why')).toBe(false);
      expect(allTexts(t).join(' ')).not.toMatch(/이유|없어요|맞는 점이/);
      expect(has(t, 'reveal-chat')).toBe(true);
    }
  });

  test('오류(불러오지 못함) · 불러오는 중에는 카드 0 — 오류 글은 화면 오류 한 줄뿐', async () => {
    const bad = keep(await mount(<RevealScreen deps={revealDeps({ ok: false, reason: 'network' })} whyOn />));
    await act(async () => undefined);
    expect(has(bad, 'reveal-error')).toBe(true);
    expect(has(bad, 'reveal-why')).toBe(false);
    let release!: (l: BoardingLoad) => void;
    const slow = new Promise<BoardingLoad>((r) => (release = r));
    const pending = keep(await mount(<RevealScreen deps={revealDeps(slow)} whyOn />));
    expect(has(pending, 'reveal-why')).toBe(false);
    expect(has(pending, 'reveal-matched')).toBe(false);
    await act(async () => release(okReveal(['F01'])));
  });

  test('못 찾은 회차(no_match)에는 카드 0', async () => {
    const state = stateWith(['F01']);
    const load: BoardingLoad = { ok: true, state: { ...state, result: { roundNo: 1, kind: 'no_match', reason: null } } };
    const t = await showReveal(load, true);
    expect(has(t, 'reveal-why')).toBe(false);
  });
});

// ── 4. 10 상대 프로필 ──────────────────────────────────────────────────────
const detail = (reasonIds: string[], over: Partial<CandidateData> = {}): CandidateData => ({
  id: 'demo-cand-1',
  answers: { A12: '김OO', A01: 32, A03: { sido: '서울', sigungu: '강남구' }, C01: '대기업', B01: '석사', A06: '기독교', A07: '초혼', A09: '비흡연', A05: 178 },
  photos: [{ slot: 'face', state: 'pending', photoId: null }],
  reasons: reasonIds.length > 0 ? ['지역'] : [],
  reasonIds,
  gradeNo: null,
  ...over,
});
function candDeps(data: CandidateData, whyOn: (() => boolean) | undefined): CandidateDeps {
  const api = {
    loadCandidate: jest.fn(async () => ({ ok: true as const, data })),
    pairState: jest.fn(async () => ({ state: 'none' as const, likesLeft: 3 })),
    photoUrl: jest.fn(async () => null),
    pass: jest.fn(),
    sendLike: jest.fn(),
    report: jest.fn(),
    block: jest.fn(),
  } as unknown as CandidateDeps['api'];
  return { api, grade: { partnerGrade: jest.fn(async () => null) }, toastMs: 50, ...(whyOn ? { whyOn } : {}) };
}
const showCand = async (data: CandidateData, whyOn: (() => boolean) | undefined, params: Record<string, string> = { from: 'reveal', chat: 'c1' }) => {
  mockParams.id = 'demo-cand-1';
  Object.assign(mockParams, params);
  return keep(await mount(<CandidateScreen deps={candDeps(data, whyOn)} />));
};

describe('10 상대 프로필(공개 뒤 길 from=reveal): 한 분을 보는 화면에도 같은 카드, 최대 5줄', () => {
  test('스위치 켜짐 + 이유 ≥ 1: 제목 + 맞는 점 줄 최대 5 · 서버 순서 · 지역 · 종교 · 돈 · 집안 줄 0 · 옛 "왜 추천했나요" 박스와 고지 문장 0 · 점수 · 등급 말 0', async () => {
    const t = await showCand(detail(['F06', 'F07', 'F01', 'F02', 'F05', 'F03', 'F04', 'F08', 'F09', 'E01']), () => true);
    expect(textOf(t, 'candidate-whycard-title')).toBe(WHY.title);
    const lines = [0, 1, 2, 3, 4].map((i) => textOf(t, `candidate-whycard-line-${i}`));
    expect(lines).toEqual([WHY.line.F01, WHY.line.F02, WHY.line.F03, WHY.line.F04, WHY.line.F08]);
    expect(has(t, 'candidate-whycard-line-5')).toBe(false);
    expect(has(t, 'candidate-why')).toBe(false);
    const texts = allTexts(t).join(' ');
    expect(texts).not.toContain(CANDIDATE.whyTitle);
    expect(texts).not.toContain(CANDIDATE.whyNote);
    expect(texts).not.toMatch(/연봉이|부모님 학력이|부모님 자산이|자산이 바란|종교[를이가을]|지역[을이가]/);
    expect(texts).not.toMatch(/순위|퍼센트|%|점수|등급/);
    expect(has(t, 'candidate-chat')).toBe(true); // 카드는 설명일 뿐 — 아래 [대화 시작하기]는 그대로
  });

  test('스위치 꺼짐(whyOn=false) → 이유가 와도 카드 0 · 스위치를 못 읽으면(기본) 꺼짐으로 본다', async () => {
    const off = await showCand(detail(['F01', 'E02']), () => false);
    expect(has(off, 'candidate-whycard-title')).toBe(false);
    expect(allTexts(off)).not.toContain(WHY.title);
    const unreadable = await showCand(detail(['F01', 'E02']), undefined); // 시험 환경: 스위치 저장소가 비어 있음 → 꺼짐
    expect(has(unreadable, 'candidate-whycard-title')).toBe(false);
    expect(allTexts(unreadable)).not.toContain(WHY.title);
  });

  test('이유 0개 · 그릴 줄이 없는 이유뿐 → 카드째 없다 · 빈 카드 0', async () => {
    for (const ids of [[], ['F06', 'F07'], ['F05', 'F14', 'F15', 'F16'], ['F99', 'score']]) {
      const t = await showCand(detail(ids), () => true);
      expect(has(t, 'candidate-whycard-title')).toBe(false);
      expect(allTexts(t)).not.toContain(WHY.title);
      expect(has(t, 'candidate-whycard-line-0')).toBe(false);
    }
  });

  test('v4 길(from=reveal 아님, 스위치가 켜졌을 때만 열리는 옛 화면)은 옛 박스 그대로 · 새 카드 0', async () => {
    const t = await showCand(detail(['F01', 'E02'], { reasons: ['나이', '자녀 계획'] }), () => true, {});
    expect(has(t, 'candidate-whycard-title')).toBe(false);
    expect(has(t, 'candidate-why')).toBe(true);
    expect(textOf(t, 'candidate-why-note')).toBe(CANDIDATE.whyNote);
  });

  test('불러오지 못한 프로필(오류)에는 카드 0', async () => {
    mockParams.id = 'demo-cand-1';
    Object.assign(mockParams, { from: 'reveal', chat: 'c1' });
    const deps = candDeps(detail(['F01']), () => true);
    (deps.api.loadCandidate as unknown as jest.Mock).mockResolvedValue({ ok: false, reason: 'network' });
    const t = keep(await mount(<CandidateScreen deps={deps} />));
    expect(has(t, 'candidate-whycard-title')).toBe(false);
  });
});

test('줄 표에 있는 ID 는 정책 2-4 이름표 19개 안에서 필수 일치 · 돈 · 집안 6개를 뺀 13개와 같다', () => {
  const drawable = ALL_IDS.filter((id) => !WHY_NEVER.includes(id));
  expect(drawable).toHaveLength(13);
  expect(Object.keys(WHY.line).sort()).toEqual([...drawable].sort());
});
