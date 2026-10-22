// 앱이 읽는 환경 변수 셋(보안/구성.md 9-1). 값은 app/.env(저장소 제외)에 둔다. 이 파일에는 이름만 있다.
//  EXPO_PUBLIC_SUPABASE_URL · EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY  서버 주소와 공개해도 되는 키
//  EXPO_PUBLIC_DEMO_MODE  '1' 이면 서버 대신 메모리 모의 클라이언트를 쓴다(테스트웹 TW1 · 본문은 F8).
//                         기본은 꺼짐: 값이 없거나 1 이 아니면 끈다. 비밀이 아니라 켬/끔 표시일 뿐이다.
//                         스토어에 내는 빌드(EAS production)에서는 설정하지 않는다.
// Metro 가 빌드할 때 process.env.EXPO_PUBLIC_* 를 값으로 바꿔 넣는다. 그래서 점 표기로만 읽는다.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === '1';

// 데모 모드는 서버에 닿지 않으므로 주소 · 키가 없어도 시작한다.
if (!demoMode) {
  if (!url || !publishableKey) {
    // 값 자체는 오류 문구에 넣지 않는다.
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL 또는 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 비어 있어요. app/.env.example 을 보고 app/.env 를 만드세요.',
    );
  }
  if (!url.startsWith('https://')) {
    throw new Error('Supabase 주소는 https 여야 해요(보안/구성.md F-01).');
  }
}

export const env = {
  demoMode,
  supabaseUrl: url ?? '',
  supabasePublishableKey: publishableKey ?? '',
} as const;
