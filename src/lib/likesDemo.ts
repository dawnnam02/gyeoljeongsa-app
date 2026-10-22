// 데모 모드 모의 서버의 11 호감 부분(F6). 실제 서버 계약(backend/스키마.md 9-12 · migrations/0004 list_likes · accept_like · decline_like)과
// 같은 응답 모양 · 같은 오류 코드를 쓴다.
//  list_likes(p_kind) → received [{ like_id, user_id, created_at, expires_at, card }] · sent [{ like_id, user_id, created_at, card }] · connected [{ match_id, user_id, created_at, card }]
//                       card = { name(성+OO), age, region{sido,sigungu}, face_photo_id }. 최신순. 만료(expires_at 지남) · 거절 · 차단은 빠진다. 종류가 틀리면 invalid_kind
//  accept_like(p_like_id) → { match_id, user_id } | not_available       decline_like(p_like_id) → null | not_available
// 1단계(F6)는 이 파일만 만든다. demoBackend.ts 에 잇는 줄은 app/확인/F6_통합목록.md 2(2단계).
// 장면은 이메일 앞부분으로 고른다:
//  (기본) 받은 호감 2(2시간 전 · 어제) · 보낸 호감 1(3일 전) · 연결 1(어제)    like0 모두 0건(14 · 빈 상태 3종)
//  likeexp 받은 호감 1건이 90초 뒤 만료(오늘 만료 → 만료)    likegone 첫 받은 호감의 상대가 떠남(수락 · 거절 → not_available)
//  likefail 목록을 늘 못 불러옴(인터넷)    likeflaky 종류마다 처음 한 번만 못 불러옴    likedecl 10 에서 보낸 호감을 상대가 바로 거절(0011: 보낸 사람에게는 만료까지 대기와 같음)
// 여기 사람들은 가상이다(실제 사람 아님). 이름은 서버처럼 성 + OO.
// F24: 다섯 사람(demo-liker-1~3 · demo-sent-1 · demo-match-1)은 데모 인물 24명(src/demo/people.ts)의 별칭이다 — 카드 · 10 상세가 그 사람의 이름 · 답 · 사진 3장(모두 승인)을 쓴다.
//  '나'가 남성인 장면(이메일 asmale)은 여성 다섯. 예전 사진 상태(받은 박OO · 보낸 문OO 만 얼굴 사진, 나머지 없음)는 이메일 photocheck 에서만.
import { detailAnswers, legacyPhotoScene, LIKE_IDS, likePersonOf, photosOf, promptsOf } from '@/demo/people';

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };
type DbResult<T> = { data: T | null; error: DbError | null };
type Person = { name: string; age: number; region: Row; facePhotoId?: string | null };

export type DemoLikesUser = { id: string; email: string };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const EXPIRY_MS = 7 * DAY; // 정책 P7-03 · 서버 expires_at = created_at + 168h
type Kind = 'received' | 'sent' | 'connected';

// 예전 데모(F6)에서 얼굴 사진이 있던 두 사람(장면 photocheck 에서만 이 둘만 얼굴 사진)
const LEGACY_FACE = new Set(['demo-liker-1', 'demo-sent-1']);

type LikeState = 'pending' | 'connected' | 'declined' | 'cancelled';
type Like = { id: string; other: string; dir: 'in' | 'out'; state: LikeState; createdAt: number; expiresAt: number };
type Match = { id: string; other: string; createdAt: number };
type UserState = {
  likes: Like[];
  matches: Match[];
  blocked: Set<string>;
  reported: Set<string>;
  reports: { target: string; reason: string; description: string | null }[];
  loads: Record<Kind, number>;
};

const fail = (code: string, message: string): DbResult<never> => ({ data: null, error: { code, message } });
const network = (): DbResult<never> => fail('', 'Failed to fetch');
const iso = (t: number) => new Date(t).toISOString();

