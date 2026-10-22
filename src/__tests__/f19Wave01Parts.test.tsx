// F19 1단계 · 통과 조건 3(부품 렌더 · 상호작용) · 4(새 파일만 · 글 키 자리): 오늘의 한 분 강조 표시 · 만남 뒤 피드백 카드 · 시트 · 안심 공유 시트.
//  API · 데모 서버 시험은 f19Wave01Api.test.ts
import fs from 'node:fs';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform, Share, Text } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { COMMON } from '@/content/copy';
import { V4W01 } from '@/content/v4Wave01Copy';
import { FEATURED_CARD_STYLE, FeaturedLabel, featuredA11y } from '@/features/featured/FeaturedMark';
import { MeetFeedbackCard } from '@/features/meetFeedback/MeetFeedbackCard';
import { MeetFeedbackSheet } from '@/features/meetFeedback/MeetFeedbackSheet';
import { canEditNow, toggleMismatch } from '@/features/meetFeedback/meetFeedbackLogic';
import { osShareAvailable, SafeShareSheet, shareWithOs } from '@/features/safeShare/SafeShareSheet';
import { buildShareText, maskedName, SHARE_PLACE_MAX, SHARE_TEXT_MAX } from '@/features/safeShare/safeShareText';
import { createMeetFeedbackApi, type MeetPrompt, type MeetResult } from '@/lib/meetFeedbackApi';
import { createDemoV4 } from '@/lib/v4Demo';
import { colors } from '@/theme/tokens';

import { allTexts, find, has, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 17, 3, 0, 0);
const APP_SRC = path.resolve(__dirname, '..');

// 부품마다 첫 렌더가 react-native 모듈을 처음 불러와서, 다른 시험이 함께 도는 바쁜 기계에서는 30초(package.json 기본)를 넘긴 적이 있다(10-17). 이 파일만 늘린다
jest.setTimeout(180_000);

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined); // safeLog 줄(이벤트 이름 · 코드)만 나온다. 시험 출력에서는 숨긴다
});
afterAll(() => {
  jest.restoreAllMocks();
});

// 점수 · 순위 · 별 모양 평가 · 최상급이 화면 글에 없다(세부청사진 F19 '점수 · 순위 · 별점 글자 0' · K12 1-01 · 1-06 · 2-13).
//  팀장 결정(10-17, F19 보고 뒤): 강조 라벨에 '가장' 등 최상급 금지
const RANKING = /점수|순위|별점|등급|1등|1순위|가장|최고|★|☆/;
const noDigits = (texts: string[]) => texts.filter((t) => /\d/.test(t));

