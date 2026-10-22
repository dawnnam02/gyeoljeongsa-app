// 05 사진 칸의 아이콘. 원본: 디자인/아이콘/색변형/06_카메라추가_보조.png
//  - A안 정리본(렌즈 링 없이 가운데 십자만) · 색은 sub 토큰과 같은 회색 · 512×512 · 선 2
//  - Figma 05 에서는 사진 칸 3곳에 32×32로 쓴다. F2 가 05 를 구현할 때 이 상수를 쓴다.
export const PHOTO_ICONS = {
  cameraAdd: require('../../assets/icons/photo/camera-add-sub.png'),
} as const;
