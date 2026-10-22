// app.json 을 그대로 쓰되, 스토어로 가는 EAS 빌드(production)에 데모 모드가 켜져 있으면 빌드를 멈춘다(보안 점검 V-07).
// EAS 는 빌드 서버에서 이 파일로 설정을 읽는다(EAS_BUILD_PROFILE 이 프로필 이름). 로컬에서 `EAS_BUILD_PROFILE=production npx expo config` 로도 확인된다.
// 같은 규칙이 scripts/lib/release-guard.mjs(gen:legal -- --release)에도 있다. 시험: src/__tests__/legalGen.test.ts 10번.
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile === 'production' && process.env.EXPO_PUBLIC_DEMO_MODE === '1') {
    throw new Error('EAS production 빌드에 EXPO_PUBLIC_DEMO_MODE=1 이 켜져 있어요. 데모 모드는 스토어 빌드에 넣을 수 없어요(eas.json production env 와 환경 변수에서 지우세요).');
  }
  return config;
};
