// 데모 모드 모의 서버의 v4 파도 0 · 1 부분(F19). 실제 서버(backend/migrations/0016_v4_wave01.sql · S12_변경기록.md 4장)와
// 같은 응답 모양 · 같은 오류 코드를 쓴다. 메모리에만 있고 서버에 요청하지 않으며 기기에 아무것도 저장하지 않는다.
//  get_feature_flags()            → { flags: {키: boolean}, modes: {키: 'demo'} } (데모 시드처럼 처음값 전부 켜짐, 키는 config/featureKeys.json)
//  list_today_recommendations 꾸밈 → decorateToday(): 강조 카드를 맨 앞으로, featured: true 하나와 맞는 점 최대 5개만 더한다
//  get_meet_feedback_prompt()     → null | {off:true} | {match_id, state:'ask', card} | {match_id, state:'answered', card, can_edit, editable_until, answer}
//  submit_meet_feedback(...)      → {ok:true} | {off:true} · invalid_value · not_available · edit_window_closed
//  dismiss_meet_feedback(p_match) → {ok:true} | {off:true} · not_available
// 1단계(F19)는 이 파일만 만든다. demoBackend.ts 에 잇는 줄은 app/F19_변경기록.md 3장(2단계).
// 강조를 고르는 계산(맞는 점 개수 · 동점이면 없음 · K12 1-03~1-05)은 서버 몫이고 backend 시험 run_s12 C 묶음이 봤다.
// 데모는 계산하지 않고 장면으로 고른다: 기본 = 그날 처음 본 목록의 첫 무료 카드(무료 카드 2장 이상 · 맞는 점 이름 3개 이상일 때), 그날은 고정.
// 장면은 이메일 앞부분으로 고른다:
//  (기본) 스위치 전부 켜짐 · 강조 1명 · 피드백 카드(연결 9일 · 8일 된 두 쌍 중 오래된 쌍부터)
//  v4off live 처음값(새 기능 모두 꺼짐 · 구현된 기능 E 만 켜짐: 목록은 0012 와 같고, 피드백 세 함수는 {off:true})    featoff · fboff · shareoff 그 스위치 하나만 꺼짐
//  featnone 강조 없는 날(동점 등)    featshrink 처음 본 뒤 상대가 공개 범위를 줄여 강조 모양만 빠짐(자리는 맨 앞 그대로)
//  fbnone 질문할 쌍 없음    fbsoon 연결 6일(아직 묻지 않음)    fbanswered 2시간 전에 답함(고치기 가능)    fbedited 답한 뒤 이미 한 번 고침    fbfail 카드를 못 불러옴(인터넷)
// 여기 사람들은 가상이다(실제 사람 아님). 이름은 서버처럼 성 + OO.
// R1 A⑦: 스위치는 목록(K19 2-5) 전부를 낸다. v4off = live 처음값 장면(구현된 기능 E 만 켜짐)
// F22: 목록 87키 · 기본 장면은 데모 처음값(featureKeys demoDefault — review_required · prelaunch 만 꺼짐). v4off 의 prelaunch 는 live 값(켜짐)
import { demoSceneDefault, FEATURE_KEY_LIST, liveDefault } from '@/config/featureKeys';

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };
type DbResult<T> = { data: T | null; error: DbError | null };
type Person = { name: string; age: number; region: Row };

export type DemoV4User = { id: string; email: string };
export type DemoV4Match = { id: string; other: string; createdAt: number };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const AFTER_DAYS = 7; // 연결 7일 뒤부터 묻는다(K12 2-01)
const CARD_DAYS = 30; // 30일 동안 답이 없으면 거둔다(연결 + 37일, 2-04)
const EDIT_HOURS = 48; // 답한 뒤 48시간 안에 1번 고치기(2-12)
const MISMATCH_MAX = 3;
const CHIPS_MAX = 5; // 강조 카드 칩
const NAMES_MIN = 3; // 강조 조건: 보일 맞는 점 이름 3개 이상

// 스위치 키는 앱과 같은 한 목록(config/featureKeys.json). 팀장 판단 전(pending) 키는 서버에 아직 없어 응답에 넣지 않는다
const FLAG_KEYS: readonly string[] = FEATURE_KEY_LIST.filter((k) => !k.pending).map((k) => k.key);
type FlagKey = string;
// 서버 허용 목록(0016 submit_meet_feedback): 맞는 점 이름 19개 + profile_diff + uncomfortable
const REASON_IDS = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10', 'F14', 'F15', 'F16', 'E01', 'E02', 'E03', 'E05', 'E06', 'E07'];
const MISMATCH_ALLOWED = [...REASON_IDS, 'profile_diff', 'uncomfortable'];

