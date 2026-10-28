// LG-F 탑승객 라운지 — 서버 응답 읽기(0042 모양) · 데모 모의 서버(= 0042 응답 모양) · 화면 규칙 · 아이콘 원본 · 정적 규칙(LGF-01 · 02 · 03 · 09 · 11 · 14)
//  기준: backend/R_변경기록.md 10-4 · migrations/0042_lounge.sql(lounge_state · lounge_post_json) · 보안/LG_라운지위협.md 7장 · 카피.md 19-11
import fs from 'node:fs';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createDemoLounge, DEMO_LOUNGE_CHANNEL, DEMO_LOUNGE_MY_SEAT, DEMO_LOUNGE_OTHERS, LOUNGE_RULES_NOW, LOUNGE_SCENES, loungeSceneOfEmail, type DemoLoungeUser, type LoungeFlight } from '@/demo/loungeDemo';
import { createLoungeApi, LOUNGE_MAX_POSTS, LOUNGE_OFF, parsePost, parseState, pickEvent, type LoungeEvent, type LoungePost, type MemberPost } from '@/features/lounge/loungeApi';
import { LOUNGE } from '@/features/lounge/loungeCopy';
import { LOUNGE_ICON_PATHS } from '@/features/lounge/LoungeIcon';
import { colors } from '@/theme/tokens';
import { balanceResultText, captainText, hideSeatPosts, mergePost, quoteLine, removePost, rowLineOf, sendErrorText, tripName } from '@/features/lounge/loungeLogic';

import { testOutside } from './helpers/outsideDocs';

const APP = path.resolve(__dirname, '..', '..');
const SRC = path.join(APP, 'src');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []));
const appFiles = walk(SRC).filter((f) => !f.includes(`${path.sep}__tests__${path.sep}`));
const LOUNGE_FILES = [...walk(path.join(SRC, 'features', 'lounge')), path.join(SRC, 'demo', 'loungeDemo.ts'), path.join(SRC, 'demo', 'loungeDemoScenes.ts'), path.join(SRC, 'app', 'lounge.tsx'), path.join(SRC, 'theme', 'loungeLook.ts')];
const code = (f: string) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// 데모 모의 서버를 실서버와 같은 파서로 읽는다(supabase 클라이언트 모양만 흉내)
function demoRig(email = 'loungeon@email.com', opts: { flight?: LoungeFlight; switchOn?: boolean } = {}) {
  const user: DemoLoungeUser = { id: `u-${email}`, email };
  const demo = createDemoLounge({ flight: () => opts.flight ?? 'in', switchOn: async () => opts.switchOn ?? true, replyMs: 5 });
  const client = { rpc: (name: string, args?: Record<string, unknown>) => demo.rpc(user, name, args), channel: (n: string) => demo.channel(n), removeChannel: (c: unknown) => demo.removeChannel(c) } as unknown as SupabaseClient;
  return { user, demo, api: createLoungeApi(client), raw: (name: string, args: Record<string, unknown> = {}) => demo.rpc(user, name, args) };
}

// 0042 lounge_post_json · lounge_state 의 응답 키(R_변경기록 10-4) — 데모가 이 밖의 키를 내면 안 된다(회원 id · 개수 · 객실 번호 · 인원 0)
const MEMBER_KEYS = ['id', 'seat', 'kind', 'body', 'at', 'mine', 'tag', 'quote'];
const MINE_KEYS = [...MEMBER_KEYS, 'received', 'help'].sort();
const OTHER_KEYS = [...MEMBER_KEYS, 'empathized'].sort();
const CAPTAIN_KEYS = ['id', 'seat', 'kind', 'captain', 'captain_kind', 'at', 'pick', 'pick_open', 'result'].sort();
const STATE_KEYS = ['state', 'trip_no', 'seat', 'channel', 'posts', 'captain', 'rules_version', 'has_seat'];

