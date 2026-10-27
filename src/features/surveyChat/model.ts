// 대화형 설문 1부 규칙 — 화면 없이 시험하는 순수 함수(V6-F). 문항 · 보임 · 검사 · 저장 값은 설문 v2(features/surveyV2/model)를 그대로 쓴다(저장 키 · 값 같음).
//  · 1부 문항 = 설문 v2 필수 흐름(보이는 것만). 인터뷰(2부)가 있으면 T01~T03 은 2부로 옮긴다(D-163) — 2부가 꺼지거나 실패하면 끝에 글로 묻는다
//  · 지금 물을 문항 = 보이는 1부 문항 가운데 첫 '열린' 문항(답 없음, 그리고 필수이거나 건너뛰지 않은 선택 문항). 고친 답 때문에 앞에 새 필수 문항이 생기면 그것부터
//  · 대화 줄은 답에서 다시 만든다(이어서 하기 · 고치기가 같은 길): 섹션 시작 · 끝 줄 · AI 말(변형 고정) · 왜 묻는지 · 내 답 · 받아 주는 말
import { SV2 } from '@/features/surveyV2/copy';
import { answerText, DECLINE_HINT_IDS, qOf, RELIGION_ID, visibleFlow } from '@/features/surveyV2/model';
import { POL } from '@/features/surveyV2/politicsCopy';
import type { QuestionDef, SectionKey, V2Answers } from '@/features/surveyV2/types';

import { ackText, fill, givenName, pick, sectionName, seedOf, t, type Fill } from './copy';
import { REL } from './relCopy';

export const TEXT_QS: readonly string[] = ['T01', 'T02', 'T03'];
// 하나 고르기만 누르면 바로 보낸다(시안 '함께 정한 것'). 구간 · 5단계 · 여러 개 · 양끝 · 키 · 글 · 학교는 [이렇게 할게요]
export const sendsAtOnce = (q: QuestionDef): boolean => q.format === 'choice';

export type Line =
  | { kind: 'ai'; key: string; text: string; badge?: boolean; small?: boolean; qid?: string }
  | { kind: 'me'; key: string; qid: string; text: string }
  | { kind: 'topic'; key: string; text: string }
  | { kind: 'note'; key: string; text: string };

const has = (a: V2Answers, id: string) => Object.prototype.hasOwnProperty.call(a, id);

export function part1List(a: V2Answers, interview: boolean): QuestionDef[] {
  return visibleFlow(a).filter((q) => !(interview && TEXT_QS.includes(q.id)));
}

export function currentQuestion(a: V2Answers, interview: boolean, skipped: readonly string[]): QuestionDef | null {
  return part1List(a, interview).find((q) => !has(a, q.id) && (q.required || !skipped.includes(q.id))) ?? null;
}

export type PolState = 'off' | 'ask' | 'answered' | 'later';
// 종교 동의 카드(3부-사 · L22 D2): off = 카드 없음(유효한 CK4 · 또는 카드 기능 없음) · ask = A06 차례에 카드 · agreed = 이 설문에서 카드로 동의(대화에 동의 줄을 남김)
export type RelState = 'off' | 'ask' | 'agreed';

export type Part1View = { lines: Line[]; ask: QuestionDef | 'POL' | 'REL' | null; section: SectionKey | null };

type BuildOpts = {
  userKey: string;
  interview: boolean;
  skipped: readonly string[];
  pol: PolState;
  rel?: RelState;
  schoolName: (key: string) => string | null;
};

// 값 자리 채움(이름 · 지역 · 학교 · 키 · 범위)
export function varsFor(id: string, a: V2Answers, schoolName: (key: string) => string | null): Fill {
  const v: unknown = a[id];
  const name = typeof a.A12 === 'string' ? givenName(a.A12) : '';
  const out: Record<string, string> = { 이름: name };
  if (id === 'A03' && typeof v === 'object' && v !== null) out['지역'] = answerText(qOf('A03'), a.A03, schoolName);
  if ((id === 'B02' || id === 'B05') && typeof v === 'object' && v !== null && 'school_key' in v) out['학교'] = schoolName(String((v as { school_key: string }).school_key)) ?? '';
  if (id === 'A05' && typeof v === 'number') out.n = String(v);
  if (id === 'F02' && typeof v === 'object' && v !== null) {
    const r = v as { min?: number; max?: number };
    out['최소'] = String(r.min ?? 130);
    out['최대'] = String(r.max ?? 220);
  }
  return out;
}

// '알겠어요.'만 있는 받아 주는 말은 세 문항에 한 번쯤만 낸다(V6-K 0장 — 바로 다음 질문이 이어질 때는 생략해도 된다)
const quietAck = (id: string, text: string, userKey: string) => text === t('CHAT.ACK.1') && seedOf(`${userKey}:${id}:q`) % 3 !== 0;

