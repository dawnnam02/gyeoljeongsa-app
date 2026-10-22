// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 05 사진 고르기 · 다시 만들기(기기 쪽). 화면은 이 모양(PhotoPicker)만 알고, 시험은 가짜를 넣는다.
//  · 웹: <input type=file> 로 고르고 canvas 로 줄여 JPEG 로 다시 그린다(canvas 결과에는 EXIF 가 없다). 권한 창이 없다
//  · iOS · Android: 사진 고르기(expo-image-picker) · 줄이기(expo-image-manipulator) 패키지가 아직 없다(package.json 은 공용 파일).
//    2단계에서 설치하고 이 파일의 nativePicker 를 채운다(app/확인/F2L_통합목록.md 3장). 그때까지는 '쓸 수 없음'
//  · 데모 모드는 고르지 않고 예시 그림을 쓴다(lib/surveyLiteDemo.ts)
// 고른 원본 · 다시 만든 사진은 메모리에만 있다. 기기 · 브라우저 저장소에 쓰지 않고, 로그에 남기지 않는다.
import { Platform } from 'react-native';

import type { JpegEncoder, PickedImage } from './photoPipeline';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type PhotoPicker = {
  readonly available: boolean;
  readonly formatLabel: string; // 오류 문구의 {형식}: 고를 수 있는 원본 형식(앱이 JPEG 로 바꿔 올린다)
  status(): Promise<PermissionState>; // 지금 권한(묻지 않는다)
  request(): Promise<PermissionState>; // 시스템 권한 창(앱 안 안내를 먼저 보인 뒤에만 부른다)
  pick(): Promise<PickedImage | null>; // null = 고르지 않고 닫음
  encode: JpegEncoder;
};

export const unavailablePicker: PhotoPicker = {
  available: false,
  formatLabel: 'JPG · PNG · HEIC',
  status: async () => 'undetermined',
  request: async () => 'denied',
  pick: async () => null,
  encode: async () => null,
};

type Doc = Pick<Document, 'createElement'>;

// 그림 하나를 불러 크기를 잰다
function loadImage(uri: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = uri;
  });
}

export function createWebPicker(doc: Doc = document): PhotoPicker {
  let lastUrl: string | null = null;
  const release = () => {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = null;
  };
  return {
    available: true,
    formatLabel: 'JPG · PNG', // 웹 브라우저 대부분이 HEIC 를 그리지 못한다
    status: async () => 'granted',
    request: async () => 'granted',
    pick: () =>
      new Promise<PickedImage | null>((resolve) => {
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          release();
          lastUrl = URL.createObjectURL(file);
          const img = await loadImage(lastUrl);
          resolve({ uri: lastUrl, width: img?.naturalWidth ?? 0, height: img?.naturalHeight ?? 0, bytes: file.size });
        };
        input.addEventListener('cancel', () => resolve(null));
        input.click();
      }),
    async encode(image, target, quality) {
      const img = await loadImage(image.uri);
      if (!img) return null;
      const canvas = doc.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, target.width, target.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      release(); // 원본은 더 쓰지 않는다
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    },
  };
}

export function defaultPicker(): PhotoPicker {
  if (Platform.OS === 'web' && typeof document !== 'undefined') return createWebPicker();
  return unavailablePicker;
}