describe('LG-F 응답 읽기(0042 모양)', () => {
  test('글 한 개: 회원 글 · 답 글 · 인용(보임 · 가림 · 지움) · 기장 글 · 모르는 꼴은 버림', () => {
    const m = parsePost({ id: 'a', seat: '13A', kind: 'answer', body: '안녕하세요', at: '2026-12-20T12:00:00Z', mine: false, tag: 'answer', quote: { id: 'q', seat: '14B', body: '원글' }, empathized: true, user_id: 'x', count: 3 }) as MemberPost;
    expect(m).toEqual({ kind: 'answer', id: 'a', seat: '13A', body: '안녕하세요', at: Date.parse('2026-12-20T12:00:00Z'), mine: false, tag: 'answer', quote: { id: 'q', state: 'shown', seat: '14B', body: '원글' }, empathized: true, received: false, help: false });
    expect((parsePost({ id: 'b', seat: '13A', kind: 'member', body: 'x', at: '2026-12-20T12:00:00Z', mine: false, tag: null, quote: { id: 'q', state: 'hidden' } }) as MemberPost).quote).toEqual({ id: 'q', state: 'hidden' });
    expect((parsePost({ id: 'b', seat: '13A', kind: 'member', body: 'x', at: '2026-12-20T12:00:00Z', mine: false, tag: null, quote: { id: 'q', state: 'deleted' } }) as MemberPost).quote).toEqual({ id: 'q', state: 'deleted' });
    expect(parsePost({ id: 'c', seat: null, kind: 'captain', captain: 'b03', captain_kind: 'balance', at: '2026-12-19T11:00:00Z', pick: 'a', pick_open: true, result: null })).toEqual({ kind: 'captain', id: 'c', captainKey: 'b03', captainKind: 'balance', at: Date.parse('2026-12-19T11:00:00Z'), pick: 'a', pickOpen: true, result: null });
    expect(parsePost({ id: 'd', seat: '20A', kind: 'member', body: 'x', at: '2026-12-20T12:00:00Z' })).toBeNull(); // 좌석 꼴(11 ~ 19열 × A ~ F) 밖
    expect(parsePost({ id: 'e', seat: '13A', kind: 'photo', body: 'x', at: '2026-12-20T12:00:00Z' })).toBeNull(); // 사진 · 음성 · 파일 글 0
  });

  test('상태: 0042 state 12가지만 · 채널 꼴(lounge:<uuid>)만 · 최근 200개까지', () => {
    expect(parseState({ state: 'nope' })).toBeNull();
    const posts = Array.from({ length: 230 }, (_, i) => ({ id: `p${String(i).padStart(3, '0')}`, seat: '13A', kind: 'member', body: 'x', at: new Date(Date.parse('2026-12-20T00:00:00Z') + i * 1000).toISOString(), mine: false, tag: null, quote: null, empathized: false }));
    const st = parseState({ state: 'open', trip_no: 1, seat: '13A', channel: 'lounge:00000000-0000-4000-8000-0000000000a1', posts, member_count: 50, room_no: 3 });
    expect(st?.posts).toHaveLength(LOUNGE_MAX_POSTS); // LGF-11 최근 200개
    expect(st?.posts[st.posts.length - 1].id).toBe('p229');
    expect(Object.keys(st ?? {})).not.toContain('memberCount');
    expect(parseState({ state: 'open', channel: 'realtime:public' })?.channel).toBeNull();
  });

  test('LGF-02 실시간 내용: id · seat · body · at 넷만 읽는다(다른 키가 와도 0)', () => {
    const e = pickEvent({ type: 'broadcast', event: 'post', payload: { id: 'x1', seat: '13A', body: '글', at: '2026-12-20T12:00:00Z', user_id: 'secret', email: 'a@b.c', room_no: 2 } }) as LoungeEvent;
    expect(Object.keys(e).sort()).toEqual(['at', 'body', 'id', 'seat']);
    expect(JSON.stringify(e)).not.toMatch(/secret|a@b\.c|room_no/);
    expect(pickEvent({ payload: { seat: '13A' } })).toBeNull();
    expect(pickEvent({ payload: { id: 'g', seat: null, body: null, at: null } })).toEqual({ id: 'g', seat: null, body: null, at: null });
  });

  test('오류: 스위치 꺼짐 feature_off · forbidden(42501) → off · 인터넷 → network · {ok:false, code} 는 code 그대로', async () => {
    const mk = (r: unknown) => createLoungeApi({ rpc: async () => r } as unknown as SupabaseClient);
    expect(await mk({ data: null, error: { code: '42501', message: 'feature_off' } }).state()).toEqual({ ok: false, code: LOUNGE_OFF });
    expect(await mk({ data: null, error: { code: '42501', message: 'forbidden' } }).state()).toEqual({ ok: false, code: LOUNGE_OFF });
    expect(await mk({ data: null, error: { code: null, message: 'Failed to fetch' } }).state()).toEqual({ ok: false, code: 'network' });
    expect(await mk({ data: { ok: false, code: 'filtered', codes: ['url', 'contact'] }, error: null }).post('x', null, null)).toEqual({ ok: false, code: 'filtered', codes: ['url', 'contact'] });
    expect(await mk({ data: { ok: false, code: 'rules_changed', rules_version: 'lounge-rules-2026.11.01-v1' }, error: null }).agree('old')).toEqual({ ok: false, code: 'rules_changed', rulesVersion: 'lounge-rules-2026.11.01-v1' });
    expect(await mk({ data: { ok: true }, error: null }).report('p', 'RP4', '')).toEqual({ ok: true, data: null });
  });
});

