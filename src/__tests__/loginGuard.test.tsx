// QF2-B7 FB-022: 로그인이 필요한 화면 공통 가드 — 진짜 expo-router(뿌리 Stack + screenLayout)로 돈다.
//  웹에서 로그아웃 · 탈퇴 뒤 브라우저 뒤로 가기를 누르면 로그인이 필요한 주소가 그대로 열려 앞 사람 화면(채팅 목록 · 대화방)이 다시 보였다(테스트웹 TW19).
//  지키는 것: ① 로그인이 없으면 가드 안 화면의 내용은 한 번도 그려지지 않는다(그림 횟수 0) ② 처음 열리는 주소는 확인이 끝날 때까지 그리지 않는다
//  ③ 로그아웃 순간 쌓여 있던 화면이 내용을 내려놓고 처음 화면으로 간다(뒤로 가기를 끝까지 눌러도 내용 0) ④ 가입 전 화면은 가드 밖 ⑤ 새 화면은 따로 적지 않아도 가드 안
import fs from 'node:fs';
import path from 'node:path';

import type { Session } from '@supabase/supabase-js';
import { Slot, Stack, router } from 'expo-router';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { store } from 'expo-router/build/global-state/router-store';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { bindSessionGate, resetSessionGateForTest, sessionKnown, setSessionKnown, type SessionAuth } from '@/lib/sessionGate';
import { isGuardedRoute, loginScreenLayout, PUBLIC_ROUTES } from '@/navigation/loginGuard';

jest.setTimeout(300_000); // 진짜 router 를 그린다 — 기계가 바쁠 때 오래 걸릴 수 있다

jest.mock('expo-linking', () => ({
  ...jest.requireActual<object>('expo-linking'),
  createURL: (p: string) => `gjs://${p}`,
  resolveScheme: () => 'gjs',
  addEventListener: () => ({ remove() {} }),
}));

const SESSION = { user: { id: 'u1', email: 'a@email.com' } } as unknown as Session;

// 진짜 supabase.auth 와 같은 이름 둘만 가진 가짜 클라이언트
function fakeClient(initial: Session | null, hold?: Promise<void>) {
  let session = initial;
  const listeners = new Set<(event: never, s: Session | null) => void>();
  const auth: SessionAuth = {
    getSession: jest.fn(async () => {
      if (hold) await hold;
      return { data: { session } };
    }),
    onAuthStateChange: (callback) => {
      listeners.add(callback as never);
      return { data: { subscription: { unsubscribe: () => void listeners.delete(callback as never) } } };
    },
  };
  const emit = (event: string, s: Session | null) => listeners.forEach((fn) => fn(event as never, s));
  return {
    auth,
    signIn: () => {
      session = SESSION;
      emit('SIGNED_IN', session);
    },
    signOut: () => {
      session = null;
      emit('SIGNED_OUT', null);
    },
  };
}

// 화면이 그려진 횟수(함수 본문이 불린 횟수) — 0 이면 내용이 한 프레임도 그려지지 않은 것
const drawn: Record<string, number> = {};
function noteDrawn(name: string) {
  drawn[name] = (drawn[name] ?? 0) + 1;
}
const Spy = ({ name, children }: { name: string; children?: React.ReactNode }) => {
  noteDrawn(name);
  return <Text testID={`screen-${name}`}>{children ?? name}</Text>;
};

const trees: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => trees.splice(0).forEach((t) => t.unmount()));
  resetSessionGateForTest();
  for (const k of Object.keys(drawn)) delete drawn[k];
});

const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await flush();
};
const pathname = () => store.getRouteInfo().pathname;
const has = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props.testID === id).length > 0;

async function renderApp(initial: string) {
  const context = inMemoryContext({
    _layout: () => <Stack screenLayout={loginScreenLayout} screenOptions={{ headerShown: false }} />,
    index: () => <Spy name="index" />,
    onboarding: () => <Spy name="onboarding" />,
    'sign-in': () => <Spy name="sign-in" />,
    consent: () => <Spy name="consent" />,
    profile: () => <Spy name="profile">내 프로필 · 김OO</Spy>,
    boarding: () => <Spy name="boarding" />,
    'chat/[id]': () => <Spy name="room">대화방 · 문OO</Spy>,
    '(tabs)/_layout': () => <Slot />,
    '(tabs)/chat': () => <Spy name="chat">채팅 목록 · 문OO · 32 · 서울 마포구</Spy>,
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ExpoRoot context={context as never} location={initial} />);
  });
  trees.push(tree);
  await settle();
  return tree;
}

