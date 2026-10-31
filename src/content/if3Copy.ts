// 재미 기능 2(IF3 · 카피 22장) 글의 앱 사본 — scripts/gen-if3-copy.mjs 가 마케팅/카피.md 22장에서 만든다(손으로 고치지 않는다).
//  · 3부-카(IF3-F 축소판) 41키 + IF5-F1 36키(READ_GUIDE 5 · THREE_PILLARS 22 · MEET_SKY 9) + 22-14 네 키 = 81키 + 3부-차 `SIGN_CUSP`(22-10) 두 줄. check:copy IF3 그룹이 22장 표와 한 글자씩 대조한다.
//  · 쓰지 않는 글(조건부 · 보류): MY_WAYS.off.body · BIRTH_CARD.off.body — 사본에 글만 두고 화면은 쪽이 따로 갈릴 때(MY_WAYS.off.body)만 부른다. BIRTH_CARD.off.body 는 변호사 답 전까지 그리지 않는다.
//  · 이 파일은 check:copy 가 Node 로 바로 읽으므로 경로 별칭 없이 홀로 선다
// 받침이 있으면 앞 글자, 없으면 뒤 글자 — features/inflight/if2Text.josa 와 같은 규칙
const pickJosa = (word: string, a: string, b: string): string => {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? a : b;
};
const JOSA_PAIRS: readonly (readonly [string, string, string])[] = [
  ['을/를', '을', '를'],
  ['이/가', '이', '가'],
  ['은/는', '은', '는'],
  ['과/와', '과', '와'],
];

export const SIGN_CUSP = {
  // 카피 22-10 `SIGN_CUSP.pair` = '{별자리 이름}{과/와} {별자리 이름} 사이에 태어났어요.' — 조사는 받침으로
  pair: (a: string, b: string) => `${a}${pickJosa(a, '과', '와')} ${b} 사이에 태어났어요.`,
  why: '해마다 경계가 하루쯤 달라서 두 별자리를 함께 보여 드려요.',
} as const;

