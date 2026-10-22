// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-contact-words.mjs (R1 A⑦)
// 원본: backend/migrations/*.sql 의 private.text_guard_terms (contact · url). 링크 머리(웹 주소 앞부분 3가지)는 lib/contactShape.ts 판정식이 잡아서 뺐다.
// 쓰는 곳: lib/contactShape.ts(연락처 안내 V10). 서버 목록과 어긋나도 안내용이라 허용(K15 2-1).

export const CONTACT_WORDS: readonly string[] = [
  "카톡",
  "카카오",
  "카카오톡",
  "카톡아이디",
  "카카오아이디",
  "오픈채팅",
  "오픈카톡",
  "인스타",
  "인스타그램",
  "텔레",
  "텔레그램",
  "라인아이디",
  "왓츠앱",
  "위챗",
  "페이스북",
  "페북",
  "디엠",
  "dm",
  "kakao",
  "kakaotalk",
  "katalk",
  "insta",
  "instagram",
  "telegram",
  "whatsapp",
  "line id",
  "wechat",
  "facebook",
];

export const LINK_WORDS: readonly string[] = [
  "bit.ly",
  "t.me/",
  "open.kakao.com",
  "goo.gl",
  "youtu.be",
  "naver.me",
  "tinyurl",
];
