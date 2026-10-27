# QP-A 1부 변경기록 — 마케팅 확정 문구 반영 · 설정 화면 v5

- 작성: 앱개발직원 · 2026-10-27 · 세부계획 D-196 QP-A 1부(본인 승인 "권고대로 진행해" → "이어서해") · 세부청사진 `팀장/세부청사진/QP_출시전_품질.md`
- 기준: `청사진_v5.md` · `CLAUDE.md` · `마케팅/QPM_변경기록.md`(1장 A · B · F, 2장 #7) · `마케팅/카피.md` 12-Q · 14장
- 하지 않은 것: C(법무 원문) · D(법정 기록) · E(숨김 v4 74곳) · web-* 스크립트 · 웹 빌드 · 푸시 · 다른 직원 파일(마케팅 · 법무 · 기획 문서 포함) · 서버 · `backend/.env` · 유료 · npm audit fix

## 단계 상태
| 단계 | 상태 |
|---|---|
| 0 기준 문서 읽기 · 시작 전 jest | 끝 — 시작 전 jest 1531/1551(7묶음 20개 실패) |
| 1 A · B · F · #7 글 바꿈 | 끝 |
| 2 설정 화면(스위치 · 알림 · CONSENT_MANAGE · 크레딧 줄 · 사업자 정보 · 신고번호) | 끝 |
| 3 check:copy W · L(14장 우선 대조) | 끝 — W · L 통과. 남은 실패 6은 법무 문서 10-27 00:26 변경(QP-L) 쪽 |
| 4 시험(tsc · jest · check) | 끝 — 아래 5장 |
| 5 커밋(푸시 안 함) | 끝 |

## 1. 글 바꿈 (카피.md 확정 글 그대로)
| QPM 줄 | 앱 자리 | 한 일 |
|---|---|---|
| A shopCopy:46 | `SHOP16.settingsRow` → `SETTINGS.rows.credits` '크레딧 · 구매 내역' | 줄을 T5(/credits)로 잇고, 상점 스위치와 상관없이 보임 |
| A shopCopy:183 | `WITHDRAW_SUB_NOTE` | 지움 — 탈퇴 확인창 아래 줄은 `WITHDRAW.credit` 하나 |
| A shopCopy:272 | `SETTINGS16.showRow` · `showNote` | 지움 — '내 등급 보이기' 줄 없음 |
| A shopCopy:274 · 278 | `SETTINGS16.stopNote` · `stopConfirm.body` | 12-Q v5 글 |
| A prelaunchCopy:93 · 94 | `PRELAUNCH_TABS.shop` · `shopNoDay`(+ 14-1 `likes`) | 지움 — 출시 전 상점 탭은 첫 계산 한 줄만 |
| B shopCopy:209 · 224 · 245 · 250 | `GRADE16.limits`(끝 문장) · `stoppedBody` · `howWho` · `howRelation` | 14-1 v5 글 |
| B shopCopy:212 · 214 · 251 · 252 · 266 · iconCopy:10 | `GRADE16.locked` · `lockedSub` · `howTop` · `howFew` · `BADGE16.nonSubscriber` · `GI.locked` | 지움 + 그리던 자리(잠금 글 · [구독 알아보기] · 10 구독 권유 줄) 없앰 |
| F settingsCopy:56 ~ 58 | `NOTIFY.recommendation` v5 · like · match 줄 숨김 | 알림 화면 서비스 스위치 1개 |
| F settingsCopy:86 | `CONSENT_MANAGE.ck4OffBody` | 12-Q v5 글 |
| F copy:176 · 192 | `PROFILE.visibilitySubtitle` · `firstBody` | 14-2 '짝' 글 |
| F questionCopy:36 · 279 · 313 · SurveyV2Screen:71 | A06 · F07 · F12 도움말 · `A06_OTHER_NOTE` | 14-2 v5 글 |
| F surveyChatCopy:319 | `CHAT.F12.ack.t1` | 14-2 v5 글 |
| F surveyLiteCopy:44 | `SURVEY_LITE.hiddenUsedLine` | 14-2 '짝' 글 |
| 2장 #7 | `WITHDRAW.credit` | '탈퇴하면 남은 크레딧은 더 쓸 수 없어요. 공개 전인 탑승권은 이용약관 제14조의2에 따라 처리해요.' |
| 2장 #1 ~ #5 | `CONSENT_LATER` → `CONSENT_MANAGE`(askLater · offTitle · offBody · ck15OffBody · offConfirm) | 옮김, `CONSENT_LATER` 없앰 |

- 손대지 않은 F 줄(법무 몫 → 2부): settingsCopy:63(4-9) · 66(5-5) · surveyChatCopy:353 · 355(4-16) · consentContent CK1 · CK16(생성 파일).

## 2. 설정 화면
- 등급 스위치: '등급 계산 멈추기' 하나. 서버 멈춤 값을 읽은 뒤 그림(못 읽으면 기기 값). CK10 은 읽지도 쓰지도 않음.
- 목록: '크레딧 · 구매 내역'(→ /credits) · 정보 묶음 끝 '사업자 정보'(값 6개 모두 있을 때만 → 6줄 쪽) · 목록 맨 아래 '국내결혼중개업 신고번호 {값}'(값 있을 때만).
- 약관 읽기 시트: 약관 탭 맨 아래 같은 신고번호 한 줄(값 있을 때만).
- 값 한 곳: `src/content/businessInfo.ts` ← `content/fillIns.ts`(FILL_INS, `법무/판_관리.md` 7장 → gen:legal). 지금 모두 null → 아무것도 안 보임.
- 길 표: `flow.ts` 에 `sub:business-info` · `12 → T5` 화살표, `resolve.ts` 에 sub 하나 더함.

## 3. check:copy (W · L)
- 마케팅 파일은 고치지 않고, `scripts/check-copy.mjs` 가 카피.md 14장(14-0 '앞선다') 표를 같은 키의 옛 줄(13장 · 08 표)보다 먼저 읽게 함(V5_COPY).
- 같은 이유로 P(임시 설문) · S(16장 대조 원본에 12-Q · 14장 더함, '매칭'은 '1회 매칭' · '주간 매칭' 자리 허용, L-7 A06 문장 v5) 를 맞춤. `WITHDRAW_SUB_NOTE` 대조 줄 지움.
- `scripts/check-grade-icon.mjs` shopCopy 기준 32 → 25(구독 · 위 등급 줄이 줄어듦).

## 4. 시험 파일
- 새로: `src/__tests__/qpaSettingsV5.test.tsx` 14개 — 값 비면 사업자 정보 줄 · 신고번호 줄 숨김 / 신고번호만 있으면 한 줄만 / 모두 있으면 줄 + 6줄 쪽 / 약관 맨 아래 줄(값 있을 때만, 처리방침 탭엔 없음) / CONSENT_MANAGE · WITHDRAW.credit · 14장 글.
- 고침: settingsGrade(크레딧 줄 → /credits · 멈춤 스위치 하나 · CK10 안 건드림 · 멈춤 값 못 읽어도 그림 · 탈퇴 크레딧 줄 하나) · settingsScreen(줄 목록 · 알림 1개 · 하위 쪽 10) · settingsWithdraw · l17aLaterConsents · gradeBadge · gradeScreen · f22Prelaunch · f18Back(12 → /credits → 뒤로 12) · routes · surveyV2Copy · surveyV2Screen · surveyLiteModel(14장이 옛 9장 · 화면_요구사항 줄보다 앞섬).

## 5. 시험 결과 (10-27)
| 시험 | 결과 |
|---|---|
| tsc --noEmit | 오류 0 |
| eslint(바꾼 파일) | 오류 0 · 경고 0 |
| jest | 1559/1561 — 실패 2(legalContent = check:copy · legalGen 판 블록), 둘 다 법무 문서 변경 쪽. 시작 전 1531/1551(실패 20) |
| check:copy | 통과 92 · 실패 6 — A 생성 파일 · A 판 · B CK3/CK6 · I 지문 · O 4-9/5-5 · W CK16. 모두 법무 동의문구 · 판_관리 10-27 00:26 변경(QP-L) 대조, 앱 1부 글 쪽 실패 0. W 대화형 설문 437 · L 08 모두 통과 |
| check:tokens | 통과 5 · 실패 0 |
| check:grade | 통과(W9 새로 생긴 곳 0) |

---

# 2부-가 (D-197, 10-27) — 법무 확정 원본 반영 · CK10 정리

- 기준: 법무/QPL_변경기록.md 6장(6-A · 6-B · 6-C) · 팀장 지시(D-197)

| 단계 | 상태 |
|---|---|
| 6-A gen:legal --fingerprints | 끝 — consent.ts 판 CK1 · 3 · 6 = consent-2026.10.27-v1 · CK9 = 10.14-v2 · 지문 새로 · consentContent · legalTerms(운영자 표 +3줄 · 24세) · legalPrivacy(24세) · fillIns(+ 수수료표 · 보증보험 웹 주소, null) |
| 6-B 손으로 고칠 줄 | 끝 — 아래 표 |
| 6-C CK10 정리 | 끝 — 아래 표 |
| 시험 · 커밋 | 끝 — 아래 '2부-가 시험' |

## 6-B
| # | 자리 | 한 일 |
|---|---|---|
| B1 · B2 | `NOTIFY.marketingNotes[2]` · `pushPrime` | 동의문구 4-9 · 5-5 글 그대로 |
| B3 · B4 | `CHAT.CK16.why` · `optional` | 동의문구 4-16 글 그대로(기획 키 — 기획 확인은 나중 메모) |
| B5 | `config/laterConsent.ts` CK16 | consent-2026.10.26-v2 |
| B6 | `GRADE16.howReview` 끝 문장 | 5-7 C10 ⑤ 글 |
| B7 | C6 `GRADE16.limits` · C7 `SETTINGS16` | 확인만 — 1부에서 이미 v5 |
| B8 | `SAFETY_MINOR` | 만 24세. 같은 문장이 든 `CHILD_SAFETY.policy` 셋째 문장도 24세로(약관 제20조 ④와 같게) |
| B9 | `businessInfo.ts` · `BUSINESS` · 사업자 정보 쪽 | 통신판매업 신고번호 줄(사업자등록번호 다음, 비면 그 줄만 숨김) · 연결 3줄(수수료표 보기 · 이용약관 보기 · 보증보험 손해배상 청구 절차 — 웹 주소가 비면 그 줄만 숨김, 약관은 앱 안 시트) · 주소 변수 `{주소}`(FILL_INS['주소']) 그대로. 법정 6줄 중 하나라도 비면 '사업자 정보' 줄 자체 숨김(1부 규칙 유지) |
| B10 | 주석 '만 19세' | 하지 않음(선택, 화면 글 아님) |

## 6-C CK10 정리 (읽기 · 쓰기 0)
| # | 자리 | 한 일 |
|---|---|---|
| C1 | `lib/settingsApi.ts` | `OptionalCode` · `OPTIONAL_CODES` 에서 CK10 뺌 → loadConsents 가 CK10 을 읽지 않음 · setOptional 로 쓸 수 없음 |
| C2 | `config/gradeConsent.ts` · settingsApi 판 분기 | 파일 지움 · 분기 지움 |
| C3 | `ConsentManagePage.tsx` | CK10 분기 지움 |
| C4 | `productCopy.ts` N08 | 숨김 상점 글은 그대로(카피 16-B 대조 대상) + 주석. 앱 코드가 N08 로 CK10 을 쓰는 곳 없음 |
| C5 | 데모 | `demo/people.ts` ck10 칸 24곳 지움 · `demoRecs` · `shopDemo` 가 상대 grade_no 를 주지 않음. `settingsDemo` 철회 허용 목록 · `demoBackend` 검사식은 서버 0033 규칙 흉내라 그대로(서버 안 고침) |
| 점검 | `check-copy-rules.mjs` R12 | 법 낱말 '보증보험'만 보증 말 검사에서 뺌(사람 · 만남 보증 아님) |

## 백엔드 확인 거리 (고치지 않음 · 메모만, grep 읽기 전용 · backend/.env 열지 않음)
- CK10 을 읽는 서버 함수 있음: `private.grade_consent_on(uuid)`(`backend/migrations/0012_grade_shop.sql:971`, consents 의 CK10 최근 기록) → `private.grade_badge(viewer, target, day)`(같은 파일 1001줄, 구독자 + CK10 일 때 상대 등급 번호). v4 상대 등급 배지 길 — 백엔드가 읽지 않게 정리 필요.
- `revoke_consent` 최신판(`0033_survey_interview.sql:1069 · 1080`)이 CK10 철회를 받고 상대 화면 등급을 지움 · consents 검사식(0033:178)에 CK10 이 선택 칸으로 남음 — 옛 기록 철회 · 탈퇴 삭제용으로 둘지 백엔드 판단.
- 가입 나이: `private.pl_const('MIN_SIGNUP_AGE')` = **24**(`0024_prelaunch_mode.sql:61`) → `private.signup_age_ok` · A01 저장 트리거 `survey_answers_age_floor`(0024:954 ~ 977)가 24세로 막음. 법무 메모의 `private.signup_config.min_age` 이름은 grep 에 없음(이름 다름). 0001:734 · 0023:3193 의 옛 만 19세 A01 검사는 남아 있으나 24세 트리거가 먼저 돈다(0024 주석).

## 2부-가 시험 (10-27)
| 시험 | 결과 |
|---|---|
| tsc | 0 |
| eslint(바꾼 파일) | 0 오류 · 0 경고 |
| jest | 83묶음 1567/1567 통과 |
| check:copy | 통과 98 · 실패 0(A · I · O · W · B 모두 통과 — 마케팅 카피.md 맞춤 뒤) |
| check:tokens · check:grade | 5/0 · 통과 |
- 새 시험(qpaSettingsV5): 통신판매업 줄 · 연결 3줄 하나씩 비면 그 줄만 숨김(함수 + 화면) · CK10 을 앱 어디서도 읽지 않음(OPTIONAL_CODES · src 전체 grep) · 가입 나이 24 안내(02 · 03 CK2 · 10 · 아동 안전, 게시 글 만 19세 0).
- 고친 시험: serverFlow(뒷자리 판 = 지금 CK1 날짜 기준) · legalContent(CK1 요약 7줄) · l17a(판 수 17, CK10 빠짐) · settingsSafety(24세) · settingsGrade · gradeScreen(howReview) · gradeBadge · shopApi · f24DemoPeople(상대 등급 번호 없음).

---

# 2부-나 (검수 결함 21건 · 마케팅 3차 3-2 · 카피 14-5 대조 · 법무 L19 · 기획 QPP, 10-27)

- 기준: `검수/QP_결함목록.md`(10-26 22:39 데모 번들 기준) · `마케팅/QPM_변경기록.md` 3-2 · `마케팅/카피.md` 14-5 · `법무/L19_판단묶음.md` 4장 · 팀장 지시(D-196 · D-197 · D-198)
- 웹 점검은 검수가 끝나 팀장 허락으로 다시 씀: `dist-demo` 다시 만듦(10-27) → w6(390 · 360) · f1 · f7 · v6f(360) · v6f 동작 줄이기 3회(390)

## 결함별 처리
| 번호 | 심각도 | 처리 | 무엇을 · 어디 | 확인 |
|---|---|---|---|---|
| QP-01 | 치명 | 고침 | T3 [프로필 자세히 보기] → 10 에 `from=reveal` · `chat` 을 넘기고, 10 은 그때 보기만: [넘기기] · [호감 보내기] · 수락/거절 · '왜 추천했나요' · 등급 · '서로 수락한 뒤의 연락 방법' 줄 0, 아래 버튼 [대화 시작하기](REVEAL.chat) 하나 → `/chat/{id}`. 짝 상태 · 상대 등급을 읽지 않아 호감 토스트도 생길 수 없음. 뒤로 → T3(없으면 탑승권 탭). `CandidateScreen.tsx` · `RevealScreen.tsx` · `PromptCards.tsx` | jest qpbDefects 3 · w6Boarding · web-w6 'QP-01' 2줄(390 · 360) · 캡처 `확인/스크린샷/W6_390/W6_T3_10_상대상세_아래.png` |
| QP-02 | 높음 | 해결(커밋 ee31c6f) | 1부: 설정 등급 스위치 v5 글 · '내 등급 보이기' 줄 없음 | web-f7 A · settingsGrade |
| QP-03 | 높음 | 해결(ee31c6f · 42d56fc) | 사업자 정보 줄 · 신고번호 한 줄(설정 · 약관), 값 비면 숨김 · 약관 운영자 표 신고번호 행(gen:legal) | qpaSettingsV5 |
| QP-04 | 높음 | 고침 | 자리 글 {…}: `content/fillLegal.ts` — FILL_INS 값이 있으면 넣고 비면 그 줄(표 행 · 문단 · 목록 줄) 숨김, `LegalBlockList` 가 씀(약관 · 처리방침 · 동의 전문). 고객센터: 값 없는 이메일 · 운영 시간 · 아동 안전 연락처 줄과 [복사] · [메일 앱 열기] 숨김 | jest qpbDefects · settingsScreen · web-f7 'QP-04' 2줄(고객센터 · 약관 끝까지 내려 봄) |
| QP-05 | 높음 | 해결(ee31c6f · 42d56fc) | 알림 v5 한 줄 · 4-9 · 5-5 글 | web-f7 B |
| QP-06 | 높음 | 해결(42d56fc) | 약관 · 처리방침 만 24세(gen:legal) | qpaSettingsV5 '가입 나이 24' |
| QP-07 | 보통 | 하지 않음(마케팅) | 마케팅이 카피.md 14-5 로 확정 → 앱은 3-2 고쳐 확정 18줄 반영 + check:copy X 로 대조(아래) | check:copy X 190줄 통과 |
| QP-08 | 보통 | 일부 고침 | 08 · CK16 '추천' 글은 1부 · 2부-가로 끝. 05 사진 안내 '추천 계산에 쓰는 내부 평가 정보'는 원본(카피.md 05 · 동의문구 CK7)에 새 글이 없어 그대로 — 마케팅 · 법무 글 대기 | — |
| QP-09 | 보통 | 일부 고침 · 메모 | 07 성향 막대 옆 숫자 글자 숨김(스크린리더 값은 남김) `TraitBar.tsx`. '성향 확인 두 번'은 청사진 6-1 '06 · 07 그대로'와 14장 '본인이 요약을 보고 고칠 수 있음'이 겹쳐 앱에서 하나를 지울 근거가 없음 → 팀장 · 본인 판단 메모 | jest traitsScreen · qpbDefects |
| QP-10 | 보통 | 하지 않음(백엔드 · 실서버, 나중) | — | — |
| QP-11 | 보통 | 하지 않음(백엔드 · 실서버, 나중) | — | — |
| QP-12 | 보통 | 메모만 | 청사진 6-1 '16-G 바뀜: 아이콘 하나 + 짧은 설명' · 6-2 '내 것만 같은 무리'는 있으나 **들어가는 자리(어느 화면 · 줄)가 청사진에 없음** → 넣지 않음, 팀장 결정 필요 | — |
| QP-13 | 보통 | 고침 | 내 답 말풍선 Pressable minHeight 48(`surveyChat/parts.tsx` meTouch) | jest qpbDefects · web-v6f 360 'QP-13' 통과 |
| QP-14 | 보통 | 고침(웹 확인 미완) | 공통 `Pressable`: 웹에서 누르면 동작 전에 포커스를 놓음(스위치 · 체크 · 라디오 · 탭 제외) → 화면 · 시트가 바뀔 때 숨는 쪽에 포커스가 남지 않음 | jest pressable. 콘솔 경고 수는 이번 점검 스크립트가 세지 않아 미확인 — QP-Q2 재검수 |
| QP-15 | 보통 | 원인 미확인 · 점검 고침 | 아래 'QP-15' | 동작 줄이기 3회 결과 |
| QP-16 | 낮음 | 고침 | 잠긴 줄은 스위치만 흐림, 글은 그대로(`ToggleRow.tsx` · `SettingsParts.tsx` SwitchRow offLook own) | jest 전부 · web-f7 |
| QP-17 | 낮음 | 고침 | 탑승권 카드 '출발' 칸은 제 길이(최대 40%)만 — '여행지에서 만날 한 분' 한 줄(`TicketCard.tsx`) · CK16 두 버튼 위아래(`SurveyChatScreen.tsx`) | 캡처 `확인/스크린샷/W6_360/W6_T2_기다림.png`(한 줄) · web-v6f 360 CK16 버튼 286×52 둘 |
| QP-18 | 낮음 | 하지 않음(법무) — L19 로 약관 제8조 ② · 제14조의2 ⑨ 고침을 gen:legal 로 반영 | — | — |
| QP-19 | 낮음 | 법무 L19 대로 반영 | SAFETY_MINOR · 아동 안전 셋째 문장 = "만 19세 미만으로 보이면 24시간 안에 먼저 확인해요. 결정사는 만 24세 이상만 가입할 수 있어요." | qpaSettingsV5 · settingsSafety |
| QP-20 | 낮음 | 하지 않음(법무 · 기획 · 청사진) | — | — |
| QP-21 | 낮음 | 고침 | web-f1: 흐린 버튼을 글자 sub 색 · aria-disabled · 투명도로 봄, 스플래시 점검을 지금 모양(타일 · 링은 3초 뒤)으로. web-f7: v5 줄 · 알림 · CK16 판 · 동의 관리 글 · [닫기] 기다림 | web-f1 76/0 · web-f7 63/0 |

## 마케팅 3-2 · 카피 14-5 대조 · 법무 L19 · 기획 QPP
- 3-2 18줄 반영: 짝 없는 회차 이유 줄 3 지움(T1 카드 · T3) · 크레딧 내역 이유 → '짝을 찾지 못해 돌려받음' · '등급 계산이 멈춰 있어요' · 채팅 오류 글 10줄. 탈퇴 크레딧 줄은 1부에서 끝.
- check:copy 새 묶음 X: 카피.md 14-5-1 · 14-5-2 표(첫 칸 'T1 `키`' 꼴) 190줄을 boardingCopy · chatCopy 와 대조(글 함수 27개는 자리마다 표시 글자로 불러 {…} 자리와 비교, '(줄 없음)'은 키가 없어야 함). W · V 읽기와 부딪히지 않음.
- 법무 L19: `npm run gen:legal -- --fingerprints` 다시(10-27 09:43, 약관 제8조 ② · 제14조의2 ⑨ · 처리방침 11장 · 동의문구 5-6) · SAFETY_MINOR 새 글. 계약 설명 시트 요약 블록은 본인 결정 뒤라 하지 않음.
- 기획 QPP: `CHAT.A06.why` = '종교가 같은 분과만 이어 드리는 데 써요. 등급에는 쓰지 않아요.' — W/S '등급 말 0' 규칙에 이 한 줄만 예외(쓰지 않는다는 안내, 설문 v2 A06 과 같은 뜻).

## QP-15 (동작 줄이기 v6f 멈춤)
- 원인: 미확인. 멈춘 15분 동안 점검의 모든 기다림(4 ~ 10초)이 끝나지 않은 것으로 보아, 브라우저 `Runtime.evaluate` 가 답하지 않았다(페이지 멈춤 또는 CDP 연결 끊김) — 점검 쪽 `cdp.send` 에 시간 한도가 없었다.
- 한 일: `scripts/lib/browser.mjs` evaluate 에 60초 한도(EVAL_TIMEOUT_MS) — 다시 나면 15분 멈춤 대신 '어느 식에서 페이지가 답하지 않았는지'를 남기고 실패로 끝남.
- 재현 조건 메모: 폭 390 · `--reduced-motion` · E11(여러 고르기 · travel · food 고른 뒤 보내기) 캡처 직후. 검수 1/3.

## 2부-나 시험 (10-27 10:30 ~ 10:50)
| 시험 | 결과 |
|---|---|
| tsc | 0 |
| eslint(바꾼 파일) | 0 오류 · 0 경고 |
| jest | 1566/1578(84묶음) — 실패 12: 기획 문서 v5 개정(10:19 ~ 10:21 · 설문 CSV 10:08) 대조 9(likesApi · surveyLiteModel · surveyV2Copy 2 · surveyV2Csv 5) · check:copy 감싼 것 1(legalContent) · 법무 처리방침 R40 빈 번호 1(legalGen 3) · 판 지문 1(legalGen 7, 법무 10:08 ~ 10:10 개정분을 10:29에 gen:legal 로 반영한 뒤에도 남으면 다시 확인) |
| check:copy | 통과 86 · 실패 13 — 기획 문서 개정 몫 11(H · J 2 · L 2 · M 신고 사유 · N 2 · P · Q 2) · 카피↔동의문구 D(CK4 · CK8 · CK9 요약, 마케팅 · 법무) · O 알림 두 줄(법무 4-9 · 5-5 가 '대화방 새 글'을 더함 — 알림 줄은 본인 결정 뒤라 손대지 않음). 1부 · 2부 앱 글 쪽 실패 0. X(14-5 190줄) 통과 |
| check:tokens · check:grade | 5/0 · 통과 |
| 웹 | w6 390 35/0 · w6 360 35/0 · f1 76/0 · f7 63/0 · v6f 360 27/0 · v6f 390 동작 줄이기 3회 모두 27/0(102 · 89 · 100초, 멈춤 0) |

---

# 3부 R-A (D-199 · D-200 · D-201, 10-27 ~ 마감 11-03)

| 단계 | 상태 |
|---|---|
| 1 원본 맞춤(gen:legal · check-copy v5 원본) | 끝 — gen:legal 10:51 · check-copy 가 기획 v5판 + 보관 v4판을 함께 읽음(readPlanDoc) · 신고 사유는 v5 정책 P8-02 줄 · check:copy 99/0 |
| 2-a 설정: 알림 2줄(만날 분 = notify_match · 대화방 = notify_chat) · 권한 안내 5-5 · 멈추기 한 줄 · 다시 켠 뒤 한 줄 · '내 등급' 줄 → /grade · '아는 분 피하기' 12-5 | 끝 |
| 2-b F07 문항 빼기(설문 v2 · 대화형 · 조건 12) | 끝 |
| 2-c 탑승권: 계약 요약 · 마감 안내 · 취소 · 크레딧 기한 없음 · 사유 3 · 구매 전 고지 · 푸시 토큰 등록(chat_push 꺼짐이면 0) | 끝 |
| 2-d 이어받음 정리(10-27 오후, 다음 직원) | 끝 — 앞 직원이 CRLF 로 바꾼 3파일(model · questions · surveyV2Demo.test) LF 로 되돌림 · 취소 함수 이름을 백엔드 R 변경기록 3장 0037 B 설계 이름 `cancel_ticket_seat` 로(인자 p_round_no 는 앱 제안) · raFinish 토스트 시간 때문에 1개 실패 → 고침 |
| 시험(1 ~ 2단계) | tsc 0 · eslint(바꾼 파일) 0 · jest 85묶음 1591/1591 · check:copy 99/0 · check:grade 통과 |
| 커밋 | 3부-가 |
| 3 디자인 QA(D43) · 사진칸 그림 · 아이콘 14곳 · 07 숫자 | 대기 |
| 4 QP-14 · FB-011 · FB-012 · 10 신고 · 차단 | 대기 |
| 5 F25 숨김 v4 글 74곳 | 대기 |

## 서버 함수 이름(백엔드 0037 전 — 앱은 데모 경로로 돈다)
| 일 | 앱이 부르는 이름 · 인자 | 근거 |
|---|---|---|
| 탑승 취소 | `cancel_ticket_seat({ p_round_no })` → `{ ok, refund }` · 오류 `sale_closed` · `not_boarded` | backend/R_변경기록 3장 설계 메모 `public.cancel_ticket_seat(round)` — 인자 이름 미확인 |
| 아는 분 피하기 | `get_avoid_settings()` · `set_avoid_orgs({ p_companies, p_schools })` · `set_share_email({ p_on })` | 백엔드 메모는 표 이름만(contact_settings 등) — 함수 이름은 앱 제안, 0037 F 때 맞춤 |
| 알림 토큰 | `register_device(p_platform, p_os_version, p_app_version, p_push_token)` | 0004:616 있음 · 표 devices(0001) |
| 대화 알림 스위치 | profiles `notify_chat` 열 | 0036 |
