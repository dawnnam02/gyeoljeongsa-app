// 유료 AI 기능의 예치 → 확정 · 해제(IF5-F2 ⑨ · ⑩ · 설계안 M-12: AI 부르기 전 예치 → 답이 나가면 확정 · 못 받으면 0 · 외상 0).
//  진짜 서버에서는 AI Edge 가 서비스 역할로 mileage_hold · settle · release 를 부르고 앱은 이 이름을 모른다(앱 권한 0 — IC5-01). P0 '기기 안 가상 잔액'에서는 데모 모의 서버가 같은 규칙으로
//  demo_mileage_hold · settle · release 를 흉내 낸다 — 이 파일은 그 데모 모의 서버 앞에서만 쓰인다(스토어 빌드에는 그 이름이 없어 '준비 중'으로 끝난다).
//  · 보내는 것: 기능 이름 · 입력 글자 수 · 요청 번호(+ 위기 표시)뿐 — 금액 · 잔액 인자 0. 같은 요청 번호는 같은 결과(연타 · 다시 보내기에서 이중 차감 0)
//  · 위기 턴(p_crisis)은 잔액이 0이어도 막지 않고 차감 0 · 아무것도 쓰지 않는다
//  · 결제 호출(consumeAsync · acknowledgePurchase …) 0 — 이 파일에는 스토어 결제 모듈이 없다
import type { RpcCall } from '@/features/inflight/inflightApi';
import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);

export type HoldResult =
  | { kind: 'held'; holdId: string; amount: number; replay: boolean }
  | { kind: 'free' } // 위기 턴: 예치 없음 · 차감 0
  | { kind: 'low'; need: number; have: number }
  | { kind: 'tooLarge' }
  | { kind: 'off' } // 스위치 꺼짐 · 이 판에는 장부가 없음
  | { kind: 'fail' };

export type LedgerEdge = {
  hold(a: { feature: string; chars: number; requestId: string; crisis?: boolean }): Promise<HoldResult>;
  settle(holdId: string): Promise<boolean>;
  release(holdId: string, reason: 'check_failed' | 'provider_error' | 'user_cancel' | 'timeout'): Promise<boolean>;
};

export function createLedgerEdge(call: RpcCall): LedgerEdge {
  async function rpc(fn: string, args: Rec, event: string): Promise<{ data: unknown } | { fail: 'off' | 'error' }> {
    let res: Awaited<ReturnType<RpcCall>>;
    try {
      res = await call(fn, args);
    } catch {
      return { fail: 'error' };
    }
    if (res.error) {
      const f = readDbFailure(res.error);
      safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
      const head = String(res.error.message ?? '').split(':')[0].trim();
      if (head === 'feature_off') return { fail: 'off' };
      return { fail: 'error' };
    }
    return { data: res.data };
  }
  return {
    async hold(a) {
      const r = await rpc('demo_mileage_hold', { p_feature: a.feature, p_chars: Math.max(0, Math.floor(a.chars)), p_request_id: a.requestId, p_crisis: a.crisis === true }, 'mileage.hold.fail');
      if ('fail' in r) return { kind: r.fail === 'off' ? 'off' : 'fail' };
      const d = r.data;
      if (!isRecord(d)) return { kind: 'fail' };
      if (d.ok === false) {
        if (d.code === 'insufficient') return { kind: 'low', need: int(d.need) ?? 0, have: int(d.have) ?? 0 };
        if (d.code === 'too_large') return { kind: 'tooLarge' };
        return { kind: 'fail' };
      }
      if (d.state === 'crisis_free') return { kind: 'free' };
      const amount = int(d.amount);
      return d.state === 'held' && typeof d.hold_id === 'string' && amount !== null ? { kind: 'held', holdId: d.hold_id, amount, replay: d.replay === true } : { kind: 'fail' };
    },
    async settle(holdId) {
      const r = await rpc('demo_mileage_settle', { p_hold: holdId }, 'mileage.settle.fail');
      return 'data' in r && isRecord(r.data) && r.data.ok === true;
    },
    async release(holdId, reason) {
      const r = await rpc('demo_mileage_release', { p_hold: holdId, p_reason: reason }, 'mileage.release.fail');
      return 'data' in r && isRecord(r.data) && r.data.ok === true;
    },
  };
}
