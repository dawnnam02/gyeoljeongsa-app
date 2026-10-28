// 12-5 지인 차단(D-200 ① · 0037 [7] F · K12 5-02 ~ 5-06): 주소록 권한 → 기기에서 이메일 해시 → sync_contact_hashes.
//  · 해시 꼴은 서버 정의 그대로(0037 [7] 머리 주석 · backend/R_변경기록 6-2): SHA-256("kjs1|" + 소문자 이메일) 16진 64자.
//    서버는 이 32바이트에 Vault contact_pepper 로 HMAC 을 씌워 회원 키 HMAC(pepper, SHA-256("kjs1|" + lower(btrim(가입 이메일))))와 맞춘다 — 앱은 pepper 를 모른다(원문 · 키 0)
//  · 전화번호는 보내지 않는다: 서버에 회원 전화 키가 없고(contact_keys kind 'phone' 비어 있음) 정규화 규칙이 미정('방식 미정', R 변경기록 6-2) — 맞춰 볼 값이 없다
//  · 이름 · 원문은 기기 밖으로 나가지 않는다. 로그는 이벤트 이름과 코드만(개수 · 해시 0)
//  · 한 번 비교 = 동기화 ID 하나 · 500개씩 · 'replace'(마지막 묶음에 final — 이번에 없는 옛 숨김은 서버가 지움, 5-11). 하루 3번은 서버가 센다(rate_limited)
//  · 주소록 · 해시 함수는 바깥에서 넣는다(앱 = expo-contacts · expo-crypto, 데모 · 시험 = 가짜) — lib/contactsDevice.ts
import { safeLog } from './log';
import type { ContactSyncFailure, Outcome, SettingsApi } from './settingsApi';

export type ContactPermission = 'granted' | 'denied' | 'blocked'; // blocked = 다시 물을 수 없음(설정에서만 허용)
export type ContactsPort = {
  available: () => Promise<boolean>;
  request: () => Promise<ContactPermission>;
  emails: () => Promise<string[]>; // 주소록의 이메일 칸만(이름 · 번호는 읽지 않는다)
};
export type Sha256Hex = (text: string) => Promise<string>;
export type ContactSyncDeps = {
  contacts: ContactsPort;
  sha256: Sha256Hex;
  newId: () => string;
  api: Pick<SettingsApi, 'syncContacts' | 'loadConsents' | 'setOptional' | 'markContactPrompted'>;
};
export type ContactSyncResult =
  | { ok: true; kind: 'done' | 'none' }
  | { ok: false; reason: 'unavailable' | 'denied' | 'blocked' | 'partial' | 'consent_save' | ContactSyncFailure };

export const CONTACT_KEY_PREFIX = 'kjs1|';
export const CONTACT_BATCH = 500;
const HEX64 = /^[0-9a-f]{64}$/;

// 서버 lower(btrim(email)) 와 같은 정규화: 앞뒤 빈칸만 떼고 소문자. 이메일 모양이 아니면 버린다
export const normalizeEmail = (raw: string): string | null => {
  const e = raw.replace(/^ +| +$/g, '').toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(e) ? e : null;
};

// 겹침 없이 해시. 해시 함수가 꼴(16진 64자)이 아닌 값을 주면 버린다
export async function contactHashes(emails: readonly string[], sha256: Sha256Hex): Promise<string[]> {
  const unique = [...new Set(emails.map(normalizeEmail).filter((e): e is string => e !== null))];
  const out: string[] = [];
  for (const e of unique) {
    const h = (await sha256(`${CONTACT_KEY_PREFIX}${e}`)).toLowerCase();
    if (HEX64.test(h)) out.push(h);
  }
  return [...new Set(out)];
}

// CK11(주소록 비교) 동의가 없으면 받는다 — 시트의 [주소록 허용하기]가 동의 행위(시트에 4-11 요약 · 체크 문구가 보인 뒤)
async function ensureConsent(api: ContactSyncDeps['api']): Promise<boolean> {
  const c = await api.loadConsents();
  if (c.ok && c.data.CK11) return true;
  const saved = await api.setOptional('CK11', true, 'feature_sheet'); // 0041 받은 곳: 지인 차단 시트
  return saved.ok;
}

export async function runContactSync(deps: ContactSyncDeps): Promise<ContactSyncResult> {
  if (!(await deps.contacts.available())) return { ok: false, reason: 'unavailable' };
  if (!(await ensureConsent(deps.api))) return { ok: false, reason: 'consent_save' };
  const perm = await deps.contacts.request();
  if (perm !== 'granted') return { ok: false, reason: perm };
  let emails: string[];
  try {
    emails = await deps.contacts.emails();
  } catch {
    safeLog({ event: 'contact.read.fail' });
    return { ok: false, reason: 'unavailable' };
  }
  const hashes = await contactHashes(emails, deps.sha256);
  if (hashes.length === 0) return { ok: true, kind: 'none' };
  const syncId = deps.newId();
  const batches: string[][] = [];
  for (let i = 0; i < hashes.length; i += CONTACT_BATCH) batches.push(hashes.slice(i, i + CONTACT_BATCH));
  for (let i = 0; i < batches.length; i += 1) {
    const r: Outcome<ContactSyncFailure> = await deps.api.syncContacts(syncId, batches[i], 'replace', i === batches.length - 1);
    if (!r.ok) return { ok: false, reason: i === 0 ? r.reason : 'partial' };
  }
  return { ok: true, kind: 'done' };
}
