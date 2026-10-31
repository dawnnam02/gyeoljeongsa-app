// AIT-A · 낱말 사전 초안 — AI를 부르기 전에 서버가 먼저 거르는 말들.
// 초안이다. 위기 · 폭력 · 스토킹 사전은 기획 · 법무 확정 전(보안 AC-34), 과탐지율은 대조 코퍼스로 적어야 한다.
// 비교는 DB `private.lounge_help_hit` 와 같은 방식이다: 앞 4,000자 → NFKC → 소문자 → 글자 · 숫자 · 한글만 남기고 → 부분 일치.

/** DB `lounge_help_terms` 17개 그대로(backend/migrations/0042_lounge.sql 212 ~ 214줄). 시드와의 일치는 시험이 확인한다 */
export const CRISIS_TERMS_DB: readonly string[] = [
  '자살', '자해', '죽고싶', '죽고 싶', '살기싫', '살기 싫', '사라지고싶', '사라지고 싶', '극단적선택', '극단적 선택',
  '목숨을끊', '목숨을 끊', '스스로목숨', '뛰어내리고싶', '뛰어내리고 싶', '손목을긋', '유서를',
];

/** 대화형 서술에 맞춘 확장 초안(은유 · 영어). 일상 말투 오탐이 큰 '죽겠다' 류는 넣지 않았다. 법무 확정 대기 */
export const CRISIS_TERMS_EXT: readonly string[] = [
  '죽어버리고싶', '죽고만싶', '죽는게나을', '더이상살수없', '더이상살고싶지', '살고싶지않', '살아갈이유가없',
  '삶을끝내', '생을마감', '세상을떠나고싶', '세상에서사라지고싶', '목을매', '투신', '자결', '약을다먹', '번개탄',
  'killmyself', 'suicide', 'wanttodie', 'endmylife',
];

/** 폭력 · 스토킹 피해 호소 초안(법무 확정 대기). 걸리면 1366 · 112 고정 카드 + 안전 트랙 */
export const VIOLENCE_TERMS: readonly string[] = [
  '때렸', '때리고', '때려서', '때리려', '손찌검', '뺨을맞', '뺨을때', '발로찼', '발로차', '목을졸', '졸랐', '멱살',
  '물건을던', '물건을부', '폭행', '폭력을', '폭력당', '데이트폭력', '교제폭력', '가정폭력', '협박', '죽이겠', '죽여버', '해치겠',
  '칼로', '흉기', '성폭력', '성폭행', '강간', '강제추행', '불법촬영', '몰카', '유포하겠', '영상을뿌', '사진을뿌',
  '스토킹', '스토커', '미행', '따라다니', '쫓아다니', '집앞에찾아', '집앞에서기다', '도청', '위치추적당', '감시당',
  '헤어지면죽', '헤어지면해치', '헤어지면가만',
];

/** 조종 · 감시 · 복수 · 신상 캐기 요청(질문자가 하려는 쪽). 글자 · 숫자 · 한글만 남긴 문자열에 거는 정규식 */
export const MISUSE_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'secret_peek', re: /몰래.{0,8}(?:보고|볼래|볼까|봐|확인|열어|알아|따라|읽|훔쳐|추적|감시|녹음|촬영|캐|뒤져|뒤지|들여다|엿보|들어가)/ },
  { id: 'location_track', re: /위치(?:를)?추적|gps(?:를)?(?:달|심|몰래)|위치공유(?:를)?몰래/ },
  { id: 'phone_search', re: /(?:휴대폰|핸드폰|폰)(?:을)?(?:검사|뒤져|뒤지|열어보|몰래)/ },
  { id: 'account_snoop', re: /(?:카톡|메신저|sns|인스타|계정)(?:을|를)?(?:몰래|뒤져|해킹)|비밀번호(?:를)?(?:알아내|풀어|해킹)/ },
  { id: 'revenge', re: /복수(?:하|해|할|를)|보복(?:하|해|할)|앙갚음/ },
  { id: 'shame_spread', re: /망신(?:을)?(?:주|시키|당하게)|소문(?:을)?(?:내|퍼뜨)|사진(?:을)?(?:퍼뜨|뿌리)|폭로(?:하|해)/ },
  { id: 'manipulate', re: /(?:길들이|조종|가스라이팅)(?:하|해|하는법|할|고싶)|질투(?:를)?(?:유발|나게|하게)|밀당(?:하는법|전략|하는방법)/ },
  { id: 'dox', re: /신상(?:을)?(?:털|캐|찾|알아)|뒷조사|염탐|주소(?:를)?알아내/ },
  { id: 'block_bypass', re: /차단(?:을)?(?:풀|우회)|다른번호로(?:연락|전화|문자)|부계정으로(?:연락|몰래)/ },
];

