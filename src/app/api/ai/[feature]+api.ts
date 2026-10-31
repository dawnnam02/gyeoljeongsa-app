// AIT-F ② · /api/ai/<기능> 서버 함수(Expo Router API 경로 — 서버 판 export 에서만 켜진다).
//  기능 이름은 주소에 있지만 어느 기능인지는 본문의 feature 가 정한다(handler.ts). 코드 없음 · 틀림 · 서버 미설정은 어느 주소에서나 같은 401 이다.
//  얇게 부른다: 열쇠 · 코드 · 서명 키는 src/server/ait/route.ts 가 서버 변수에서 읽는다(이 파일은 값을 만지지 않는다).
import { handleAitRequest } from '@/server/ait/route';

export async function POST(request: Request): Promise<Response> {
  return handleAitRequest(request);
}
// 다른 방법도 같은 문을 지나 405 로 답한다(CORS 머리 0 — 같은 출처만)
export const GET = POST;
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
export const OPTIONS = POST;
export const HEAD = POST;
