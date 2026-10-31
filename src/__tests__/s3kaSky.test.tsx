// 3부-카 ③ IF3-F 축소판 — G-02 창밖 하늘 · G-03 하늘 도감 · G-04 사랑하는 방식 · 말하는 방식 · G-07 생일 주간 엽서 (G-01 · 05 · 06 은 IF5-F)
//  기준: 정책 PG장(PG-03 · 03a · 04 · 06 · 21 ~ 22 · 31 ~ 33 · 41 ~ 43 · 71 ~ 72 · 93) · 카피 22장 · 백엔드 0046(get_my_ways · get_my_birth_week) · 열람 기록 · 모으기 · 본 표시 · 푸시 0
//  서버 대신 가짜 응답을 같은 파서로 읽는다. 기기 저장 0
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { act, type ReactTestRenderer } from 'react-test-renderer';

import { FEATURE_KEYS } from '@/config/featureKeys';
import { IF3_TEXT, SIGN_CUSP, t3 } from '@/content/if3Copy';
import lib from '@/content/if3Library.json';
import { SkyBookScreen } from '@/features/inflight/SkyBookScreen';
import { createInflightApi, parseBirthWeek, parseMyWays, type Magazine } from '@/features/inflight/inflightApi';
import { birthdayQuestions, bookCards, bookSigns, mdText, mercuryText, planetNotice, signNameOf, skyLine, skyMoonArt, skyWeekOf, venusText } from '@/features/inflight/if3Logic';
import { MagazineScreen } from '@/features/inflight/MagazineScreen';
import { tx } from '@/features/inflight/if2Text';
import sky from '@/content/skyWeeks.json';

import { APP_DIR, describeOutside } from './helpers/outsideDocs';
import { allTexts, has, isOpen, mount, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: () => undefined, Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
const mockForced = jest.fn();
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: (on: boolean) => mockForced(on) }));

jest.setTimeout(60_000);

const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockRouter.push.mockClear();
  mockForced.mockClear();
});

