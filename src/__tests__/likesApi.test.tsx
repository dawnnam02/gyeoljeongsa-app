// 11 호감의 규칙 · 서버 연결 · 모의 서버 · T2 숨김 규칙 · 글 원본 대조(F6 1단계, 세부청사진 F6 조건 1 · 3 · 4 · 6 · T2)
//  화면 시험은 likesScreen.test.tsx
import fs from 'node:fs';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import { LIKES } from '@/content/likesCopy';
import { likeButtonMode, sendFailureMode } from '@/features/likes/likeGate';
import { cardHead, expiryOf, LIKE_EXPIRY_MS, newestFirst, timeAgo } from '@/features/likes/likesLogic';
import { createLikesApi, parseLikes } from '@/lib/likesApi';
import { createDemoLikes } from '@/lib/likesDemo';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 9, 15, 5, 0, 0); // 2026-10-15 14:00 KST

const FORBIDDEN = /^(grade|score|rank|rating|percent|match_score|level)$/i;
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

describe('규칙 함수', () => {
  test('R12 시간: 분 전(0분은 1분) · 오늘 n시간 전 · 달력 어제 · n일 전 · 7일 이상은 한국 날짜', () => {
    // T0 = 10월 15일 14:00 KST
    expect(timeAgo(T0, T0)).toBe('1분 전');
    expect(timeAgo(T0 - 59 * MIN, T0)).toBe('59분 전');
    expect(timeAgo(T0 - 2 * HOUR, T0)).toBe('2시간 전');
    expect(timeAgo(T0 - 14 * HOUR, T0)).toBe('14시간 전'); // 15일 00:00 — 아직 오늘
    expect(timeAgo(T0 - 14 * HOUR - MIN, T0)).toBe('어제'); // 14일 23:59 — 지난 시간은 14시간이어도 어제
    expect(timeAgo(T0 - 26 * HOUR, T0)).toBe('어제');
    expect(timeAgo(T0 - 38 * HOUR, T0)).toBe('어제'); // 14일 00:00
    expect(timeAgo(T0 - 38 * HOUR - MIN, T0)).toBe('2일 전'); // 13일 23:59
    expect(timeAgo(T0 - 3 * DAY - HOUR, T0)).toBe('3일 전');
    expect(timeAgo(T0 - 6 * DAY, T0)).toBe('6일 전'); // 9일
    expect(timeAgo(T0 - 6 * DAY - 15 * HOUR, T0)).toBe('10월 8일'); // 8일 23:00 — 날짜로 7일 전
    expect(timeAgo(Date.UTC(2026, 9, 3, 16, 0, 0), T0)).toBe('10월 4일'); // UTC 3일 16시 = 한국 4일 01시
    expect(timeAgo(T0 + HOUR, T0)).toBe('1분 전'); // 기기 시계가 늦어도 음수가 나오지 않는다
  });

  test('R12 달력 경계(팀장 10-15): 한국 자정을 넘으면 몇 분 · 몇 시간 차이여도 날짜로 센다', () => {
    const at = (day: number, h: number, m = 0) => Date.UTC(2026, 9, day, h - 9, m, 0); // 한국 시각 → UTC
    const now = at(15, 0, 30); // 15일 00:30 KST
    expect(timeAgo(at(15, 0, 10), now)).toBe('20분 전'); // 1시간 미만은 분
    expect(timeAgo(at(14, 23, 40), now)).toBe('50분 전'); // 자정을 넘었어도 1시간 미만은 분
    expect(timeAgo(at(14, 23, 0), now)).toBe('어제'); // 1시간 30분 전이지만 어제 날짜
    expect(timeAgo(at(14, 0, 31), now)).toBe('어제'); // 거의 24시간 전 · 어제 날짜
    expect(timeAgo(at(13, 23, 59), now)).toBe('2일 전'); // 24시간 31분 전이지만 13일 날짜
    const late = at(15, 23, 30); // 15일 23:30 KST
    expect(timeAgo(at(15, 10, 0), late)).toBe('13시간 전'); // 같은 날짜면 시간
    expect(timeAgo(at(15, 0, 0), late)).toBe('23시간 전');
  });

  test('P7-05 만료 표시: n일 뒤 만료(내림) · 24시간 미만 오늘 만료 · 지나면 만료(조건 4)', () => {
    const exp = T0 + LIKE_EXPIRY_MS;
    expect(LIKE_EXPIRY_MS).toBe(168 * HOUR);
    expect(expiryOf(exp, T0)).toEqual({ state: 'live', label: '7일 뒤 만료' });
    expect(expiryOf(exp, T0 + HOUR)).toEqual({ state: 'live', label: '6일 뒤 만료' });
    expect(expiryOf(exp, exp - 25 * HOUR)).toEqual({ state: 'live', label: '1일 뒤 만료' });
    expect(expiryOf(exp, exp - 23 * HOUR)).toEqual({ state: 'live', label: '오늘 만료' });
    expect(expiryOf(exp, exp - 1)).toEqual({ state: 'live', label: '오늘 만료' });
    expect(expiryOf(exp, exp)).toEqual({ state: 'expired', label: '만료' });
    expect(expiryOf(exp, exp + DAY)).toEqual({ state: 'expired', label: LIKES.expired });
  });

  test('R3 이름 줄 "박OO · 29 · 경기 성남시"(U30: 시·군·구 전체) · 빈 칸은 뺀다', () => {
    expect(cardHead({ name: '박OO', age: 29, region: { sido: '경기', sigungu: '성남시' } })).toBe('박OO · 29 · 경기 성남시');
    expect(cardHead({ name: '한OO', age: 31, region: { sido: '서울', sigungu: '강서구' } })).toBe('한OO · 31 · 서울 강서구');
    expect(cardHead({ name: '윤OO', age: null, region: { sido: '세종' } })).toBe('윤OO · 세종');
    expect(cardHead({})).toBe('');
  });

  test('최신순(조건 1): 시각이 큰 것이 먼저, 같으면 받은 순서', () => {
    const rows = [{ createdAt: 1, n: 'a' }, { createdAt: 3, n: 'b' }, { createdAt: 2, n: 'c' }, { createdAt: 3, n: 'd' }];
    expect(newestFirst(rows).map((r) => r.n)).toEqual(['b', 'd', 'c', 'a']);
  });
});

