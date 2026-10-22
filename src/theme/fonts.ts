// 글꼴 불러오기. 가이드 2장: Pretendard 우선(Regular · Medium · Bold 파일을 따로 쓴다).
// Pretendard를 앱에 포함해도 되는지는 법무 확인 전(가이드 9장 '미확인').
// 안 되면 이 파일의 require 3줄만 Noto Sans KR 3종으로 바꾼다. 이름(font.*)은 그대로 둔다.
import { useFonts } from 'expo-font';

import { font } from './tokens';

export const fontFiles = {
  [font.regular]: require('../../assets/fonts/Pretendard-Regular.otf'),
  [font.medium]: require('../../assets/fonts/Pretendard-Medium.otf'),
  [font.bold]: require('../../assets/fonts/Pretendard-Bold.otf'),
};

// [불러옴 여부, 오류]. 오류가 나도 앱은 시스템 글꼴로 계속 뜬다.
export function useAppFonts() {
  return useFonts(fontFiles);
}