export const IF3_TEXT = {
  'FUN.aiNote': '이 화면의 글은 생성형 AI로 미리 써 두었어요.',
  'READ_GUIDE.title': '읽는 법',
  'READ_GUIDE.lead': '별자리, 오행, 카드에 나오는 낱말이 무슨 뜻인지 쉬운 말로 풀어 놓았어요.',
  'READ_GUIDE.a11y.open': '읽는 법 펼치기',
  'READ_GUIDE.a11y.close': '읽는 법 접기',
  'READ_GUIDE.a11y.entry': '{낱말}, {풀이}',
  'SKY_WEEK.title': '창밖 하늘',
  'SKY_WEEK.lead': '이번 주 달 모양과 절기를 있는 그대로 적었어요.',
  'SKY_WEEK.period': '{시작 날짜} ~ {끝 날짜}',
  'SKY_WEEK.a11y': '창밖 하늘, {한 줄}',
  'SKY_BOOK.title': '하늘 도감',
  'SKY_BOOK.lead': '별자리와 카드에 담긴 이야기를 실었어요. 처음부터 모두 열려 있어요.',
  'SKY_BOOK.section.sign': '별자리',
  'SKY_BOOK.signNote': '해가 머무는 때를 달력 차례대로 놓았어요. 순서에 뜻은 없어요.',
  'SKY_BOOK.sign.period': '{시작 날짜} ~ {끝 날짜}',
  'SKY_BOOK.section.card': '카드',
  'SKY_BOOK.cardNote': '예부터 전해 오는 차례대로 놓았어요. 순서에 뜻은 없어요.',
  'SKY_BOOK.end': '도감은 여기까지예요.',
  'SKY_BOOK.entry.back': '하늘 도감 보기',
  'SKY_BOOK.entry.settings': '하늘 도감',
  'SKY_BOOK.loadFailed': '하늘 도감을 불러오지 못했어요. 다시 시도해 주세요.',
  'SKY_BOOK.a11y.sheet': '하늘 도감, {갈래 이름}',
  'SKY_BOOK.a11y.sign': '{별자리 이름}, {시기}, {뜻}',
  'SKY_BOOK.a11y.card': '{카드 이름}, {뜻}',
  'MY_WAYS.title': '사랑하는 방식 · 말하는 방식',
  'MY_WAYS.pill': '나만 봐요',
  'MY_WAYS.lead': '별자리 풀이에서는 내가 태어난 날 금성이 있던 별자리로 사랑하는 방식을, 수성이 있던 별자리로 말하는 방식을 읽어요.',
  'MY_WAYS.love.title': '사랑하는 방식',
  'MY_WAYS.love.sub': '금성이 있던 별자리',
  'MY_WAYS.talk.title': '말하는 방식',
  'MY_WAYS.talk.sub': '수성이 있던 별자리',
  'MY_WAYS.note': '금성과 수성은 태어난 시각에 따라 다른 별자리로 읽히는 날이 있어요.',
  'MY_WAYS.mine': '나만 보는 화면이에요.',
  'MY_WAYS.off.body': '사랑하는 방식과 말하는 방식은 생년월일 이용에 동의한 분께만 보여요. 원하시면 설정 \'동의 관리\'에서 켤 수 있어요.',
  'MY_WAYS.a11y.open': '사랑하는 방식과 말하는 방식 펼치기',
  'MY_WAYS.a11y.close': '사랑하는 방식과 말하는 방식 접기',
  'MY_WAYS.a11y.love': '사랑하는 방식, {한 줄}',
  'MY_WAYS.a11y.talk': '말하는 방식, {한 줄}',
  'THREE_PILLARS.home.name': '내 세 기둥',
  'THREE_PILLARS.home.line': '태어난 날짜로 기둥을 읽어 봐요.',
  'THREE_PILLARS.home.open': '기둥 보기',
  'THREE_PILLARS.title': '내 세 기둥',
  'THREE_PILLARS.lead': '태어난 해와 달과 날을 글자 한 쌍씩으로 적은 이름표예요. 기둥마다 쉬운 말로 풀어 두었어요.',
  'THREE_PILLARS.readNote': '위 글자는 하늘, 아래 글자는 땅을 뜻해요. 왼쪽부터 태어난 해, 태어난 달, 태어난 날 순서예요.',
  'THREE_PILLARS.pillar.year': '태어난 해',
  'THREE_PILLARS.pillar.month': '태어난 달',
  'THREE_PILLARS.pillar.day': '태어난 날',
  'THREE_PILLARS.hour.label': '시주(태어난 시각)',
  'THREE_PILLARS.hour.note': '시주는 받지 않아요. 태어난 시각을 묻지 않기 때문이에요.',
  'THREE_PILLARS.cusp.ipchun': '입춘이 든 날에 태어났어요. 태어난 시각을 받지 않아서, 태어난 해와 달의 글자를 두 가지씩 함께 보여 드려요.',
  'THREE_PILLARS.cusp.month': '달이 바뀌는 절기가 든 날에 태어났어요. 태어난 시각을 받지 않아서, 태어난 달의 글자를 두 가지로 함께 보여 드려요.',
  'THREE_PILLARS.cusp.or': '또는',
  'THREE_PILLARS.off.body': '내 세 기둥은 생년월일 이용에 동의한 분께만 보여요. 원하시면 설정 \'동의 관리\'에서 켤 수 있어요.',
  'THREE_PILLARS.note': '나만 보는 화면이에요.',
  'THREE_PILLARS.noteStore': '읽어 낸 기둥은 저장하지 않아요. 열 때마다 새로 읽어요.',
  'THREE_PILLARS.read': '나는 {해 이름}의 해, {달 이름}의 달, {날 이름}의 날에 태어났어요.',
  'THREE_PILLARS.loadFailed': '기둥을 불러오지 못했어요. 다시 시도해 주세요.',
  'THREE_PILLARS.a11y.sheet': '내 세 기둥, {기둥 이름 차례}',
  'THREE_PILLARS.a11y.pillar': '{기둥 이름}, {글자}, {풀이}',
  'THREE_PILLARS.a11y.hour': '시주, 받지 않아요',
  'MEET_SKY.title': '만난 날의 하늘',
  'MEET_SKY.lead': '고른 날 달의 모양과 절기를 한 줄로 보여 드려요. 하늘의 모습만 적어요.',
  'MEET_SKY.note': '고른 날은 이 휴대폰에만 남아요.',
  'MEET_SKY.pick': '만난 날 고르기',
  'MEET_SKY.change': '날 바꾸기',
  'MEET_SKY.clear': '날 지우기',
  'MEET_SKY.empty': '만난 날을 고르면 그날의 하늘이 여기에 나와요.',
  'MEET_SKY.unavailable': '이 날의 하늘을 보여 드리지 못했어요. 다른 날을 골라 주세요.',
  'MEET_SKY.a11y.line': '만난 날의 하늘, {날짜}, {한 줄}',
  'BIRTH_CARD.kicker': '생일이 든 주예요. 축하해요.',
  'BIRTH_CARD.title': '생일 주간 엽서',
  'BIRTH_CARD.heading': '한 해를 돌아봐요',
  'BIRTH_CARD.lead': '한 해를 돌아보는 질문이에요. 답하지 않아도 괜찮아요.',
  'BIRTH_CARD.end': '이 엽서는 이번 호까지만 나와요.',
  'BIRTH_CARD.note': '나만 보는 화면이에요.',
  'BIRTH_CARD.off.body': '생일 주간 엽서는 생년월일 이용에 동의한 분께만 보여요. 원하시면 설정 \'동의 관리\'에서 켤 수 있어요.',
  'BIRTH_CARD.a11y.card': '생일 주간 엽서, {질문 차례}',
  'TYPE_CARD.state.none': '성향 확인을 마치면 여행 타입 엽서가 나와요.',
  'TYPE_CARD.state.featureOff': '여행 타입 엽서는 지금 쉬고 있어요.',
  'TYPE_CARD.state.forbidden': '지금은 이 엽서를 볼 수 없어요.',
  'MY_WAYS.loadFailed': '풀이를 불러오지 못했어요. 다시 시도해 주세요.',
} as const;

export type If3Key = keyof typeof IF3_TEXT;

// {이름} 자리를 채운다. {이름}{을/를} 꼴이면 값의 받침으로 조사도 고른다. 값이 없는 자리는 그대로 둔다
export function t3(key: If3Key, vals: Readonly<Record<string, string>> = {}): string {
  let out: string = IF3_TEXT[key];
  for (const [name, v] of Object.entries(vals)) {
    for (const [pair, a, b] of JOSA_PAIRS) out = out.split(`{${name}}{${pair}}`).join(v + pickJosa(v, a, b));
    out = out.split(`{${name}}`).join(v);
  }
  return out;
}
