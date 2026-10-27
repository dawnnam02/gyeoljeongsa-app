// V6-F 대화형 설문 — 화면 없는 규칙: 입력 행동 숫자 6개(한글 조합 · 붙여넣기 · CK16 없으면 0) · 문구 변형 고정 · 받아 주는 말 · 조사 · 스위치 · 1부 대화 줄 · 서버 응답 읽기
import { CHAT_V6 } from '@/content/surveyChatCopy';
import { createSurveyChatApi, readSummary } from '@/features/surveyChat/api';
import { behaviorPayload, BEHAVIOR_KEYS, createMeter, graphemes, NULL_BEHAVIOR } from '@/features/surveyChat/behavior';
import { ackKind, ackText, euro, fill, givenName, pick, slotFallback, slotName } from '@/features/surveyChat/copy';
import { buildPart1, currentQuestion, part1List } from '@/features/surveyChat/model';
import { surveyChatOn } from '@/features/surveyChat/switch';
import { FLAGS_FALLBACK, parseFlags } from '@/lib/featureFlagsApi';
import type { SupabaseClient } from '@supabase/supabase-js';

jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/lib/log', () => ({ safeLog: jest.fn() }));

// 한글 → 조합 단계(초성 → 초성+중성 → 받침까지) — 웹 입력기 · 안드로이드 키보드가 칸에 넣는 값 흉내
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function steps(ch: string): string[] {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return [ch];
  const cho = Math.floor(code / 588);
  const open = String.fromCharCode(0xac00 + cho * 588 + Math.floor((code % 588) / 28) * 28);
  return code % 28 ? [CHO[cho], open, ch] : [CHO[cho], open];
}
// 글을 조합 단계마다 칸 값으로 흘린다(조합 중 값도 그대로 알린다 — TextField 와 같음)
function typeHangul(meter: ReturnType<typeof createMeter>, clock: { t: number }, base: string, text: string, msPerStep = 120): string {
  let acc = base;
  for (const ch of text) {
    for (const s of steps(ch)) {
      clock.t += msPerStep;
      meter.change(acc + s);
    }
    acc += ch;
  }
  return acc;
}