// ── 글 · 하늘표 · 사본 ──────────────────────────────────────────────────────
describe('IF3 사본: 카피 22장 41키 · 라이브러리 · 하늘표 · 그림 — 손으로 옮기지 않는다', () => {
  describeOutside(['마케팅/카피.md', 'ai/IF3/문구_라이브러리3.json', 'ai/IF3/하늘표_2027_2028.json', '디자인/IF3/원본/moon_full.svg'])('원본과 같음', () => {
    const run = (script: string) => execFileSync(process.execPath, [path.join(APP_DIR, 'scripts', script), '--check'], { cwd: APP_DIR, encoding: 'utf8' });
    test('gen-if3-copy --check (if3Copy.ts = 카피 22장)', () => expect(run('gen-if3-copy.mjs')).toContain('최신'));
    test('gen-if3-assets --check (라이브러리 · 하늘표 · 그림 사본)', () => expect(run('gen-if3-assets.mjs')).toContain('최신'));
  });

  test('3부-카 키 41 + IF5-F1 22장 남은 36(READ_GUIDE 5 · THREE_PILLARS 22 · MEET_SKY 9) + 22-14 네 키 = 81 + 3부-차 SIGN_CUSP 2', () => {
    const keys = Object.keys(IF3_TEXT);
    expect(keys).toHaveLength(81);
    const heads = new Set(keys.map((k) => k.split('.')[0]));
    expect([...heads].sort()).toEqual(['BIRTH_CARD', 'FUN', 'MEET_SKY', 'MY_WAYS', 'READ_GUIDE', 'SKY_BOOK', 'SKY_WEEK', 'THREE_PILLARS', 'TYPE_CARD']);
    expect(keys.filter((k) => k.startsWith('TYPE_CARD.'))).toEqual(['TYPE_CARD.state.none', 'TYPE_CARD.state.featureOff', 'TYPE_CARD.state.forbidden']);
    expect(IF3_TEXT['MY_WAYS.loadFailed']).toBe('풀이를 불러오지 못했어요. 다시 시도해 주세요.');
    expect(Object.keys(SIGN_CUSP)).toEqual(['pair', 'why']);
  });

  test('MY_WAYS.note = 라이브러리 planet_notice(글자 같음) · 조사 채우기', () => {
    expect(planetNotice()).toBe(IF3_TEXT['MY_WAYS.note']);
    expect(t3('SKY_BOOK.a11y.sign', { '별자리 이름': '양자리', 시기: '3월 21일 ~ 4월 19일', 뜻: '글' })).toBe('양자리, 3월 21일 ~ 4월 19일, 글');
  });

  test('하늘표: 104호 · 매 호 목 ~ 수 · 달 모양 0 ~ 7 · 사건 최대 1 · 절기 최대 1 · 표 첫 호 2027-01-07', () => {
    expect(sky.weeks).toHaveLength(104);
    expect(sky.weeks[0].issue).toBe('2027-01-07');
    for (const w of sky.weeks) {
      expect(new Date(`${w.issue}T00:00:00Z`).getUTCDay()).toBe(4); // 목요일
      expect(w.stage).toBeGreaterThanOrEqual(0);
      expect(w.stage).toBeLessThanOrEqual(7);
      expect(w.events.length).toBeLessThanOrEqual(1);
      expect(w.terms.length).toBeLessThanOrEqual(1);
    }
  });

  test('모든 서비스 이름 · 금지 낱말 · 숫자 0 — 라이브러리 완결 문장(달 · 절기 · 도감 · 금성 · 수성 · 생일 질문)', () => {
    const texts = [
      ...lib.moonEvent.map((x) => x.text),
      ...lib.moonStage.map((x) => x.text),
      ...lib.moonAlt.map((x) => x.text),
      ...lib.termFrame.map((x) => x.text),
      ...lib.terms.map((x) => x.text),
      ...lib.dogamSigns.map((x) => x.text),
      ...lib.dogamCards.map((x) => x.meaning),
      ...lib.venus.map((x) => x.text),
      ...lib.mercury.map((x) => x.text),
      ...lib.birthdayQuestions.map((x) => x.text),
    ];
    for (const t of texts) {
      expect(t).not.toMatch(/[!！]/);
      expect(t).not.toMatch(/운세|점수|순위|퍼센트|대운|용신|상극|행운|반드시|운명|조심/);
    }
  });
});

describe('G-02 창밖 하늘 규칙 — 표를 찾기만 한다(앱 안 천문 계산 0)', () => {
  test('호 찾기: 발행 목요일 · 그 주 안의 날 · 표 밖 · 이상한 글은 칸째 없음', () => {
    expect(skyWeekOf('2027-01-07')?.end).toBe('2027-01-13');
    expect(skyWeekOf('2027-01-10')?.issue).toBe('2027-01-07');
    expect(skyWeekOf('2028-12-28')?.end).toBe('2029-01-03');
    expect(skyWeekOf('2026-12-17')).toBeNull();
    expect(skyWeekOf('2029-01-04')).toBeNull();
    expect(skyWeekOf(null)).toBeNull();
    expect(skyWeekOf('abc')).toBeNull();
  });
  test('날짜 글 "1월 20일" 꼴 · 호 날짜 범위', () => {
    expect(mdText('2027-01-20')).toBe('1월 20일');
    expect(skyLine(skyWeekOf('2027-01-14')!).period).toBe('1월 14일 ~ 1월 20일');
  });
  test('104호 모두: 달 줄이 있고 · {…} 자리 0 · 숫자 0 · 절기가 든 주만 절기 줄(절기 이름 포함) · 달 그림 번호 0 ~ 7', () => {
    for (const w of sky.weeks) {
      const s = skyLine(w);
      expect(s.moon.length).toBeGreaterThan(10);
      expect(s.line).not.toMatch(/[{}]/);
      expect(s.line).not.toMatch(/\d/);
      expect(s.line).not.toMatch(/[!！]/);
      if (w.terms.length) expect(s.term).toContain(w.terms[0].name);
      else expect(s.term).toBeNull();
      expect(skyMoonArt(w)).toBeGreaterThanOrEqual(0);
      expect(skyMoonArt(w)).toBeLessThanOrEqual(7);
    }
  });
  test('글 변형은 호 번호 홀 · 짝(첫 호 = 1 → v1, 둘째 호 = v2) · 회원 값 0', () => {
    expect(skyLine(sky.weeks[0]).moon).toBe('이번 주 금요일은 삭이에요. 달이 해와 같은 쪽에 있어 밤하늘에서 보이지 않아요.');
    expect(skyLine(sky.weeks[1]).moon).toBe('이번 주 토요일에 달이 상현을 지나요. 오른쪽 반이 밝은 반달이에요.');
    expect(skyLine(sky.weeks[1]).term).toBe('이번 주에는 수요일에 절기 대한이 들어 있어요. 대한은 큰 추위라는 뜻의 이름이에요.');
  });
  test('사건 없는 주는 목요일 저녁 달 모양 글 · 칸 경계(alt)면 경계 글을 더함(표에는 아직 0건 — 합성 값으로)', () => {
    const w = { ...sky.weeks[0], events: [], stage: 2, alt: 3 as unknown as null };
    const s = skyLine(w);
    expect(s.moon.startsWith('목요일 저녁에는 오른쪽 반이 밝은 상현달이')).toBe(true);
    expect(s.moon).toContain('상현달과 차오르는 달 사이로 봐 주세요.');
    expect(skyMoonArt(w)).toBe(2);
  });
});

