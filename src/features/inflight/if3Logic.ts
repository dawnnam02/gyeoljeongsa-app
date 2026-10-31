// 하늘 읽기 규칙(순수 함수 · IF3-F 축소판 3부-카 · G-02 창밖 하늘 · G-03 하늘 도감 · G-04 금성 · 수성 · G-07 생일 주간 엽서).
//  · 앱 안 천문 · 생년월일 계산 0 — 하늘 52주 표(content/skyWeeks.json)는 개발 때 AI가 미리 계산한 값을 찾기만 한다(정책 PG-07). 표에 없는 호는 칸째 없음(오류 글 0)
//  · 글은 라이브러리(content/if3Library.json ← ai/IF3/문구_라이브러리3.json) 완결 문장 + 틀 글(카피 22장 앱 사본). 숫자 · 퍼센트 · 달 밝기 · 순위 · 번호 0
//  · 고르는 규칙(라이브러리 meta '고르는 규칙'): 달 사건 글 변형 v1 · v2 는 하늘표 첫 호부터 센 호 번호의 홀 · 짝 / 사건 없는 주는 목요일 저녁 달 모양 글 / 절기 든 주는 절기 틀 + 그 절기 한 줄
import lib from '@/content/if3Library.json';
import sky from '@/content/skyWeeks.json';

import { fill } from './if2Text';

type LibSign = (typeof lib.codes.signs)[number];

export type SkyWeek = (typeof sky.weeks)[number];

const DAY = 86_400_000;
const dayNo = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY;

// '2027-01-20' → '1월 20일'(앱 날짜 표기 · 카피 22장 {시작 날짜} · {끝 날짜} · {날짜})
export function mdText(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
}
const mdOf = (md: readonly number[]): string => `${md[0]}월 ${md[1]}일`;

// ── G-02 창밖 하늘 ──────────────────────────────────────────────────────────
export const SKY_RANGE = { first: sky.weeks[0].issue, last: sky.weeks[sky.weeks.length - 1].end } as const;

