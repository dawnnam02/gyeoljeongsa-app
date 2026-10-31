// F0 통과 조건 4 중 서버에 닿지 않는 부분: 클라이언트가 환경 변수 값을 읽고,
// 세션을 SecureStore 조각 저장소에만 둔다(보안 점검표 A-11), 재설치 때 옛 세션을 지운다(A-12).
// 가짜 주소 · 가짜 키 · 가짜 저장소만 쓴다. 실제 Supabase 연결은 scripts/check-supabase.mjs 가 본다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// SecureStore 를 흉내 낸다: 값 하나가 2048바이트(UTF-8)를 넘으면 거부한다. jest.mock 안에서 쓰는 변수는 mock 으로 시작해야 한다.
const mockSecureData = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: async (key: string) => mockSecureData.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (Buffer.byteLength(value, 'utf8') > 2048) throw new Error('SecureStore 한도(2048바이트)를 넘음');
    mockSecureData.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockSecureData.delete(key);
  },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const FAKE_URL = 'https://abcdefghijkl.supabase.co';
const FAKE_KEY = 'sb_publishable_not_a_real_key';
const STORAGE_KEY = 'sb-abcdefghijkl-auth-token'; // supabase-js 기본 이름: sb-<프로젝트>-auth-token

// 서버로 나가는 요청은 모두 이 가짜가 받는다(로그아웃 요청 한 번만 쓰인다).
const requests: string[] = [];
const fakeFetch = async (input: unknown) => {
  requests.push(String(input));
  return { ok: true, status: 204, headers: new Map(), json: async () => ({}), text: async () => '' };
};

// 만료 전 세션. 한글이 든 긴 사용자 정보로 값이 조각 여러 개가 되게 한다.
function fakeSession() {
  return {
    access_token: 'header.payload.signature',
    refresh_token: 'refresh-token-value',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-4000-8000-000000000000',
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: { memo: '가나다라마바사아자차카타파하'.repeat(150) },
      created_at: '2026-10-14T00:00:00Z',
    },
  };
}

type ClientModule = typeof import('@/lib/supabase');
type StorageModule = typeof import('@/lib/secureStorage');
let client: ClientModule;
let storage: StorageModule;

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = FAKE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = FAKE_KEY;
  globalThis.fetch = fakeFetch as unknown as typeof fetch;
  client = jest.requireActual<ClientModule>('@/lib/supabase'); // 환경 변수를 정한 뒤에 불러온다
  storage = jest.requireActual<StorageModule>('@/lib/secureStorage');
});

afterAll(async () => {
  await client.supabase.auth.stopAutoRefresh();
});

beforeEach(async () => {
  mockSecureData.clear();
  await AsyncStorage.clear();
  requests.length = 0;
});

describe('환경 변수 읽기 (config/env.ts)', () => {
  const load = () => {
    let env: typeof import('@/config/env')['env'] | undefined;
    jest.isolateModules(() => {
      env = jest.requireActual<typeof import('@/config/env')>('@/config/env').env;
    });
    return env;
  };

  test('주소와 publishable 키를 읽는다', () => {
    expect(load()).toEqual({ demoMode: false, supabaseUrl: FAKE_URL, supabasePublishableKey: FAKE_KEY });
  });

  test('값이 비어 있으면 시작하지 못하고, 오류 문구에 값이 들어 있지 않다', () => {
    const before = { ...process.env };
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    try {
      expect(load).toThrow(/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
      expect(load).not.toThrow(new RegExp(FAKE_URL));
    } finally {
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = before.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    }
  });

  test('https 가 아닌 주소는 거부한다 (보안/구성.md F-01)', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://abcdefghijkl.supabase.co';
    try {
      expect(load).toThrow(/https/);
    } finally {
      process.env.EXPO_PUBLIC_SUPABASE_URL = FAKE_URL;
    }
  });
});