describe('입력 행동 숫자 6개(행동지표.md 1 · 2 · 3장)', () => {
  const rig = () => {
    const clock = { t: 1000 };
    const meter = createMeter(() => clock.t);
    meter.shown();
    return { clock, meter };
  };

  test('보이는 글자 수: 조합된 음절 · 이모지 하나 · 줄바꿈 제외 · 공백 포함', () => {
    expect(graphemes('안녕')).toBe(2);
    expect(graphemes('안\n녕 ')).toBe(3);
    expect(graphemes('ㅎ')).toBe(1);
    expect(graphemes('하')).toBe(1);
  });

  test("'안녕하세요 반가워요'를 조합하며 지우지 않고 치면 지운 비율 0 · 6개 모두 숫자", () => {
    const { clock, meter } = rig();
    clock.t += 2000; // AI 말이 나오고 2초 뒤 첫 글자
    const text = typeHangul(meter, clock, '', '안녕하세요 반가워요');
    clock.t += 500;
    const b = meter.finish(text);
    expect(b.delete_ratio_pm).toBe(0);
    expect(b.first_key_ms).toBe(2120);
    expect(b.pauses_3s).toBe(0);
    expect(b.rewrites).toBe(0);
    expect(b.compose_ms).toBeGreaterThan(0);
    expect(b.chars_per_sec_x10).toBeGreaterThan(0);
    for (const k of BEHAVIOR_KEYS) expect(typeof b[k]).toBe('number');
  });

  test('조합 중 자모 지움(한 → 하)은 지움이 아니고, 끝 두 글자를 지웠다 다시 치면 지운 글자 2', () => {
    const { clock, meter } = rig();
    let text = typeHangul(meter, clock, '', '반가워요');
    // 조합 중 받침 하나 지움: 요 → 욧 → 요 (글자 수 같음)
    clock.t += 100;
    meter.change('반가워욧');
    clock.t += 100;
    meter.change('반가워요');
    // 끝 두 글자 지움 → 다시 침
    clock.t += 100;
    meter.change('반가워');
    clock.t += 100;
    meter.change('반가');
    text = typeHangul(meter, clock, '반가', '워요');
    const b = meter.finish(text);
    // 지운 2 ÷ (보낸 4 + 지운 2) × 1000
    expect(b.delete_ratio_pm).toBe(333);
  });

  test('3초 넘는 멈춤을 세고, 멈춘 시간은 초당 글자에서 뺀다', () => {
    const { clock, meter } = rig();
    let text = typeHangul(meter, clock, '', '오늘은');
    clock.t += 5000;
    text = typeHangul(meter, clock, text, ' 쉬어요');
    const b = meter.finish(text);
    expect(b.pauses_3s).toBe(1);
  });

  test('10글자 넘게 썼다가 2글자 이하로 지우고 다시 쓰면 다시 쓴 수 1', () => {
    const { clock, meter } = rig();
    const long = typeHangul(meter, clock, '', '주말에는 집에서 쉬어요');
    expect(graphemes(long)).toBeGreaterThanOrEqual(10);
    clock.t += 100;
    meter.change('주');
    const text = typeHangul(meter, clock, '주', '말엔 산책해요');
    expect(meter.finish(text).rewrites).toBe(1);
  });

  test('한 번에 5글자 넘게 들어오면(붙여넣기 · 음성) 그 메시지는 6개 모두 null, 다음 메시지는 다시 잰다', () => {
    const { clock, meter } = rig();
    clock.t += 100;
    meter.change('주말에는 집에서 쉬어요');
    expect(meter.finish('주말에는 집에서 쉬어요')).toEqual(NULL_BEHAVIOR);
    meter.shown();
    const text = typeHangul(meter, clock, '', '네 좋아요');
    expect(meter.finish(text).delete_ratio_pm).toBe(0);
  });

  test('AI 말이 나오기 전(이어하기 중이던 메시지)은 재지 않는다 · 5글자 미만이면 초당 글자만 null', () => {
    const clock = { t: 0 };
    const meter = createMeter(() => clock.t);
    meter.change('안녕');
    expect(meter.finish('안녕')).toEqual(NULL_BEHAVIOR);
    meter.shown();
    const text = typeHangul(meter, clock, '', '네네');
    const b = meter.finish(text);
    expect(b.chars_per_sec_x10).toBeNull();
    expect(b.delete_ratio_pm).toBe(0);
  });

  test('1분 넘게 백그라운드면 그 메시지는 null · 짧게 나갔다 오면 그 시간은 입력 시간에서 뺀다', () => {
    const { clock, meter } = rig();
    let text = typeHangul(meter, clock, '', '오늘');
    meter.background(false);
    clock.t += 30_000;
    meter.background(true);
    text = typeHangul(meter, clock, text, '은 쉬어요');
    const b = meter.finish(text);
    expect(b.compose_ms).toBeLessThan(30_000);
    expect(b.pauses_3s).toBe(0);
    meter.shown();
    const t2 = typeHangul(meter, clock, '', '네');
    meter.background(false);
    clock.t += 61_000;
    meter.background(true);
    expect(meter.finish(t2)).toEqual(NULL_BEHAVIOR);
  });

  test('CK16 동의가 없으면 보낼 값 자체가 없다(undefined) · 동의자 6개 모두 null 이면 null', () => {
    const b = { ...NULL_BEHAVIOR, first_key_ms: 10 };
    expect(behaviorPayload(false, b)).toBeUndefined();
    expect(behaviorPayload(true, NULL_BEHAVIOR)).toBeNull();
    expect(behaviorPayload(true, b)).toBe(b);
  });

  test('키 하나하나 기록 0: 계산기 코드에 배열 · 목록 저장이 없다(카운터만)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'features', 'surveyChat', 'behavior.ts'), 'utf8');
    const body = src.slice(src.indexOf('export function createMeter'), src.indexOf('export function behaviorPayload'));
    expect(body).not.toMatch(/\.push\(|: \w+\[\] =|new Array|new Map|new Set|localStorage|AsyncStorage|setItem/);
  });
});