describe('FB-022 로그인 가드: 처음 열리는 주소', () => {
  test('로그인이 있으면 가드 안 화면이 그려진다', async () => {
    const client = fakeClient(SESSION);
    bindSessionGate(client);
    setSessionKnown('in');
    const tree = await renderApp('/profile');
    expect(pathname()).toBe('/profile');
    expect(has(tree, 'screen-profile')).toBe(true);
    expect(drawn.profile).toBeGreaterThan(0);
    expect(client.auth.getSession).not.toHaveBeenCalled(); // 이미 'in' 으로 알면 다시 묻지 않는다
  });

  test('로그인이 없으면(out) 내용을 한 번도 그리지 않고 처음 화면으로 간다 — 새로 고침 · 직접 연 주소', async () => {
    bindSessionGate(fakeClient(null));
    setSessionKnown('out');
    const tree = await renderApp('/profile');
    expect(drawn.profile ?? 0).toBe(0);
    expect(has(tree, 'screen-profile')).toBe(false);
    expect(pathname()).toBe('/onboarding');
    expect(has(tree, 'screen-onboarding')).toBe(true);
  });

  test('아직 모르는 상태(unknown): 확인이 끝나기 전에는 그리지 않고, 세션이 없다고 나오면 처음 화면으로', async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((r) => (release = r));
    bindSessionGate(fakeClient(null, hold));
    const tree = await renderApp('/chat/room-1');
    expect(drawn.room ?? 0).toBe(0); // 확인 중 — 빈 바탕
    expect(has(tree, 'login-guard-wait')).toBe(true);
    expect(has(tree, 'screen-room')).toBe(false);
    await act(async () => release());
    await settle();
    expect(drawn.room ?? 0).toBe(0);
    expect(pathname()).toBe('/onboarding');
  });

  test('아직 모르는 상태(unknown): 확인했더니 세션이 있으면 그때부터 그린다', async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((r) => (release = r));
    bindSessionGate(fakeClient(SESSION, hold));
    const tree = await renderApp('/profile');
    expect(drawn.profile ?? 0).toBe(0);
    expect(has(tree, 'login-guard-wait')).toBe(true);
    await act(async () => release());
    await settle();
    expect(sessionKnown()).toBe('in');
    expect(pathname()).toBe('/profile');
    expect(has(tree, 'screen-profile')).toBe(true);
  });

  test('탭 묶음((tabs)) 안의 화면도 가드 안이다', async () => {
    bindSessionGate(fakeClient(null));
    setSessionKnown('out');
    const tree = await renderApp('/chat');
    expect(drawn.chat ?? 0).toBe(0);
    expect(has(tree, 'screen-chat')).toBe(false);
    expect(pathname()).toBe('/onboarding');
  });

  test('가입 전 화면(온보딩 · 로그인 · 약관·동의 · 시작 분기)은 로그인이 없어도 열린다', async () => {
    bindSessionGate(fakeClient(null));
    setSessionKnown('out');
    for (const route of ['/onboarding', '/sign-in', '/consent', '/']) {
      const tree = await renderApp(route);
      expect(pathname()).toBe(route);
      expect(has(tree, 'login-guard-out')).toBe(false);
      await act(async () => tree.unmount());
      trees.pop();
    }
  });
});

