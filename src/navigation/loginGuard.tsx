// 로그인이 필요한 화면 공통 가드(QF2-B7 FB-022). 뿌리 Stack 의 screenLayout 이 화면마다 감싼다(app/_layout.tsx).
//  까닭: 웹에서 로그아웃 · 탈퇴하면 router.replace('/onboarding') 만 하고(go.ts dismissAllNow 는 웹에서 아무것도 안 한다 — Q2-35), 브라우저 기록에는 앞 주소가 남는다.
//        뒤로 가기를 누르면 로그인이 필요한 주소가 그대로 열려, 채팅 목록의 상대 사진 · 이름 · 나이 · 지역과 대화방의 상대 이름 · 마감 시각 · 입력창이 다시 보였다(테스트웹 TW19).
//  규칙
//   · 가입 전 화면(PUBLIC_ROUTES: 온보딩 · 로그인 · 로그인 오류 · 약관·동의 · 시작 분기 · 없는 주소 안내) 밖은 모두 가드 안이다 — 새 화면은 따로 적지 않아도 가드 안(닫힌 쪽이 기본)
//   · 로그인이 확인되기 전(checking)과 로그인이 없을 때(out)는 내용을 그리지 않는다. 자식 화면은 한 번도 그려지지 않으므로 데이터 요청도 상태도 생기지 않는다(빈 바탕 한 장)
//   · 'in' 으로 알려져 있을 때만 첫 그림부터 내용을 그린다(lib/sessionGate). 처음 열리는 주소(새로 고침 · 딥링크)는 getSession 으로 한 번 확인한 뒤 그린다
//   · 로그인이 없다고 확인되면 처음 화면(/onboarding)으로 갈아 끼운다. 초점을 받은 화면만 움직인다(아래에 쌓인 화면 여러 장이 한꺼번에 움직이지 않게) —
//     replace 만 쓴다(걷어 내기 dismissAll 은 웹에서 기록을 되감아 늦은 popstate 를 부른다: Q2-35 를 되살리지 않는다)
//   · 로그아웃 순간 'out' 으로 바뀌면 쌓여 있던 가드 안 화면도 모두 내용을 내려놓는다 — 화면 상태(채팅 목록 · 대화방 · 상대 프로필 …)가 메모리에 남지 않는다
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { sessionEpoch, sessionExists, sessionKnown, setSessionKnown, watchSessionKnown } from '@/lib/sessionGate';
import { colors } from '@/theme/tokens';

// 로그인 없이 열리는 화면(라우트 이름 = src/app 아래 파일 경로). 이 밖은 모두 로그인이 필요하다.
//  index 는 시작 분기(로그인 여부를 보고 스스로 길을 고른다) · consent 는 약관·동의 읽기(가입 길 03, 다시 동의 안내) · +not-found 는 없는 주소 안내
export const PUBLIC_ROUTES: readonly string[] = ['index', 'onboarding', 'sign-in', 'sign-in-code-error', 'consent', '+not-found'];

export const LOGIN_HOME: Href = '/onboarding';

export const isGuardedRoute = (routeName: string): boolean => !PUBLIC_ROUTES.includes(routeName);

export type LoginGate = 'in' | 'out' | 'checking';

// 이 화면이 지금 내용을 그려도 되는지. 'in' 이면 바로, 아니면 클라이언트에 한 번 물어 본 뒤에만(첫 그림에는 내용 0)
export function useLoginGate(): LoginGate {
  const known = useSyncExternalStore(watchSessionKnown, sessionKnown, sessionKnown);
  const epoch = useSyncExternalStore(watchSessionKnown, sessionEpoch, sessionEpoch);
  const [absentAt, setAbsentAt] = useState<number | null>(null); // 세션이 없다고 확인한 때의 값 번호 — 값이 다시 바뀌면(로그인 · 로그아웃) 옛 확인은 쓰지 않고 다시 묻는다
  useEffect(() => {
    if (known === 'in') return undefined;
    let alive = true;
    void sessionExists().then((has) => {
      if (!alive) return;
      if (has) setSessionKnown('in');
      else setAbsentAt(epoch);
    });
    return () => {
      alive = false;
    };
  }, [known, epoch]);
  if (known === 'in') return 'in';
  return absentAt === epoch ? 'out' : 'checking';
}

// 로그인이 없다고 확인된 화면이 초점을 받으면 처음 화면으로 갈아 끼운다(replace 한 번)
function LeaveToStart() {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      router.replace(LOGIN_HOME);
    }, [router]),
  );
  return null;
}

function Blank({ testID }: { testID: string }) {
  return <View style={styles.blank} testID={testID} />;
}

function Guarded({ children }: { children: ReactNode }) {
  const gate = useLoginGate();
  if (gate === 'in') return <>{children}</>;
  if (gate === 'checking') return <Blank testID="login-guard-wait" />;
  return (
    <>
      <Blank testID="login-guard-out" />
      <LeaveToStart />
    </>
  );
}

export function LoginGuard({ routeName, children }: { routeName: string; children: ReactNode }) {
  if (!isGuardedRoute(routeName)) return <>{children}</>;
  return <Guarded>{children}</Guarded>;
}

// 뿌리 Stack 의 screenLayout 에 그대로 넣는다: <Stack screenLayout={loginScreenLayout} … />
export function loginScreenLayout({ route, children }: { route: { name: string }; children: ReactElement }): ReactElement {
  return <LoginGuard routeName={route.name}>{children}</LoginGuard>;
}

const styles = StyleSheet.create({ blank: { flex: 1, backgroundColor: colors.bg } });
