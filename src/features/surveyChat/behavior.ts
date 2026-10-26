// 입력 행동 숫자 6개(V6 3-1 · ai/V6/행동지표.md 1 · 2 · 3장). CK16 별도 동의자만 화면이 이 계산기를 만든다(동의 없으면 계산 0 · 보냄 0).
//  · 키 하나하나의 기록은 만들지도 저장하지도 않는다: 메시지 하나 동안 카운터 몇 개만 들고 있다가, 보낼 때 숫자 6개로 줄이고 바로 0 으로 되돌린다
//  · 시각은 단조 시계(performance.now)만. 기기 저장소에 쓰지 않는다
//  · 한글 조합(IME): '보이는 글자 수 차이' 하나로 센다 — ㅎ → 하 → 한 은 수가 같아 지움 0, 조합 중 자모 지움(한 → 하)도 수가 같아 지움 0,
//    받침 넘어감(한 + ㅏ → 하나)은 늘어난 것으로만. 글자 수가 줄 때만 지움으로 센다. 조합 이벤트에 기대지 않아 iOS · 안드로이드 · 웹이 같다
//  · 한 번에 5글자 넘게 늘면(붙여넣기 · 음성 · 자동 완성) 그 메시지는 tainted → 6개 모두 null. 1분 넘게 백그라운드도 tainted
export type Behavior = {
  readonly first_key_ms: number | null;
  readonly compose_ms: number | null;
  readonly chars_per_sec_x10: number | null;
  readonly delete_ratio_pm: number | null;
  readonly pauses_3s: number | null;
  readonly rewrites: number | null;
};
export const BEHAVIOR_KEYS = ['first_key_ms', 'compose_ms', 'chars_per_sec_x10', 'delete_ratio_pm', 'pauses_3s', 'rewrites'] as const;
export const NULL_BEHAVIOR: Behavior = { first_key_ms: null, compose_ms: null, chars_per_sec_x10: null, delete_ratio_pm: null, pauses_3s: null, rewrites: null };

const PAUSE_MS = 3_000;
const JUMP = 5; // 한 번에 이보다 많이 늘면 붙여넣기 · 음성으로 본다
const BG_TAINT_MS = 60_000;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type SegmenterLike = { segment(text: string): Iterable<unknown> };
type IntlWithSegmenter = { Segmenter?: new (locale: string, opts: { granularity: 'grapheme' }) => SegmenterLike };
let seg: SegmenterLike | null | undefined;
// 보이는 글자 수(음절 · 영문자 · 숫자 · 기호 · 이모지 하나). 줄바꿈은 세지 않고 공백은 센다. 조합된 글자(NFC)로 센다
export function graphemes(text: string): number {
  const s = text.normalize('NFC').replace(/[\r\n]/g, '');
  if (seg === undefined) {
    const S = (Intl as unknown as IntlWithSegmenter).Segmenter;
    seg = S ? new S('ko', { granularity: 'grapheme' }) : null;
  }
  if (seg) {
    return Array.from(seg.segment(s)).length;
  }
  return [...s].length;
}

const monotonic = (): number => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

export type Meter = {
  shown(): void; // AI 말 표시가 끝난 때(첫 글자까지 시간의 시작)
  change(text: string): void; // 입력 칸 글이 바뀔 때(조합 중 값 포함)
  background(active: boolean): void; // 앱이 뒤로 갔다 돌아옴
  finish(text: string): Behavior; // 보낼 때 숫자 6개로 줄이고 0 으로 되돌림
};

export function createMeter(now: () => number = monotonic): Meter {
  let tShown: number | null = null;
  let tFirst: number | null = null;
  let tLast: number | null = null;
  let prevLen = 0;
  let deleted = 0;
  let pauses = 0;
  let pauseExtra = 0;
  let armed = false; // 10글자 이상을 지났다
  let cleared = false; // 그 뒤 2글자 이하로 줄었다
  let rewrites = 0;
  let tainted = false;
  let bgAt: number | null = null;
  let bgTotal = 0;

  const reset = () => {
    tFirst = null;
    tLast = null;
    prevLen = 0;
    deleted = 0;
    pauses = 0;
    pauseExtra = 0;
    armed = false;
    cleared = false;
    rewrites = 0;
    tainted = false;
    bgAt = null;
    bgTotal = 0;
  };

  return {
    shown() {
      reset();
      tShown = now();
    },
    change(text) {
      if (tShown === null) return; // 이어하기 중이던 메시지 · AI 말이 아직 안 나온 때는 세지 않는다
      const len = graphemes(text);
      const at = now();
      if (len === prevLen && tFirst === null) return;
      if (len - prevLen > JUMP) tainted = true;
      if (tFirst === null && len > 0) tFirst = at;
      if (tLast !== null) {
        const gap = at - tLast;
        if (gap > PAUSE_MS) {
          pauses += 1;
          pauseExtra += gap - PAUSE_MS;
        }
      }
      if (len < prevLen) deleted += prevLen - len;
      if (len >= 10) armed = true;
      if (armed && len <= 2) {
        cleared = true;
        armed = false;
      } else if (cleared && len > prevLen) {
        rewrites += 1;
        cleared = false;
      }
      tLast = at;
      prevLen = len;
    },
    background(active) {
      if (!active && bgAt === null) bgAt = now();
      else if (active && bgAt !== null) {
        const gone = now() - bgAt;
        bgTotal += gone;
        if (gone > BG_TAINT_MS) tainted = true;
        if (tLast !== null) tLast += gone; // 나가 있던 시간은 멈춤으로 세지 않는다
        bgAt = null;
      }
    },
    finish(text) {
      const sendAt = now();
      const shownAt = tShown;
      const first = tFirst;
      const out = (() => {
        if (shownAt === null || first === null || tainted) return NULL_BEHAVIOR;
        const L = graphemes(text);
        const firstKey = clamp(Math.round(first - shownAt), 0, 600_000);
        const compose = clamp(Math.round(sendAt - first - bgTotal), 0, 1_800_000);
        const cps = L < 5 ? null : clamp(Math.round((L / Math.max(1, compose - pauseExtra)) * 1000 * 10), 0, 300);
        return {
          first_key_ms: firstKey,
          compose_ms: compose,
          chars_per_sec_x10: cps,
          delete_ratio_pm: clamp(Math.round((deleted / Math.max(1, L + deleted)) * 1000), 0, 1000),
          pauses_3s: clamp(pauses, 0, 200),
          rewrites: clamp(rewrites, 0, 50),
        };
      })();
      tShown = null;
      reset();
      return out;
    },
  };
}

// 보낼 값: 동의가 없으면 아예 보내지 않는다(undefined). 6개 모두 null 이면 null
export function behaviorPayload(ck16: boolean, b: Behavior | null): Behavior | null | undefined {
  if (!ck16) return undefined;
  if (!b || BEHAVIOR_KEYS.every((k) => b[k] === null)) return null;
  return b;
}
