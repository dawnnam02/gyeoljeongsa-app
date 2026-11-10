// 로그인 여부를 화면 가드(navigation/loginGuard)가 그리는 순간 바로 알 수 있게 들고 있는 작은 알림 통(QF2-B7 FB-022).
//  · 값은 'in'(로그인) · 'out'(로그인 없음) · 'unknown'(아직 모름). 진짜 판단은 늘 auth.getSession() 이고, 이 값은 '첫 그림에 내용을 그려도 되는가'만 정한다
//    — 'in' 일 때만 첫 그림부터 내용을 그리고, 'out' · 'unknown' 이면 한 번 확인할 때까지 내용을 그리지 않는다(깜빡임으로 남의 정보가 한 프레임도 비치지 않게)
//  · 값을 바꾸는 곳은 둘뿐이다: 클라이언트의 로그인 상태 알림(onAuthStateChange — 진짜 supabase 도 데모 모의 클라이언트도 같은 이름으로 알린다) · 확인 결과
//  · 'out' 이 되는 순간(로그아웃 · 탈퇴 · 세션 만료) 등록된 정리 함수를 부른다 — 화면 메모리에 남은 대화방 · 상대 사진 · 건넨 글 같은 것을 비운다.
//    정리 함수는 던지지 않게 감싸고, 서버를 부르지 않는다(상태 알림 안에서 클라이언트를 다시 부르면 멈출 수 있다)
//  · 토큰 · 이메일 · 사람 정보는 여기에 두지 않는다. 기기 · 브라우저 저장소에도 쓰지 않는다(메모리 변수 하나)
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export type SessionKnown = 'in' | 'out' | 'unknown';

// 클라이언트에서 쓰는 것만 — 진짜 supabase.auth 와 데모 모의 auth 가 둘 다 이 모양이다
export type SessionAuth = {
  onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => { data: { subscription: { unsubscribe: () => void } } };
  getSession: () => Promise<{ data: { session: Session | null } }>;
};

let known: SessionKnown = 'unknown';
let epoch = 0; // 값이 바뀔 때마다 1씩 — 화면이 '이 값에서 확인했다'를 표시하는 데 쓴다
let auth: SessionAuth | null = null;
let unbind: (() => void) | null = null;
const watchers = new Set<() => void>();
const enders = new Set<() => void>();

export const sessionKnown = (): SessionKnown => known;
export const sessionEpoch = (): number => epoch;

export function watchSessionKnown(fn: () => void): () => void {
  watchers.add(fn);
  return () => void watchers.delete(fn);
}

// 로그아웃 · 탈퇴 · 세션 만료 때 화면 메모리에 남은 것을 비우는 함수를 등록한다(모듈마다 자기 몫을 등록)
export function onSessionEnd(fn: () => void): () => void {
  enders.add(fn);
  return () => void enders.delete(fn);
}

// 등록된 정리 함수를 모두 부른다. 로그아웃 · 탈퇴 길(leaveToStart)이 직접 부르기도 한다(여러 번 불러도 같다)
export function endSessionState(): void {
  for (const fn of [...enders]) {
    try {
      fn();
    } catch {
      // 한 곳이 실패해도 나머지는 비운다
    }
  }
}

export function setSessionKnown(next: SessionKnown): void {
  if (next === known) return;
  const was = known;
  known = next;
  epoch += 1;
  if (next === 'out' && was !== 'out') endSessionState();
  for (const fn of [...watchers]) fn();
}

// 앱 시작 때 한 번: 클라이언트의 로그인 상태 알림을 듣는다. 다시 부르면 앞의 구독을 걷고 새로 건다
export function bindSessionGate(client: { auth: SessionAuth }): () => void {
  unbind?.();
  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') setSessionKnown('out');
    else if (session) setSessionKnown('in');
    else if (event === 'INITIAL_SESSION') setSessionKnown('out');
  });
  auth = client.auth;
  const mine = client.auth;
  unbind = () => {
    data.subscription.unsubscribe();
    if (auth === mine) auth = null;
  };
  return unbind;
}

// 지금 세션이 정말 있는지 클라이언트에 한 번 묻는다. 묻지 못하거나 실패하면 '없음'(닫힌 쪽)
export async function sessionExists(): Promise<boolean> {
  try {
    const result = await auth?.getSession();
    return result?.data.session != null;
  } catch {
    return false;
  }
}

// 시험용: 처음 상태로(정리 함수 등록은 모듈이 불러질 때 한 번 하는 것이라 그대로 둔다)
export function resetSessionGateForTest(): void {
  unbind?.();
  unbind = null;
  auth = null;
  known = 'unknown';
  watchers.clear();
}