describe('문구 고르기 · 채우기(V6-K 0장)', () => {
  test('AI 말 변형은 회원 ID 로 고정(다시 열어도 같은 말) · 문항마다 2~3개 안에서', () => {
    const a = pick('CHAT.A02', 'user-1');
    expect(pick('CHAT.A02', 'user-1')).toBe(a);
    expect([CHAT_V6['CHAT.A02.1'], CHAT_V6['CHAT.A02.2'], CHAT_V6['CHAT.A02.3']]).toContain(a);
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pick('CHAT.A02', `u${i}`)));
    expect(seen.size).toBeGreaterThan(1); // 사람마다 다르게
  });

  test("조사 '으로/로'는 받침으로 · 이름은 성을 뗀다", () => {
    expect(euro('서울 마포구')).toBe('로');
    expect(euro('서울 강남구')).toBe('로');
    expect(euro('서울 종로')).toBe('로');
    expect(euro('연세대학교')).toBe('로');
    expect(euro('경기 성남시 분당')).toBe('으로');
    expect(fill('{지역}으로 적어 둘게요.', { 지역: '서울 강남구' })).toBe('서울 강남구로 적어 둘게요.');
    expect(fill('{지역}으로 적어 둘게요.', { 지역: '부산 북구 덕천' })).toBe('부산 북구 덕천으로 적어 둘게요.');
    expect(givenName('한서윤')).toBe('서윤');
    expect(givenName('김하')).toBe('김하');
  });

  test('받아 주는 말은 답 종류로만 고른다(값 평가 0)', () => {
    expect(ackKind('A05', 165, {})).toBe('t1');
    expect(ackKind('A05', 205, {})).toBe('t2');
    expect(ackKind('A06', 'other', {})).toBe('t1');
    expect(ackKind('C05', null, {})).toBe('decline');
    expect(ackKind('C05', 'inc08', { C01: 'student' })).toBe('t2');
    expect(ackKind('F05', 'any', {})).toBe('any_ok');
    expect(ackKind('F08', ['any'], {})).toBe('any'); // D-199: F07(any_ok) 삭제 — F08 은 '상관없어요' 받아 주는 말이 any
    expect(ackKind('B03', undefined, {})).toBe('skip');
    expect(ackKind('D08', 'unknown', {})).toBe('unknown');
    expect(ackText('A05', 165, {}, { n: '165' }, 'u')).toBe('165cm로 적어 둘게요.');
    expect(ackText('A12', '김하나', {}, { 이름: '하나' }, 'u')).toBe('하나 님, 반가워요. 이어서 몇 가지 더 여쭤볼게요.');
  });

  test('2부 칸 이름 · 예비 질문은 서버 칸 키로 찾는다', () => {
    expect(slotName('family')).toBe('가족과 관계');
    expect(slotName('partner')).toBe('바라는 사람');
    expect(slotFallback('conflict')).toBe(CHAT_V6['CHAT.SLOT.conflict.fallback']);
    expect(slotName(null)).toBeNull();
  });

  test("글 434개에 느낌표 · 등급 · 점수 말 0(예외: CHAT.A06.why '등급에는 쓰지 않아요.' — 기획 QPP, 쓰지 않는다는 안내)", () => {
    const bad = Object.entries(CHAT_V6).filter(([k, t]) => /[!！]|등급|점수/.test(k === 'CHAT.A06.why' ? t.split('등급에는 쓰지 않아요.').join('') : t));
    expect(bad).toEqual([]);
    expect(Object.keys(CHAT_V6).length).toBeGreaterThanOrEqual(428); // D-199: CHAT.F07.* 6줄 뺌
  });
});

