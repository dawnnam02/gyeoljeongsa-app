# IF2-F 기내 서비스 · 연애 기능 1.0 앱 (D-223 파도 3 · 10-28 ~) — 이어하기 메모(멈춰도 여기부터)

- 기준: `팀장/세부청사진/IF2_기내서비스_재개.md` 5 · 6장(D-223 · 1.0 기능 20개) · `기획/정책.md` PF장(PF-01 ~ 93) · `기획/화면_요구사항.md` 'T2 홈 — 새 구성'(셈표 12, 1.0은 10) · 'T4 대화방 칸' · IF 화면 11 · 접두어 23 · `기획/IF2-K_변경기록.md` 6장 · `backend/R_변경기록.md` 11장(11-4 앱 넘김) · `backend/migrations/0043_inflight.sql`(읽기만) · `보안/IF2_위협.md` 7장 IFF-01 ~ 16 · `ai/IF2/`(문구 라이브러리 · fun_calc.py · check_calc.py) · `디자인/IF2_기내서비스/`(index.html · 원본 아이콘 15 · 그림 · tarot 22 + 뒷면) · `마케팅/IF2_카피초안.md`(카피.md 21장이 들어오기 전 초안 키)
- 순서(본인 승인 D-223): 문서 → 서버(0043) → **앱(이 작업)** → 검수. 푸시 0(팀장) · 실서버 0 · 유료 · AI 호출 0 · live 0 · 스위치 켜기 0
- 바닥선(c5105e0 · LG-F): tsc 0 · jest 101묶음 1,765 · check:copy 105/0 · tokens 5/0

## 0. 청사진 (시작 전)

### 0-1. 최종 모습
- 스위치 20개(실서버 처음값 꺼짐 · 데모 켜짐, `type_card_share` · `pair_card_ai`는 데모도 꺼짐)가 꺼지면 앱은 지금 그대로(T1 · T2 · T4). 켜지면 홈(탑승권 탭)이 안 1 '주머니 한 줄'로 바뀌고 기능 화면 20개가 열린다.
- 앱은 0043 응답 모양만 읽는다(상대 원값 · 코드 0). 데모 모의 서버는 0043과 같은 이름 · 같은 모양으로 답하고, 데모 계산은 `ai/IF2/fun_calc.py` 시험값과 같다.
- 나만 쓰는 글 9종은 SecureStore(웹 · 시험은 메모리) · 로그아웃 · 탈퇴 때 지움.

### 0-2. 세부 목표 · 통과 조건(측정)

| # | 세부 목표 | 통과 조건(측정) |
|---|---|---|
| 1 | 스위치 20 | featureKeys.json 그룹 IF2 20줄 = 정책 PF-91 이름 · live 꺼짐 · 데모 켜짐(둘 꺼짐) · r1Common 키 수 고침 |
| 2 | 0043 응답 읽기 | `inflightApi` 함수 13개 이름 · 인자 = 0043 · 파서가 아는 키만 읽음(상대 정보 키 0) · feature_off → 꺼짐 |
| 3 | 데모 모의 서버 | `demo/inflightDemo`(홈 · 기내지 · 카드 · 미리 답 질문 · 미리보기 · 궁합 카드) + 채팅 데모(칩 · 이야깃거리 · 꼬리표 글 · 같이 열어 보기) — 같은 파서로 읽힘(시험) · 데모 계산 = check_calc 시험값(타로 18 · 칩 [12, 6, 7] · 변형 · 일간 · 별자리 · 그 주 기운) |
| 4 | 홈(T2 새 구성) | 셈표 1.0 10 상태(loading · error · before · reflect · inflight · landing · matched · noMatch · overlap · prelaunch) · 블록 5 이하 · 자리 고정 B1 → B7 · 홈 표면 상대 정보 0 · 홈 열 때 부르는 함수 = get_ticket_state · get_weekly_match · get_home_state(AI 0) · 탑승 전 맛보기 0 · 쉬는 중 · 졸업 0 · 피드백 칸 0 |
| 5 | 기능 화면 20 | IF-MAG(표지 + 6쪽 · 끝 쪽 뒤 넘김 0 · 쪽 번호 0) · IF-CARD(세 장 → 한 장 · 그 주 고정) · IF-TYPE · IF-PREVIEW · IF-PRE · IF-HELLO · IF-PAIR(접힌 채 · 캡처 막기 · 별자리 이름 · 일간 · 띠 0) · IF-TALK · IF-PREP(12 안전 안내 키 그대로 · 안심 공유) · IF-MEMO · 대화방 칸 6자리(맨 위 순서 0) |
| 6 | 동의 · 설정 | IF-CK17 시트(2줄 · 판 consent-2026.10.28-v1 · 미리 체크 0 · B는 A 뒤) · 12 동의 관리 CK17A · CK17B 줄 · 08 '같은 취미' 줄(처음 켜짐) · [짝에게 보이는 모습] · 12 정보 AI 고지(있음) |
| 7 | 기기 저장 9종 | 키 9개 SecureStore · AsyncStorage 0 · 로그아웃 · 탈퇴 지움 · 회차 끝 지움(엽서 · 미리 답) · 방 닫힘 + 30일(메모 · 표시) |
| 8 | 글 | 초안 키(`IF2_카피초안.md`)를 생성 파일로 · check:copy 새 그룹 IF2(원본 대조 · 카피 밖 글 0 · PF-18 금지 낱말 · 숫자 · 느낌표 0) — 21장이 들어오면 21장을 원본으로 |
| 9 | 시험 | IFF-01 ~ 16 같은 번호 · 홈 응답 상대 정보 키 0 · 숫자 0 · 상대 화면 사주 글자 · 별자리 이름 0 · 재미 데이터가 매칭 화면 · 요청에 0 |
| 10 | 웹 · 바닥선 | 새 web-if2(360 · 390 · 430) + f1 · f3 · f7 · w6 · d46 · lounge · tsc 0 · jest 전부 · check:copy 0 · tokens · check_sec2(실패 F-05s만) |