describe('서버 응답 읽기 (스키마 9-12 list_likes)', () => {
  const card = (name: string, extra: Record<string, unknown> = {}) => ({ name, age: 30, region: { sido: '서울', sigungu: '마포구' }, face_photo_id: null, ...extra });

  test('세 종류 모양 그대로 · 최신순으로 맞춘다 · 모르는 모양의 행은 버린다', () => {
    const received = parseLikes('received', [
      { like_id: 'l1', user_id: 'u1', created_at: '2026-10-13T14:03:00+09:00', expires_at: '2026-10-20T14:03:00+09:00', card: card('박OO') },
      { like_id: 'l2', user_id: 'u2', created_at: '2026-10-15T09:00:00+09:00', expires_at: '2026-10-22T09:00:00+09:00', card: card('윤OO', { face_photo_id: 'ph2' }) },
      { like_id: 'l3', user_id: 'u3', created_at: '2026-10-15T09:00:00+09:00' }, // 만료 시각 없음 → 버림
      { user_id: 'u4', created_at: '2026-10-15T09:00:00+09:00', expires_at: '2026-10-22T09:00:00+09:00' }, // like_id 없음
      'x',
    ]);
    expect(received?.map((r) => r.likeId)).toEqual(['l2', 'l1']);
    expect(received?.[0]).toMatchObject({ kind: 'received', userId: 'u2', head: '윤OO · 30 · 서울 마포구', facePhotoId: 'ph2', expiresAt: Date.parse('2026-10-22T09:00:00+09:00') });
    const sent = parseLikes('sent', [{ like_id: 'l9', user_id: 'u9', created_at: '2026-10-15T09:20:00+09:00', expires_at: '2026-10-22T09:20:00+09:00', card: card('김OO') }]);
    expect(sent?.[0]).toEqual({ kind: 'sent', likeId: 'l9', userId: 'u9', createdAt: Date.parse('2026-10-15T09:20:00+09:00'), head: '김OO · 30 · 서울 마포구', facePhotoId: null });
    expect(Object.keys(sent?.[0] ?? {})).not.toContain('expiresAt'); // 보낸 호감은 남은 시간을 갖지 않는다(P7-05)
    const connected = parseLikes('connected', [{ match_id: 'm1', user_id: 'u3', created_at: '2026-10-14T21:40:00+09:00', card: card('한OO') }]);
    expect(connected?.[0]).toMatchObject({ kind: 'connected', matchId: 'm1', userId: 'u3' });
    expect(parseLikes('received', null)).toBeNull();
    expect(parseLikes('sent', { rows: [] })).toBeNull();
  });

  test('앱은 아는 키만 읽는다: 서버가 순위 · 점수 · 연락처를 실수로 보내도 앱 데이터에는 없다', () => {
    const rows = parseLikes('received', [{ like_id: 'l', user_id: 'u', created_at: '2026-10-15T00:00:00Z', expires_at: '2026-10-22T00:00:00Z', score: 99, rank: 1, card: { ...card('박OO'), grade: 5, phone: '010' } }]);
    expect(keysOf(rows).filter((k) => FORBIDDEN.test(k))).toEqual([]);
    expect(JSON.stringify(rows)).not.toMatch(/010|phone/);
  });
});

