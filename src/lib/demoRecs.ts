// 데모 모드 모의 서버의 09 · 10 부분(F5). 실제 서버 계약(backend/스키마.md 9-6 · 0004/0008)과 같은 응답 모양 · 같은 오류 코드를 쓴다.
//  list_today_recommendations → { day, now, ready, first_list_pending, region_hint(Q3c: 목록이 만들어졌고 무료 추천 3명 미만이면 true), next_at, items[{ candidate_id, passed, liked, connected, profile{문항ID: 값}, photos[3], reasons[≤3] }] }  (순위 · 점수 키 없음)
//  get_candidate_profile      → { user_id, answers{}, photos[3], reasons[≤5] } 또는 null(볼 수 없음)
//  send_like(daily_limit · already_sent · forbidden) · pass_candidate · report_user(사유 8개 · 상대당 1번) · block_user(차단 즉시 목록에서 제거)
// 장면은 이메일 앞부분으로 고른다: recprep(오늘 배치 전 · 준비 중 NK02) · recfirst(첫 목록 차례 전 · 첫 추천 대기 NK01) · rec0(추천 0명) · recone(추천 1명 · region_hint) · rectwo(추천 2명 · region_hint) · recexpired(시간이 곧 끝나 새 목록으로 바뀜) · recflaky(처음 한 번 불러오기 실패) · reclimit(호감 한도 소진) · recgone(상대 프로필을 볼 수 없음) · recphoto(사진 3장 모두 승인)
// F24: 사람은 데모 인물 24명(src/demo/people.ts)에서 온다. 사진은 처음부터 3장 모두 승인(기본 그림 0) — 예전 '사진 확인 중 · 없음' 상태는 이메일에 photocheck 가 있을 때만.
//  끼리끼리 장면(이메일에 kk1~kk9 · asmale · religionother, 또는 데모 줄로 '나'의 등급을 바꾼 계정): 오늘 추천 3명 · 다음 목록 · 1회 매칭을 S16 규칙 흉내(등급 거리 + 종교 몫이 작은 분부터)로 고른다.
//  그 밖의 계정은 예전과 같은 고정 목록(Figma 09 예시 김OO · 박OO · 최OO → 다음 목록 4~6 → 1회 매칭 7~12)이다.
// 이 값들은 가상 사람이다(실제 사람 아님). 이름은 서버처럼 성 + OO 로 가려서 내려보낸다.
import { asMale, cardProfile, demoPerson, detailAnswers, kinOrder, kkFromEmail, legacyPhotoScene, myReligionOf, personOfCandId, photosOf, poolFor, promptsOf, type DemoPerson } from '@/demo/people';

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };
type Person = DemoPerson & { id: string };

const asPerson = (p: DemoPerson): Person => ({ ...p, id: `demo-cand-${p.n}` });
const pick = (ns: number[]): Person[] => ns.map((n) => demoPerson(n)).filter((p): p is DemoPerson => p !== null).map(asPerson);

// 예전 고정 목록(기본 계정): 첫 목록 3명(Figma 09 와 같은 예시. 박OO 은 종교를 가려서 이유에 '종교'가 없다) · 시간이 끝난 뒤 새 목록 3명 · 1회 매칭 6명(서버 rank 4~9)
type Lists = { first: Person[]; second: Person[]; more: Person[] };
const FIXED: Lists = { first: pick([1, 2, 3]), second: pick([4, 5, 6]), more: pick([7, 8, 9, 10, 11, 12]) };

// 구독 · 등급은 16 상점 모의 서버(shopDemo)가 가진다. 09 · 10 은 이것만 묻는다(구독자 순서 · 상대 등급 배지 · 끼리끼리 장면인가)
export type RecsAccess = { subscriber: (userId: string) => boolean; gradeNo: (userId: string) => number | null; kinOn?: (userId: string) => boolean };
const NO_ACCESS: RecsAccess = { subscriber: () => false, gradeNo: () => null };

type State = { email: string; extra: string[]; liked: Set<string>; passed: Set<string>; blocked: Set<string>; reported: Set<string>; reports: { target: string; reason: string; description: string | null }[]; loads: number; startedAt: number; expiredAt: number | null };