### 0-3. 판단(원본이 엇갈리거나 비어 있는 곳)

| 자리 | 판단 | 까닭 |
|---|---|---|
| 작별 엽서 | 고르기 + 한 줄 고침(정책 PF-57 · 팀장 10-28) · 고르지 않으면 고침 칸 0 | 보안 IFF-07 '입력창 0'보다 늦은 팀장 판단 · 0043 send_chat_card 가 f0 ~ f4 + 한 줄 받음 |
| 내 여행 타입 이름 · 짐 싸기 질문 | 원문(청사진 15장) 지워짐 · 서버 타입 코드 없음 → 실서버는 칸 0, 데모만 디자인 시안 표본 한 타입 | 카피 초안 22장 '15장 원문 지워짐(미확인)' · 백엔드 11-5 'R48 ② 타입 코드 서버에 없음' |
| 앱 카드 계산 0(IFF-10) ↔ 데모 계산 = fun_calc | 계산 코드는 `demo/` 안에만 · 화면 · API 파일은 가져오지 않음(시험) | 둘 다 지킴 |

## 1. 진행 상태(멈추면 여기부터)

| 단계 | 상태 |
|---|---|
| 0 읽기 · 청사진 | 끝 |
| 팀장 신호 '21장 끝'(작업 중) | 반영 — 초안 대신 카피.md 21장이 원본(gen-if2-copy 가 21장을 읽음 · 371 글 + 끌어 쓰는 자리 1 = 372) · 21-18 세 줄 같은 커밋 · 21장 표시 '앱 반영 전' → '앱 반영'(두 줄, 표시 꼴만) · check:copy 새 그룹 IF2 |
| 묶음 1 앱 코드(스위치 · 응답 읽기 · 데모 · 홈 · 화면 · 시트 · 대화방 칸 · 설정 · 08 · 글 · 생성기) | 끝 — ee231e0 |
| 묶음 2 시험(IFF-01 ~ 16 · 데모 = fun_calc · 화면) | 끝 — 23576ed |
| 묶음 3 웹 점검 web-if2 · 웹에서 찾은 결함 고침 · 바닥선 · 이 기록 | 끝 — bd83aa0(확인 4장) |
| 푸시 | 0(팀장) |

## 2. 데모 장면 이름 목록(데모 모드에서만 · 스토어 빌드 0)

### 2-1. 홈(탑승권 탭) — 이메일 앞부분 `if2<장면>` 또는 홈 아래 데모 줄 칩(`if2-demo-<장면>`)

