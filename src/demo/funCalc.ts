// 데모 모의 서버 전용 재미 계산(IF2-F · D-223) — 기준 구현 ai/IF2/fun_calc.py 와 같은 식 · 같은 시험값(ai/IF2/check_calc.py, 시험 iffCalc).
//  · 실서버에서는 서버(0043 private.fun_*)가 비밀 키로 계산하고 앱은 결과 번호만 받는다(보안 IC-16 · IFF-10 '앱에 카드 계산 코드 0').
//    그래서 이 파일은 demo/ 안에만 두고, 화면 · API 파일(features/inflight)은 가져오지 않는다(시험이 import 를 본다)
//  · 표준 계산만(외부 호출 · 유료 0). 생년월일은 데모 가상 회원 값만 쓰고 저장 · 로그 0
//  · HMAC-SHA256 은 작은 순수 구현(Expo 기기 모듈 없이 시험 · 웹 데모에서 같은 값)
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// UTF-8 바이트(TextEncoder 가 없는 환경도 같은 값)
export function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function sha256(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const bitLen = data.length * 8;
  const padLen = ((data.length + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(padLen);
  buf.set(data);
  buf[data.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(padLen - 4, bitLen >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) ov.setUint32(i * 4, h[i]);
  return out;
}

export function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  let k = key.length > 64 ? sha256(key) : key;
  const block = new Uint8Array(64);
  block.set(k);
  k = block;
  const ipad = new Uint8Array(64 + msg.length);
  const opad = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i += 1) {
    ipad[i] = k[i] ^ 0x36;
    opad[i] = k[i] ^ 0x5c;
  }
  ipad.set(msg, 64);
  opad.set(sha256(ipad), 64);
  return sha256(opad);
}

// HMAC-SHA256 앞 8바이트(빅엔디언 부호 없는 정수) mod n — 2^53 을 넘으므로 BigInt
export function h64(key: string, msg: string, n: number): number {
  const d = hmacSha256(utf8(key), utf8(msg));
  let v = BigInt(0);
  for (let i = 0; i < 8; i += 1) v = v * BigInt(256) + BigInt(d[i]);
  return Number(v % BigInt(n));
}

export function tarotCard(key: string, memberId: string, issueDate: string, slot: number): number {
  if (![0, 1, 2].includes(slot)) throw new Error('invalid_slot');
  return h64(key, `tarot:v1:${memberId}:${issueDate}:${slot}`, 22);
}

export function pickDistinct(key: string, label: string, n: number, k: number): number[] {
  const out: number[] = [];
  const want = Math.min(k, n);
  for (let i = 0; out.length < want && i < 100000; i += 1) {
    const v = h64(key, `${label}:${i}`, n);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export const compatVariant = (key: string, roomId: string, slot: 'saju' | 'star'): number => h64(key, `compat:v1:${roomId}:${slot}`, 2) + 1;

// ── 별자리(관례 표 · 양력) ──────────────────────────────────────────────
export const SIGN_TABLE: readonly (readonly [string, number, number, 'fire' | 'earth' | 'air' | 'water'])[] = [
  ['aquarius', 1, 20, 'air'],
  ['pisces', 2, 19, 'water'],
  ['aries', 3, 21, 'fire'],
  ['taurus', 4, 20, 'earth'],
  ['gemini', 5, 21, 'air'],
  ['cancer', 6, 22, 'water'],
  ['leo', 7, 23, 'fire'],
  ['virgo', 8, 23, 'earth'],
  ['libra', 9, 23, 'air'],
  ['scorpio', 10, 23, 'water'],
  ['sagittarius', 11, 22, 'fire'],
  ['capricorn', 12, 22, 'earth'],
];
export const signElement = (code: string): string => SIGN_TABLE.find((s) => s[0] === code)?.[3] ?? 'fire';

const ymd = (iso: string): [number, number, number] => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error('invalid_date');
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

// 3부-차(AI G-08 경계 고침 · 0046 fun_sign_cusp): 경계는 시작일 −1 · 0 · +1 (경계마다 3일, 해마다 36일). 세 날 모두 같은 두 자리 {앞 자리, 새 자리}.
//  · sign = 관례 대표(저장 값 — 궁합 카드 원소 계산에만 씀) · signs = 화면에 나가는 별자리 — 경계 날은 순서 없는 한 쌍을 달력 순(SIGN_TABLE 번호)으로, 경계가 아니면 하나.
//    어느 쪽이 대표인지 · 전날인지 당일인지는 응답에서 알 수 없다(보안 IC3-17 · 정책 PG-81)
export function sunSign(birthIso: string): { sign: string; signs: string[] } {
  const [, mo, d] = ymd(birthIso);
  let idx = SIGN_TABLE.length - 1;
  SIGN_TABLE.forEach((s, i) => {
    if (mo > s[1] || (mo === s[1] && d >= s[2])) idx = i;
  });
  const ref = Date.UTC(2000, mo - 1, d);
  let other: number | null = null;
  SIGN_TABLE.forEach((s, i) => {
    const start = Date.UTC(2000, s[1] - 1, s[2]);
    if (ref === start || ref === start + 86_400_000) other = (i + SIGN_TABLE.length - 1) % SIGN_TABLE.length; // 시작일 · +1일 → 앞 자리
    else if (ref === start - 86_400_000) other = i; // 시작 전날 → 그 자리
  });
  const pair = other === null ? [idx] : [idx, other as number].sort((a, b) => a - b);
  return { sign: SIGN_TABLE[idx][0], signs: pair.map((i) => SIGN_TABLE[i][0]) };
}

// ── 일주 · 일간 · 그 주 기운 ────────────────────────────────────────────
// 율리우스 적일(정오 기준 정수): 1970-01-01 = 2440588
export const jdn = (iso: string): number => {
  const [y, m, d] = ymd(iso);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) + 2440588;
};
export const dayIndex60 = (iso: string): number => (((jdn(iso) + 49) % 60) + 60) % 60;
export const dayStem = (iso: string): number => dayIndex60(iso) % 10;
export const ELEM5 = ['wood', 'fire', 'earth', 'metal', 'water'] as const;
export const ELEM4 = ['fire', 'earth', 'air', 'water'] as const;
export const stemElement = (stem: number): string => ELEM5[Math.floor(stem / 2)];

const addDays = (iso: string, n: number): string => {
  const [y, m, d] = ymd(iso);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
};
export function weekElement(issueThursday: string): string {
  const [y, m, d] = ymd(issueThursday);
  if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 4) throw new Error('not_thursday');
  return stemElement(dayStem(addDays(issueThursday, 4)));
}
export const weekNo = (issue: string, first: string): number => Math.floor((jdn(issue) - jdn(first)) / 7) + 1;

export function rel5Week(me: string, week: string): 'same' | 'express' | 'fill' | 'tend' | 'shape' {
  const i = ELEM5.indexOf(me as (typeof ELEM5)[number]);
  const j = ELEM5.indexOf(week as (typeof ELEM5)[number]);
  if (i === j) return 'same';
  if ((i + 1) % 5 === j) return 'express';
  if ((j + 1) % 5 === i) return 'fill';
  if ((i + 2) % 5 === j) return 'tend';
  return 'shape';
}

const pairKey = (a: string, b: string, order: readonly string[]) => (order.indexOf(a) <= order.indexOf(b) ? `${a}-${b}` : `${b}-${a}`);
export const pair5 = (a: string, b: string) => pairKey(a, b, ELEM5);
export const pair4 = (a: string, b: string) => pairKey(a, b, ELEM4);

// ── 궁합 카드 ④ 첫 대화 소재(0043 pair_card_topics · fun_calc compat_card topics 와 같은 차례) ──────────
export type DemoHobbyItem = { code: string } | { group: string };
export function cardTopics(key: string, roomId: string, hobbies: readonly DemoHobbyItem[], tplCount = 8, chipCount = 30): { id: string; hobby?: DemoHobbyItem }[] {
  const out: { id: string; hobby?: DemoHobbyItem }[] = [];
  if (hobbies.length > 0) {
    pickDistinct(key, `topic:v1:${roomId}`, tplCount, Math.min(3, tplCount)).forEach((v, n) => {
      if (out.length >= Math.min(3, hobbies.length * 2)) return;
      out.push({ id: `ct-${String(v + 1).padStart(2, '0')}`, hobby: hobbies[n % hobbies.length] });
    });
  }
  for (const c of pickDistinct(key, `chips:v1:${roomId}`, chipCount, 3)) {
    if (out.length >= 3) break;
    out.push({ id: `ch-${String(c + 1).padStart(2, '0')}` });
  }
  return out;
}

// ── 내 여행 타입(3부-자 · F-19 · 계산명세 10-1 — fun_calc.travel_type · type_routes 와 같은 식) ──────────
//  성향 정리 결과(5축 · 대화 방식 4칸)로만 정한다. 짐 싸기 답 · 등급 · 돈 · 외모 입력 0. 실서버에는 아직 타입 계산이 없어(백엔드 11-5) 데모 모의 서버만 쓴다
export type DemoTraits = { extraversion: number; planning: number; conflict?: number | null };
export type DemoTalkStyle = { deliberation: number; expressiveness: number; warmth: number; candor: number };
export const TYPE_ORDER: readonly (readonly ['quiet' | 'social', 'plan' | 'free', 'calm' | 'warm' | 'frank'])[] = [
  ['quiet', 'plan', 'calm'], ['quiet', 'plan', 'warm'], ['quiet', 'plan', 'frank'],
  ['quiet', 'free', 'calm'], ['quiet', 'free', 'warm'], ['quiet', 'free', 'frank'],
  ['social', 'plan', 'calm'], ['social', 'plan', 'warm'], ['social', 'plan', 'frank'],
  ['social', 'free', 'calm'], ['social', 'free', 'warm'], ['social', 'free', 'frank'],
];
const TALK_STYLES = ['calm', 'warm', 'frank'] as const;
export const typeId = (index0: number): string => `tt-${String(index0 + 1).padStart(2, '0')}`;

// 대화 결 셋: 대화 방식 4칸이 있으면 차분 = 신중함 · 다정 = (따뜻함 + 표현) / 2 · 솔직 = 솔직함 중 가장 큰 쪽(같으면 차분 → 다정 → 솔직). 없으면 갈등 대처 축(33 이하 차분 · 67 이상 솔직 · 사이 다정). 둘 다 없으면 null(타입 0)
export function talkStyle(style: DemoTalkStyle | null | undefined, conflict: number | null | undefined): 'calm' | 'warm' | 'frank' | null {
  if (style) {
    const marks = { calm: style.deliberation, warm: (style.warmth + style.expressiveness) / 2, frank: style.candor };
    const best = Math.max(marks.calm, marks.warm, marks.frank);
    return TALK_STYLES.find((s) => marks[s] === best) ?? 'calm';
  }
  if (conflict === null || conflict === undefined) return null;
  return conflict <= 33 ? 'calm' : conflict >= 67 ? 'frank' : 'warm';
}

// 외향성 · 계획성 50 이상 = 높음(경계 50 = 높음). 가족 중심 · 경제관은 쓰지 않는다. 결과 'tt-01' ~ 'tt-12' · 자료가 없으면 null
export function travelType(traits: DemoTraits, style?: DemoTalkStyle | null): string | null {
  const s = talkStyle(style, traits.conflict);
  if (!s) return null;
  const at = TYPE_ORDER.findIndex(([e, p, t]) => e === (traits.extraversion >= 50 ? 'social' : 'quiet') && p === (traits.planning >= 50 ? 'plan' : 'free') && t === s);
  return at < 0 ? null : typeId(at);
}

// '대화가 편하게 이어지는 타입' 두 역: ① 같은 여행 결 · 대화 결은 다음 칸(차분 → 다정 → 솔직 → 차분) ② 여행 결 둘 다 반대 · 대화 결 같음
export function typeRoutes(id: string): [string, string] {
  const [e, p, s] = TYPE_ORDER[Number(id.slice(3)) - 1];
  const next = TALK_STYLES[(TALK_STYLES.indexOf(s) + 1) % 3];
  const idx = (e2: string, p2: string, s2: string) => TYPE_ORDER.findIndex(([a, b, c]) => a === e2 && b === p2 && c === s2);
  return [typeId(idx(e, p, next)), typeId(idx(e === 'quiet' ? 'social' : 'quiet', p === 'plan' ? 'free' : 'plan', s))];
}
