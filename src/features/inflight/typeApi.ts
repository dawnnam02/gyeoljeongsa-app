// 내 여행 타입 서버 연결(3부-카 ② · 백엔드 0047 `get_my_travel_type()` · 정책 PF-31 ~ PF-33).
//  · 인자 0 · 본인만 · 응답 {ok:true, state:'ready', type:'tt-01'~'tt-12'} | {ok:true, state:'none'} | {ok:false, code:'not_ready'} · 오류 forbidden(42501) · feature_off(스위치 type_card 꺼짐)
//  · 실서버에서는 앱 안에서 타입을 계산하지 않는다(5축 숫자도 서버가 안 줌) — 받은 id 하나로 라이브러리 글을 찾을 뿐. 데모만 demo/typeDemo(funCalc)
//  · 저장 0 · 로그에는 이벤트 이름과 코드만
import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

import type { RpcCall } from './inflightApi';

export const TYPE_IDS = ['tt-01', 'tt-02', 'tt-03', 'tt-04', 'tt-05', 'tt-06', 'tt-07', 'tt-08', 'tt-09', 'tt-10', 'tt-11', 'tt-12'] as const;

// 화면이 가르는 다섯 상태. 네트워크 끊김 · 모르는 모양은 not_ready(불러오지 못함)로 묶는다
export type TypeState = { state: 'ready'; type: string } | { state: 'none' | 'not_ready' | 'feature_off' | 'forbidden' };
// mine = 홈 칸 · 입구가 쓰는 짧은 길(ready 일 때만 id, 나머지는 null) · state = 타입 화면이 상태 다섯으로 가르는 길(없으면 mine 으로 갈음)
export type TypeSource = { mine(): Promise<string | null>; state?(): Promise<TypeState> };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// 화면용 상태 하나: state() 가 없는 시험용 · 옛 TypeSource 도 같은 화면에서 그려진다
export async function typeStateOf(src: TypeSource): Promise<TypeState> {
  if (src.state) return src.state();
  const id = await src.mine();
  return id ? { state: 'ready', type: id } : { state: 'none' };
}

export function parseTypeState(data: unknown, error: { code?: string | null; message?: string | null } | null): TypeState {
  if (error) {
    const f = readDbFailure(error);
    const head = String(error.message ?? '').split(':')[0].trim();
    safeLog({ event: 'if2.type.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
    if (head === 'feature_off') return { state: 'feature_off' };
    if (f.code === '42501' || head === 'forbidden') return { state: 'forbidden' };
    return { state: 'not_ready' };
  }
  if (!isRecord(data)) return { state: 'not_ready' };
  if (data.ok === false) {
    const code = typeof data.code === 'string' ? data.code : '';
    return code === 'feature_off' ? { state: 'feature_off' } : code === 'forbidden' ? { state: 'forbidden' } : { state: 'not_ready' };
  }
  if (data.state === 'none') return { state: 'none' };
  if (data.state === 'ready' && typeof data.type === 'string' && (TYPE_IDS as readonly string[]).includes(data.type)) return { state: 'ready', type: data.type };
  return { state: 'not_ready' };
}

export function createTypeSource(call: RpcCall): TypeSource {
  const state = async (): Promise<TypeState> => {
    try {
      const { data, error } = await call('get_my_travel_type', {});
      return parseTypeState(data, error);
    } catch {
      return { state: 'not_ready' };
    }
  };
  return {
    state,
    mine: async () => {
      const s = await state();
      return s.state === 'ready' ? s.type : null;
    },
  };
}
