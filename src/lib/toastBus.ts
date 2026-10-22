// 화면을 넘어가며 보이는 토스트 글 하나(예: 10 에서 호감을 보낸 뒤 09 에서 "호감을 보냈어요…"). 메모리에만 있고 한 번 읽으면 지워진다.
let pending: string | null = null;

export function setToast(text: string): void {
  pending = text;
}

export function takeToast(): string | null {
  const text = pending;
  pending = null;
  return text;
}
