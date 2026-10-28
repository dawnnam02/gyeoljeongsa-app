// IF2-F 기내 서비스 · 연애 기능 — 계산 · 응답 읽기 · 데모 모의 서버 · 기기 저장 · 정적 규칙(보안 앱 시험 IFF-01 ~ 16 같은 번호 가운데 코드 · 데이터 몫)
//  기준: 정책 PF장 · 화면_요구사항 'T2 홈 — 새 구성' · 'T4 대화방 칸' · IF 화면 · 보안 IF2_위협 7장 · 서버 0043(R_변경기록 11-4) · ai/IF2 fun_calc.py · check_calc.py 시험값
//  서버 대신 데모 모의 서버(demo/inflightDemo · 데모 채팅 — 0043 응답 모양)를 실서버와 같은 파서(inflightApi)로 읽는다
import fs from 'node:fs';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import { demoDefault, FEATURE_KEY_LIST, FEATURE_KEYS } from '@/config/featureKeys';
import { MONEY_SAFETY_DICT_VERSION, MONEY_SAFETY_WORDS } from '@/content/moneySafetyWords';
import lib from '@/content/if2Library.json';
import { createDemoBoarding } from '@/demo/boardingDemo';
import * as F from '@/demo/funCalc';
import { createDemoInflight, INFLIGHT_SCENES } from '@/demo/inflightDemo';
import { DEMO_FUN_KEY, demoShared } from '@/demo/inflightShared';
import { createDemoChatApi } from '@/features/chat/chatDemo';
import { parseMessage } from '@/features/chat/chatApi';
import { createDeviceNotes, memoryNoteStorage, NOTE_KEYS } from '@/features/inflight/deviceNotes';
import { createInflightApi, parseHomeState, parsePairCard, rpcOf, type HomeState } from '@/features/inflight/inflightApi';
import { chipText, compatText, hobbyName, sameLine } from '@/features/inflight/if2Library';
import { foldRows, homeBlocks, moneySafetyHit } from '@/features/inflight/inflightLogic';
import { IF2_COPY } from '@/features/inflight/if2CopyData';
import { fill, josa, tx } from '@/features/inflight/if2Text';

jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const filesIn = (dir: string): string[] =>
  fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesIn(`${dir}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []));
const INFLIGHT_FILES = filesIn('features/inflight');
const SIGN_NAMES = lib.codes.signs.map((s) => s.name);
const STEM_CHARS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
// 상대에게 보이는 값 · 홈에 오면 안 되는 키(보안 IC-13 · 정책 PF-08 · PF-12 · PF-14)
const PARTNER_KEYS = ['name', 'partner', 'partner_id', 'user_id', 'age', 'photo', 'photos', 'face_photo_id', 'region', 'sign', 'stem', 'day_stem', 'birth', 'birth_date', 'round_no', 'seat', 'answer', 'body', 'zodiac', 'sign_name', 'hobbies', 'A12', 'A01'];
const keysDeep = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap(keysDeep) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysDeep(x)]) : []);

const allOn = async () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])) as Record<string, boolean>;
function rig(email: string, opts: { consents?: string[]; sameHobby?: boolean; birth?: string } = {}) {
  const user = { id: `u-${email.split('@')[0]}`, email };
  const consents = new Set(opts.consents ?? ['CK17A', 'CK17B']);
  const boarding = createDemoBoarding();
  const demo = createDemoInflight({
    boarding,
    flags: allOn,
    account: () => ({ birthDate: opts.birth ?? '1997-03-12', consentOn: (c) => consents.has(c), sameHobby: opts.sameHobby ?? true, previewAnswers: { A12: '이OO', A01: 29, A03: { sido: '서울', sigungu: '마포구' }, A06: '무교' } }),
  });
  demoShared.setFlags(allOn);
  demoShared.setSameHobby(() => opts.sameHobby ?? true);
  const calls: string[] = [];
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push(name);
      return demo.handles(name) ? demo.rpc(user, name, args) : boarding.rpc(user, name, args);
    },
  } as unknown as SupabaseClient;
  const api = createInflightApi(rpcOf(client));
  const scene = (p_scene: string) => demo.rpc(user, 'demo_inflight_scene', { p_scene });
  return { user, demo, boarding, api, client, calls, scene, consents };
}

describe('계산 = ai/IF2/fun_calc.py · check_calc.py 시험값(데모 모의 서버 몫 · 서버 0043 과 같은 식)', () => {
  const KEY = 'test-key-not-secret';
  test('C1 타로 시험값 18개 · 같은 입력 같은 카드 · 자리 0 ~ 2 만', () => {
    const VEC: [string, string, number[]][] = [
      ['m-0001', '2027-05-06', [20, 9, 7]],
      ['m-0001', '2027-05-13', [12, 7, 12]],
      ['m-0002', '2027-05-06', [2, 11, 19]],
      ['m-0002', '2027-05-13', [10, 19, 1]],
      ['8f14e45f-ceea-467f-a0e6-8e1b2c3d4e5f', '2027-05-06', [8, 17, 11]],
      ['8f14e45f-ceea-467f-a0e6-8e1b2c3d4e5f', '2027-05-13', [21, 6, 17]],
    ];
    for (const [m, d, exp] of VEC) expect([0, 1, 2].map((s) => F.tarotCard(KEY, m, d, s))).toEqual(exp);
    expect(F.tarotCard(KEY, 'm-9', '2027-05-06', 1)).toBe(F.tarotCard(KEY, 'm-9', '2027-05-06', 1));
    expect(() => F.tarotCard(KEY, 'm-1', '2027-05-06', 3)).toThrow();
    expect(DEMO_FUN_KEY).toBe(KEY); // 데모 키 = 시험 키(비밀 아님)
  });
  test('C2 칩 고르기 [12, 6, 7] · 궁합 변형 사주 1 · 별자리 2(room-001)', () => {
    expect(F.pickDistinct(KEY, 'chips:v1:room-001', 30, 3)).toEqual([12, 6, 7]);
    expect(F.compatVariant(KEY, 'room-001', 'saju')).toBe(1);
    expect(F.compatVariant(KEY, 'room-001', 'star')).toBe(2);
  });
  test('C3 일진 = KASI 20일 · 일간 오행 · JDN', () => {
    const STEMS = '갑을병정무기경신임계';
    const BR = '자축인묘진사오미신유술해';
    const KASI: [string, string, number][] = [
      ['1900-01-01', '갑술', 2415021], ['1912-02-18', '갑자', 2419451], ['1949-10-01', '갑자', 2433191], ['1960-01-01', '무자', 2436935],
      ['1965-02-04', '기축', 2438796], ['1972-02-29', '경인', 2441377], ['1979-12-31', '임신', 2444239], ['1980-01-01', '계유', 2444240],
      ['1988-02-29', '갑인', 2447221], ['1990-06-15', '신해', 2448058], ['1993-11-07', '임진', 2449299], ['1996-02-29', '병신', 2450143],
      ['1999-12-31', '정사', 2451544], ['2000-01-01', '무오', 2451545], ['2000-02-29', '정사', 2451604], ['2003-08-23', '무진', 2452875],
      ['2005-03-21', '갑진', 2453451], ['2026-10-28', '을해', 2461342], ['2027-05-10', '기축', 2461536], ['2027-05-17', '병신', 2461543],
    ];
    for (const [d, g, j] of KASI) {
      const i = F.dayIndex60(d);
      expect(`${STEMS[i % 10]}${BR[i % 12]}`).toBe(g);
      expect(F.jdn(d)).toBe(j);
    }
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(F.stemElement)).toEqual(['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water']);
  });
  test('C4 별자리 경계 12곳 · 2/29 물고기 · 경계 표시 24일', () => {
    for (const [code, m, d] of F.SIGN_TABLE) {
      expect(F.sunSign(`2001-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`).sign).toBe(code);
    }
    expect(F.sunSign('1996-02-29').sign).toBe('pisces');
    let cusp = 0;
    for (let t = Date.UTC(2000, 0, 1); t < Date.UTC(2001, 0, 1); t += 86_400_000) if (F.sunSign(new Date(t).toISOString().slice(0, 10)).cusp) cusp += 1;
    expect(cusp).toBe(24);
  });
  test('C5 그 주 기운: 2027-05-06 흙 · 05-13 불 · 목요일 아니면 거절 · 10주 주기', () => {
    expect(F.weekElement('2027-05-06')).toBe('earth');
    expect(F.weekElement('2027-05-13')).toBe('fire');
    expect(() => F.weekElement('2027-05-07')).toThrow();
    const seq = Array.from({ length: 20 }, (_, i) => F.weekElement(new Date(Date.UTC(2027, 3, 29) + i * 7 * 86_400_000).toISOString().slice(0, 10)));
    expect(seq.slice(0, 10)).toEqual(seq.slice(10));
  });
  test('C6 관계 문장 키가 라이브러리에 모두 있다(오행 15쌍 × 2 · 원소 10쌍 × 2) · 조사 · 틀 채우기', () => {
    for (const a of F.ELEM5) for (const b of F.ELEM5) for (const v of [1, 2]) expect(compatText(`cs-${F.pair5(a, b)}-${v}`)).not.toBeNull();
    for (const a of F.ELEM4) for (const b of F.ELEM4) for (const v of [1, 2]) expect(compatText(`cst-${F.pair4(a, b)}-${v}`)).not.toBeNull();
    expect([josa('독서', '을/를'), josa('등산', '을/를'), josa('요가', '으로/로'), josa('마을', '으로/로'), josa('등산', '으로/로')]).toEqual(['를', '을', '로', '로', '으로']);
    expect(fill('두 분 다 {v1}{과/와} {v2}{을/를} 즐겨요.', { v1: '등산', v2: '요리' })).toBe('두 분 다 등산과 요리를 즐겨요.');
  });
});

describe('IFF-01 상대 화면 사주 글자 0 · 별자리 이름 0(보안 IT-01 · 정책 PF-14)', () => {
  test('궁합 카드 관계 문장 · 같은 점 · 첫마디 실마리 글에 별자리 이름 · 일간 · 일주 · 띠 · 천간 글자 0', () => {
    const partnerTexts = [...lib.compat.saju, ...lib.compat.star, ...lib.compat.common, ...lib.compat.topic, ...lib.chips].map((x) => x.text);
    for (const t of partnerTexts) {
      for (const n of SIGN_NAMES) expect(t).not.toContain(n);
      for (const w of ['일간', '일주', '띠', '음양', '천간']) expect(t).not.toContain(w);
      for (const c of STEM_CHARS) for (const e of ['목', '화', '토', '금', '수']) expect(t).not.toMatch(new RegExp(`${c}${e}(?![가-힣])|${c}${e}(일|간)`)); // 갑목 · 병화 같은 일간 이름
    }
    // 앱 라이브러리 사본에 일간 글자 칸 0(codes.stems 에 char 없음)
    expect(lib.codes.stems.every((s) => !('char' in s))).toBe(true);
  });
  test('궁합 카드 응답 파서는 관계 문장 키(cs- · cst-)와 같은 값만 읽는다 — 상대 별자리 코드 · 일간 · 생년월일이 와도 버린다', () => {
    const card = parsePairCard({ ok: true, card: { same: [{ code: 'reading' }, { group: 'out' }, { code: 'x' }], saju: 'cs-wood-fire-1', star: 'cst-fire-air-2', ck17_mine: true, partner_sign: 'leo', partner_stem: 3, birth_date: '1995-07-30', name: '김OO' } });
    expect(card).toEqual({ same: [{ code: 'reading' }, { group: 'out' }], saju: 'cs-wood-fire-1', star: 'cst-fire-air-2', ck17Mine: true });
    expect(parsePairCard({ ok: true, card: { same: [], saju: '갑목', star: '사자자리' } })).toEqual({ same: [], saju: null, star: null, ck17Mine: false });
  });
  test('데모 궁합 카드: 두 분 CK17B 일 때만 ② ③ · 한 분이라도 끄면 0 · 응답 키에 상대 정보 0', async () => {
    const r = rig('if2matched@email.com');
    await r.scene('matched');
    const home = await r.api.home();
    expect(home.ok && home.data.stage).toBe('matched');
    const room = home.ok ? home.data.pair?.roomId : null;
    expect(room).toBeTruthy();
    const on = await r.api.pairCard(String(room));
    expect(on.ok && on.data.saju && on.data.star).toBeTruthy();
    const raw = await r.client.rpc('get_pair_card', { p_room: room });
    expect(keysDeep(raw.data).filter((k) => PARTNER_KEYS.includes(k))).toEqual([]);
    r.consents.delete('CK17B');
    const off = await r.api.pairCard(String(room));
    expect(off.ok && off.data.saju === null && off.data.star === null && off.data.ck17Mine === false).toBe(true);
  });
});

describe('IFF-02 · IFF-03 기기 저장 · 로그 · 지우기(보안 IC-12 · 정책 PF-10)', () => {
  test('나만 쓰는 글 9종 = 키 9개(if2.*.v1) · 기기 저장소에만 · 로그아웃 · 탈퇴 clearAll 이 9개 모두 지운다', async () => {
    expect(Object.keys(NOTE_KEYS)).toHaveLength(9);
    const storage = memoryNoteStorage();
    const notes = createDeviceNotes(storage);
    await notes.load();
    notes.set('postcard', { round: 1, line: 2, extra: '반가워요', at: 1 });
    notes.set('preAnswers', { round: 1, items: [{ q: 'q-1-01', text: '산책이요', at: 1 }] });
    notes.set('mustTalk', { r1: [0] });
    notes.set('meetPrep', { r1: ['s'] });
    notes.set('memos', { r1: { room: 'r1', texts: ['좋았어요', '', ''], at: 1, closedAt: null } });
    notes.set('typeBag', ['기차표']);
    notes.set('wordSafety', ['r1']);
    notes.set('hobbyNotice', true);
    notes.set('homeFold', true);
    await new Promise((r) => setTimeout(r, 5));
    for (const k of Object.values(NOTE_KEYS)) expect(await storage.getItem(k)).not.toBeNull();
    await notes.clearAll();
    for (const k of Object.values(NOTE_KEYS)) expect(await storage.getItem(k)).toBeNull();
    expect(notes.get().postcard).toBeNull();
  });
  test('회차 끝: 엽서 · 미리 답은 그 회차가 비행 중 · 열린 방 회차가 아니면 지움 · 메모 · 표시는 열린 방이거나 닫힌 지 30일 안(reflect_ok)만', async () => {
    const notes = createDeviceNotes();
    await notes.load();
    notes.set('postcard', { round: 1, line: 0, extra: '', at: 1 });
    notes.set('preAnswers', { round: 1, items: [] });
    notes.set('memos', { r1: { room: 'r1', texts: ['a', '', ''], at: 1, closedAt: null } });
    notes.set('mustTalk', { r1: [1] });
    notes.purge({ now: 0, inflightRound: 1, openRoom: null, openRoomRound: null, reflectOk: true });
    expect(notes.get().postcard).not.toBeNull(); // 비행 중 그 회차
    notes.purge({ now: 0, inflightRound: null, openRoom: 'r1', openRoomRound: 1, reflectOk: false });
    expect(notes.get().postcard).not.toBeNull(); // 공개 뒤 그 회차 방(엽서를 보낼 수 있음)
    notes.purge({ now: 0, inflightRound: null, openRoom: null, openRoomRound: null, reflectOk: true });
    expect(notes.get().postcard).toBeNull(); // 회차 끝
    expect(notes.get().preAnswers).toBeNull();
    expect(notes.get().memos.r1).toBeDefined(); // 닫힌 지 30일 안
    notes.purge({ now: 0, inflightRound: null, openRoom: null, openRoomRound: null, reflectOk: false });
    expect(notes.get().memos).toEqual({});
    expect(notes.get().mustTalk).toEqual({});
  });
  test('기내 서비스 코드에 기기 키값 저장소 · 웹 저장소 0 · 로그는 이벤트 이름과 코드만(본문 · 답 · 방 id 0)', () => {
    for (const f of [...INFLIGHT_FILES, 'demo/inflightDemo.ts', 'demo/inflightChatDemo.ts', 'demo/inflightShared.ts']) {
      const t = strip(read(f));
      expect(`${f}: ${/AsyncStorage|localStorage|sessionStorage/.test(t)}`).toBe(`${f}: false`);
      for (const m of t.matchAll(/safeLog\(\{([^}]*)\}/g)) expect(`${f}: ${/body|text|answer|room|message|name|email|birth/i.test(m[1].replace(/'[^']*'/g, ''))}`).toBe(`${f}: false`); // 이벤트 이름 · 코드만
    }
    expect(read('lib/secureStorage.ts')).toMatch(/export const if2Storage = chunkedStorage\(secureStore\)/);
    expect(read('features/inflight/deviceNotes.ts')).toMatch(/require\('@\/lib\/secureStorage'\)/);
    expect(read('features/settings/SettingsScreen.tsx')).toMatch(/await forgetInflightNotes\(\)/); // 로그아웃 · 탈퇴(leaveToStart)
  });
});

