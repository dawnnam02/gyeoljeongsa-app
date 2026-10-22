# 결정사 앱 (app/)

- 결혼을 전제로 만나려는 사람들을 위한 데이팅 앱. 스택: Expo(React Native) + TypeScript + Expo Router + Supabase.
- **지금 상태: F0 골격 + F1(01 온보딩 · 02 가입(이메일 인증번호) · 03 동의 9항목 · 15 인증 실패) + F3(06 AI 정리 중 · 07 내 성향) + F4(08 내 프로필 · 공개 범위 토글 9) + F10(법무 게시본 생성 규칙) + D15(스플래시 · 01 소개 그림) + F5(09 오늘의 추천 · 13 추천 없음 · 10 상대 프로필) + F6(11 호감 · 14 호감 없음 · 10 하단 4종) + F7(12 설정 · 하위 화면 9개 · 공용 신고 · 차단 시트 · 탈퇴 인증번호 재확인) + F2L(04 · 05 임시 짧은 설문, 데모 전용) + F11(하단 탭 상점 · 머리 오른쪽 위 원형 프로필 사진 · 기본 프로필 그림 · 16 상점 · 08 탭 밖).** 나머지 화면은 자리 표시이고 본문은 F2 · F4~F7이 채운다(설문 04 · 05 는 다른 직원 담당). 이동 · 토큰 · Supabase 클라이언트 · 상태 저장소는 F0 에서 갖춰졌다.
- 청사진 · 세부청사진: `../팀장/직원별_청사진/앱개발.md` · `../팀장/세부청사진/F0.md` · `F1.md`. 검증 기록: `확인/F0_검증.md` · `확인/F1_검증.md` · `확인/F3_검증.md`.

## 설치 · 실행