describe('G-03 도감 · G-04 · G-07 규칙', () => {
  test('별자리 열두 칸: 달력 차례(물병자리부터) · 이름 · 때 · 원소 · 성질 · 글 / 카드 스물두 장 전통 차례', () => {
    const signs = bookSigns();
    expect(signs.map((s) => s.name)).toEqual(['물병자리', '물고기자리', '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리', '천칭자리', '전갈자리', '사수자리', '염소자리']);
    expect(signs[0]).toMatchObject({ code: 'aquarius', start: '1월 20일', end: '2월 18일', element: '공기 원소', quality: '머무는 칸' });
    expect(signs[2]).toMatchObject({ element: '불 원소', quality: '시작하는 칸' });
    expect(new Set(signs.map((s) => `${s.element}|${s.quality}`)).size).toBe(12);
    for (const s of signs) expect(s.text.length).toBeGreaterThan(10);
    const cards = bookCards();
    expect(cards).toHaveLength(22);
    expect(cards[0].name).toBe('길 떠나는 사람');
  });
  test('금성 · 수성 글은 별자리 코드 12개 모두에서 찾아지고 이름으로 시작한다', () => {
    for (const s of lib.codes.signs) {
      expect(venusText(s.code)?.startsWith(s.name)).toBe(true);
      expect(mercuryText(s.code)?.startsWith(s.name)).toBe(true);
      expect(signNameOf(s.code)).toBe(s.name);
    }
    expect(venusText('nope')).toBeNull();
  });
  test('생일 질문 묶음 = (발행 해 mod 4) + 1 — 한 호에 모두 같음 · 해마다 다름 · 셋 · 날짜 없으면 0', () => {
    const q = (iso: string) => birthdayQuestions(iso);
    expect(q('2027-05-06')).toHaveLength(3);
    expect(q('2027-05-06')).toEqual(lib.birthdayQuestions.filter((x) => x.set === 4).map((x) => x.text));
    expect(q('2028-05-04')).toEqual(lib.birthdayQuestions.filter((x) => x.set === 1).map((x) => x.text));
    expect(q('2029-05-03')).not.toEqual(q('2028-05-04'));
    expect(q('2027-01-14')).toEqual(q('2027-12-30'));
    expect(birthdayQuestions(null)).toEqual([]);
  });
});