describe('1부 대화 줄(설문 v2 문항 · 보임 그대로)', () => {
  test('인터뷰가 있으면 T01~T03 은 1부에서 빠진다 · 처음 물을 문항은 이름', () => {
    expect(part1List({}, true).some((q) => ['T01', 'T02', 'T03'].includes(q.id))).toBe(false);
    expect(part1List({}, false).some((q) => q.id === 'T01')).toBe(true);
    expect(currentQuestion({}, true, [])?.id).toBe('A12');
    const v = buildPart1({}, { userKey: 'u', interview: true, skipped: [], pol: 'off', schoolName: () => null });
    expect(v.ask && v.ask !== 'POL' ? v.ask.id : v.ask).toBe('A12');
    expect(v.lines[0]).toMatchObject({ kind: 'ai', badge: true });
    expect(v.lines.map((l) => l.key)).toEqual(['first', 'sec-start-basic', 'q-A12']);
  });

  test('답한 문항은 내 답 말풍선 · 섹션이 바뀌면 끝 줄 → 구분 줄 → 시작 줄 · 선택 문항은 건너뛴 것으로', () => {
    const a = { A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165, A06: 'none', A07: 'never', A08: 'none', A11: 'na', B01: 'univ' } as const;
    const v = buildPart1(a, { userKey: 'u', interview: true, skipped: [], pol: 'off', schoolName: () => null });
    expect(v.ask && v.ask !== 'POL' ? v.ask.id : null).toBe('B02');
    const keys = v.lines.map((l) => l.key);
    expect(keys).toEqual(expect.arrayContaining(['me-A12', 'sec-end-basic', 'topic-edu', 'sec-start-edu', 'me-B01', 'q-B02']));
    expect(keys.indexOf('sec-end-basic')).toBeLessThan(keys.indexOf('topic-edu'));
    expect(v.lines.find((l) => l.key === 'ack-A03')?.kind === 'ai' ? (v.lines.find((l) => l.key === 'ack-A03') as { text: string }).text : null).toBe('서울 강남구로 적어 둘게요.');
    expect(currentQuestion({ ...a, B02: 'unlisted_kr', B06: 'grad', B07: 'no' }, true, ['B03'])?.id).toBe('B04');
  });
});

describe('스위치 survey_chat · 서버 응답 읽기', () => {
  const flagsWith = (chat: boolean, v2 = true) => parseFlags({ flags: { survey_chat: chat, survey_v2: v2 } });
  test('서버 값을 따르고(설문 v2 가 켜져 있을 때만) · 못 읽으면 데모 켜짐 · 실제 꺼짐', () => {
    expect(surveyChatOn(flagsWith(true), false)).toBe(true);
    expect(surveyChatOn(flagsWith(false), true)).toBe(false);
    expect(surveyChatOn(flagsWith(true, false), true)).toBe(false);
    expect(surveyChatOn(FLAGS_FALLBACK, true)).toBe(true);
    expect(surveyChatOn(FLAGS_FALLBACK, false)).toBe(false);
  });

  test('요약: 사실 칸은 글 · {text} 둘 다 받고, 이야기하는 방식은 아는 코드만(숫자 0)', () => {
    const s = readSummary({ status: 'done', summary: { text: '요약' }, reason: '이유', facts: { T01: { text: '소개 글', turns: [1] }, T02: '결혼 글', X: 'x', T04: '' }, edited: { facts: { T01: '고친 소개' } }, style_chips: ['warm', 'fast', 3], pace_used: true });
    expect(s).toMatchObject({ status: 'done', summary: '요약', reason: '이유', facts: { T01: '소개 글', T02: '결혼 글' }, edited: { facts: { T01: '고친 소개' } }, styleChips: ['warm'], paceUsed: true });
    expect(readSummary({ off: true })).toBeNull();
  });

  test('CK16 동의 없음 → 턴 요청에 behavior 키 자체가 없다 · 있으면 숫자 6개만 · turn 번호', async () => {
    const bodies: unknown[] = [];
    const client = { functions: { invoke: async (_n: string, o: { body: unknown }) => (bodies.push(o.body), { data: { ok: true, reply: { seq: 2, slot: 'family', text: '다음', source: 'model' }, turn: 1, turns_left: 24, done: false }, error: null }) } } as unknown as SupabaseClient;
    const api = createSurveyChatApi(client);
    await api.turn(1, '안녕', undefined);
    await api.turn(1, '안녕', { ...NULL_BEHAVIOR, first_key_ms: 1 }, 2);
    expect(Object.keys(bodies[0] as object).sort()).toEqual(['action', 'session_id', 'text']);
    expect((bodies[1] as { turn: number }).turn).toBe(2); // 몇 번째 답(D-187)
    expect(Object.keys((bodies[1] as { behavior: object }).behavior).sort()).toEqual([...BEHAVIOR_KEYS].sort());
  });

  test('25턴 상한(429)은 turn_limit 으로 읽는다', async () => {
    const client = { functions: { invoke: async () => ({ data: null, error: { name: 'FunctionsHttpError', message: 'x', context: { status: 429 } } }) } } as unknown as SupabaseClient;
    expect(await createSurveyChatApi(client).turn(1, '안녕', undefined)).toEqual({ ok: false, reason: 'turn_limit' });
  });
});
