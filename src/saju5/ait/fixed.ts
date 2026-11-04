// AIT-A · 고정 카드와 고정 줄(생성 문장이 아님).
// 번호 글은 법무 확정안(법무/IF4_메모.md 17장, 2026-10-30)을 그대로 옮겼다. 위로 문구는 마케팅 확정 대기. 번호는 켜는 달 다시 확인(17-3) — 번호는 이 파일 한 곳에만 둔다.
// 카피 23장(앱이 쓰는 글)과 맞춘 줄: 위기 카드 첫 줄(23-5 crisis.l1) · CARD_NOTE(23-4-5 cardNote) · STORAGE_NOTE(23-13-1 privacy.keep '받은 날부터'). 폭력 · 거절 · 미성년 줄은 처음부터 같았다.
// 위기 · 폭력 카드를 보여 주는 턴은 업체 호출 0 · 무과금 · 판정 저장 0 · 이력에 원문 안 넣음(IC4-47 · AC-34).
// 1577-0199는 넣지 않는다(팀장 판단 · D-228과 같게). 1388은 미성년 감지 카드에만 쓴다(만 24세 이상 가입이라 위기 카드에는 109 · 112 · 119 · 1366).
// 쓰지 않는 말(법무 17-2): 무료 · 전문 상담사 · 곧 연결 · 비밀 완전 보장 — 공식 쪽에서 확인하지 못했거나 자격 · 응대를 약속하는 말이라서.

export interface FixedCard {
  id: 'crisis' | 'violence' | 'harm_intent' | 'misuse' | 'minor' | 'session_end' | 'limit_note';
  lines: readonly string[];
  /** 사용자가 고를 수 있는 버튼(앱이 그린다) */
  options: ReadonlyArray<'continue' | 'end'>;
  /** 이 카드가 나온 턴은 횟수를 올리지 않는다 */
  charge: 0;
  /** 확정이 남은 곳 */
  pending: readonly string[];
  /** 겹침 카드(safety.ts): 이 카드에 확정 줄을 덧붙인 다른 갈래 카드 id(위기 + 폭력이면 ['violence']) */
  also?: readonly FixedCard['id'][];
}

export const PENDING_NOTE = '번호 글은 법무 17장 확정(켜는 달 다시 확인) · 위로 문구는 마케팅 확정 대기';

/** 공식 쪽에서 확인한 안내 줄(법무 17-2 확정안) */
export const LINE_109 = '마음이 많이 힘들 때는 자살예방 상담전화 109에 전화해 보세요. 24시간 받아요. 연결이 늦으면 다시 걸어 주세요.';
export const LINE_112_119 = '지금 바로 위험하다면 기다리지 말고 112나 119에 연락해 주세요.';
export const LINE_1366 = '폭력이나 스토킹, 데이트폭력 때문에 힘드시면 1366(여성긴급전화)에 도움을 청할 수 있어요. 남성도 이용할 수 있고, 24시간 받아요.';
export const LINE_112 = '지금 위험하다면 112에 바로 연락해 주세요.';
export const LINE_1388 = '힘든 일이 있다면 가까운 어른이나 청소년전화 1388에 이야기해 보세요. 24시간 받아요. 휴대전화로는 지역번호를 붙여 걸어요.';

const NUMBER_PENDING = '번호 글 확정(법무 17장) — 켜는 달 다시 확인';

export const CRISIS_CARD: FixedCard = {
  id: 'crisis',
  lines: [
    '혹시 많이 힘든 마음이라면 혼자 견디지 않아도 돼요.',
    LINE_109,
    LINE_112_119,
    '저희가 전화 상담을 대신하지 않아요. 지금 안전하세요?',
  ],
  options: ['continue', 'end'],
  charge: 0,
  pending: [NUMBER_PENDING, '위로 문구 — 마케팅'],
};

export const VIOLENCE_CARD: FixedCard = {
  id: 'violence',
  lines: [
    '그런 일이 있었다면 많이 힘드셨을 거예요. 이 이야기는 안전이 먼저예요.',
    LINE_1366,
    LINE_112,
    '상대를 이해하려고 애쓰지 않아도 돼요.',
  ],
  options: ['continue', 'end'],
  charge: 0,
  pending: [NUMBER_PENDING, '위로 문구 — 마케팅'],
};

/** 가해 의도 카드(법무 17-3 Q4 · 마케팅 23-13-4 `CONCERN_CARD.harm`): 자기 뜻으로 해치고 싶다는 말. 112 + 109만 쓰고 1366(피해자용)과 폭력 카드 4번째 줄('상대를 이해하려고 …')은 넣지 않는다 */
export const HARM_INTENT_CARD: FixedCard = {
  id: 'harm_intent',
  lines: [
    '지금 마음이 많이 격해졌나 봐요',
    '잠깐 그 자리에서 벗어나 숨을 고르셔도 돼요.',
    LINE_112,
    LINE_109,
    '저희가 전화 상담을 대신하지 않아요.',
  ],
  options: ['continue', 'end'],
  charge: 0,
  pending: [NUMBER_PENDING, '글 확정 — 마케팅 23-13-4(법무 확인: 상담 아님 앞 문장만으로 조건 #5)'],
};

