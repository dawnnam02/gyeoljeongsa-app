// IF5-A2 · 순화 검사기 check_text5 — 미리 쓴 글 조각(무료 층) 전부 + AI 출력 한 칸 검사.
// 검사: 금지 말(겁주기 · 건강 · 사고 · 죽음 · 이혼 · 돈 · 법 · 길흉 · 신살 전통 이름) · 단정 꼴 · 한자 본문 · 숫자 점수 · '상담' 낱말 · 해요체 끝 · 시기 단정.
// 규칙표는 rules5.ts(AI 출력과 같은 표) + rules_extra5.ts. 업체를 부르지 않는다 · 설치 0.
//   stage 'fragment' = 우리가 미리 쓴 글(숫자 0 · 거예요 계열 전부 금지 · 한자 0)
//   stage 'ai'       = 모델이 쓴 글(사실에서 온 숫자는 허용 · 한글(한자) 괄호 한 번은 허용 · 단정 꼴은 AI 용 좁은 표)

import type { Hit } from '../server/ait/rules.ts';
import { checkText } from '../server/ait/rules.ts';
import { endsWithHaeyo, splitSentences, charLen } from '../server/ait/text.ts';
import { COMPAT_RULES, CHAT5_RULES, SAJU_RULES } from './rules5.ts';
import { ALLOW_PHRASES5, EXTRA_FRAGMENT5 } from './rules_extra5.ts';

export type Stage5 = 'fragment' | 'ai';
export interface CheckOpts5 {
  stage?: Stage5;
  /** 'line' = 해요체 문장(기본) · 'label' = 이름표(마침표 없음) */
  kind?: 'line' | 'label';
  /** 두 사람 글이면 궁합 판정 규칙을 더 건다 */
  compat?: boolean;
  /** 사주 이야기 나누기 글이면 의존 · 전문가 흉내 규칙을 더 건다 */
  chat?: boolean;
  /** 이 낱말 목록은 봐준다(예: 서버가 붙이는 고정 안내) */
  allowPhrases?: readonly string[];
  /** 문장 수 상한(0 = 검사 안 함) */
  maxSentences?: number;
  /** 글자 수 상한(0 = 검사 안 함) */
  maxChars?: number;
}
export interface Hit5 extends Hit { where?: string }

const HANJA_PAREN = /[가-힣]\([一-鿿]{1,4}\)/;

function rulesFor5(o: CheckOpts5) {
  // 미리 쓴 글은 어느 기능이든 가장 엄격한 묶음(사주 + 궁합 판정 + 대화 안전선 + 미리 쓴 글 전용)으로 본다
  if ((o.stage ?? 'fragment') === 'fragment') return [...SAJU_RULES, ...COMPAT_RULES, ...CHAT5_RULES, ...EXTRA_FRAGMENT5];
  return [...SAJU_RULES, ...(o.compat ? COMPAT_RULES : []), ...(o.chat ? CHAT5_RULES : [])];
}

/** 한 칸의 글을 검사한다. 빈 배열이면 통과. */
export function checkText5(text: string, opts: CheckOpts5 = {}): Hit5[] {
  const stage = opts.stage ?? 'fragment';
  const kind = opts.kind ?? 'line';
  let t = String(text ?? '');
  const hits: Hit5[] = [];
  const push = (id: string, label: string, word = ''): void => { hits.push({ id, label, word, severity: 'block' }); };

  if (stage === 'ai' && HANJA_PAREN.test(t)) t = t.replace(HANJA_PAREN, (m) => m[0]);   // 한글(한자) 한 번은 봐준다
  for (const h of checkText(t, rulesFor5(opts), { allowPhrases: [...ALLOW_PHRASES5, ...(opts.allowPhrases ?? [])] })) hits.push(h);

  const s = t.trim();
  if (s === '') push('e_empty', '빈 글');
  if (kind === 'label') {
    if (/[.?!]$/.test(s) || s.includes('\n')) push('e_label_punct', '이름표에 마침표 · 줄바꿈');
  } else if (s !== '') {
    const sents = splitSentences(s);
    for (const x of sents) if (!endsWithHaeyo(x)) { push('e_ending', '해요체(요 · 죠)로 끝나지 않는 문장', x.slice(-12)); break; }
    if (opts.maxSentences && sents.length > opts.maxSentences) push('e_sentences', `문장 ${sents.length}개 > ${opts.maxSentences}`);
  }
  if (opts.maxChars && charLen(s) > opts.maxChars) push('e_chars', `글자 ${charLen(s)} > ${opts.maxChars}`);
  return hits;
}

/** 전부 통과인가 */
export const passes5 = (text: string, opts: CheckOpts5 = {}): boolean => checkText5(text, opts).length === 0;