describe('서버 연결 createLikesApi (오류 코드 → 앱 이유)', () => {
  const client = (rpc: jest.Mock) => ({ rpc }) as unknown as SupabaseClient;

  test('list_likes 는 종류 이름을 그대로 넘기고, 셋 중 하나라도 실패하면 실패(인터넷 먼저)', async () => {
    const rpc = jest.fn(async (_name: string, args: { p_kind: string }) => ({ data: args.p_kind === 'sent' ? [] : [], error: null }));
    const api = createLikesApi(client(rpc));
    expect(await api.loadAll()).toEqual({ ok: true, data: { received: [], sent: [], connected: [] } });
    expect(rpc.mock.calls.map((c) => [c[0], c[1].p_kind]).sort()).toEqual([['list_likes', 'connected'], ['list_likes', 'received'], ['list_likes', 'sent']]);
    const flaky = createLikesApi(client(jest.fn(async (_n: string, a: { p_kind: string }) => (a.p_kind === 'sent' ? { data: null, error: { code: null, message: 'TypeError: Failed to fetch' } } : { data: [], error: null }))));
    expect(await flaky.loadAll()).toEqual({ ok: false, reason: 'network' });
    const broken = createLikesApi(client(jest.fn(async () => ({ data: null, error: null })))); // 쓸 수 없는 계정은 null
    expect(await broken.loadAll()).toEqual({ ok: false, reason: 'server' });
    const thrown = createLikesApi(client(jest.fn(() => { throw new Error('데모 모드의 rpc 없음'); })));
    expect(await thrown.list('received')).toEqual({ ok: false, reason: 'server' });
  });

  test('accept_like · decline_like: 인자 p_like_id · not_available · forbidden(42501) → unavailable · 인터넷 · 그 밖', async () => {
    const ok = jest.fn(async () => ({ data: { match_id: 'm1', user_id: 'u1' }, error: null }));
    expect(await createLikesApi(client(ok)).accept('l1')).toEqual({ ok: true, data: { matchId: 'm1', userId: 'u1' } });
    expect(ok).toHaveBeenCalledWith('accept_like', { p_like_id: 'l1' });
    const declined = jest.fn(async () => ({ data: null, error: null }));
    expect(await createLikesApi(client(declined)).decline('l2')).toEqual({ ok: true });
    expect(declined).toHaveBeenCalledWith('decline_like', { p_like_id: 'l2' });
    const err = (code: string | null, message: string) => createLikesApi(client(jest.fn(async () => ({ data: null, error: { code, message } }))));
    expect(await err('P0001', 'not_available').accept('l')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await err('42501', 'forbidden').decline('l')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await err(null, 'Failed to fetch').accept('l')).toEqual({ ok: false, reason: 'network' });
    expect(await err('XX000', 'boom').decline('l')).toEqual({ ok: false, reason: 'server' });
  });
});

