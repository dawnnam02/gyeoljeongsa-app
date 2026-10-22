// 출시(스토어) 빌드에 데모 모드가 섞이지 않게 하는 검사(보안 점검 V-07).
//  · EXPO_PUBLIC_DEMO_MODE 가 1 인 채로 출시 빌드를 만들면 앱이 서버 대신 메모리 모의 서버를 쓴다 → 실패시킨다
//  · eas.json 의 production · preview(내부 배포가 아니라 스토어로 갈 수 있는) 프로필 env 에 DEMO_MODE 가 1 로 적혀 있어도 실패
//  · app/.env 파일은 읽지 않는다(비밀 값이 들어 있는 파일). 그 안에 DEMO_MODE=1 이 있으면 Expo 가 번들에 넣을 수 있으므로, 출시 빌드 명령은 EXPO_NO_DOTENV=1 을 주거나 .env 에서 줄을 지운다
// 사용: gen-legal-content.mjs --release 가 먼저 부른다.
export function demoModeProblems(env, easJsonText) {
  const problems = [];
  if (env.EXPO_PUBLIC_DEMO_MODE === '1') problems.push('환경 변수 EXPO_PUBLIC_DEMO_MODE=1 이 켜져 있어요(데모 모드는 서버 대신 모의 서버를 쓴다). 출시 빌드 전에 지우세요.');
  try {
    const eas = JSON.parse(easJsonText);
    for (const [name, profile] of Object.entries(eas.build ?? {})) {
      if (profile?.env?.EXPO_PUBLIC_DEMO_MODE === '1') problems.push(`eas.json build.${name}.env 에 EXPO_PUBLIC_DEMO_MODE=1 이 있어요.`);
    }
  } catch {
    problems.push('eas.json 을 읽지 못했어요(JSON 이 아님).');
  }
  return problems;
}
