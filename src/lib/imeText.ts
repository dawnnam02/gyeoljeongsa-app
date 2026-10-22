// 한글 입력(IME) 조합을 깨지 않는 글 칸 규칙(F23 · 청사진 v4 10-5 P10 · 결정 D-140). 순수 함수 — 공통 TextField 가 쓴다.
//  · 조합 중(compositionstart ~ compositionend)에는 칸에 있는 글을 그대로 보이고 그대로 알린다: 가공 · 자르기 · 정규화 · 부모 값 되쓰기 0
//    (부모가 숫자만 남기기 · 줄바꿈 줄이기처럼 바꿔 저장해도, 조합이 끝날 때까지는 칸의 글을 바꾸지 않는다)
//  · 최대 글자 수는 조합이 끝난 뒤(조합 밖 입력 · compositionend)에 자른다. 웹에서는 DOM maxlength 를 쓰지 않는다(조합 중 글자를 자름)
//  · 글자 수는 글자 단위(서버 char_length 와 같게)
export type ImeGate = { readonly composing: boolean; readonly shown: string };

export const capChars = (text: string, max?: number): string => {
  if (max === undefined || max <= 0) return text;
  const chars = [...text];
  return chars.length <= max ? text : chars.slice(0, max).join('');
};

export const imeIdle = (value: string): ImeGate => ({ composing: false, shown: value });

// 조합 시작: 지금 칸의 글을 그대로 잡아 둔다
export const imeStart = (dom: string): ImeGate => ({ composing: true, shown: dom });

// 글이 바뀜: 조합 중이면 그대로 보이고 그대로 알린다(자르기 0). 조합 밖이면 최대 글자 수로 자른 값을 알린다
export function imeChange(gate: ImeGate, text: string, max?: number): { gate: ImeGate; emit: string } {
  if (gate.composing) return { gate: { composing: true, shown: text }, emit: text };
  return { gate, emit: capChars(text, max) };
}

// 조합 끝: 이제 자른다
export function imeEnd(dom: string, max?: number): { gate: ImeGate; emit: string } {
  const emit = capChars(dom, max);
  return { gate: { composing: false, shown: emit }, emit };
}

// 칸에 보일 값: 조합 중이면 칸이 가진 글, 아니면 부모 값
export const imeValue = (gate: ImeGate, value: string): string => (gate.composing ? gate.shown : value);

// ── 조합 중인 칸이 있나(웹) — 버튼이 글을 읽기 전에 조합을 끝내게 한다 ──
//  아이폰 사파리 등은 버튼을 눌러도 글 칸의 조합이 끝나지 않을 수 있다(누른 곳이 포커스를 가져가지 않음).
//  그때 [다음]이 조합 중인 글(예: '김민ㅈ')을 읽으면 '한글 2~10자로 써 주세요.'가 나거나 마지막 글자가 빠진다.
//  그래서 저장 · 검사하는 버튼은 commitTyping() 으로 칸을 내려 조합을 끝낸 뒤(compositionend → 공통 TextField 가 끝난 글을 알림) 글을 읽는다.
let composing = 0;
export const imeMark = (delta: 1 | -1): void => {
  composing = Math.max(0, composing + delta);
};
export const imeBusy = (): boolean => composing > 0;

type DocLike = { activeElement?: { blur?: () => void } | null };
export async function commitTyping(doc: DocLike | undefined = (globalThis as { document?: DocLike }).document): Promise<void> {
  if (!imeBusy() || !doc) return;
  doc.activeElement?.blur?.();
  await new Promise((resolve) => setTimeout(resolve, 40)); // 조합 끝 → 상태 반영 → 다시 그리기까지 기다린다
}