// 숫자 값이 붙은 키 이름(깊이 전부) — 홈 응답의 숫자는 내 카드 번호(card) 하나뿐이어야 한다
const numberKeys = (v: unknown, key = ''): string[] => (typeof v === 'number' ? [key] : Array.isArray(v) ? v.flatMap((x) => numberKeys(x, key)) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => numberKeys(x, k)) : []);
describe('IFF-04 홈 — 응답 · 블록 · 상대 정보 0(보안 IC-13 · 정책 PF-08 · PF-81 ~ PF-86)', () => {
  test('홈 응답 파서는 상대 이름 · 사진 · 나이 · 좌석 · 회차 번호가 와도 버린다 · 숫자는 내 카드 번호뿐', () => {
    const raw = { stage: 'matched', blocks: ['B1', 'B2', 'B4', 'B7'], pair: { room_id: 'room-1', cells: ['pair_card', 'values_talk'], partner_name: '김OO', partner_age: 31, photo: 'x' }, status: { head: 'meet', cells: ['meet_prep', 'meet_memo'], writable: true }, round_no: 3, seat: '13A', name: '김OO', age: 31 };
    const s = parseHomeState(raw) as HomeState;
    expect(keysDeep(s).filter((k) => PARTNER_KEYS.includes(k) || /^(name|age|photo|seat|round_no)$|partner/i.test(k))).toEqual([]);
    expect(JSON.stringify(s)).not.toMatch(/김OO|13A/);
  });
  test('데모 홈 응답 9 장면: 상대 정보 키 0 · 블록 5 이하 · 자리 고정 · 숫자 값은 카드 번호 하나뿐', async () => {
    const r = rig('home@email.com');
    for (const sc of INFLIGHT_SCENES.filter((x) => x !== 'auto')) {
      await r.scene(sc);
      const raw = (await r.client.rpc('get_home_state')).data as Record<string, unknown>;
      expect(keysDeep(raw).filter((k) => PARTNER_KEYS.includes(k))).toEqual([]);
      expect(numberKeys(raw).filter((k) => k !== 'card')).toEqual([]);
      const s = parseHomeState(raw) as HomeState;
      const blocks = homeBlocks(s, createDeviceNotes().get(), 0);
      expect(blocks.length).toBeLessThanOrEqual(5);
      expect(blocks).toEqual([...blocks].sort());
      expect(blocks[0]).toBe('B1');
      expect(blocks[blocks.length - 1]).toBe('B7');
      expect(blocks.includes('B2') && blocks.includes('B5')).toBe(false);
    }
  });
  test('단계별 블록(셈표 1.0): 탑승 전 B1 · B6 · B7 / 비행 중 B1 · B3 · B4 · B7 / 짝 있음 B1 · B2 · B4 · B7 / 겹침 B1 · B3 · B4 · B5 · B7 / 돌아보기는 기기 메모가 있을 때 B4', async () => {
    const r = rig('stage@email.com');
    const blocksOf = async (sc: string, notes = createDeviceNotes().get()) => {
      await r.scene(sc);
      const h = await r.api.home();
      return h.ok ? [h.data.stage, homeBlocks(h.data, notes, 0).join(' ')] : null;
    };
    expect(await blocksOf('before')).toEqual(['before', 'B1 B6 B7']);
    expect(await blocksOf('inflight')).toEqual(['inflight', 'B1 B3 B4 B7']);
    expect(await blocksOf('landing')).toEqual(['landing', 'B1 B3 B4 B7']);
    expect(await blocksOf('matched')).toEqual(['matched', 'B1 B2 B4 B7']);
    expect(await blocksOf('noMatch')).toEqual(['noMatch', 'B1 B6 B7']);
    expect(await blocksOf('overlap')).toEqual(['overlap', 'B1 B3 B4 B5 B7']);
    expect(await blocksOf('reflect')).toEqual(['before', 'B1 B6 B7']);
    const withMemo = { ...createDeviceNotes().get(), memos: { r0: { room: 'r0', texts: ['좋았어요', '', ''], at: 1, closedAt: null } } };
    expect(await blocksOf('reflect', withMemo)).toEqual(['before', 'B1 B4 B6 B7']);
  });
  test('홈을 열 때 부르는 서버 함수 = get_home_state 하나(AI · 다른 재미 함수 0)', async () => {
    const r = rig('calls@email.com');
    await r.scene('matched');
    r.calls.length = 0;
    await r.api.home();
    expect(r.calls).toEqual(['get_home_state']);
  });
  test('짝 있음 · 겹침 때 나를 알기 두 칸은 접힘 줄 안(PF-83) · 접힘 줄은 8 이하', () => {
    const s = parseHomeState({ stage: 'matched', blocks: ['B1', 'B2', 'B4', 'B7'], pair: { room_id: 'r', cells: [] } }) as HomeState;
    const rows = foldRows(s, { hasPastChat: true, memoElsewhere: true, typeOn: true, previewOn: true });
    expect(rows).toEqual(['profile', 'survey', 'avoid', 'chats', 'memo', 'type', 'preview']);
    expect(rows.length).toBeLessThanOrEqual(8);
  });
});