describe('조건 4 · 글 키 자리(B17 확정 전 임시): 모든 글 자리에 키 이름이 그대로 보인다', () => {
  const walk = (node: unknown, at: string, out: [string, unknown][] = []): [string, unknown][] => {
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, at ? `${at}.${k}` : k, out);
    else out.push([at, node]);
    return out;
  };

  test('글은 키 경로와 같고, 값을 넣는 글은 "키(값, 값)" 모양이다', () => {
    const leaves = walk(V4W01, '');
    expect(leaves.length).toBeGreaterThanOrEqual(45);
    for (const [key, value] of leaves) {
      if (typeof value === 'function') expect((value as (...v: unknown[]) => string)('가', 1)).toBe(`${key}(가, 1)`);
      else expect(value).toBe(key);
    }
    expect(V4W01.share.text.plan(null, '강남역')).toBe('share.text.plan(, 강남역)');
  });

  test('서열 · 점수 말 · 느낌표가 글 파일에 없다', () => {
    const source = fs.readFileSync(path.join(APP_SRC, 'content', 'v4Wave01Copy.ts'), 'utf8');
    const code = source.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    expect(code).not.toMatch(RANKING);
    expect(code).not.toMatch(/!['`]/);
  });
});

describe('조건 3 · [1] 오늘의 한 분 강조 표시(불리언 하나)', () => {
  test('featured=true → 라벨(키 자리) 한 줄. 숫자 · 서열 글 없음', async () => {
    const tree = await mount(<FeaturedLabel featured />);
    expect(textOf(tree, 'featured-label-text')).toBe(V4W01.featured.label);
    expect(noDigits(allTexts(tree))).toEqual([]);
    expect(allTexts(tree).filter((t) => RANKING.test(t))).toEqual([]);
    expect(has(tree, 'featured-label-mark')).toBe(false); // 로고 타일 자리는 2단계(F17 뒤)
  });

  test('featured=false → 아무것도 그리지 않는다 · 표시 자리(mark)는 꾸밈이라 스크린리더가 건너뛴다', async () => {
    expect((await mount(<FeaturedLabel featured={false} />)).toJSON()).toBeNull();
    const withMark = await mount(<FeaturedLabel featured mark={<Text>tile</Text>} />);
    expect(must(withMark, 'featured-label-mark').props.importantForAccessibility).toBe('no-hide-descendants');
  });

  test('불리언 밖의 값은 받지 않는다(타입이 막고, 들어와도 그리지 않는다)', async () => {
    // @ts-expect-error 숫자(개수 · 차례)는 받지 않는다
    expect((await mount(<FeaturedLabel featured={1} />)).toJSON()).toBeNull();
    // @ts-expect-error 글자도 받지 않는다
    expect((await mount(<FeaturedLabel featured="true" />)).toJSON()).toBeNull();
  });

  test('강조 카드 면은 accentSoft · 접근성 이름은 이름 줄을 담는다(NF1-02 키 자리)', () => {
    expect(FEATURED_CARD_STYLE).toEqual({ backgroundColor: colors.accentSoft });
    expect(featuredA11y('김OO · 32 · 서울 강남구')).toBe('featured.a11y(김OO · 32 · 서울 강남구)');
  });
});

describe('조건 3 · [2] 만남 뒤 피드백 카드', () => {
  const handlers = () => ({ onAnswer: jest.fn(), onDismiss: jest.fn(), onEdit: jest.fn() });

  test('ask: 제목 · 상대 표기 · 보조 글 · [답하기] · ×(묻지 않기). 누르면 부모에게 알린다', async () => {
    const h = handlers();
    const tree = await mount(<MeetFeedbackCard prompt={{ kind: 'ask', matchId: 'm1', head: '한OO · 서울 강서구' }} now={T0} {...h} />);
    expect(textOf(tree, 'meet-card-title')).toBe(V4W01.meet.cardTitle);
    expect(textOf(tree, 'meet-card-head')).toBe('한OO · 서울 강서구');
    expect(textOf(tree, 'meet-card-sub')).toBe(V4W01.meet.cardSub);
    expect(must(tree, 'meet-card-dismiss').props.accessibilityLabel).toBe(V4W01.meet.dismissA11y);
    await press(tree, 'meet-card-answer');
    await press(tree, 'meet-card-dismiss');
    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
    expect(allTexts(tree).filter((t) => RANKING.test(t))).toEqual([]);
  });

  test('answered: "답해 주셨어요" 한 줄 + [고치기]는 고칠 수 있고 48시간 전일 때만', async () => {
    const answered = (canEdit: boolean): MeetPrompt => ({ kind: 'answered', matchId: 'm1', head: '한OO', canEdit, editableUntil: T0 + 48 * HOUR, answer: { met: 'met', outcome: 'good', mismatch: [] } });
    const h = handlers();
    const tree = await mount(<MeetFeedbackCard prompt={answered(true)} now={T0} {...h} />);
    expect(textOf(tree, 'meet-card-answered-text')).toBe(V4W01.meet.answered);
    await press(tree, 'meet-card-edit');
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(has(await mount(<MeetFeedbackCard prompt={answered(false)} now={T0} {...h} />), 'meet-card-edit')).toBe(false); // 이미 한 번 고침
    expect(has(await mount(<MeetFeedbackCard prompt={answered(true)} now={T0 + 48 * HOUR} {...h} />), 'meet-card-edit')).toBe(false); // 48시간 지남
    expect(canEditNow(answered(true), T0 + 48 * HOUR - 1)).toBe(true);
  });

  test('none · off(스위치 꺼짐) → 카드 자리도 없다(T2-08)', async () => {
    expect((await mount(<MeetFeedbackCard prompt={{ kind: 'none' }} now={T0} {...handlers()} />)).toJSON()).toBeNull();
    expect((await mount(<MeetFeedbackCard prompt={{ kind: 'off' }} now={T0} {...handlers()} />)).toJSON()).toBeNull();
  });
});

describe('조건 3 · [2] 만남 뒤 피드백 시트: 만났나요 → 좋음/보통/아쉬움 → 아쉬움이면 최대 3개 · 별점 0', () => {
  const setup = async (submit: (id: string, a: unknown) => Promise<MeetResult>, initial: Parameters<typeof MeetFeedbackSheet>[0]['initial'] = null) => {
    const api = { submit: jest.fn(submit) };
    const h = { onClose: jest.fn(), onDone: jest.fn(), onReport: jest.fn(), onGone: jest.fn() };
    const tree = await mount(<MeetFeedbackSheet visible matchId="m1" head="한OO · 서울 강서구" initial={initial} api={api} {...h} />);
    const seen: string[] = [];
    const look = () => seen.push(...allTexts(tree).filter((t) => t !== '한OO · 서울 강서구'));
    return { tree, api, h, seen, look };
  };
  const checked = (tree: ReactTestRenderer, id: string) => must(tree, id).props.accessibilityState?.checked === true;
  const chipOn = (tree: ReactTestRenderer, code: string) => must(tree, `meet-sheet-chip-${code}`).props.variant === 'selected';

  test('아직 만나지 않았어요 → [보내기] → 만났나만 보낸다(어땠나 · 달랐던 점 없음)', async () => {
    const { tree, api, h, look, seen } = await setup(async () => ({ ok: true }));
    expect(isOpen(tree, 'meet-sheet')).toBe(true);
    expect(textOf(tree, 'meet-sheet-title')).toBe(V4W01.meet.cardTitle);
    expect(must(tree, 'meet-sheet-primary').props.disabled).toBe(true); // 고르기 전에는 막힘
    look();
    await press(tree, 'meet-sheet-met-not_yet');
    expect(checked(tree, 'meet-sheet-met-not_yet')).toBe(true);
    expect(must(tree, 'meet-sheet-primary').props.label).toBe(V4W01.meet.send);
    await press(tree, 'meet-sheet-primary');
    expect(api.submit).toHaveBeenCalledWith('m1', { met: 'not_yet', outcome: null, mismatch: [] });
    expect(h.onDone).toHaveBeenCalledTimes(1);
    look();
    expect(seen.filter((t) => RANKING.test(t))).toEqual([]);
    expect(noDigits(seen)).toEqual([]);
  });

  test('만났어요 → [다음] → 기대와 달랐어요 → 칩 21개 중 최대 3개 · 불편했어요를 고르면 신고 안내(자동 신고 아님) → 보낸다', async () => {
    const { tree, api, h, look, seen } = await setup(async () => ({ ok: true }));
    await press(tree, 'meet-sheet-met-met');
    expect(must(tree, 'meet-sheet-primary').props.label).toBe(V4W01.meet.next);
    await press(tree, 'meet-sheet-primary');
    expect(api.submit).not.toHaveBeenCalled();
    expect(textOf(tree, 'meet-sheet-title')).toBe(V4W01.meet.howTitle);
    expect(has(tree, 'meet-sheet-chips')).toBe(false); // 기대와 달랐을 때만 칩
    await press(tree, 'meet-sheet-how-off');
    expect(textOf(tree, 'meet-sheet-mismatch-guide')).toBe(V4W01.meet.mismatchGuide);
    expect(must(tree, 'meet-sheet-chips').findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('meet-sheet-chip-') && n.props.variant !== undefined)).toHaveLength(21);
    for (const code of ['F06', 'uncomfortable', 'E02', 'E07']) await press(tree, `meet-sheet-chip-${code}`);
    expect(['F06', 'uncomfortable', 'E02'].every((c) => chipOn(tree, c))).toBe(true);
    expect(chipOn(tree, 'E07')).toBe(false); // 4번째는 무시
    expect(textOf(tree, 'meet-sheet-report-note')).toBe(V4W01.meet.reportNote);
    look();
    await press(tree, 'meet-sheet-report');
    expect(h.onReport).toHaveBeenCalledTimes(1);
    expect(api.submit).not.toHaveBeenCalled(); // 신고 안내를 눌러도 답이 저절로 가지 않는다
    await press(tree, 'meet-sheet-chip-F06'); // 다시 누르면 빠진다
    await press(tree, 'meet-sheet-chip-E07');
    await press(tree, 'meet-sheet-primary');
    expect(api.submit).toHaveBeenCalledWith('m1', { met: 'met', outcome: 'off', mismatch: ['uncomfortable', 'E02', 'E07'] });
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(seen.filter((t) => RANKING.test(t))).toEqual([]);
    expect(noDigits(seen)).toEqual([]);
  });

  test('신고 안내는 프로필과 달랐어요 · 불편했어요를 고른 때만 · 좋았어요로 바꾸면 달랐던 점은 보내지 않는다', async () => {
    const { tree, api } = await setup(async () => ({ ok: true }));
    await press(tree, 'meet-sheet-met-met');
    await press(tree, 'meet-sheet-primary');
    await press(tree, 'meet-sheet-how-off');
    await press(tree, 'meet-sheet-chip-F06');
    expect(has(tree, 'meet-sheet-report-box')).toBe(false);
    await press(tree, 'meet-sheet-chip-profile_diff');
    expect(has(tree, 'meet-sheet-report-box')).toBe(true);
    await press(tree, 'meet-sheet-how-good');
    expect(has(tree, 'meet-sheet-chips')).toBe(false);
    await press(tree, 'meet-sheet-primary');
    expect(api.submit).toHaveBeenCalledWith('m1', { met: 'met', outcome: 'good', mismatch: [] });
    expect(toggleMismatch(['F06', 'E02', 'E03'], 'E05')).toEqual(['F06', 'E02', 'E03']);
    expect(toggleMismatch([], 'nope')).toEqual([]);
  });

  test('고치기: 내 답을 채워 연다 · 48시간이 지났거나 이미 고쳤으면(edit_window_closed) 잠김 글 · [보내기] 막힘', async () => {
    const { tree, api } = await setup(async () => ({ ok: false, reason: 'edit_closed' }), { met: 'met', outcome: 'ok', mismatch: [] });
    expect(checked(tree, 'meet-sheet-met-met')).toBe(true);
    await press(tree, 'meet-sheet-primary');
    expect(checked(tree, 'meet-sheet-how-ok')).toBe(true);
    await press(tree, 'meet-sheet-how-good');
    await press(tree, 'meet-sheet-primary');
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(textOf(tree, 'meet-sheet-locked')).toBe(V4W01.meet.editLocked);
    expect(must(tree, 'meet-sheet-primary').props.disabled).toBe(true);
    await press(tree, 'meet-sheet-primary');
    expect(api.submit).toHaveBeenCalledTimes(1);
  });

  test('인터넷 문제 → 기존 공통 글 · 그 밖 실패 → 저장 실패 키 · 스위치 꺼짐 · 끊긴 쌍 → 부모가 카드를 거둔다', async () => {
    const net = await setup(async () => ({ ok: false, reason: 'network' }));
    await press(net.tree, 'meet-sheet-met-declined');
    await press(net.tree, 'meet-sheet-primary');
    expect(textOf(net.tree, 'meet-sheet-error')).toBe(COMMON.offline);
    const server = await setup(async () => ({ ok: false, reason: 'server' }));
    await press(server.tree, 'meet-sheet-met-declined');
    await press(server.tree, 'meet-sheet-primary');
    expect(textOf(server.tree, 'meet-sheet-error')).toBe(V4W01.meet.saveFailed);
    for (const reason of ['off', 'unavailable'] as const) {
      const s = await setup(async () => ({ ok: false, reason }));
      await press(s.tree, 'meet-sheet-met-not_yet');
      await press(s.tree, 'meet-sheet-primary');
      expect(s.h.onGone).toHaveBeenCalledWith(reason);
    }
  });

  test('같은 버튼을 두 번 눌러도 요청은 한 번(R9)', async () => {
    let release: (r: MeetResult) => void = () => undefined;
    const { tree, api } = await setup(() => new Promise<MeetResult>((r) => (release = r)));
    await press(tree, 'meet-sheet-met-not_yet');
    const node = must(tree, 'meet-sheet-primary');
    await act(async () => {
      node.props.onPress();
      node.props.onPress();
    });
    await act(async () => release({ ok: true }));
    expect(api.submit).toHaveBeenCalledTimes(1);
  });

  test('데모 서버와 끝까지: 카드 → 답 → 답한 줄 · [고치기] 1번 → 다시 열면 [고치기] 없음', async () => {
    let t = T0;
    const v4 = createDemoV4({ now: () => t });
    const user = { id: 'u-parts', email: 'plain@email.co' };
    const client = { rpc: (name: string, args?: Record<string, unknown>) => v4.rpc(user, name, args ?? {}) } as unknown as SupabaseClient;
    const api = createMeetFeedbackApi(client);
    const first = await api.prompt();
    expect(first.kind).toBe('ask');
    if (first.kind !== 'ask') return;
    const onDone = jest.fn();
    const sheet = await mount(<MeetFeedbackSheet visible matchId={first.matchId} head={first.head} api={api} onClose={jest.fn()} onDone={onDone} onReport={jest.fn()} />);
    await press(sheet, 'meet-sheet-met-met');
    await press(sheet, 'meet-sheet-primary');
    await press(sheet, 'meet-sheet-how-good');
    await press(sheet, 'meet-sheet-primary');
    expect(onDone).toHaveBeenCalledTimes(1);
    t = T0 + HOUR;
    const answered = await api.prompt();
    const card = await mount(<MeetFeedbackCard prompt={answered} now={t} onAnswer={jest.fn()} onDismiss={jest.fn()} onEdit={jest.fn()} />);
    expect(has(card, 'meet-card-edit')).toBe(true);
    if (answered.kind !== 'answered') return;
    const edit = await mount(<MeetFeedbackSheet visible matchId={answered.matchId} head={answered.head} initial={answered.answer} api={api} onClose={jest.fn()} onDone={onDone} onReport={jest.fn()} />);
    expect(checked(edit, 'meet-sheet-met-met')).toBe(true);
    await press(edit, 'meet-sheet-primary');
    expect(checked(edit, 'meet-sheet-how-good')).toBe(true);
    await press(edit, 'meet-sheet-how-ok');
    await press(edit, 'meet-sheet-primary');
    expect(onDone).toHaveBeenCalledTimes(2);
    const after = await api.prompt();
    expect(after).toMatchObject({ kind: 'answered', canEdit: false, answer: { outcome: 'ok' } });
    expect(has(await mount(<MeetFeedbackCard prompt={after} now={t} onAnswer={jest.fn()} onDismiss={jest.fn()} onEdit={jest.fn()} />), 'meet-card-edit')).toBe(false);
  });
});