// ── 응답 읽기 ───────────────────────────────────────────────────────────────
describe('get_my_ways · get_my_birth_week 응답 읽기(0046)', () => {
  test('ready / none / 모르는 모양 · 별자리 코드 12 밖 · 날짜 · 나이 키는 읽지 않는다', () => {
    expect(parseMyWays({ ok: true, state: 'ready', venus: 'leo', mercury: 'virgo', born: '1997-03-12', age: 29 })).toEqual({ state: 'ready', venus: 'leo', mercury: 'virgo' });
    expect(parseMyWays({ ok: true, state: 'none' })).toEqual({ state: 'none' });
    for (const bad of [null, [], {}, { state: 'ready' }, { state: 'ready', venus: 'leo' }, { state: 'ready', venus: 'leo', mercury: 'sun' }]) expect(parseMyWays(bad)).toBeNull();
    expect(parseBirthWeek({ ok: true, state: 'ready', birthday_week: true, birth: '03-12' })).toEqual({ state: 'ready', birthdayWeek: true });
    expect(parseBirthWeek({ ok: true, state: 'ready', birthday_week: false })).toEqual({ state: 'ready', birthdayWeek: false });
    expect(parseBirthWeek({ ok: true, state: 'none' })).toEqual({ state: 'none' });
    for (const bad of [null, {}, { state: 'ready' }, { state: 'ready', birthday_week: 'yes' }]) expect(parseBirthWeek(bad)).toBeNull();
  });
  test('API: 인자 없는 호출 한 번 · consent_required · not_ready 는 서버 코드 그대로 · feature_off(42501)는 off', async () => {
    const seen: [string, unknown][] = [];
    const mk = (res: { data: unknown; error: { code?: string; message?: string } | null }) => createInflightApi(async (fn, args) => (seen.push([fn, args]), res as never));
    const ok = await mk({ data: { ok: true, state: 'ready', venus: 'aries', mercury: 'taurus' }, error: null }).myWays();
    expect(ok).toEqual({ ok: true, data: { state: 'ready', venus: 'aries', mercury: 'taurus' } });
    expect(seen).toEqual([['get_my_ways', {}]]);
    expect(await mk({ data: { ok: false, code: 'consent_required' }, error: null }).myWays()).toEqual({ ok: false, code: 'consent_required' });
    expect(await mk({ data: { ok: false, code: 'not_ready' }, error: null }).birthWeek()).toEqual({ ok: false, code: 'not_ready' });
    expect(await mk({ data: null, error: { code: '42501', message: 'feature_off' } }).myWays()).toEqual({ ok: false, code: 'off' });
    expect(await mk({ data: { ok: true, state: 'ready', venus: 'zzz', mercury: 'leo' }, error: null }).myWays()).toEqual({ ok: false, code: 'server' });
    await mk({ data: { ok: true, state: 'none' }, error: null }).birthWeek();
    expect(seen.at(-1)).toEqual(['get_my_birth_week', {}]);
  });
  test('스위치 7개: 처음 꺼짐(live) 키 이름이 서버 0046 과 같다', () => {
    for (const k of ['read_guide', 'sky_week', 'sky_book', 'my_ways', 'three_pillars', 'meet_sky', 'birth_card']) expect(FEATURE_KEYS).toContain(k);
  });
});

// ── 기내지 화면 ─────────────────────────────────────────────────────────────
const issued = (over: Partial<Extract<Magazine, { state: 'issued' }>> = {}): Magazine => ({
  state: 'issued',
  issueDate: '2027-01-14',
  tripNo: 3,
  weekElement: 'wood',
  column: null,
  ck17a: true,
  sky: { signs: ['capricorn'], zodiacs: ['zw-capricorn-t01-v0'] },
  grain: { stem: 0, saju: 'sw-0-wood-v1', relation: 'same' },
  ...over,
});

