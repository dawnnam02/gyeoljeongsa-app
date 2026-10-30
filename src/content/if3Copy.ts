// 재미 기능 2(IF3 · 카피 22장) 글의 앱 사본. 3부-차에서는 1.0 별자리 경계 한 줄 두 키(22-10 `SIGN_CUSP`)만 들어온다 — 나머지 77키는 IF3-F 가 이 파일에 붙이고
//  check:copy IF3 그룹이 22장 표와 한 글자씩 대조한다(지금은 SIGN_CUSP 두 줄).
//  · 경계 날(해마다 36일)에만 기내지 ① 쪽 별자리 칸 위에 한 번: '○○자리와 ○○자리 사이에 태어났어요.' + 사실 한 문장. 이름 둘은 서버가 준 한 쌍을 달력 차례 그대로 —
//    어느 쪽이 위인지 · 전날인지 당일인지 드러나지 않게 '대표' · '또는' 같은 우열 말 0 · 숫자('36일' 따위) 화면 0
// 받침이 있으면 '과', 없으면 '와' — features/inflight/if2Text.josa 와 같은 규칙(이 파일은 check:copy 가 바로 읽으므로 경로 별칭 없이 홀로 선다)
const josaGwa = (word: string): string => {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? '과' : '와';
};

export const SIGN_CUSP = {
  // 카피 22-10 `SIGN_CUSP.pair` = '{별자리 이름}{과/와} {별자리 이름} 사이에 태어났어요.' — 조사는 받침으로
  pair: (a: string, b: string) => `${a}${josaGwa(a)} ${b} 사이에 태어났어요.`,
  why: '해마다 경계가 하루쯤 달라서 두 별자리를 함께 보여 드려요.',
} as const;
