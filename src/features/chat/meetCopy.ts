// 만남 장면 글(T4S · D46-M 확정, 카피.md 16장 · D-206). 원본 = 마케팅/카피.md 16-1 · 16-2 표 — check:copy X 가 한 글자씩 대조한다.
//  · 자막 카드는 명사 두 줄(장소 / 때), 나머지는 해요체 한 줄 · 느낌표 0 · 숫자 0 · 재촉 0 · 방송 고유 낱말 0(16-3)
//  · 상대 이름 · 나이 · 생김새 0. 끝 줄 뒤에 '먼저 말을 걸어 보세요' 같은 권유를 붙이지 않는다(척추 질문 4)
//  · 이 파일은 다른 파일을 불러오지 않는다(점검 도구가 Node 로 바로 읽는다)
export const MEET_SCENE = {
  // 16-1 장소 자막 카드 첫 줄(장소 표 차례 1 ~ 10, theme/meetArt MEET_PLACES). 지명은 한강 · 제주 두 곳만
  place: {
    riverBench: '한강 벤치',
    hanokAlley: '한옥 골목',
    cafeTerrace: '카페 테라스',
    seasideSteps: '제주 바닷가',
    localDiner: '동네 밥집',
    palaceWall: '궁궐 돌담길',
    parkTrail: '공원 산책로',
    stationHall: '기차역 대합실',
    bookWindow: '서점 창가',
    busStop: '버스 정류장',
  },
  // 16-2 자막 카드 둘째 줄: {요일} 저녁 — 지금은 늘 '수요일 저녁'
  when: (day: string) => `${day} 저녁`,
  // 끝 한 줄 두 갈래: 상대 글 0 / 상대가 글 · 사진 · 음성을 먼저 보냄
  line: {
    quiet: '옆에 앉은 분과 눈이 마주쳤어요.',
    partnerFirst: '옆에 앉은 분이 먼저 말을 걸어왔어요.',
  },
  skip: '건너뛰기', // 처음부터 끝까지 같은 자리
  skipA11y: '장면 건너뛰고 대화방으로 가기', // 읽기 이름('버튼' 0)
  go: '대화방으로 가기', // 화면 읽기를 켠 분에게 보이는 버튼(저절로 넘기지 않음)
  // 장면 한 덩이 읽기: {장소}, {때}. 우연히 옆자리에 앉게 됐어요. {끝 줄}
  a11y: (place: string, when: string, line: string) => `${place}, ${when}. 우연히 옆자리에 앉게 됐어요. ${line}`,
} as const;