/** 만 19세 미만으로 읽히는 말(첫 사람 표현만 좁게). 오탐을 줄이려고 좁게 잡았다 */
export const MINOR_PATTERNS: readonly RegExp[] = [
  /(?:저|제가|나|난|내가)(?:는)?(?:중학생|고등학생|중딩|고딩|초등학생|미성년)(?!때|시절|무렵|적|이었|였)/,
  /미성년자(?:예요|입니다|이에요|라서|인데)/,
  /만(?:1[0-8]|[1-9])세/,
];

/** 금전 요구 · 송금 · 투자 정황(보안 권고 ②) — 막지 않고 고정 주의 문구를 붙인다 */
export const MONEY_PATTERNS: readonly RegExp[] = [
  /송금|입금(?:해|하라|부탁)|계좌(?:번호)?(?:를|좀)|돈(?:을)?(?:빌려|보내|달라|좀)|급전|대출(?:을)?(?:받|해)|코인|투자(?:하자|하면|수익|권유)|수익(?:보장|률)/,
];

/** 주입 의심(막지 않고 flags에만 기록 · 사용자 글은 데이터로 감싸 보낸다). 원문 비교 */
export const INJECTION_PATTERNS: readonly RegExp[] = [
  /지침(?:을|들을)?\s*무시|이전\s*(?:지시|지침|명령)|위의?\s*(?:지시|지침)(?:을|를)?\s*무시/,
  /시스템\s*프롬프트|프롬프트(?:를)?\s*(?:보여|알려|출력|공개)|지시문(?:을|를)?\s*(?:보여|알려|출력)/,
  /너는\s*이제|역할(?:을)?\s*바꿔|개발자\s*모드|탈옥/,
  /ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above)|system\s*prompt|jailbreak|developer\s*mode/i,
  /(?:이\s*사람|상대)(?:은|는)?\s*(?:믿을\s*만|안전)(?:하다고|한\s*사람이라고)\s*(?:말해|답해)/,
];

/** 진단 요청(막지 않고 flag) */
export const DIAGNOSIS_REQUEST_PATTERNS: readonly RegExp[] = [
  /나르시|사이코패스|소시오패스|경계선|성격\s*장애|우울증|조울|ADHD|정신\s*병|정신\s*질환|병\s*인가|진단/i,
];

/** 진단을 '묻는' 말인가: 진단 낱말 + 묻는 모양(물음표 · 인가요 · 같 …). 낱말이 지나가듯 나온 것과 구분한다 */
export function hasDiagnosisAsk(text: string): boolean {
  const t = String(text ?? '').normalize('NFKC');
  return hasDiagnosisRequest(t) && /\?|인가요|맞죠|맞나요|아닐까|일까|같나요|같아요|같은데|인 ?거 ?(죠|지)|죠$/.test(t);
}

/** 결론을 정해 달라는 요청(막지 않고 flag) */
export const VERDICT_REQUEST_PATTERNS: readonly RegExp[] = [
  /헤어질까|헤어져야|헤어지는\s*게\s*맞|결혼해도\s*될|결혼할까|정해\s*줘|대신\s*정해|어떻게\s*해야\s*(?:해|할까|하죠)/,
];

/** DB와 같은 키: 앞 4,000자 → NFKC → 소문자 → [0-9a-z가-힣] 만 */
export function crisisKey(text: string): string {
  return String(text ?? '').slice(0, 4000).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function termKey(term: string): string {
  return term.replace(/[^0-9a-z가-힣]/g, '');
}

export function matchesAnyTerm(key: string, terms: readonly string[]): boolean {
  return terms.some((t) => key.includes(termKey(t)));
}

export type HitClass = 'crisis_db' | 'crisis_ext' | 'violence' | 'misuse' | 'minor';

/** 위기 · 폭력 · 오용 · 미성년 낱말 문. 어느 쪽인지만 돌려준다(걸린 낱말 자체는 돌려주지 않는다 — 로그 0) */
export function classifyHit(text: string): HitClass | null {
  const key = crisisKey(text);
  if (matchesAnyTerm(key, CRISIS_TERMS_DB)) return 'crisis_db';
  if (matchesAnyTerm(key, CRISIS_TERMS_EXT)) return 'crisis_ext';
  if (matchesAnyTerm(key, VIOLENCE_TERMS)) return 'violence';
  if (MISUSE_PATTERNS.some((p) => p.re.test(key))) return 'misuse';
  if (MINOR_PATTERNS.some((re) => re.test(key))) return 'minor';
  return null;
}

export function hasMoneyHint(text: string): boolean {
  const key = crisisKey(text);
  return MONEY_PATTERNS.some((re) => re.test(key));
}
export function hasInjectionShape(text: string): boolean {
  const t = String(text ?? '').normalize('NFKC');
  return INJECTION_PATTERNS.some((re) => re.test(t));
}
export function hasDiagnosisRequest(text: string): boolean {
  const t = String(text ?? '').normalize('NFKC');
  return DIAGNOSIS_REQUEST_PATTERNS.some((re) => re.test(t));
}
export function hasVerdictRequest(text: string): boolean {
  const t = String(text ?? '').normalize('NFKC');
  return VERDICT_REQUEST_PATTERNS.some((re) => re.test(t));
}
