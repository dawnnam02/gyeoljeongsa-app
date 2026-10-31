// 데모 모드 모의 서버의 기내 서비스 · 연애 기능 부분(IF2-F · D-223). 이름 · 인자 · 응답 모양 = 서버 0043(backend/R_변경기록.md 11-4):
//  get_home_state · get_magazine · get_week_card · pick_week_card(p_slot) · pre_answer_questions · preview_my_profile · get_pair_card(p_room)
//  3부-카(IF3-F 축소판): get_my_ways(G-04 · 0046) · get_my_birth_week(G-07 · 0046) — 별자리 코드 · 참/거짓 하나뿐(데모 값은 모의: 실제 천문 값 아님 · 참조표는 서버에만)
//  + 데모 전용 demo_inflight_scene({ p_scene }) — 홈 아래 데모 줄이 장면을 바꾼다(탑승권 데모 장면도 같이)
//  · 대화방 칸(opener_chips · talk_topics · send_chat_card · together_*)은 데모 채팅(features/chat/chatDemo)이 같은 모양으로 답한다
//  · 계산(타로 · 칩 · 별자리 · 일간 · 그 주 기운 · 변형)은 demo/funCalc — ai/IF2/fun_calc.py 시험값과 같다(시험 iffCalc). 키 = 데모 키
//  · 스위치가 꺼지면 feature_off(42501, 서버 require_feature 와 같음) · 상대 이름 · 사진 · 나이 · 별자리 이름 · 일간 · 띠 · 좌석 · 회차 번호 키 0
//  장면(이메일 앞부분 if2<장면> 또는 데모 줄 — 차례는 INFLIGHT_SCENES):
//   auto 탑승권 데모를 따라감(탐 = 비행 중 · 마감 뒤 = 착륙 준비 · 공개 짝 있음 · 짝 없음 · 그 밖 = 탑승 전)
//   before 탑승 전   inflight 비행 중(첫 회차 — 같은 취미 띠)   magBefore 비행 중 · 기내지 발행 전   landing 착륙 준비
//   matched 공개 뒤 짝 있음   noMatch 공개 뒤 짝 없음   overlap 겹칠 때(열린 방 + 이번 회차 탐)   reflect 방이 닫힌 뒤(돌아보기 메모가 기기에 있으면 B4)
//  · 여기 사람은 가상이다(실제 사람 아님). 서버 요청 0 · 기기 저장 0
import type { DemoBoarding, DemoBoardingUser } from './boardingDemo';
import { dayStem, pair4, pair5, pickDistinct, rel5Week, signElement, stemElement, sunSign, tarotCard, compatVariant, weekElement } from './funCalc';
import { DEMO_FUN_KEY, demoPairHobbies, demoShared } from './inflightShared';
import { kinOrder, myReligionOf, poolFor } from './people';
import lib from '@/content/if2Library.json';

type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { code: string; message: string } | null };
export type InflightScene = 'auto' | 'before' | 'inflight' | 'magBefore' | 'landing' | 'matched' | 'noMatch' | 'overlap' | 'reflect';
export const INFLIGHT_SCENES: readonly InflightScene[] = ['auto', 'before', 'inflight', 'magBefore', 'landing', 'matched', 'noMatch', 'overlap', 'reflect'];
const BOARDING_OF: Readonly<Record<Exclude<InflightScene, 'auto'>, string>> = {
  before: 'onsale',
  inflight: 'boarded',
  magBefore: 'boarded',
  landing: 'late',
  matched: 'matched',
  noMatch: 'none',
  overlap: 'boarded',
  reflect: 'onsale',
};

export type DemoInflightUser = DemoBoardingUser;
export type DemoInflightOptions = {
  boarding: DemoBoarding;
  flags: (u: DemoInflightUser) => Promise<Readonly<Record<string, boolean>>>;
  // 데모 계정: 생년월일(가입 때 받은 양력) · 유효 동의 · 공개 범위 · 프로필 미리보기 값
  account: (u: DemoInflightUser) => { birthDate: string | null; consentOn: (code: string) => boolean; sameHobby: boolean; previewAnswers: Row };
};

