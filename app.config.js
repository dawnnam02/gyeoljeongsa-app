// app.json 을 그대로 쓰되, 스토어로 가는 EAS 빌드(production)에 데모 모드가 켜져 있으면 빌드를 멈춘다(보안 점검 V-07).
// EAS 는 빌드 서버에서 이 파일로 설정을 읽는다(EAS_BUILD_PROFILE 이 프로필 이름). 로컬에서 `EAS_BUILD_PROFILE=production npx expo config` 로도 확인된다.
// 같은 규칙이 scripts/lib/release-guard.mjs(gen:legal -- --release)에도 있다. 시험: src/__tests__/legalGen.test.ts 10번.
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile === 'production' && process.env.EXPO_PUBLIC_DEMO_MODE === '1') {
    throw new Error('EAS production 빌드에 EXPO_PUBLIC_DEMO_MODE=1 이 켜져 있어요. 데모 모드는 스토어 빌드에 넣을 수 없어요(eas.json production env 와 환경 변수에서 지우세요).');
  }
  // V5 W5 채팅(D-159): 사진 고르기(expo-image-picker) · 음성 녹음 · 재생(expo-audio). app.json 은 그대로 두고 여기서 더한다.
  //  사진 문구는 app.json 의 법무 확정 문구(동의문구 5-4)를 그대로 쓴다. 마이크 문구는 새 글(해요체) — 법무 확인 필요(W5_변경기록 5장)
  const MIC = '음성 메시지를 녹음하려면 마이크 권한이 필요해요. 녹음한 음성은 대화방에 보내는 데만 사용해요.';
  const photo = config.ios?.infoPlist?.NSPhotoLibraryUsageDescription;
  const camera = config.ios?.infoPlist?.NSCameraUsageDescription;
  const plugins = [...(config.plugins ?? [])];
  if (!plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-audio')) plugins.push(['expo-audio', { microphonePermission: MIC }]);
  if (!plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-image-picker')) plugins.push(['expo-image-picker', { photosPermission: photo, cameraPermission: camera, microphonePermission: false }]);
  return {
    ...config,
    ios: { ...config.ios, infoPlist: { ...config.ios?.infoPlist, NSMicrophoneUsageDescription: MIC } },
    plugins,
  };
};
