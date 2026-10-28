// 설문 v2(F20) 화면 글 — 문항 밖 글(공통 · 시작 · 검토 · 섹션 머리 · 오류). 문항 글은 questionCopy.ts(같은 원본에서 만든 파일).
//  원본: 마케팅/카피.md 9장 '→ 개선안'(R1 C①, 2026-10-18) · 4장 공통 문구 · 3장 04(임시 저장 · 순위 버튼 이름) · 기획/화면_요구사항.md 6장 N03 · N12.
//  등급 말(declineHint · A06 도움말 · 세부사항 머리)은 카피 16-J L-7 의 세 자리뿐이다. 점수 말 0.
//  카피에 아직 없는 글은 PROPOSED 에만 두고 app/F20_변경기록.md '카피 키 제안'에 적었다(마케팅 확정 뒤 옮긴다).
//  시험 src/__tests__/surveyV2Copy.test.ts 가 카피.md 와 한 글자씩 대조하고 글 규칙(느낌표 0 · 해요체 · 번역투 낱말)을 본다.
//  이 파일은 타입 하나 말고는 다른 파일을 가져오지 않는다.
import type { SectionKey } from './types';

export const SV2 = {
  // 상단 막대 · 저장(카피 3장 04 · 4장)
  headerTitle: '설문',
  tempSave: '임시 저장',
  savedToast: '임시 저장했어요.',
  saveFailed: '저장하지 못했어요. 다시 시도해 주세요.', // 9장: PROFILE.saveFailed 재사용
  resume: '작성하던 곳에서 이어서 시작해요.', // N03
  missing: '아직 답하지 않은 질문이 있어요.', // N12
  loading: '불러오는 중이에요',
  offline: '인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.',
  server: '잠시 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.',
  retry: '다시 시도',
  rankUp: (item: string) => `${item} 위로 옮기기`, // 카피 3장 04(B7 확정)
  rankDown: (item: string) => `${item} 아래로 옮기기`,

  intro: {
    title: '설문은 10분쯤 걸려요',
    points: [
      '마지막 두 단계는 쓰고 싶은 만큼만 써도 돼요.',
      '답이 정확할수록 나와 맞는 분을 고르기 쉬워져요.',
      '중간에 나가도 답은 저장돼요.',
      '문항마다 다른 분에게 보이는지 적어 두었어요.',
      '학교 · 직업 · 자산은 나중에 서류로 인증할 수 있어요.',
    ],
    start: '시작하기',
  },

  common: {
    any: '상관없어요',
    decline: '말하고 싶지 않아요', // 고르는 보기(입말)
    declinedValue: '답하지 않음', // survey.common.declinedValue — 카피 20장(3부-아 · QP-35): 답 확인(검토)에 보이는 결과 말. 동의 카드 · 확인창 · 법무 글과 같은 말
    unknown: '잘 몰라요',
    declineHint: '답하면 등급이 오를 수 있어요.',
    skip: '건너뛰기',
    next: '다음',
    prev: '이전',
    private: '비공개',
    vis: {
      private: '다른 분에게는 보이지 않아요.',
      bucket: '다른 분에게는 구간으로만 보여요. 내 프로필에서 끌 수 있어요.',
      public: '다른 분이 보는 내 프로필에 보여요.',
      toggle: '내 프로필에서 끌 수 있어요.',
    },
    sensitive: '민감한 정보예요. 다른 분에게 보일지는 직접 정해요.',
    sensitivePrivate: '민감한 정보예요. 다른 분에게는 보이지 않아요.',
    noAi: 'AI에 보내지 않아요.',
    aiBox: 'AI가 이 글을 읽고 정리해요. 이름이나 연락처는 빼 주세요.',
    count: (n: number, max: number) => `${n}/${max}`,
    chars: (now: number, max: number) => `${now}/${max}`,
    progressA11y: (n: number, total: number) => `설문 진행, ${n}/${total}`,
  },

  E13keepOrder: '이대로 괜찮아요',
  F13pickedA11y: (label: string, n: number) => `${label}, ${n}번째로 골랐어요`,
  unitCm: 'cm',
  F02range: (min: number, max: number) => `${min}~${max} cm`,
  F01: {
    younger: (n: number) => `나보다 어린 쪽 ${n}살까지`,
    older: (n: number) => `나보다 많은 쪽 ${n}살까지`,
    zeroYounger: '어린 쪽은 동갑까지',
    zeroOlder: '많은 쪽은 동갑까지',
  },
  A03step: { sido: '시·도', sigungu: '시·군·구' },

  search: {
    placeholder: '학교 이름을 쳐 보세요',
    empty: '찾는 학교가 목록에 없어요. 아래에서 골라 주세요.',
    change: '바꾸기',
    oldName: (name: string) => `(옛 이름 ${name})`,
  },
  story: { title: '결혼 이야기를 나눠 주세요', count: (n: number) => `${n}/3`, preview: '상대에게 이렇게 보여요' },
  appeal: {
    title: '나를 더 보여 주세요',
    upload: '증빙 올리기',
    toReview: '답 확인하기',
    proof: { none: '증빙 없음', pending: '확인 중', ok: '확인됨', retry: '다시 올려 주세요' },
  },
  review: {
    title: '답을 확인해 주세요',
    lead: "주제별로 모아 두었어요. 바꿀 답은 '고치기'를 눌러 주세요.",
    edit: '고치기',
    submit: '제출하고 사진 올리기',
    warnLead: '한 번 더 볼 답이 있어요. 맞으면 그대로 제출해도 돼요.',
    skipped: '건너뛰었어요. 내 프로필에서 나중에 쓸 수 있어요.',
  },
  warn: {
    W1: '키가 맞는지 한 번만 확인해 주세요.',
    W2: '소득 구간이 맞는지 확인해 주세요.',
    W3: '최종 학력과 학교가 맞는지 확인해 주세요.',
    W4: '질문마다 다른 이야기를 써 주세요.',
    W5: '두 답이 서로 달라 보여요. 맞는지 한 번만 봐 주세요.',
  },
  error: {
    required: '답을 골라 주세요.',
    requiredText: '답을 써 주세요.',
    minChars: (n: number) => `${n}자 이상 써 주세요.`,
    maxChars: (n: number) => `${n}자까지 쓸 수 있어요.`,
    name: '한글 2~10자로 써 주세요.',
    maxPick: (n: number) => `${n}개까지 고를 수 있어요.`,
    anyAlone: "'상관없어요'는 다른 보기와 함께 고를 수 없어요.",
    minMax: '최소가 최대보다 커요. 다시 맞춰 주세요.',
    region: '시·군·구까지 골라 주세요.',
    rankTouch: "순서를 바꾸거나 '이대로 괜찮아요'를 눌러 주세요.",
  },
} as const;