describe('모의 서버 likesDemo (데모 모드 · 계약과 같은 모양)', () => {
  const user = (email: string) => ({ id: `id-${email}`, email });
  const rpc = async (demo: ReturnType<typeof createDemoLikes>, u: { id: string; email: string }, name: string, args: Record<string, unknown> = {}) => demo.rpc(u, name, args);

  test('기본 장면: 받은 2(최신순) · 보낸 1 · 연결 1 · 응답 키는 계약 그대로이고 점수 · 등급 키 0', async () => {
    const demo = createDemoLikes({ now: () => T0 });
    const u = user('a@email.com');
    const r = (await rpc(demo, u, 'list_likes', { p_kind: 'received' })).data as Record<string, unknown>[];
    const s = (await rpc(demo, u, 'list_likes', { p_kind: 'sent' })).data as Record<string, unknown>[];
    const c = (await rpc(demo, u, 'list_likes', { p_kind: 'connected' })).data as Record<string, unknown>[];
    expect(r.map((x) => (x.card as { name: string }).name)).toEqual(['박OO', '윤OO']);
    expect(Object.keys(r[0]).sort()).toEqual(['card', 'created_at', 'expires_at', 'like_id', 'user_id']);
    expect(Object.keys(s[0]).sort()).toEqual(['card', 'created_at', 'like_id', 'user_id']);
    expect(Object.keys(c[0]).sort()).toEqual(['card', 'created_at', 'match_id', 'user_id']);
    expect(Object.keys(r[0].card as object).sort()).toEqual(['age', 'face_photo_id', 'name', 'region']);
    expect(keysOf([r, s, c]).filter((k) => FORBIDDEN.test(k))).toEqual([]);
    expect((await rpc(demo, u, 'list_likes', { p_kind: 'all' })).error?.message).toBe('invalid_kind');
    expect(demo.handles('list_likes') && demo.handles('accept_like') && demo.handles('decline_like') && !demo.handles('send_like')).toBe(true);
  });

  test('수락 → 받은 호감에서 빠지고 연결이 생긴다(조건 2, 모의) · 거절 → 영구, 다시 수락 못 함(조건 3, 모의)', async () => {
    const demo = createDemoLikes({ now: () => T0 });
    const u = user('b@email.com');
    const list = async (kind: string) => (await rpc(demo, u, 'list_likes', { p_kind: kind })).data as { like_id?: string; user_id: string }[];
    const [first, second] = await list('received');
    const accepted = await rpc(demo, u, 'accept_like', { p_like_id: first.like_id });
    expect(accepted.data).toMatchObject({ user_id: 'demo-liker-1' });
    expect((await list('received')).map((x) => x.user_id)).toEqual(['demo-liker-2']);
    expect((await list('connected')).map((x) => x.user_id)).toEqual(['demo-liker-1', 'demo-match-1']); // 최신순
    expect((await rpc(demo, u, 'accept_like', { p_like_id: first.like_id })).error?.message).toBe('not_available'); // 이미 처리
    expect((await rpc(demo, u, 'decline_like', { p_like_id: second.like_id })).error).toBeNull();
    expect(await list('received')).toEqual([]);
    expect((await rpc(demo, u, 'accept_like', { p_like_id: second.like_id })).error?.message).toBe('not_available');
    expect(demo.peek(u)).toMatchObject({ received: [], connected: ['demo-match-1', 'demo-liker-1'], declinedByMe: ['demo-liker-2'] });
  });

  test('만료(likeexp): 시간이 지나면 목록 · 수락에서 빠진다(P7-04 · 조건 4 모의)', async () => {
    let now = T0;
    const demo = createDemoLikes({ now: () => now });
    const u = user('likeexp@email.com');
    const ids = async () => ((await rpc(demo, u, 'list_likes', { p_kind: 'received' })).data as { user_id: string; like_id: string; expires_at: string }[]);
    const before = await ids();
    expect(before.map((x) => x.user_id)).toEqual(['demo-liker-1', 'demo-liker-2', 'demo-liker-3']); // 7일 가까이 된 호감이 가장 오래됐다
    expect(Date.parse(before[2].expires_at) - T0).toBe(90_000);
    now = T0 + 91_000;
    expect((await ids()).map((x) => x.user_id)).toEqual(['demo-liker-1', 'demo-liker-2']);
    expect((await rpc(demo, u, 'accept_like', { p_like_id: before[2].like_id })).error?.message).toBe('not_available');
  });

  test('장면: like0 모두 0건 · likefail 늘 인터넷 실패 · likeflaky 종류마다 첫 번만 · likegone 수락 not_available', async () => {
    const demo = createDemoLikes({ now: () => T0 });
    for (const kind of ['received', 'sent', 'connected']) expect((await rpc(demo, user('like0@email.com'), 'list_likes', { p_kind: kind })).data).toEqual([]);
    expect((await rpc(demo, user('likefail@email.com'), 'list_likes', { p_kind: 'sent' })).error).toEqual({ code: '', message: 'Failed to fetch' });
    const flaky = user('likeflaky@email.com');
    expect((await rpc(demo, flaky, 'list_likes', { p_kind: 'sent' })).error).not.toBeNull();
    expect((await rpc(demo, flaky, 'list_likes', { p_kind: 'sent' })).error).toBeNull();
    const g = user('likegone@email.com');
    const first = ((await rpc(demo, g, 'list_likes', { p_kind: 'received' })).data as { like_id: string }[])[0];
    expect((await rpc(demo, g, 'accept_like', { p_like_id: first.like_id })).error?.message).toBe('not_available');
  });

  test('보낸 호감 · 서로 호감 · 차단 · 신고 · 10 상태 · 12 이름(2단계 연결 창구)', async () => {
    const demo = createDemoLikes({ now: () => T0, people: (id) => (id === 'demo-cand-1' ? { name: '김OO', age: 32, region: { sido: '서울', sigungu: '강남구' } } : null) });
    const u = user('c@email.com');
    expect(demo.noteSent(u, 'demo-cand-1')).toEqual({ connected: false, matchId: null });
    const sent = (await rpc(demo, u, 'list_likes', { p_kind: 'sent' })).data as { user_id: string; card: { name: string } }[];
    expect(sent.map((x) => x.user_id)).toEqual(['demo-cand-1', 'demo-sent-1']);
    expect(sent[0].card.name).toBe('김OO');
    expect(demo.pairState(u, 'demo-cand-1', 2)?.data).toMatchObject({ state: 'sent', likes_left: 2 });
    expect(demo.pairState(u, 'demo-liker-1', 2)?.data).toMatchObject({ state: 'received', expires_at: new Date(T0 - 2 * HOUR + LIKE_EXPIRY_MS).toISOString() });
    expect(demo.pairState(u, 'demo-match-1', 2)?.data).toMatchObject({ state: 'connected' });
    expect(demo.pairState(u, 'nobody', 2)).toBeNull();
    expect(demo.noteSent(u, 'demo-liker-1').connected).toBe(true); // 상대가 이미 보낸 상태면 바로 연결
    expect(demo.profile(u, 'demo-match-1').data).toMatchObject({ user_id: 'demo-match-1', answers: { A12: '한OO', A01: 31 } });
    demo.noteBlock(u, 'demo-match-1');
    expect(((await rpc(demo, u, 'list_likes', { p_kind: 'connected' })).data as { user_id: string }[]).map((x) => x.user_id)).toEqual(['demo-liker-1']);
    expect(demo.profile(u, 'demo-match-1').data).toBeNull();
    expect(demo.report(u, 'demo-liker-2', 'RP9', null).error?.message).toBe('invalid_reason');
    expect(demo.report(u, 'demo-liker-2', 'RP8', '짧음').error?.message).toBe('description_required');
    expect(demo.report(u, 'demo-liker-2', 'RP3', null).error).toBeNull();
    expect(demo.report(u, 'demo-liker-2', 'RP3', null).error?.message).toBe('already_reported');
    expect(((await rpc(demo, u, 'list_likes', { p_kind: 'received' })).data as unknown[]).length).toBe(0); // 신고하면 즉시 숨김(P5-03)
    expect(demo.person('demo-liker-2')).toEqual({ name: '윤OO', age: 34, region: { sido: '서울', sigungu: '서초구' } });
  });

  test('0011 거절 숨김(likedecl): 보낸 호감을 상대가 바로 거절해도 보낸 사람에게는 만료 시각까지 대기와 같다(목록 행 · sent · 다시 보내기 막지 않음), 만료 뒤 조용히 사라진다', async () => {
    let t = T0;
    const demo = createDemoLikes({ now: () => t });
    const u = user('likedecl@email.com');
    demo.noteSent(u, 'demo-cand-1');
    const sent = (await rpc(demo, u, 'list_likes', { p_kind: 'sent' })).data as { user_id: string }[];
    expect(sent.map((x) => x.user_id)).toEqual(['demo-cand-1', 'demo-sent-1']);
    expect((demo.pairState(u, 'demo-cand-1', 2)?.data as { state: string }).state).toBe('sent');
    expect(demo.declined(u, 'demo-cand-1')).toBe(false); // 만료 전: forbidden 이 아니다(서버는 already_sent)
    expect(demo.peek(u).declinedByThem).toEqual(['demo-cand-1']); // 서버에는 거절 기록이 남는다
    t = T0 + 7 * 24 * 3_600_000 + 1;
    const after = (await rpc(demo, u, 'list_likes', { p_kind: 'sent' })).data as { user_id: string }[];
    expect(after.map((x) => x.user_id)).not.toContain('demo-cand-1');
    expect(demo.declined(u, 'demo-cand-1')).toBe(true); // 만료 뒤: 다시 보내기 forbidden(거절된 쌍 영구 제외)
  });

  test('거절한 사람 쪽(규칙 ②): 받은 호감을 거절하면 그 쌍은 바로 다시 보내기 forbidden · 상태 none', async () => {
    const demo = createDemoLikes({ now: () => T0 });
    const u = user('a@email.com');
    const rec = (await rpc(demo, u, 'list_likes', { p_kind: 'received' })).data as { like_id: string; user_id: string }[];
    const first = rec.find((x) => x.user_id === 'demo-liker-1') as { like_id: string };
    await rpc(demo, u, 'decline_like', { p_like_id: first.like_id });
    expect(demo.declined(u, 'demo-liker-1')).toBe(true);
    expect((demo.pairState(u, 'demo-liker-1', 2)?.data as { state: string }).state).toBe('none'); // 같은 날 다시 열면 none → [호감 보내기]는 forbidden → 앱은 버튼만 숨긴다(규칙 ②)
  });
});

