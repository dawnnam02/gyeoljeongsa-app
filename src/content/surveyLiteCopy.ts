// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 테스트용 짧은 설문(04) · 사진 등록(05)의 글. 본인 지시 2026-10-15 "설문조사 파트도 테스트를 위해서 짧게 임의로 만들어서 넣어줘".
//  · 문항 12개는 기획/설문_문항표.csv 의 행을 글자 그대로 옮겼다(질문 · 입력형태 · 선택지 · 필수 · 공개기본값 · 매칭사용 · 민감).
//  · 화면 글은 마케팅/카피.md 04 · 05 '→ 개선안' · 4장 공통 문구, 없으면 기획/화면_요구사항.md 6장 N문구 그대로다.
//  · 맨 아래 SURVEY_LITE_DRAFT(순위 접근성 이름 · 테스트 화면 안내)는 B7 에서 마케팅이 확정했다(카피.md 04 · 05, 대조 대상).
// 이 파일은 다른 파일을 가져오지 않는다(Node 가 바로 읽어 원본과 대조할 수 있게, copy.ts 와 같은 방식).
// 시험 src/__tests__/surveyLiteCopy.test.tsx 가 CSV · 카피.md · 화면_요구사항.md 와 글자 그대로 같은지 본다.

// 임시판 12문항(CSV 행 그대로). 입력형태 11종이 모두 한 번 이상 나온다.
//  04(설문 10쪽): A01 날짜 · A03 지역 · A05 숫자 · B01 선택 · C05 구간 · D03 선택(답하지 않음) · E08 척도 · E13 순위 · T01 텍스트 · F01 범위
//  05(사진 등록): G01 사진 · G03 복수 선택
export const LITE_QUESTIONS = [
  { id: 'A01', section: 'A', question: '생년월일을 알려 주세요', type: '날짜', options: '1950-01-01 ~ 오늘 기준 만 24세 생일이 지난 날짜', required: '예', visibility: '공개', matching: '조건', sensitive: '아니오' },
  { id: 'A03', section: 'A', question: '지금 사는 지역을 알려 주세요', type: '지역', options: '시·도 17개 → 시·군·구(행정구역 목록)', required: '예', visibility: '공개', matching: '조건', sensitive: '아니오' },
  { id: 'A05', section: 'A', question: '키를 알려 주세요', type: '숫자', options: '130~220 cm', required: '예', visibility: '공개', matching: '조건', sensitive: '아니오' },
  { id: 'B01', section: 'B', question: '최종 학력을 선택해 주세요', type: '선택', options: '고졸 이하 / 전문대졸 / 대졸 / 석사 / 박사', required: '예', visibility: '공개', matching: '조건', sensitive: '아니오' },
  { id: 'C05', section: 'C', question: '연봉 구간을 선택해 주세요', type: '구간', options: '3천만 미만 / 3천만~5천만 / 5천만~7천만 / 7천만~1억 / 1억~2억 / 2억 이상 / 답하지 않음', required: '예', visibility: '구간', matching: '조건', sensitive: '예' },
  { id: 'D03', section: 'D', question: '부모님 중 더 높은 학력을 선택해 주세요', type: '선택', options: '고졸 이하 / 전문대졸 / 대졸 / 대학원졸 / 답하지 않음', required: '예', visibility: '구간', matching: '조건', sensitive: '예' },
  { id: 'E08', section: 'E', question: '스스로 얼마나 외향적인가요?', type: '척도', options: '1=매우 내향적 / 5=매우 외향적', required: '예', visibility: '비공개', matching: '성향', sensitive: '아니오' },
  { id: 'E13', section: 'E', question: '삶에서 중요한 것의 순서를 정해 주세요', type: '순위', options: '가족 / 일 / 돈 / 신앙 / 여가', required: '예', visibility: '비공개', matching: '성향', sensitive: '아니오' },
  { id: 'T01', section: 'T', question: '나를 소개한다면 어떤 사람인가요?', type: '텍스트', options: '자유 입력 20~300자', required: '예', visibility: '비공개', matching: '성향', sensitive: '아니오' },
  { id: 'F01', section: 'F', question: '원하는 상대의 나이 차를 정해 주세요', type: '범위', options: '연하 최대 0~15세 / 연상 최대 0~15세 / 상관없음', required: '예', visibility: '비공개', matching: '조건', sensitive: '아니오' },
  { id: 'G01', section: 'G', question: '사진 3장을 올려 주세요', type: '사진', options: '얼굴 정면 1장 / 전신 1장 / 자유 1장', required: '예', visibility: '공개', matching: '외모', sensitive: '아니오' },
  { id: 'G03', section: 'G', question: '평소 스타일을 모두 골라 주세요', type: '복수 선택', options: '단정 / 캐주얼 / 활동적 / 클래식 / 미니멀', required: '아니오', visibility: '공개', matching: '미사용', sensitive: '아니오' },
] as const;