export function createDemoLikes(options: { now?: () => number; people?: (id: string) => { name: string; age: number; region: Row } | null } = {}) {
  const now = options.now ?? Date.now;
  const users = new Map<string, UserState>();
  let seq = 0;
  const nextId = (prefix: string) => `demo-${prefix}-${(seq += 1)}`;
  const local = (user: DemoLikesUser) => user.email.split('@')[0];
  // 별칭(호감 데모 다섯) → 데모 인물. 그 밖(10 에서 호감을 보낸 추천 상대 등)은 options.people(demoRecs)
  const seedOf = (id: string, email: string) => likePersonOf(id, email);
  const lookup = (id: string, user: DemoLikesUser): Person | null => {
    const p = seedOf(id, user.email);
    if (p) {
      const face = legacyPhotoScene(user.email) ? (LEGACY_FACE.has(id) ? `demo-ph-${p.n}-face` : null) : `demo-ph-${p.n}-face`;
      return { name: p.name, age: p.age, region: p.region, facePhotoId: face };
    }
    return options.people?.(id) ?? null;
  };

  const stateOf = (user: DemoLikesUser): UserState => {
    let s = users.get(user.id);
    if (!s) {
      s = { likes: [], matches: [], blocked: new Set(), reported: new Set(), reports: [], loads: { received: 0, sent: 0, connected: 0 } };
      const t = now();
      const l = local(user);
      const like = (other: string, dir: 'in' | 'out', createdAt: number): Like => ({ id: nextId('like'), other, dir, state: 'pending', createdAt, expiresAt: createdAt + EXPIRY_MS });
      if (!l.startsWith('like0')) {
        s.likes.push(like('demo-liker-1', 'in', t - 2 * HOUR), like('demo-liker-2', 'in', t - 26 * HOUR), like('demo-sent-1', 'out', t - 3 * DAY - HOUR));
        const matched: Like = { ...like('demo-match-1', 'in', t - 2 * DAY), state: 'connected' };
        s.likes.push(matched);
        s.matches.push({ id: nextId('match'), other: 'demo-match-1', createdAt: t - 30 * HOUR });
        if (l.startsWith('likeexp')) s.likes.push(like('demo-liker-3', 'in', t - EXPIRY_MS + 90_000)); // 90초 뒤 만료
      }
      users.set(user.id, s);
    }
    return s;
  };

  const live = (s: UserState, x: Like) => x.state === 'pending' && x.expiresAt > now() && !s.blocked.has(x.other);
  // 0011 거절 숨김(backend/S9): 내가 보낸 호감을 상대가 거절해도 나(보낸 사람)에게는 만료 시각까지 대기와 똑같이 보인다
  const liveForSender = (s: UserState, x: Like) => x.dir === 'out' && (x.state === 'pending' || x.state === 'declined') && x.expiresAt > now() && !s.blocked.has(x.other);
  const card = (id: string, user: DemoLikesUser) => {
    const p = lookup(id, user);
    return { name: p?.name ?? null, age: p?.age ?? null, region: p?.region ?? null, face_photo_id: p?.facePhotoId ?? null };
  };
  const findIn = (s: UserState, likeId: unknown) => s.likes.find((x) => x.id === likeId && x.dir === 'in');
  const gone = (user: DemoLikesUser, other: string) => local(user).startsWith('likegone') && other === 'demo-liker-1'; // 상대가 탈퇴 · 정지(이유 구분 없음)

  const rpcs: Record<string, (user: DemoLikesUser, args: Row) => DbResult<unknown>> = {
    list_likes(user, args) {
      const kind = args.p_kind;
      if (kind !== 'received' && kind !== 'sent' && kind !== 'connected') return fail('P0001', 'invalid_kind');
      const s = stateOf(user);
      s.loads[kind] += 1;
      const l = local(user);
      if (l.startsWith('likefail') || (l.startsWith('likeflaky') && s.loads[kind] === 1)) return network();
      const desc = <T extends { createdAt: number }>(rows: T[]) => [...rows].sort((a, b) => b.createdAt - a.createdAt);
      if (kind === 'connected') {
        const rows = desc(s.matches.filter((m) => !s.blocked.has(m.other) && !gone(user, m.other)));
        return { data: rows.map((m) => ({ match_id: m.id, user_id: m.other, created_at: iso(m.createdAt), card: card(m.other, user) })), error: null };
      }
      const dir = kind === 'received' ? 'in' : 'out';
      const rows = desc(s.likes.filter((x) => x.dir === dir && (dir === 'out' ? liveForSender(s, x) : live(s, x))));
      return {
        data: rows.map((x) =>
          kind === 'received'
            ? { like_id: x.id, user_id: x.other, created_at: iso(x.createdAt), expires_at: iso(x.expiresAt), card: card(x.other, user) }
            : { like_id: x.id, user_id: x.other, created_at: iso(x.createdAt), card: card(x.other, user) },
        ),
        error: null,
      };
    },

    accept_like(user, args) {
      const s = stateOf(user);
      const hit = findIn(s, args.p_like_id);
      if (!hit || !live(s, hit) || gone(user, hit.other)) return fail('P0001', 'not_available');
      hit.state = 'connected';
      for (const x of s.likes) if (x.dir === 'out' && x.other === hit.other && x.state === 'pending') x.state = 'connected'; // 동시에 보낸 내 호감도 함께
      let match = s.matches.find((m) => m.other === hit.other);
      if (!match) {
        match = { id: nextId('match'), other: hit.other, createdAt: now() };
        s.matches.push(match);
      }
      return { data: { match_id: match.id, user_id: hit.other }, error: null };
    },

    decline_like(user, args) {
      const s = stateOf(user);
      const hit = findIn(s, args.p_like_id);
      if (!hit || !live(s, hit) || gone(user, hit.other)) return fail('P0001', 'not_available');
      hit.state = 'declined'; // 상대에게 알리지 않는다 · 되돌릴 수 없다 · 그 쌍은 영구 제외(P7-06)
      return { data: null, error: null };
    },
  };

  function noteBlock(user: DemoLikesUser, target: string): void {
    const s = stateOf(user);
    s.blocked.add(target);
    for (const x of s.likes) if (x.other === target && (x.state === 'pending' || x.state === 'connected')) x.state = 'cancelled';
    s.matches = s.matches.filter((m) => m.other !== target);
  }

  const knows = (user: DemoLikesUser, target: string) => {
    const s = stateOf(user);
    return LIKE_IDS.includes(target) || s.likes.some((x) => x.other === target) || s.matches.some((m) => m.other === target);
  };

  return {
    // demoBackend.rpc 가 이름이 여기 있으면 넘긴다(2단계)
    handles: (name: string) => name in rpcs,
    rpc(user: DemoLikesUser, name: string, args: Row = {}): Promise<DbResult<unknown>> {
      const handler = rpcs[name];
      if (!handler) return Promise.resolve(fail('42883', `function ${name} does not exist`));
      return Promise.resolve(handler(user, args));
    },

    // 이 모의 서버가 아는 상대인가(받은 · 보낸 · 연결 · 가상 사람). 10 · 신고 · 차단을 어느 모의 서버가 받을지 고를 때 쓴다(2단계)
    knows,

    // 10 상대 프로필(get_candidate_profile): 진행 중 호감 · 연결인 가상 사람만. 볼 수 없으면 null(서버 can_view 와 같은 규칙)
    profile(user: DemoLikesUser, target: string): DbResult<unknown> {
      const s = stateOf(user);
      const p = seedOf(target, user.email);
      const visible = !s.blocked.has(target) && !gone(user, target) && (s.likes.some((x) => x.other === target && (live(s, x) || liveForSender(s, x))) || s.matches.some((m) => m.other === target));
      if (!p || !visible) return { data: null, error: null };
      // 처음: 사진 3장 모두 승인(F24). photocheck: 예전 모양(얼굴 사진이 있던 분만 얼굴 승인 · 전신 확인 중 · 자유 없음)
      const legacy = legacyPhotoScene(user.email);
      const photos = legacy
        ? [
            { slot: 'face', state: LEGACY_FACE.has(target) ? 'approved' : 'pending', photo_id: LEGACY_FACE.has(target) ? `demo-ph-${p.n}-face` : null },
            { slot: 'full', state: 'pending', photo_id: null },
            { slot: 'free', state: 'none', photo_id: null },
          ]
        : photosOf(p, false);
      const prompts = promptsOf(p);
      return { data: { user_id: target, answers: detailAnswers(p), photos, reasons: [...p.reasons, ...p.moreReasons], ...(prompts.length > 0 ? { prompts } : {}) }, error: null };
    },

    // 10 하단(get_pair_state): 이 모의 서버가 아는 상대면 그 상태, 모르면 null(demoRecs 가 답한다). likes_left 는 demoRecs 가 센 값을 받는다
    pairState(user: DemoLikesUser, target: string, likesLeft: number): DbResult<unknown> | null {
      const s = stateOf(user);
      if (!knows(user, target)) return null;
      if (s.blocked.has(target) || gone(user, target)) return { data: null, error: null };
      const base = { user_id: target, like_id: null as string | null, match_id: null as string | null, expires_at: null as string | null, likes_left: likesLeft };
      const match = s.matches.find((m) => m.other === target);
      if (match) return { data: { ...base, state: 'connected', match_id: match.id }, error: null };
      const inLike = s.likes.find((x) => x.dir === 'in' && x.other === target && live(s, x));
      if (inLike) return { data: { ...base, state: 'received', like_id: inLike.id, expires_at: iso(inLike.expiresAt) }, error: null };
      const outLike = s.likes.find((x) => x.other === target && liveForSender(s, x)); // 0011: 거절돼도 만료 시각까지 'sent'(같은 like_id)
      if (outLike) return { data: { ...base, state: 'sent', like_id: outLike.id }, error: null };
      return { data: { ...base, state: 'none' }, error: null }; // 내가 거절한 쌍 · 보낸 호감이 거절된 뒤 만료된 쌍은 none(서버와 같다)
    },

    // 다시 보내기가 forbidden 인 거절된 쌍인가(demoBackend 의 send_like 가 true 면 forbidden). 0011: 내가 거절한 쌍은 늘,
    // 내가 보낸 호감이 거절된 쌍은 만료 시각이 지난 뒤에만(그 전에는 보낸 사람에게 대기와 같아 already_sent)
    declined(user: DemoLikesUser, target: string): boolean {
      return stateOf(user).likes.some((x) => x.other === target && x.state === 'declined' && (x.dir === 'in' || x.expiresAt <= now()));
    },

    // 10 에서 호감 보내기가 성공한 뒤(demoRecs.sendLike 성공 시 demoBackend 가 부른다, 2단계): 보낸 호감 목록에 올린다.
    // 상대가 이미 나에게 보낸 대기 호감이 있으면 바로 연결(서버 send_like 와 같다). likedecl 장면은 상대가 곧바로 거절한다(T2 시험)
    noteSent(user: DemoLikesUser, target: string): { connected: boolean; matchId: string | null } {
      const s = stateOf(user);
      const t = now();
      if (s.likes.some((x) => x.dir === 'out' && x.other === target && (x.state === 'pending' || x.state === 'connected'))) return { connected: false, matchId: null };
      const inLike = s.likes.find((x) => x.dir === 'in' && x.other === target && live(s, x));
      const out: Like = { id: nextId('like'), other: target, dir: 'out', state: 'pending', createdAt: t, expiresAt: t + EXPIRY_MS };
      s.likes.push(out);
      if (inLike) {
        inLike.state = 'connected';
        out.state = 'connected';
        const match = { id: nextId('match'), other: target, createdAt: t };
        s.matches.push(match);
        return { connected: true, matchId: match.id };
      }
      if (local(user).startsWith('likedecl')) out.state = 'declined';
      return { connected: false, matchId: null };
    },

    // 차단(11 ⋯ · 10 · 12): 대기 · 연결 호감은 취소, 연결은 지운다(서버 cancel_pair). 세 목록 어디에도 나오지 않는다
    noteBlock,

    // 신고(11 ⋯): demoRecs.report 와 같은 검사 · 같은 코드. 신고하면 신고자에게 즉시 숨긴다(P5-03)
    report(user: DemoLikesUser, target: string, reason: unknown, description: unknown): DbResult<unknown> {
      const s = stateOf(user);
      if (!knows(user, target)) return fail('P0001', 'not_available');
      if (typeof reason !== 'string' || !/^RP[1-8]$/.test(reason)) return fail('P0001', 'invalid_reason');
      const text = typeof description === 'string' ? description : null;
      if (text !== null && text.length > 200) return fail('P0001', 'invalid_description');
      if (reason === 'RP8' && (text ?? '').length < 10) return fail('P0001', 'description_required');
      if (s.reported.has(target)) return fail('P0001', 'already_reported');
      s.reported.add(target);
      s.reports.push({ target, reason, description: text });
      noteBlock(user, target);
      return { data: `demo-report-like-${s.reports.length}`, error: null };
    },

    // 12 차단 목록이 이름 · 나이 · 지역을 쓴다(settingsDemo 의 people 에 더한다, 2단계)
    person(id: string, email = ''): { name: string; age: number; region: Row } | null {
      const p = seedOf(id, email);
      return p ? { name: p.name, age: p.age, region: p.region } : null;
    },

    // 시험 · 화면 점검: 서버(모의)에 남은 것(상대 id 만)
    peek(user: DemoLikesUser) {
      const s = stateOf(user);
      const by = (dir: 'in' | 'out', state: LikeState) => s.likes.filter((x) => x.dir === dir && x.state === state).map((x) => x.other);
      return {
        received: by('in', 'pending'),
        sent: by('out', 'pending'),
        connected: s.matches.map((m) => m.other),
        declinedByMe: by('in', 'declined'),
        declinedByThem: by('out', 'declined'),
        blocked: [...s.blocked],
        reports: s.reports.map((r) => ({ ...r })),
      };
    },
  };
}

export type DemoLikes = ReturnType<typeof createDemoLikes>;