describe('LG-F 데모 모의 서버 = 0042 응답 모양 · 같은 파서로 읽힘', () => {
  test('장면 12(이메일) · 첫 입장: intro(약속 판) → 동의 → stub → 쪽지 뜯기 = 좌석 → open(가상 탑승객 20좌석)', async () => {
    expect(LOUNGE_SCENES).toHaveLength(12);
    expect(loungeSceneOfEmail('loungedark1@email.com')).toBe('lightsOut');
    expect(loungeSceneOfEmail('someone@email.com')).toBeNull();
    const { api, raw } = demoRig('loungefirst@email.com');
    const s0 = await api.state();
    expect(s0.ok && s0.data.code).toBe('intro');
    expect(s0.ok && s0.data.rulesVersion).toBe(LOUNGE_RULES_NOW);
    expect(await api.takeSeat()).toEqual({ ok: false, code: 'intro' }); // 동의 없이 좌석 0
    expect(await api.agree('lounge-rules-2026.01.01-v1')).toEqual({ ok: false, code: 'rules_changed', rulesVersion: LOUNGE_RULES_NOW });
    expect(await api.agree(LOUNGE_RULES_NOW)).toEqual({ ok: true, data: null });
    const s1 = await api.state();
    expect(s1.ok && s1.data.code).toBe('stub');
    expect(await api.takeSeat()).toEqual({ ok: true, data: { seat: DEMO_LOUNGE_MY_SEAT } });
    expect(await api.takeSeat()).toEqual({ ok: true, data: { seat: DEMO_LOUNGE_MY_SEAT } }); // 다시 들어와도 같은 좌석(PL-06)
    const s2 = await api.state();
    expect(s2.ok && s2.data.code).toBe('open');
    const seats = new Set((s2.ok ? s2.data.posts : []).filter((p): p is MemberPost => p.kind !== 'captain').map((p) => p.seat));
    expect(seats.size).toBeGreaterThanOrEqual(10);
    expect(new Set(DEMO_LOUNGE_OTHERS).size).toBe(20);
    expect(DEMO_LOUNGE_OTHERS).not.toContain(DEMO_LOUNGE_MY_SEAT);
    // 응답 키 = 0042 키뿐(회원 id · 개수 · 객실 번호 · 인원 0 — 보안 LGS-06 · LG-g 와 같은 눈)
    const r = await raw('lounge_state');
    const data = r.data as Record<string, unknown>;
    for (const k of Object.keys(data)) expect(STATE_KEYS).toContain(k);
    expect(data.channel).toBe(DEMO_LOUNGE_CHANNEL);
    for (const p of data.posts as Record<string, unknown>[]) {
      const keys = Object.keys(p).sort();
      if (p.kind === 'captain') expect(keys).toEqual(CAPTAIN_KEYS);
      else expect(keys).toEqual(p.mine ? MINE_KEYS : OTHER_KEYS);
    }
    expect(JSON.stringify(data)).not.toMatch(/user_?id|email|room_no|count|member_count|reporter/i);
  });

  test('각 장면의 state: 평소 · 아침(결과) · 불 끈 시간 · 착륙 준비 · 닫힘 · 기장 안내만 · 빈 객실 · 쓰기 멈춤 · 강퇴 · 나감 · 약속 바뀜', async () => {
    const want: [string, string][] = [
      ['loungeon', 'open'],
      ['loungemorning', 'open'],
      ['loungedark', 'lights_out'],
      ['loungeland', 'landing'],
      ['loungeclosed', 'closed'],
      ['loungecaptain', 'captain_only'],
      ['loungeempty', 'empty_room'],
      ['loungepaused', 'paused'],
      ['loungekicked', 'kicked'],
      ['loungeleft', 'left'],
      ['loungerules', 'intro'],
    ];
    for (const [email, state] of want) {
      const { api } = demoRig(`${email}@email.com`);
      const r = await api.state();
      expect([email, r.ok && r.data.code]).toEqual([email, state]);
    }
    const cap = await demoRig('loungecaptain@email.com').api.state();
    expect(cap.ok && cap.data.captain.length).toBeGreaterThan(0);
    expect(cap.ok && cap.data.seat).toBeNull(); // 기장 안내만: 좌석 배정 0
    const rules = await demoRig('loungerules@email.com').api.state();
    expect(rules.ok && rules.data.hasSeat).toBe(true);
    // 탑승권 데모가 '탄 사람'이 아니면 줄 0(none) · 공개 뒤는 closed
    expect((await demoRig('x@email.com', { flight: 'none' }).api.state()).ok && true).toBe(true);
    const none = await demoRig('x@email.com', { flight: 'none' }).api.state();
    expect(none.ok && none.data.code).toBe('none');
    const after = await demoRig('x@email.com', { flight: 'after' }).api.state();
    expect(after.ok && after.data.code).toBe('closed');
    const late = await demoRig('x@email.com', { flight: 'late' }).api.state();
    expect(late.ok && late.data.code).toBe('landing');
  });

  test('글 쓰기 실패 code(19-11): 거르기 4종 · 길이 · 1분 한도 · 빈 글 · 인용 · 답 · 소등 · 닫힘 · 쓰기 멈춤 · 빈 객실', async () => {
    const { api } = demoRig('loungeon@email.com');
    expect(await api.post('010-1234-5678 로 연락 주세요', null, null)).toEqual({ ok: false, code: 'filtered', codes: ['contact'] });
    expect(await api.post('www.example.com 보세요', null, null)).toMatchObject({ ok: false, code: 'filtered', codes: ['url'] });
    expect(await api.post('계좌로 송금 부탁해요', null, null)).toMatchObject({ ok: false, code: 'filtered', codes: ['money'] });
    expect(await api.post('가'.repeat(201), null, null)).toEqual({ ok: false, code: 'too_long' });
    expect(await api.post('   ', null, null)).toEqual({ ok: false, code: 'empty' });
    expect(await api.post('없는 인용', 'nope', null)).toEqual({ ok: false, code: 'quote_invalid' });
    expect(await api.post('없는 질문', null, 'nope')).toEqual({ ok: false, code: 'answer_invalid' });
    for (let i = 0; i < 5; i += 1) expect((await api.post(`안녕하세요 ${'가'.repeat(i)}`, null, null)).ok).toBe(true);
    expect(await api.post('여섯째 글', null, null)).toEqual({ ok: false, code: 'rate_minute' });
    expect(await demoRig('loungedark@email.com').api.post('밤 글', null, null)).toEqual({ ok: false, code: 'lights_out' });
    expect(await demoRig('loungeland@email.com').api.post('착륙 글', null, null)).toEqual({ ok: false, code: 'closed' });
    expect(await demoRig('loungepaused@email.com').api.post('멈춤 글', null, null)).toEqual({ ok: false, code: 'paused' });
    expect(await demoRig('loungeempty@email.com').api.post('빈 객실 글', null, null)).toEqual({ ok: false, code: 'read_only' });
    expect(await demoRig('loungekicked@email.com').api.post('강퇴 글', null, null)).toEqual({ ok: false, code: 'kicked' });
  });

  test('공감(소등 · 착륙 준비 0) · 숨김 · 신고(사유 5 · 소등 · 착륙 준비 중에도) · 위기 낱말 help(쓴 사람만)', async () => {
    const open = demoRig('loungeon@email.com');
    const s = await open.api.state();
    const other = (s.ok ? s.data.posts : []).find((p): p is MemberPost => p.kind !== 'captain' && !p.mine) as MemberPost;
    expect(await open.api.empathy(other.id, true)).toEqual({ ok: true, data: { on: true } });
    const again = await open.api.getPost(other.id);
    expect(again.ok && (again.data as MemberPost).empathized).toBe(true);
    expect(JSON.stringify((await open.raw('lounge_get_post', { p_post: other.id })).data)).not.toMatch(/count|empathy_?by|seats/);
    const posted = await open.api.post('요즘 너무 힘들어서 죽고 싶다는 생각도 해요', null, null);
    expect(posted.ok && posted.data.help).toBe(true);
    expect(posted.ok && (posted.data.post as MemberPost).help).toBe(true);
    for (const scene of ['loungedark', 'loungeland']) {
      const r = demoRig(`${scene}@email.com`);
      const st = await r.api.state();
      const p = (st.ok ? st.data.posts : []).find((x): x is MemberPost => x.kind !== 'captain' && !x.mine) as MemberPost;
      expect((await r.api.empathy(p.id, true)).ok).toBe(false); // 공감 0
      expect(await r.api.report(p.id, 'RP4', '')).toEqual({ ok: true, data: null }); // 신고는 됨
      expect(await r.api.hide(p.id, true)).toEqual({ ok: true, data: { on: true } }); // 숨김도 됨
    }
    expect((await open.raw('lounge_report', { p_post: other.id, p_reason: 'RP1' })).data).toEqual({ ok: false, code: 'invalid' }); // RP1 ~ RP3 0
  });

  test('0043 신고 쌍 안내 get_lounge_report_note: RP4 · RP6 · RP7 + 17:30 전 + 3쌍까지만 no_pair · RP5 · RP8 · 착륙 준비 뒤 · 4쌍째는 아님', async () => {
    const { api } = demoRig('loungeon@email.com');
    const st = await api.state();
    const others = (st.ok ? st.data.posts : []).filter((p): p is MemberPost => p.kind !== 'captain' && !p.mine);
    const bySeat = [...new Map(others.map((p) => [p.seat, p])).values()];
    await api.report(bySeat[0].id, 'RP5', '');
    expect(await api.reportNote(bySeat[0].id)).toEqual({ ok: true, data: { noPair: false } });
    for (let i = 1; i <= 4; i += 1) {
      await api.report(bySeat[i].id, 'RP4', '');
      expect([i, await api.reportNote(bySeat[i].id)]).toEqual([i, { ok: true, data: { noPair: i <= 3 } }]);
    }
    expect(await api.reportNote('nope')).toEqual({ ok: false, code: 'not_found' });
    const land = demoRig('loungeland@email.com');
    const ls = await land.api.state();
    const lp = (ls.ok ? ls.data.posts : []).find((p): p is MemberPost => p.kind !== 'captain' && !p.mine) as MemberPost;
    await land.api.report(lp.id, 'RP7', '');
    expect(await land.api.reportNote(lp.id)).toEqual({ ok: true, data: { noPair: false } }); // 17:30 뒤 접수 = 짝 제외 0
  });

  test('실시간 흉내: 내 객실 채널만 · 내용 키 넷 · 글 → post · 지우기 → gone · 1.5초 뒤 가상 탑승객 답', async () => {
    const { api, demo } = demoRig('loungeon@email.com');
    const got: { kind: string; e: LoungeEvent }[] = [];
    const off = api.subscribe(DEMO_LOUNGE_CHANNEL, { onPost: (e) => got.push({ kind: 'post', e }), onGone: (e) => got.push({ kind: 'gone', e }) });
    await new Promise((r) => setTimeout(r, 10));
    expect(demo.joinedCount()).toBe(1);
    const p = await api.post('반가워요', null, null);
    expect(p.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 40));
    expect(got.filter((x) => x.kind === 'post').length).toBeGreaterThanOrEqual(2); // 내 글 + 가상 탑승객 답
    const id = p.ok && p.data.post ? p.data.post.id : '';
    expect(await api.remove(id)).toEqual({ ok: true, data: null });
    expect(got.some((x) => x.kind === 'gone' && x.e.id === id)).toBe(true);
    for (const x of got) expect(Object.keys(x.e).sort()).toEqual(['at', 'body', 'id', 'seat']);
    off();
    await new Promise((r) => setTimeout(r, 5));
    expect(demo.joinedCount()).toBe(0);
    api.subscribe('lounge:00000000-0000-4000-8000-0000000000ff', { onPost: () => undefined, onGone: () => undefined }); // 남의 객실 채널 = 못 들어감
    await new Promise((r) => setTimeout(r, 10));
    expect(demo.joinedCount()).toBe(0);
  });

  test('LGF-09 스위치: 서버(데모) 스위치가 꺼지면 모든 함수 feature_off → off', async () => {
    const { api } = demoRig('loungeon@email.com', { switchOn: false });
    expect(await api.state()).toEqual({ ok: false, code: LOUNGE_OFF });
    expect(await api.post('x', null, null)).toEqual({ ok: false, code: LOUNGE_OFF });
  });
});