describe('조건 3 · [3] 안심 공유: 문장 만들기(순수 함수)', () => {
  const base = { when: '', place: '', memo: '', includePartner: false, partner: { name: '박OO', age: 29 } };

  test('칸이 비면 빈 값 · 모두 채우면 순서대로 · 상대 정보는 스위치를 켠 때만', () => {
    expect(buildShareText(base)).toBe('share.text.head share.text.plan(, ) share.text.closing');
    const full = buildShareText({ ...base, when: '10월 20일 저녁 7시', place: '강남역 카페', memo: '9시쯤 끝나요', includePartner: true });
    expect(full).toBe('share.text.head share.text.plan(10월 20일 저녁 7시, 강남역 카페) share.text.partner(박OO, 29) share.text.closing share.text.memo(9시쯤 끝나요)');
    expect(buildShareText({ ...base, includePartner: false })).not.toContain('박OO');
    expect(buildShareText({ ...base, includePartner: true, partner: null })).not.toContain('share.text.partner');
  });

  test('상대 정보는 성+OO · 나이 둘뿐: 이름 전체가 들어와도 가리고, 사진 · 연락처 · 학교 같은 값은 자리가 없다', () => {
    const leaky = { name: '박서준', age: 29, face_photo_id: 'demo-ph-1-face', phone: '010-1234-5678', school: '한국대학교', income: '7천만~1억 원' } as unknown as { name: string; age: number };
    const text = buildShareText({ ...base, includePartner: true, partner: leaky });
    expect(text).toContain('share.text.partner(박OO, 29)');
    for (const leak of ['서준', 'demo-ph', '010', '한국대학교', '7천만']) expect(text).not.toContain(leak);
    expect(maskedName('  김OO ')).toBe('김OO');
    expect(maskedName('')).toBeNull();
    expect(buildShareText({ ...base, includePartner: true, partner: { name: '박OO', age: 7 } })).toContain('share.text.partner(박OO, )'); // 이상한 나이는 넣지 않는다
  });

  test('500자 이하: 칸은 글자 수에서 자르고, 넘으면 메모를 먼저 빼고 그래도 넘으면 자른다', () => {
    const long = buildShareText({ ...base, when: '가'.repeat(100), place: '나'.repeat(100), memo: '다'.repeat(100), includePartner: true });
    expect(Array.from(long).length).toBeLessThanOrEqual(SHARE_TEXT_MAX);
    expect(long).toContain(`${'나'.repeat(SHARE_PLACE_MAX)})`);
    expect(long).not.toContain('나'.repeat(SHARE_PLACE_MAX + 1));
    const plan = { ...base, place: '강남역', memo: '메모입니다' };
    const withMemo = buildShareText(plan);
    const noMemo = buildShareText({ ...plan, memo: '' });
    expect(buildShareText(plan, Array.from(withMemo).length - 1)).toBe(noMemo); // 넘으면 메모부터 뺀다
    expect(Array.from(buildShareText(plan, 20))).toHaveLength(20);
  });
});

