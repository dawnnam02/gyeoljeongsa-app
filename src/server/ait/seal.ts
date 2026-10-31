// AIT-A · 서명된 이력(상태 없는 대화) — 보안 AC-36 · 본인 결정 D-3.
// 서버에는 대화 저장소가 없으므로 이력은 앱이 매 턴 보내되, 서버가 HMAC으로 서명한 묶음만 받아들인다.
// 앱이 만든 assistant 턴 · 바꾼 글 · 바꾼 순서 · 다른 세션/기능의 서명 재사용 · 만료는 모두 거절한다.
// 서명 키는 접근 코드와 다른 비밀 변수다(코드를 아는 사람이 이력을 만들지 못하게). 이 파일은 키를 읽지 않고, 호출하는 쪽이 문자열로 넘긴다.
//
// 서명 입력: 'ait1|' + 기능 이름 + '|' + payload(JSON 문자열)
// payload  : { v, feature, nonce(세션), seq(서명 순번), iat(발급 시각 ms), prev(앞 서명), env(봉투 전체) }
// → 앞 서명(prev) · 순번 · 발급 시각 · 지금까지 모든 턴 글(env.userTexts · messages)이 한 서명에 묶인다.

import type { ChatEnvelope } from './chat.ts';
import { newSession } from './chat.ts';
import { AitError } from './codes.ts';

export interface SealedBundle { payload: string; mac: string }
export interface OpenedBundle { env: ChatEnvelope; nonce: string; seq: number; iat: number; mac: string }

export const SEAL_MAX_AGE_MS = 90 * 60 * 1000;   // 세션 최대 시간(제안 90분)
export const SEAL_MAX_PAYLOAD = 160 * 1024;     // 이력 크기 상한(글자). 넘으면 거절
const MIN_SECRET_CHARS = 32;                     // 무작위 32바이트(base64 약 43자)를 기대한다

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch { return null; }
}

async function importKey(secret: unknown): Promise<CryptoKey> {
  if (typeof secret !== 'string' || secret.trim().length < MIN_SECRET_CHARS) throw new AitError('unavailable');   // 서명 키가 없으면 챗봇 닫힘
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function signInput(feature: string, payload: string): Uint8Array<ArrayBuffer> {
  return enc.encode('ait1|' + feature + '|' + payload);
}

export function newNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return b64url(b);
}

export async function sealEnvelope(secret: string, env: ChatEnvelope, ctx: { nonce: string; seq: number; now: number; prev: string; feature?: string }): Promise<SealedBundle> {
  const key = await importKey(secret);
  const feature = ctx.feature ?? 'chat';
  const payload = JSON.stringify({ v: 1, feature, nonce: ctx.nonce, seq: ctx.seq, iat: ctx.now, prev: ctx.prev, env });
  if (payload.length > SEAL_MAX_PAYLOAD) throw new AitError('limit');
  const sig = await crypto.subtle.sign('HMAC', key, signInput(feature, payload));
  return { payload, mac: b64url(new Uint8Array(sig)) };
}

/** 새 세션의 첫 묶음 */
export async function startSealed(secret: string, now: number): Promise<{ bundle: SealedBundle; env: ChatEnvelope; nonce: string }> {
  const env = newSession();
  const nonce = newNonce();
  const bundle = await sealEnvelope(secret, env, { nonce, seq: 0, now, prev: '' });
  return { bundle, env, nonce };
}

/** 앱이 돌려보낸 묶음을 확인한다. 어긋나면 AitError('bad_request'), 키가 없으면 AitError('unavailable'), 만료는 AitError('limit') */
export async function openEnvelope(secret: string, bundle: unknown, now: number, opts: { feature?: string; maxAgeMs?: number } = {}): Promise<OpenedBundle> {
  const key = await importKey(secret);
  const feature = opts.feature ?? 'chat';
  if (typeof bundle !== 'object' || bundle === null) throw new AitError('bad_request');
  const b = bundle as Record<string, unknown>;
  if (typeof b.payload !== 'string' || typeof b.mac !== 'string' || b.payload.length > SEAL_MAX_PAYLOAD) throw new AitError('bad_request');
  const sig = fromB64url(b.mac);
  if (!sig) throw new AitError('bad_request');
  const ok = await crypto.subtle.verify('HMAC', key, sig, signInput(feature, b.payload));   // 상수 시간 비교
  if (!ok) throw new AitError('bad_request');
  let p: Record<string, unknown>;
  try { p = JSON.parse(b.payload) as Record<string, unknown>; } catch { throw new AitError('bad_request'); }
  if (p.v !== 1 || p.feature !== feature || typeof p.nonce !== 'string' || typeof p.seq !== 'number' || typeof p.iat !== 'number' || typeof p.env !== 'object' || p.env === null) throw new AitError('bad_request');
  const maxAge = opts.maxAgeMs ?? SEAL_MAX_AGE_MS;
  if (now - p.iat > maxAge || p.iat - now > 60_000) throw new AitError('limit');
  const env = p.env as ChatEnvelope;
  // 짜임 확인: 말 수와 이력 길이가 맞아야 한다(서명이 맞아도 서버가 만든 모양이어야 함)
  if (!env.state || !Array.isArray(env.userTexts) || !Array.isArray(env.messages)) throw new AitError('bad_request');
  const folded = typeof env.state.folded === 'number' && env.state.folded >= 0 ? env.state.folded : 0;
  if (typeof env.digest !== 'string' || folded > env.state.userTurns) throw new AitError('bad_request');
  if (env.userTexts.length !== env.state.userTurns || env.messages.length !== (env.state.userTurns - folded) * 2) throw new AitError('bad_request');
  return { env, nonce: p.nonce, seq: p.seq, iat: p.iat, mac: b.mac };
}

/** 열고 → (호출하는 쪽이 한 턴을 처리하고) → 새 묶음으로 다시 서명할 때 쓰는 다음 서명 값 */
export function nextSealCtx(opened: OpenedBundle, now: number): { nonce: string; seq: number; now: number; prev: string } {
  return { nonce: opened.nonce, seq: opened.seq + 1, now, prev: opened.mac };
}
