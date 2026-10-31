// 마일리지 화면이 쓰는 서버 연결(IF5-F2). 처음 쓸 때 만든다(시험이 서버 설정 없이 화면 파일을 읽을 수 있게 — sajuService 와 같은 방식).
//  마일리지 읽기 = lib/supabase 클라이언트의 rpc(데모 모드면 메모리 모의 서버 demo/mileageDemo) · 예치 → 확정 · 해제 = ledgerEdge(데모 전용 이름 — 스토어 결제 호출 0)
import { rpcOf } from '@/features/inflight/inflightApi';

import { createLedgerEdge, type LedgerEdge } from './ledgerEdge';
import { createMileageApi, type MileageApi } from './mileageApi';

export type MileageDeps = { api: MileageApi; edge: LedgerEdge; isOn: (key: string) => boolean };

let made: { api: MileageApi; edge: LedgerEdge } | null = null;
export function mileageServices(): { api: MileageApi; edge: LedgerEdge } {
  if (!made) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const call = rpcOf(supabase);
    made = { api: createMileageApi(call), edge: createLedgerEdge(call) };
  }
  return made;
}