| 장면 | 이메일 앞부분 | 데모 줄 글 | 탑승권 데모 장면(같이 바뀜) | 홈 표시 · 블록 |
|---|---|---|---|---|
| auto | (없음) | — | 탑승권 데모를 따라감 | 탐 = 비행 중 · 마감 뒤 = 착륙 준비 · 공개 짝 있음 · 짝 없음 · 그 밖 = 탑승 전 |
| before | if2before | 탑승 전 | onsale | before · B1 B6 B7 |
| inflight | if2inflight | 비행 중 | boarded | inflight · B1 B3 B4 B7 + 같은 취미 띠(첫 회차) |
| magBefore | if2magbefore | 기내지 발행 전 | boarded | inflight · B1 B3 B4 B7 · 기내지 칸 '발행 전' · IF-MAG not_yet |
| landing | if2landing | 착륙 준비 | late | landing · B1 B3 B4 B7(B4 머리만 '착륙 준비 중이에요') |
| matched | if2matched | 공개 뒤 짝 있음 | matched(1회차 공개 열어 봄 표시) | matched · B1(다음 탑승) B2 B4 B7 |
| noMatch | if2nomatch | 공개 뒤 짝 없음 | none | noMatch · B1 B6 B7 |
| overlap | if2overlap | 겹칠 때 | boarded(+ 데모 채팅 기본 방) | overlap · B1 B3 B4 B5 B7 |
| reflect | if2reflect | 방이 닫힌 뒤 | onsale | before · B1 B6 B7(기기에 돌아보기 메모가 있으면 reflect · B4 더함) |

- 이메일 장면은 탑승권을 처음 읽기 전에 정한다(demoBackend — 위 탑승권 칸과 아래 블록이 같은 장면).
- `if2off`(이메일 앞부분 어디든): IF2 스위치 20개를 끈 장면 = live 처음값과 같은 지금 T1 · T2 · T4. web-w6 이 `w6plainif2off` 로 쓴다.
- 스위치 하나만 끈 모습은 시험(iffInflightUi 'PF-93')이 본다. 데모 처음값: 18개 켜짐 · `type_card_share` · `pair_card_ai` 꺼짐(1.1).

### 2-2. 대화방 칸 — 데모 채팅(features/chat/chatDemo · 지금 장면 그대로)

| 장면 | 이메일 앞부분 | IF2 칸 |
|---|---|---|
| fresh(기본) | (없음) · chatnew | 첫마디 실마리 칩 3(내 첫 글 전) · [이야깃거리] 1일째 가볍게 · 작별 엽서 |
| partnerFirst | chatfirst | 칩은 내 첫 글 전까지(상대 글 1 · 내 글 0) |
| open | chatopen | 내 글이 있어 칩 0 |
| lastDay · extendWait | chatlast · chatext | 열린 방 칸 그대로 |
| partnerLeft · closed | chatleft · chatclosed | 닫힌 방 → 칩 · [이야깃거리] · 작별 엽서 0(PF-59) |
| empty | chat0 | 방 없음 |

- 글에 `데모안전` 이 있으면 데모 짝이 돈 · 투자 꼴 글로 한 번 답한다 → 안전 안내 카드(나에게만).
- [대화방에 놓기]로 첫 이야깃거리를 놓으면 데모 짝이 '같이 열어 보는 질문' 카드를 보낸다 → [답 적기] → 함께 펼침.
- 작별 엽서를 보내면 나감(목록에서 빠짐).

### 2-3. 계산 대조(데모 = `ai/IF2/fun_calc.py` 시험값 · 데모 키 `test-key-not-secret`)

| 항목 | 값 |
|---|---|
| 타로 m-0001 · 2027-05-06 | [20, 9, 7] |
| 타로 8f14… · 2027-05-13 | [21, 6, 17] |
| 칩 room-001 | [12, 6, 7] |
| 변형 saju · star | 1 · 2 |
| 1900-01-01 일진 | 60갑자 10번 |
| 그 주 기운 2027-05-06 · 05-13 | earth · fire |
| 별자리 1996-02-29 | pisces |

## 3. 만든 · 고친 파일

| 묶음 | 만든 것 | 고친 것 |
|---|---|---|
| 1 ee231e0(65) | 생성기 2(`scripts/gen-if2-copy.mjs` · `gen-if2-assets.mjs`) · 생성 파일 6(`if2CopyData.ts` · `if2Library.json` · `if2art.json` · `moneySafetyWords.ts` · `if2IconPaths.ts` · `ck17Content.ts`) · 데모 6(`demo/funCalc` · `inflightDemo` · `inflightChatDemo` · `inflightShared` · `inflightDemoBar` · `typeDemo`) · 화면 · 부품 · 로직 13(`features/inflight/*`) · 라우트 3(`magazine` · `type-card` · `preview-me`) · `theme/if2Look.ts` | 스위치 `featureKeys.json`(그룹 IF2 20) · 탑승권 홈(BoardingScreen · boardingServices · boardingCopy 21-18) · 대화방(chatApi · ChatParts · Composer · ChatRoomScreen · chatDemo · chatService · 라우트) · 08(ProfileScreen · ToggleRow · profileApi · 라우트) · 12(ConsentManagePage · SettingsScreen · settingsCopy 21-18) · 데모 서버(demoBackend · settingsDemo) · secureStorage(if2Storage) · 화면 목록(screens · flow) · check-copy(그룹 IF2 · 21-18) · check-copy-rules · 시험 6(키 수 · 라우트 · 고지 이름 · 법무 원문 파일 · 데모 꺼짐 키) |
| 2 23576ed(2) | `__tests__/iffInflight.test.ts`(34) · `__tests__/iffInflightUi.test.tsx`(22) | — |
| 3 bd83aa0(13) | `scripts/web-if2.mjs` · npm `check:if2` | 웹에서 찾은 결함 5(4-2) · `featureKeys.ts`(if2off 장면) + 시험 1 · `web-w6.mjs`(가입 이메일 if2off) · 이 기록 |

