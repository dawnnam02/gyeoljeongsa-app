// 앱이 쓰는 유일한 로그 함수. console.log 를 직접 쓰지 않는다(보안/구성.md 8-1).
// 허용 목록에 없는 키는 버리고, 문자열은 40자에서 자른다(본문이 섞여 들어오는 것을 막는다).
// 토큰 · 서명 URL · 이메일 · 이름 · 설문 답 · AI 결과 · 사진 경로는 어떤 경우에도 넘기지 않는다.
const ALLOWED = new Set(['event', 'code', 'status', 'ms', 'count', 'requestId']);

export function safeLog(
  fields: Record<string, string | number | boolean>,
  // eslint-disable-next-line no-console
  sink: (line: string) => void = console.log,
): void {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!ALLOWED.has(k)) continue;
    out[k] = typeof v === 'string' ? v.slice(0, 40) : v;
  }
  sink(JSON.stringify(out));
}
