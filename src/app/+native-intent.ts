// expo-router 가 앱 시작 주소(initial)와 들어오는 딥링크를 쿼리로 풀기 전에 부르는 자리(IF5-F1b ⓙ). 길이가 한계를 넘으면 풀지 않고 홈으로(lib/linkGuard).
//  파일 꼴: 확장자 .ts(라우트 목록 점검이 .tsx 만 라우트로 센다) · 던지지 않는다(앱이 꺼질 수 있다)
import { guardSystemPath } from '@/lib/linkGuard';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return guardSystemPath(path);
}
