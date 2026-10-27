// F19 1단계 · 통과 조건 1(API 층) · 2(데모 백엔드): v4 파도 0 · 1 — 기능 스위치 · 오늘의 한 분 강조 · 만남 뒤 피드백.
//  응답 모양의 원본: backend/S12_변경기록.md 4장 · migrations/0016_v4_wave01.sql. 화면 부품 시험은 f19Wave01Parts.test.tsx
import type { SupabaseClient } from '@supabase/supabase-js';

import { featuredLook, chipsFor } from '@/features/featured/featuredLogic';
import { createDemoRecs } from '@/lib/demoRecs';
import { createFeaturedApi, parseFeatured, FEATURED_REASON_MAX } from '@/lib/featuredApi';
import { demoDefault, isPendingKey, liveDefault } from '@/config/featureKeys';
import { createFeatureFlagsApi, FEATURE_KEYS, FLAGS_ALL_OFF, FLAGS_FALLBACK, isOn, parseFlags } from '@/lib/featureFlagsApi';
import { createMeetFeedbackApi, MISMATCH_CODES, parsePrompt, toSubmitArgs, type MeetAnswer } from '@/lib/meetFeedbackApi';
import { createDemoV4, type DemoV4User } from '@/lib/v4Demo';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 9, 17, 3, 0, 0); // 한국 2026-10-17 12:00 (서비스 하루 시작 = UTC 자정)

type RpcCall = { name: string; args: Record<string, unknown> | undefined };
type RpcReply = { data: unknown; error: { code?: string; message?: string } | null };
function fakeClient(reply: (name: string, args?: Record<string, unknown>) => RpcReply | Promise<RpcReply>) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      return reply(name, args);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
// 데모 v4 모의 서버를 API 층에 그대로 꽂는다(2단계에 demoBackend.rpc 가 넘길 길과 같다)
function demoClient(v4: ReturnType<typeof createDemoV4>, user: DemoV4User) {
  return { rpc: (name: string, args?: Record<string, unknown>) => v4.rpc(user, name, args ?? {}) } as unknown as SupabaseClient;
}
const userOf = (scene: string, n = 1): DemoV4User => ({ id: `u-${scene}-${n}`, email: `${scene}${n}@email.co` });

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined); // safeLog 줄(이벤트 이름 · 코드)만 나온다. 시험 출력에서는 숨긴다
});
afterAll(() => {
  jest.restoreAllMocks();
});

// 점수 · 순위 · 개수 키를 응답 전체에서 찾는다(K12 T1-02 · T2-10)
const FORBIDDEN_KEY = /^(rank|score|rating|reason_count|percent|stars?|points?|grade)$/i;
const keysOf = (node: unknown, out: string[] = []): string[] => {
  if (Array.isArray(node)) node.forEach((v) => keysOf(v, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      out.push(k);
      keysOf(v, out);
    }
  }
  return out;
};