describe('세션 보관 (A-11)', () => {
  test('저장된 세션을 클라이언트가 SecureStore 조각 저장소에서 읽는다', async () => {
    await AsyncStorage.setItem('app.installed', '1'); // 첫 실행이 아니다
    await storage.authStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession()));
    const { data, error } = await client.supabase.auth.getSession();
    expect(error).toBeNull();
    expect(data.session?.refresh_token).toBe('refresh-token-value');
    expect(await client.hasStoredLogin()).toBe(true); // K2 2-1: 저장된 로그인이 있으면 진행 단계대로
  });

  test('세션 값은 조각 키로만 SecureStore 에 있고 AsyncStorage 에는 토큰이 없다', async () => {
    await storage.authStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession()));
    const keys = [...mockSecureData.keys()];
    expect(keys).toContain(`${STORAGE_KEY}.n`);
    expect(keys.filter((k) => k.endsWith('.0') || k.endsWith('.1')).length).toBeGreaterThanOrEqual(2); // 긴 값은 조각이 여러 개
    expect(keys.every((k) => k.startsWith(STORAGE_KEY))).toBe(true);

    const asyncKeys = await AsyncStorage.getAllKeys();
    expect(asyncKeys.filter((k) => k.startsWith('sb-'))).toEqual([]);
    for (const key of asyncKeys) expect(await AsyncStorage.getItem(key)).not.toMatch(/refresh-token-value|header\.payload/);
  });

  test('저장된 로그인이 없으면 false 이다', async () => {
    await AsyncStorage.setItem('app.installed', '1');
    expect(await client.hasStoredLogin()).toBe(false); // K2 2-1: 로그인이 없으면 01 온보딩
  });

  test('첫 실행이면 키체인에 세션이 남아 있어도 저장된 로그인이 없다고 본다 (A-12)', async () => {
    await storage.authStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession())); // 설치 표식 없음
    expect(await client.hasStoredLogin()).toBe(false);
  });
});

