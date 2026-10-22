// V10 연락처 입력 안내의 모양 판정(순수 함수, K15 10-03 · 10-04 · D-75). 서버 private.text_guard(0016)와 같은 규칙을 기기 안에서 돌린다.
//  · 찾는 모양 5가지: 전화번호(숫자 9자리 이상 — 띄어쓰기 · 하이픈 · 점 · 괄호 · 한글 숫자 섞임 포함) · 이메일 · @아이디 · 연락 수단 이름(content/contactWords.ts) · 링크(http · www · .com 등)
//  · 글을 서버 · 분석 도구로 보내지 않고, 판정했다는 사실도 남기지 않는다(로그 0, 10-04 · T10-14). 글을 고치거나 자르지 않는다(10-15)
//  · 칸 종류별 안내(D-75 · 카피.md 7장): 편지 = 막힘 안내 · 공개 칸 = 안내만(가장 먼저 찾은 모양이 링크면 링크 줄) · 비공개 칸 = 보이지 않는다는 안내
//  · 알려진 오탐: '텔레비전'이 연락 수단 이름 '텔레'에 걸린다(서버와 같음, backend/S12 5장 10번). 안내만이라 비용이 낮다
import { CONTACT_WORDS, LINK_WORDS } from '@/content/contactWords';

export type ContactShape = 'phone' | 'email' | 'handle' | 'app' | 'link';
export type ShapeHit = { shape: ContactShape; index: number };
export type HintField = 'letter' | 'public' | 'private';
export type HintKind = 'letter' | 'publicField' | 'publicLink' | 'privateField';

const KOREAN_DIGITS: Readonly<Record<string, string>> = { 영: '0', 공: '0', 일: '1', 이: '2', 삼: '3', 사: '4', 오: '5', 육: '6', 칠: '7', 팔: '8', 구: '9' };
const LINK_SHAPE = /https?:|www\.|[a-z0-9][a-z0-9-]*\.(?:com|net|org|kr|co|io|me|ly|info|biz|xyz|app|link|gl|be|tv|cc|dev|site|online|shop|store)(?:[^a-z0-9]|$)/;
const PHONE = /(?:[0-9][\s().-]*){9,}/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/;
const HANDLE = /@[a-z0-9_.가-힣-]{2,}/;
const KEEP = /[^0-9a-z가-힣ᄀ-ᇿㄱ-ㆎ]/g; // 한글 낱말 부분 일치용: 글자 · 숫자 · 자모만 남긴다(띄어쓰기 · 구두점으로 피하는 것을 막음)

// 서버 normalize(nfkc) + lower 와 같게. NFKC 를 못 쓰는 환경이면 전각 글자만 반각으로 바꾼다
export function normalizeForShape(text: string): string {
  let t = text.slice(0, 4000);
  try {
    t = t.normalize('NFKC');
  } catch {
    t = t.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  }
  return t.toLowerCase();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function termHit(term: string, t0: string, stripped: string): number {
  if (/^[a-z0-9 ]+$/.test(term)) {
    // 영문 낱말은 낱말 경계로(서버 \m \M), 낱말 사이 띄어쓰기는 영문 · 숫자가 아닌 글자 0개 이상
    const re = new RegExp(`(?<![a-z0-9_가-힣])${term.split(' ').map(escape).join('[^a-z0-9]*')}(?![a-z0-9_가-힣])`);
    const m = re.exec(t0);
    return m ? m.index : -1;
  }
  const key = normalizeForShape(term).replace(KEEP, '');
  if (key === '') return -1;
  const direct = t0.indexOf(key);
  if (direct >= 0) return direct;
  return stripped.indexOf(key); // 띄어 쓴 글에서만 찾은 때는 대략의 자리
}

// 찾은 모양들(글 안 자리 순서). 없으면 빈 배열
export function findContactShapes(text: string): ShapeHit[] {
  if (!text || text.trim() === '') return [];
  const t0 = normalizeForShape(text);
  const t1 = t0.replace(/[영공일이삼사오육칠팔구]/g, (c) => KOREAN_DIGITS[c] ?? c);
  const stripped = t0.replace(KEEP, '');
  const hits: ShapeHit[] = [];
  const add = (shape: ContactShape, index: number) => {
    if (index >= 0) hits.push({ shape, index });
  };
  add('phone', PHONE.exec(t1)?.index ?? -1);
  add('email', EMAIL.exec(t0)?.index ?? -1);
  if (!hits.some((h) => h.shape === 'email')) add('handle', HANDLE.exec(t0)?.index ?? -1);
  add('link', LINK_SHAPE.exec(t0)?.index ?? -1);
  if (!hits.some((h) => h.shape === 'link')) {
    const found = LINK_WORDS.map((w) => t0.indexOf(w)).filter((i) => i >= 0);
    if (found.length) add('link', Math.min(...found));
  }
  const words = CONTACT_WORDS.map((w) => termHit(w, t0, stripped)).filter((i) => i >= 0);
  if (words.length) add('app', Math.min(...words));
  return hits.sort((a, b) => a.index - b.index);
}

// 칸 종류 → 보일 안내 하나(없으면 null). 한 칸에 한 줄
export function hintFor(field: HintField, text: string): HintKind | null {
  const hits = findContactShapes(text);
  if (hits.length === 0) return null;
  if (field === 'letter') return 'letter';
  if (field === 'private') return 'privateField';
  return hits[0].shape === 'link' ? 'publicLink' : 'publicField';
}