export function buildPart1(a: V2Answers, opts: BuildOpts): Part1View {
  const { userKey, interview, skipped, pol, schoolName } = opts;
  const rel = opts.rel ?? 'off';
  const lines: Line[] = [{ kind: 'ai', key: 'first', text: pick('CHAT.START.first', userKey), badge: true }];
  const list = part1List(a, interview);
  const cur = currentQuestion(a, interview, skipped);
  let prevSection: SectionKey | null = null;

  const enter = (section: SectionKey) => {
    if (prevSection === section) return;
    if (prevSection) {
      lines.push({ kind: 'ai', key: `sec-end-${prevSection}`, text: pick(`CHAT.SEC.${prevSection}.end`, userKey) });
      lines.push({ kind: 'topic', key: `topic-${section}`, text: fill(t('CHAT.UI.nextTopic'), { 섹션: sectionName(section) }) });
    }
    lines.push({ kind: 'ai', key: `sec-start-${section}`, text: pick(`CHAT.SEC.${section}.start`, userKey) });
    prevSection = section;
  };
  const ask = (q: QuestionDef) => {
    enter(q.section);
    lines.push({ kind: 'ai', key: `q-${q.id}`, text: pick(`CHAT.${q.id}`, userKey), qid: q.id });
    if (t(`CHAT.${q.id}.why`)) lines.push({ kind: 'ai', key: `why-${q.id}`, text: t(`CHAT.${q.id}.why`), small: true, qid: q.id });
  };

  // 종교 동의 카드 줄: 카드 앞 AI 말 · (고른 뒤) 내 말풍선(누른 버튼 글) · 받아 주는 말. 거절이면 A06 은 '답하지 않음'(null)이라 질문 · 답 줄 없이 여기서 끝(L22 D2 ②)
  const relLines = (q: QuestionDef, outcome: 'agree' | 'decline' | null) => {
    enter(q.section);
    lines.push({ kind: 'ai', key: 'rel-consent', text: REL.consent, qid: RELIGION_ID });
    if (outcome === 'agree') {
      lines.push({ kind: 'me', key: 'me-REL', qid: '', text: REL.agree }); // 동의 줄은 고치지 않음(답은 아래 A06 말풍선에서 고침)
      lines.push({ kind: 'ai', key: 'rel-done', text: REL.consentDone });
    }
    if (outcome === 'decline') {
      lines.push({ kind: 'me', key: 'me-REL', qid: RELIGION_ID, text: REL.decline });
      lines.push({ kind: 'ai', key: 'ack-REL', text: REL.ack.decline });
    }
  };

  for (const q of list) {
    if (cur && q.id === cur.id) break;
    if (q.id === RELIGION_ID && has(a, q.id) && a[q.id] === null) {
      relLines(q, 'decline');
      continue;
    }
    if (q.id === RELIGION_ID && rel === 'agreed') relLines(q, 'agree');
    const answered = has(a, q.id); // cur 앞 문항은 답했거나 건너뛴 선택 문항이다
    ask(q);
    const value = answered ? a[q.id] : undefined;
    lines.push({ kind: 'me', key: `me-${q.id}`, qid: q.id, text: answered ? answerText(q, a[q.id], schoolName) || SV2.common.skip : SV2.common.skip });
    if (value === null && DECLINE_HINT_IDS.includes(q.id)) lines.push({ kind: 'note', key: `hint-${q.id}`, text: SV2.common.declineHint });
    const ack = ackText(q.id, value, a, varsFor(q.id, a, schoolName), userKey);
    if (ack && !quietAck(q.id, ack, userKey)) lines.push({ kind: 'ai', key: `ack-${q.id}`, text: ack });
  }
  if (cur) {
    if (cur.id === RELIGION_ID && rel === 'ask') {
      relLines(cur, null); // 유효한 CK4 가 없으면 A06 질문 대신 카드(L22 1-2 #4: 카드가 입력칸보다 먼저)
      return { lines, ask: 'REL', section: cur.section };
    }
    if (cur.id === RELIGION_ID && rel === 'agreed') relLines(cur, 'agree');
    ask(cur);
    return { lines, ask: cur, section: cur.section };
  }
  if (pol === 'off') return { lines, ask: null, section: prevSection };
  // 희망 조건 끝 → 정치 막대(W8, CK15 별도 동의) — 끝 줄은 정치 다리와 같은 글
  lines.push({ kind: 'ai', key: 'pol-bridge', text: t('CHAT.POL.bridge') });
  lines.push({ kind: 'ai', key: 'q-POL', text: pick('CHAT.POL', userKey), qid: 'POL' });
  lines.push({ kind: 'ai', key: 'why-POL', text: t('CHAT.POL.why'), small: true, qid: 'POL' });
  if (pol === 'ask') return { lines, ask: 'POL', section: 'wish' };
  lines.push({ kind: 'me', key: 'me-POL', qid: 'POL', text: pol === 'answered' ? POL.reviewDone : POL.later });
  lines.push({ kind: 'ai', key: 'ack-POL', text: t(pol === 'answered' ? 'CHAT.POL.ack.t1' : 'CHAT.POL.ack.later') });
  return { lines, ask: null, section: 'wish' };
}