describe('IFF-05 상태 신호 · 재촉 0 · IFF-12 문구(정책 PF-02 · PF-03 · PF-18)', () => {
  test('IF2 글(카피 21장 사본)에 느낌표 · 숫자 · 재촉 · 상대 상태 말 · 금지 낱말 0', () => {
    const BANNED = ['먼저 답했어요', '상대가 아직', '아직 안 썼어요', '서두르', '놓치', '마지막 기회', '운명', '천생연분', '상극', '잘 맞아요', '안 맞아요', '궁합 ○점', '점수', '%', '운세', '타로', '연애운', '부적', '전문 상담', '심리 진단', '애착 유형', 'AI 궁합'];
    for (const [k, v] of Object.entries(IF2_COPY)) {
      const t = v.replace(/\{[^{}]+\}/g, '');
      expect(`${k}: ${/[!！]|\d/.test(t)}`).toBe(`${k}: false`);
      for (const w of BANNED) expect(`${k}: ${t.includes(w)}`).toBe(`${k}: false`);
      if (t.includes('아직')) expect(t).toContain('아직 모르는 분께'); // 기능 이름만
    }
  });
  test('같이 열어 보는 질문 응답의 내 쪽 상태만 읽는다 — 상대가 답했는지 · 눌렀는지 키는 버린다', () => {
    const m = parseMessage({ id: 5, mine: false, kind: 'text', body: '', created_at: '2026-12-23T10:00:00Z', tag: 'together_q', ref: 'q-1-01', together: { state: 'mine_needed', partner_answered: true, partner_answer: '비밀' } });
    expect(m?.together).toEqual({ state: 'mine_needed' });
    expect(JSON.stringify(m)).not.toContain('비밀');
  });
  test('끝줄: 쪽 · 카드 끝줄 다섯 글자 = 법무 4-1(재미 · 연애 이야기 · 타입 · 궁합 카드 · 메모)', () => {
    expect(tx('FUN.footer')).toBe('재미로 보는 이야기예요. 매칭에는 쓰이지 않아요.');
    expect(tx('MAGAZINE.love.footer')).toBe('일반적인 이야기예요. 상담이나 진단이 아니에요.');
    expect(tx('TYPE_CARD.footer')).toBe('타입 이름과 설명은 재미로 보는 글이에요. 짝을 정할 때 쓰지 않아요.');
    expect(tx('PAIR_CARD.footer')).toBe('이 카드는 짝이 정해진 뒤에 만든 재미 글이에요. 매칭에는 쓰이지 않아요.');
    expect(tx('MEET_MEMO.note')).toBe('나만 보는 메모예요. 운영팀에도 보내지 않아요.');
  });
});

