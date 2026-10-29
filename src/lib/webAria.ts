// 웹 화면 읽기 속성 보조(3부-자 QP-39). react-native-web 0.21 은 accessibilityState 를 DOM 속성으로 옮기지 않아서
//  눌림 · 고름 · 펼침이 화면 읽기에 안 나간다 → 같은 값을 aria-* 로도 준다(네이티브는 accessibilityState 가 읽고, aria-* 는 모른 채 넘어간다).
//  · checked → aria-checked · selected → aria-selected · expanded → aria-expanded 는 react-native 타입에 있어 바로 쓴다
//  · aria-pressed(켜고 끄는 알약 · 단추)만 react-native 타입에 없어 이 함수로 펼친다: <Pressable {...ariaPressed(on)} />
//  · 새로 accessibilityState 를 쓰면 같은 값의 aria-* 를 같이 줘야 한다 — src/__tests__/s3jaLounge.test.tsx 가 코드 전체를 훑는다
export function ariaPressed(pressed: boolean): Record<string, boolean> {
  return { 'aria-pressed': pressed };
}