export function createDemoRecs(now: () => number, access: RecsAccess = NO_ACCESS) {
  const states = new Map<string, State>();
  const stateOf = (userId: string, email?: string): State => {
    let s = states.get(userId);
    if (!s) {
      s = { email: email ?? '', extra: [], liked: new Set(), passed: new Set(), blocked: new Set(), reported: new Set(), reports: [], loads: 0, startedAt: now(), expiredAt: null };
      states.set(userId, s);
    } else if (email !== undefined) s.email = email;
    return s;
  };
  const local = (email: string) => email.split('@')[0];

  // 끼리끼리 장면이면 '나'의 등급(shopDemo 값, 계산 전이면 4로 본다)에 맞춰 고르고, 아니면 고정 목록
  const kinScene = (userId: string, email: string) => kkFromEmail(email) !== null || asMale(email) || myReligionOf(email) === '그 외' || (access.kinOn?.(userId) ?? false);
  function listsFor(userId: string, email: string): Lists {
    if (!kinScene(userId, email)) return FIXED;
    const ordered = kinOrder(poolFor(email), access.gradeNo(userId) ?? 4, myReligionOf(email)).map(asPerson);
    return { first: ordered.slice(0, 3), second: ordered.slice(3, 6), more: ordered.slice(3, 9) };
  }
  const moreIds = (userId: string, email: string) => new Set(listsFor(userId, email).more.map((p) => p.id));

  // 지금 보여 줄 목록: recexpired 는 처음 목록의 시간이 끝나면(3초 뒤) 새 목록으로 바뀐다
  function listFor(userId: string, email: string, s: State): { people: Person[]; day: string; nextAt: number } {
    const t = now();
    // Q5A-16: 한국 09시 배치 = UTC 자정이라 UTC 날짜가 곧 추천 날짜다(데모 한정이며 우연이 아니라 같은 경계)
    const day = new Date(t).toISOString().slice(0, 10);
    const base = new Date(`${day}T00:00:00.000Z`).getTime();
    const tomorrow = new Date(base + 24 * 3_600_000 + 0).getTime();
    const l = local(email);
    const { first, second } = listsFor(userId, email);
    if (l.startsWith('rec0')) return { people: [], day, nextAt: tomorrow };
    if (l.startsWith('recone')) return { people: first.slice(0, 1), day, nextAt: tomorrow };
    if (l.startsWith('rectwo')) return { people: first.slice(0, 2), day, nextAt: tomorrow };
    if (l.startsWith('recexpired')) {
      if (t - s.startedAt < 3_000) return { people: first, day, nextAt: s.startedAt + 3_000 };
      return { people: second, day: 'next', nextAt: tomorrow };
    }
    return { people: first, day, nextAt: tomorrow };
  }

  const peopleById = (id: string): Person | undefined => {
    const p = personOfCandId(id);
    return p ? asPerson(p) : undefined;
  };
  const freeLikes = (userId: string, s: State) => {
    const more = moreIds(userId, s.email);
    return [...s.liked].filter((id) => !more.has(id)).length; // 1회 매칭 카드 호감은 하루 3건 한도 밖
  };
  const fail = (code: string, message: string): { data: null; error: DbError } => ({ data: null, error: { code, message } });
  const offline = () => fail('', 'Failed to fetch');
  // 볼 수 있는 분: 오늘 목록(지금 · 시간이 끝난 뒤) · 받은 1회 매칭. 아직 받지 않은 1회 매칭 분 · 목록 밖 분은 볼 수 없다
  const visible = (userId: string, s: State, p: Person) => {
    if (s.blocked.has(p.id)) return false;
    if (s.extra.includes(p.id)) return true;
    const { first, second } = listsFor(userId, s.email);
    return first.some((x) => x.id === p.id) || second.some((x) => x.id === p.id);
  };
  const photosFor = (email: string, p: Person) => (local(email).startsWith('recphoto') ? photosOf(p, false) : photosOf(p, legacyPhotoScene(email)));
  // 서버 private.match_sub_tier: t = max(1, 내 등급 − 1). 0 = 상대 등급 ≤ t(나보다 위) · 1 = 같은 등급 · 2 = 그 밖. 같은 tier 안은 처음 순서
  function sortFor(userId: string, people: Person[]): Person[] {
    const mine = access.subscriber(userId) ? access.gradeNo(userId) : null;
    if (mine === null) return people;
    const t = Math.max(1, mine - 1);
    const tier = (p: Person) => (p.grade <= t ? 0 : p.grade === mine ? 1 : 2);
    return people.map((p, i) => ({ p, i })).sort((a, b) => tier(a.p) - tier(b.p) || a.i - b.i).map((x) => x.p);
  }
  // 1회 매칭으로 오늘 받을 수 있는 인원(0~3). monone = 0 · mopart = 모두 2명뿐 · 그 밖 = 6명 중 남은 수
  const moPool = (userId: string, email: string) => (local(email).includes('monone') ? 0 : local(email).includes('mopart') ? 2 : listsFor(userId, email).more.length);
  const moAvailable = (userId: string, email: string) => {
    const s = stateOf(userId, email);
    return Math.max(0, Math.min(3, moPool(userId, email) - s.extra.length));
  };

  return {
    // 12 차단 목록(F7)이 이름 · 나이 · 지역을 쓴다(서버 list_blocked_users 와 같은 값: 성+OO · 만 나이 · 시·도)
    person(id: string): { name: string; age: number; region: Row } | null {
      const p = peopleById(id);
      if (!p) return null;
      return { name: p.name, age: p.age, region: p.region };
    },

    list(userId: string, email: string) {
      const s = stateOf(userId, email);
      s.loads += 1;
      const l = local(email);
      if (l.startsWith('recflaky') && s.loads === 1) return offline();
      if (l.startsWith('recfail')) return offline();
      const { people, day, nextAt } = listFor(userId, email, s);
      const now0 = new Date(now()).toISOString(); // 서버 현재 시각(0008): 앱은 next_at − now 로 센다
      // recprep: 오늘 배치가 아직 끝나지 않은 날(ready=false) → 준비 중(NK02). recfirst: 첫 목록을 받을 차례가 아직 안 온 계정(first_list_pending=true) → 첫 추천 대기(NK01)
      if (l.startsWith('recprep')) return { data: { day, now: now0, ready: false, first_list_pending: false, region_hint: false, next_at: new Date(nextAt).toISOString(), items: [] }, error: null };
      if (l.startsWith('recfirst')) return { data: { day, now: now0, ready: true, first_list_pending: true, region_hint: false, next_at: new Date(nextAt).toISOString(), items: [] }, error: null };
      // 구독자(이고 내 등급이 있을 때)는 나보다 위 등급 분이 앞에 온다(서버 tier 0 → 1 → 2). 앱은 이 순서를 바꾸지 않는다
      const ordered = sortFor(userId, people);
      const item = (p: Person, source: 'free' | 'match_once') => ({
        candidate_id: p.id,
        passed: s.passed.has(p.id),
        liked: s.liked.has(p.id),
        connected: false,
        source,
        profile: cardProfile(p),
        photos: photosFor(email, p),
        reasons: p.reasons,
        // D-197(CK10 폐지 · 청사진 6-2): 상대 등급은 누구에게도 주지 않는다 — grade_no 키 자체가 없다
      });
      const items = [
        ...ordered.filter((p) => visible(userId, s, p)).map((p) => item(p, 'free')),
        ...s.extra.map((id) => peopleById(id)).filter((p): p is Person => p !== undefined && visible(userId, s, p)).map((p) => item(p, 'match_once')),
      ];
      // region_hint: 서버가 오늘 무료 추천이 3명 미만이라고 알림(차단 · 신고로 줄어든 것이 아니라 오늘 만들어진 목록 기준). 지역 조건은 서버가 풀지 않는다
      return { data: { day, now: now0, ready: true, first_list_pending: false, region_hint: people.length < 3, next_at: new Date(nextAt).toISOString(), items }, error: null };
    },

    candidate(userId: string, email: string, id: string) {
      const s = stateOf(userId, email);
      const p = peopleById(id);
      const l = local(email);
      if (l.startsWith('recgone') || !p || !visible(userId, s, p) || s.passed.has(id)) return { data: null, error: null };
      return {
        data: {
          user_id: p.id,
          answers: detailAnswers(p),
          photos: photosFor(email, p),
          reasons: [...p.reasons, ...p.moreReasons],
          ...(promptsOf(p).length > 0 ? { prompts: promptsOf(p) } : {}), // 질문 카드(S14 0018 모양). 없으면 키 자체가 없다
        },
        error: null,
      };
    },

    sendLike(userId: string, email: string, id: string) {
      const s = stateOf(userId, email);
      const p = peopleById(id);
      if (!p || !visible(userId, s, p) || s.passed.has(id)) return fail('42501', 'forbidden');
      if (local(email).startsWith('recoff')) return offline();
      if (s.liked.has(id)) return fail('P0001', 'already_sent');
      if (!s.extra.includes(id) && (local(email).startsWith('reclimit') || freeLikes(userId, s) >= 3)) return fail('P0001', 'daily_limit'); // 1회 매칭 카드는 카드당 1번, 하루 3건 한도 밖
      s.liked.add(id);
      return { data: { like_id: `demo-like-${id}`, connected: false, match_id: null }, error: null };
    },

    pairState(userId: string, id: string) {
      const s = stateOf(userId);
      const p = peopleById(id);
      if (!p || !visible(userId, s, p)) return { data: null, error: null };
      return { data: { user_id: id, state: s.liked.has(id) ? 'sent' : 'none', like_id: s.liked.has(id) ? `demo-like-${id}` : null, match_id: null, expires_at: null, likes_left: Math.max(0, 3 - freeLikes(userId, s)) }, error: null };
    },

    pass(userId: string, id: string) {
      const s = stateOf(userId);
      const p = peopleById(id);
      if (!p || !visible(userId, s, p) || s.passed.has(id) || s.liked.has(id)) return fail('P0001', 'not_available');
      s.passed.add(id);
      return { data: null, error: null };
    },

    report(userId: string, email: string, id: string, reason: unknown, description: unknown) {
      const s = stateOf(userId, email);
      if (!peopleById(id)) return fail('P0001', 'not_available');
      if (typeof reason !== 'string' || !/^RP[1-8]$/.test(reason)) return fail('P0001', 'invalid_reason');
      const text = typeof description === 'string' ? description : null;
      if (text !== null && text.length > 200) return fail('P0001', 'invalid_description');
      if (reason === 'RP8' && (text ?? '').length < 10) return fail('P0001', 'description_required');
      if (local(email).startsWith('recoff')) return offline();
      if (s.reported.has(id)) return fail('P0001', 'already_reported');
      s.reported.add(id);
      s.reports.push({ target: id, reason, description: text });
      s.blocked.add(id); // 신고하면 신고자에게 즉시 숨긴다(P5-03)
      return { data: `demo-report-${s.reports.length}`, error: null };
    },

    block(userId: string, email: string, id: string) {
      const s = stateOf(userId, email);
      if (!peopleById(id)) return fail('P0001', 'not_available');
      if (local(email).startsWith('recoff')) return offline();
      s.blocked.add(id);
      s.liked.delete(id);
      return { data: null, error: null };
    },

    // 16 상점 모의 서버(shopDemo)가 부르는 것: 오늘 1회 매칭으로 받을 수 있는 인원 · 받기(rank 4~9, source match_once) · 오늘 추천 안 사람의 등급(구독자 · CK10)
    matchOnceAvailable(userId: string, email: string): number {
      return moAvailable(userId, email);
    },
    addMatchOnce(userId: string, email: string, want: number): number {
      const s = stateOf(userId, email);
      // mofew: 미리보기에는 3명이 나온다고 했는데 받을 때 한 분이 빠져 2명만 나온다(서버 '못 채움' — 받은 수만큼만 차감)
      const n = Math.min(want, moAvailable(userId, email), local(email).includes('mofew') ? 2 : 3);
      const { first, more } = listsFor(userId, email);
      const next = more.filter((p) => !s.extra.includes(p.id) && !first.some((x) => x.id === p.id));
      let added = 0;
      for (const p of next.slice(0, n)) {
        s.extra.push(p.id);
        added += 1;
      }
      return added;
    },
    gradeInfo(userId: string, id: string): { gradeNo: number } | null {
      const s = stateOf(userId);
      const p = peopleById(id);
      if (!p || !visible(userId, s, p)) return null;
      return { gradeNo: p.grade };
    },

    // 시험 · 화면 점검: 서버(모의)에 남은 것
    peek(userId: string) {
      const s = stateOf(userId);
      return { liked: [...s.liked], passed: [...s.passed], blocked: [...s.blocked], extra: [...s.extra], reports: s.reports.map((r) => ({ ...r })) };
    },
  };
}

export type DemoRecs = ReturnType<typeof createDemoRecs>;