describe('IFF-06 · IFF-07 자유 글 · 작별 인사는 채팅 길 하나(보안 IC-10 · IC-11 · 정책 PF-07 · PF-57)', () => {
  test('앱 코드: 꼬리표 글 · 같이 열어 보는 질문은 send_chat_card · together_* 함수로만 — 표 직접 넣기(from().insert) 0 · 새 실시간 채널 0', () => {
    const api = strip(read('features/inflight/inflightApi.ts'));
    expect(api).toMatch(/'send_chat_card'/);
    expect(api).toMatch(/'together_send'/);
    for (const f of INFLIGHT_FILES) {
      const t = strip(read(f));
      expect(`${f}: ${/(?<!Array)\.from\(|\.insert\(|\.channel\(|postgres_changes/.test(t)}`).toBe(`${f}: false`);
    }
  });
  test('데모 채팅: 엽서는 첫 글만(not_first) · 거르기에 걸리면 text_blocked · 작별 엽서는 f0 ~ f4 + 한 줄 · 보내기가 끝난 뒤에만 나감', async () => {
    const r = rig('chatcard@email.com');
    const chat = createDemoChatApi({ who: async () => r.user, replyMs: 20 });
    const a = createInflightApi(chat.if2Rpc);
    const rooms = await chat.listRooms();
    const room = rooms.ok ? rooms.data[0].id : '';
    expect((await a.sendCard(room, 'postcard', '처음 인사드려요. 이렇게 이어져서 반가워요.', 'p0')).ok).toBe(true);
    const again = await a.sendCard(room, 'postcard', '처음 인사드려요.', 'p1');
    expect(!again.ok && again.code).toBe('not_first');
    const blocked = await a.sendCard(room, 'farewell', '계좌로 송금해 주세요', 'f0');
    expect(!blocked.ok && blocked.code).toBe('text_blocked');
    const badRef = await a.sendCard(room, 'farewell', '고마웠어요.', 'f9');
    expect(!badRef.ok && badRef.code).toBe('invalid_ref');
    const twoLines = await a.sendCard(room, 'farewell', '고마웠어요.\n잘 지내요.', 'f0');
    expect(!twoLines.ok && twoLines.code).toBe('too_long');
    expect((await chat.listRooms()).ok).toBe(true);
    const left = await a.sendCard(room, 'farewell', '이야기 나눠 주셔서 고마웠어요.', 'f0');
    expect(left.ok && left.left).toBe(true);
    const after = await chat.listRooms();
    expect(after.ok && after.data.some((x) => x.id === room)).toBe(false);
    expect(demoShared.roomGone(r.user.id, room)).toBe(true); // 홈 '이번 짝' · 궁합 카드도 바로 0
  });
  test('미리 알려 두는 나: 칸마다 하나 · 셋까지 · 보내면 끝(already_sent) · 시간대 칸 번호 0', async () => {
    const r = rig('aboutme@email.com');
    const chat = createDemoChatApi({ who: async () => r.user, replyMs: 20 });
    const a = createInflightApi(chat.if2Rpc);
    const rooms = await chat.listRooms();
    const room = rooms.ok ? rooms.data[0].id : '';
    expect((await a.sendCard(room, 'about_me', 'x', 'reply0,reply1')).ok).toBe(false); // 같은 칸 둘
    expect((await a.sendCard(room, 'about_me', 'x', 'reply0,upset1,pace2,heart3')).ok).toBe(false); // 넷
    expect((await a.sendCard(room, 'about_me', '답장은 바로 하는 편이에요.', 'reply0,heart4')).ok).toBe(true);
    const again = await a.sendCard(room, 'about_me', '답장은 바로 하는 편이에요.', 'reply0');
    expect(!again.ok && again.code).toBe('already_sent');
  });
});