describe('조건 3 · [3] 안심 공유 시트: RN 내장 Share · 서버 저장 0 · 상대 정보 처음값 꺼짐', () => {
  const g = globalThis as { fetch?: unknown };
  let fetchSpy: jest.Mock;
  let xhrSpy: jest.SpyInstance | null = null;
  beforeEach(() => {
    fetchSpy = jest.fn();
    g.fetch = fetchSpy;
    const proto = (globalThis as unknown as { XMLHttpRequest?: { prototype?: { open?: unknown } } }).XMLHttpRequest?.prototype;
    xhrSpy = proto && typeof proto.open === 'function' ? jest.spyOn(proto as { open: () => void }, 'open') : null;
  });
  afterEach(() => {
    xhrSpy?.mockRestore();
  });
  const noNetwork = () => {
    expect(fetchSpy).not.toHaveBeenCalled();
    if (xhrSpy) expect(xhrSpy).not.toHaveBeenCalled();
  };
  const partner = { name: '박OO', age: 29 };

  test('처음: 빈 칸 · 상대 정보 꺼짐(미리보기에 상대 없음) → 켜면 성+OO · 나이만 들어간다', async () => {
    const tree = await mount(<SafeShareSheet visible partner={partner} onClose={jest.fn()} share={jest.fn()} copy={jest.fn()} canShare />);
    expect(textOf(tree, 'share-sheet-title')).toBe(V4W01.share.title);
    expect(textOf(tree, 'share-sheet-notice')).toBe(V4W01.share.notice);
    expect(must(tree, 'share-sheet-partner').props.accessibilityState).toEqual({ checked: false });
    expect(textOf(tree, 'share-sheet-preview')).not.toContain('박OO');
    await press(tree, 'share-sheet-partner');
    expect(must(tree, 'share-sheet-partner').props.accessibilityState).toEqual({ checked: true });
    expect(textOf(tree, 'share-sheet-preview')).toContain('share.text.partner(박OO, 29)');
    expect(allTexts(tree).filter((t) => RANKING.test(t))).toEqual([]);
  });

  test('[공유하기] → 미리보기 문장 그대로 공유창에. 네트워크 요청 0 (T3-01)', async () => {
    const share = jest.fn(async () => 'shared' as const);
    const copy = jest.fn(async () => true);
    const tree = await mount(<SafeShareSheet visible partner={partner} onClose={jest.fn()} share={share} copy={copy} canShare />);
    await typeInto(tree, 'share-sheet-when', '10월 20일 저녁 7시');
    await typeInto(tree, 'share-sheet-place', '강남역 카페');
    await typeInto(tree, 'share-sheet-memo', '9시쯤 끝나요');
    const preview = textOf(tree, 'share-sheet-preview');
    expect(preview).toBe('share.text.head share.text.plan(10월 20일 저녁 7시, 강남역 카페) share.text.closing share.text.memo(9시쯤 끝나요)');
    await press(tree, 'share-sheet-share');
    expect(share).toHaveBeenCalledWith(preview);
    expect(has(tree, 'share-sheet-status')).toBe(false);
    await press(tree, 'share-sheet-copy');
    expect(copy).toHaveBeenCalledWith(preview);
    expect(textOf(tree, 'share-sheet-status')).toBe(V4W01.share.copied);
    noNetwork();
  });

  test('기본 공유는 RN 내장 Share.share(message) · 공유창 실패면 안내 글 + [문장 복사]는 그대로', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const tree = await mount(<SafeShareSheet visible partner={null} onClose={jest.fn()} copy={jest.fn()} canShare />);
    await press(tree, 'share-sheet-share');
    expect(spy).toHaveBeenCalledWith({ message: textOf(tree, 'share-sheet-preview') });
    spy.mockRejectedValueOnce(new Error('no share'));
    await press(tree, 'share-sheet-share');
    expect(textOf(tree, 'share-sheet-status')).toBe(V4W01.share.shareFailed);
    expect(has(tree, 'share-sheet-copy')).toBe(true);
    spy.mockResolvedValueOnce({ action: Share.dismissedAction });
    expect(await shareWithOs('x')).toBe('dismissed');
    spy.mockRestore();
    noNetwork();
  });

  test('닫으면 입력이 사라지고 다시 열면 빈 칸 · 꺼짐에서 시작한다(기기 저장 0)', async () => {
    const onClose = jest.fn();
    const props = { partner, onClose, share: jest.fn(), copy: jest.fn(), canShare: true };
    const tree = await mount(<SafeShareSheet visible {...props} />);
    await typeInto(tree, 'share-sheet-place', '강남역');
    await press(tree, 'share-sheet-partner');
    await press(tree, 'share-sheet-scrim');
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<SafeShareSheet visible={false} {...props} />));
    await act(async () => tree.update(<SafeShareSheet visible {...props} />));
    expect(must(tree, 'share-sheet-place').props.value).toBe('');
    expect(must(tree, 'share-sheet-partner').props.accessibilityState).toEqual({ checked: false });
    expect(textOf(tree, 'share-sheet-preview')).toBe('share.text.head share.text.plan(, ) share.text.closing');
  });

  test('공유창을 못 여는 곳(웹 · navigator.share 없음) → [공유하기] 없이 [문장 복사]만 · 상대가 없으면 상대 정보 줄도 없다', async () => {
    const tree = await mount(<SafeShareSheet visible partner={null} onClose={jest.fn()} share={jest.fn()} copy={jest.fn()} canShare={false} />);
    expect(has(tree, 'share-sheet-share')).toBe(false);
    expect(must(tree, 'share-sheet-copy').props.variant).toBe('primary');
    expect(find(tree, 'share-sheet-partner')).toBeNull();
    expect(Platform.OS).not.toBe('web');
    expect(osShareAvailable()).toBe(true); // 앱(iOS · Android)은 늘
    expect(osShareAvailable('web', undefined)).toBe(false);
    expect(osShareAvailable('web', {})).toBe(false);
    expect(osShareAvailable('web', { share: () => undefined })).toBe(true);
  });
});

