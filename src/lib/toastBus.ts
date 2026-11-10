// 화면을 넘어가며 보이는 토스트 글 하나(예: 10 에서 호감을 보낸 뒤 09 에서 "호감을 보냈어요…"). 메모리에만 있고 한 번 읽으면 지워진다.
import { onSessionEnd } from './sessionGate';

let pending: string | null = null;
onSessionEnd(() => {
  pending = null; // 로그아웃 · 탈퇴 · 세션 만료: 남은 알림 글(상대 이름이 든 차단 알림 등)이 다음 화면에 뜨지 않게(FB-022)
});

export function setToast(text: string): void {
  pending = text;
}

export function takeToast(): string | null {
  const text = pending;
  pending = null;
  return text;
}
