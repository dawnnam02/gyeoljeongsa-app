# LG-F 탑승객 라운지 앱 (D-220 · 10-28 ~) — 이어하기 메모(멈춰도 여기부터)

- 기준: `팀장/세부청사진/LG_라운지.md`(L1 ~ L6 · 3장) · `기획/정책.md` L장(PL-01 ~ 35) · `기획/화면_요구사항.md` T4 '라운지 줄' · T6 · `마케팅/카피.md` 19장(글 209 · 19-11 서버 ↔ 키 · 19-12) · `backend/R_변경기록.md` 10-4 · `backend/migrations/0042_lounge.sql`(읽기만) · `보안/LG_라운지위협.md` LGF-01 ~ 16 · `디자인/LG_라운지/비교.html` 1A ~ 5A · `원본/` 아이콘 9 + 켜짐 1 · `수익/LG_라운지_비용.md`
- 순서(본인 승인): 문서 → 서버 → **앱(이 작업)** → 검수. 푸시 0(팀장)
- 바닥선(4c9f5e8): check:copy 102/2(A · I = 법무 원본 개정, gen:legal 전)
- 팀장 신호(10-28 작업 중): 법무 원본 반영 끝 → **gen:legal 은 따로 한 커밋**(b5d7863) — CK6 consent-2026.10.28-v1 · 약관 · 처리방침 · 동의 지문 · `laterConsent` IF2_CONSENT_VERSIONS(CK17A · CK17B 판 값만, 화면은 IF2-F) · PROFILE.firstBody(같은 취미) · IMAGE_CREDIT.aiWriting(12 정보 생성형 AI 글 고지 둘째 문장) = 동의문구 5-6 글자 그대로 · 카피.md 03-2 CK6 '열 개' · 14-2 · 12 줄 같이(마케팅 검토 대기) · check:copy 104/0

## 0. 청사진 (시작 전)

| # | 세부 목표 | 통과 조건(측정) |
|---|---|---|
| 1 | 스위치 `lounge`(live 꺼짐 · 데모 켜짐) | featureKeys.json 1줄 · r1Common 키 수 · 꺼짐이면 T4 줄 0 · T6 주소 → T4 목록(PL-35) |
| 2 | 서버 응답 읽기(0042 이름 · 모양 그대로) | `loungeApi` 10함수 + 실시간 `lounge:<객실>` post · gone(`id · seat · body · at`만 읽음) · feature_off → 꺼짐 · 회원 id 읽는 곳 0 |
| 3 | 데모 백엔드 = 0042 응답 모양 | `demo/loungeDemo` — 가상 탑승객 20좌석 · 기장 안내 · 장면 12 · 같은 파서로 읽힘(시험) |
| 4 | T4 라운지 줄 | 비행 중만 · 상태 글(19-2) · 좌석 · 인원 · 미리보기 · 새 글 점 · 숫자 0 · 목록 먼저 · 실패면 줄 0 · 구독 0 · 공개 뒤 줄 0(짝 방이 맨 위) |
| 5 | T6 라운지 | 상태 12(0042) + 불러오는 중 · 오류 · 첫 입장 버튼 하나 + [나중에] · 쪽지 뜯기 400ms → 좌석 · 좌석표(내 자리만 점) · 말풍선 · 기장 점선 쪽지 · [나도 답하기] · 공감 하나 · 인용 · 숨김 · 신고(사유 5) · 지우기 · 위기 안내(나만) · 보내기 실패 code 전부 · 최근 200 · 동작 줄이기 |
| 6 | 아이콘 원본 연결 | `원본/paths.json` 9개 = 앱 경로(시험) · 켜짐 = accentSoft 채움 |
| 7 | 카피 19장 키 · check:copy 대조 | `loungeCopy.ts` = 카피 209줄(새 그룹 LG) · 금지어 14 · 창가/통로/가운데 · 느낌표 · 숫자 0 · 19장 '앱 반영 전' 표시 꼴만 바꿈 |
| 8 | 시험 | LGF-01 ~ 16 같은 번호 · 상태별 · 숫자 0 · '익명' 0 grep · 실시간은 T6 볼 때만 · closed/kicked 구독 해제 · 기기 저장 0 |
| 9 | 웹 점검 | 새 `web-lounge`(360 · 390 · 430) + f1 · f3 · f7 · w6 · d46 |
| 10 | 바닥선 | tsc 0 · jest 전부 · check:copy 0 · tokens · check_sec2(실패 F-05s만) |

## 1. 만든 · 바꾼 파일