describe('재설치 (A-12)', () => {
  test('설치 표식이 없으면(첫 실행 · 재설치) 키체인에 남은 옛 세션을 지우고 표식을 남긴다', async () => {
    await storage.authStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession())); // 앱을 지워도 iOS 키체인에는 남아 있던 값
    expect(await AsyncStorage.getItem('app.installed')).toBeNull(); // 앱을 지우면 AsyncStorage 표식은 같이 지워진다

    await client.purgeStaleSessionOnFreshInstall();

    expect((await client.supabase.auth.getSession()).data.session).toBeNull();
    expect([...mockSecureData.keys()]).toEqual([]);
    expect(await AsyncStorage.getItem('app.installed')).toBe('1');
    expect(requests.length).toBeGreaterThan(0); // 서버 로그아웃 요청은 갔고
    expect(requests.every((url) => url.startsWith(FAKE_URL))).toBe(true); // 가짜 주소로만 갔다(진짜 서버에 닿지 않는다)
  });

  // 3부-차(보안 IF3 IC3-20 · IFF3-16): iOS 키체인에는 기기 글 9종(IF2 나만 쓰는 글)도 같이 남을 수 있다
  test('설치 표식이 없으면 키체인에 남은 기기 글 9종도 같이 지운다 (IC3-20)', async () => {
    const { NOTE_KEYS } = jest.requireActual<typeof import('@/features/inflight/deviceNotes')>('@/features/inflight/deviceNotes');
    const kinds = Object.keys(NOTE_KEYS) as (keyof typeof NOTE_KEYS)[];
    expect(kinds).toHaveLength(9);
    for (const kind of kinds) await storage.if2Storage.setItem(NOTE_KEYS[kind], JSON.stringify(kind === 'wordSafety' ? ['room-1'] : { kept: kind }));
    expect([...mockSecureData.keys()].length).toBeGreaterThanOrEqual(9);

    await client.purgeStaleSessionOnFreshInstall();

    for (const kind of kinds) expect(await storage.if2Storage.getItem(NOTE_KEYS[kind])).toBeNull();
    expect([...mockSecureData.keys()]).toEqual([]);
    expect(await AsyncStorage.getItem('app.installed')).toBe('1');
  });

  test('표식이 있으면(두 번째 실행부터) 기기 글 9종을 지우지 않는다', async () => {
    const { NOTE_KEYS } = jest.requireActual<typeof import('@/features/inflight/deviceNotes')>('@/features/inflight/deviceNotes');
    await AsyncStorage.setItem('app.installed', '1');
    for (const key of Object.values(NOTE_KEYS)) await storage.if2Storage.setItem(key, JSON.stringify({ kept: key }));

    await client.purgeStaleSessionOnFreshInstall();

    for (const key of Object.values(NOTE_KEYS)) expect(await storage.if2Storage.getItem(key)).toBe(JSON.stringify({ kept: key }));
  });

  // 3부-카 ⑤(보안 IC3-20): 설문 임시 저장(appStateStorage) · 피할 회사 · 학교 원문(avoidStorage)도 같은 키체인 — 회원 id 가 열쇠에 붙어 있어 열쇠 목록대로 지운다
  const USER_A = '00000000-0000-4000-8000-0000000000aa';
  const USER_B = '00000000-0000-4000-8000-0000000000bb';
  test('설치 표식이 없으면 설문 임시 저장(회원마다 열쇠 · 가입 진행 · 만남 장면)과 피할 회사 · 학교 원문도 지운다 (3부-카 ⑤)', async () => {
    const { avoidKeyOf } = jest.requireActual<typeof import('@/lib/avoidLocal')>('@/lib/avoidLocal');
    await storage.appStateStorage.setItem(`survey.v2.draft_${USER_A}`, JSON.stringify({ A01: '가나다'.repeat(300) })); // 조각 여러 개
    await storage.appStateStorage.setItem(`survey.chat.local_${USER_B}`, JSON.stringify({ turn: 3 }));
    await storage.appStateStorage.setItem('gyeoljeongsa.signup', JSON.stringify({ email: 'x' }));
    await storage.avoidStorage.setItem(avoidKeyOf(USER_A), JSON.stringify({ companies: ['예시회사'], schools: [] }));
    await storage.avoidStorage.setItem(avoidKeyOf(USER_B), JSON.stringify({ companies: [], schools: [{ key: 'k', name: '예시학교' }] }));
    // 목록이 생기기 전에 쓴 고정 열쇠(목록에 없음)도 지운다
    mockSecureData.set('chat.meetScene.v1.n', '1');
    mockSecureData.set('chat.meetScene.v1.0', '{}');
    expect(mockSecureData.size).toBeGreaterThan(8);

    await client.purgeStaleSessionOnFreshInstall();

    expect(await storage.appStateStorage.getItem(`survey.v2.draft_${USER_A}`)).toBeNull();
    expect(await storage.appStateStorage.getItem(`survey.chat.local_${USER_B}`)).toBeNull();
    expect(await storage.appStateStorage.getItem('gyeoljeongsa.signup')).toBeNull();
    expect(await storage.avoidStorage.getItem(avoidKeyOf(USER_A))).toBeNull();
    expect(await storage.avoidStorage.getItem(avoidKeyOf(USER_B))).toBeNull();
    expect([...mockSecureData.keys()]).toEqual([]); // 열쇠 목록까지 남기지 않는다
    expect(await AsyncStorage.getItem('app.installed')).toBe('1');
  });

  test('표식이 있으면(두 번째 실행부터) 설문 임시 저장 · 피할 회사 · 학교 원문을 지우지 않는다 (3부-카 ⑤)', async () => {
    const { avoidKeyOf } = jest.requireActual<typeof import('@/lib/avoidLocal')>('@/lib/avoidLocal');
    await AsyncStorage.setItem('app.installed', '1');
    await storage.appStateStorage.setItem(`survey.v2.draft_${USER_A}`, JSON.stringify({ A01: 'a' }));
    await storage.avoidStorage.setItem(avoidKeyOf(USER_A), JSON.stringify({ companies: ['예시회사'], schools: [] }));

    await client.purgeStaleSessionOnFreshInstall();

    expect(await storage.appStateStorage.getItem(`survey.v2.draft_${USER_A}`)).toBe(JSON.stringify({ A01: 'a' }));
    expect(await storage.avoidStorage.getItem(avoidKeyOf(USER_A))).toBe(JSON.stringify({ companies: ['예시회사'], schools: [] }));
  });

  test('열쇠 목록 저장소: 지운 열쇠는 목록에서도 빠지고 · 같은 열쇠를 다시 써도 목록에 하나 · 고정 열쇠 둘 이름이 앱 상수와 같다', async () => {
    const { SIGNUP_STORE_KEY } = jest.requireActual<typeof import('@/store/signupStore')>('@/store/signupStore');
    const { MEET_SEEN_KEY } = jest.requireActual<typeof import('@/features/chat/meetSeen')>('@/features/chat/meetSeen');
    expect([...storage.APP_STATE_FIXED_KEYS]).toEqual([SIGNUP_STORE_KEY, MEET_SEEN_KEY]);
    await storage.avoidStorage.setItem('k1', 'v1');
    await storage.avoidStorage.setItem('k1', 'v1b');
    await storage.avoidStorage.setItem('k2', 'v2');
    expect(JSON.parse((await jest.requireActual<typeof import('@/lib/secureStorage')>('@/lib/secureStorage').secureStore.get('device.keys.avoid.0')) ?? '[]')).toEqual(['k1', 'k2']);
    await storage.avoidStorage.removeItem('k1');
    expect(await storage.avoidStorage.getItem('k1')).toBeNull();
    expect(await storage.avoidStorage.getItem('k2')).toBe('v2');
    expect(JSON.parse((await storage.secureStore.get('device.keys.avoid.0')) ?? '[]')).toEqual(['k2']);
    await storage.avoidStorage.removeItem('k2');
    expect([...mockSecureData.keys()]).toEqual([]);
  });

  test('표식이 있으면(두 번째 실행부터) 세션을 지우지 않는다', async () => {
    await AsyncStorage.setItem('app.installed', '1');
    await storage.authStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession()));

    await client.purgeStaleSessionOnFreshInstall();

    expect((await client.supabase.auth.getSession()).data.session).not.toBeNull();
  });
});

