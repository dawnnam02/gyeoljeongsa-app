// QF2-B7 FB-022: 로그인 상태 알림 통(lib/sessionGate) · 데모 모의 클라이언트의 로그인 상태 알림 · 로그아웃 때 화면 메모리 비우기.
import type { Session } from '@supabase/supabase-js';

import { chatApi, inflightChatApi } from '@/features/chat/chatService';
import { clearHandoff, handOff, peekHandoff } from '@/features/chat/openerPath';
import { openSettingsPage, takeSettingsPage } from '@/features/settings/settingsIntent';
import { createDemoClient } from '@/lib/demoClient';
import { bindSessionGate, endSessionState, onSessionEnd, resetSessionGateForTest, sessionExists, sessionKnown, watchSessionKnown, type SessionAuth } from '@/lib/sessionGate';
import { setToast, takeToast } from '@/lib/toastBus';
import { startHandoff, useHandoffStore } from '@/motion/PhotoHandoff';

// 채팅 연결(chatService)은 앱의 supabase 와 환경 설정을 읽는다 — 시험에서는 데모 모드의 가짜 둘로 대신한다
jest.mock('@/config/env', () => ({ env: { demoMode: true, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: null, error: null }) } }));

const SESSION = { user: { id: 'u1', email: 'a@email.com' } } as unknown as Session;

function fakeAuth(initial: Session | null) {
  let session = initial;
  const callbacks = new Set<(event: never, s: Session | null) => void>();
  const unsubscribe = jest.fn();
  const auth: SessionAuth = {
    getSession: jest.fn(async () => ({ data: { session } })),
    onAuthStateChange: (callback) => {
      callbacks.add(callback as never);
      return { data: { subscription: { unsubscribe: () => (unsubscribe(), callbacks.delete(callback as never)) } } };
    },
  };
  return {
    auth,
    unsubscribe,
    emit: (event: string, s: Session | null) => {
      session = s;
      callbacks.forEach((fn) => fn(event as never, s));
    },
  };
}

afterEach(() => resetSessionGateForTest());

describe('로그인 상태 알림 통', () => {
  test('처음에는 모름 · 알림에 따라 in / out 으로 바뀌고 듣는 쪽에 알린다', () => {
    const f = fakeAuth(null);
    bindSessionGate({ auth: f.auth });
    expect(sessionKnown()).toBe('unknown');
    const seen = jest.fn();
    watchSessionKnown(seen);
    f.emit('INITIAL_SESSION', SESSION);
    expect(sessionKnown()).toBe('in');
    f.emit('TOKEN_REFRESHED', SESSION);
    expect(seen).toHaveBeenCalledTimes(1); // 같은 값이면 알리지 않는다
    f.emit('SIGNED_OUT', null);
    expect(sessionKnown()).toBe('out');
    f.emit('SIGNED_IN', SESSION);
    expect(sessionKnown()).toBe('in');
    expect(seen).toHaveBeenCalledTimes(3);
  });

  test('시작 때 세션이 없다는 알림(INITIAL_SESSION · 세션 없음)도 out 이다', () => {
    const f = fakeAuth(null);
    bindSessionGate({ auth: f.auth });
    f.emit('INITIAL_SESSION', null);
    expect(sessionKnown()).toBe('out');
  });

  test('다시 거는 bind 는 앞의 구독을 걷는다', () => {
    const a = fakeAuth(null);
    const b = fakeAuth(null);
    bindSessionGate({ auth: a.auth });
    bindSessionGate({ auth: b.auth });
    expect(a.unsubscribe).toHaveBeenCalledTimes(1);
    a.emit('SIGNED_IN', SESSION); // 걷힌 구독의 알림은 듣지 않는다
    expect(sessionKnown()).toBe('unknown');
    b.emit('SIGNED_IN', SESSION);
    expect(sessionKnown()).toBe('in');
  });

  test('sessionExists: 클라이언트에 묻는다 · 못 묻거나 실패하면 없음(닫힌 쪽)', async () => {
    expect(await sessionExists()).toBe(false); // 아직 bind 전
    bindSessionGate({ auth: fakeAuth(SESSION).auth });
    expect(await sessionExists()).toBe(true);
    const broken = fakeAuth(SESSION);
    (broken.auth.getSession as jest.Mock).mockRejectedValueOnce(new Error('저장소를 못 읽음'));
    bindSessionGate({ auth: broken.auth });
    expect(await sessionExists()).toBe(false);
  });

  test('out 이 되는 순간 등록된 정리 함수가 불린다 · 하나가 던져도 나머지는 불린다 · in 으로 가는 때는 안 불린다', () => {
    const f = fakeAuth(null);
    bindSessionGate({ auth: f.auth });
    const bad = jest.fn(() => {
      throw new Error('정리 실패');
    });
    const good = jest.fn();
    const offBad = onSessionEnd(bad);
    const offGood = onSessionEnd(good);
    f.emit('SIGNED_IN', SESSION);
    expect(good).not.toHaveBeenCalled();
    f.emit('SIGNED_OUT', null);
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
    f.emit('SIGNED_OUT', null); // 이미 out 이면 다시 안 부른다
    expect(good).toHaveBeenCalledTimes(1);
    endSessionState(); // 로그아웃 길(leaveToStart)이 직접 부를 때는 언제든 한 번 더
    expect(good).toHaveBeenCalledTimes(2);
    offBad();
    offGood();
  });
});

