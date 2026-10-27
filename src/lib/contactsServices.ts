// 지인 차단 기기 연결(12-5). 처음 쓸 때 만든다 — 시험이 기기 모듈(expo-contacts · expo-crypto) 없이 설정 화면을 읽을 수 있게(boardingServices 와 같은 방식).
//  데모 모드 = 가짜 주소록(lib/contactsDevice demoContacts) · 해시는 같은 expo-crypto
import type { ContactSyncDeps } from './contactSync';

export type ContactPorts = Omit<ContactSyncDeps, 'api'>;

let made: ContactPorts | null = null;

export function contactPorts(): ContactPorts {
  if (!made) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { env } = require('@/config/env') as typeof import('@/config/env');
    const { newRequestId } = require('./requestId') as typeof import('./requestId');
    const device = require('./contactsDevice') as typeof import('./contactsDevice');
    /* eslint-enable @typescript-eslint/no-require-imports */
    made = { contacts: env.demoMode ? device.demoContacts : device.deviceContacts, sha256: device.deviceSha256, newId: () => newRequestId() };
  }
  return made;
}