describe('LG-F 화면 규칙(loungeLogic)', () => {
  test('T4 줄 글(19-2): 비행 중 상태만 · none · closed · left · 꺼짐 · 실패 = 줄 0', () => {
    expect(rowLineOf('intro')).toBe(LOUNGE.row.lineFirst);
    expect(rowLineOf('stub')).toBe(LOUNGE.row.lineFirst);
    expect(rowLineOf('open')).toBe(LOUNGE.row.lineSeated);
    expect(rowLineOf('empty_room')).toBe(LOUNGE.row.lineSeated);
    expect(rowLineOf('paused')).toBe(LOUNGE.row.lineSeated);
    expect(rowLineOf('lights_out')).toBe(LOUNGE.row.lineLightsOut);
    expect(rowLineOf('landing')).toBe(LOUNGE.row.lineLanding);
    expect(rowLineOf('captain_only')).toBe(LOUNGE.row.lineCaptainOnly);
    expect(rowLineOf('kicked')).toBe(LOUNGE.row.lineKicked);
    for (const c of ['none', 'closed', 'left', 'off', 'failed'] as const) expect(rowLineOf(c)).toBeNull();
  });

  test('보내기 실패 글(19-8 · 19-11): code 마다 한 줄 · 거르기는 연락처 → 링크 → 금전 → 욕설 차례 첫 하나 · 숫자 0', () => {
    expect(sendErrorText('filtered', ['abuse', 'url'])).toBe(LOUNGE.error.link);
    expect(sendErrorText('filtered', ['money', 'contact'])).toBe(LOUNGE.error.contact);
    const map: [string, string][] = [
      ['read_only', LOUNGE.error.readOnly],
      ['lights_out', LOUNGE.error.lightsOut],
      ['closed', LOUNGE.error.closed],
      ['paused', LOUNGE.error.paused],
      ['empty', LOUNGE.error.empty],
      ['too_long', LOUNGE.error.tooLong],
      ['rate_minute', LOUNGE.error.rate],
      ['rate_day', LOUNGE.error.daily],
      ['quote_invalid', LOUNGE.error.quoteInvalid],
      ['answer_invalid', LOUNGE.error.answerInvalid],
      ['network', LOUNGE.error.offline],
      ['server', LOUNGE.error.sendFailed],
    ];
    for (const [c, t] of map) expect(sendErrorText(c)).toBe(t);
    for (const [, t] of map) expect(t).not.toMatch(/\d/);
  });

  test('목록: 200개까지 · 지운 글은 인용 상자 지움 · 숨긴 좌석은 글을 빼고 인용 상자 가림', () => {
    const mk = (i: number, seat = '13A', quote: MemberPost['quote'] = null): LoungePost => ({ kind: 'member', id: `p${String(i).padStart(3, '0')}`, seat, body: `글${i}`, at: i, mine: false, tag: null, quote, empathized: false, received: false, help: false });
    let list: LoungePost[] = Array.from({ length: 200 }, (_, i) => mk(i));
    list = mergePost(list, mk(500));
    expect(list).toHaveLength(200);
    expect(list[0].id).toBe('p001');
    const two = [mk(1, '13A'), mk(2, '14B', { id: 'p001', state: 'shown', seat: '13A', body: '글1' })];
    expect((removePost(two, 'p001')[0] as MemberPost).quote).toEqual({ id: 'p001', state: 'deleted' });
    const hiddenList = hideSeatPosts(two, '13A');
    expect(hiddenList.map((p) => p.id)).toEqual(['p002']);
    expect((hiddenList[0] as MemberPost).quote).toEqual({ id: 'p001', state: 'hidden' });
    expect(quoteLine({ id: 'p001', state: 'hidden' }, () => true).text).toBe(LOUNGE.quote.hiddenSeat);
    expect(quoteLine({ id: 'p001', state: 'hidden' }, () => false).text).toBe(LOUNGE.quote.unavailable);
    expect(quoteLine({ id: 'p001', state: 'deleted' }, () => false).text).toBe(LOUNGE.msg.deleted);
    expect(quoteLine({ id: 'x', state: 'shown', seat: '13A', body: '가'.repeat(50) }, () => false).text).toBe(`${'가'.repeat(40)}…`);
  });

  test('기장 글 · 둘 중 하나 결과 말 세 단계(숫자 · 비율 0) · 여행지 차례', () => {
    expect(captainText('q04')?.question).toBe(LOUNGE.captain.q04);
    expect(captainText('b03')).toEqual({ question: LOUNGE.captain.b03[0], a: LOUNGE.captain.b03[1], b: LOUNGE.captain.b03[2] });
    expect(captainText('zzz')).toBeNull();
    const bal = { kind: 'captain' as const, id: 'b', captainKey: 'b03', captainKind: 'balance' as const, at: 1, pick: null, pickOpen: false, result: null };
    const morn = (level: 'even' | 'slight' | 'much', side: 'a' | 'b' | null) => ({ kind: 'captain' as const, id: 'm', captainKey: 'morning', captainKind: 'morning' as const, at: 2, pick: null, pickOpen: false, result: { level, side } });
    expect(balanceResultText([bal, morn('even', null)], morn('even', null))?.text).toBe(LOUNGE.balance.even);
    expect(balanceResultText([bal, morn('slight', 'a')], morn('slight', 'a'))?.text).toBe(LOUNGE.balance.slight('짜장면'));
    expect(balanceResultText([bal, morn('much', 'b')], morn('much', 'b'))?.text).toBe(LOUNGE.balance.much('짬뽕'));
    expect(tripName(1)).toBe('경주');
    expect(tripName(13)).toBe('경주');
    expect(tripName(null)).toBeNull();
  });
});