describe('IFF-08 공유 그림 · IFF-10 타로 · IFF-11 AI 0', () => {
  test('바깥 공유 · AI판 스위치는 실서버 · 데모 모두 꺼짐 · 타입 엽서 화면에 공유 단추 0', () => {
    const keys = Object.fromEntries(FEATURE_KEY_LIST.map((k) => [k.key, k]));
    expect(keys.type_card_share.live).toBe(false);
    expect(demoDefault('type_card_share')).toBe(false);
    expect(demoDefault('pair_card_ai')).toBe(false);
    const t = strip(read('features/inflight/TypeCardScreen.tsx'));
    expect(t).not.toMatch(/TYPE_CARD\.share|Share\.share|shareFooter/);
  });
  test('타로: 한 회차 한 장 — 고른 뒤 다른 자리는 already_picked 로 같은 카드 · 앱(기내 서비스 화면 · API)에 카드 계산 코드 0', async () => {
    const r = rig('tarot@email.com');
    await r.scene('inflight');
    const first = await r.api.pickWeekCard(1);
    expect(first.ok).toBe(true);
    const second = await r.api.pickWeekCard(2);
    expect(!second.ok && second.code === 'already_picked' && first.ok && second.card === first.card && second.slot === 1).toBe(true);
    const wc = await r.api.weekCard();
    expect(wc.ok && wc.data.state === 'revealed' && first.ok && wc.data.card === first.card).toBe(true);
    expect(first.ok && first.card).toBe(F.tarotCard(DEMO_FUN_KEY, r.user.id, '2026-12-17', 1)); // 데모 = fun_calc 식
    for (const f of INFLIGHT_FILES) {
      const t = strip(read(f));
      expect(`${f}: ${/funCalc|hmac|tarot:v1|tarotCard\(/i.test(t)}`).toBe(`${f}: false`);
    }
  });
  test('AI 호출 · 키 이름 0: 기내 서비스 앱 코드 · 데모에 anthropic · claude · ai-profile · sk-ant 0', () => {
    for (const f of [...INFLIGHT_FILES, 'demo/inflightDemo.ts', 'demo/inflightChatDemo.ts', 'demo/inflightShared.ts', 'demo/funCalc.ts']) {
      const t = strip(read(f)).toLowerCase();
      expect(`${f}: ${/anthropic|claude|ai-profile|sk-ant|functions\.invoke/.test(t)}`).toBe(`${f}: false`);
    }
  });
});

