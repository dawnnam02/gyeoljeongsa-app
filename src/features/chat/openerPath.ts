// 첫마디 길(QF2 Q2-02 · Q2-08 · Q2-13) — 공개 화면 입구 · 상대 프로필 질문 카드 → 대화방 입력창.
//  · 넘기는 글은 주소가 아니라 앱 안 메모리로만 건넨다(Q2-13: 웹 주소에 ?draft= 인용이 남지 않게). 화면을 새로 열면 건넨 것은 사라진다
//  · 칩은 입력창을 채우기만 한다(바로 보내지 않음) · 호감 표시 · 저장 · 상대 알림 0 · 카드를 골랐다는 흔적은 내 화면의 확인 띠뿐
//  · 카드 답을 문장에 끼울 때: 14자 안(넘으면 단어 끝에서 자르고 …) · 연락처 · 링크 모양이 섞인 답은 쓰지 않는다(그 카드는 일반 칩만)
import { findContactShapes } from '@/lib/contactShape';
import { onSessionEnd } from '@/lib/sessionGate';

export const ANSWER_FRONT_MAX = 14;

// 대화방으로 건네는 것: draft = 입력창에 넣을 글(홈 '꺼내는 말 가져가기' · T3 이야깃거리) · card = 프로필 질문 카드(칩 + 확인 띠를 만든다)
export type OpenerHandoff = { roomId: string; draft?: string; card?: { question: string; answer: string } };

const HANDOFF_MS = 30_000; // 건넨 뒤 이 시간이 지나면 버린다(방으로 못 넘어간 건넴이 나중에 되살아나지 않게)
let pending: (OpenerHandoff & { at: number }) | null = null;
onSessionEnd(() => {
  pending = null; // 로그아웃 · 탈퇴 · 세션 만료: 건네던 글(앞 사람의 입력창 글 · 프로필 질문 카드)이 다음 사람에게 넘어가지 않게(FB-022)
});

export function handOff(h: OpenerHandoff, now: number = Date.now()): void {
  pending = { ...h, at: now };
}
// 읽기만 한다(React 개발 모드가 초기화를 두 번 불러도 같은 값). 지우기는 화면을 떠날 때 clearHandoff
export function peekHandoff(roomId: string, now: number = Date.now()): OpenerHandoff | null {
  if (!pending || pending.roomId !== roomId || now - pending.at > HANDOFF_MS) return null;
  return pending;
}
export function clearHandoff(roomId: string): void {
  if (pending && pending.roomId === roomId) pending = null;
}

const chars = (t: string) => Array.from(t);

// 한 줄 앞부분: 첫 줄만, 14자 안이면 그대로, 넘으면 단어(공백) 끝에서 자르고 … 를 붙인다. 첫 단어가 14자를 넘으면 null(문장을 못 만든다)
export function frontOf(text: string, max = ANSWER_FRONT_MAX): string | null {
  const line = text.split(/\r?\n/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  if (line === '') return null;
  if (chars(line).length <= max) return line;
  let out = '';
  for (const word of line.split(' ')) {
    const next = out === '' ? word : `${out} ${word}`;
    if (chars(next).length > max) break;
    out = next;
  }
  return out === '' ? null : `${out}…`;
}

// 연락처 · 링크 · 아이디 꼴이 섞였나(대화방 거르기와 같은 모양 판정 — lib/contactShape)
export function hasContactShape(text: string): boolean {
  return findContactShapes(text).length > 0;
}

// 방 번호로 A · B 를 고른다(같은 문장이 여러 방에서 똑같이 가지 않게)
export function variantOf(roomId: string): 'a' | 'b' {
  let h = 0;
  for (const c of roomId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 2 === 0 ? 'a' : 'b';
}

export type CardOpener = { question: string; answer: string };

// 카드로 칩 문장 · 띠 글감을 만든다. 못 만들면(답이 길거나 연락처 꼴) null → 일반 칩만
export function cardParts(card: CardOpener): { answerFront: string; questionFront: string } | null {
  if (hasContactShape(card.answer) || hasContactShape(card.question)) return null;
  const answerFront = frontOf(card.answer);
  const questionFront = frontOf(card.question);
  if (!answerFront || !questionFront) return null;
  return { answerFront, questionFront };
}
