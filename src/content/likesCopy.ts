// 11 호감 · 14 호감 없음 화면의 글(F6). 글자를 바꾸지 않는다.
//  원본: 마케팅/카피.md 11(확정) → 거기 없으면 기획/화면_요구사항.md 4장 11 · 1장 R12 · 6장 N18 → 기획/정책.md 10-2 NK05.
//  신고 · 차단 시트(N33) · 안전 한 줄(N34) · 공통 문구는 content/copy.ts 의 REPORT_SHEET · SAFETY · COMMON 을 그대로 쓰고 여기에 다시 적지 않는다.
// 표시: [확정] 카피.md 11 '→ 개선안' 칸 · [K2] 화면_요구사항 4장 11 · R12 · [가안] N18 · NK05(마케팅 확정 전) · [새 글] 원본 없음(팀장 · 마케팅 확인)
// 이 파일은 다른 파일을 가져오지 않는다(Node 가 바로 읽는다: scripts/web-f6.mjs · 2단계 check-copy).

export const LIKES = {
  headerTitle: '호감', // [확정] 상단바
  tabs: { sent: '보낸 호감', received: '받은 호감', connected: '연결됨' }, // [확정] 탭 3개
  receivedLabel: '받은 호감', // [확정] 받은 호감 행 둘째 줄 '{시간} · 받은 호감'
  sentLabel: '수락 대기', // [확정] 보낸 호감 행 둘째 줄 '{시간} · 수락 대기'(K2 5장 ⑥)
  connectedNote: '서로 수락했어요 · 연락 방법은 준비 중이에요', // [확정] 연결됨 행 둘째 줄(누르는 동작 없음)
  accept: '수락', // [확정]
  decline: '거절', // [확정]
  emptyReceivedTitle: '아직 받은 호감이 없어요', // [확정] 14
  emptyReceivedBody: '오늘의 추천에서 먼저 호감을 보내 볼 수 있어요.', // [확정] 14
  emptyReceivedButton: '오늘의 추천 보기', // [확정] 14 → 09
  emptySent: '보낸 호감이 없어요. 마음에 드는 분께 호감을 보내 보세요.', // [확정]
  emptyConnectedTitle: '아직 연결된 분이 없어요', // [확정]
  emptyConnectedBody: '호감을 보낸 분이 수락하거나, 받은 호감을 수락하면 여기에 모여요.', // [확정]
  acceptFailed: '수락하지 못했어요. 다시 시도해 주세요.', // [확정]
  unavailable: '이분과는 더 이상 연결할 수 없어요.', // [확정] 상대가 탈퇴 · 차단 · 만료(행을 흐리게 하고 누르면 이 글)
  acceptDone: '서로 수락했어요 · 연락 방법은 준비 중이에요', // [K2] 11 [수락] 토스트(= connectedNote)
  declineDone: '거절했어요.', // [가안] N18 토스트
  expiresIn: (days: number) => `${days}일 뒤 만료`, // [확정] NK05 받은 호감 행(정책 P7-05, 카피.md 11 B5 · D-40)
  expiresToday: '오늘 만료', // [확정] NK05 24시간 미만(카피.md 11 B5)
  expired: '만료', // [확정] 카피.md 11(B5, D-40) · 세부청사진 F6 조건 4 — 화면을 연 채로 7일이 지난 받은 호감(다시 불러오면 서버가 뺀다)
  // R12 시간 표기: 1시간 미만 '{n}분 전' · 오늘 '{n}시간 전' · 어제 · 2~6일 '{n}일 전' · 7일 이상 '{월}월 {일}일' (날짜는 한국 시각 달력 기준, 팀장 10-15)
  time: {
    minutes: (n: number) => `${n}분 전`, // [K2] R12
    hours: (n: number) => `${n}시간 전`, // [K2] R12
    yesterday: '어제', // [K2] R12
    days: (n: number) => `${n}일 전`, // [K2] R12
    date: (month: number, day: number) => `${month}월 ${day}일`, // [K2] R12
  },
  rowA11y: (head: string) => `${head} 프로필 보기`, // [새 글] 스크린리더: 행을 누르면 10 (copy.ts RECS.cardA11y 와 같은 말씨)
  acceptA11y: (head: string) => `${head} 호감 수락`, // [새 글] 스크린리더
  declineA11y: (head: string) => `${head} 호감 거절`, // [새 글] 스크린리더
  // T2 발견(팀장 10-15): 상대가 거절한 직후 [호감 보내기]를 숨긴다. 숨기지 않고 글로 알릴 때 쓸 안(카피 확정 필요). 1단계 기본은 숨김이라 화면에 나오지 않는다
  cannotSendDraft: '지금은 보낼 수 없어요', // [가안] 세부청사진 F6 T2 줄
} as const;

export type LikesTab = keyof typeof LIKES.tabs;
