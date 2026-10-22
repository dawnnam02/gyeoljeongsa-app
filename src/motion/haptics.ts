// 햅틱(D25 4장 · expo-haptics). 자리는 체계 문서의 표만 쓴다 — 스플래시 · 카드 도착 · 일반 버튼 · 스크롤 · 목록에는 없다.
//  | 사건 | 종류 |
//  | 호감 보내기 누름 · 당겨서 새로고침을 놓음 | light (impact Light) |
//  | 서로 수락(연결) · 구매가 확인됨 | success (notification Success) |
//  | 실패(수락 · 호감 · 결제) | error (notification Error) |
//  | 하루 호감 한도 안내 · 되돌릴 수 없는 확인창(차단) | warning (notification Warning) |
//  | 설문 선택지 고름 | selection |
//  같은 사건은 어디서나 같은 종류, 한 사건에 하나. 햅틱만으로 알리지 않는다(늘 글 · 그림이 함께). 동작 줄이기와 따로다(동작 줄이기여도 울린다).
//  웹은 조용히 건너뛴다(진동 API 를 부르지 않는다). 기기 설정이 꺼져 있거나 실패하면 아무 일도 없다.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind = 'light' | 'success' | 'error' | 'warning' | 'selection';

// 시험에서 어떤 자리에서 무엇이 울렸는지 본다(앱 코드는 쓰지 않는다)
const listeners = new Set<(kind: HapticKind) => void>();
export function onHaptic(listener: (kind: HapticKind) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function fire(kind: HapticKind): void {
  listeners.forEach((listener) => listener(kind));
  if (Platform.OS === 'web') return; // 웹: 조용히 생략
  let job: Promise<void>;
  try {
    switch (kind) {
      case 'light':
        job = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'success':
        job = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        job = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        job = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      default:
        job = Haptics.selectionAsync();
    }
  } catch {
    return; // 모듈이 없는 환경
  }
  job.catch(() => undefined);
}

export const haptic = {
  light: () => fire('light'),
  success: () => fire('success'),
  error: () => fire('error'),
  warning: () => fire('warning'),
  selection: () => fire('selection'),
} as const;