type Reply<T> = { ok: true; data: T } | { ok: false; code: string };
function makeDeps(opts: { mag?: Magazine; on?: string[]; ways?: () => Promise<Reply<unknown>>; birth?: () => Promise<Reply<unknown>> } = {}) {
  const myWays = jest.fn(opts.ways ?? (async () => ({ ok: true as const, data: { state: 'ready' as const, venus: 'leo', mercury: 'virgo' } })));
  const birthWeek = jest.fn(opts.birth ?? (async () => ({ ok: true as const, data: { state: 'ready' as const, birthdayWeek: true } })));
  const on = new Set(opts.on ?? ['sky_week', 'my_ways', 'birth_card', 'sky_book']);
  const api = {
    magazine: async () => ({ ok: true as const, data: opts.mag ?? issued() }),
    weekCard: async () => ({ ok: true as const, data: { state: 'none' as const } }),
    pickWeekCard: async () => ({ ok: false as const, code: 'none' }),
    preQuestions: async () => ({ ok: true as const, data: { state: 'none' as const, questions: [] } }),
    myWays: myWays as never,
    birthWeek: birthWeek as never,
  };
  const ck17 = { load: async () => ({ ok: true as const, data: { a: false, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
  return { deps: { api, ck17, isOn: (k: string) => on.has(k) }, myWays, birthWeek, ck17 };
}
const open = async (d: ReturnType<typeof makeDeps>) => {
  const tree = keep(await mount(<MagazineScreen deps={d.deps as never} />));
  await wait();
  await press(tree, 'mag-next'); // ① 하늘과 결
  return tree;
};

describe('기내지 ① 쪽 G-02 창밖 하늘 · G-04 사랑하는 방식', () => {
  test('스위치가 모두 꺼지면 두 칸 모두 0 · 서버 호출 0 (실서버 처음값)', async () => {
    const d = makeDeps({ on: [] });
    const tree = await open(d);
    expect(has(tree, 'sky-week')).toBe(false);
    expect(has(tree, 'ways')).toBe(false);
    expect(d.myWays).not.toHaveBeenCalled();
  });

  test('창밖 하늘: 칸 머리 · 안내 · 날짜 범위 · 달 줄 · 절기 줄 — 한 칸 한 포커스 읽기 이름 · 숫자(날짜 밖) 0', async () => {
    const tree = await open(makeDeps());
    expect(textOf(tree, 'sky-week-title')).toBe('창밖 하늘');
    expect(textOf(tree, 'sky-week-lead')).toBe(IF3_TEXT['SKY_WEEK.lead']);
    expect(textOf(tree, 'sky-week-period')).toBe('1월 14일 ~ 1월 20일');
    const w = skyWeekOf('2027-01-14')!;
    expect(textOf(tree, 'sky-week-moon-line')).toBe(skyLine(w).moon);
    expect(textOf(tree, 'sky-week-term-line')).toBe(skyLine(w).term);
    const card = tree.root.findAll((n) => n.props.testID === 'sky-week')[0];
    expect(card.props.accessibilityLabel).toBe(`창밖 하늘, ${skyLine(w).line}`);
    expect(has(tree, 'sky-week-moon')).toBe(true);
    // 끝줄은 ① 쪽 FUN.footer 가 덮는다(접힘 밖)
    expect(allTexts(tree)).toContain(tx('FUN.footer'));
  });

  test('창밖 하늘은 동의(CK17A) 꺼짐에도 보인다 + 아래 1.0 꺼짐 안내 · 사랑하는 방식 접힘 0 / 표 밖 호 · 날짜 없음은 칸째 없음', async () => {
    const off = await open(makeDeps({ mag: issued({ ck17a: false, sky: null, grain: null }) }));
    expect(has(off, 'sky-week')).toBe(true);
    expect(has(off, 'mag-ck17-off')).toBe(true);
    expect(has(off, 'ways')).toBe(false);
    const out = await open(makeDeps({ mag: issued({ issueDate: '2026-12-17' }) }));
    expect(has(out, 'sky-week')).toBe(false);
    const none = await open(makeDeps({ mag: issued({ issueDate: null }) }));
    expect(has(none, 'sky-week')).toBe(false);
  });

  test('사랑하는 방식: 닫힌 채 시작 · 열 때만 서버 한 번 · 사랑 · 말 두 칸 같은 틀 · 같은 안내 한 줄 · 나만 보는 화면 · 캡처 막기 켬 · 접으면 값을 비움', async () => {
    const d = makeDeps();
    const tree = await open(d);
    expect(textOf(tree, 'ways-title')).toBe('사랑하는 방식 · 말하는 방식');
    expect(allTexts(tree)).toContain('나만 봐요');
    expect(has(tree, 'ways-body')).toBe(false);
    expect(d.myWays).not.toHaveBeenCalled();
    expect(mockForced).not.toHaveBeenCalledWith(true);
    await press(tree, 'ways-toggle');
    await wait();
    expect(d.myWays).toHaveBeenCalledTimes(1);
    expect(textOf(tree, 'ways-lead')).toBe(IF3_TEXT['MY_WAYS.lead']);
    expect(textOf(tree, 'ways-love-text')).toBe(venusText('leo'));
    expect(textOf(tree, 'ways-talk-text')).toBe(mercuryText('virgo'));
    expect(textOf(tree, 'ways-love-title')).toBe('사랑하는 방식');
    expect(textOf(tree, 'ways-talk-title')).toBe('말하는 방식');
    expect(textOf(tree, 'ways-note')).toBe(planetNotice());
    expect(textOf(tree, 'ways-mine')).toBe('나만 보는 화면이에요.');
    const love = tree.root.findAll((n) => n.props.testID === 'ways-love')[0];
    expect(love.props.accessibilityLabel).toBe(`사랑하는 방식, ${venusText('leo')}`);
    expect(mockForced).toHaveBeenCalledWith(true);
    // 경계 날 두 별자리 함께 · 또는 · 대표 · 숫자 0 — 별자리는 칸마다 하나
    const texts = allTexts(tree).join(' ');
    expect(texts).not.toContain('또는');
    expect(new Set(ids(tree, /^ways-(love|talk)$/)).size).toBe(2);
    await press(tree, 'ways-toggle');
    expect(has(tree, 'ways-body')).toBe(false);
    expect(allTexts(tree)).not.toContain(venusText('leo'));
    await press(tree, 'ways-toggle'); // 펼침을 기억하지 않는다 → 다시 열면 다시 부름
    await wait();
    expect(d.myWays).toHaveBeenCalledTimes(2);
  });

  test('consent_required → 같은 틀 안내 + [동의하고 보기] (누를 때만 동의 시트) / not_ready → 불러오지 못함 + 다시 시도 / none → 줄째 없음 / 금성 · 수성 값 없음', async () => {
    const consent = await open(makeDeps({ ways: async () => ({ ok: false, code: 'consent_required' }) }));
    await press(consent, 'ways-toggle');
    await wait();
    expect(allTexts(consent)).toContain(IF3_TEXT['MY_WAYS.off.body']);
    expect(isOpen(consent, 'if2-ck17')).toBe(false);
    await press(consent, 'ways-agree');
    expect(isOpen(consent, 'if2-ck17')).toBe(true);
    expect(mockForced).not.toHaveBeenCalledWith(true);

    let n = 0;
    const failed = await open(makeDeps({ ways: async () => (n++ === 0 ? { ok: false, code: 'not_ready' } : { ok: true, data: { state: 'ready', venus: 'leo', mercury: 'leo' } }) }));
    await press(failed, 'ways-toggle');
    await wait();
    expect(allTexts(failed)).toContain(IF3_TEXT['MY_WAYS.loadFailed']); // 22-14: 기내지는 이미 떠 있고 이 칸만 실패 — '기내지를 불러오지 못했어요'가 아니다
    expect(allTexts(failed)).not.toContain(tx('MAGAZINE.loadFailed'));
    await press(failed, 'ways-retry');
    await wait();
    expect(has(failed, 'ways-love')).toBe(true);

    const none = await open(makeDeps({ ways: async () => ({ ok: true, data: { state: 'none' } }) }));
    await press(none, 'ways-toggle');
    await wait();
    expect(has(none, 'ways')).toBe(false);
  });
});

const ids = (tree: ReactTestRenderer, re: RegExp): string[] => tree.root.findAll((n) => typeof n.props.testID === 'string' && re.test(n.props.testID)).map((n) => n.props.testID as string);

describe('기내지 ④ 쪽 G-07 생일 주간 엽서 · 뒤표지 하늘 도감 길', () => {
  const toQuestion = async (d: ReturnType<typeof makeDeps>) => {
    const tree = keep(await mount(<MagazineScreen deps={d.deps as never} />));
    await wait();
    for (let i = 0; i < 4; i += 1) await press(tree, 'mag-next'); // 표지 → ① ② ③ ④
    await wait();
    return tree;
  };

  test('④ 쪽에 닿기 전엔 서버를 부르지 않는다 · 닿으면 한 번 · 생일 주면 질문 셋(읽기만) + 끝줄 둘 + 나만 보는 화면 · 캡처 막기 켬', async () => {
    const d = makeDeps();
    const tree = keep(await mount(<MagazineScreen deps={d.deps as never} />));
    await wait();
    await press(tree, 'mag-next');
    expect(d.birthWeek).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i += 1) await press(tree, 'mag-next');
    await wait();
    expect(d.birthWeek).toHaveBeenCalledTimes(1);
    expect(textOf(tree, 'birth-kicker')).toBe('생일이 든 주예요. 축하해요.');
    expect(textOf(tree, 'birth-title')).toBe('생일 주간 엽서');
    expect(textOf(tree, 'birth-heading')).toBe('한 해를 돌아봐요');
    const qs = birthdayQuestions('2027-01-14');
    expect(qs).toHaveLength(3);
    qs.forEach((q, i) => expect(textOf(tree, `birth-q-${i}`)).toBe(q));
    expect(textOf(tree, 'birth-end')).toBe('이 엽서는 이번 호까지만 나와요.');
    expect(allTexts(tree)).toContain('일반적인 이야기예요. 상담이나 진단이 아니에요.');
    expect(textOf(tree, 'birth-note')).toBe('나만 보는 화면이에요.');
    // 쪽 맨 아래 재미 끝줄은 그대로
    expect(allTexts(tree)).toContain(tx('FUN.footer'));
    expect(mockForced).toHaveBeenCalledWith(true);
    // 읽기만: 입력 칸 · 쓰기 · 저장 단추 0
    expect(ids(tree, /^birth-.*(input|write|save)/)).toEqual([]);
    expect(tree.root.findAll((n) => n.props.testID?.toString().startsWith('birth') && typeof n.props.onChangeText === 'function')).toHaveLength(0);
    await press(tree, 'mag-prev');
    await press(tree, 'mag-next');
    expect(d.birthWeek).toHaveBeenCalledTimes(1); // 다시 와도 부르지 않는다
  });

  test('생일 주가 아니면 · none · 오류 · 표 밖 발행일이어도 칸째 없음(빈 상태 글 · 오류 글 0)', async () => {
    for (const birth of [
      async () => ({ ok: true as const, data: { state: 'ready' as const, birthdayWeek: false } }),
      async () => ({ ok: true as const, data: { state: 'none' as const } }),
      async () => ({ ok: false as const, code: 'not_ready' }),
    ]) {
      const tree = await toQuestion(makeDeps({ birth }));
      expect(has(tree, 'birth')).toBe(false);
      expect(allTexts(tree).join(' ')).not.toContain('생일');
    }
    const nodate = await toQuestion(makeDeps({ mag: issued({ issueDate: null }) }));
    expect(has(nodate, 'birth')).toBe(false);
  });

  test('스위치 birth_card 꺼짐 → 서버 호출 0 · 카드 0', async () => {
    const d = makeDeps({ on: ['sky_week'] });
    const tree = await toQuestion(d);
    expect(has(tree, 'birth')).toBe(false);
    expect(d.birthWeek).not.toHaveBeenCalled();
  });

  test('뒤표지: sky_book 켜짐 → [하늘 도감 보기] 한 줄(푸시 · 점 · 새 표시 0) → /sky-book / 꺼짐 → 0', async () => {
    const goBack = async (d: ReturnType<typeof makeDeps>) => {
      const tree = keep(await mount(<MagazineScreen deps={d.deps as never} />));
      await wait();
      for (let i = 0; i < 6; i += 1) await press(tree, 'mag-next');
      return tree;
    };
    const on = await goBack(makeDeps());
    expect(has(on, 'mag-book')).toBe(true);
    expect(allTexts(on)).toContain('하늘 도감 보기');
    await press(on, 'mag-book');
    expect(mockRouter.push).toHaveBeenCalledWith('/sky-book');
    const off = await goBack(makeDeps({ on: [] }));
    expect(has(off, 'mag-book')).toBe(false);
  });
});

// ── 하늘 도감 화면 ──────────────────────────────────────────────────────────
describe('IF-BOOK 하늘 도감(G-03)', () => {
  test('안내 · 별자리 열두 칸(달력 차례 · 이름 · 때) · 카드 스물두 장(이름 · 뜻) · 끝 · 끝줄 둘 — 서버 호출 0', async () => {
    const tree = keep(await mount(<SkyBookScreen />));
    await wait();
    expect(textOf(tree, 'book-lead')).toBe('별자리와 카드에 담긴 이야기를 실었어요. 처음부터 모두 열려 있어요.');
    expect(textOf(tree, 'book-sign-note')).toBe(IF3_TEXT['SKY_BOOK.signNote']);
    expect(textOf(tree, 'book-card-note')).toBe(IF3_TEXT['SKY_BOOK.cardNote']);
    const signs = bookSigns();
    signs.forEach((s, i) => {
      expect(textOf(tree, `book-sign-${i}-name`)).toBe(s.name);
      expect(textOf(tree, `book-sign-${i}-period`)).toBe(`${s.start} ~ ${s.end}`);
    });
    expect(new Set(ids(tree, /^book-sign-\d+$/)).size).toBe(12);
    expect(new Set(ids(tree, /^book-card-\d+$/)).size).toBe(22);
    const cards = bookCards();
    expect(textOf(tree, 'book-card-0-name')).toBe(cards[0].name);
    expect(textOf(tree, 'book-card-21-meaning')).toBe(cards[21].meaning);
    expect(textOf(tree, 'book-end')).toBe('도감은 여기까지예요.');
    expect(allTexts(tree)).toContain(tx('FUN.footer'));
    expect(allTexts(tree)).toContain('이 화면의 글은 생성형 AI로 미리 써 두었어요.');
    // 내 별자리 표시 · 모으기 · 본 표시 · 번호 · 순위 · 공유 · 정렬 · 검색 0
    const all = allTexts(tree).join(' ');
    expect(all).not.toMatch(/모았|완성|잠금|순위|번호|공유|복사|저장|검색|정렬|내 별자리/);
    expect(ids(tree, /share|copy|save|sort|search|filter/i)).toEqual([]);
  });

  test('별자리 칸을 누르면 펼침(한 번에 하나) · 원소 · 성질 · 글 / 닫기 → 뒤로 / 다시 열면 모두 닫힌 채(기억 0)', async () => {
    const tree = keep(await mount(<SkyBookScreen />));
    await wait();
    expect(has(tree, 'book-sign-0-body')).toBe(false);
    await press(tree, 'book-sign-0');
    expect(textOf(tree, 'book-sign-0-kind')).toBe('공기 원소 · 머무는 칸');
    expect(has(tree, 'book-sign-0-body')).toBe(true);
    await press(tree, 'book-sign-2');
    expect(has(tree, 'book-sign-0-body')).toBe(false);
    expect(textOf(tree, 'book-sign-2-kind')).toBe('불 원소 · 시작하는 칸');
    await press(tree, 'book-sign-2');
    expect(has(tree, 'book-sign-2-body')).toBe(false);
    await press(tree, 'book-close');
    expect(mockRouter.back).toHaveBeenCalled();
    const again = keep(await mount(<SkyBookScreen />));
    await wait();
    expect(ids(again, /^book-sign-\d+-body$/)).toEqual([]);
  });

  test('별자리 칸 읽기 이름 = {별자리 이름}, {시기}, {뜻} · 카드 = {카드 이름}, {뜻} (칸 하나 한 포커스)', async () => {
    const tree = keep(await mount(<SkyBookScreen />));
    await wait();
    const s = bookSigns()[0];
    const cell = tree.root.findAll((n) => n.props.testID === 'book-sign-0')[0];
    expect(cell.props.accessibilityLabel).toBe(`${s.name}, ${s.start} ~ ${s.end}, ${s.text}`);
    const c = bookCards()[0];
    const card = tree.root.findAll((n) => n.props.testID === 'book-card-0')[0];
    expect(card.props.accessibilityLabel).toBe(`${c.name}, ${c.meaning}`);
  });
});
