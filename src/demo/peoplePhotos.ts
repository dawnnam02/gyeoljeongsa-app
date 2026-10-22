// 데모 인물 사진 연결(F24 · 청사진 v4 10-5 P9). 사진 키(p01_face …) → 화면이 그리는 주소.
//  · 파일은 app/assets/demo/people/ 에 있고, 목록(peoplePhotoFiles.ts)은 scripts/link-demo-people.mjs 가 만든다(B24 의 디자인/데모인물/앱용 72장을 옮길 때)
//  · 데모 모드에서만 불러온다: Metro 가 빌드할 때 process.env.EXPO_PUBLIC_DEMO_MODE 를 값으로 바꿔 넣고, 데모가 아니면 아래 require 가 접혀 번들에 들어가지 않는다
//    (그래서 env.demoMode 를 거치지 않고 점 표기로 직접 읽는다 — config/env.ts 와 같은 규칙)
//  · 파일이 아직 없거나 데모가 아니면 null → 데모 서버 사진 함수가 404 로 답해 앱이 기본 그림을 그린다
type PhotoFiles = Readonly<Record<string, number>>;

/* eslint-disable @typescript-eslint/no-require-imports */
const files: PhotoFiles = process.env.EXPO_PUBLIC_DEMO_MODE === '1' ? (require('./peoplePhotoFiles') as typeof import('./peoplePhotoFiles')).PEOPLE_PHOTO_FILES : {};

// 연결된 사진 수(0 이면 아직 B24 사진 전 — 자리 이름만)
export const demoPhotoCount = (): number => Object.keys(files).length;

export function demoPhotoUri(key: string): string | null {
  const mod = files[key];
  if (mod === undefined) return null;
  try {
    // expo 가 함께 설치하는 expo-asset(새 패키지 아님): 웹은 내보낸 파일 주소, 네이티브는 기기 안 파일 주소
    const { Asset } = require('expo-asset') as typeof import('expo-asset');
    const uri = Asset.fromModule(mod).uri;
    return typeof uri === 'string' && uri !== '' ? uri : null;
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-require-imports */