| 파일 | 한 일 |
|---|---|
| `src/features/lounge/loungeCopy.ts` | 카피 19-1 ~ 19-10 글 208개(설명 줄 `a11y.tearDone` 빼고) · 위기 안내 기관 · 번호 `LOUNGE_CRISIS_LINE`(법무 LG 메모 9장 109 — 켜기 전 원문 대조) |
| `loungeApi.ts` | 0042 앱 함수 10 + 0043 `get_lounge_report_note` · 응답 파서(회원 id 키 0) · 실시간 구독(비공개 채널 · broadcast post · gone · 내용 넷만) · 오류 off · network · server |
| `loungeLogic.ts` | 줄 글 · 할 수 있는 것(공감 · 숨김 · 신고 · 고르기 · 쓰기) · 보내기 실패 글(19-11) · 200개 · 숨김 · 지움 · 인용 상자 · 기장 글 · 결과 말 세 단계 · 여행지 · 읽기 이름 |
| `LoungeIcon.tsx` | 원본 paths.json 9개(공용 iconPaths 61개와 따로) · 켜짐 accentSoft |
| `LoungeRow.tsx` | T4 맨 위 줄(1A 종이 줄 · 절취선 · 빈 좌석 칸 / ›) + `useLoungeRow` |
| `LoungeScreen.tsx` · `LoungeParts.tsx` | T6 전부(머리 · 첫 입장 · 쪽지 · 좌석표 · 객실 · 기장 쪽지 · 시트 7 · 확인창 3 · 토스트 + [다시 보기] · 데모 줄) |
| `loungeService.ts` · `src/app/lounge.tsx` | 앱 연결 · 라우트 T6 |
| `demo/loungeDemo.ts` · `loungeDemoScenes.ts` | 데모 모의 서버(0042 모양) · 실시간 흉내 · 장면 12 |
| `theme/loungeLook.ts` | 치수 · 움직임 값(뜯기 400 · 22 · 5° · 끝 160) |
| `lib/demoBackend.ts` · `demoClient.ts` · `demo/boardingDemo.ts` | 데모 연결(lounge_* · channel · removeChannel) · `flightOf`(탄 사람 · 마감 뒤 · 공개 뒤) |
| `features/chat/ChatListScreen.tsx` · `app/(tabs)/chat.tsx` | 목록 맨 위 라운지 줄(lounge 를 줄 때만) |
| `config/featureKeys.json` · `navigation/screens.ts` · `flow.ts` | 스위치 `lounge`(LG 묶음) · 화면 T6 · 화살표 4 |
| `scripts/check-copy.mjs` | 새 그룹 LG(카피 19장 209줄 ↔ 앱 · 카피 밖 글 0 · 금지어 · 숫자 · 느낌표) |
| `scripts/web-lounge.mjs` · `package.json` | 새 웹 점검(`npm run check:lounge`, SHOT_WIDTH 360 · 390 · 430) |
| 시험 | 새 `lgfLoungeApi.test.ts` 20 · `lgfLounge.test.tsx` 16 · 고침 `r1Common`(94키) · `routes`(23화면) |
| `마케팅/카피.md` 19장 | 머리 '앱 반영 전' → '앱 반영' · 19-12 제목 · 두 줄(표시 꼴만 — 다른 장 0) |

## 2. 상태

| 단계 | 상태 |
|---|---|
| 0 읽기 · 청사진 | 끝 |
| gen:legal(팀장 신호) | 끝 — b5d7863(라운지와 따로 한 커밋) |
| 1 ~ 7 | 끝 |
| 팀장 덧붙임 ① check_sec2 P7-b(loungeApi safeLog) | 끝 — 이벤트 이름을 만드는 변수 이름 `name` → `fn`(넘기는 값은 원래도 함수 이름 · 결과 코드뿐, 규칙 낱말에 걸림) · P7-b 통과 |
| 팀장 덧붙임 ② 0043 `get_lounge_report_note` | 끝 — 신고 뒤 한 번 읽어 no_pair 면 `LOUNGE.report.pairNote`(카피 19-7 '이번 회차에는 이 좌석의 분과 이어지지 않아요.')를 '이 좌석의 글도 숨길까요?' 확인창 아래 줄에(이미 숨긴 좌석이면 토스트 둘째 줄) · 못 읽으면 줄째 없음 · 데모도 같은 규칙(RP4 · RP6 · RP7 · 17:30 전 · 3쌍) |
| 8 시험 · 9 웹 · 10 바닥선 | 끝(3장) |

## 3. 확인 숫자 (10-28, 마지막 코드 기준)