describe('10 하단 버튼 규칙 (likeGate, 0011 뒤)', () => {
  test('상태 그대로: none 은 보낼 수 있음(한도 0 이면 흐림) · sent · received · connected — 보냈던 상대 기억(옛 단서 ①)은 없다', () => {
    expect(likeButtonMode({ state: 'none', likesLeft: 2 })).toBe('send');
    expect(likeButtonMode({ state: 'none', likesLeft: 0 })).toBe('limit');
    expect(likeButtonMode({ state: 'sent', likesLeft: 2 })).toBe('sent'); // 0011: 상대가 거절했어도 만료까지 sent
    expect(likeButtonMode({ state: 'received', likesLeft: 2 })).toBe('received');
    expect(likeButtonMode({ state: 'connected', likesLeft: 2 })).toBe('connected');
    expect(likeButtonMode(null)).toBe('send'); // 상태를 못 읽으면 서버가 최종으로 막는다
  });

  test('보내기 실패 뒤(규칙 ②, 거절한 사람이 같은 날 연 상대): forbidden 인데 프로필이 보이면 숨김(글 없음) · 안 보이면 볼 수 없음 · 한도 · 이미 보냄 · 그 밖', () => {
    expect(sendFailureMode('unavailable', true)).toBe('hidden');
    expect(sendFailureMode('unavailable', false)).toBe('unavailable');
    expect(sendFailureMode('limit', true)).toBe('limit');
    expect(sendFailureMode('already', true)).toBe('sent');
    expect(sendFailureMode('network', true)).toBe('error');
    expect(sendFailureMode('server', true)).toBe('error');
  });
});