// 04 설문(카피.md 04 · 화면_요구사항 04 · N03 · N04 · N05 · N08 · N12)
export const SURVEY_LITE = {
  headerTitle: '설문',
  tempSave: '임시 저장',
  chips: ['기본', '학력', '직업', '가족', '성향', '희망'],
  // 쪽 표시 "{칩} · {칩 안 순번} / {칩 안 쪽 수}"(카피 04 '기본 · 3 / 11')
  stepLabel: (chip: string, index: number, total: number) => `${chip} · ${index} / ${total}`,
  sidoPlaceholder: '시·도',
  sigunguPlaceholder: '시·군·구',
  quickSido: ['서울', '경기', '인천', '부산', '대구', '대전', '광주'],
  quickOther: '그 외',
  // 공개 범위 한 줄: '공개' 문항
  publicLine: '이 항목은 상대에게 보여요.',
  // 08 에 토글이 있는 문항에만 뒤에 붙인다(카피 04 · N04)
  toggleSuffix: '프로필에서 바꿀 수 있어요.',
  // N04: '구간' · '비공개(추천에 쓰임)' · '비공개(추천에 안 쓰임)'
  rangeLine: '이 항목은 구간으로만 보여요.',
  hiddenUsedLine: '이 항목은 상대에게 보이지 않아요. 짝을 고를 때만 쓰여요.',
  hiddenLine: '이 항목은 상대에게 보이지 않아요.',
  // 부모님(D) 블록 맨 위 배너 · D03 · D04 아래 한 줄(동의문구 5-3, 카피 04)
  parentBanner: "부모님 정보는 부모님 본인의 정보예요. 이름과 연락처는 쓰지 말고, 구간이나 범주로만 알려 주세요. 답하고 싶지 않으면 '답하지 않음'을 고르면 돼요.",
  parentRangeLine: '이 항목은 구간으로, 처음에 다른 분에게 보여요. 프로필에서 끌 수 있어요.',
  // 직접 쓰는 질문(T) 위(동의문구 5-3, 카피 04)
  freeTextGuide: '직접 쓴 글은 AI가 읽고 성향을 정리해요. 이름, 전화번호, 이메일, 링크, 종교·건강처럼 민감한 내용은 쓰지 마세요. 알아볼 수 있는 부분은 가려서 보내지만 모두 가려지지는 않아요.',
  savedToast: '임시 저장했어요.',
  prev: '이전',
  next: '다음',
  required: '이 질문에 답해 주세요.',
  regionRequired: '지역을 골라 주세요.',
  saveFailed: '저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
  resume: '작성하던 곳에서 이어서 시작해요.', // N03
  rankConfirm: '이 순서로 할게요', // N05
  minChars: (n: number) => `${n}자 이상 써 주세요.`, // N08
  maxChars: (n: number) => `${n}자까지 쓸 수 있어요.`, // N08
  missing: '아직 답하지 않은 질문이 있어요.', // N12
  counter: (current: number, max: number) => `${current}/${max}`, // 화면_요구사항 04 텍스트 '{지금}/{최대}'
} as const;

// 05 사진 등록(카피.md 05, 안내 박스 5줄 순서는 동의문구 5-4)
export const PHOTOS_LITE = {
  headerTitle: '사진 등록',
  title: '사진 3장을 올려 주세요',
  subtitle: '얼굴 정면 1장, 전신 1장, 자유 1장이에요. 운영팀이 확인한 뒤에 공개돼요.',
  slots: { face: '얼굴 정면', full: '전신', free: '자유' },
  guideLines: [
    '• 선글라스·모자 없이 찍은 사진',
    '• 최근 6개월 안에 찍은 사진',
    '• 다른 분의 얼굴이 나오지 않는 사진',
    '• 연락처나 광고가 보이지 않는 사진',
    '• 외모는 AI가 평가하지 않아요',
  ],
  styleLabel: '스타일 (여러 개 고를 수 있어요)',
  internalNote: '운영팀은 사진이 안내에 맞는지만 확인해요. 외모를 평가하거나 점수를 매기지 않아요. AI는 사진을 보지 않아요.', // R-A(D-199 · QP-08): 법무 동의문구 5-4 하단 안내(D-45) 글 그대로 — 옛 '추천 계산에 쓰는 내부 평가 정보' 글 지움
  finish: '올리고 설문 마치기',
  permissionAsk: '사진을 고르려면 사진 접근 권한이 필요해요. 올리려고 고른 사진만 사용해요.',
  permissionDenied: '사진 접근을 허용하지 않으면 사진을 올릴 수 없어요. 설정에서 언제든 바꿀 수 있어요.',
  uploadFailed: '사진을 올리지 못했어요. 연결을 확인하고 다시 올려 주세요.',
  // {형식} · {용량} 은 앱이 정한 값(서버는 JPEG · 10MB, 앱이 JPEG 로 바꿔 올린다)
  badPhoto: (format: string, size: string) => `올릴 수 없는 사진이에요. ${format}, ${size} 이하 사진을 올려 주세요.`,
  needThree: '사진 3장을 모두 올려야 설문을 마칠 수 있어요.',
  reupload: '올리기', // N11 다시 올리기 상태(08 반려 배지에서 들어옴)의 버튼
} as const;

// 공통 문구(카피.md 4장)
export const LITE_COMMON = {
  loading: '불러오는 중이에요',
  offline: '인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.',
  server: '잠시 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.',
  retry: '다시 시도',
  confirm: '확인',
  cancel: '취소',
} as const;

// 원본 문서에 아직 없는 글(가안). 화면 글이 아니라 스크린리더 이름과 데모 모드 안내뿐이다. 마케팅 확인 대기(F2L 통합목록 5장).
// 이름은 그대로 두었지만 이제 가안이 아니다: 마케팅 B7 확정(카피.md 04 · 05, 세부계획 D-48 '가안 글 3줄은 마케팅 확정본')
export const SURVEY_LITE_DRAFT = {
  rankUp: (item: string) => `${item} 위로 옮기기`, // [확정] 카피.md 04 순위 문항 · 위로 버튼 스크린리더 이름(B7)
  rankDown: (item: string) => `${item} 아래로 옮기기`, // [확정] 카피.md 04 순위 문항 · 아래로 버튼 스크린리더 이름(B7)
  demoPhotoNote: '테스트 화면이에요. 칸을 누르면 예시 그림이 들어가요. 실제 사진은 고르지도 올리지도 않아요.', // [확정] 카피.md 05 테스트 화면 · 사진 칸 위 한 줄(B7)
} as const;