| 확인 | 결과 |
|---|---|
| tsc | 0 |
| eslint(expo lint) | 0 |
| jest 전부 | 101묶음 1,765/1,765(새 lgfLoungeApi 20 · lgfLounge 16) |
| check:copy | 105/0(새 LG 1 — 카피 19장 209줄 ↔ 앱 글 208 · 카피 밖 글 0 · 금지어 · 숫자 · 느낌표 0) · grade W9 통과 |
| check:tokens | 5/0 |
| 웹 web-lounge | 360 · 390 · 430 각 64/0(장면 12 · 첫 입장 · 실시간 답 · 신고 사유 5 · 넘침 · 글자 13 · 터치 48 · 숫자 0 · 콘솔 오류 · 바깥 요청 0) — 캡처 `확인/스크린샷/LG_<폭>/` |
| 웹 f1 · f3 · f7 · w6 · d46 | 76/0 · 75/0 · 65/0 · 36/0 · d46 390 17/0 · 360 17/0 |
| check_sec2 | 108건 = 통과 103 · 실패 1(F-05s npm audit만) · 정보 4 — P7-b 통과 · P7-f 3곳 그대로 · LG-a ~ g 통과 |

## 4. 결정 · 원본과 다르게 한 곳(넘길 것)

| 자리 | 한 일 | 까닭 |
|---|---|---|
| 숨김 직후 [되돌리기](PL-24) | 토스트 글자 버튼 = `LOUNGE.hidden.unhide`('다시 보기') | 카피 19장에 되돌리기 키 없음 — 마케팅 확인 |
| 좌석표 [객실로] · 배정 장면 [라운지 들어가기] · [좌석표 보기] | 좌석표 = 시트, 버튼 `LOUNGE.menu.close`('닫기') · 머리 '내 좌석 13A'를 누르면 좌석표 | 카피 키 없음 |
| 1A 와인 꼬리 '탑승객 라운지 입장권' | 줄에 글 0(좌석 아이콘 · 절취선 · 빈 좌석 칸만) | 카피 키 없음 |
| 신고 설명 칸 | `REPORT_SHEET.descLabel` · `descPlaceholder` · 200자 | 화면 요구 T6 '사유 이름은 REPORT_SHEET 재사용' |
| 강퇴 줄을 누름 | T6 강퇴 화면(카피 19-2) | 기획 T4 '이동 0'과 다름 — 카피를 따름 |
| 약속 전체 보기 | 약관에 '제9조의4' 조가 생기면 그 조 · 없으면 약속 세 줄 시트 | 지금 게시본에 라운지 조항 없음(법무 LG-L 안) |
| 숨긴 좌석 목록 | 이 화면 메모리만(다시 들어오면 빈 목록 · 서버 숨김은 그대로) | 서버에 '내가 숨긴 좌석' 읽는 함수 없음 · 기기 저장 0 |
| T4 줄 | `lounge_state` 한 번(최근 200개가 같이 옴) | 줄 전용 가벼운 응답 없음 — 수익 위험 5(대역폭) |
| 착륙 준비 → 닫힘 | 착륙 준비 상태에서만 5분마다 다시 읽기 | 18:00 닫힘 이벤트 없음 |
| 위기 안내 번호 | 자살예방 상담전화(109) | 법무 LG 메모 9장 2차 확인 — 켜기 전 원문 대조 |
| 신고 쌍 안내 글 | 카피 19-7 글 그대로 | 백엔드 0043 주석 · 팀장 글('이번 회차에 이분과 짝이 되는 일은 없어요')과 다름 — 마케팅 · 팀장 확인 |
| 수익 U4 | 채팅 실시간은 대화방을 볼 때만 · 라운지는 T6 볼 때만 — 늘 열어 두는 연결 0 | 앱개발 확인 거리 답 |

## 5. 데모 장면(검수 LG-Q · 테스트웹)

- 이메일 앞부분: loungefirst(처음) · loungeon · loungemorning · loungedark · loungeland · loungeclosed · loungecaptain · loungeempty · loungepaused · loungekicked · loungeleft · loungerules. lounge 가 없는 이메일은 탑승권 데모에서 탄 뒤에만(공개 뒤 = 닫힘 · 줄 0)
- T6 맨 아래 '데모 · 라운지 장면' 줄로 장면을 차례로 바꿈 · 글에 '데모실패' = 처음 한 번 인터넷 실패 · 위기 낱말(예 '사라지고 싶') = 쓴 사람에게만 안내 · 내 첫 글 1.5초 뒤 가상 탑승객 답(실시간)