describe('글 원본 대조 (카피 그대로)', () => {
  const copyMd = read('마케팅', '카피.md');
  const k2 = read('기획', '화면_요구사항.md');
  const policy = read('기획', '정책.md');

  test('[확정] 글은 카피.md 11 에 글자 그대로 있다', () => {
    const confirmed = [
      LIKES.headerTitle, LIKES.tabs.sent, LIKES.tabs.received, LIKES.tabs.connected, LIKES.receivedLabel, LIKES.sentLabel, LIKES.connectedNote,
      LIKES.accept, LIKES.decline, LIKES.emptyReceivedTitle, LIKES.emptyReceivedBody, LIKES.emptyReceivedButton, LIKES.emptySent,
      LIKES.emptyConnectedTitle, LIKES.emptyConnectedBody, LIKES.acceptFailed, LIKES.unavailable,
    ];
    const section = copyMd.slice(copyMd.indexOf('### 11 호감'), copyMd.indexOf('### 12 설정'));
    expect(section.length).toBeGreaterThan(100);
    for (const text of confirmed) expect(section).toContain(text);
  });

  test('[K2] · [가안] 글은 화면_요구사항 · 정책 문서에 그대로 있다', () => {
    expect(k2).toContain(`토스트 "${LIKES.acceptDone}"`);
    expect(k2).toContain(`토스트 "${LIKES.declineDone}"`); // N18
    expect(k2).toContain('`{n}분 전`, 24시간 미만 `{n}시간 전`, 어제 `어제`, 2~6일 `{n}일 전`, 7일 이상 `{월}월 {일}일`'); // R12
    expect(policy).toContain(`"${LIKES.expiresIn(1).replace('1', '{n}')}" · "${LIKES.expiresToday}"`); // NK05
  });
});
