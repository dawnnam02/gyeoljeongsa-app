// AI 시험판(AIT-F) 서버 응답의 앱 쪽 읽기. 서버 모듈(src/server/ait)은 가져오지 않는다 — 화면 쪽 코드는 서버 폴더를 모른다(보안 AC-01 · ATF-16).
//  서버 응답 꼴은 ai/AIT/README.md 4장. 앱은 code 만 보고 글을 고르고, 서버가 준 오류 문장(text)은 쓰지 않는다(ATF-24).
//  모양이 다르면 null — 호출한 쪽이 '사용할 수 없음'(AIT.code.unavailable)으로 보인다. 글은 길이를 자른다.

export const AIT_FEATURES = ['chat', 'compat', 'coach', 'horoscope'] as const;
export type AitFeature = (typeof AIT_FEATURES)[number];

export const AIT_CODES = ['auth', 'rate', 'spend_limit', 'limit', 'unavailable', 'too_long', 'bad_request', 'upstream', 'timeout', 'blocked_output', 'crisis', 'refused_intent', 'ok'] as const;
export type AitCode = (typeof AIT_CODES)[number];
export const isAitCode = (v: unknown): v is AitCode => typeof v === 'string' && (AIT_CODES as readonly string[]).includes(v);

/** 고정 카드. lines 가 비어 있으면 화면은 카피 23-5 글을 카드 id 로 읽고, 가해 의도 카드 · 겹침 카드는 lines 를 그대로 그린다(IF5-QF2). also = 확정 줄을 덧붙인 다른 갈래 카드 id */
export type AitCard = { id: string; lines: string[]; options: ('continue' | 'end')[]; also?: string[] };
export type AitReply = { ok: boolean; code: AitCode; mode: 'mock' | 'live' | null; display: unknown; card: AitCard | null; bundle: unknown; retryAfterSec: number | null };

/** 호출 결과: 서버가 답했거나(reply) 닿지 못했거나(offline — 정적 판 · 끊김 · 시간 초과 · 모양이 다른 답) */
export type AitResult = { kind: 'reply'; reply: AitReply } | { kind: 'offline' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 600): string | null => (typeof v === 'string' ? v.slice(0, max) : null);

export function parseCard(raw: unknown): AitCard | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !Array.isArray(raw.lines) || !Array.isArray(raw.options)) return null;
  const lines = raw.lines.filter((l): l is string => typeof l === 'string').map((l) => l.slice(0, 400)).slice(0, 10);
  const options = raw.options.filter((o): o is 'continue' | 'end' => o === 'continue' || o === 'end');
  const also = Array.isArray(raw.also) ? raw.also.filter((a): a is string => typeof a === 'string').map((a) => a.slice(0, 24)).slice(0, 4) : [];
  return also.length > 0 ? { id: raw.id.slice(0, 24), lines, options, also } : { id: raw.id.slice(0, 24), lines, options };
}

export function parseReply(raw: unknown): AitReply | null {
  if (!isRecord(raw) || !isAitCode(raw.code) || typeof raw.ok !== 'boolean') return null;
  const retry = typeof raw.retryAfterSec === 'number' && Number.isFinite(raw.retryAfterSec) ? Math.max(1, Math.min(3600, Math.round(raw.retryAfterSec))) : null;
  return { ok: raw.ok, code: raw.code, mode: raw.mode === 'mock' || raw.mode === 'live' ? raw.mode : null, display: raw.display ?? null, card: parseCard(raw.card), bundle: raw.bundle ?? null, retryAfterSec: retry };
}

// ── 챗봇 답(display) ────────────────────────────────────────────────────
export const STAGES = ['S1', 'S2', 'S3', 'S4', 'S5'] as const;
export type AitStage = (typeof STAGES)[number];
export type AitRef = { label: string; type: 'user' | 'card'; quote: string | null; cardId: string | null; citation: string | null; limit: string | null; practical: boolean };
export type AitSentence = { kind: string; text: string; refs: AitRef[]; weak: boolean };
export type AitChatDisplay = { stage: AitStage; sentences: AitSentence[]; notes: string[]; chips: string[]; ended: boolean };

function parseRef(raw: unknown): AitRef | null {
  if (!isRecord(raw) || typeof raw.label !== 'string' || (raw.type !== 'user' && raw.type !== 'card')) return null;
  return { label: raw.label.slice(0, 40), type: raw.type, quote: text(raw.quote, 120), cardId: text(raw.cardId, 40), citation: text(raw.citation, 300), limit: text(raw.limit, 300), practical: raw.practical === true };
}

export function parseChatDisplay(raw: unknown): AitChatDisplay | null {
  if (!isRecord(raw) || !(STAGES as readonly string[]).includes(String(raw.stage)) || !Array.isArray(raw.sentences)) return null;
  const sentences: AitSentence[] = [];
  for (const s of raw.sentences.slice(0, 24)) {
    if (!isRecord(s) || typeof s.kind !== 'string' || typeof s.text !== 'string') return null;
    const refs = (Array.isArray(s.refs) ? s.refs : []).map(parseRef).filter((r): r is AitRef => r !== null).slice(0, 6);
    sentences.push({ kind: s.kind.slice(0, 24), text: s.text.slice(0, 400), refs, weak: s.weak === true });
  }
  const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, max)).slice(0, 24) : []);
  return { stage: raw.stage as AitStage, sentences, notes: strs(raw.notes, 400), chips: strs(raw.chips, 24), ended: raw.ended === true };
}

// ── 단발 기능 답 ────────────────────────────────────────────────────────
export type AitCompatDisplay = { sameLine: string; topics: string[] };
export function parseCompatDisplay(raw: unknown): AitCompatDisplay | null {
  if (!isRecord(raw) || typeof raw.same_line !== 'string' || !Array.isArray(raw.topics)) return null;
  const topics = raw.topics.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 120)).slice(0, 3);
  return topics.length > 0 ? { sameLine: raw.same_line.slice(0, 200), topics } : null;
}

export type AitCoachFinding = { quote: string; point: string; ask: string; options: string[] };
export type AitCoachDisplay = { keep: string; findings: AitCoachFinding[] };
export function parseCoachDisplay(raw: unknown): AitCoachDisplay | null {
  if (!isRecord(raw) || typeof raw.keep !== 'string' || !Array.isArray(raw.findings)) return null;
  const findings: AitCoachFinding[] = [];
  for (const f of raw.findings.slice(0, 3)) {
    if (!isRecord(f) || typeof f.quote !== 'string' || typeof f.point !== 'string' || typeof f.ask !== 'string' || !Array.isArray(f.options)) return null;
    findings.push({ quote: f.quote.slice(0, 80), point: f.point.slice(0, 240), ask: f.ask.slice(0, 240), options: f.options.filter((o): o is string => typeof o === 'string').map((o) => o.slice(0, 300)).slice(0, 2) });
  }
  return { keep: raw.keep.slice(0, 200), findings };
}

export type AitHoroscopeDisplay = { star: string; saju: string };
export function parseHoroscopeDisplay(raw: unknown): AitHoroscopeDisplay | null {
  if (!isRecord(raw) || typeof raw.star !== 'string' || typeof raw.saju !== 'string') return null;
  return { star: raw.star.slice(0, 600), saju: raw.saju.slice(0, 600) };
}
