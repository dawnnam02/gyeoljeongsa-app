// 채팅 글(V5 W5). 카피.md 에 아직 없는 새 글 — app/W5_변경기록.md 4장에 카피 키 제안으로 적었다(W13 카피 직원이 다듬으면 그 글로 바꾼다).
//  · 해요체 · 느낌표 0 · 번역투 0 · 재촉 0: 남은 기간은 '언제까지 열려 있어요'(날짜)로만 — 시 · 분 · 초 카운트다운 · '곧 닫혀요' · '서두르세요' 0
//  · 연장은 '둘 다 원하면 7일 더'. 상대가 원했는지는 둘 다 고를 때까지 보이지 않는다(거절 부담 · 재촉 0, 판단 — 변경기록 6장)
//  · 연락처 · 사진 · 음성은 채팅에서 자유(T-20). 금전 요구 · 욕설만 서버(text_guard)가 막는다
//  · 점수 · 순위 · 등급 말 0
export const CHAT = {
  tabTitle: '채팅',
  list: {
    emptyTitle: '아직 열린 대화방이 없어요',
    emptyBody: '수요일 오후 6시에 만난 분이 정해지면 이곳에 대화방이 열려요.',
    openUntil: (when: string) => `${when}까지`,
    closed: '닫힌 대화방',
    lastPhoto: '사진',
    lastVoice: '음성 메시지',
    lastNone: '첫 인사를 건네 보세요.',
    lastPurged: '지난 대화예요.',
    unreadA11y: (n: number) => `읽지 않은 메시지 ${n}개`,
    rowA11y: (name: string, state: string) => `${name}님과의 대화방, ${state}`,
    loadFailed: '대화방을 불러오지 못했어요. 다시 시도해 주세요.', // 카피.md 14-5-2(QPM 3-2)
  },
  room: {
    headerA11yMore: '대화방 메뉴',
    openUntil: (when: string) => `${when}까지 열려 있어요.`,
    lastDay: '오늘 오후 6시까지 열려 있어요.',
    extendedNote: '둘 다 원해서 7일 더 열렸어요.',
    extendLink: '연장 알아보기',
    closedTitle: '대화방이 닫혔어요',
    closedExpired: (until: string) => `7일이 지나 대화방이 닫혔어요. 지난 글은 ${until}까지 읽을 수 있어요.`,
    closedPartnerLeft: (until: string) => `상대가 대화를 마쳤어요. 지난 글은 ${until}까지 읽을 수 있어요.`,
    closedMediaNote: '사진과 음성도 그때 함께 지워져요.',
    startNote: (name: string) => `${name}님과 대화방이 열렸어요. 7일 동안 이야기할 수 있어요.`,
    // 맨 위 기억 한 줄(D46 · 카피 16-2 · 정책 P4-26): 두 사람 같은 글 · 열린 방 · 닫힌 방 모두 · 앱이 방의 열린 날짜로 그림(서버 글 0). 예: '수요일 저녁, 한강 벤치에서 처음 만났어요.'
    metAt: (when: string, place: string) => `${when}, ${place}에서 처음 만났어요.`,
    purgedMedia: '지워진 첨부예요.',
    loadFailed: '대화를 불러오지 못했어요. 다시 시도해 주세요.', // 14-5-2
    gone: '이 대화방은 더 이상 볼 수 없어요.',
    olderLoad: '지난 글 더 보기',
  },
  composer: {
    label: '메시지',
    placeholder: '메시지 쓰기',
    send: '보내기',
    photo: '사진 보내기',
    voice: '음성 녹음하기',
    tooLong: (max: number) => `한 번에 ${max}자까지 보낼 수 있어요.`,
    counter: (n: number, max: number) => `${n}/${max}`,
  },
  send: {
    sending: '보내는 중',
    failed: '보내지 못했어요. 다시 보내 주세요.', // 14-5-2
    retry: '다시 보내기',
    discard: '지우기',
    blocked: '보낼 수 없는 표현이 있어요. 돈을 요구하거나 거친 말로 읽히는 부분을 고쳐서 다시 보내 주세요.', // 14-5-2
    closed: '대화방이 닫혀 보낼 수 없어요.',
    limited: '요청이 많았어요. 잠시 뒤에 다시 보내 주세요.', // 14-5-2(1-1 rate_limited)
    format: '보낼 수 없는 파일이에요. 사진이나 음성만 보낼 수 있어요.', // 14-5-2
    size: '파일이 커서 보내지 못했어요. 사진은 10MB, 음성은 3MB까지 보낼 수 있어요.', // 14-5-2
    caution: '링크가 들어 있어요. 열기 전에 주소를 한 번 더 확인해 주세요.',
  },
  photo: {
    a11y: (mine: boolean) => (mine ? '내가 보낸 사진' : '받은 사진'),
    viewerClose: '닫기',
    viewerA11y: '사진 크게 보기',
    format: '사진은 JPG나 PNG로 보내 주세요.',
    size: '사진은 10MB까지 보낼 수 있어요.',
    unavailable: '이 기기에서는 아직 사진을 보낼 수 없어요.',
  },
  voice: {
    recording: '녹음 중',
    recordingA11y: (sec: string) => `녹음 중, ${sec}`,
    limitNote: (max: string) => `${max}까지 녹음할 수 있어요.`,
    cancel: '취소',
    send: '보내기',
    stop: '녹음 멈추기',
    play: '음성 재생',
    pause: '음성 멈춤',
    a11y: (mine: boolean, len: string) => `${mine ? '내가 보낸' : '받은'} 음성 메시지, ${len}`,
    tooShort: '1초보다 짧은 녹음은 보내지 않았어요. 조금 더 길게 녹음해 주세요.', // 14-5-2
    tooBig: '음성은 3MB까지 보낼 수 있어요.',
    denied: '음성을 보내려면 마이크 권한이 필요해요. 기기 설정에서 켤 수 있고, 글과 사진은 그대로 보낼 수 있어요.', // 14-5-2(1-1 권한 거부)
    unavailable: '이 기기에서는 아직 음성을 녹음할 수 없어요.',
    playFailed: '음성을 재생하지 못했어요. 다시 눌러 주세요.', // 14-5-2
  },
  menu: {
    title: '대화방',
    profile: '상대 프로필 보기',
    extend: '7일 연장하기',
    extendHint: '둘 다 원하면 7일 더 열려요.',
    leave: '대화방 나가기',
    leaveHint: '나가면 이 대화방이 내 목록에서 사라져요.',
    safety: '신고 · 차단',
    safetyHint: '불편한 일이 있었다면 알려 주세요.',
    cancel: '닫기',
  },
  extend: {
    title: '7일 더 이야기할까요',
    body: '둘 다 원하면 대화방이 7일 더 열려요. 상대가 원하는지는 둘 다 고른 뒤에 알 수 있어요.',
    want: '연장을 원해요',
    wantNote: '연장을 원한다고 골랐어요. 상대도 원하면 7일 더 열려요.',
    undo: '연장 원하지 않기',
    undoNote: '연장을 원하지 않는 것으로 바꿨어요.',
    extendedToast: '둘 다 원해서 7일 더 열렸어요.',
    failed: '연장을 고르지 못했어요. 다시 시도해 주세요.',
  },
  leave: {
    title: '대화방에서 나갈까요',
    body: '나가면 대화방이 닫히고 내 목록에서 사라져요. 상대는 지난 글을 30일 동안 읽을 수 있고, 대화가 끝났다고만 보여요.',
    confirm: '나가기',
    cancel: '취소',
    done: '대화방에서 나왔어요.',
    failed: '나가지 못했어요. 다시 시도해 주세요.',
  },
  system: {
    extendRequested: '연장을 원한다고 골랐어요.',
    extendCancelled: '연장을 원하지 않는 것으로 바꿨어요.',
    extended: '둘 다 원해서 7일 더 열렸어요.',
    closedExpired: '7일이 지나 대화방이 닫혔어요.',
    partnerLeft: '상대가 대화를 마쳤어요.',
  },
  time: {
    am: '오전',
    pm: '오후',
    today: '오늘',
    yesterday: '어제',
  },
  demo: {
    sceneLine: (name: string) => `데모 · 장면: ${name} (누르면 다음)`,
    scenes: { open: '열린 방', fresh: '막 열린 방', partnerFirst: '상대가 먼저 보냄', lastDay: '마지막 날', extendWait: '상대가 연장을 원함', partnerLeft: '상대가 나감', closed: '닫힌 방', empty: '방 없음' },
  },
} as const;