## 4. 확인

### 4-1. 숫자(바닥선 c5105e0 → 지금)

| 항목 | 바닥선 | 지금 |
|---|---|---|
| tsc | 0 | 0 |
| lint(expo lint) | 0 | 0 |
| jest | 101묶음 1,765 | 103묶음 1,822(+ IF2 57) |
| check:copy | 105/0 | 106/0(+ IF2) |
| check:tokens | 5/0 | 5/0 |
| gen:if2 --check | — | 글 371 = 21장 · 라이브러리 · 그림 = 원본 |
| web-if2 360 · 390 · 430 | — | 94/0 · 94/0 · 94/0 |
| web f1 · f3 · f7 | — | 76/0 · 75/0 · 65/0 |
| web w6 · d46 · lounge | — | 36/0 · 17/0 · 64/0 |
| check_sec2 | 실패 F-05s만 | 108 = 통과 102 · 실패 2(F-05s · LG-a) · 정보 4 — LG-a 는 라운지 DB 표 점검(같은 때 백엔드 0044_lounge_followup 작업 중 · 앱 변경과 무관으로 추정 · 미확인) |

### 4-2. 웹 점검에서 찾아 고친 결함(시험 · 타입 검사로는 안 보이던 것)

| # | 결함 | 고침 |
|---|---|---|
| 1 | 웹에서 기내지 쪽 폭 0(글이 안 보임 · 카드 자리 화면 밖) — 불러오는 중 칸(같은 자리 View)을 이어 써서 react-native-web 이 onLayout 관찰을 시작하지 않음 | 쪽 묶음 View 에 key(새로 붙임) |
| 2 | 웹에서 체크 칸 · 고르기 칸의 고른 상태가 읽히지 않음(aria-checked 0) — 동의 시트 ① ② · 챙겼어요 · 작별 엽서 고르기 · 나를 소개하는 글 고르기 · 같이 열어 볼 질문 · B7 펼침 | 앱 다른 곳과 같이 aria-checked · aria-expanded 더함 · 나를 소개하는 글(3개까지 여럿)은 radio → checkbox |
| 3 | 360 폭에서 작별 엽서 두 단추 높이가 다름(156×66 · 156×52 — IFF-07 같은 크기) | 위아래로 쌓음(같은 폭 · 같은 높이) |
| 4 | 이메일 장면(if2inflight)으로 들어오면 위 탑승권 칸은 판매 중 · 아래 블록은 비행 중 | 탑승권을 처음 읽기 전에 IF2 장면을 정함(demoBackend) |
| 5 | 만남 장면(D46)이 덮인 동안 첫마디 실마리 칩 줄이 그 뒤에서 넘침(web-d46 장면 넘침 7) | 장면이 끝난 뒤에 칩 줄 |

## 5. 판단 · 넘길 것