| 하는 일 | 명령 |
|---|---|
| 처음 한 번: 패키지 설치 | `cd app` → `npm install` |
| 처음 한 번: 환경 파일 | `cp .env.example .env` 한 뒤 `../backend/.env` 의 `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` 두 값을 `EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 로 옮긴다 |
| 실행(휴대폰 Expo Go 또는 에뮬레이터) | `npx expo start` |
| 웹 미리보기(개발용) | `npm run web` |
| Android · iOS 에뮬레이터 | `npm run android` · `npm run ios` |

- `app/.env` 는 저장소에 올리지 않는다(`.gitignore`). 값은 문서 · 채팅 · 커밋에 쓰지 않는다.
- 앱이 읽는 환경 변수는 **셋뿐**이다: 서버 주소 · publishable 키, 그리고 데모 표시 `EXPO_PUBLIC_DEMO_MODE`(아래). secret · service 키는 앱에 넣지 않는다(보안/구성.md 9-1).

### 데모 모드 (테스트웹 TW1 · 가입 · 동의는 F1, 나머지 본문은 F8)

- `EXPO_PUBLIC_DEMO_MODE=1` 이면 `src/lib/supabase.ts` 가 서버 대신 **메모리 모의 클라이언트**(`src/lib/demoClient.ts` + 규칙은 `src/lib/demoBackend.ts`)를 쓴다. 이때는 서버 주소 · 키가 없어도 시작한다.
- 기본은 꺼짐(값이 없거나 `1` 이 아니면 끔). 모의 클라이언트는 **02 가입 · 03 동의 흐름이 끝까지 도는 만큼**만 있다: `otp-gate`(발송 한도 · 3분 · 5번 틀리면 10분 잠금) · `underage-reject`(만 19세 판정 · 3번 거절이면 30일 잠금) · `save_answers`(생년월일) · `account_status` · `profiles` · `consents`. **F3 가 더한 것**: `ai-profile`(start · retry · manual, 모의 응답 3종: 정상 4초 · 실패(다시 시도해도 계속 실패) · 지연 75초) · `ai_results`(읽기 · `user_edited` 열만 수정, 원본 `result` 는 거절) · `confirm_profile`. 04 화면 아래에 데모 전용 '설문 완료로 건너뛰기' 세 버튼(정상 · 실패 · 지연)이 06 으로 가는 길이다(설문은 다른 직원 담당). 그 밖의 데이터 호출(설문 · 사진 · 추천 · 호감 …)은 F8 에서 채우고, 부르면 무엇이 빠졌는지 알려 주며 멈춘다.
- 메일은 보내지 않는다. 인증번호는 항상 `123456` 이고 화면이 데모 모드에서만 이 번호를 알려 준다. `fail` 로 시작하는 이메일은 발송 실패를 보여 준다.
- **스토어에 내는 빌드(EAS production)에서는 설정하지 않는다.** 서버에 요청하지 않고 기기에 아무것도 저장하지 않는다. 데모 번들 만들기: `npm run check:web:demo`(`dist-demo/`, 서버 주소 · 키는 비운다).
- 웹은 세션을 **메모리에만** 둔다(페이지를 닫으면 사라진다). `localStorage` · `sessionStorage` 에 토큰을 두지 않는다(보안 결정 전).

### 웹 미리보기 · 배포

- `app.json` 의 `web.output` 은 `single`(정적 호스팅용 단일 페이지: `index.html` 하나, 서버 설정으로 모든 주소를 `index.html` 로 돌려야 한다). 문서 언어는 `ko`(`web.lang`).

## 확인 명령 (모두 무료)

| 무엇을 | 명령 | 통과 기준 |
|---|---|---|
| 타입 검사(strict) | `npm run typecheck` (= `npx tsc --noEmit`) | 오류 0 |
| 린트 | `npm run lint` (= `npx expo lint`) | 오류 0 |
| 시험 | `npm test` | 전부 통과 |
| 토큰 = 가이드 · 색 직접 쓰기 0 | `npm run check:tokens` | 실패 0 |
| Supabase 연결(읽기 전용, 서버에 요청 2번) | `npm run check:supabase` | 실패 0 |
| 웹 번들 | `npm run check:web` (= `npx expo export --platform web`) | 끝까지 성공 |
| 화면 글 = 법무 · 마케팅 문서(03 체크 9칸 · 안내 · 요약 · 오류 · 01 · 02 글) | `npm run check:copy` | 실패 0 |
| 법무 문서(동의문구 · 약관 · 처리방침 · 판_관리) → `src/content/*.ts` · `src/config/consent.ts` 판 블록 다시 옮기기(원본이 바뀌었을 때). 표식(`<!-- app:… -->`)을 걸러 머리말 · 부록 · 작업 표시를 뺀다. 판을 올린 뒤에는 `-- --fingerprints`(글 지문 새로 적기), 출시 빌드 점검은 `-- --release`(게시 글에 `{…}` · `{공개일}`이 남으면 실패) | `npm run gen:legal` | 쓴 파일 3개 · 판 13개 |
| 웹 화면 점검(헤드리스 Edge · 화면 16개 · 탭바 · 누름 효과 · 동작 줄이기. 먼저 `check:web`) | `npm run check:smoke` | 실패 0 |
| 데모 모드 웹 번들 만들기 | `npm run check:web:demo` | 끝까지 성공 |
| F1 화면 점검(헤드리스 Edge · 360 폭 · 01 → 02 → 03 처음부터 끝까지 · 오류 상태 · 스크린샷. 먼저 `check:web:demo`) | `npm run check:f1` | 실패 0 |
| F3 화면 점검(헤드리스 Edge · 360 폭 · 정상 · 실패 · 지연 3흐름 · 편집 · 확정 · 원본 보존 · 약 2분. 먼저 `check:web:demo`) | `npm run check:f3` | 실패 0 |
| F5 화면 점검(헤드리스 Edge · 360 폭 · 09 카드 3장 · 10 공개/비공개 · 사진 넘김 · 넘기기 · 호감 · 신고 사유 8 · 차단 · 0명 · 준비 중(NK02) · 첫 추천 대기(NK01) · 만료 · 오류 · 한도 · 볼 수 없음. 먼저 `check:web:demo`) | `npm run check:f5` | 실패 0 |
| F2L 임시 설문 점검(헤드리스 Edge · 360 폭 · 04 10쪽 · 05 사진 3장(예시 그림) · 06 까지. 먼저 `check:web:demo`) | `npm run check:f2l` | 실패 0 |
| F6 화면 점검(헤드리스 Edge · 360 폭 · 11 탭 3 · 수락 · 거절 · ⋯ 차단 · 빈 상태 3 · 만료 · 실패 · 연결할 수 없음 · 10 하단. 먼저 `check:web:demo`) | `npm run check:f6` | 실패 0 |
| F7 화면 점검(헤드리스 Edge · 360 폭 · 12 목록 · 알림 · 보안 · 동의 관리 · 차단 목록 · 신고 내역 · 고객센터 · 안전 안내 · 라이선스 · 이미지 고지 · 약관 시트 · 탈퇴(틀림 · 맞음 · 발송 실패) · 로그아웃 · 10 신고 → 12. 먼저 `check:web:demo`) | `npm run check:f7` | 실패 0 |
| 오픈소스 라이선스 목록(12 › 정보) 다시 만들기: 직접 의존만(기본) · 의존 트리 전체(`-- --all`, 스토어 빌드 전) | `npm run gen:licenses` | `src/features/settings/licenses.json` |
| 번들에 실제로 들어가는 패키지만 골라 `npm audit` 와 교차(소스맵 번들을 임시로 만든다, 몇 분. `npm audit fix --force` 는 쓰지 않는다) | `npm run check:bundle-audit` | 번들 안 치명 · 높음 0 |
| F11 화면 점검(헤드리스 Edge · 360 폭 · 탭 4 · 원형 사진 · 08 탭 밖 · ‹ · 16 상점 · 기본 그림. 먼저 `check:web:demo`) | `npm run check:f11` | 실패 0 |
| F4 화면 점검(헤드리스 Edge · 360 폭 · 07 확정 직후 08 · 탭 08 · 저장 · 잠금 · 저장 실패 · 사진 반려 · 승인. 먼저 `check:web:demo`) | `npm run check:f4` | 실패 0 |
| 프로젝트 건강 검진 | `npx expo-doctor` | 실패 항목 없음 |
| 위 앞 네 개와 글 점검을 한 번에 | `npm run check` | |

## 임시 설문(F2L) — AYLA'S 설문으로 교체 예정

- 04 설문 · 05 사진 등록은 **테스트용 짧은 판**이고 **데모 전용**이다(본인 지시 2026-10-15, 세부계획 D-48). 문항 12개(A01 · A03 · A05 · B01 · C05 · D03 · E08 · E13 · T01 · F01 + 05 의 G01 사진 · G03 스타일)로 입력형태 11종을 한 번씩 쓴다. 문항 ID · 글은 `기획/설문_문항표.csv`(사용 61문항, D07 삭제) · `마케팅/카피.md` 04 · 05 그대로(`check:copy` P 그룹).
- 임시판 동안 09 빈 상태의 [희망 조건 보기] · 보조 한 줄과 12 설정의 '희망 조건 수정' 줄을 숨긴다(`config/flags.ts` `PREFERENCES_EDIT_ENABLED = false`).
- 코드: `src/features/surveyLite/` · `src/features/photosLite/` · `src/content/surveyLiteCopy.ts` · `src/lib/surveyLiteApi.ts` · `src/lib/surveyLiteDemo.ts` · 시험 `src/__tests__/surveyLite*.test.tsx` · 점검 `scripts/web-f2l.mjs`(`npm run check:f2l`). 파일마다 첫 줄에 `// 임시(F2L) — AYLA'S 설문으로 교체 예정`.
- 데모 모드: 답은 메모리, 사진은 예시 그림 3장(실제 사진을 고르거나 올리지 않는다). 장면: `litesavefail…` 저장 실패 · `litephotofail…` 칸마다 첫 올리기 실패. 데모 모의 서버의 `get_progress` 는 `demoLiteProgress` 로 설문 · 사진 진행을 읽는다.
- **교체 절차**(AYLA'S 결과가 오면): ① `기획/설문_인수조건.md` 표로 받은 코드를 대조 ② 위 파일과 `scripts/web-f2l.mjs` · 시험 3개를 지운다(`grep -rl "임시(F2L)" src scripts` 가 0이 될 때까지) ③ `src/app/survey/[step].tsx` · `src/app/photos.tsx` 를 정식 화면으로 바꾸고 데모 건너뛰기 바는 남긴다 ④ `package.json` 의 `check:f2l` · `check-copy.mjs` 의 P 그룹 · `demoBackend.ts` 의 `demoLiteProgress` 줄을 지우고 `PREFERENCES_EDIT_ENABLED` 를 true 로 ⑤ `npm run check` · `check:f1 · f3 · f4 · f5 · f6 · f7 · smoke` 다시.

## 화면 16개

| ID | 이름 | 주소 | 채우는 세부계획 |
|---|---|---|---|
| 01 | 온보딩 | `/onboarding` | F1(본문 있음) |
| 02 | 가입·로그인 | `/sign-in` | F1(본문 있음) |
| 03 | 약관·동의 | `/consent` | F1(본문 있음) |
| 04 | 설문 | `/survey/[step]` (01~32, 12는 결번) | F2L(임시 본문 있음 — 데모 전용, AYLA'S 설문으로 교체 예정) |
| 05 | 사진 등록 | `/photos` (`?mode=reupload` = 08 반려 배지에서 다시 올리기) | F2L(임시 본문 있음 — 데모 전용) |
| 06 | AI 정리 중 | `/analysis` | F3(본문 있음) |
| 07 | 내 성향 | `/traits` (`?mode=manual` = 직접 입력 상태) | F3(본문 있음) |
| 08 | 내 프로필 | `/profile` (탭이 아니라 탭 위에 열리는 화면 — 탭 화면 오른쪽 위 원형 사진으로 들어오고 ‹ 로 돌아간다. `?first=1` = 07 확정 직후 처음 한 번 확인) | F4(본문 있음) · F11(탭 밖으로) |
| 09 | 오늘의 추천 | `/recommendations` (탭) | F5(본문 있음) |
| 10 | 상대 프로필 | `/candidate/[id]` | F5(본문 있음) |
| 11 | 호감 | `/likes` (탭, `?tab=connected` = 연결 알림으로 들어옴) | F6(본문 있음) |
| 12 | 설정 | `/settings` (탭. 하위 화면 9개 · 약관 시트 · 탈퇴 2단계는 12 안의 쪽이라 라우트가 아니다) | F7(본문 있음) |
| 13 | 추천 없음(09의 상태) | `/recommendations-empty` | F5(본문 있음) |
| 14 | 호감 없음(11의 상태) | `/likes-empty` | F6(본문 있음: 받은 호감 0건 · 그림) |
| 15 | 인증 실패(02의 상태) | `/sign-in-code-error` | F1(본문 있음: 02 의 '인증번호 틀림' 모양을 그대로 보이는 점검용 화면) |
| 16 | 상점 | `/shop` (탭) | F11(본문 = 무료 '내 성향 리포트' 카드 하나. 상품 목록 · 등급은 F13) |

- 탭바 4개: 추천 · 호감 · 상점 · 설정. 내 프로필(08)은 탭 화면(09 · 11 · 12 · 13 · 14 · 16) 머리 오른쪽 위 원형 사진(지름 32 · 터치 44, `components/ProfileButton.tsx`)으로 들어간다. 사진이 없거나 반려되면 기본 프로필 그림(`components/ProfileAvatar.tsx` · `assets/icons/avatar/`). 화면 이동 화살표 전체는 `src/navigation/flow.ts`(K2 흐름도 · 분기 8개).

## 폴더

| 경로 | 내용 |
|---|---|
| `src/app/` | 라우트(Expo Router). 파일 하나 = 화면 하나 |
| `src/components/` | `Pressable`(누르는 모든 것) · `Button`(주 · 보조 · 강조 윤곽 · 흐림 · 불러오는 중) · `TextButton` · `AppText` · `TextField`(입력) · `CheckBox` · `InfoBox`(안내 상자) · `ScreenHeader`(‹ 상단 바) · `FullSheet`(올라오는 시트) · `LegalBlocks`(약관 · 처리방침 그리기) · `TabBarButton` · `TabBarParts` · `ScreenPlaceholder`(F2~F7 이 채우면 빠진다) |
| `src/features/` | 화면 본문. `onboarding/`(01) · `auth/`(02 상태기계 `signInMachine` · 동작 `useSignIn` · 화면 `SignInScreen`) · `consent/`(03 체크 규칙 `consentLogic` · 줄 · 요약 시트 · 읽기 화면 · `ConsentScreen`) · `likes/`(11 · 14: `LikesScreen` 탭 3 · 목록 · 수락 · 거절 · `likeGate` 10 하단 버튼 규칙(0011 거절 숨김 뒤 규칙 ② 만 남음)) · `settings/`(12: `SettingsScreen` 목록 · 하위 화면 · `WithdrawFlow` 탈퇴 2단계 · `deviceDeps` 클립보드 · 푸시 권한 · `licenses.json` 생성물) · `safety/`(10 · 11 공용: `ReportBlockSheet` 신고 · 차단 시트 · `MoreButton` ⋯ · `SafetyLine` 안전 한 줄). `src/app/` 의 라우트 파일은 이 본문을 가져다 쓴다 |
| `src/content/` | 화면에 싣는 글. `copy.ts`(01 · 02 · 03 글, 카피.md 그대로) · `consentContent.ts` · `legalTerms.ts` · `legalPrivacy.ts` · `fillIns.ts`(판_관리 7장 '값', **법무 문서에서 자동 생성**, 직접 고치지 않는다: `npm run gen:legal`) · `settingsCopy.ts`(12 설정 글, 카피.md 12) · `likesCopy.ts`(11 호감 글, 카피.md 11) · `surveyLiteCopy.ts`(04 · 05 임시 설문 글 · 12문항, 카피.md 04 · 05 · 문항표) · `supportContact.ts`(고객센터 값 = fillIns) · `traitsContent.ts`(07 5축 이름 · 근거 문항 이름 · 직접 입력 태그 후보) · `demo.ts`(데모 안내) · `types.ts` |
| `src/theme/` | `tokens.ts`(색 · 글자 · 간격 · 누름 효과 값 — 가이드 8장 그대로) · `layout.ts`(토큰에 없는 컴포넌트 치수: 체크 칸 · 입력 테두리 · 01 로고 …) · `color.ts`(투명도 색) · `tabIcons.ts` · `photoIcons.ts` · `uiAssets.ts`(뒤로 · 체크 · 닫기 아이콘 · 13 빈 상태 그림 · 최종 가로 로고(여백 없는 판 1244×544), 높이는 `layout.ts` 의 `WORDMARK_PX` 비율) · `fonts.ts` |
| `src/navigation/` | 화면 ID · 이동 화살표 · 로그인 뒤 진행 단계 · 설문 쪽 번호 · 켜질 탭(`activeTab.ts`) · 이동 보조(`go.ts`: 앞으로 갈 때 쌓지 않기 · 뒤로) |
| `src/lib/` | `supabase.ts`(클라이언트) · `demoClient.ts` · `demoBackend.ts`(데모 모드 모의 서버, 장면 `cfcycle` = 07 확정 실패 4종 차례로) · `recsApi.ts`(09 · 10: 오늘의 추천 · 상대 프로필 · 호감 · 넘김 · 신고 · 차단 — 아는 키만 읽는다) · `demoRecs.ts`(데모 모의 서버의 09 · 10, 장면은 이메일 앞부분: `rec0` 0명 · `recexpired` 곧 갱신 · `recflaky` 처음 한 번 실패 · `reclimit` 호감 한도 · `recgone` 볼 수 없음 · `recphoto` 사진 모두 승인 · `recprep` 준비 중 NK02 · `recfirst` 첫 추천 대기 NK01 · `recone` / `rectwo` 추천 1 / 2명 + 지역 안내 F16) · `likesApi.ts`(11 · 10: list_likes · accept_like · decline_like) · `likesDemo.ts`(데모 모의 서버의 11, 장면: `like0` 0건 · `likeexp` 90초 뒤 만료 · `likegone` 수락 불가 · `likefail` 늘 실패 · `likeflaky` 첫 번 실패 · `likedecl` 보낸 호감이 바로 거절(0011: 보낸 사람에게는 만료까지 대기와 같음)) · `settingsApi.ts`(12: 차단 목록 · 해제 · 신고 내역 · 알림 열 · 선택 동의 켜기/철회 · delete-account 탈퇴) · `settingsDemo.ts`(데모 모의 서버의 12, 장면: `settings` 차단 2 · 신고 3 · `wdsendfail` 탈퇴 발송 실패 · `wdlimit` 발송 한도 · `setfail` 인터넷 실패) · `toastBus.ts` · `captureBlock.ts` · `aiApi.ts`(06 · 07: ai_results 읽기 · ai-profile · user_edited 저장 · confirm_profile) · `demoAiSample.ts`(모의 AI 결과 = mock_20 첫 사례) · `authApi.ts`(otp-gate · underage-reject · save_answers) · `progress.ts`(진행 단계를 서버에서 읽기) · `consentApi.ts`(동의 기록 읽기 · 저장) · `serverError.ts` · `emailRules.ts` · `birthDate.ts`(만 19세 판정) · `otpClock.ts` · `services.ts` · `secureStorage.ts` · `chunkedStorage.ts` · `log.ts` · `reduceMotion.ts` |
| `src/features/recs/` | 09 · 10 본문. `RecommendationsScreen`(09 · 13: 카드 · 남은 시간 · 빈 상태 · 만료 때 다시 읽기) · `CandidateScreen`(10: 사진 넘김 · 표 · 왜 추천했나요 · 넘기기 · 호감) · 신고 · 차단 시트는 `features/safety/ReportBlockSheet`(F7 공용, 11 행의 ⋯ 도 같은 것을 쓴다) · `PhotoBox` · `recsLogic`(맞는 점 이름 19개 · 남은 시간 · 표 3줄) · `usePhotoUrls` |
| `src/features/ai/` | 06 · 07 본문. `AnalysisScreen` · `useAnalysis`(3초 읽기 · 60초 안내 · 120초 실패 · 다시 시도 · 직접 입력) · `analysisLogic`(시간 규칙) · `TraitsScreen`(보기 · 수정 · 직접 입력) · `traitsLogic`(칩 · 요약 검사 · 5단위) · `TraitBar`(막대 · 끌기 막대) · `TagEditor` · `EvidenceList`(근거 접기/펼치기) · `manualOffer`(06 → 07 재료) · `DemoSkipBar`(데모 전용 '설문 완료로 건너뛰기') |
| `src/store/` | 가입 진행 · 설문 임시 저장(zustand) |
| `src/config/` | `env.ts`(환경 변수) · `flags.ts`(캡처 차단 · AI 모의 · 사진 한도) · `consent.ts`(동의 문구 판 · 글 지문) |
| `src/types/` | 진행 단계 · 설문 답의 모양(등급 · 점수 필드 없음) |
| `src/__tests__/` | 시험(이동 · 저장 · Supabase 배선 · 누름 효과 · 정적 규칙 · 입력 규칙 · 02 상태기계 · 모의 서버 흐름 · 01 · 02 · 03 화면 · 법무 글) |
| `scripts/` | `check-tokens.mjs` · `check-supabase.mjs` · `web-smoke.mjs`(F0) · `check-copy.mjs` · `gen-legal-content.mjs` · `export-demo.mjs` · `web-f1.mjs`(F1) · `web-f3.mjs`(F3) · `lib/`(법무 문서 읽기 · 브라우저 도우미) |
| `확인/` | 검증 기록 `F0_검증.md` · `F1_검증.md` · `F3_검증.md` · 스크린샷(`스크린샷/`, `check:smoke` · `check:f1` 이 만든다) |
| `assets/` | 앱 아이콘(`디자인/로고/최종/`에서 복사) · 탭 아이콘 8개(`디자인/아이콘/탭바/`) · 뒤로 · 체크 · 닫기 아이콘(`디자인/아이콘/투명/`) · 01 가로 로고(`디자인/로고/최종/결정사_로고_가로.png`) · 05 카메라 아이콘(`디자인/아이콘/색변형/06_카메라추가_보조.png`) · Pretendard 글꼴. 복사본이 원본과 같은지 시험이 본다 |

## 지키는 규칙

- **토큰만 쓴다**: 색 · 글자 · 간격은 `src/theme/tokens.ts`. 린트(`no-restricted-syntax`)와 `check:tokens` 가 직접 쓴 색 · 굵기를 막는다.
- **누르는 것은 `components/Pressable.tsx` 하나**: 버튼 · 카드 · 탭(규격은 가이드 10장). 누르면 0.96배(80ms) · 떼면 1배(120ms), 가운데서 퍼지는 원(250ms 퍼지고 150ms 사라짐, 20%, 주 버튼 위는 흰색) — iOS · 웹 · Android 모두 같다. 쓰는 효과는 `effect` 로 고른다(기본 버튼 `both` · 탭 칸 `ripple` · 카드 `scale` · 그 밖 `none`). Android 시스템 ripple 은 `systemRipple` 을 줄 때만. '동작 줄이기'를 켜면 크기 변화 없음 · 원은 크기와 시간 절반. react-native 의 Pressable · Touchable* 는 린트가 막는다.
- **탭바**: 현재 탭 = 채움 아이콘 + 라벨 Bold 브랜드색, 나머지 = 선형 회색 아이콘 + Regular 회색. 13 · 14 에서도 추천 · 호감 탭이 켜진다(`navigation/activeTab.ts`). 아이콘 파일은 `theme/tabIcons.ts` 한 곳.
- **저장**: 세션 · 설문 답은 SecureStore 조각 저장소(`secureStorage.ts`). AsyncStorage 에는 앱 설치 표식만.
- **로그**: `safeLog`(`lib/log.ts`) 하나로만, 허용된 키만(이벤트 이름 · 코드 · 상태 · 시간 · 개수). `console.*` 는 린트가 막는다.
- **인증번호는 `otp-gate` 서버 함수로만**: 앱은 Supabase Auth 의 `/otp` · `signInWithOtp` 를 직접 부르지 않는다(발송 한도 · 틀림 잠금이 이 관문에만 있다, 보안/구성.md 3장). 만 19세 판정은 `underage-reject` 가 서버에서 한다. 시험이 `signInWithOtp(` 가 코드에 없는지 본다.
- **법무 문구는 글자 그대로**: 03 의 체크 9칸 · 요약 · 전문 · 안내 상자와 02 가입 안내는 `법무/동의문구.md` 에서 자동으로 옮긴 `src/content/consentContent.ts` 에서만 온다(코드에 옮겨 적지 않는다). `npm run check:copy` 가 `마케팅/카피.md` · `동의문구.md` 와 대조하고, 글이 바뀌었는데 동의 문구 판(`config/consent.ts`)을 안 올렸으면 잡는다.
- **등급 · 외모 점수 · 매칭 점수를 보이거나 담는 코드를 쓰지 않는다**(타입에 `grade` · `rating` · `score` 없음, 시험이 확인).
- 화면 캡처 차단은 기본 끔(`config/flags.ts`, 가정 D-23 BD-4). 켜는 코드는 `lib/captureBlock.ts`(`expo-screen-capture`)이고 09 · 10 이 열려 있는 동안만 쓴다. 값은 `store/securityStore.ts` 의 `captureBlock` — 12 보안 스위치(F7)가 `setCaptureBlock` 으로 바꾸고 이 기기의 SecureStore 에 저장한다(팀장 결정 ⑥, 로그아웃 · 탈퇴 때 지우지 않는 기기 설정).
- **출시 빌드에 데모 모드 금지(V-07)**: `EXPO_PUBLIC_DEMO_MODE=1` 인 채로 `npm run gen:legal -- --release` 를 하면 실패하고, EAS production 빌드(`EAS_BUILD_PROFILE=production`)는 `app.config.js` 가 설정 읽기에서 멈춘다. 시험 `legalGen` 10번.
- AI 정리는 모의 모드(`config/flags.ts`, 가정 D-20). 실호출은 서버 함수가 하고 완성 뒤 승인한다.

## 빌드(EAS)

- `eas.json`: `development` · `preview`(내부 배포 APK) · `production`. 설정 파일까지만 있고 **계정 연결 · 결제 · 제출은 하지 않았다**(R2는 완성 뒤).
- `development` 프로필은 `expo-dev-client` 설치 뒤에 쓴다(푸시 알림 단계). 지금은 설치하지 않았다. 설치하면 `npx expo start` 가 Expo Go 대신 개발 빌드를 찾는다.
- 번들 ID · 패키지: `com.gyeoljeongsa.app`(가정 D-13). 스토어 등록 뒤에는 바꿀 수 없다.
- 권한 문구(iOS `infoPlist`)는 한국어다. F2에서 `expo-image-picker` 플러그인을 넣으면 같은 문구를 플러그인 옵션(`photosPermission` · `cameraPermission`)에도 적어야 한다(안 그러면 플러그인의 영어 기본 문구가 덮어쓴다).
