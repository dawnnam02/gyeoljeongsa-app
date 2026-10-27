// 12-5 피할 회사 · 학교 이름을 이 기기에 두는 곳(0037 [7] F: 서버는 이름을 해시로만 저장하고 개수만 돌려준다 — 처리방침 R43).
//  · 회원마다 따로 둔다(같은 기기의 다른 계정과 섞이지 않게). 웹 · 시험은 메모리(앱을 다시 열면 비어 있음)
//  · 앱은 SecureStore(lib/secureStorage avoidStorage — 조각 저장, 이 기기 전용 · 암호화)에 둔다. AsyncStorage(암호화 없음)에는 두지 않는다(보안 T126 · P7-f, 3부-바)
//  · 탈퇴 확정 · [모두 지우기] 때 그 회원의 목록을 통째로 지운다(remove)
//  · 읽은 값은 모양을 다시 거른다(빈 이름 · 겹침 · 5곳 넘음은 버림)
export type AvoidSchool = { key: string; name: string };
export type AvoidLocal = { companies: string[]; schools: AvoidSchool[] };
export type AvoidStore = {
  read: (userId: string) => Promise<AvoidLocal>;
  write: (userId: string, value: AvoidLocal) => Promise<void>;
  remove: (userId: string) => Promise<void>;
};
export type KeyValue = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem?: (key: string) => Promise<void> };

export const AVOID_LOCAL_MAX = 5; // 회사 · 학교 각각(서버 too_many 와 같은 값)
// SecureStore 열쇠는 영문 · 숫자 · '.' · '-' · '_' 만 받는다 — 회원 id(uuid) 앞을 '_' 로 잇는다
const KEY = 'settings.avoidOrgs.v1';
export const avoidKeyOf = (userId: string) => `${KEY}_${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// 서버 private.org_hash 와 같은 정규화(0037): 소문자 · 주식회사 · (주) · ㈜ · 공백 · 기호를 뺀 글. 같은 값이면 서버에서도 한 곳이다. 빈 글이면 서버가 invalid_value
export const orgKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/주식회사|\(주\)|㈜/g, '')
    .replace(/[\s!-/:-@[-`{-~]/g, '');

export function readAvoidLocal(raw: unknown): AvoidLocal {
  if (!isRecord(raw)) return { companies: [], schools: [] };
  const companies: string[] = [];
  for (const c of Array.isArray(raw.companies) ? raw.companies : []) {
    if (typeof c !== 'string' || !orgKey(c) || companies.some((x) => orgKey(x) === orgKey(c))) continue;
    companies.push(c.trim());
  }
  const schools: AvoidSchool[] = [];
  for (const x of Array.isArray(raw.schools) ? raw.schools : []) {
    if (!isRecord(x) || typeof x.key !== 'string' || typeof x.name !== 'string' || x.key === '' || schools.some((s) => s.key === x.key)) continue;
    schools.push({ key: x.key, name: x.name });
  }
  return { companies: companies.slice(0, AVOID_LOCAL_MAX), schools: schools.slice(0, AVOID_LOCAL_MAX) };
}

export function memoryAvoidStore(): AvoidStore {
  const m = new Map<string, AvoidLocal>();
  return {
    read: async (userId) => readAvoidLocal(m.get(userId)),
    write: async (userId, value) => void m.set(userId, readAvoidLocal(value)),
    remove: async (userId) => void m.delete(userId),
  };
}

// 기기 저장소(키 · 값 — 앱은 SecureStore 조각 저장소). 읽지 못하면 빈 목록 · 지우기를 못 하는 저장소면 빈 목록을 쓴다
export function keyValueAvoidStore(kv: KeyValue): AvoidStore {
  return {
    read: async (userId) => {
      try {
        const raw = await kv.getItem(avoidKeyOf(userId));
        return readAvoidLocal(raw ? JSON.parse(raw) : null);
      } catch {
        return { companies: [], schools: [] };
      }
    },
    write: async (userId, value) => kv.setItem(avoidKeyOf(userId), JSON.stringify(readAvoidLocal(value))),
    remove: async (userId) => {
      try {
        if (kv.removeItem) await kv.removeItem(avoidKeyOf(userId));
        else await kv.setItem(avoidKeyOf(userId), JSON.stringify({ companies: [], schools: [] }));
      } catch {
        // 지우지 못해도 화면 흐름(탈퇴 · 모두 지우기)은 막지 않는다 — 다음 읽기에서 서버 개수와 비교해 보인다
      }
    },
  };
}