describe('LG-F 정적 규칙 · 아이콘 원본', () => {
  test('LGF-01 채널 직접 보내기 · Presence · 입력 중 0(app/src, 시험 제외)', () => {
    const hits = appFiles.filter((f) => /channel\.send|\.track\(|presenceState|['"]presence['"]/i.test(code(f)));
    expect(hits.map((f) => path.relative(SRC, f))).toEqual([]);
    expect(LOUNGE_FILES.filter((f) => /typing|isTyping|readAt|read_at|online|접속 중|입력 중/.test(code(f))).map((f) => path.basename(f))).toEqual([]); // 입력 중 · 읽음 · 접속 표시 0(LT-08)
    const api = code(path.join(SRC, 'features', 'lounge', 'loungeApi.ts'));
    expect(api).toContain("on('broadcast', { event: 'post' }");
    expect(api).toContain("on('broadcast', { event: 'gone' }");
    expect(api).toContain('private: true');
  });

  test('LGF-03 기기 저장 · 로그: 라운지 코드에 AsyncStorage · localStorage · SecureStore 0 · safeLog 에 글 · 좌석 · 채널 0', () => {
    for (const f of LOUNGE_FILES) {
      const c = code(f);
      expect([path.basename(f), /AsyncStorage|localStorage|sessionStorage|SecureStore|secureStorage|chunkedStorage/.test(c)]).toEqual([path.basename(f), false]);
      for (const m of c.matchAll(/safeLog\(\{([^}]*)\}/g)) expect(m[1]).not.toMatch(/body|seat|channel|text/);
    }
  });

  test("화면 글 '익명' 0(app/src 문자열, 주석 제외) · LGF-14 탑승권 · 공유 · 내역 · 알림 화면 코드가 라운지를 읽지 않음(좌석 0)", () => {
    expect(appFiles.filter((f) => code(f).includes('익명')).map((f) => path.relative(SRC, f))).toEqual([]);
    const outside = appFiles.filter((f) => /features[\\/](boarding|settings|profile|safeShare)|lib[\\/]pushRegistration/.test(f));
    expect(outside.filter((f) => /features\/lounge|LOUNGE\.|loungeApi/.test(code(f))).map((f) => path.relative(SRC, f))).toEqual([]);
  });

  test('LGF-09 데모 모드에서 실서버 호출 0: 데모 라운지는 fetch 를 부르지 않는다', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => Promise.reject(new Error('네트워크 0'))) as never);
    const { api } = demoRig('loungeon@email.com');
    await api.state();
    await api.post('안녕하세요', null, null);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  testOutside(['디자인/LG_라운지/원본/paths.json'])('아이콘 9개 경로가 디자인 원본 paths.json 과 같다(켜짐 = 공감 면 accentSoft)', () => {
    const original = JSON.parse(fs.readFileSync(path.resolve(APP, '..', '디자인', 'LG_라운지', '원본', 'paths.json'), 'utf8')) as { strokeWidth: number; icons: Record<string, { name: string; parts: { role: string; d: string }[] }> };
    expect(original.strokeWidth).toBe(1.5);
    expect(Object.keys(LOUNGE_ICON_PATHS).sort()).toEqual(Object.keys(original.icons).sort());
    for (const [k, v] of Object.entries(original.icons)) expect(LOUNGE_ICON_PATHS[k as keyof typeof LOUNGE_ICON_PATHS]).toEqual(v);
    const on = fs.readFileSync(path.resolve(APP, '..', '디자인', 'LG_라운지', '원본', 'empathy_on.svg'), 'utf8');
    expect(on).toContain(`fill="${colors.accentSoft}"`); // 켜짐 = accentSoft(새 색 0)
  });
});