describe('조건 4 · 새 파일 정적 점검(척추 마디 2 · 3)', () => {
  const NEW_FILES = [
    'content/v4Wave01Copy.ts',
    'lib/featureFlagsApi.ts',
    'lib/featuredApi.ts',
    'lib/meetFeedbackApi.ts',
    'lib/v4Demo.ts',
    'features/featured/featuredLogic.ts',
    'features/featured/FeaturedMark.tsx',
    'features/meetFeedback/meetFeedbackLogic.ts',
    'features/meetFeedback/MeetFeedbackCard.tsx',
    'features/meetFeedback/MeetFeedbackSheet.tsx',
    'features/safeShare/safeShareText.ts',
    'features/safeShare/SafeShareSheet.tsx',
  ];
  const read = (rel: string) => fs.readFileSync(path.join(APP_SRC, ...rel.split('/')), 'utf8');
  const codeOnly = (text: string) => text.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/.*$/, '')).join('\n');

  test('새 파일이 모두 있고, 점수 · 순위 영어 이름(score · rating · rank) · 등급 말이 어디에도 없다', () => {
    for (const file of NEW_FILES) {
      const text = read(file);
      expect(text).not.toMatch(/score|rating|rank|grade/i);
      expect(codeOnly(text)).not.toMatch(/점수|순위|별점|등급/);
    }
  });

  test('안심 공유 파일은 서버 · 위치 · 저장 · 로그에 닿지 않는다(T3-01 · T3-04 · 3-08)', () => {
    for (const file of ['features/safeShare/safeShareText.ts', 'features/safeShare/SafeShareSheet.tsx']) {
      const code = codeOnly(read(file));
      expect(code).not.toMatch(/supabase|fetch\(|XMLHttpRequest|@\/lib\/|safeLog|Location|geolocation|AsyncStorage|SecureStore|localStorage|sessionStorage/);
    }
  });

  test('만남 뒤 피드백은 알림 · 배지 경로가 없다(T2-03)', () => {
    for (const file of ['lib/meetFeedbackApi.ts', 'features/meetFeedback/MeetFeedbackCard.tsx', 'features/meetFeedback/MeetFeedbackSheet.tsx', 'features/meetFeedback/meetFeedbackLogic.ts', 'lib/v4Demo.ts']) {
      expect(codeOnly(read(file))).not.toMatch(/expo-notifications|Notifications|setBadge|scheduleNotification/);
    }
  });
});