describe('FB-022 로그인 가드: 로그아웃 뒤 뒤로 가기', () => {
  test('쌓인 화면이 로그아웃 순간 내용을 내려놓고, 뒤로 가기를 끝까지 눌러도 앞 화면 내용은 다시 안 보인다', async () => {
    const client = fakeClient(SESSION);
    bindSessionGate(client);
    setSessionKnown('in');
    const tree = await renderApp('/chat');
    await act(async () => router.push('/chat/room-1' as never));
    await settle();
    await act(async () => router.push('/profile'));
    await settle();
    await act(async () => router.push('/boarding' as never));
    await settle();
    expect(pathname()).toBe('/boarding');
    expect(has(tree, 'screen-chat')).toBe(true);
    expect(has(tree, 'screen-room')).toBe(true);

    // 설정의 [로그아웃]과 같은 순서: 처음 화면으로 갈아 끼우고(leaveToStart) 로그인 정보를 끊는다
    await act(async () => router.replace('/onboarding'));
    await settle();
    await act(async () => client.signOut());
    await settle();
    expect(pathname()).toBe('/onboarding');
    for (const id of ['screen-chat', 'screen-room', 'screen-profile', 'screen-boarding']) expect(has(tree, id)).toBe(false); // 쌓여 있던 화면도 내용이 없다

    const drawnAtLogout = { ...drawn };
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        if (router.canGoBack()) router.back();
      });
      await settle();
      for (const id of ['screen-chat', 'screen-room', 'screen-profile', 'screen-boarding']) expect(has(tree, id)).toBe(false);
      expect(pathname()).toBe('/onboarding'); // 막힌 화면은 처음 화면으로 되돌린다
    }
    for (const name of ['chat', 'room', 'profile', 'boarding']) expect(drawn[name]).toBe(drawnAtLogout[name]); // 로그아웃 뒤에는 가드 안 화면이 한 번도 다시 그려지지 않았다(처음 화면은 가드 밖이라 다시 그려져도 된다)
  });

  test('로그아웃 뒤 가드 안 주소로 보내도(앞 주소를 그대로 여는 경우) 내용 0 · 처음 화면', async () => {
    const client = fakeClient(SESSION);
    bindSessionGate(client);
    setSessionKnown('in');
    const tree = await renderApp('/onboarding');
    await act(async () => client.signOut());
    await settle();
    const before = { ...drawn };
    await act(async () => router.push('/chat/room-9' as never));
    await settle();
    expect(has(tree, 'screen-room')).toBe(false);
    expect(drawn.room ?? 0).toBe(before.room ?? 0);
    expect(pathname()).toBe('/onboarding');
  });

  test('다시 로그인하면 가드 안 화면이 다시 열린다', async () => {
    const client = fakeClient(SESSION);
    bindSessionGate(client);
    setSessionKnown('in');
    const tree = await renderApp('/onboarding');
    await act(async () => client.signOut());
    await settle();
    expect(sessionKnown()).toBe('out');
    await act(async () => client.signIn());
    await settle();
    expect(sessionKnown()).toBe('in');
    await act(async () => router.push('/profile'));
    await settle();
    expect(pathname()).toBe('/profile');
    expect(has(tree, 'screen-profile')).toBe(true);
  });
});

describe('FB-022 로그인 가드: 어느 화면이 가드 안인가', () => {
  const APP_DIR = path.resolve(__dirname, '..', 'app');
  // src/app 아래 화면 파일 → 뿌리 Stack 의 화면 이름. 그룹 (tabs) 안의 화면은 '(tabs)' 한 화면으로 묶인다. api · _layout 은 화면이 아니다
  function stackNames(dir = APP_DIR, base = ''): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'api') return [];
        if (entry.name.startsWith('(')) return [entry.name];
        return stackNames(full, `${base}${entry.name}/`);
      }
      if (!entry.name.endsWith('.tsx') || entry.name.startsWith('_')) return [];
      return [`${base}${entry.name.replace(/\.tsx$/, '')}`];
    });
  }

  test('가입 전 화면 이름이 모두 실제 화면 파일이다(이름이 바뀌면 가드가 조용히 구멍 나지 않게)', () => {
    const names = stackNames();
    for (const publicName of PUBLIC_ROUTES) expect(names).toContain(publicName);
  });

  test('가입 전 화면 밖의 모든 화면(탭 묶음 · 대화방 · 상대 프로필 · 프로필 · 탑승권 · 공개 · 설문 …)은 가드 안이다 — 새 화면도 기본이 가드 안', () => {
    const names = stackNames();
    const guarded = names.filter((n) => isGuardedRoute(n));
    expect(guarded.sort()).toEqual(names.filter((n) => !PUBLIC_ROUTES.includes(n)).sort());
    for (const must of ['(tabs)', 'chat/[id]', 'candidate/[id]', 'profile', 'reveal', 'grade', 'credits', 'mileage-log', 'survey/[step]', 'photos', 'analysis', 'traits', 'saju-detail']) expect(guarded).toContain(must);
    expect(isGuardedRoute('어떤-새-화면')).toBe(true);
    expect([...PUBLIC_ROUTES].sort()).toEqual(['+not-found', 'consent', 'index', 'onboarding', 'sign-in', 'sign-in-code-error']);
  });

  test('뿌리 레이아웃이 가드를 달고 있고, 앱 시작 때 로그인 상태 알림을 건다', () => {
    const layout = fs.readFileSync(path.join(APP_DIR, '_layout.tsx'), 'utf8');
    expect(layout).toContain('screenLayout={loginScreenLayout}');
    expect(layout).toContain('bindSessionGate(supabase)');
  });
});