// 섹션 이름 · 머리 한 줄(카피 9장 `survey.section.{key}.name` / `.lead`)
export const SECTION_COPY: Readonly<Record<SectionKey, { readonly name: string; readonly lead: string }>> = {
  basic: { name: '기본', lead: '나를 알리는 기본 정보예요.' },
  edu: { name: '학력', lead: '마지막으로 다닌 과정을 기준으로 물어요.' },
  job: { name: '직업', lead: '지금 하는 일을 물어요.' },
  money: { name: '경제', lead: '소득과 자산은 구간으로 받아요. 다른 분에게 보일지는 직접 정해요.' },
  family: { name: '가족', lead: "부모님 정보는 '말하고 싶지 않아요'를 골라도 돼요." },
  life: { name: '생활', lead: '평소 생활 습관을 물어요.' },
  values: { name: '가치관', lead: '정답은 없어요. 나와 가까운 쪽을 골라 주세요.' },
  marriage: { name: '결혼관', lead: '그리는 결혼 생활을 물어요. 프로필에 보일지는 문항마다 직접 정해요.' },
  wish: { name: '희망 조건', lead: '만나고 싶은 분의 조건을 정해요. 다른 분에게는 보이지 않아요.' },
  story: { name: '결혼 이야기', lead: '마음 가는 질문을 골라 답하면 프로필에 보여요. 3개까지 쓸 수 있어요.' },
  appeal: {
    name: '세부사항',
    lead: '나를 더 보여 줄 것이 있으면 적어 주세요. 쓴 내용은 AI가 읽고 등급 계산에 참고해요. 증빙을 올리면 더 정확하게 반영돼요. 다른 분에게는 보이지 않아요.',
  },
};

// 카피에 아직 없는 글(카피 키 제안 — app/F20_변경기록.md '카피 키 제안'). 마케팅이 확정하면 위로 옮기고 여기서 지운다
export const PROPOSED = {
  minusA11y: (label: string) => `${label} 줄이기`, // survey.common.minusA11y(label) — [−] 스크린리더 이름
  plusA11y: (label: string) => `${label} 늘리기`, // survey.common.plusA11y(label) — [+] 스크린리더 이름
  rangeError: (min: number, max: number) => `${min}~${max} 사이로 맞춰 주세요.`, // survey.error.range(min, max) — 키 · 나이 차 범위 밖(막는 검증)
  F01younger: '나보다 어린 쪽', // survey.F01.youngerLabel — 양끝 첫 줄 이름(9장 younger(n) 글의 앞부분)
  F01older: '나보다 많은 쪽', // survey.F01.olderLabel
  F02min: '최소', // survey.F02.minLabel — error.minMax 글과 같은 낱말
  F02max: '최대', // survey.F02.maxLabel
} as const;