const SEED_PEOPLE: Readonly<Record<string, Person>> = {
  'demo-match-1': { name: '한OO', age: 31, region: { sido: '서울', sigungu: '강서구' } }, // 11 연결됨(lib/likesDemo.ts)과 같은 분
  'demo-fb-2': { name: '오OO', age: 33, region: { sido: '경기', sigungu: '수원시' } },
};

type Feedback = { met: string | null; outcome: string | null; mismatch: string[]; answeredAt: number | null; editedAt: number | null; dismissedAt: number | null };
type UserState = { seeded: DemoV4Match[]; feedback: Map<string, Feedback>; blocked: Set<string>; pick: { day: string; id: string | null } | null; listLoads: number };

const fail = (code: string, message: string): DbResult<never> => ({ data: null, error: { code, message } });
const network = (): DbResult<never> => fail('', 'Failed to fetch');
const ok = <T,>(data: T): DbResult<T> => ({ data, error: null });
const iso = (t: number) => new Date(t).toISOString();
const isRecord = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
// 서비스 하루 시작(한국 09:00 = UTC 자정, lib/demoRecs.ts 와 같은 경계)
const dayStart = (t: number) => Math.floor(t / DAY) * DAY;

export function createDemoV4(
  options: {
    now?: () => number;
    matches?: (user: DemoV4User) => DemoV4Match[] | null; // 2단계: 11 연결 목록(lib/likesDemo.ts)을 넘긴다. 없으면 이 파일의 두 쌍
    people?: (id: string) => Person | null;
    reasonsFor?: (user: DemoV4User, candidateId: string) => string[] | null; // 2단계: 10 상세의 맞는 점(lib/demoRecs.ts candidate) — 강조 카드 칩 5개
  } = {},
) {
  const now = options.now ?? Date.now;
  const users = new Map<string, UserState>();
  const local = (user: DemoV4User) => user.email.split('@')[0];
  const lookup = (id: string): Person | null => SEED_PEOPLE[id] ?? options.people?.(id) ?? null;

  const stateOf = (user: DemoV4User): UserState => {
    let s = users.get(user.id);
    if (!s) {
      const t = now();
      const l = local(user);
      const seeded: DemoV4Match[] = l.startsWith('fbnone')
        ? []
        : l.startsWith('fbsoon')
          ? [{ id: 'demo-fbmatch-1', other: 'demo-fb-2', createdAt: t - 6 * DAY }]
          : [
              { id: 'demo-fbmatch-1', other: 'demo-fb-2', createdAt: t - 9 * DAY },
              { id: 'demo-fbmatch-2', other: 'demo-match-1', createdAt: t - 8 * DAY },
            ];
      s = { seeded, feedback: new Map(), blocked: new Set(), pick: null, listLoads: 0 };
      if (l.startsWith('fbanswered') || l.startsWith('fbedited')) {
        s.feedback.set('demo-fbmatch-1', { met: 'met', outcome: 'good', mismatch: [], answeredAt: t - 2 * HOUR, editedAt: l.startsWith('fbedited') ? t - HOUR : null, dismissedAt: null });
      }
      users.set(user.id, s);
    }
    return s;
  };

  const flagOn = (user: DemoV4User, key: FlagKey): boolean => {
    const l = local(user);
    if (l.startsWith('v4off')) return liveDefault(key); // live 처음값 장면: 구현된 기능(E)만 켜짐, 새 기능은 모두 꺼짐
    if (key === 'featured_pick' && l.startsWith('featoff')) return false;
    if (key === 'meet_feedback' && l.startsWith('fboff')) return false;
    if (key === 'safe_share' && l.startsWith('shareoff')) return false;
    return demoSceneDefault(key, user.email); // V5: 숨긴 v4 화면은 v4on 장면에서만 켜짐
  };

  const matchesOf = (user: DemoV4User): DemoV4Match[] => {
    const s = stateOf(user);
    const list = options.matches?.(user) ?? s.seeded;
    return list.filter((m) => !s.blocked.has(m.other)); // 차단 · 탈퇴 · 정지로 끊긴 쌍은 없다(서버 pair_visible)
  };
  const card = (other: string) => {
    const p = lookup(other);
    return { name: p?.name ?? null, age: p?.age ?? null, region: p?.region ?? null }; // 사진 · 이름 전체 없음(R3)
  };
  const inWindow = (m: DemoV4Match, t: number) => m.createdAt <= t - AFTER_DAYS * DAY && m.createdAt > t - (AFTER_DAYS + CARD_DAYS) * DAY;

  const rpcs: Record<string, (user: DemoV4User, args: Row) => DbResult<unknown>> = {
    get_feature_flags(user) {
      return ok({
        flags: Object.fromEntries(FLAG_KEYS.map((k) => [k, flagOn(user, k)])),
        modes: Object.fromEntries(FLAG_KEYS.map((k) => [k, 'demo'])),
      });
    },

    get_meet_feedback_prompt(user) {
      if (!flagOn(user, 'meet_feedback')) return ok({ off: true });
      if (local(user).startsWith('fbfail')) return network();
      const s = stateOf(user);
      const t = now();
      const live = matchesOf(user);
      // (가) 최근 48시간 안에 답한 쌍: '답해 주셨어요 · [고치기]' 한 줄
      const answered = live
        .map((m) => ({ m, f: s.feedback.get(m.id) }))
        .filter((x): x is { m: DemoV4Match; f: Feedback } => x.f !== undefined && x.f.answeredAt !== null && x.f.answeredAt > t - EDIT_HOURS * HOUR)
        .sort((a, b) => (b.f.answeredAt ?? 0) - (a.f.answeredAt ?? 0))[0];
      if (answered) {
        const f = answered.f;
        return ok({
          match_id: answered.m.id,
          state: 'answered',
          card: card(answered.m.other),
          can_edit: f.editedAt === null,
          editable_until: iso((f.answeredAt ?? t) + EDIT_HOURS * HOUR),
          answer: { met: f.met, outcome: f.outcome, mismatch: [...f.mismatch] },
        });
      }
      // (나) 오늘(서비스 하루) 이미 답했거나 닫았으면 다음 쌍은 다음 날부터
      if ([...s.feedback.values()].some((f) => (f.answeredAt ?? f.dismissedAt ?? -Infinity) >= dayStart(t))) return ok(null);
      // (다) 아직 묻지 않은 가장 오래된 쌍(연결 7일 뒤 ~ 37일)
      const next = live.filter((m) => inWindow(m, t) && !s.feedback.has(m.id)).sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))[0];
      if (!next) return ok(null);
      return ok({ match_id: next.id, state: 'ask', card: card(next.other) });
    },

    submit_meet_feedback(user, args) {
      if (!flagOn(user, 'meet_feedback')) return ok({ off: true });
      const s = stateOf(user);
      const t = now();
      const met = typeof args.p_met === 'string' ? args.p_met : null;
      const outcome = typeof args.p_outcome === 'string' ? args.p_outcome : args.p_outcome === undefined || args.p_outcome === null ? null : '?';
      const mismatch: unknown = args.p_mismatch ?? [];
      if (typeof args.p_match !== 'string' || (met !== 'met' && met !== 'not_yet' && met !== 'declined')) return fail('P0001', 'invalid_value');
      if ((met === 'met' && (outcome !== 'good' && outcome !== 'ok' && outcome !== 'off')) || (met !== 'met' && outcome !== null)) return fail('P0001', 'invalid_value');
      if (!Array.isArray(mismatch) || mismatch.length > MISMATCH_MAX || mismatch.some((c) => typeof c !== 'string' || !MISMATCH_ALLOWED.includes(c)) || new Set(mismatch).size !== mismatch.length || (mismatch.length > 0 && outcome !== 'off')) {
        return fail('P0001', 'invalid_value');
      }
      const match = matchesOf(user).find((m) => m.id === args.p_match);
      if (!match) return fail('P0001', 'not_available'); // 내 연결이 아니거나 끊긴 쌍(이유 구분 없음)
      const prev = s.feedback.get(match.id);
      if (prev) {
        if (prev.answeredAt === null) return fail('P0001', 'not_available'); // 묻지 않기로 닫은 쌍
        if (prev.editedAt !== null || t >= prev.answeredAt + EDIT_HOURS * HOUR) return fail('P0001', 'edit_window_closed');
        s.feedback.set(match.id, { ...prev, met, outcome, mismatch: [...(mismatch as string[])], editedAt: t });
        return ok({ ok: true });
      }
      if (!inWindow(match, t)) return fail('P0001', 'not_available'); // 아직 7일 전이거나 카드를 거둔 뒤
      s.feedback.set(match.id, { met, outcome, mismatch: [...(mismatch as string[])], answeredAt: t, editedAt: null, dismissedAt: null });
      return ok({ ok: true });
    },

    dismiss_meet_feedback(user, args) {
      if (!flagOn(user, 'meet_feedback')) return ok({ off: true });
      const s = stateOf(user);
      const match = matchesOf(user).find((m) => m.id === args.p_match);
      if (!match || !inWindow(match, now())) return fail('P0001', 'not_available');
      if (!s.feedback.has(match.id)) s.feedback.set(match.id, { met: null, outcome: null, mismatch: [], answeredAt: null, editedAt: null, dismissedAt: now() });
      return ok({ ok: true });
    },
  };

  // 강조 카드의 맞는 점 ID(19개 안 · 중복 없음)
  const reasonIds = (user: DemoV4User, item: Row): string[] => {
    const id = String(item.candidate_id);
    const source = options.reasonsFor?.(user, id) ?? (Array.isArray(item.reasons) ? item.reasons : []);
    const out: string[] = [];
    for (const r of source) if (typeof r === 'string' && REASON_IDS.includes(r) && !out.includes(r)) out.push(r);
    return out;
  };

  return {
    // demoBackend.rpc 가 이름이 여기 있으면 넘긴다(2단계)
    handles: (name: string) => name in rpcs,
    rpc(user: DemoV4User, name: string, args: Row = {}): Promise<DbResult<unknown>> {
      const handler = rpcs[name];
      if (!handler) return Promise.resolve(fail('42883', `function ${name} does not exist`));
      return Promise.resolve(handler(user, args));
    },

    // 09 list_today_recommendations 응답(lib/demoRecs.ts 가 만든 것)에 강조를 입힌다(서버 apply_featured 와 같은 모양, 2단계 연결).
    // 스위치가 꺼졌거나 강조가 없으면 받은 응답 그대로. 숫자 키는 더하지 않는다
    decorateToday(user: DemoV4User, result: DbResult<unknown>): DbResult<unknown> {
      if (result.error || !isRecord(result.data) || !Array.isArray(result.data.items)) return result;
      if (!flagOn(user, 'featured_pick')) return result;
      const items = result.data.items.filter(isRecord);
      if (items.length === 0) return result; // 목록이 아직 없으면 그날 결정을 굳히지 않는다
      const s = stateOf(user);
      s.listLoads += 1;
      const day = typeof result.data.day === 'string' ? result.data.day : iso(dayStart(now())).slice(0, 10);
      if (!s.pick || s.pick.day !== day) {
        const free = items.filter((i) => i.source !== 'match_once');
        const first = free[0];
        const chosen = !local(user).startsWith('featnone') && free.length >= 2 && first && reasonIds(user, first).length >= NAMES_MIN ? String(first.candidate_id) : null;
        s.pick = { day, id: chosen }; // 강조 없는 날도 그날은 고정(나중에 바뀌어도 강조하지 않는다)
      }
      const pickId = s.pick.id;
      if (pickId === null) return result;
      const hit = items.find((i) => i.candidate_id === pickId && i.source !== 'match_once');
      if (!hit) return result; // 강조 카드가 목록에서 빠졌다(차단 · 정지): 다른 카드로 옮기지 않는다
      let ids = reasonIds(user, hit);
      if (local(user).startsWith('featshrink') && s.listLoads > 1) ids = ids.slice(0, NAMES_MIN - 1);
      const shown: Row = ids.length >= NAMES_MIN ? { ...hit, featured: true, reasons: ids.slice(0, CHIPS_MAX) } : { ...hit }; // 3개 미만이면 모양만 뺀다. 자리는 맨 앞 그대로
      return { data: { ...result.data, items: [shown, ...items.filter((i) => i !== hit)] }, error: null };
    },

    // 화면 쪽 모의(예: 안심 공유 진입 줄)가 스위치를 물을 때
    flagOn,

    // 차단 · 신고 · 탈퇴로 연결이 사라짐(2단계: demoBackend 의 block_user · report_user 가 부른다). 그 쌍의 카드와 답이 함께 사라진다(서버 cascade)
    noteBlock(user: DemoV4User, other: string): void {
      const s = stateOf(user);
      s.blocked.add(other);
      for (const m of [...s.seeded, ...(options.matches?.(user) ?? [])]) if (m.other === other) s.feedback.delete(m.id);
    },

    // 시험 · 화면 점검: 서버(모의)에 남은 것(상대 이름 없이 연결 id 만)
    peek(user: DemoV4User) {
      const s = stateOf(user);
      return {
        flags: FLAG_KEYS.filter((k) => flagOn(user, k)),
        featuredToday: s.pick ? { ...s.pick } : null,
        feedback: [...s.feedback.entries()].map(([matchId, f]) => ({ matchId, met: f.met, outcome: f.outcome, mismatch: [...f.mismatch], answered: f.answeredAt !== null, edited: f.editedAt !== null, dismissed: f.dismissedAt !== null })),
      };
    },
  };
}

export type DemoV4 = ReturnType<typeof createDemoV4>;