describe('로그아웃 · 탈퇴 · 세션 만료 때 화면 메모리 비우기', () => {
  test('건넨 첫마디 글 · 남은 알림 글 · 열려던 설정 쪽 · 이어 붙이던 상대 사진이 모두 사라진다', () => {
    handOff({ roomId: 'room-1', draft: '안녕하세요', card: { question: '질문', answer: '답' } });
    setToast('문OO 님을 차단했어요.');
    openSettingsPage({ navigate: () => undefined }, 'avoid');
    startHandoff('cand-1', 'https://example.test/photo.png', { x: 1, y: 2, width: 100, height: 100 });
    expect(peekHandoff('room-1')).not.toBeNull();
    expect(useHandoffStore.getState().uri).not.toBeNull();

    endSessionState();

    expect(peekHandoff('room-1')).toBeNull();
    expect(takeToast()).toBeNull();
    expect(takeSettingsPage()).toBeNull();
    expect(useHandoffStore.getState().phase).toBe('idle');
    expect(useHandoffStore.getState().uri).toBeNull();
    clearHandoff('room-1');
  });

  test('채팅 연결(데모에서는 방 · 글이 든 메모리)이 새로 만들어진다 — 다음 사람에게 앞 사람의 방 목록이 이어지지 않는다', () => {
    const before = chatApi();
    const beforeIf2 = inflightChatApi();
    expect(chatApi()).toBe(before); // 로그인 중에는 같은 연결을 쓴다
    endSessionState();
    expect(chatApi()).not.toBe(before);
    expect(inflightChatApi()).not.toBe(beforeIf2);
  });

  test('로그아웃 알림만으로도 같은 정리가 걸린다(세션 만료 · 다른 길의 로그아웃)', () => {
    const f = fakeAuth(SESSION);
    bindSessionGate({ auth: f.auth });
    f.emit('SIGNED_IN', SESSION);
    handOff({ roomId: 'room-2', draft: '글' });
    setToast('남은 글');
    f.emit('SIGNED_OUT', null);
    expect(peekHandoff('room-2')).toBeNull();
    expect(takeToast()).toBeNull();
  });
});

describe('데모 모의 클라이언트의 로그인 상태 알림', () => {
  test('구독하면 곧 INITIAL_SESSION · 로그아웃하면 SIGNED_OUT · 구독을 걷으면 더는 안 온다', async () => {
    const client = createDemoClient();
    const events: string[] = [];
    const sub = client.auth.onAuthStateChange((event) => void events.push(event));
    await Promise.resolve();
    expect(events).toEqual(['INITIAL_SESSION']);
    await client.auth.signOut({ scope: 'local' });
    expect(events).toEqual(['INITIAL_SESSION', 'SIGNED_OUT']);
    sub.data.subscription.unsubscribe();
    await client.auth.signOut({ scope: 'local' });
    expect(events).toHaveLength(2);
  });

  test('틀린 토큰의 setSession 은 SIGNED_IN 을 알리지 않는다 · 듣는 쪽이 던져도 로그아웃은 끝까지 간다', async () => {
    const client = createDemoClient();
    const events: string[] = [];
    client.auth.onAuthStateChange((event) => void events.push(event));
    client.auth.onAuthStateChange(() => {
      throw new Error('듣는 쪽 오류');
    });
    await Promise.resolve();
    const bad = await client.auth.setSession({ access_token: 'x', refresh_token: 'y' });
    expect(bad.error).not.toBeNull();
    expect(events).toEqual(['INITIAL_SESSION']);
    const out = await client.auth.signOut({ scope: 'local' });
    expect(out.error).toBeNull();
    expect(events).toEqual(['INITIAL_SESSION', 'SIGNED_OUT']);
  });

  test('알림 통에 데모 클라이언트를 걸면: 시작할 때 세션 없음 → out, 로그아웃해도 out', async () => {
    const client = createDemoClient();
    bindSessionGate(client);
    await Promise.resolve();
    await Promise.resolve();
    expect(sessionKnown()).toBe('out'); // 시작할 때 세션 없음
    await client.auth.signOut({ scope: 'local' });
    expect(sessionKnown()).toBe('out');
    expect(await sessionExists()).toBe(false);
  });
});