const ROUND = { no: 1, issue: '2026-12-17' }; // 탑승권 데모 1회차(판매 시작 12-17 목 = 발행 목요일)
const FIRST_ISSUE = '2026-12-17'; // 호 번호 1(첫 실제 회차 발행일)
// 기내지 응답의 issue_date — 하늘 52주 표(2027-01-07 ~)에 든 목요일로 보인다(창밖 하늘 G-02 를 데모에서 볼 수 있게). 호 번호 · 카드 값은 위 ROUND 그대로
export const DEMO_SKY_ISSUE = '2027-01-14';
const SIGN_ORDER = ['aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn'] as const;
const PARTNER_BIRTH = '1995-07-30'; // 데모 짝 생년월일(가상 — 계산만 · 응답에 0)

const sceneOfEmail = (email: string): InflightScene => {
  const l = (email.split('@')[0] ?? '').toLowerCase();
  const table: [string, InflightScene][] = [
    ['if2magbefore', 'magBefore'],
    ['if2inflight', 'inflight'],
    ['if2landing', 'landing'],
    ['if2matched', 'matched'],
    ['if2nomatch', 'noMatch'],
    ['if2overlap', 'overlap'],
    ['if2reflect', 'reflect'],
    ['if2before', 'before'],
  ];
  return table.find(([k]) => l.includes(k))?.[1] ?? 'auto';
};

const off = (): DbResult => ({ data: null, error: { code: '42501', message: 'feature_off' } });
const ok = (data: unknown): DbResult => ({ data, error: null });

