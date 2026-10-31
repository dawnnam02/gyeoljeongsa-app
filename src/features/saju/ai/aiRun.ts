// 유료 AI 맞춤 한 번 돌리기(IF5-F2 ⑨ ⑩ · 설계안 M-12 · S-10 · 보안 IC5-35 · IFF5-02 ~ 06 · 15).
//  순서: (대화면) 위기 앞거름 → 마일리지 예치(요청 번호 하나) → 서버 호출 1번(접근 코드가 있으면 실제 · 없으면 데모 글) → 답이 나가면 확정 · 못 받으면 해제(차감 0).
//  · 위기 카드는 차감 0 · 잔액이 0이어도 나온다(예치 전에 거른다). 검사 탈락(blocked_output) · 시간 초과 · 끊김 · 오류는 모두 해제 — 마일리지는 쓰이지 않았어요
//  · 종합 풀이는 풀이 · 대운 · 올해 세 번을 이어 부르고 한 예치로 묶는다(하나라도 못 받으면 전부 해제)
//  · 앱 자동 재시도 0 — 사용자가 다시 누르면 같은 요청 번호로 다시 예치한다. 결제 호출(consumeAsync …) 0 · 금액 인자 0
import { demoHelpHit } from '@/demo/crisisWords';
import type { AitCard, AitResult } from '@/features/ait/aitTypes';
import type { LedgerEdge } from '@/features/mileage/ledgerEdge';
import { mockOutput5 } from '@/saju5/mock5';
import type { Feature5 } from '@/saju5/spec5';

import { postSaju5, type S5Kind } from './aiClient';

/** 화면에서 고르는 기능 일곱 — 종합(full)은 서버 기능이 아니라 세 번 묶음 */
export type AiKind = 'reading' | 'daewoon' | 'sinyeon' | 'full' | 'compat' | 'taekil' | 'chat';
/** 마일리지 차감표의 기능 이름(서버 0048 mileage_features) — 값(수)은 get_mileage 응답에서 읽는다 */
export const COST_FEATURE: Readonly<Record<AiKind, string>> = { reading: 'saju_reading', daewoon: 'daewoon', sinyeon: 'sinyeon', full: 'saju_full', compat: 'compat', taekil: 'taekil_explain', chat: 'saju_chat_turn' };
/** 마일리지 내역 화면 '쓴 곳' 이름에 쓰는 화면 이름(확인 시트 '{기능 이름}')은 카피 키로 — 화면이 고른다 */

export type AiOutcome =
  | { kind: 'ok'; display: unknown; mode: 'live' | 'demo'; bundle?: unknown }
  | { kind: 'card'; card: AitCard; bundle?: unknown }
  | { kind: 'low'; need: number; have: number }
  | { kind: 'blocked' } // 검사 탈락 — 차감 0
  | { kind: 'failed'; code: 'rate' | 'auth' | 'limit' | 'unavailable'; retryAfterSec?: number } // 차감 0
  | { kind: 'maint' }; // 장부 · 스위치 꺼짐 — 차감 0

export type AiDeps = {
  edge: LedgerEdge;
  code: () => string | null; // 접근 코드(있어야 실제 AI) — 값은 어디에도 내보내지 않는다
  post?: (kind: S5Kind, body: Record<string, unknown>, code: string) => Promise<AitResult>;
};

export type AiRequest = {
  kind: AiKind;
  requestId: string;
  chars: number; // 이번에 보내는 글 글자 수(길이 가산 계산용 숫자 하나 — 내용 0)
  /** 단발: 사실 묶음. 종합은 { reading, daewoon, sinyeon } 셋 */
  facts?: Record<string, unknown>;
  full?: { reading: Record<string, unknown>; daewoon: Record<string, unknown> | null; sinyeon: Record<string, unknown> | null };
  /** 대화: 이번 글 · 서명 묶음(이어 갈 때) */
  text?: string;
  bundle?: unknown;
};

export const newRequestId = (): string => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

const DEMO_CRISIS_CARD: AitCard = { id: 'crisis', lines: [], options: ['continue', 'end'] };

/** 위기 앞거름 — 서버가 아는 위기 · 폭력 · 거절 · 미성년을 예치 전에 본다. 코드가 없으면 데모 낱말 목록뿐 */
async function precheck(d: AiDeps, text: string): Promise<AitCard | null> {
  const code = d.code();
  if (!code) return demoHelpHit(text) ? DEMO_CRISIS_CARD : null;
  const res = await (d.post ?? postSaju5)('chat', { text, precheck: true }, code);
  return res.kind === 'reply' && !res.reply.ok && res.reply.card ? res.reply.card : null; // 닿지 못해도(offline) 예치 단계에서 걸러진다 — 업체 호출은 서버가 다시 거른다
}

function demoDisplay(kind: S5Kind, facts: Record<string, unknown>): unknown {
  if (kind === 'chat') {
    const o = mockOutput5('chat' as Feature5, facts);
    return { reply: o.reply, ask: o.ask, flags: [], turns: 1, summarized: false };
  }
  return mockOutput5(kind as Feature5, facts);
}