// 팀장 결정(2026-10-14, 테스트웹 TW1): EXPO_PUBLIC_DEMO_MODE 자리와 분기 지점만. 모의 구현 본문은 F8.
describe('데모 모드 분기 (EXPO_PUBLIC_DEMO_MODE)', () => {
  const NAMES = ['EXPO_PUBLIC_DEMO_MODE', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] as const;
  let saved: Partial<Record<(typeof NAMES)[number], string | undefined>>;

  beforeEach(() => {
    saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
  });
  afterEach(() => {
    for (const name of NAMES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  // 환경 변수를 정한 뒤 새로 불러온다(모듈은 불러올 때 한 번 정해진다)
  const load = (demo: string | undefined, serverValues = true) => {
    if (demo === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE;
    else process.env.EXPO_PUBLIC_DEMO_MODE = demo;
    if (!serverValues) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    }
    let mod!: ClientModule;
    let demoMode!: boolean;
    jest.isolateModules(() => {
      demoMode = jest.requireActual<typeof import('@/config/env')>('@/config/env').env.demoMode;
      mod = jest.requireActual<ClientModule>('@/lib/supabase');
    });
    return { mod, demoMode };
  };

  test('기본은 꺼짐: 값이 없으면 진짜 클라이언트(OTP 로그인 메서드가 있다)다', () => {
    const { mod, demoMode } = load(undefined);
    expect(demoMode).toBe(false);
    expect(typeof mod.supabase.auth.signInWithOtp).toBe('function');
  });

  test.each(['', '0', 'true', 'yes', ' 1', '01'])('1 이 아닌 값(%j)도 꺼짐이다', (value) => {
    const { mod, demoMode } = load(value);
    expect(demoMode).toBe(false);
    expect(typeof mod.supabase.auth.signInWithOtp).toBe('function');
  });

  test('꺼진 상태에서 주소 · 키가 없으면 시작하지 못한다(데모 모드가 우회가 되지 않는다)', () => {
    expect(() => load(undefined, false)).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(() => load('0', false)).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  test('1 이면 켜짐: 주소 · 키 없이 시작하고, 서버에 요청하지 않고, 로그인 없는 상태다', async () => {
    const { mod, demoMode } = load('1', false);
    expect(demoMode).toBe(true);
    expect(mod.supabase.auth.signInWithOtp).toBeUndefined(); // 진짜 클라이언트가 아니다
    expect(await mod.hasStoredLogin()).toBe(false); // K2 2-1: 로그인이 없으면 01 온보딩
    expect(requests).toEqual([]); // 서버에 닿지 않는다
    expect(mockSecureData.size).toBe(0); // 기기에 아무것도 저장하지 않는다
    expect(await AsyncStorage.getAllKeys()).toEqual(['app.installed']); // 설치 표식뿐(네이티브). 세션 · 토큰 없음
  });

  // F1 이 02 가입 · 03 동의에 필요한 만큼(otp-gate · underage-reject · save_answers · account_status · profiles · consents)을 채웠다.
  // 그 밖의 표 · RPC · 함수(설문 · 사진 · 추천 · 호감 …)는 F8 에서 채우고, 아직 없는 것을 부르면 무엇이 빠졌는지 알려 주며 멈춘다.
  test('데모 클라이언트: F1 이 쓰는 것 말고 아직 없는 데이터 호출은 F8 에서 구현한다고 알려 주며 멈춘다', () => {
    const { mod } = load('1', false);
    expect(() => mod.supabase.from('x')).toThrow(/F8/);
    expect(() => mod.supabase.from('recommendations')).toThrow(/F8/);
    expect(() => mod.supabase.rpc('x')).toThrow(/F8/);
    expect(() => mod.supabase.rpc('accept_like', { p_like_id: 'x' })).not.toThrow(); // F6 이 11 호감 모의(likesDemo)를 더했다
    expect(() => mod.supabase.functions.invoke('x')).toThrow(/F8/);
    expect(() => mod.supabase.functions.invoke('delete-account', { body: {} })).not.toThrow(); // F7 이 12 탈퇴 모의(settingsDemo)를 더했다
  });

  test('데모 클라이언트: F1 이 쓰는 것(가입 · 동의)은 서버 없이 돌아간다 — 서버에 요청하지 않고 기기에 저장하지 않는다', async () => {
    const { mod } = load('1', false);
    expect(() => mod.supabase.from('consents')).not.toThrow();
    expect(() => mod.supabase.from('profiles')).not.toThrow();
    expect(() => mod.supabase.rpc('save_answers', { p_answers: {} })).not.toThrow();
    const sent = await mod.supabase.functions.invoke('otp-gate', { body: { action: 'send', email: 'a@b.co' } });
    expect(sent.error).toBeNull();
    expect(requests).toEqual([]); // 서버에 닿지 않는다
    expect(mockSecureData.size).toBe(0); // 기기에 저장하지 않는다
  });
});

// 팀장 결정(2026-10-14): 세션 저장은 웹에서 메모리만. 보안 결정 전 localStorage · sessionStorage 에 토큰을 두지 않는다.
describe('웹: 세션은 메모리에만 둔다', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  });

  test('토큰 저장 · 읽기 · 첫 실행 정리가 브라우저 저장소 · SecureStore · AsyncStorage 를 쓰지 않는다', async () => {
    const touched: string[] = [];
    const watched = {
      length: 0,
      key: () => null,
      getItem: (key: string) => void touched.push(`get ${key}`),
      setItem: (key: string) => void touched.push(`set ${key}`),
      removeItem: (key: string) => void touched.push(`remove ${key}`),
      clear: () => void touched.push('clear'),
    };
    Object.defineProperty(globalThis, 'localStorage', { value: watched, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: watched, configurable: true });

    let web!: ClientModule;
    let webStorage!: StorageModule;
    // 플랫폼은 두 곳에서 웹으로 바꾼다: 새로 불러오는 모듈이 쓰는 react-native(불러올 때 저장소를 고른다)와,
    // 나중에 함수가 불릴 때 다시 읽는 react-native(Platform 은 불리는 순간 처음 꺼내 온다)
    jest.replaceProperty(Platform, 'OS', 'web');
    jest.isolateModules(() => {
      jest.replaceProperty(jest.requireActual<typeof import('react-native')>('react-native').Platform, 'OS', 'web');
      web = jest.requireActual<ClientModule>('@/lib/supabase');
      webStorage = jest.requireActual<StorageModule>('@/lib/secureStorage');
    });

    await webStorage.authStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession()));
    expect((await web.supabase.auth.getSession()).data.session?.refresh_token).toBe('refresh-token-value'); // 메모리에서 읽힌다
    await web.purgeStaleSessionOnFreshInstall(); // 웹에서는 건너뛴다(메모리에 옛 세션이 남을 수 없다)
    expect((await web.supabase.auth.getSession()).data.session).not.toBeNull();
    expect(await web.hasStoredLogin()).toBe(true);

    expect(touched).toEqual([]); // 브라우저 저장소 호출 0
    expect(mockSecureData.size).toBe(0); // 기기 보안 저장소도 쓰지 않는다
    expect(await AsyncStorage.getAllKeys()).toEqual([]); // 웹에서 AsyncStorage 는 localStorage 이므로 설치 표식도 쓰지 않는다
    await web.supabase.auth.stopAutoRefresh();
  });
});