export function createDemoInflight(o: DemoInflightOptions) {
  const scenes = new Map<string, InflightScene>();
  const picks = new Map<string, number>(); // 회원 → 고른 자리(그 회차)
  const sceneOf = (u: DemoInflightUser): InflightScene => {
    let s = scenes.get(u.id);
    if (!s) {
      s = sceneOfEmail(u.email);
      scenes.set(u.id, s);
      if (s !== 'auto') void o.boarding.rpc(u, 'demo_boarding_scene', { p_scene: BOARDING_OF[s] });
    }
    return s;
  };
  const roomId = (u: DemoInflightUser): string | null => {
    const pid = o.boarding.partnerIdOf(u);
    const n = pid ? pid.replace('demo-cand-', '') : null;
    return n ? `demo-chat-1-${n}` : null;
  };
  // 지금 단계(0043 get_home_state 와 같은 판단 차례: 이번 회차 탐 · 시각 → 열린 방 → 짝 없음)
  const stageOf = (u: DemoInflightUser): { stage: string; room: string | null } => {
    const s = sceneOf(u);
    const flight = o.boarding.flightOf(u);
    const bScene = o.boarding.sceneOf(u);
    const matchedRoom = (() => {
      // 겹침 장면은 지난 회차 방(데모 채팅 기본 방과 같은 id)을 연다 · 짝 있음은 탑승권 데모 짝의 방
      const pidRoom = roomId(u);
      const r = s === 'overlap' ? (pidRoom ?? overlapRoom(u)) : pidRoom;
      return r && !demoShared.roomGone(u.id, r) ? r : null;
    })();
    if (flight === 'in' || flight === 'late') {
      if (s === 'overlap') return { stage: 'overlap', room: matchedRoom };
      return { stage: flight === 'late' ? 'landing' : 'inflight', room: null };
    }
    if (bScene === 'matched' && matchedRoom) return { stage: 'matched', room: matchedRoom };
    if (bScene === 'none') return { stage: 'noMatch', room: null };
    return { stage: 'before', room: null };
  };
  // 겹침 장면: 탑승권 데모가 '탐'이라 짝이 없음 — 데모 채팅 기본 방(끼리끼리 첫 분 · demo-chat-1-{n})과 같은 id
  const overlapRoom = (u: DemoInflightUser): string | null => {
    const p = kinOrder(poolFor(u.email), 4, myReligionOf(u.email))[0];
    return p ? `demo-chat-1-${p.n}` : null;
  };

  async function homeState(u: DemoInflightUser): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.inflight_home) return off();
    const on = (k: string) => flags[k] === true;
    const s = sceneOf(u);
    const { stage, room } = stageOf(u);
    const acct = o.account(u);
    const meC = [on('type_card') ? 'type' : null, on('profile_preview') ? 'preview' : null].filter(Boolean);
    const blocks = ['B1'];
    const out: Row = { stage };
    if (stage === 'inflight' || stage === 'landing' || stage === 'overlap') {
      const pocket: Row[] = [];
      if (on('inflight_mag')) pocket.push({ kind: 'mag', state: s === 'magBefore' ? 'not_yet' : 'issued' });
      if (on('inflight_tarot')) {
        const slot = picks.get(u.id);
        pocket.push(slot !== undefined ? { kind: 'card', state: 'revealed', card: tarotCard(DEMO_FUN_KEY, u.id, ROUND.issue, slot) } : { kind: 'card', state: 'face_down' });
      }
      if (on('type_card')) pocket.push({ kind: 'type' });
      if (pocket.length) {
        blocks.push('B3');
        out.pocket = { cells: pocket };
      }
      const head = stage === 'landing' || o.boarding.flightOf(u) === 'late' ? 'landing' : 'arrival';
      const cells = [on('postcard') ? 'postcard' : null, on('pre_answer') ? 'pre_answer' : null].filter(Boolean);
      if (cells.length) {
        blocks.push('B4');
        out.status = { head, cells, writable: head === 'arrival' };
      }
      out.hobby_notice = stage === 'inflight' && on('same_points') && acct.sameHobby; // 데모 1회차 = 처음 탄 회차
      if (stage === 'overlap' && room) {
        blocks.push('B5');
        out.pair = { room_id: room, cells: [on('pair_card') ? 'pair_card' : null, on('meet_prep') ? 'meet_prep' : null, on('meet_memo') ? 'meet_memo' : null].filter(Boolean) };
      }
    } else if (stage === 'matched' && room) {
      blocks.push('B2');
      out.pair = { room_id: room, cells: [on('pair_card') ? 'pair_card' : null, on('values_talk') ? 'values_talk' : null].filter(Boolean) };
      const cells = [on('meet_prep') ? 'meet_prep' : null, on('meet_memo') ? 'meet_memo' : null].filter(Boolean);
      if (cells.length) {
        blocks.push('B4');
        out.status = { head: 'meet', cells, writable: true };
      }
    } else {
      if (meC.length) {
        blocks.push('B6');
        out.me = { cells: meC };
      }
      out.reflect_ok = on('meet_memo') && s === 'reflect';
    }
    blocks.push('B7');
    return ok({ ...out, blocks });
  }

  function issueNo(): number {
    return Math.floor((Date.parse(ROUND.issue) - Date.parse(FIRST_ISSUE)) / (7 * 86_400_000)) + 1;
  }

  async function magazine(u: DemoInflightUser): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.inflight_mag) return off();
    const { stage } = stageOf(u);
    if (!(stage === 'inflight' || stage === 'landing' || stage === 'overlap')) return ok({ state: 'none' });
    if (sceneOf(u) === 'magBefore') return ok({ state: 'not_yet' });
    const no = issueNo();
    const week = weekElement(ROUND.issue);
    const acct = o.account(u);
    const ck = acct.consentOn('CK17A');
    let sky: Row | null = null;
    let grain: Row | null = null;
    if (ck && acct.birthDate) {
      const sg = sunSign(acct.birthDate);
      const stem = dayStem(acct.birthDate);
      // 0046: sky = {signs: 달력 순 한두 개, zodiacs: 같은 차례 주간 글 id} — 대표 · 이웃 · 시작 전날 여부가 드러나지 않는다(R46)
      const zw = (code: string) => `zw-${code}-t${String(((no - 1) % 13) + 1).padStart(2, '0')}-v${Math.floor((no - 1) / 13) % 4}`;
      sky = { signs: sg.signs, zodiacs: sg.signs.map(zw) };
      grain = { stem, saju: `sw-${stem}-${week}-v${(Math.floor((no - 1) / 10) % 1) + 1}`, relation: rel5Week(stemElement(stem), week) };
    }
    return ok({ state: 'issued', issue_date: DEMO_SKY_ISSUE, trip_no: ((ROUND.no - 1) % 12) + 1, week_element: week, column: `col-${String(((no - 1) % 12) + 1).padStart(2, '0')}`, ck17a: ck, sky, grain });
  }

  // G-04: CK17A 켠 분만 · 태양 별자리 ±1 칸 안의 모의 금성 · 수성(경계 날 표시 0 — 별자리 하나씩) · 표 밖(1966 ~ 2008년생 밖) · 생년월일 없음 = none
  async function myWays(u: DemoInflightUser): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.my_ways) return off();
    const acct = o.account(u);
    if (!acct.consentOn('CK17A')) return ok({ ok: false, code: 'consent_required' });
    const year = acct.birthDate ? Number(acct.birthDate.slice(0, 4)) : NaN;
    if (!acct.birthDate || !(year >= 1966 && year <= 2008)) return ok({ ok: true, state: 'none' });
    const sun = SIGN_ORDER.indexOf(sunSign(acct.birthDate).sign as (typeof SIGN_ORDER)[number]);
    const m = Number(acct.birthDate.slice(5, 7));
    const d = Number(acct.birthDate.slice(8, 10));
    const at = (k: number) => SIGN_ORDER[(sun + k + 12) % 12];
    return ok({ ok: true, state: 'ready', venus: at((d % 3) - 1), mercury: at(((m + d) % 3) - 1) });
  }

  // G-07: 탑승 중인 회차가 있을 때만 · 생일(월 · 일)이 그 호 7일(목 ~ 수)에 들면 참. 이메일에 if3birth 가 들어 있으면 늘 참(데모에서 카드를 보려고)
  async function birthWeek(u: DemoInflightUser): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.birth_card) return off();
    const { stage } = stageOf(u);
    const acct = o.account(u);
    if (!(stage === 'inflight' || stage === 'landing' || stage === 'overlap') || !acct.birthDate) return ok({ ok: true, state: 'none' });
    if (u.email.toLowerCase().includes('if3birth')) return ok({ ok: true, state: 'ready', birthday_week: true });
    const md = Number(acct.birthDate.slice(5, 7)) * 100 + Number(acct.birthDate.slice(8, 10));
    const start = Date.parse(DEMO_SKY_ISSUE);
    const inWeek = [0, 1, 2, 3, 4, 5, 6].some((i) => {
      const t = new Date(start + i * 86_400_000);
      return (t.getUTCMonth() + 1) * 100 + t.getUTCDate() === md;
    });
    return ok({ ok: true, state: 'ready', birthday_week: inWeek });
  }

  async function weekCard(u: DemoInflightUser): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.inflight_tarot) return off();
    const { stage } = stageOf(u);
    if (!(stage === 'inflight' || stage === 'landing' || stage === 'overlap')) return ok({ state: 'none' });
    const slot = picks.get(u.id);
    return ok(slot === undefined ? { state: 'face_down' } : { state: 'revealed', slot, card: tarotCard(DEMO_FUN_KEY, u.id, ROUND.issue, slot) });
  }

  async function pickWeekCard(u: DemoInflightUser, args: Row): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.inflight_tarot) return off();
    const p = args.p_slot;
    if (typeof p !== 'number' || ![0, 1, 2].includes(p)) return ok({ ok: false, code: 'invalid_slot' });
    const { stage } = stageOf(u);
    if (!(stage === 'inflight' || stage === 'landing' || stage === 'overlap')) return ok({ ok: false, code: 'none' });
    const had = picks.get(u.id);
    if (had !== undefined) return ok({ ok: false, code: 'already_picked', slot: had, card: tarotCard(DEMO_FUN_KEY, u.id, ROUND.issue, had) });
    picks.set(u.id, p);
    return ok({ ok: true, slot: p, card: tarotCard(DEMO_FUN_KEY, u.id, ROUND.issue, p) });
  }

  // 미리 답해 두는 질문(0043 pre_questions: 깊이마다 5개 · 탑승객 모두 같음)
  async function preQuestions(u: DemoInflightUser): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.pre_answer) return off();
    const { stage } = stageOf(u);
    if (!(stage === 'inflight' || stage === 'landing' || stage === 'overlap')) return ok({ state: 'none' });
    const out: string[] = [];
    for (let d = 1; d <= 4; d += 1) {
      const pool = lib.questions.filter((q) => q.depth === d).map((q) => q.id).sort();
      out.push(...pickDistinct(DEMO_FUN_KEY, `pre:v1:${ROUND.no}:${d}`, pool.length, Math.min(5, pool.length)).map((i) => pool[i]));
    }
    return ok({ state: o.boarding.flightOf(u) === 'late' ? 'landing' : 'open', questions: out });
  }

  async function preview(u: DemoInflightUser): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.profile_preview) return off();
    const acct = o.account(u);
    return ok({ profile: { user_id: u.id, answers: acct.previewAnswers, photos: [], reasons: [] }, ck17b: acct.consentOn('CK17B'), same_hobby: acct.sameHobby });
  }

  // 궁합 카드(0043 get_pair_card): 열린 방만 · 같은 취미(두 분 켬 · 스위치) · 사주 · 별자리 줄은 두 분 CK17B + 계산 값이 있을 때만(데모 짝은 CK17B 켬)
  async function pairCard(u: DemoInflightUser, args: Row): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.pair_card) return off();
    const room = typeof args.p_room === 'string' ? args.p_room : '';
    const { room: open } = stageOf(u);
    if (!room || room !== open) return ok({ ok: false, code: 'not_found' });
    const acct = o.account(u);
    const mineB = acct.consentOn('CK17B') && acct.consentOn('CK17A');
    let saju: string | null = null;
    let star: string | null = null;
    if (mineB && acct.birthDate) {
      saju = `cs-${pair5(stemElement(dayStem(acct.birthDate)), stemElement(dayStem(PARTNER_BIRTH)))}-${compatVariant(DEMO_FUN_KEY, room, 'saju')}`;
      star = `cst-${pair4(signElement(sunSign(acct.birthDate).sign), signElement(sunSign(PARTNER_BIRTH).sign))}-${compatVariant(DEMO_FUN_KEY, room, 'star')}`;
    }
    return ok({ ok: true, card: { same: await demoPairHobbies(u.id), saju, star, ck17_mine: mineB, made_at: '2026-12-23T09:00:00Z' } });
  }

  function setScene(u: DemoInflightUser, args: Row): DbResult {
    const s = args.p_scene;
    if (typeof s !== 'string' || !(INFLIGHT_SCENES as readonly string[]).includes(s)) return { data: null, error: { code: 'P0001', message: 'invalid_value' } };
    scenes.set(u.id, s as InflightScene);
    picks.delete(u.id);
    demoShared.resetRooms(u.id);
    if (s !== 'auto') void o.boarding.rpc(u, 'demo_boarding_scene', { p_scene: BOARDING_OF[s as Exclude<InflightScene, 'auto'>] });
    return ok({ scene: s });
  }

  const handlers: Record<string, (u: DemoInflightUser, args: Row) => Promise<DbResult> | DbResult> = {
    get_home_state: (u) => homeState(u),
    get_magazine: (u) => magazine(u),
    get_week_card: (u) => weekCard(u),
    get_my_ways: (u) => myWays(u),
    get_my_birth_week: (u) => birthWeek(u),
    pick_week_card: pickWeekCard,
    pre_answer_questions: (u) => preQuestions(u),
    preview_my_profile: (u) => preview(u),
    get_pair_card: pairCard,
    demo_inflight_scene: setScene,
  };
  return {
    handles: (name: string) => name in handlers,
    rpc: (u: DemoInflightUser, name: string, args: Row = {}): Promise<DbResult> => Promise.resolve(handlers[name](u, args)),
    sceneOf: (u: DemoInflightUser) => sceneOf(u),
  };
}

export type DemoInflight = ReturnType<typeof createDemoInflight>;
