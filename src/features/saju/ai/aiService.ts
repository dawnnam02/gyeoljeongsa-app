// AI 맞춤이 화면에서 쓰는 연결 묶음(IF5-F2 ⑩). 처음 쓸 때 만든다(시험이 서버 설정 없이 화면 파일을 읽을 수 있게). 시험은 이 묶음을 통째로 넣는다.
//  · 마일리지 읽기 + 예치 · 확정 · 해제 = features/mileage · 동의 기록 = features/consent/if5Consent · 풀이 저장본 = ./aiResults · 접근 코드 = features/ait/aitStore(있어야 실제 AI)
import type { LedgerEdge } from '@/features/mileage/ledgerEdge';
import type { MileageApi } from '@/features/mileage/mileageApi';

import type { If5ConsentStore } from '@/features/consent/if5Consent';
import type { AiResults } from './aiResults';
import type { AitResult } from '@/features/ait/aitTypes';
import type { S5Kind } from './aiClient';

export type AiServices = {
  mileage: MileageApi;
  edge: LedgerEdge;
  consent: If5ConsentStore;
  results: AiResults;
  /** 접근 코드(없으면 데모 글). 값은 어디에도 내보내지 않는다 */
  code: () => Promise<string | null>;
  post?: (kind: S5Kind, body: Record<string, unknown>, code: string) => Promise<AitResult>;
  now?: () => number;
  newId?: () => string;
};

let made: AiServices | null = null;
export function aiServices(): AiServices {
  if (!made) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { mileageServices } = require('@/features/mileage/mileageService') as typeof import('@/features/mileage/mileageService');
    const { if5Consent } = require('@/features/consent/if5Consent') as typeof import('@/features/consent/if5Consent');
    const { aiResults } = require('./aiResults') as typeof import('./aiResults');
    const { aitStore } = require('@/features/ait/aitStore') as typeof import('@/features/ait/aitStore');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const m = mileageServices();
    made = {
      mileage: m.api,
      edge: m.edge,
      consent: if5Consent(),
      results: aiResults(),
      code: async () => {
        await aitStore.load();
        return aitStore.get().code;
      },
    };
  }
  return made;
}
export function setAiServicesForTest(s: AiServices | null): void {
  made = s;
}
