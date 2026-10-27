// 지인 차단의 기기 쪽(lib/contactSync 의 바깥 함수): 주소록 = expo-contacts(legacy 함수 — 권한 · 이메일 칸만) · 해시 = expo-crypto SHA-256 16진.
//  · 웹은 주소록이 없어(isAvailableAsync false) 'unavailable'. 데모 모드는 가짜 주소록(이메일 3개 — 데모 회원 키와 맞을 일 없음)
//  · 이름 · 번호 칸은 읽지 않는다(fields: Emails 만)
import * as Crypto from 'expo-crypto';
import * as Contacts from 'expo-contacts/legacy';

import type { ContactsPort, Sha256Hex } from './contactSync';

export const deviceContacts: ContactsPort = {
  available: () => Contacts.isAvailableAsync().catch(() => false),
  request: async () => {
    const r = await Contacts.requestPermissionsAsync();
    if (r.granted) return 'granted';
    return r.canAskAgain ? 'denied' : 'blocked'; // 자동 재요청 0(5-04)
  },
  emails: async () => {
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Emails] });
    return data.flatMap((c) => (c.emails ?? []).map((e) => e.email ?? '')).filter((e) => e !== '');
  },
};

export const deviceSha256: Sha256Hex = (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.HEX });

// 데모 모드 주소록(테스트 웹 · 시험): 늘 허용 · 이메일 3개(하나는 대문자 · 빈칸 섞임 — 정규화 확인용)
export const demoContacts: ContactsPort = {
  available: async () => true,
  request: async () => 'granted',
  emails: async () => ['friend.one@example.com', ' Friend.Two@Example.com ', 'friend.one@example.com'],
};