type Call = { kind: 'ok'; display: unknown; bundle?: unknown; mode: 'live' | 'demo' } | { kind: 'card'; card: AitCard; bundle?: unknown } | { kind: 'fail'; why: 'blocked' | 'timeout' | 'rate' | 'auth' | 'limit' | 'unavailable'; retryAfterSec?: number };

async function callOne(d: AiDeps, kind: S5Kind, body: Record<string, unknown>, demoFacts: Record<string, unknown>): Promise<Call> {
  const code = d.code();
  if (!code) {
    // 접근 코드 없음 → 서버 요청 0 · 데모 글(미리 만든 모의 글 — 사실에서 낱말만 가져온다)
    try {
      return { kind: 'ok', display: demoDisplay(kind, demoFacts), mode: 'demo' };
    } catch {
      return { kind: 'fail', why: 'unavailable' };
    }
  }
  const res = await (d.post ?? postSaju5)(kind, body, code);
  if (res.kind === 'offline') return { kind: 'fail', why: 'unavailable' };
  const r = res.reply;
  if (r.code === 'ok' && r.display) return { kind: 'ok', display: r.display, bundle: r.bundle, mode: r.mode === 'live' ? 'live' : 'demo' };
  if ((r.code === 'crisis' || r.code === 'refused_intent') && r.card) return { kind: 'card', card: r.card, bundle: r.bundle };
  if (r.code === 'blocked_output') return { kind: 'fail', why: 'blocked' };
  if (r.code === 'timeout') return { kind: 'fail', why: 'timeout' };
  if (r.code === 'rate') return { kind: 'fail', why: 'rate', retryAfterSec: r.retryAfterSec ?? undefined };
  if (r.code === 'auth') return { kind: 'fail', why: 'auth' };
  if (r.code === 'limit') return { kind: 'fail', why: 'limit' };
  return { kind: 'fail', why: 'unavailable' };
}

export async function runAi(d: AiDeps, req: AiRequest): Promise<AiOutcome> {
  // 0) 위기 앞거름(대화)
  if (req.kind === 'chat' && req.text) {
    const card = await precheck(d, req.text);
    if (card) {
      await d.edge.hold({ feature: COST_FEATURE.chat, chars: 0, requestId: req.requestId, crisis: true }); // 차감 0 · 잔액 0이어도 막지 않는다(아무것도 쓰지 않는다)
      return { kind: 'card', card };
    }
  }
  // 1) 예치
  const h = await d.edge.hold({ feature: COST_FEATURE[req.kind], chars: req.chars, requestId: req.requestId });
  if (h.kind === 'low') return { kind: 'low', need: h.need, have: h.have };
  if (h.kind === 'off' || h.kind === 'fail' || h.kind === 'tooLarge') return { kind: 'maint' };
  if (h.kind === 'free') return { kind: 'maint' };
  const done = async (ok: boolean, reason: 'check_failed' | 'timeout' | 'provider_error' | 'user_cancel') => {
    await (ok ? d.edge.settle(h.holdId) : d.edge.release(h.holdId, reason));
  };

  // 2) 서버 호출 — 한 번(종합은 세 번)
  let out: Call;
  if (req.kind === 'full') {
    const parts: ['reading' | 'daewoon' | 'sinyeon', Record<string, unknown> | null][] = [['reading', req.full?.reading ?? null], ['daewoon', req.full?.daewoon ?? null], ['sinyeon', req.full?.sinyeon ?? null]];
    const display: Record<string, unknown> = {};
    out = { kind: 'ok', display, mode: 'demo' };
    for (const [k, facts] of parts) {
      if (!facts) continue; // 대운 칸이 없는 분은 그 편만 빠진다
      const one = await callOne(d, k, { facts }, facts);
      if (one.kind !== 'ok') {
        out = one;
        break;
      }
      display[k] = one.display;
      out = { kind: 'ok', display, mode: one.mode };
    }
  } else if (req.kind === 'chat') {
    const facts = req.facts ?? {};
    out = await callOne(d, 'chat', req.bundle !== undefined && req.bundle !== null ? { text: req.text, bundle: req.bundle } : { text: req.text, facts }, facts);
  } else {
    const facts = req.facts ?? {};
    out = await callOne(d, req.kind, { facts }, facts);
  }

  // 3) 확정 · 해제
  if (out.kind === 'ok') {
    await done(true, 'check_failed');
    return { kind: 'ok', display: out.display, mode: out.mode, bundle: out.bundle };
  }
  if (out.kind === 'card') {
    await done(false, 'user_cancel'); // 카드(위기 · 거절)는 차감 0
    return { kind: 'card', card: out.card, bundle: out.bundle };
  }
  await done(false, out.why === 'blocked' ? 'check_failed' : out.why === 'timeout' ? 'timeout' : 'provider_error');
  if (out.why === 'blocked') return { kind: 'blocked' };
  return { kind: 'failed', code: out.why === 'timeout' ? 'unavailable' : out.why, retryAfterSec: out.retryAfterSec };
}