| # | 자리 | 내용 | 넘길 곳 |
|---|---|---|---|
| 1 | 내 여행 타입 12 · 짐 싸기 질문 | 원문 없음 · 서버 타입 코드 없음 → 실서버 칸 0, 데모만 시안 표본 한 타입(느린 기차 여행자). 짐 싸기 퀴즈 화면 0 | AI IF2-A · 백엔드(R48 ②) |
| 2 | 기내지 ⑤ 이번 여행지 짧은 글 | 라이브러리에 여행지 글 칸 없음 → 여행지 이름 + 그림만 | AI IF2-A |
| 3 | 만남 계획 공유 시트 | 지금 V4W01 키 그대로(새 키 0) · 첫 만남 준비 안 입구 이름만 21장 | 마케팅 · F19 2단계 |
| 4 | 작별 엽서 | 고르기 + 한 줄 고침(팀장 10-28 · PF-57) — 보안 IFF-07 '입력창 0'과 다름(고르기 전엔 고침 칸 0) | 보안(IFF-07 문구 맞춤) |
| 5 | 돈 · 투자 안전 안내 꼴 | 서버 낱말 + 링크 · 바깥 연락 유도 꼴(카톡 · 인스타 아이디만은 0 — T-20 연락처 자유) | 보안 · 법무 확인 |
| 6 | 사전 오픈 단계 | 사전 오픈 화면이 탑승권 탭을 덮으므로 새 홈 B6 · B7 0(지금 그대로) | 기획 확인 |
| 7 | 12 동의 관리 CK17 줄 | `inflight_mag` 또는 `pair_card` 가 켜졌을 때만 줄 | 기획 확인 |
| 8 | 07 · 04 에서 IF-TYPE 입구 | 타입 원문이 없어 입구 0(홈 B6 · B7 만) | 기획 · AI |
| 9 | 웹 결함 1(onLayout) | 같은 꼴(불러오는 중 칸 뒤 같은 자리 View 에 onLayout)이 다른 화면에 있으면 같은 결함 — 이번에 본 IF2 화면 밖은 안 고침 | 앱(다음 묶음) |

## 6. 대조표(0-2 세부 목표 ↔ 실제)

| # | 통과 조건 | 실제 | 일치 |
|---|---|---|---|
| 1 | 스위치 20 · live 꺼짐 · 데모 켜짐(둘 꺼짐) | featureKeys.json IF2 20 · live 꺼짐 20 · 데모 꺼짐 2(type_card_share · pair_card_ai) · r1Common 114키 | O |
| 2 | 함수 13 · 아는 키만 · feature_off → 꺼짐 | inflightApi 13 · 파서 시험(상대 정보 키 버림) · 42501 → 'off' | O |
| 3 | 데모 = 0043 모양 · fun_calc 시험값 | 같은 파서로 읽힘 · C1 ~ C6 = 2-3 표 | O |
| 4 | 홈 10 상태 · 블록 5 이하 · 상대 정보 0 · AI 0 · 맛보기 0 | 표시 9(loading · error · before · reflect · inflight · landing · matched · noMatch · overlap) + prelaunch(지금 대기 화면) · 블록 ≤ 5 · 홈 열 때 get_home_state 하나 · 홈 숫자 0(웹 3폭 9장면) | O(prelaunch 는 5-6) |
| 5 | 기능 화면 20 | 20 기능 화면 · 시트 · 대화방 칸(맨 위 순서 더한 것 0) · 타입 원문 없음은 5-1 | O(5-1 · 5-2 빈칸) |
| 6 | CK17 시트 · 12 줄 · 08 줄 · AI 고지 | 판 consent-2026.10.28-v1 · 미리 체크 0 · ② 는 ① 뒤 · 거부도 기록 · 12 CK17A · B 줄 · 08 '같은 취미'(처음 켜짐 · 바로 저장) · '생성형 AI 고지' | O |
| 7 | 기기 저장 9 · AsyncStorage 0 · 지움 | SecureStore 9키 · 로그아웃 · 탈퇴 지움 · 회차 끝 · 방 닫힘 + 30일(시험) · check_sec2 P7-f 통과 | O |
| 8 | 글 = 21장 · check:copy IF2 | 371 + 1 = 372 · 그룹 IF2 통과 · 금지 낱말 · 숫자 · 느낌표 0 | O |
| 9 | IFF-01 ~ 16 · 홈 키 0 · 숫자 0 · 사주 글자 · 별자리 이름 0 · 매칭 0 | iffInflight 35 · iffInflightUi 22(같은 번호) | O |
| 10 | 웹 · 바닥선 | 4-1 표 | O |

## 7. 척추 대조(D-223 · 6장)

| 척추 | 이번 결과 |
|---|---|
| 재미는 매칭 밖(PF-04) | 탑승권 · 추천 · 채팅 요청 코드가 기내 서비스 모듈 · 재미 값을 읽지 않음(시험) · 재미 화면마다 끝줄(매칭 · 짝 정하기에 쓰지 않음) |
| 홈에 상대 정보 0(PF-08) | 홈 응답 · 화면 상대 이름 · 사진 · 나이 · 숫자 0(시험 + 웹 3폭) · 21-18 '이번 주 대화방이 열려 있어요.' |
| 상대 화면 사주 글자 · 별자리 이름 0(PF-14) | 궁합 카드 = 관계 문장만(시험 + 웹) |
| AI 호출 0 · 유료 0 · live 0 | 앱은 라이브러리 id 만 · 실서버 스위치 꺼짐 그대로 |
| 기기에만 남는 글 | 9종 SecureStore · 서버 전송 0 |