// 서버 get_magazine 의 issue_date(발행 목요일)로 그 호의 표 줄을 찾는다. 목요일이 아니어도 그 주(목 ~ 수) 안이면 찾는다. 표에 없으면 null(칸째 없음)
export function skyWeekOf(issueDate: string | null): SkyWeek | null {
  if (!issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return null;
  const n = dayNo(issueDate);
  return sky.weeks.find((w) => n >= dayNo(w.issue) && n <= dayNo(w.end)) ?? null;
}

// 호 번호 홀 · 짝(표 첫 호 = 1)로 글 변형을 정한다. 회원마다 다르지 않다(회원 값 0)
const variantOf = (w: SkyWeek): 1 | 2 => ((Math.round((dayNo(w.issue) - dayNo(sky.weeks[0].issue)) / 7) % 2 === 0 ? 1 : 2) as 1 | 2);

const moonName = (stage: number): string => lib.codes.moonStages[stage] ?? '';

export type SkyLine = { moon: string; term: string | null; line: string; period: string };

// 한 칸의 글: 달 줄(사건이 있으면 사건 글, 없으면 목요일 저녁 달 모양 글, 칸 경계면 경계 글을 더함) + 절기 줄(든 주만 · 없으면 줄째 숨김)
export function skyLine(w: SkyWeek): SkyLine {
  const v = variantOf(w);
  const ev = w.events[0];
  let moon = '';
  if (ev) {
    const t = lib.moonEvent.find((x) => x.kind === ev.kind && x.variant === v) ?? lib.moonEvent.find((x) => x.kind === ev.kind);
    moon = t ? fill(t.text, { day: ev.weekday }) : '';
  } else {
    moon = lib.moonStage.find((x) => x.stage === w.stage)?.text ?? '';
    if (w.alt !== null && lib.moonAlt[0]) {
      const [a, b] = [w.stage, w.alt].sort((p, q) => p - q);
      moon = `${moon} ${fill(lib.moonAlt[0].text, { a: moonName(a), b: moonName(b) })}`.trim();
    }
  }
  const tm = w.terms[0];
  let term: string | null = null;
  if (tm) {
    const frame = lib.termFrame.find((x) => x.variant === v) ?? lib.termFrame[0];
    const one = lib.terms.find((x) => x.index === tm.index)?.text ?? '';
    term = frame ? `${fill(frame.text, { day: tm.weekday, term: tm.name })} ${one}`.trim() : null;
  }
  return { moon, term, line: [moon, term].filter(Boolean).join(' '), period: `${mdText(w.issue)} ~ ${mdText(w.end)}` };
}

// 달 모양 그림 번호(0 ~ 7) — 그 주 사건이 있으면 사건 모양(삭 0 · 상현 2 · 망 4 · 하현 6), 없으면 목요일 저녁 모양
export function skyMoonArt(w: SkyWeek): number {
  const ev = w.events[0];
  return ev ? ({ new: 0, first: 2, full: 4, last: 6 } as Record<string, number>)[ev.kind] ?? w.stage : w.stage;
}

// ── G-03 하늘 도감 ──────────────────────────────────────────────────────────
const ELEMENT_TITLE: Readonly<Record<string, string>> = { fire: 'hw-03', earth: 'hw-04', air: 'hw-05', water: 'hw-06' };
const QUALITY_TITLE: Readonly<Record<string, string>> = { cardinal: 'hw-07', fixed: 'hw-08', mutable: 'hw-09' };
const nameOf = (id: string | undefined): string => lib.names.find((n) => n.id === id)?.title ?? '';

export type BookSign = { code: string; name: string; start: string; end: string; element: string; quality: string; text: string };
// 별자리 열두 칸: 달력 차례(물병자리부터) · 번호 0 · 모두 같은 크기 — 라이브러리 order 로 정렬(서버 경계 표와 같은 차례)
export function bookSigns(): BookSign[] {
  return [...lib.dogamSigns]
    .sort((a, b) => a.order - b.order)
    .map((d) => {
      const c = lib.codes.signs.find((s) => s.code === d.code) as LibSign;
      return { code: d.code, name: d.name, start: mdOf(c.start), end: mdOf(c.end), element: nameOf(ELEMENT_TITLE[d.element]), quality: nameOf(QUALITY_TITLE[d.quality]), text: d.text };
    });
}
export type BookCard = { name: string; meaning: string };
// 카드 스물두 장: 예부터 전해 오는 차례(no 순) · 번호는 화면에 0
export const bookCards = (): BookCard[] => [...lib.dogamCards].sort((a, b) => a.no - b.no).map((c) => ({ name: c.name, meaning: c.meaning }));

// ── G-04 금성 · 수성 ────────────────────────────────────────────────────────
export const signNameOf = (code: string): string | null => lib.codes.signs.find((s) => s.code === code)?.name ?? null;
export const venusText = (code: string): string | null => lib.venus.find((x) => x.sign === code)?.text ?? null;
export const mercuryText = (code: string): string | null => lib.mercury.find((x) => x.sign === code)?.text ?? null;
export const planetNotice = (): string => lib.planetNotice[0]?.text ?? '';

// ── G-07 생일 주간 엽서 ─────────────────────────────────────────────────────
// 질문 묶음: 서버(0049)가 참일 때 묶음 번호 set 1~4 를 같이 주면 그 값을 쓴다(생일이 든 그날의 서기 해 기준 — 경계 호에서 발행 해와 어긋나지 않음). 없으면(옛 서버 · 거짓) 지금 규칙:
//  발행일의 서기 해로 정한다 → 같은 호에는 모두 같은 묶음, 해마다 다른 묶음(연속 0 · 회원 값 0). 묶음 = (발행 해 mod 4) + 1
export function birthdayQuestions(issueDate: string | null, serverSet?: number | null): string[] {
  const fromServer = serverSet !== undefined && serverSet !== null && Number.isInteger(serverSet) && serverSet >= 1 && serverSet <= 4 ? serverSet : null;
  const year = issueDate ? Number(issueDate.slice(0, 4)) : NaN;
  if (fromServer === null && !Number.isInteger(year)) return [];
  const set = fromServer ?? (year % 4) + 1;
  return lib.birthdayQuestions.filter((q) => q.set === set).map((q) => q.text);
}
