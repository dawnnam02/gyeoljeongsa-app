import { useLocalSearchParams } from 'expo-router';

import { PhotosLiteScreen } from '@/features/photosLite/PhotosLiteScreen';

// 화면 ID 05 · 임시(F2L) 사진 등록 — AYLA'S 설문으로 교체 예정(데모 전용, 세부계획 D-48). ?mode=reupload = 08 반려 배지에서 들어온 다시 올리기 상태(F4)
export default function PhotosScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <PhotosLiteScreen mode={mode === 'reupload' ? 'reupload' : 'normal'} />;
}
