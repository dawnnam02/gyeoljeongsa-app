// 딥링크 · 첫 주소 길이 막이(IF5-F1b ⓙ · 보안 S-F2). 번들 안 query-string → decode-uri-component(높음 권고)가 아주 긴 쿼리를 풀다가 오래 걸리는 길을
// 쿼리를 풀기 전에 막는다 — 한계(2,048자)를 넘는 주소는 풀지 않고 홈('/')으로 보낸다. expo-router 업그레이드는 나중(권고 근본 해결).
//  · 이 함수는 글자 수만 센다(주소 내용은 읽지도 남기지도 않는다 · 로그 0). 앱 시작 주소와 들어오는 주소 둘 다 이 함수를 거친다(src/app/+native-intent.ts)
export const MAX_LINK_CHARS = 2048;
export const LINK_HOME = '/';

/** 한계 이하면 주소 그대로, 넘으면 홈. 글이 아니면 홈 */
export function guardSystemPath(path: unknown): string {
  return typeof path === 'string' && path.length <= MAX_LINK_CHARS ? path : LINK_HOME;
}