describe('조건 1 · C1 기능 스위치 get_feature_flags', () => {
  test('응답 그대로: 9개 키 · 모드. 모르는 키는 버리고, 빠진 키 · boolean 아닌 값은 꺼짐(닫힌 쪽으로 실패)', () => {
    const flags = parseFlags({
      flags: { featured_pick: true, meet_feedback: false, safe_share: 'true', risk_flags: 1, contact_block: true, unknown_key: true },
      modes: { featured_pick: 'demo', meet_feedback: 'live', safe_share: 'DEMO' },
    });
    expect(flags.loaded).toBe(true);
    expect(Object.keys(flags.on).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(flags.on.featured_pick).toBe(true);
    expect(flags.on.contact_block).toBe(true);
    expect(flags.on.meet_feedback).toBe(false);
    expect(flags.on.safe_share).toBe(false); // 글자 'true' 는 켜짐이 아니다
    expect(flags.on.risk_flags).toBe(false); // 숫자 1 도 켜짐이 아니다
    expect(flags.on.ai_feedback).toBe(false); // 빠진 키
    expect('unknown_key' in flags.on).toBe(false);
    expect(flags.mode.featured_pick).toBe('demo');
    expect(flags.mode.safe_share).toBe('live'); // 모르는 모드는 live(데모 라벨 없음)
    expect(isOn(flags, 'featured_pick')).toBe(true);
  });

  test('null 응답(정지 · 탈퇴) → 전부 꺼짐 · 오류 · 던짐 → 키마다 live 값(새 기능 꺼짐, loaded=false)', async () => {
    expect(Object.values(parseFlags(null).on).every((v) => v === false)).toBe(true);
    expect(parseFlags(null)).toEqual(FLAGS_ALL_OFF);
    const failing = fakeClient(() => ({ data: null, error: { code: '', message: 'Failed to fetch' } }));
    expect(await createFeatureFlagsApi(failing.client).load()).toEqual(FLAGS_FALLBACK);
    const throwing = { rpc: async () => { throw new Error('x'); } } as unknown as SupabaseClient;
    expect(await createFeatureFlagsApi(throwing).load()).toEqual(FLAGS_FALLBACK);
    expect(FLAGS_FALLBACK.loaded).toBe(false);
    for (const key of ['featured_pick', 'meet_feedback', 'safe_share', 'risk_flags', 'contact_block', 'profile_prompts', 'doc_verify', 'selfie_verify', 'ai_feedback']) expect(FLAGS_FALLBACK.on[key]).toBe(false);
    const ok = fakeClient(() => ({ data: { flags: { safe_share: true }, modes: {} }, error: null }));
    const flags = await createFeatureFlagsApi(ok.client).load();
    expect(ok.calls).toEqual([{ name: 'get_feature_flags', args: undefined }]);
    expect(isOn(flags, 'safe_share')).toBe(true);
    expect(isOn(flags, 'meet_feedback')).toBe(false);
  });
});

describe('조건 1 · [1] 오늘의 한 분 강조(list_today_recommendations 의 featured)', () => {
  const item = (id: string, extra: Record<string, unknown> = {}) => ({ candidate_id: id, source: 'free', passed: false, liked: false, connected: false, profile: { A12: '김OO', A01: 32 }, photos: [], reasons: ['F06', 'E02', 'E03'], ...extra });
  const today = (items: unknown[]) => ({ day: '2026-10-17', now: new Date(T0).toISOString(), ready: true, first_list_pending: false, region_hint: false, next_at: new Date(T0 + DAY).toISOString(), items });

  test('items[0] 의 featured: true(불리언)만 강조로 읽고 맞는 점은 최대 5개', () => {
    const pick = parseFeatured(today([item('a', { featured: true, reasons: ['F06', 'E02', 'E03', 'F07', 'E05', 'E06'] }), item('b')]));
    expect(pick).toEqual({ candidateId: 'a', reasons: ['지역', '자녀 계획', '맞벌이', '종교', '부모 부양'] });
    expect(pick?.reasons).toHaveLength(FEATURED_REASON_MAX);
  });

  test('불리언이 아니거나 · 맨 앞이 아니거나 · 1회 매칭 카드거나 · 키가 없으면 강조 없음', () => {
    expect(parseFeatured(today([item('a', { featured: 1 }), item('b')]))).toBeNull();
    expect(parseFeatured(today([item('a', { featured: 'true' }), item('b')]))).toBeNull();
    expect(parseFeatured(today([item('a'), item('b', { featured: true })]))).toBeNull(); // 앱은 순서를 바꾸지 않는다: 맨 앞만 본다
    expect(parseFeatured(today([item('a', { featured: true, source: 'match_once' })]))).toBeNull();
    expect(parseFeatured(today([item('a'), item('b')]))).toBeNull();
    expect(parseFeatured(today([]))).toBeNull();
    expect(parseFeatured(null)).toBeNull();
  });

  test('loadToday: 한 번 불러 목록(기존 parseToday · 칩 3) + 강조(칩 5)를 함께 준다. 오류는 기존 09 와 같은 실패', async () => {
    const raw = today([item('a', { featured: true, reasons: ['F06', 'E02', 'E03', 'F07', 'E05'] }), item('b'), item('c')]);
    const fake = fakeClient(() => ({ data: raw, error: null }));
    const result = await createFeaturedApi(fake.client, () => T0).loadToday();
    expect(fake.calls.map((c) => c.name)).toEqual(['list_today_recommendations']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.today.cards.map((c) => c.id)).toEqual(['a', 'b', 'c']); // 서버 순서 그대로
    expect(result.data.today.cards[0].reasons).toHaveLength(3);
    expect(result.data.featured).toEqual({ candidateId: 'a', reasons: ['지역', '자녀 계획', '맞벌이', '종교', '부모 부양'] });
    const off = await createFeaturedApi(fakeClient(() => ({ data: null, error: { code: '', message: 'Failed to fetch' } })).client).loadToday();
    expect(off).toEqual({ ok: false, reason: 'network' });
  });

  test('강조 모양: 호감 보냄 · 넘김 · 연결된 카드는 벗는다(자리는 그대로) · 칩은 강조일 때만 5개', () => {
    const pick = { candidateId: 'a', reasons: ['지역', '자녀 계획', '맞벌이', '종교', '부모 부양'] };
    const card = { id: 'a', liked: false, passed: false, connected: false, reasons: ['지역', '자녀 계획', '맞벌이'] };
    expect(featuredLook(pick, card)).toBe(true);
    expect(chipsFor(card, pick)).toHaveLength(5);
    for (const done of [{ liked: true }, { passed: true }, { connected: true }]) {
      expect(featuredLook(pick, { ...card, ...done })).toBe(false);
      expect(chipsFor({ ...card, ...done }, pick)).toHaveLength(3);
    }
    expect(featuredLook(pick, { ...card, id: 'b' })).toBe(false);
    expect(featuredLook(null, card)).toBe(false);
  });
});

describe('조건 1 · [2] 만남 뒤 피드백 API', () => {
  test('응답 4가지: null → none · {off:true} → off · ask · answered(고치기 가능 여부 · 시각 · 내 답)', () => {
    expect(parsePrompt(null)).toEqual({ kind: 'none' });
    expect(parsePrompt({ off: true })).toEqual({ kind: 'off' });
    expect(parsePrompt({ match_id: 'm1', state: 'ask', card: { name: '한OO', age: 31, region: { sido: '서울', sigungu: '강서구' } } })).toEqual({ kind: 'ask', matchId: 'm1', head: '한OO · 31 · 서울 강서구' });
    const until = new Date(T0 + 46 * HOUR).toISOString();
    expect(parsePrompt({ match_id: 'm1', state: 'answered', card: { name: '한OO', age: 31, region: { sido: '서울' } }, can_edit: true, editable_until: until, answer: { met: 'met', outcome: 'off', mismatch: ['F06', 'nope', 'uncomfortable'] } })).toEqual({
      kind: 'answered',
      matchId: 'm1',
      head: '한OO · 31 · 서울',
      canEdit: true,
      editableUntil: T0 + 46 * HOUR,
      answer: { met: 'met', outcome: 'off', mismatch: ['F06', 'uncomfortable'] },
    });
    expect(parsePrompt({ state: 'ask' })).toEqual({ kind: 'none' }); // 모르는 모양
    expect(parsePrompt({ match_id: 'm1', state: 'weird' })).toEqual({ kind: 'none' });
  });

  test('보내기 전 규칙(서버와 같음): 만났을 때만 어땠나 · 기대와 달랐을 때만 달랐던 점 · 최대 3개 · 중복 없음 · 허용 코드 21개', () => {
    expect(MISMATCH_CODES).toHaveLength(21);
    const a = (met: MeetAnswer['met'], outcome: MeetAnswer['outcome'], mismatch: string[] = []) => toSubmitArgs('m1', { met, outcome, mismatch });
    expect(a('not_yet', null)).toEqual({ p_match: 'm1', p_met: 'not_yet', p_outcome: null, p_mismatch: null });
    expect(a('met', 'good')).toEqual({ p_match: 'm1', p_met: 'met', p_outcome: 'good', p_mismatch: null });
    expect(a('met', 'off', ['F06', 'profile_diff', 'uncomfortable'])).toEqual({ p_match: 'm1', p_met: 'met', p_outcome: 'off', p_mismatch: ['F06', 'profile_diff', 'uncomfortable'] });
    expect(a('met', null)).toBeNull();
    expect(a('declined', 'good')).toBeNull();
    expect(a('met', 'good', ['F06'])).toBeNull();
    expect(a('met', 'off', ['F06', 'F07', 'E02', 'E03'])).toBeNull();
    expect(a('met', 'off', ['F06', 'F06'])).toBeNull();
    expect(a('met', 'off', ['F11'])).toBeNull(); // 19개 밖
    expect(toSubmitArgs('', { met: 'not_yet', outcome: null, mismatch: [] })).toBeNull();
  });

  test('오류 코드 → 이유: off · edit_window_closed · not_available · forbidden · invalid_value · rate_limited · 인터넷. 규칙에 어긋나면 보내지 않는다', async () => {
    const replies: Record<string, RpcReply> = {
      off: { data: { off: true }, error: null },
      closed: { data: null, error: { code: 'P0001', message: 'edit_window_closed' } },
      gone: { data: null, error: { code: 'P0001', message: 'not_available' } },
      forbidden: { data: null, error: { code: '42501', message: 'forbidden' } },
      invalid: { data: null, error: { code: 'P0001', message: 'invalid_value' } },
      limited: { data: null, error: { code: '54000', message: 'rate_limited' } },
      network: { data: null, error: { code: '', message: 'Failed to fetch' } },
      okay: { data: { ok: true }, error: null },
    };
    const expected: Record<string, unknown> = {
      off: { ok: false, reason: 'off' },
      closed: { ok: false, reason: 'edit_closed' },
      gone: { ok: false, reason: 'unavailable' },
      forbidden: { ok: false, reason: 'unavailable' },
      invalid: { ok: false, reason: 'invalid' },
      limited: { ok: false, reason: 'limited' },
      network: { ok: false, reason: 'network' },
      okay: { ok: true },
    };
    for (const [name, reply] of Object.entries(replies)) {
      const api = createMeetFeedbackApi(fakeClient(() => reply).client);
      expect(await api.submit('m1', { met: 'met', outcome: 'ok', mismatch: [] })).toEqual(expected[name]);
    }
    const fake = fakeClient(() => replies.okay);
    const api = createMeetFeedbackApi(fake.client);
    expect(await api.submit('m1', { met: 'met', outcome: 'good', mismatch: ['F06'] })).toEqual({ ok: false, reason: 'invalid' });
    expect(fake.calls).toHaveLength(0); // 규칙에 어긋나면 서버에 보내지 않는다
    expect(await api.dismiss('m1')).toEqual({ ok: true });
    expect(fake.calls).toEqual([{ name: 'dismiss_meet_feedback', args: { p_match: 'm1' } }]);
    expect(await createMeetFeedbackApi(fakeClient(() => replies.off).client).dismiss('m1')).toEqual({ ok: false, reason: 'off' });
  });

  test('카드를 못 불러오면 카드 없음(오류 글 0): 인터넷 · 서버 오류 · 던짐 모두 none', async () => {
    expect(await createMeetFeedbackApi(fakeClient(() => ({ data: null, error: { code: '', message: 'Failed to fetch' } })).client).prompt()).toEqual({ kind: 'none' });
    expect(await createMeetFeedbackApi(fakeClient(() => ({ data: null, error: { code: '54000', message: 'rate_limited' } })).client).prompt()).toEqual({ kind: 'none' });
    const throwing = { rpc: async () => { throw new Error('x'); } } as unknown as SupabaseClient;
    expect(await createMeetFeedbackApi(throwing).prompt()).toEqual({ kind: 'none' });
  });
});

describe('조건 2 · 데모 백엔드: 스위치 · 강조 1명 · 피드백 카드 · 꺼짐 장면(이메일 앞부분)', () => {
  test('스위치: 기본 전부 켜짐(팀장 판단 전 키 2개만 없음) · 모드 demo, v4off = live 처음값, featoff · fboff · shareoff 하나만 꺼짐', async () => {
    const v4 = createDemoV4({ now: () => T0 });
    const load = (u: DemoV4User) => createFeatureFlagsApi(demoClient(v4, u)).load();
    const plain = await load(userOf('plain'));
    const live = FEATURE_KEYS.filter((k) => !isPendingKey(k));
    expect(live).toHaveLength(FEATURE_KEYS.length - FEATURE_KEYS.filter(isPendingKey).length); // F22: 키 목록(K19 2-5) — 팀장 판단 전 키만 응답에 없음(D-122 뒤 0개)
    expect(live.every((k) => plain.on[k] === demoDefault(k) && plain.mode[k] === 'demo')).toBe(true); // F22: 데모 처음값(review_required · prelaunch 만 꺼짐)
    expect(FEATURE_KEYS.filter((k) => !plain.on[k])).toEqual(['review_required', 'prelaunch', 'v4_daily_recs', 'v4_likes', 'v4_shop', 'chat_push']); // V5(W10): 숨긴 v4 화면은 데모에서도 꺼짐(v4on 장면만 켜짐) · R-A: chat_push 는 데모도 꺼짐(토큰 등록 0)
    const off = await load(userOf('v4off'));
    expect(FEATURE_KEYS.filter((k) => off.on[k])).toEqual(FEATURE_KEYS.filter(liveDefault)); // 구현된 기능(E)만
    expect(off.on.featured_pick || off.on.meet_feedback || off.on.safe_share).toBe(false);
    for (const [scene, key] of [['featoff', 'featured_pick'], ['fboff', 'meet_feedback'], ['shareoff', 'safe_share']] as const) {
      const flags = await load(userOf(scene));
      expect(live.filter((k) => flags.on[k] !== demoDefault(k))).toEqual([key]);
    }
  });

  describe('강조(데모 09 응답에 입힘)', () => {
    const recs = createDemoRecs(() => T0);
    const listFor = (u: DemoV4User) => recs.list(u.id, u.email);
    // 10 상세의 맞는 점(lib/demoRecs.ts candidate) — 2단계 demoBackend 가 넘길 값과 같다
    const fullReasons = (u: DemoV4User, id: string) => (recs.candidate(u.id, u.email, id).data as { reasons?: string[] } | null)?.reasons ?? null;

    test('기본 장면: 첫 무료 카드 한 명만 featured: true(불리언) · 맨 앞 · 맞는 점 5개 · 숫자 키 없음 · 나머지 순서 그대로', () => {
      const v4 = createDemoV4({ now: () => T0, reasonsFor: fullReasons });
      const u = userOf('plain');
      const before = listFor(u).data as { items: { candidate_id: string }[] };
      const out = v4.decorateToday(u, listFor(u)).data as { items: Record<string, unknown>[] };
      const flagged = out.items.filter((i) => 'featured' in i);
      expect(flagged).toHaveLength(1);
      expect(flagged[0].featured).toBe(true);
      expect(out.items[0]).toBe(flagged[0]);
      expect(out.items[0].reasons).toEqual(['F06', 'E02', 'E03', 'F07', 'E05']);
      expect(out.items.map((i) => i.candidate_id)).toEqual(before.items.map((i) => i.candidate_id));
      expect(keysOf(out).filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
      expect(out.items.flatMap((i) => Object.values(i)).some((v) => typeof v === 'number')).toBe(false); // 카드에 숫자 값이 새로 생기지 않는다
      expect(parseFeatured(out)).toEqual({ candidateId: 'demo-cand-1', reasons: ['지역', '자녀 계획', '맞벌이', '종교', '부모 부양'] });
    });

    test('그날 고정: 호감을 보내도 같은 카드 · 같은 자리(앱이 모양만 벗김). 상대가 공개 범위를 줄이면 모양만 빠지고 다른 카드로 옮기지 않음', () => {
      const v4 = createDemoV4({ now: () => T0, reasonsFor: fullReasons });
      const u = userOf('plain', 2);
      v4.decorateToday(u, listFor(u));
      recs.sendLike(u.id, u.email, 'demo-cand-1');
      const again = v4.decorateToday(u, listFor(u)).data as { items: Record<string, unknown>[] };
      expect(again.items[0]).toMatchObject({ candidate_id: 'demo-cand-1', featured: true, liked: true });
      const shrink = userOf('featshrink');
      expect((v4.decorateToday(shrink, listFor(shrink)).data as { items: Record<string, unknown>[] }).items[0].featured).toBe(true);
      const later = v4.decorateToday(shrink, listFor(shrink)).data as { items: Record<string, unknown>[] };
      expect(later.items[0].candidate_id).toBe('demo-cand-1');
      expect(later.items.some((i) => 'featured' in i)).toBe(false);
    });

    test('강조 카드를 차단하면 강조가 사라지고 다른 카드로 옮겨 가지 않는다', () => {
      const v4 = createDemoV4({ now: () => T0, reasonsFor: fullReasons });
      const u = userOf('plain', 3);
      v4.decorateToday(u, listFor(u));
      recs.block(u.id, u.email, 'demo-cand-1');
      const after = v4.decorateToday(u, listFor(u)).data as { items: Record<string, unknown>[] };
      expect(after.items.map((i) => i.candidate_id)).toEqual(['demo-cand-2', 'demo-cand-3']);
      expect(after.items.some((i) => 'featured' in i)).toBe(false);
    });

    test('강조 없는 장면: featnone · v4off · featoff · 카드 1장(recone) · 맞는 점 3개 미만 → 받은 응답 그대로', () => {
      const v4 = createDemoV4({ now: () => T0, reasonsFor: fullReasons });
      for (const scene of ['featnone', 'v4off', 'featoff', 'recone']) {
        const u = userOf(scene);
        const raw = listFor(u);
        expect(v4.decorateToday(u, raw)).toBe(raw);
      }
      const thin = createDemoV4({ now: () => T0, reasonsFor: () => ['F06', 'E02'] });
      const u = userOf('plain', 4);
      const raw = listFor(u);
      expect(thin.decorateToday(u, raw)).toBe(raw);
      const failed = { data: null, error: { code: '', message: 'Failed to fetch' } };
      expect(v4.decorateToday(u, failed)).toBe(failed);
    });

    test('API 층으로 읽으면: 기본 = 강조 1명, featnone = 없음', async () => {
      const v4 = createDemoV4({ now: () => T0, reasonsFor: fullReasons });
      const viaApi = async (u: DemoV4User) => {
        const client = { rpc: async () => v4.decorateToday(u, listFor(u)) } as unknown as SupabaseClient;
        const r = await createFeaturedApi(client, () => T0).loadToday();
        return r.ok ? r.data.featured : 'fail';
      };
      expect(await viaApi(userOf('plain', 5))).toEqual({ candidateId: 'demo-cand-1', reasons: ['지역', '자녀 계획', '맞벌이', '종교', '부모 부양'] });
      expect(await viaApi(userOf('featnone', 2))).toBeNull();
    });
  });

  describe('만남 뒤 피드백(데모 서버 규칙 = 0016)', () => {
    let t = T0;
    const clock = () => t;
    beforeEach(() => {
      t = T0;
    });

    test('기본: 가장 오래된 쌍(9일) 카드 → 만났어요 · 기대와 달랐어요 저장 → 48시간 동안 "답한" 줄 · 1번 고치기 · 두 번째는 잠김', async () => {
      const v4 = createDemoV4({ now: clock });
      const u = userOf('plain', 10);
      const api = createMeetFeedbackApi(demoClient(v4, u));
      const first = await api.prompt();
      expect(first).toEqual({ kind: 'ask', matchId: 'demo-fbmatch-1', head: '오OO · 33 · 경기 수원시' });
      expect(await api.submit('demo-fbmatch-1', { met: 'met', outcome: 'off', mismatch: ['F06', 'uncomfortable'] })).toEqual({ ok: true });
      const answered = await api.prompt();
      expect(answered).toMatchObject({ kind: 'answered', matchId: 'demo-fbmatch-1', canEdit: true, editableUntil: T0 + 48 * HOUR, answer: { met: 'met', outcome: 'off', mismatch: ['F06', 'uncomfortable'] } });
      t = T0 + 47 * HOUR + 59 * 60_000; // 47:59
      expect(await api.submit('demo-fbmatch-1', { met: 'met', outcome: 'ok', mismatch: [] })).toEqual({ ok: true });
      expect(await api.prompt()).toMatchObject({ kind: 'answered', canEdit: false, answer: { outcome: 'ok', mismatch: [] } });
      expect(await api.submit('demo-fbmatch-1', { met: 'met', outcome: 'good', mismatch: [] })).toEqual({ ok: false, reason: 'edit_closed' });
      expect(v4.peek(u).feedback).toEqual([{ matchId: 'demo-fbmatch-1', met: 'met', outcome: 'ok', mismatch: [], answered: true, edited: true, dismissed: false }]);
      // 48시간 뒤: 답한 줄이 사라지고 다음 쌍(8일 → 지금은 10일)이 카드로
      t = T0 + 48 * HOUR + 60_000;
      expect(await api.prompt()).toEqual({ kind: 'ask', matchId: 'demo-fbmatch-2', head: '한OO · 31 · 서울 강서구' });
    });

    test('48:01 에 처음 고치기도 잠김 · 닫은(묻지 않기) 쌍은 다시 묻지 않고 다음 쌍은 다음 날부터 · 닫은 쌍에 답하면 not_available', async () => {
      const v4 = createDemoV4({ now: clock });
      const u = userOf('plain', 11);
      const api = createMeetFeedbackApi(demoClient(v4, u));
      await api.prompt();
      expect(await api.submit('demo-fbmatch-1', { met: 'not_yet', outcome: null, mismatch: [] })).toEqual({ ok: true });
      t = T0 + 48 * HOUR + 60_000;
      expect(await api.submit('demo-fbmatch-1', { met: 'met', outcome: 'good', mismatch: [] })).toEqual({ ok: false, reason: 'edit_closed' });

      const u2 = userOf('plain', 12);
      const api2 = createMeetFeedbackApi(demoClient(v4, u2));
      t = T0;
      expect(await api2.dismiss('demo-fbmatch-1')).toEqual({ ok: true });
      expect(await api2.prompt()).toEqual({ kind: 'none' }); // 오늘 닫았으니 다음 쌍은 내일
      expect(await api2.submit('demo-fbmatch-1', { met: 'met', outcome: 'good', mismatch: [] })).toEqual({ ok: false, reason: 'unavailable' });
      t = T0 + DAY;
      expect(await api2.prompt()).toMatchObject({ kind: 'ask', matchId: 'demo-fbmatch-2' });
      expect(await api2.dismiss('nope')).toEqual({ ok: false, reason: 'unavailable' });
    });

    test('장면: fbsoon(6일) 카드 없음 · fbnone 없음 · fbanswered 답한 줄 · fbedited 고치기 없음 · fbfail 못 불러옴 → 카드 없음 · v4off · fboff → off', async () => {
      const v4 = createDemoV4({ now: clock });
      const prompt = (scene: string) => createMeetFeedbackApi(demoClient(v4, userOf(scene))).prompt();
      expect(await prompt('fbsoon')).toEqual({ kind: 'none' });
      expect(await prompt('fbnone')).toEqual({ kind: 'none' });
      expect(await prompt('fbanswered')).toMatchObject({ kind: 'answered', canEdit: true, answer: { met: 'met', outcome: 'good' } });
      expect(await prompt('fbedited')).toMatchObject({ kind: 'answered', canEdit: false });
      expect(await prompt('fbfail')).toEqual({ kind: 'none' });
      for (const scene of ['v4off', 'fboff']) {
        const api = createMeetFeedbackApi(demoClient(v4, userOf(scene)));
        expect(await api.prompt()).toEqual({ kind: 'off' });
        expect(await api.submit('demo-fbmatch-1', { met: 'not_yet', outcome: null, mismatch: [] })).toEqual({ ok: false, reason: 'off' });
        expect(await api.dismiss('demo-fbmatch-1')).toEqual({ ok: false, reason: 'off' });
      }
      const late = createMeetFeedbackApi(demoClient(v4, userOf('plain', 20)));
      expect(await late.prompt()).toMatchObject({ kind: 'ask' }); // 지금(T0) 연결 9일 · 8일
      t = T0 + 30 * DAY; // 39일 · 38일: 연결 + 37일이 지나면 거둔다
      expect(await late.prompt()).toEqual({ kind: 'none' });
    });

    test('데모 서버 값 검사(앱을 거치지 않은 요청도 0016 과 같은 invalid_value) · 차단하면 카드와 답이 사라진다 · 응답에 숫자 점수 키 0', async () => {
      const v4 = createDemoV4({ now: clock });
      const u = userOf('plain', 13);
      const bad = [
        { p_match: 'demo-fbmatch-1', p_met: 'maybe' },
        { p_match: 'demo-fbmatch-1', p_met: 'met' },
        { p_match: 'demo-fbmatch-1', p_met: 'not_yet', p_outcome: 'good' },
        { p_match: 'demo-fbmatch-1', p_met: 'met', p_outcome: 'good', p_mismatch: ['F06'] },
        { p_match: 'demo-fbmatch-1', p_met: 'met', p_outcome: 'off', p_mismatch: ['F06', 'F07', 'E02', 'E03'] },
        { p_match: 'demo-fbmatch-1', p_met: 'met', p_outcome: 'off', p_mismatch: ['F06', 'F06'] },
        { p_match: 'demo-fbmatch-1', p_met: 'met', p_outcome: 'off', p_mismatch: ['F11'] },
      ];
      for (const args of bad) expect((await v4.rpc(u, 'submit_meet_feedback', args)).error?.message).toBe('invalid_value');
      expect((await v4.rpc(u, 'submit_meet_feedback', { p_match: 'other', p_met: 'not_yet' })).error?.message).toBe('not_available');
      const ask = await v4.rpc(u, 'get_meet_feedback_prompt');
      expect(keysOf(ask.data).filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
      expect(keysOf(ask.data)).not.toContain('photo_id');
      expect(keysOf(ask.data)).not.toContain('face_photo_id');
      v4.noteBlock(u, 'demo-fb-2');
      const after = await createMeetFeedbackApi(demoClient(v4, u)).prompt();
      expect(after).toMatchObject({ kind: 'ask', matchId: 'demo-fbmatch-2' }); // 끊긴 쌍의 카드는 사라지고 남은 쌍
      expect((await v4.rpc(u, 'nope')).error?.code).toBe('42883');
      expect(v4.handles('get_feature_flags') && v4.handles('submit_meet_feedback') && !v4.handles('list_today_recommendations')).toBe(true);
    });

    test('2단계 연결 대비: matches · people 를 넘기면 그 연결 목록을 쓴다', async () => {
      const v4 = createDemoV4({ now: clock, matches: () => [{ id: 'mx', other: 'px', createdAt: T0 - 10 * DAY }], people: (id) => (id === 'px' ? { name: '문OO', age: 32, region: { sido: '서울', sigungu: '마포구' } } : null) });
      expect(await createMeetFeedbackApi(demoClient(v4, userOf('plain', 14))).prompt()).toEqual({ kind: 'ask', matchId: 'mx', head: '문OO · 32 · 서울 마포구' });
    });
  });
});
