// 탭바 아이콘 파일. 현재 탭은 채움 아이콘(브랜드색), 나머지는 선형 회색(팀장 지시 2026-10-14 · 디자인 D10).
// 원본은 디자인/아이콘/탭바/ 이고 앱에는 assets/icons/tab/ 으로 복사해 쓴다(2026-10-14 13:26 채움 아이콘 도착, 해시 같음).
//   active   = 0N_이름_활성_채움.png → <영문>-on-filled.png
//   inactive = 0N_이름_비활성.png    → <영문>-off.png
// 상점(D19 A1 · A2): 디자인/아이콘/탭바/03_상점_비활성.png · 03_상점_활성_채움.png. 옛 프로필 탭 아이콘 2개는 지웠다(프로필은 머리 오른쪽 위 원형 사진, 기본 그림은 assets/icons/avatar/).
// 아이콘을 바꾸면 이 파일의 require 경로만 고친다.
const RECOMMEND_ICONS = {
  active: require('../../assets/icons/tab/recommend-on-filled.png'),
  inactive: require('../../assets/icons/tab/recommend-off.png'),
};

const LIKES_ICONS = {
  active: require('../../assets/icons/tab/likes-on-filled.png'),
  inactive: require('../../assets/icons/tab/likes-off.png'),
};

export const TAB_ICONS = {
  // V5 W6 탑승권 탭: 디자인 W12 아이콘이 오기 전까지 추천 탭 그림을 임시로 같이 쓴다(아이콘이 오면 이 줄만 새 require 둘로)
  boarding: RECOMMEND_ICONS,
  recommendations: RECOMMEND_ICONS,
  // V5 W5 채팅 탭: 디자인 W12 아이콘이 오기 전까지 호감 탭 그림을 임시로 같이 쓴다(아이콘이 오면 이 줄만 새 require 둘로)
  chat: LIKES_ICONS,
  likes: LIKES_ICONS,
  shop: {
    active: require('../../assets/icons/tab/shop-on-filled.png'),
    inactive: require('../../assets/icons/tab/shop-off.png'),
  },
  settings: {
    active: require('../../assets/icons/tab/settings-on-filled.png'),
    inactive: require('../../assets/icons/tab/settings-off.png'),
  },
} as const;

export type TabIconName = keyof typeof TAB_ICONS;
