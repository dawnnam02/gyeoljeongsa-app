// v4 새 기능 파도 0 · 1 화면 글(F19 1단계 · 임시). 마케팅(B17)이 마케팅/카피.md 'v4 파도 0 · 1' 절을 쓰는 중이라 확정 글이 아직 없다.
//  1단계 약속: 글 자리마다 키 이름이 그대로 보인다(예: 'featured.label'). 값을 넣는 글은 '키(값, 값)' 모양으로 보인다.
//  2단계: 카피.md 확정 글로 바꾸고 check-copy 대조 묶음을 더한다(app/F19_변경기록.md 3장). 줄 끝 번호는 기획/K12_v4기능명세.md 의 문구 요청 번호다.
//  [요청 밖] = K12 문구 요청 표에 없는 자리(화면을 만들다 보니 필요해진 글) → B17 에 더해 달라고 넘긴다.
// 이 파일은 다른 파일을 가져오지 않는다(Node 가 바로 읽는다).

// 값을 넣는 글의 임시 모양: 'share.text.plan(10월 20일 저녁 7시, 강남역)'
const withValues =
  (key: string) =>
  (...values: (string | number | null)[]): string =>
    `${key}(${values.map((v) => (v === null ? '' : String(v))).join(', ')})`;

export const V4W01 = {
  // [1] 오늘의 한 분 강조(09 카드). 라벨에 최상급 · 서열 말 · 숫자 금지(K12 1-06 · 1-08)
  featured: {
    label: 'featured.label', // NF1-01 강조 라벨
    a11y: withValues('featured.a11y'), // NF1-02 강조 카드 접근성 이름(이름 줄을 받는다)
  },

  // [2] 만남 뒤 한 줄 피드백(11 연결됨 탭 맨 위 카드 · 시트 2단계)
  meet: {
    cardTitle: 'meet.cardTitle', // NF2-01 카드 제목 · 시트 1단계 제목
    cardSub: 'meet.cardSub', // NF2-02 카드 보조
    answerButton: 'meet.answerButton', // [요청 밖] 카드의 [답하기]
    met: 'meet.met', // NF2-03 만났어요
    notYet: 'meet.notYet', // NF2-03 아직 만나지 않았어요
    declined: 'meet.declined', // NF2-03 만나지 않기로 했어요
    dismissA11y: 'meet.dismissA11y', // NF2-03 카드 닫기(×) 접근성 이름 = 묻지 않기
    howTitle: 'meet.howTitle', // NF2-04 2단계 제목
    good: 'meet.good', // NF2-04 좋았어요
    ok: 'meet.ok', // NF2-04 보통이었어요
    off: 'meet.off', // NF2-04 기대와 달랐어요
    mismatchGuide: 'meet.mismatchGuide', // NF2-05 달랐던 점 칩 안내(최대 3개)
    profileDiff: 'meet.profileDiff', // NF2-05 · 06 칩: 프로필과 사실이 달랐어요
    uncomfortable: 'meet.uncomfortable', // NF2-05 · 06 칩: 만나는 중에 불편했어요
    reportNote: 'meet.reportNote', // NF2-06 신고 안내(자동 신고가 아님)
    reportButton: 'meet.reportButton', // NF2-06 [신고하기]
    thanks: 'meet.thanks', // NF2-07 저장 완료 토스트
    answered: 'meet.answered', // NF2-08 답한 뒤 카드 자리
    edit: 'meet.edit', // NF2-08 [고치기]
    editLocked: 'meet.editLocked', // NF2-08 수정 잠김
    next: 'meet.next', // [요청 밖] 1단계에서 '만났어요'를 고른 뒤 [다음]
    send: 'meet.send', // [요청 밖] [보내기]
    saveFailed: 'meet.saveFailed', // K12 2-2 사용자 흐름 '저장 실패(기존 글)' — 2단계에 기존 글을 그대로 쓴다
  },

  // [3] 안심 공유(만남 계획 시트). 서버 저장 0 · 위치 0 · '상대 정보 넣기' 처음값 꺼짐(D-74 ⑩)
  share: {
    entry: 'share.entry', // NF3-01 진입 줄 이름(11 ⋯ · 10 하단 보조 버튼)
    title: 'share.title', // NF3-02 시트 제목
    notice: 'share.notice', // NF3-02 시트 안내(서버에 저장되지 않음)
    whenLabel: 'share.whenLabel', // NF3-03 날짜와 시간
    whenPlaceholder: 'share.whenPlaceholder', // NF3-03 자리표시
    placeLabel: 'share.placeLabel', // NF3-03 장소
    placePlaceholder: 'share.placePlaceholder', // NF3-03 자리표시
    memoLabel: 'share.memoLabel', // NF3-03 메모
    memoPlaceholder: 'share.memoPlaceholder', // NF3-03 자리표시
    partnerLabel: 'share.partnerLabel', // NF3-03 상대 정보 넣기
    partnerNote: 'share.partnerNote', // NF3-04 상대 정보 스위치 보조 글
    previewLabel: 'share.previewLabel', // [요청 밖] 미리보기 상자 이름
    text: {
      head: 'share.text.head', // NF3-05 보낼 문장 머리
      plan: withValues('share.text.plan'), // NF3-05 {날짜 시간}에 {장소}에서 만나요(빈 칸은 빈 값)
      partner: withValues('share.text.partner'), // NF3-05 상대 정보(성+OO · 나이) — 스위치를 켠 때만
      closing: 'share.text.closing', // NF3-05 끝나면 연락할게요 …
      memo: withValues('share.text.memo'), // NF3-05 {메모}
    },
    shareButton: 'share.shareButton', // NF3-06 [공유하기]
    copyButton: 'share.copyButton', // NF3-06 [문장 복사]
    copied: 'share.copied', // NF3-06 토스트: 복사했어요
    shareFailed: 'share.shareFailed', // NF3-06 토스트: 공유창 오류
    safetyLink: 'share.safetyLink', // NF3-07 12 안전 안내 맨 아래 링크
  },
} as const;
