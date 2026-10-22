// 스크린리더 이름 만들기(R1 A⑦ · T09 · K13 46 · 47). 카드 하나를 한 포커스로 묶을 때 이름 한 줄을 만든다.
//  · 읽는 차례는 제목 → 내용 → 상태(K13 46 '제목에서 내용'). 빈 조각은 건너뛰고 ', ' 로 잇는다
//  · 역할(버튼 · 스위치)은 accessibilityRole 이 읽어 주므로 이름에 '버튼'을 또 쓰지 않는다(K13 47) — roleWordIn 이 찾고, scripts/check-a11y.mjs A2 가 코드 전체를 본다
//  · 2단계: 09 카드 · 11 행 · 16 상품 카드가 이 함수로 이름을 만든다(각 화면 주인)
export function a11yJoin(...parts: (string | null | undefined | false)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .join(', ');
}

const ROLE_WORDS = /버튼|단추/;
// 이름에 역할 말이 들어 있나(있으면 그 말)
export function roleWordIn(label: string): string | null {
  const m = ROLE_WORDS.exec(label);
  return m ? m[0] : null;
}