/** 겹침 카드 위로 줄(마케팅 23-13-4): 덧붙는 확정 번호 줄 바로 위에 한 줄 */
export const BRIDGE_VIOLENCE = '함께 말씀해 주신 일이 걱정돼서, 아래 안내도 같이 드려요.';
export const BRIDGE_MINOR = '여기서 이야기를 이어 가기는 어려워서, 도움받을 곳을 하나 더 알려 드려요.';

export const MISUSE_CARD: FixedCard = {
  id: 'misuse',
  lines: [
    '그 방법은 도와드리기 어려워요. 상대 몰래 하거나 상대를 힘들게 하는 일은 돕지 않아요.',
    '대신 지키고 싶은 선이 무엇인지, 상대에게 직접 어떻게 말할 수 있을지 같이 정리해 볼 수 있어요.',
  ],
  options: ['continue', 'end'],
  charge: 0,
  pending: ['문구 — 마케팅 · 법무'],
};

export const MINOR_CARD: FixedCard = {
  id: 'minor',
  lines: [
    '이 서비스는 성인이 쓰는 서비스예요. 여기서는 이야기를 이어 갈 수 없어요.',
    LINE_1388,
  ],
  options: ['end'],
  charge: 0,
  pending: [NUMBER_PENDING, '위로 문구 — 마케팅'],
};

export const SESSION_END_CARD: FixedCard = {
  id: 'session_end',
  lines: ['여기까지 정리해 드렸어요. 이 이야기는 여기서 마쳐요. 새 고민이 생기면 새로 시작할 수 있어요.'],
  options: ['end'],
  charge: 0,
  pending: ['문구 — 마케팅'],
};

/** 화면 상시 한 줄(접힘 밖) — 법무 17-2 확정안(119 추가는 팀장 판단) */
export const ALWAYS_LINE = '위급하면 112 · 119, 마음이 힘들면 109, 폭력 피해는 1366';

/** 챗봇 매 결론 · 첫 화면 끝줄 — 법무 4-6-1 */
export const CHAT_FOOTER = 'AI가 쓴 글이에요. 상담이나 진단, 치료가 아니에요. 중요한 결정은 직접 하시고, 힘들면 전문기관과 이야기해 보세요.';
/** 보안 권고 ③ 상시 표시 */
export const CHAT_GUESS_NOTE = 'AI의 추측이에요. 상대의 마음은 상대만 알아요. 들려주신 이야기 안에서 본 해석이에요.';
/** 카드 근거 없이 말씀하신 내용만으로 본 문장에 붙이는 표시 */
export const WEAK_LABEL = '카드로 받치지 못해서, 말씀하신 내용만으로 본 해석이에요.';
/** 실무 모델 카드(K-8 · K-9; K-7은 AI 검증에서 빠짐)에 붙이는 표시 */
export const PRACTICAL_LABEL = '연구보다는 실무에서 쓰는 방법이에요.';
/** 카드 근거 표시 아래 고정 한 줄 */
export const CARD_NOTE = '이 설명은 일반적인 연구 개념이에요. 이번 이야기 속 상대에게 그대로 맞는다는 뜻은 아니에요.';
/** 금전 요구 · 송금 정황이 있는 턴에 붙이는 주의 문구 */
export const MONEY_CAUTION = '돈을 보내 달라는 이야기는 이유가 무엇이든 멈추고, 가까운 분이나 공식 기관과 먼저 상의해 보세요.';
/** 마음이 많이 힘들다는 칩을 골랐을 때 위로 한 줄 + 도움 안내(진단 아님) */
export const SOFT_HELP_LINES: readonly string[] = [
  '많이 힘드시군요. 말씀해 주셔서 고마워요.',
  LINE_109,
];

/** 질문 칸만 형식 규칙에 걸려 떨어졌을 때 서버가 대신 다는 단계별 고정 질문(AI-FIX3 · S1 S2 S4만 질문이 필수). 글은 마케팅 확정 대기 */
export const FALLBACK_QUESTION: Readonly<Record<'S1' | 'S1_CONFIRM' | 'S2' | 'S4', string>> = {
  S1_CONFIRM: '이 한 줄이 지금 마음과 맞나요?',
  S1: '지금 가장 마음에 걸리는 일이 무엇인지 한 줄로 들려주실 수 있나요?',
  S2: '방금 이야기에서 더 말하고 싶은 부분이 있나요?',
  S4: '지금 이 일에서 가장 마음에 남는 부분은 무엇인가요?',
};