describe('IFF-09 안전 안내 카드 판정(보안 IC-20 · 정책 PF-56)', () => {
  test('기기 판정: 돈 · 투자 · 코인 · 송금 · 다른 앱 유도 꼴이면 참 · 연락처를 나누는 흔한 말(카톡)은 거짓 · 네트워크 · 로그 0', () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as never).mockImplementation((() => Promise.reject(new Error('no'))) as never);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(moneySafetyHit('요즘 코인 이야기 많이 하던데 혹시 관심 있으세요?')).toBe(true);
    expect(moneySafetyHit('텔레그램으로 옮겨서 이야기해요')).toBe(true);
    expect(moneySafetyHit('t.me/abc 로 와 주세요')).toBe(true);
    expect(moneySafetyHit('주말에 산책 어떠세요?')).toBe(false);
    expect(moneySafetyHit('카톡 아이디 알려 드릴까요?')).toBe(false); // T-20 연락처 자유
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    log.mockRestore();
  });
  test('사전 판 = 서버 거르기 사전(money 낱말) 지문 · 판 번호 꼴', () => {
    expect(MONEY_SAFETY_DICT_VERSION).toMatch(/^tg-[0-9a-f]{8}$/);
    const dir = path.resolve(SRC, '..', '..', 'backend', 'migrations');
    if (!fs.existsSync(dir)) return;
    const server = new Set<string>();
    for (const n of fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))) for (const m of fs.readFileSync(path.join(dir, n), 'utf8').matchAll(/\(\s*'money'\s*,\s*'([^']*)'\s*\)/g)) if (m[1] !== 'abuse') server.add(m[1].toLowerCase());
    expect([...server].sort()).toEqual([...MONEY_SAFETY_WORDS].sort());
  });
});

describe('IFF-16 같은 취미(D-224 · 정책 PF-48 · PF-49)', () => {
  test('취미 이름은 서버가 준 코드 · 갈래만 그린다(앱 갈래 계산 · k 문턱 0) · 두 줄까지', () => {
    expect(hobbyName({ code: 'reading' })).toBe('독서·공부');
    expect(hobbyName({ group: 'out' })).toBe(tx('PAIR_CARD.hobbyGroup.out'));
    expect(sameLine([{ code: 'reading' }, { group: 'out' }])).toBe('두 분 다 독서·공부와 밖에서 즐기는 일을 즐겨요.');
    expect(sameLine([])).toBeNull();
    for (const f of INFLIGHT_FILES) expect(`${f}: ${/hobby_k|hobbyGroupOf|n_code|n_grp/.test(strip(read(f)))}`).toBe(`${f}: false`);
  });
  test('데모: 내가 같은 취미를 끄면 궁합 카드 ① · 첫마디 실마리 두 곳에서 바로 빠짐(같은 목록)', async () => {
    let on = true;
    const r = rig('hobby@email.com');
    demoShared.setSameHobby(() => on);
    await r.scene('matched');
    const h = await r.api.home();
    const room = h.ok ? String(h.data.pair?.roomId) : '';
    const card1 = await r.api.pairCard(room);
    expect(card1.ok && card1.data.same.length).toBe(2);
    const chat = createDemoChatApi({ who: async () => r.user, replyMs: 20 });
    const a = createInflightApi(chat.if2Rpc);
    const chips1 = await a.openerChips(room);
    expect(chips1.ok && chips1.data.chips.some((c) => c.hobby !== null)).toBe(true);
    on = false;
    const card2 = await r.api.pairCard(room);
    expect(card2.ok && card2.data.same).toEqual([]);
    const chips2 = await a.openerChips(room);
    expect(chips2.ok && chips2.data.chips.every((c) => c.hobby === null && c.id.startsWith('ch-'))).toBe(true);
    expect(chips2.ok && chips2.data.chips.map((c) => chipText(c.id, c.hobby)).every((t) => typeof t === 'string')).toBe(true);
  });
});

