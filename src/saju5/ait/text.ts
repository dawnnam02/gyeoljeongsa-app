// AIT-A · 글 정리: 정규화 · 가리기 · 데이터로 감싸기 · 인용 대조용 정규화.
// 순수 함수만. 로그를 남기지 않는다(입력 본문이 섞일 수 있다).
// 가리기 패턴 7개(MASK_PATTERNS)는 backend/functions/_shared/ai/mask.ts 와 같은 모양이다(서버 함수는 DB 없는 별도 번들이라 사본을 둔다).
// 생일 가리기 넓힘 7개(BIRTH_PATTERNS, IC5-48)는 아직 mask.ts 에 없다 — 팀장이 백엔드에 넘긴다.

/** 숨은 글자(제로폭 · 양방향 제어 · 줄 구분 · 바이트 순서 표시)의 코드 범위. 정규식 대신 숫자 범위로 다룬다 */
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x200B, 0x200F], [0x2028, 0x2029], [0x202A, 0x202E], [0x2060, 0x2064], [0x2066, 0x2069], [0xFEFF, 0xFEFF],
];

/** 제로폭 · 양방향 제어 · 널 · 그 밖의 제어 문자(줄바꿈 · 탭 제외) 제거 + NFKC (AC-29) */
export function sanitize(input: string): string {
  let out = '';
  for (const ch of String(input ?? '')) {
    const c = ch.codePointAt(0) as number;
    if ((c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D) || c === 0x7F) continue;
    if (INVISIBLE_RANGES.some(([a, b]) => c >= a && c <= b)) continue;
    out += ch;
  }
  return out.normalize('NFKC');
}