/** 헤어질지 · 점수를 정해 달라는 말에 모델이 거절 문장을 못 냈을 때 서버가 앞에 붙이는 한 줄(AI-FIX2 A7). 글은 마케팅 확정 대기 — 모델이 평가에서 스스로 낸 말과 같은 꼴 */
/** 위기 카드 뒤 첫 일반 턴의 맨 앞에 한 번 붙는 고정 점검 한 줄(AI-FIX4 R-a · 독립 채점 R-a 안 1). 글은 마케팅 · 법무 확인 대기 — 모델이 쓰지 않는 고정 글이다 */
export const CRISIS_CHECK_LINE = '지금 마음은 어떠세요? 많이 힘들다면 아래 번호로 바로 이야기해도 돼요.';
/** 입력 판정(judge.ts)이 두 번 다 실패해 챗봇으로 보내지 않고 닫을 때의 고정 한 줄(AI-FIX5 D1, `timeout` 코드로 나가며 턴은 차감 0). 글은 초안 — 마케팅 · 법무 확인 대기. 앱은 `timeout` 코드 문구로도 같은 뜻을 보여 준다 */
export const JUDGE_RETRY_LINE = '확인을 마치지 못했어요. 이번 시도는 횟수에 넣지 않으니 한 번만 다시 보내 주세요.';
export const VERDICT_NOTE = '그 결정은 제가 대신 내릴 수 없어요.';
/** 코치 글에 연락처 · 링크가 있어 서버가 가렸을 때 붙이는 고정 한 줄(AI-FIX2 A6). 글은 마케팅 확정 대기 */
export const CONTACT_NOTE = '연락처나 링크는 소개글에 쓸 수 없어요. 가린 채로 봐 드렸어요.';
export const COACH_NOTE = 'AI가 쓴 제안이에요. 마음에 드는 것을 골라 내가 직접 고쳐 쓰세요. 자동으로 바뀌지 않아요.';
export const COMPAT_NOTE = 'AI가 쓴 글이에요. 두 분이 모두 공개한 같은 값으로만 만들었어요.';
export const FUN_FOOTER = '재미로 보는 이야기예요.';

/** 저장 문구 — 법무 16-3: '저장 안 해요'만 쓰면 AI 업체 30일 보관을 가려 오인하게 하므로 두 문장을 함께 쓴다 */
export const STORAGE_NOTE = '운영 서버에는 저장하지 않아요. AI 업체에는 받은 날부터 30일 안에 지워질 때까지 남아요.';

/** 시험자 안내 2줄(법무 16-2: 명예 · 실명) — 마케팅 카피 `AIT.consent.noSend` · `AIT.consent.name` 과 같은 글(AI-FIX1, 마케팅/FA1/QF2_글표.md).
 *  옛 첫 줄 '상대의 마음 건강은 추정하지 않아요.'(A-13)는 카피에 대응 줄이 없고 화면에 안 나와 지웠다. 건강 추정 금지는 지시문 '건강 추정 기준'과 출력 검사(c_symptom)가 그대로 지킨다. */
export const TESTER_NOTICE_LINES: readonly string[] = [
  '결과를 캡처해서 다른 사람에게 보내거나 올리지 말아 주세요.',
  '다른 사람의 이름, 직장, 학교, 연락처는 적지 마세요.',
];

/** 입력 화면 안내(법무 4-6-4 #1) — 마케팅 카피 `CONCERN.notice.*` · `AIT.privacy.send` · `AIT.privacy.keep` 과 같은 글(AI-FIX1). 따옴표는 카피 규칙대로 작은따옴표 */
export const INPUT_NOTICE_LINES: readonly string[] = [
  "상대의 이름, 직장, 학교, 연락처, SNS는 적지 마세요. 그냥 '상대'라고만 써 주세요.",
  '사진이나 대화 화면 캡처는 올릴 수 없어요. 필요한 말만 적어 주세요.',
  '여기에 적은 글은 미국의 AI 업체로 전달돼요.',
  STORAGE_NOTE,
  "상대가 한 말은 아래 '상대가 보낸 말' 칸에 따로 적어 주세요.",
];

/** 챗봇 첫 화면 안내(AI 표시 · 상담 아님) — 마케팅 카피 `CONCERN.intro.lead` · `CONCERN.intro.notCounsel` · `CONCERN.footer` 와 같은 글(AI-FIX1; 옛 이름 'AI 고민 정리'는 지금 '연애 고민 정리') */
export const CHAT_INTRO_LINES: readonly string[] = [
  'AI와 함께 고민을 다섯 단계로 정리하고 마쳐요.',
  '여기는 상담이 아니에요. 있었던 일을 정리해 보는 곳이에요.',
  CHAT_FOOTER,
];

/** 챗봇 첫 화면의 열린 질문(미리 쓴 글 — 모델 호출이 아니다. 사용자의 첫 글이 오면 그때 첫 호출) */
export const OPENING_QUESTION = '요즘 어떤 일이 마음에 걸리세요? 있었던 일을 편하게 적어 주세요.';