describe('데모 모의 서버 = 0043 응답 모양(같은 파서로 읽힘)', () => {
  test('기내지: 발행 · 발행 전 · 닫힘 · CK17A 꺼짐이면 하늘과 결 0 · 문구 id 가 라이브러리에 있음', async () => {
    const r = rig('mag@email.com');
    await r.scene('inflight');
    const m = await r.api.magazine();
    expect(m.ok && m.data.state).toBe('issued');
    if (m.ok && m.data.state === 'issued') {
      const d = m.data;
      expect(d.sky?.zodiac).toMatch(/^zw-[a-z]+-t01-v0$/);
      expect(lib.zodiac.some((z) => z.id === d.sky?.zodiac)).toBe(true);
      expect(lib.sajuWeek.some((z) => z.id === d.grain?.saju)).toBe(true);
      expect(lib.column.some((c) => c.id === d.column)).toBe(true);
      expect(d.tripNo).toBe(1);
    }
    await r.scene('magBefore');
    const nb = await r.api.magazine();
    expect(nb.ok && nb.data.state).toBe('not_yet');
    await r.scene('matched');
    const closed = await r.api.magazine();
    expect(closed.ok && closed.data.state).toBe('none');
    r.consents.delete('CK17A');
    await r.scene('inflight');
    const off = await r.api.magazine();
    expect(off.ok && off.data.state === 'issued' && off.data.sky === null && off.data.grain === null && off.data.ck17a === false).toBe(true);
  });
  test('미리 답해 두는 질문 20(깊이마다 5) · 착륙 준비면 landing · 미리보기 응답 · 이야깃거리 그날 10장 · 같이 열어 보기 하루 1장', async () => {
    const r = rig('pre@email.com');
    await r.scene('inflight');
    const q = await r.api.preQuestions();
    expect(q.ok && q.data.state === 'open' && q.data.questions.length).toBe(20);
    await r.scene('landing');
    const l = await r.api.preQuestions();
    expect(l.ok && l.data.state).toBe('landing');
    const p = await r.api.preview();
    expect(p.ok && p.data.ck17b && p.data.sameHobby).toBe(true);
    const chat = createDemoChatApi({ who: async () => r.user, replyMs: 20 });
    const a = createInflightApi(chat.if2Rpc);
    const rooms = await chat.listRooms();
    const room = rooms.ok ? rooms.data[0].id : '';
    const t = await a.topics(room);
    expect(t.ok && t.data.questions.length).toBe(10);
    expect(t.ok && t.data.depths).toEqual(['light']); // 공개한 수요일 = 1일째
    const qid = t.ok ? t.data.questions[0] : '';
    expect((await a.togetherSend(room, qid, '', '산책이요')).ok).toBe(true);
    const used = await a.togetherSend(room, qid, '', '또');
    expect(!used.ok && used.code).toBe('daily_used');
    const list = await chat.listMessages(room);
    const card = list.ok ? list.data.find((x) => x.tag === 'together_q') : undefined;
    expect(card?.together).toEqual({ state: 'waiting', myAnswer: '산책이요', canWithdraw: true });
    await new Promise((res) => setTimeout(res, 60)); // 데모 짝이 답하면 함께 열림
    const list2 = await chat.listMessages(room);
    const card2 = list2.ok ? list2.data.find((x) => x.tag === 'together_q') : undefined;
    expect(card2?.together).toEqual({ state: 'opened' });
    expect(list2.ok && list2.data.filter((x) => x.tag === 'together_a' && x.ref === card2?.id)).toHaveLength(2);
  });
  test('스위치가 꺼지면 feature_off → 앱 off(그 칸 0)', async () => {
    const boarding = createDemoBoarding();
    const user = { id: 'u-off', email: 'off@email.com' };
    const demo = createDemoInflight({ boarding, flags: async () => ({}), account: () => ({ birthDate: null, consentOn: () => false, sameHobby: true, previewAnswers: {} }) });
    const api = createInflightApi(async (n, a) => demo.rpc(user, n, a));
    for (const r of [await api.home(), await api.magazine(), await api.weekCard(), await api.preQuestions(), await api.preview(), await api.pairCard('x')]) expect(!r.ok && r.code).toBe('off');
  });
});

describe('재미 데이터가 매칭 화면 · 요청에 0(척추 보조 원칙 1 · 정책 PF-01 · 보안 S-9)', () => {
  test('탑승권 · 추천 · 채팅 보내기 요청 코드가 기내 서비스 모듈 · 재미 값(CK17 · 별자리 · 일간 · 타로 · 같은 취미)을 읽지 않는다', () => {
    for (const f of ['features/boarding/boardingApi.ts', 'lib/recsApi.ts', 'features/chat/chatApi.ts', 'lib/demoRecs.ts', 'demo/boardingDemo.ts']) {
      const t = strip(read(f));
      expect(`${f}: ${/features\/inflight|CK17|fun_|tarot|same_hobby|sunSign|dayStem/.test(t)}`).toBe(`${f}: false`);
    }
  });
});
