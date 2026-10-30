// 데모 모드의 내 여행 타입(IF2-F · F-19 · 3부-자) — 성향 확인(07 또는 대화형 '내 성향')을 마친 회원의 5축으로 계산명세 10-1 식(fun_calc.travel_type)과 같은 값을 낸다.
//  실서버에는 아직 타입 계산이 없다(백엔드 11-5) → 실서버 = 타입 없음(칸 0), 이 파일은 데모 모드에서만 불러온다. 짐 싸기 답은 이 계산에 들어가지 않는다(엽서 그림에만 · 기기에만).
//  대화 방식 4칸은 데모 성향 정리에 없어 갈등 대처 축으로 대화 결을 정한다(계산명세 10-1 '대화 방식이 없을 때')
import type { TypeSource } from '@/features/inflight/inflightService';

import { travelType } from './funCalc';

export const demoTypeSource: TypeSource = {
  mine: async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { aiApi } = require('@/lib/services') as typeof import('@/lib/services');
    const r = await aiApi.loadLatest().catch(() => null);
    const row = r && r.ok ? r.row : null;
    const view = row && row.status === 'ok' && row.confirmedAt ? (row.edited ?? row.original) : null; // 확정한 성향만(확정 전엔 타입 0)
    return view ? travelType(view.traits) : null;
  },
};
