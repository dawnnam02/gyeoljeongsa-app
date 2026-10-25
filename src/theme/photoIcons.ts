// 05 사진 칸의 아이콘(D42-C · 1안 camera_add). 사진 칸 3곳에 32 × 32, 색은 sub 토큰(옛 PNG 06_카메라추가_보조와 같은 색).
//  그림은 공용 아이콘(components/Icon)의 이름으로 고른다. 옛 PNG(assets/icons/photo/camera-add-sub.png)는 지웠다.
import type { IconName } from '@/components/iconPaths';

export const PHOTO_ICONS = {
  cameraAdd: 'camera_add',
} as const satisfies Record<string, IconName>;