export interface MaskPattern { name: string; source: string; flags: string; mask: string }
export const MASK_PATTERNS: readonly MaskPattern[] = [
  { name: 'email', source: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', flags: '', mask: '[연락처]' },
  { name: 'phone', source: '(?<!\\d)(?:\\+?82[-\\s]?)?0?1[016789][-\\s.]?\\d{3,4}[-\\s.]?\\d{4}(?!\\d)', flags: '', mask: '[연락처]' },
  { name: 'url', source: '\\b(?:https?:\\/\\/|www\\.)\\S+', flags: 'i', mask: '[링크]' },
  { name: 'handle', source: '(?<![A-Za-z0-9])@[A-Za-z0-9_.]{3,}', flags: '', mask: '[링크]' },
  { name: 'birthdate', source: '(?:19|20)\\d{2}\\s*[-./년]\\s*\\d{1,2}\\s*[-./월]\\s*\\d{1,2}\\s*일?', flags: '', mask: '[번호]' },
  { name: 'long_digits', source: '\\d[\\d\\s-]{6,}\\d', flags: '', mask: '[번호]' },
  { name: 'photo', source: 'data:image\\/|base64,|\\.(?:jpe?g|png|gif|webp|heic)\\b|\\/storage\\/v1\\/', flags: 'i', mask: '[링크]' },
];
const MASK_ORDER = ['email', 'phone', 'url', 'handle', 'birthdate', 'long_digits', 'birth_zodiac', 'birth_year', 'birth_date2', 'birth_compact', 'birth_pillars', 'birth_ganji', 'birth_time', 'photo'];

// ---- IC5-48 · 상담 글 속 생일 가리기 넓힘(F0-A, 2026-10-31). 기존 7개(MASK_PATTERNS)와 따로 둔다.
// 이유: MASK_PATTERNS 는 hasResidualPii · hasContactShape(모델 출력 검사)에도 쓰여서, 여기에 넣으면 모델이 쓴 세운 날짜('병오년 3월 12일')가 연락처 모양으로 걸린다.
// 그래서 입력 가리기(maskText)에서만 쓴다. 가린 글자는 기존 생년월일과 같은 '[번호]'.
// 오탐을 줄이려고 두 자리 연도는 40~99 · 00~09 만 본다(25.10.31 같은 문서 날짜는 건드리지 않음). 오탐 표는 ai/AIT/README.md 'IC5-48'.
const YY = '(?:[4-9]\\d|0\\d)';
const YYYY = '(?:19[3-9]\\d|20[01]\\d)';
const MON = '(?:1[0-2]|0?[1-9])';
const DAY = '(?:[12]\\d|3[01]|0?[1-9])';
const ANIMAL = '(?:쥐|소|호랑이|범|토끼|용|뱀|말|양|원숭이|닭|개|돼지)띠';
const BORN_END = '생(?:(?![가-힣])|(?=이|인|은|입|임|도|으로|과|와|들|만|에|의|을|를))';   // 생각 · 생활 · 생일은 제외
const YEARWORD = '(?:(?:19|20)\\d{2}|\\d{2})\\s*년(?:\\s*' + BORN_END + ')?';
const GJ = '[갑을병정무기경신임계甲乙丙丁戊己庚辛壬癸][자축인묘진사오미신유술해子丑寅卯辰巳午未申酉戌亥]';
const TIME = '(?:(?:오전|오후|새벽|아침|낮|저녁|밤|한밤중|한밤|정오|자정)\\s*)?(?:\\d{1,2}\\s*시(?:\\s*(?:\\d{1,2}\\s*분|반))?|\\d{1,2}:\\d{2})\\s*(?:쯤|경|무렵|께)?';
const SIJIN = '[자축인묘진사오미신유술해]시';
const BORNWORD = '(?:에\\s*)?(?:태어[가-힣]*|출생(?!신고|지|률|증명)|낳았|낳은|' + BORN_END + ')';
const PILLAR_HZ = '[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥][年月日時时]?';
const PILLAR_HG = '[갑을병정무기경신임계][자축인묘진사오미신유술해][년월일시]?';
const PILLAR_SEP = '[\\s,，、·/-]*';
export const BIRTH_PATTERNS: readonly MaskPattern[] = [
  // 띠 + 연도: '85년생 소띠' · '소띠 85년생' · '1985년 소띠'
  { name: 'birth_zodiac', source: '(?<!\\d)' + YEARWORD + '\\s*,?\\s*' + ANIMAL + '|' + ANIMAL + '\\s*,?\\s*(?:인|의)?\\s*' + YEARWORD, flags: '', mask: '[번호]' },
  // ○○년생: '85년생' · '1985년생' · '85년 3월생' · '85년도생' · '85년 출생'
  { name: 'birth_year', source: '(?<![\\d.])(?:' + YYYY + '|' + YY + ')\\s*년도?\\s*(?:' + MON + '\\s*월\\s*)?(?:' + BORN_END + '|출생(?!신고|지|률|증명))', flags: '', mask: '[번호]' },
  // 두 자리 연도 날짜: '85년 3월 12일' · '85.3.12' · '85/3/12' · '85-3-12'
  { name: 'birth_date2', source: '(?<![\\d.,/-])' + YY + '\\s*(?:년\\s*' + MON + '\\s*월\\s*' + DAY + '\\s*일?|([-./])\\s*' + MON + '\\s*\\1\\s*' + DAY + ')(?!\\d|[./-]\\d)', flags: '', mask: '[번호]' },
  // 숫자 붙임: '850312'(연도 40~99 · 00~09 + 유효한 월일, 금액 · 개수 단위 앞은 제외) · '19850312'
  { name: 'birth_compact', source: '(?<![\\d.,/#$₩-])(?:' + YYYY + '|' + YY + ')(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])(?!\\d|[.,/-]\\d|\\s?(?:원|개|명|건|번|호|장|%|kg|cm|mm|ml|km|평|㎡|배|회|위|점|달러))', flags: '', mask: '[번호]' },
  // 사주 여덟 글자: '甲子 乙丑 丙寅 丁卯'(한자 간지 셋 이상 이은 꼴 = 년월일 세 기둥 이상) · '갑자 을축 병인 정묘'(한글 간지 넷 이상). 기둥 뒤 年月日時 · 년월일시 글자는 같이 가림
  { name: 'birth_pillars', source: PILLAR_HZ + '(?:' + PILLAR_SEP + PILLAR_HZ + '){2,}|(?<![가-힣])' + PILLAR_HG + '(?:' + PILLAR_SEP + PILLAR_HG + '){3,}', flags: '', mask: '[번호]' },
  // 간지 연월일: '갑자년 3월 12일' · '을축년생' · '갑자년 병인월 정묘일' · '병인월 정묘일' (한자 포함). 간지 연도만('병오년')은 세운 이야기라 두지 않는다
  { name: 'birth_ganji', source: '(?<![가-힣])' + GJ + '(?:년|年)\\s*(?:' + BORN_END + '|(?:(?:음력|양력)\\s*)?' + MON + '\\s*[월月]\\s*' + DAY + '\\s*[일日]?|' + GJ + '(?:월|月)(?:\\s*' + GJ + '(?:일|日))?)|(?<![가-힣])' + GJ + '(?:월|月)\\s*' + GJ + '(?:일|日)', flags: '', mask: '[번호]' },
  // 태어난 시각: '오후 3시 반에 태어난' · '새벽 2시생' · '자시에 태어난' · '생시는 오후 3시'
  { name: 'birth_time', source: '(?:' + TIME + '|' + SIJIN + ')\\s*' + BORNWORD + '|(?:생시|태어난\\s*(?:시각|시간)|출생\\s*(?:시각|시간))\\s*(?:은|는|이|가|:)?\\s*(?:' + TIME + '|' + SIJIN + ')', flags: '', mask: '[번호]' },
];
const MASK_ALL: readonly MaskPattern[] = [...MASK_PATTERNS, ...BIRTH_PATTERNS];

export interface KnownValues {
  name?: string | null;          // 질문자 이름(안다면)
  school?: string | null;
  employer?: string | null;
  /** 질문자가 첫 화면에서 알려 준 상대 호칭(이름 · 닉네임 · 이니셜). '상대'로 바꾼다 (AC-30) */
  partnerNames?: readonly string[];
}

const TITLE_SUFFIX = '(?:\\s?(?:씨|님|오빠|언니|누나|형|선배|군|양))?';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 개인정보 가리기. 가린 횟수를 함께 돌려준다. 원문은 어디에도 남기지 않는다. 꺾쇠는 마지막에 전각으로 바꾼다. */
export function maskText(text: string, known: KnownValues = {}): { text: string; count: number } {
  let t = text;
  let count = 0;
  // 1) 상대 호칭(+ 씨/님 …) → 상대. 긴 것부터
  const partner = [...(known.partnerNames ?? [])].map((v) => v.trim()).filter((v) => v.length >= 2).sort((a, b) => b.length - a.length);
  for (const v of partner) {
    // 한 글자 호칭은 오탐이 커서 가리지 않는다(알려진 구멍으로 문서에 적음)
    const re = new RegExp(escapeRe(v) + TITLE_SUFFIX, 'g');
    t = t.replace(re, () => { count++; return '상대'; });
  }
  // 2) 질문자가 입력한 이름 · 직장 · 학교
  const own: Array<[string, string]> = [];
  for (const [value, mask] of [[known.name, '[이름]'], [known.employer, '[직장]'], [known.school, '[학교]']] as Array<[string | null | undefined, string]>) {
    const v = (value ?? '').trim();
    if (v.length >= 2) own.push([v, mask]);
  }
  own.sort((a, b) => b[0].length - a[0].length);
  for (const [v, mask] of own) {
    const parts = t.split(v);
    if (parts.length > 1) { count += parts.length - 1; t = parts.join(mask); }
  }
  // 3) 모양으로 찾는 것
  for (const name of MASK_ORDER) {
    const p = MASK_ALL.find((x) => x.name === name);
    if (!p) continue;
    t = t.replace(new RegExp(p.source, p.flags + 'g'), () => { count++; return p.mask; });
  }
  // 4) 프롬프트 구분자를 글이 흉내 내지 못하게 전각으로
  t = t.replaceAll('<', '＜').replaceAll('>', '＞');
  return { text: t, count };
}

/** 가린 뒤에도 연락처 · 링크 · 긴 숫자 모양이 남아 있으면 true(안전망 — 이때 업체 호출 0) */
export function hasResidualPii(maskedText: string): boolean {
  return MASK_PATTERNS.some((p) => new RegExp(p.source, p.flags).test(maskedText));
}

/** 모델 출력에 연락처 · 링크 모양이 있나(출력 검사에서 쓴다) */
export function hasContactShape(text: string): boolean {
  return hasResidualPii(text);
}

/** 모델에 보내는 사용자 글: JSON 문자열 값으로 칸을 나눠 감싼다(AC-31). 따옴표 · 줄바꿈 · 닫는 태그가 구조를 못 깬다. */
export function wrapTurn(n: number, askerText: string, partnerText: string): string {
  return '<내말>' + JSON.stringify({ n, asker_text: askerText, partner_text: partnerText }) + '</내말>';
}

/** 서버가 쓴 사실(상태). 키 순서는 호출하는 쪽이 정한 객체 순서를 그대로 쓴다. */
export function wrapState(state: Record<string, unknown>): string {
  return '<상태>' + JSON.stringify(state) + '</상태>';
}

/** 인용 대조용 정규화: 글자 · 숫자 · 한글만 남기고 소문자로. 공백 · 따옴표 · 문장부호 · 이모지 차이를 없앤다. */
export function normalizeForQuote(s: string): string {
  return String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

/** q가 source 안에 글자 그대로(정규화 뒤) 들어 있나. 너무 짧은 조각(정규화 뒤 2자 미만)은 거절. */
export function quoteInSource(q: string, ...sources: string[]): boolean {
  const nq = normalizeForQuote(q);
  if (nq.length < 2) return false;
  return sources.some((s) => normalizeForQuote(s).includes(nq));
}

/** 글자 수(코드 포인트 기준) */
export function charLen(s: string): number {
  return Array.from(s).length;
}

/** 문장 나누기: 마침표 · 물음표 뒤 공백, 줄바꿈 */
export function splitSentences(text: string): string[] {
  return text.trim().split(/(?<=[.?])\s+|\n/).map((x) => x.trim()).filter(Boolean);
}

/** 해요체 끝인가: 끝의 마침표 · 물음표 · 따옴표 · 괄호를 번갈아 떼고 '요'나 '죠'로 끝나야 한다 */
export function endsWithHaeyo(sentence: string): boolean {
  let s = sentence;
  for (let i = 0; i < 6; i++) {
    const t = s.replace(/[.?]+$/g, '').replace(/['"’”』」)\s]+$/g, '');
    if (t === s) break;
    s = t;
  }
  return s.endsWith('요') || s.endsWith('죠');
}
