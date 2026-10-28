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
| 3 디자인 QA(D43) · 사진칸 그림 · 아이콘 14곳 · 07 숫자 | 끝(높음 7 · 아이콘 13곳 + 4 · 보통 일부) — 아래 '3부-나' |
| 4 QP-14 · FB-011 · FB-012 · 10 신고 · 차단 | 끝 — web-w6 'aria-hidden 경고 0'(390, 가입 · T3 · 10 · 대화방 길) |
| 5 F25 숨김 v4 글 74곳 | 하지 않음 — 규모 · 결정 거리(아래 'F25') · 팀장 판단 대기 |

## 서버 함수 이름(백엔드 0037 전 — 앱은 데모 경로로 돈다)
| 일 | 앱이 부르는 이름 · 인자 | 근거 |
|---|---|---|
| 탑승 취소 | `cancel_ticket_seat({ p_round_no })` → `{ ok, refund }` · 오류 `sale_closed` · `not_boarded` | backend/R_변경기록 3장 설계 메모 `public.cancel_ticket_seat(round)` — 인자 이름 미확인 |
| 아는 분 피하기 | `get_avoid_settings()` · `set_avoid_orgs({ p_companies, p_schools })` · `set_share_email({ p_on })` | 백엔드 메모는 표 이름만(contact_settings 등) — 함수 이름은 앱 제안, 0037 F 때 맞춤 |
| 알림 토큰 | `register_device(p_platform, p_os_version, p_app_version, p_push_token)` | 0004:616 있음 · 표 devices(0001) |
| 대화 알림 스위치 | profiles `notify_chat` 열 | 0036 |

## 3부-나 (디자인 QA D43 · 검수 남은 것, 10-27)
### D43 높음 7
| # | 처리 | 자리 |
|---|---|---|
| B1 07 정리 중 | 돌림 고리 → 그림 4안 `organizing`(상태 칸 240) | `ai/AnalysisScreen.tsx` |
| B2 T5 불러오기 실패 | 그림 `error` 240 + 글 + [다시 시도] | `boarding/CreditScreen.tsx` |
| C1 가입 아래 🔒 | 1안 `security` 16 · sub | `components/LockNote.tsx` |
| D1 그림 칸 430 | `illustration.hero` 348 → 390 · 온보딩 칸 가운데(width 100%) | `theme/illustrations.ts` · `OnboardingScreen.tsx` |
| E1 낱말 중간 줄바꿈 | 웹 `word-break: keep-all`(AppText 공통) | `components/AppText.tsx` |
| F1 10 아래 v4 버튼 | QP-01(2부-나)로 이미 고침 — 공개 뒤 10 은 [대화 시작하기] 하나 | 확인만 |
| F2 등급 스위치 2줄 | 1부로 '멈추기' 한 줄 · 이번에 '내 등급' 줄(my_icon_view) | 확인 + 아이콘 |
### D43 A 아이콘(14곳 중 A12 decline 은 팀장 결정으로 0)
- 설정 줄 앞 24: 알림 bell · 공개 범위 visibility · 내 등급 my_icon_view · 아는 분 피하기 profile · 희망 조건 how_to · 인증 서류 doc_verify · 크레딧 credit · 차단 목록 block · 신고 내역 report · 보안 security · 고객센터 support · 동의 관리 consent · 약관 · 라이선스 · 이미지 출처 · 사업자 정보 document · 안전 안내 safety (`settingsLogic.ts` RowDef.icon · `SettingsParts.tsx` NavRow)
- 로그아웃 logout 20 accent(OutlineButton icon) · 탈퇴하기 withdraw 20 accent(TextButton icon)
- T4 메뉴 연장 extend · 나가기 leave · 신고 · 차단 report(accent) 24 · 방 위 띠 '연장 알아보기' extend 20 · 연장 고른 뒤 상태 줄 accept 16 sub
- 신고 시트 '신고하기' report · '차단하기' block 24 accent · T5 잔액 카드 credit 24 accent · 08 알약 '인증 대기' verified · '사진 확인 중' photo_checking 16 accent(Chip lead)
### D43 보통 · 낮음 중 한 것
- B5 05 사진 칸 그림 3장 연결: `components/PhotoSlotArt.tsx`(디자인/D43_사진칸그림/paths.json 그대로, 색은 토큰) — 옛 PNG 는 등록만 남김
- C3 차단 확인창 [차단하기] = 위험 버튼(ConfirmDialog `danger`) · C4 고객센터 [메일 앱 열기] = 보조(테두리) · E4 아동 안전 연락처 bodyMedium · D3 10 숫자 칸 값 두 줄까지 · E3 CK16 제목은 이미 bodyBold(확인만) · D2 CK16 버튼 세로(QP-17 로 이미)
- 하지 않음(이번 범위 밖 · 팀장 결정 필요): B3 T3 끝 장면 로고 타일 · B4 탭 뒤 흐린 로고 · C2 옛 실루엣 조건 · D4 · D5 · D6(데모 칸) · D7 · D8 · E2(E1 로 대부분) · E5 글자 링크 chevron · F3(QP-03 으로 이미) · F4(R-A 알림 2줄로 이미)
- 07 숫자 숨김: QP-09(2부-나) `TraitBar.tsx` 확인 — 막대만, 스크린리더 값 그대로
### 검수 남은 것
- 10 상세 신고 · 차단: 대화방에서 연 10(from=reveal&chat=방)은 0031 `report_chat_partner` · `block_chat_partner`(방 id)로 — v4 `report_user` · `block_user` 는 추천 · 호감 관계만 받아 대화 짝에게 실패(`recs/CandidateScreen.tsx` deps.chat, chatService 는 누를 때 만듦)
- FB-011: 데모 건너뛰기 줄 = 안내 한 줄 + 글자 버튼 셋 한 줄(큰 버튼 셋 → 높이 약 1/3). 이름 · testID 그대로
- FB-012: 점검 도구 `clickText` 가 요소가 없으면 5초까지 다시 찾음(`scripts/lib/browser.mjs`) — 데모 줄이 늦게 떠도 첫 실행 통과
- QP-14: 점검 도구가 브라우저 경고(Log · console.warn)를 모음 · web-w6 에 'aria-hidden 경고 0' 줄
### 3부-나 시험
| 시험 | 결과 |
|---|---|
| tsc | 0 |
| eslint(바꾼 파일) | 0 |
| jest | 86묶음 1600/1600(새 raDesign 7 · qpbDefects +1) |
| check:copy · grade · tokens | 99/0 · 통과 · 5/0 |

## F25 숨김 v4 글 74곳 — 하지 않은 까닭 · 크기 (10-27)
- 74곳 글은 코드에서 따로 떼어 지울 수 없음: 숨김 화면(09 하루 세 분 · 11 호감 · 16 상점 · 상품 46 · 구독 · 1회 매칭)이 그 글을 그린다 → 글을 지우려면 화면 · API · 데모 서버를 함께 지워야 함
- 크기(셈): v4 전용 코드 약 4,100줄(features/shop 10 · features/likes 5 · RecommendationsScreen · productCopy · likesCopy · shopApi · shopDemo · likesApi · 탭 라우트 5) + 시험 18묶음 약 4,100줄 + 웹 점검 5개(f6 · f13 · f14 · f16 · w10) + check:copy Q · R · S · N 묶음
- 얽힌 곳: 16-G 내 등급(v5)이 상점 부품(LinkRow · formatDay · subViewOf · ShopDeps)을 씀 · 데모 서버 등급 함수(get_my_grade 등)가 shopDemo 안에 있고 '구독자만 등급' v4 규칙을 따름 · 10 상세 v4 넘기기 · 호감 길 · 추천 데모(recs) 가 shop.subscriber/gradeNo 를 씀
- D-152 결정은 '코드 · 시험 그대로 두고 스위치로 숨김(켜면 다시 보임)' — 지우면 이 결정을 뒤집음
- 제안: (가) 세부청사진을 따로 세워 3단계로 지움(① 16 상점 · 상품 ② 11 호감 · 09 하루 세 분 ③ 데모 서버 등급을 v5 규칙(모두 자기 아이콘)으로 옮김) — 앱 1 ~ 2일 · 시험 · 웹 점검 다시 / (나) 먼저 check:copy 가 카피.md 보관 장(15장)도 원본으로 읽게 해 마케팅 423줄 이동을 막지 않게 하고, 지우기는 1.1 로

## 3부 웹 점검 (dist-demo 10-27 다시 만듦)
| 점검 | 결과 | 비고 |
|---|---|---|
| web-w6 390 | 36/0 | 새 줄 'aria-hidden 경고 0(QP-14)' 통과 · 판매 마감 · 탑승 취소 · 계약 요약 캡처(W6_390) |
| web-f7 360 | 63/0 | 기대값 고침: 줄 15(내 등급 · 아는 분 피하기) · 알림 2줄(match · chat) · 아이콘 노드 빼고 줄 읽기 |
| web-f1 360 | 75/1 | 실패 1 = 스플래시 링 회전(B-Q1-01 가끔 실패, 이번 변경과 무관) · 끝난 뒤 프로세스가 안 끝나 직접 멈춤 |
| web-f3 360 | 23/1 | 04 기대값을 대화형 화면(chat-screen)도 받게 고침 · 남은 실패 = 07 막대 숫자 대조(QP-09 로 숫자 글자를 지운 뒤 점검 기대값 미갱신, 2부-나 몫) · 데모 줄(FB-011) 넘침 0 · 터치 44 통과 · 06 그림(B1) 캡처 F3_06 |

## 3부-라 F25 안 '나' (팀장 10-27, 마감 10-29) — check-copy 가 카피.md 15장(폐지 기록장)도 원본으로
- 숨김 v4 코드 삭제는 1.1(D-152 유지). 이번은 대조만 바꿈.
- `scripts/lib/legal-source.mjs` `restoreArchivedCopy` · `readCopyDoc`: 15장 줄(`| 폐지(D-…) | 원래 자리 | 옛 줄(¦) |`)을 원래 자리(같은 이름 소제목) 표 끝에 되돌린 글로 읽고, 15장 자체는 뺀다. 원본 파일은 고치지 않음
- 쓰는 곳: `check-copy.mjs`(카피 읽는 4곳) · `check-copy-rules.mjs`(7장 개선안 칸) · 시험 `helpers/outsideDocs.ts` readOutside('마케팅/카피.md')(같은 규칙, TS)
- `CHECK_COPY_DOC` 환경 변수: 다른 판 카피로 대조해 볼 때만(평소엔 비움)
- 흉내 시험: 표시된 줄(`폐지(D-199)` 끝 칸) 424줄을 15장으로 옮긴 카피 → check:copy 99/0 · 카피 읽는 시험 7묶음 249/249. 같은 흉내 카피에서 되돌림을 끄면 93/6 → 되돌림이 막아 줌
- 지금 15장에 있는 49줄도 원래 자리 소제목 49/49 찾음(못 찾으면 그 줄은 대조에서 빠짐 — 15장 줄 둘째 칸은 소제목 이름 그대로여야 함, 마케팅 몫)

## 3부-마 0037 함수 이름 맞춤 (D-199 ~ D-202 R-A 후속, 10-27, 마감 10-29)
- 기준: backend/migrations/0037_v5_legal.sql public 함수 정의(읽기만) · backend/R_변경기록.md 3장 · 위 '서버 함수 이름' 표

| 단계 | 상태 |
|---|---|
| 0 읽기(0037 함수 · R 3장 · 함수 이름 표) | 끝 |
| 1 탑승 취소 cancel_ticket_seat(p_round_no) → result 'credited' | 끝(코드) — boardingApi · boardingLogic.afterCancel · BoardingScreen · demo/boardingDemo |
| 2 아는 분 피하기 7개 · ack_ticket_contract | 끝(코드) — settingsApi AVOID_RPC · lib/avoidLocal(새) · services · AvoidPage · settingsDemo · 결제 전 ack · tsc 0 |
| 3 CK10 · v4 회수 12개 grep 표 | 끝 — 아래 표(10 상대 프로필 직접 주소 길 하나는 팀장 판단) |
| 4a 팀장 덧붙임 D-203(법무 17:12 ~ 17:14 약관 · 처리방침, L20 23장 #32) | 끝 — `npm run gen:legal -- --fingerprints`: 바뀐 것 legalTerms.ts · legalPrivacy.ts · consent.ts 지문 2줄(terms · privacy). 동의 판 13개 그대로 |
| 4 시험(tsc · jest · check:copy · check:tokens) | 끝 — 아래 '3부-마 시험' |
| 5 커밋(푸시 0) | 끝 — 3부-마 커밋 |

### 3부-마 함수 이름 표(0037 확정 — 위 '서버 함수 이름' 표를 갈음)
| 일 | 앱이 부르는 이름 · 인자 | 앱 자리 |
|---|---|---|
| 탑승 취소 | `cancel_ticket_seat({ p_round_no })` → `{ ok, round_no, paid_by, result: 'credited', lot_id }` · 오류 `closed` · `not_found` → 마감 글 | `boardingApi.cancel` → `{ ok, roundNo, credited }` · 화면은 `afterCancel`(탑승권 내려놓음 · 크레딧 +1 → T1) 뒤 다시 읽기 |
| 계약 설명 확인(R40) | `ack_ticket_contract({ p_round_no, p_text_version })` → `{ ok }` | `boardingApi.ackContract` · T1 결제 버튼 → ack → 결제(실패면 결제 0 · 결제 오류 글). 판 = `contract-5-8-` + 보인 요약 블록 글 지문 8자(`boardingLogic.contractVersion`) |
| 아는 분 피하기 상태 | `get_contact_block_state()` | `settingsApi.loadAvoid` · `loadContactState`(스위치 `avoid_org_on` · `share_my_key` · 개수) |
| 피할 회사 · 학교 | `set_avoid_org({ p_kind, p_name, p_on })` · `clear_avoid_orgs()` | `setAvoidCompany` · `setAvoidSchool`(학교는 내장 목록 이름) · `clearAvoidOrgs` — 이름 목록은 기기(`lib/avoidLocal`, 앱 AsyncStorage · 웹 메모리, 회원별) |
| 내 이메일 비교 · 설정 묶음 | `set_contact_block_options({ p_auto_sync?, p_share_my_key?, p_enabled?, p_avoid_on? })` | `setShareEmail` · `setContactOptions`(보낸 칸만) |
| 지인 차단(주소록) | `sync_contact_hashes({ p_sync_id, p_hashes, p_mode, p_final })` · `clear_contact_links()` · `mark_contact_prompted()` | `syncContacts` · `clearContacts` · `markContactPrompted` — 화면 줄은 '준비 중' 그대로(주소록 모듈 · 기기 해시 없음) |
| 스위치 | `avoid_org` 꺼짐(live 처음값)이면 12-5 회사 · 학교 자리 = '준비 중' 줄 2개(지인 차단 줄과 같은 글) · 데모는 켜짐(장면 `avoidoff` · `v4off` 로 꺼짐) | `AvoidPage` |

### 3부-마 CK10 · v4 실행권 회수 12개 — 앱이 부르는 곳(grep, 시험 파일 뺌)
| 함수(0037 [10] 회수) | 부르는 곳 | 화면 | 스위치로 막힘 |
|---|---|---|---|
| list_today_recommendations | `lib/recsApi.loadToday` · `lib/featuredApi.loadToday` | 09 추천 | 예 — `(tabs)/recommendations` V4Gate `v4_daily_recs` |
| list_likes · accept_like · decline_like | `lib/likesApi.loadAll` · `accept` · `decline` | 11 호감 · 10 상대 프로필 | 11 예(V4Gate `v4_likes`) · 10 은 아래 '10' 줄 |
| send_like | `lib/recsApi.sendLike` | 10 상대 프로필 | 아래 '10' 줄 |
| get_partner_grade | `lib/gradeApi.partnerGrade` | 10 상대 프로필 | from=reveal(v5) 길은 부르지 않음(QP-01) · 그 밖은 아래 '10' 줄 · 실패하면 null(화면 영향 0) |
| get_shop_state · demo_purchase · demo_restore_purchases · demo_end_subscription · get_match_once_preview · use_match_once | `lib/shopApi` 6곳(matchPreview 는 타입에만, 화면 호출 0) | 16 상점 · 구매 시트 · 하위 쪽 · 1회 매칭 시트 | 예 — `(tabs)/shop` V4Gate `v4_shop`. 16-G 내 등급(v5)은 gradeApi 만(상점 함수 0) |
| **10 상대 프로필 `/candidate/[id]`** | from=reveal 이 아닌 길(09 · 11 에서 엶) | 10 | **라우트 자체엔 스위치 없음** — 들어가는 버튼(09 · 11)은 V4Gate 로 막힘. 주소를 직접 치면(웹) 열리고, 0037 뒤엔 서버가 권한 없음으로 막아 [호감 보내기] · [수락] 이 실패 글만 냄(자료 노출 0). 막을지는 팀장 판단 |
| CK10 | 부르는 곳 0 — 주석 · 데모 서버 허용 목록(`settingsDemo` OPTIONAL_ITEMS · `demoBackend` 동의 검사)만. 앱 선택 동의 목록 = CK4 · CK9 · CK11 ~ CK16 | — | — |

### 3부-마 시험 (10-27 저녁, gen:legal D-203 뒤)
| 시험 | 결과 |
|---|---|
| tsc | 0 |
| eslint(바꾼 파일 11개) | 0 |
| jest | 87묶음 1615/1615(새 r0037Calls 15 · raFinish 취소 응답 기대값 1줄 고침) |
| check:copy · grade | 99/0 · 통과 |
| check:tokens | 5/0 |
| 웹 빌드 | 하지 않음 — 데모 경로는 jest(데모 클라이언트)로 확인. web-w6 은 결제 전에 ack 가 하나 더 돌 뿐(데모 처리기 있음) |
- 덧: 처음 jest 전부를 멈춘 뒤 남은 jest 프로세스(내 것)가 같은 기록 파일에 써서 '자식 프로세스 시작 실패(3221225794)' 묶음이 섞여 보였음 → 그 프로세스를 끝내고 다시 돌린 결과가 위 줄

## 3부-바 탑승권 이름 맞춤 · 10 관문 · 탈퇴 때 기기 목록 · 지인 차단 (D-199 ~ D-204 R-A 후속, 10-27, 마감 10-29)
- 기준: backend/migrations 0030 [5] 앱 함수 6 · 0037 [3] 장부 사유 · [4] 취소 · list_ticket_history(R37) · [7] 지인 · 0038 [2] 사유 3(age_*) · backend/R_변경기록 3장 · 6-2 (읽기만)
- 팀장 덧붙임(10-27): 카피 12-Q AVOID 9줄 확정 → 3번에 바로 붙임 · 크레딧 좌석 취소 확인창은 '스토어 환불' 문장 뺌 · T1 · T5 크레딧 끝나는 날 칸 숨김

| 단계 | 상태 |
|---|---|
| 0 읽기(0030 · 0036 · 0037 · 0038 정의 · R 변경기록) | 끝 |
| 1 탑승권 이름 · 인자 · 응답 · 데모 · 장부 사유 · T5 글 키 | 끝(코드) — boardingApi 전면(get_ticket_state + get_weekly_match · hold → demo_buy · board_with_credit · list_ticket_history) · demo/boardingDemo 서버 모양 · w6Boarding 시험 고침 |
| 1b 덧붙임: 크레딧 좌석 취소 확인창 · 끝나는 날 칸 숨김 | 끝(코드) — cancel.bodyCredit · next_expire_on · expires_on 읽지 않음 |
| 2 /candidate/[id] V4Gate | 끝(코드) — v5Hide CandidateGate(from=reveal 열림 · 그 밖 09 · 11 중 하나 켜짐) · jest.setup 대역 |
| 3 탈퇴 때 avoidLocal 지우기 · AVOID 9줄 · SecureStore(T126) | 끝(코드) — avoidLocal remove · 열쇠 '_' 꼴 · services 는 secureStorage avoidStorage(조각 · 이 기기 전용) · confirmWithdraw ok → remove · clearAvoidOrgs → remove · AvoidPage 9줄 |
| 4 지인 차단(expo-contacts · expo-crypto) | 끝(코드) — `npx expo install expo-contacts expo-crypto`(~57.0.8 · ~57.0.4) · lib/contactSync · contactsDevice · contactsServices · app.json 플러그인 · WRITE_CONTACTS 막음 · 이메일만(전화 0) |
| 4b 덧붙임 법무 L21 10-2: gen:legal --fingerprints · 사업자 정보 전자우편주소 줄 · CONTACT_EMAIL 하나 | 끝(코드) — 채울 값 19 · 지문 terms 6fb6a1a17214 · privacy b2686f7cefc8 |
| 5 시험 · 웹 점검 | 끝 — 아래 '3부-바 시험' |
| 6 커밋(푸시 0) | 끝 — 3부-바 커밋 |

### 3부-바 탑승권 이름 표(서버 확정 — 3부-마 표의 '가정 이름' 3개를 갈음)
| 일 | 앱이 부르는 이름 · 인자 → 읽는 키 | 앱 자리 |
|---|---|---|
| 탑승권 화면 상태 | `get_ticket_state()` → round{round_no · match_day · match_time · sale_open_at · sale_close_at · sale_state} · seat{state · paid_by · boarded_at} · region · reason · credit.balance (`next_expire_on` 읽지 않음) + `get_weekly_match()` → state matched(partner_id · room_id · partner A12 · A01 · A03) · not_found | `boardingApi.load` · `parseTicketState` · `parseWeeklyMatch`. sale_state before/open/closed/ended → 판매 전/중/끝/공개. 서버는 now 를 보내지 않아 기기 시각(데모만 장면 시각 now 를 더 보냄) |
| 결제(데모) | `hold_ticket_seat({ p_round_no })` → `demo_buy_ticket({ p_request_id })` → result boarded · credited · already_granted(outcome) · 실패면 `release_ticket_hold()` | `boardingApi.buy(requestId, false, roundNo)` — credited(결제 뒤 자리 없음 = paid_no_seat 크레딧)는 시트에 `noMatch.body` 한 줄(전용 글 카피 대기) |
| 크레딧으로 타기 | `board_with_credit({ p_round_no })` → { ok, reason, round_no, paid_by } | `boardingApi.buy(requestId, true, roundNo)` |
| T5 내역 | `list_ticket_history()` → credits[{ id · reason · round_no · created_at · state open/used/revoked · used_round_no }] · tickets[{ round_no · paid_by · boarded_at }] · balance (`expires_on` 읽지 않음) | `parseHistory`: +1 = 받은 장 · used → −1 '탑승권으로 씀'(날짜 = 그 회차 크레딧 탑승 시각, 취소했으면 없음) · revoked → −1 '스토어 환불로 회수됨'(날짜 없음) |
| 공개 사진 | `get_candidate_profile({ p_target: partner_id })` 의 face 승인 사진 | `boardingApi.facePhoto` — RevealScreen 만(탑승권 탭 읽기에는 부르지 않음) |
| 사유 → 화면 | board_check: full → 좌석 모두 참 · state · review_pending → 확정 전 · profile_incomplete → 정치 문항 글 / hold · credit 사유: full → sold_out · already_boarded → already · closed · before_sale · sale_off · no_round · region_closed · payment_closed → closed · state · review_pending · profile_incomplete → not_eligible · no_credit | `boardingApi` PHASE · INELIGIBLE · BUY_REASON |

### 3부-바 장부 사유 → T5 글 키(카피 14-5-2 · 14-7)
| 서버 사유(0030 · 0037 · 0038) | 글 키 | 글 |
|---|---|---|
| unbalanced · no_match · grade_gap | balance · no_fit · gap | 짝을 찾지 못해 돌려받음 |
| cancel_return(크레딧 좌석 취소) · cancel_credit(결제 좌석 취소) | cancelled | 탑승을 취소해 돌려받음 |
| refund_reversed | refund_restored | 스토어 환불이 취소되어 다시 받음 |
| (−1) use | used | 탑승권으로 씀 |
| (−1) store_refund(장 state revoked) | refund_taken | 스토어 환불로 회수됨 |
| paid_no_seat · round_cancelled · admin · age_rejoin_restore | **카피 대기** — 그 장(+1 · 쓴 −1)을 그리지 않음. 잔액이 있는데 줄이 없으면 '내역 없음' 글도 숨김 | — |
| age_terminate · (−1) age_hold | 해지 계정이라 화면 0 | — |
| (−1) expire | 0037 뒤 만료 없음 — 그리지 않음 | — |

### 3부-바 메모(고치지 않음 · 팀장에게)
- 서버 사유 `profile_incomplete` 하나가 정치 · 등급 · 종교 · 성별 · 지역 빈칸을 모두 덮어 앱이 '등급 계산 멈춤'(BOARDING.ineligible.paused 글)을 가르지 못함 → 지금은 정치 문항 글. 백엔드에 사유 나눔(예 grade_paused) 요청 거리.
- `region_closed`(1회차 수도권만)는 화면 글이 없어 결제 오류 '판매가 끝났어요'로 보냄 — 권역 밖 회원은 사전 오픈 대기 화면이 먼저 막는지 미확인.
- list_ticket_history: age_hold 로 소비된 장은 state 'open' 으로 나옴(해지 계정이라 화면 영향 0) — 백엔드 메모.
- 지인 차단 전화번호: 서버 회원 키가 이메일뿐 · 정규화 미정(R 변경기록 6-2) → 앱은 이메일만 해시해 보냄(전화 0). 이메일 해시 꼴은 0037 정의와 맞음(시험 ④: HMAC(pepper, 앱 해시) = 회원 키).
- 지인 차단 시트 글은 카피.md '12 · v4 R2 V05 NF5' 개선안 글자 그대로(v5 확정 표엔 아직 없음 — 카피 대기). iOS 권한 문구 = NF5-06 글.

### 3부-바 시험 (10-27 저녁, 하나씩 백그라운드)
| 시험 | 결과 |
|---|---|
| tsc | 0 |
| eslint(바꾼 · 새 파일 29개) | 0 |
| jest | 89묶음 1647/1647(새 r3bae 27 · candidateGate 5 — 1615 + 32 · 고친 기대값: w6Boarding 서버 모양 · r0037Calls loadAvoid 두 칸 · 열쇠 '_' · qpaSettingsV5 email 칸 · staticRules 등급 허용 목록에 boardingApi 한 줄(서버 사유 코드 grade_gap)) |
| check:copy · grade | 99/0(BOARDING.cancel.bodyCredit 들어가 98/1 → 99/0) · 통과 |
| check:tokens | 5/0 |
| 보안 check_sec2(읽기만 실행) | P7-f · P7-g · P7-h · P7-i 통과(SF-05 앱 저장 4/0). 전체 실패 1 = F-05s npm audit(moderate 6 · high 4 — expo · @expo/cli · zod · node-forge 등 기존 의존, 이번 expo-contacts · expo-crypto 2개와 무관 · audit fix --force 0) |
| gen:legal --fingerprints(법무 18:22 판) | 채울 값 19(+{전자우편주소}) · 지문 terms 6fb6a1a17214 · privacy b2686f7cefc8 · 동의 판 13개 그대로 |
| 웹 dist-demo 다시 만듦 | web-w6 390: 36/0 · web-f7 360: 63/0(셋째 판. 첫 판 26/2 · 둘째 판 22/3 은 동의 관리 CK15 · CK16 칸에서 매번 다른 자리 시간 초과 — 같은 때 다른 직원 run_s7 · probe3 가 돌던 부하, 이번 변경 밖 화면) |

# D46-A 만남 장면 앱 (D-205 · D-206, 10-27 ~ 마감 10-31) — 상태 저장(멈춰도 이어감)

- 기준: `팀장/세부청사진/D46_만남장면.md` · `기획/K27_만남장면.md`(0-1 D-206 · 3-2 상황표 21줄 · 4-1 박자 · 5-2 장소 규칙) · `기획/화면_요구사항.md` T4S · C3 · C7 · `기획/정책.md` P4-21 ~ 28 · `마케팅/카피.md` 16장 · `디자인/D46_만남장면/변경기록.md` 6장 · 원본 `scene.js` · `page.js`(연출 ④ cine) · `청사진_v5.md` 6-3
- 본인 지시: "만남이 매칭되었으면 바로 채팅으로 넘어가지 말고 … 우연히 앉아서 이야기를 시작하는 연출" · "장소는 매번 다르게, 연출은 예능, 나머지 권장대로 번역투없이 자연스럽게"

## 세부청사진(앱 몫)
| 항목 | 목표 |
|---|---|
| 자리 | 새 주소 0 — `/chat/[id]` 첫 상태(T4S). 판단: 기록 있음 → T4 · 첫 읽기 실패 → T4 오류(기록 0) · 사라짐 · 닫힘 · 상대 나감 → T4 · 내 글 있음 → 기록 + T4 · 열린 방 처음 → 기록 + 장면 |
| 연출 ④ | 위아래 어두운 띠(colors.text) · 장소 자막 카드 · 카메라 1 → 1.1(5초) · 걸어와 앉음 · 컵 내려놓음 · 시선 · 끝 줄 · 여운 · 종이색 걷힘. 6.24초 · 소리 0 · Reanimated transform · opacity 만 |
| 그림 | 디자인 scene.js 를 node 로 돌려 층별 SVG 를 `assets/illustrations/d46meet.json` 으로(색은 4안 원본 값 · 에셋 안에만, src 색 0) |
| 규칙 | 방마다 한 번(기기 `chat.meetScene.v1` · 웹 메모리 · 최근 20 · 로그아웃 · 탈퇴 때 지움) · 건너뛰기 늘 보임 48 · 동작 줄이기 = 정지 그림 + 카드 + 끝 줄 4초 · 스크린리더 = 자동 넘김 0 · [대화방으로 가기] · 끝 줄 두 갈래 · 장소 = opened_at 한국 날짜 주 번호 % 10(기준 2026-12-23) · 기억 줄 CHAT.room.metAt · 스위치 meet_scene(live 꺼짐 · demo 켜짐) |
| 글 | 카피 16장 키 20개 글자 그대로 · check:copy X 가 16장도 대조 |
| 데모 | chatnew(글 0 막 열린 방 → 조용한 방) · 기본 open(상대 글 → 상대 먼저) |
| 시험 | jest(한 번만 · 건너뛰기 · 동작 줄이기 · 스크린리더 · 장소 같은 날 같은 값 · 끝 줄 갈래 · 기억 줄) · tsc · check:copy · tokens · grade · web-w6 · web-f7 · 캡처 390 · 360 |

## 진행
| 단계 | 상태 |
|---|---|
| 0 팀장 덧붙임(10-27 19:2x): CREDITS.reason 4 · buyErrors.credited · CONTACT_BLOCK 4줄(카피 14-7 · 12-5) | 코드 고침 끝(boardingApi LOT_REASON 4줄 · COPY_PENDING = age_terminate 만 · BoardingScreen 전용 글 · settingsCopy 4줄 · r3bae 기대값) — 시험 전 |
| 0-2 팀장 덧붙임 ②(19:4x): CONTACT_BLOCK allow '동의하고 주소록 허용하기' · optionalNote · withdrawNote(시트 체크 글 아래 늘 보임) | 코드 끝(settingsCopy · AvoidPage 두 줄 · r3bae 기대값) |
| 0-3 CK11 동의 기록 확인 | 판 = consents.text_version(LATER_CONSENT_VERSIONS.CK11) · 시각 = agreed_at(서버 기본 now()) · 앱 판 app_version 남음. **받은 자리(시트 · 화면) 열은 없음** — consents 표에 자리 칸이 없어(0001 · 0016 · 0029 읽기만) 백엔드 몫 |
| 1 그림 에셋 생성기 `scripts/gen-meet-scene.mjs` → `assets/illustrations/d46meet.json`(93KB · 장소 10 · 사람 부품 9 · 빛 1) | 끝 — 층을 끝 모습으로 겹친 그림이 원본 정지 그림과 같음(헤드리스 Edge 1 · 2 · 9번 눈 대조) |
| 0-4 팀장 덧붙임 ③ 검수 B0(척추 Q2 후보): 데모 탑승 관문 | 코드 끝 — boardingDemo boardCheck 에 profileReady(실서버 ticket_profile_ready = CK15 + 정치 답 + 종교 7코드) · surveyV2Backend demoSurveyReady · demoBackend 연결(데모 줄 '설문 완료 · 정상 응답'으로 건너뛴 계정 · 설문 기록이 없는 장면 · 시험 계정은 준비됨). 시험 전 |
| 2 앱 모듈 | 코드 끝 · tsc 0: theme/meetArt · theme/motion scene2.meet · chat/meetCopy(MEET_SCENE) · chatCopy CHAT.room.metAt · meetLogic(장소 = 기준 2026-12-23 주 번호 % 10 · 판단 순서) · meetSeen(chat.meetScene.v1) · meetTimeline(worklet) · MeetArt · MeetScene · useMeetScene · lib/screenReader · ChatRoomScreen(겹침 · 기억 줄 · 판단 중 바탕 1초) · /chat/[id] meet=appMeetDeps · 설정 로그아웃 · 탈퇴 때 지움 · featureKeys meet_scene(D46 · live 꺼짐 · 데모 켜짐) · chatDemo fresh(chatnew) · partnerFirst(chatfirst) · 목록 데모 줄 바꾸면 기록 지움 |
| 3 check:copy X 에 16장 18줄 · 16-3 낱말 | 끝 — X 248줄 통과(점검 수 그대로). 지금 97/2 = A · I(법무 처리방침 19:26 · 19:28 개정, 마지막 커밋 전 gen:legal --fingerprints 팀장 지시) |
| 4-a 새 시험 | d46MeetScene 27 · b0BoardGate 6 = 33/33(타이머 · 대화방 읽기가 시험 뒤에 돌지 않게 매 시험 뒤 unmount) · eslint(바꾼 · 새 파일) 0 · tsc 0. useMeetScene 은 효과 안 setState 0(react-hooks 규칙) — 판단은 그릴 때 굳히고 기기 기록만 효과에서 |
| 4-b 웹 점검 새 스크립트 `scripts/web-d46.mjs`(chatnew · chatfirst · 한 번만 · 기억 줄 · 넘침 · 글자 · 터치 · 캡처) | 첫 판 8/4 — 찾은 것: react-native-web 의 isScreenReaderEnabled 가 늘 참이라 웹에서 장면이 늘 '화면 읽기' 판(저절로 넘김 0 · [대화방으로 가기])이었다 → lib/screenReader 가 웹에서는 읽지 않고 꺼짐(SurveyChatScreen 메모와 같은 이유). 넘침 18 은 카메라 1.1 배 그림이 그림 칸(overflow hidden) 안에서 잘린 것 — 점검이 화면 안 잘림 틀 안 요소는 빼게 고침. 번들 다시 만든 뒤 **390 17/0 · 360 17/0**(한 번은 가입 길 06 → 07 40초 넘김으로 0/1 — 같은 번들 다시 돌려 통과, 이번 변경 밖 화면). 캡처 `확인/스크린샷/D46_390/D46_장면_390.png` · `D46_360/D46_장면_360.png`(약 4.8초 — 끝 줄 · 빛 따뜻해진 뒤) |
| 4-c 웹 · 점검 | dist-demo 다시 만듦(2번 — 화면 읽기 고침 뒤) · web-w6 390: 36/0 · web-f7 360: 63/0(첫 판 26/2 = 동의 관리 CK15 보기 시트 15초 시간 초과 · 이번 변경 밖 화면 — 3부-바와 같은 흔들림, 혼자 다시 돌려 통과) · 팀장 ① gen:legal --fingerprints(법무 19:26 · 19:28 처리방침 개정 — legalPrivacy 4줄 · consent.ts 처리방침 지문 b2686f7cefc8 → 312ecbd7eb0a, 판 13개 그대로) → check:copy 99/0 · grade 통과 · tokens 5/0 |
| 4-d jest 전부 · tsc · eslint | jest 91묶음 1680/1680(1647 + 새 33) · tsc 0 · eslint(바꾼 · 새 파일) 0 |
| 5 커밋(푸시 0) | 4bd2606(37개 파일) · 푸시는 팀장 대조 뒤 |

## D46-A 대조표
| 항목(지시 · 세부청사진 · K27) | 실제 | 일치 |
|---|---|---|
| 대화방 첫 상태(새 주소 0) · 어느 길이든 첫 진입 | /chat/[id] 라우트가 meet=appMeetDeps · 대화방 위에 겹침 | ○ |
| 연출 ④: 띠 · 자막 카드 · 카메라 1 → 1.1 · 걸어와 앉음 · 컵 · 시선 · 끝 줄 · 여운 · 종이색 걷힘 · 6.24초 | page.js cine 시간표 그대로(scene2.meet) · 걷힘은 장면 덮개가 위에서부터 걷히며 아래 대화방이 드러남 | ○ |
| transform · opacity 위주 · 움직이는 층 3개 이하 · 소리 0 | View transform · opacity 만 · 움직이는 층 = 장면 전체(cam) + 빛 1(사람 부품은 사람 층 안 작은 칸) · 소리 · 진동 0 | ○ |
| 그림: 장소 10 · 고정 두 인물 SVG · 색은 4안 · 1안 값만 | 원본 scene.js 를 node 로 돌린 정적 에셋(색은 에셋 안에만 · src 색 0 — tokens B 통과) | ○ |
| 한 번만(기기 · 웹 메모리 · 로그아웃 · 탈퇴 지움) · 내 글 있으면 0 | meetSeen chat.meetScene.v1 최근 20 · 웹 메모리 · leaveToStart 에서 지움 · 시작 때 기록 | ○ |
| [건너뛰기] 늘 보임(48) · 동작 줄이기 4초 · 화면 읽기 자동 넘김 0 · [대화방으로 가기] | 건너뛰기 48 · 정지 그림 150 → 4000 → 150 · reader 모드 버튼 하나(웹은 화면 읽기 꺼짐으로) | ○ |
| 끝 줄 두 갈래 · 장소 = opened_at 차례 · 기억 줄 · 닫힌 방 예외 · 스위치 | 상대 글 · 사진 · 음성 → '먼저 말을 걸어왔어요' · 기준 2026-12-23 주 번호 % 10 · CHAT.room.metAt(열린 · 닫힌 방) · 닫힘 · 나감 · 사라짐 · 실패 0 · meet_scene live 꺼짐 · 데모 켜짐 | ○ |
| 카피 16장 글자 그대로(지시 '키 20개') | 16장 표는 **18줄** — 18개 모두 글자 그대로 · check:copy X 대조(99/0 유지) | △(수 18) |
| 데모 chatnew · 상대 먼저 | chatnew(fresh) · chatfirst(partnerFirst) · 목록 데모 줄 바꾸면 기록 지움 | ○ |
| 시험 | jest 1680/1680 · tsc 0 · check:copy 99/0 · tokens 5/0 · grade 통과 · web-w6 36/0 · web-f7 63/0 · web-d46 390 · 360 17/0 · 캡처 2장 | ○ |
| 덧붙임 ① ② ③ · B0 · CK11 확인 · gen:legal | 모두 반영(위 0 ~ 0-4 · 4-c) | ○ |

# 3부-사 0039 응답 · 종교 동의 카드 (D-219, 10-27 ~) — 상태 저장(멈춰도 이어감)

- 기준: `팀장/세부청사진/S_3부사_종교동의.md` · backend `R_변경기록.md` 8-4(0039 응답 표) · 검수 `Q9_6칸감사_v5.md` N1 · N3 ~ N6 · `웹점검_f1f3_원인.md` · B0 `_log/QP2/b_bbae/b0_ck4off.log` · 테스트웹 FB-014 ~ 016
- 차례: ② 0039 응답 5종 → ③ meetSeen 보관 → ④ 검수 결함 · 웹 f1 · f3 → ⑤ FB-014 ~ 016 → ① 종교 동의 카드(카피 도착 뒤). 묶음마다 커밋 · 푸시 0
- 바닥선(bbaef90): jest 91묶음 1,680/1,680

| 단계 | 상태 |
|---|---|
| ② 0039 응답 5종 | 끝(커밋 ②) — 아래 '② 표' |
| ③ meetSeen | 끝(커밋 ③) — meetSeen 이 appStateStorage(SecureStore 조각 · 웹 메모리) · check_sec2 P7-f 통과 |
| ④ 검수 결함 · 웹 | 끝(커밋 ④) — 아래 '④ 표' |
| ⑤ FB-014 ~ 016 | 끝(커밋 ⑤) — 아래 '⑤ 표' |
| ① 종교 동의 카드 | 끝(커밋 ①) — 아래 '① 표' · gen:legal --fingerprints(법무 22:03 ~ 22:07 판, CK4 consent-2026.10.27-v2) 같은 커밋 |

### ② 0039 응답 5종 (R_변경기록 8-4 표 → 앱)
| 응답 | 앱이 읽는 곳 | 화면 |
|---|---|---|
| `get_my_grade` v5 `grade_icon` · state shown / pending / paused | `lib/gradeApi` parseMyGrade(풍경 키만 · grade_no 읽지 않음 · 모르는 키면 오류 화면) · GradeIcon 키 목록은 lib 한 곳 | 16-G1 내 무리 = 서버 키 그대로(iconBridge 는 16-G2 변화 기록만 — list_grade_history 0012 는 숫자). 구독 잠금이 없어져 '내 등급 알려 주세요'(무료 열람 요청)를 보기 · 계산 전 · 멈춤 화면 링크 맨 위에. 서버가 안 주는 칸(합침 · 매너 · 올릴 여지)은 0 · 목표 쪽 '완료' 표시 0 |
| `reason_detail` | `boardingApi.ineligibleOf` | politics_missing → 정치 문항 글 · grade_paused → 등급 계산 멈춤 글 + [설정으로] · profile_missing · grade_pending · religion_missing(① 전) · 모름 · 없음 → 일반 안내('확정을 마치면 탈 수 있어요'). 결제가 not_eligible 로 막히면 다시 읽어 카드로 |
| `contract_ack_required` | BUY_REASON · demo_buy 오류 → `ack_required` | 결제 버튼 → ack_ticket_contract → hold → demo_buy(크레딧은 board_with_credit). 관문에 걸리면 ack 다시 · 한 번만 다시 부름 → 또 걸리면 일반 결제 오류 글(결제 0) |
| `list_ticket_history` `held` | parseHistory | 그 장(+1)과 옮긴 줄 모두 그리지 않음(해지 계정 — age_terminate 와 같은 화면 0) · 잔액은 서버 값 |
| `set_avoid_org` `org_key_missing` | settingsApi setOrg → 'off'(feature_off 도) | 되돌리고 '준비 중이에요' 토스트 · 다시 시도 글 0 · 빼기는 그대로 |
- 데모 모의 서버: boardingDemo 관문 3곳 · 판 형식 `^contract-5-8-[0-9a-f]{8}$` · reason_detail(demoBackend profileDetail: 설문 정치 → 등급 멈춤(상점 모의 processing) → 이메일 gradenew = grade_pending → 설문 종교) · shopDemo get_my_grade v5 · settingsDemo 장면 avoidnokey
- 시험: 새 `s3sa0039.test.tsx` 10 · 고친 기대값 8묶음(gradeScreen · shopApi · s8dConnect · settingsGrade · f24DemoPeople · r3bae · b0BoardGate · w6Boarding — 잠금 화면은 옛 서버 응답을 끼워 시험)
- 확인(②만 바뀐 때): tsc 0 · jest 92묶음 1,690/1,691 → staticRules 1(boardingDemo 주석의 grade 낱말) 고친 뒤 33/33 · check:copy 99/0 · grade 통과 · tokens 5/0

### ③ meetSeen 보관
- `features/chat/meetSeen.ts`: 기록 저장소 = `lib/secureStorage` appStateStorage(설문 임시 저장과 같은 길 — 네이티브 SecureStore 조각 · 이 기기 전용, 웹 메모리). 열쇠 chat.meetScene.v1 · 최근 20방 · 로그아웃 · 탈퇴 때 지움 그대로. `meetMemoryOf(저장소)` 로 시험
- 시험 `s3saMeetStore.test.ts` 2(코드에 AsyncStorage 0 · 조각 저장 왕복 · 지움 · 틀린 값 버림 · 20방)
- check_sec2(10-27 밤): P7-f 통과(허용 표식 3곳 그대로). 실패 2 = F-05s(npm audit, 앱 의존 — 예상) · V36-d(DB 묶음 'B안 시험 준비 실패 — account_status_suspend_window', 보안 시험 파일 21:59 다른 세션 개정 · 앱 코드 무관, 마지막에 다시)

### ④ 검수 결함 · 웹 점검
| 결함 | 원인 | 고침 | 확인 |
|---|---|---|---|
| N1 08 알약 두 줄 | Chip 의 lead 아이콘 칸이 세로(기본 column) | 앞 아이콘이 있으면 체크 칩과 같은 가로 줄(왼쪽 8 · 사이 4) | s3saDefects |
| N3 16-G 웹 16px 넘침 | SubPage 가 오른쪽에서 들어오는 움직임(Rise x)이 탭 틀 밖 /grade 에서 문서를 잠깐 넘겨, 모바일 폭 웹이 406 으로 줄여 보인 채 남음(탐침: 230ms 에 my-grade 오른쪽 399) | MyGradeScreen 에 가로 자르는 틀(flex 1 · overflow hidden) | 탐침 390 → 390 · 430 → 430(전 406 · 446) · s3saDefects |
| N4 aria-valuenow 0/5 | RN-web 0.21 은 accessibilityValue 객체를 넘기지 않음 | TraitBar · TraitSlider · ProgressBar · 설문 v2 진행에 aria-value* 같이(정치 막대 · 스위치는 이미 있음) | web-f3 이 aria-valuenow 로 07 값을 읽어 75/0 |
| N5 대기 링 웹 멈춤 | RN Animated useNativeDriver → 웹 JS 대체가 호 transform 을 다시 쓰지 않음 | Ring 을 Reanimated withRepeat 로(네이티브 · 웹 같은 코드) | web-f1 '링이 돈다' 서로 다른 값 14개(전 1 ~ 5) · splash 11/11 |
| N6 고객센터 문장만 | 연락처 값 없음 → 아래 줄 숨김, 본문 '아래 연락처로 알려 주세요'는 남음 | 연락처가 없으면 그 문장만 빼고 앱 신고 길 문장(원본 글 그대로) | settingsScreen · s3saDefects |
| 웹 f1 | 링 판정이 '한 번 바뀜'이면 통과(T4) | 1.5초 동안 100ms 마다 · none 0 · 서로 다른 값 5개 넘게 | f1 75/1 — 남은 1 = C '덧붙이는 안내'(법무 동의문구 22:03 개정 · gen:legal 전, 앱 밖) |
| 웹 f3 | 07 숫자 글자를 읽다 예외 → 뒤 61줄 안 돎 · 예외를 실패 수에 안 넣음(T2) · 끝난 뒤 Edge · node 남음(T1) | aria-valuenow 읽기 · 예외 = 실패 1 · 닫을 때 Edge 프로세스 나무째(taskkill /T) · 서버 연결 모두 끊음 | f3 75/0 · 정상 끝 |
| 카피 16-2 go ↔ T4S | 앱은 T4S · 정책 P4-25(동작 줄이기 = 4초 뒤 저절로 · 버튼은 화면 읽기만) 그대로 | 시험에 '동작 줄이기 때 [대화방으로 가기] 0' 한 줄 · 머리 주석 | 카피 메모 쪽 고침은 팀장 넘김 |
- 전체 jest(④ 뒤): 94묶음 1,696/1,698 — 실패 2 = legalGen · legalContent(법무 원본 22:03 ~ 22:07 개정, gen:legal 은 팀장 알림 뒤). check:copy 94/5 도 같은 까닭(A · B · I)

### ⑤ 테스트웹 FB-014 ~ 016
| FB | 고침 | 확인 |
|---|---|---|
| 016 짧은 길에서 장면 0 | 채팅 데모 기본 장면 = 막 열린 방(글 0 · fresh). 대화가 이어진 방은 이메일 chatopen · 데모 줄 차례 막 열린 방 → 상대가 먼저 → 열린 방 → 마지막 날 → 연장 → 나감 → 닫힘 → 방 없음. 방 id 는 탑승권 데모 공개 room_id 와 같음 · 실서버 규칙(내 글 있으면 장면 0) 그대로 | s3saFb · d46 · w5Chat(대화 이어진 방 시험은 chatopen 으로) · web-w5 는 시작에 데모 줄 두 번 |
| 015 입구 하나뿐 | T2 할 일 '아는 분 미리 피하기'(사전 오픈 할 일과 같은 글) · 사전 오픈 단계표 할 일 줄을 누를 수 있게 → 설정 탭 12-5 쪽(features/settings/settingsIntent: 열 쪽을 메모리 한 칸에 남기고 설정이 초점 받을 때 꺼냄 — 라우트 늘리지 않음) | s3saFb |
| 014 장소가 늘 한강 벤치 | 데모 장면마다 방이 열린 주(WEEK_OF): 막 열린 방 0 · 상대가 먼저 1 · 나감 2 · 닫힘 3(날짜 글이 있는 열린 방 · 마지막 날 · 연장은 0) → 한강 벤치 · 한옥 골목 · 카페 테라스 · 제주 바닷가 | s3saFb · d46 기억 줄 · w5 닫힌 방 지우는 날 2월 19일(web-w5 같이) |

### ① 종교 동의 카드(본인 결정: 정치 CK15 와 같은 방식 · 카피 17장 · 법무 L22 A안 · D2)
| 항목 | 한 일 |
|---|---|
| 카드 자리 · 조건 | 대화형 설문 A06 차례에 유효한 CK4 가 없으면 질문 대신 카드(입력칸 0 — L22 1-2 #4). 03 에서 CK4 를 고른 회원은 카드 없이 A06. 설문 v2(답 확인 화면에서 A06 을 열 때)도 같은 카드 · [다음] 0 |
| 카드 글 | `features/surveyChat/relCopy.ts` REL = 카피 17-1 · 17-4 그대로(제목 · 본문 · 네 줄 상자 · 공개 · 거두기 · 보기 › 읽기 이름 · 체크 · 버튼 · 받아 주는 말). 체크 줄 = 생성 파일 CK4 체크 문구 · '보기 ›' = 03 과 같은 CK4 요약 · 전문 시트. CHAT_V6 밖(카피 머리 말 '앱 판단') |
| 동의 · 거절 | 체크 없이 [동의하고 답할게요] = '동의 칸을 눌러야…' 한 줄(기록 0) · 동의 = `recordConsents` CK4(판 CONSENT_TEXT_VERSIONS.CK4 = consent-2026.10.27-v2) → A06 질문 · 거절 = CK4 '동의 안 함' 줄(L22 1-5) + A06 '답하지 않음'(null) → 다음 문항 · 같은 설문에서 다시 묻지 않음 · 거절 말풍선을 누르면(고치기) 카드 다시 |
| 설문 모델 | A06 은 보기에 '말하고 싶지 않아요'가 없지만 카드 거절만 null(서버 0023 민감 문항 null 허용) — `surveyV2/model` RELIGION_ID · 데모 검사식도 같음 |
| T1 | reason_detail religion_missing → 카피 17-2 '설문 한 문항이 남았어요 / 종교 문항에 답하면…' + [설문으로]. survey_missing(선택)은 쓰지 않음 — 서버가 정치를 먼저 보아 둘 다 비면 politics_missing 하나 |
| 동의 관리 | 서버 기록 그대로 켜짐(C1). CK4 켜짐 = ck4OnNote(M9 — 덧붙이는 안내 숨김) · CK15 켜짐 = ck15OffBody · CK4 켜기 = 같은 카드(C5) · 탈퇴 확인창 rejoinNote(M8, 팀장 '넣음') |
| 데모 = 실서버 판정 | 설문 모의 서버의 동의 기록을 데모 로그인 모의 서버(demoBackend)로 넘김(설문 카드에서 받은 CK15 · CK4 가 동의 관리에 켜짐 — CK15 '꺼짐' 결함 원인) · A06 값 저장에 CK4 필요(consent_required: CK4) · 설정에서 CK4 거두면 A06 '답하지 않음' · CK15 거두면 정치 답 지움 → 탑승 관문 religion_missing · politics_missing(데모 줄로 건너뛴 계정도 CK4 거두면 religion_missing) |
| check:copy | W 에 17장 REL 16줄 대조 + 느낌표 · 등급 · 점수 0(예외 CHAT.REL.use '등급 계산에는 쓰지 않아요.') · X' 에 17-2 religion_missing 3줄 · 12-Q ck4OnNote · rejoinNote |
| 웹 점검 | f7(CK4 켜기 = 카드) · v6f · f20 · ime · surveyV2Driver(손님은 CK4 가 없어 카드 → 동의) 고침. v6f 기대 키 F07 · f20 '그 외' 글 · F07 자동 값(옛 기대값)도 같이 |
| 시험 | 새 `s3saReligion.test.tsx` 9(카드 모양 · 동의 · 거절 → T1 · CK4 있으면 카드 0 · 고치기로 다시 · 설정 끔 → 탑승 0 · 건너뛴 계정 · 동의 관리 표시 · 설문 v2 카드). 고친 기대값: b0BoardGate(동의는 정치 · 종교 API 로 · CK4 없이 종교 값 저장 거부) · 설문 시험 3묶음(rig 에 CK4 미리) · surveyV2Model · surveyV2Demo · consentScreen(법무 CK4 덧붙이는 안내 v2) · settingsScreen(CK4 켜짐 줄 · 켜기 카드) · settingsGrade(탈퇴 rejoinNote) · s3sa0039 |

# 3부-아 (D-223, 10-28 ~) — 상태 저장(멈춰도 이어감)

- 기준: 팀장 지시(3부-아) · backend `R_변경기록.md` 9-4(0041 consents.source · too_many_consents) · 검수 `QP_결함목록.md` QP-09 · 10 · 32 · 35 · 36 · 37
- 차례: ① gen:legal → ② source · 상한 → ③ 검수 결함 → ④ 등급 숫자 글 확인 → (카피 도착 뒤) 카피 묶음. 묶음마다 커밋 · 푸시 0

| 단계 | 상태 |
|---|---|
| ① gen:legal --fingerprints(법무 약관 제9조의2 ③ · 제14조의2 ⑦ · 처리방침 9-4 · R40 · R28 · 5-4 · R44) | 끝 — 약관 지문 3401d1970afa · 처리방침 6fead106379c · 동의 판 13개 그대로 · check:copy 103/0 · 법무 시험 42/42 |
| ② consents.source · too_many_consents | 끝(커밋 ②) — consentApi source 한 칸(03 signup · 정치 · 종교 카드 survey_card · CK16 · 지인 차단 시트 CK11 feature_sheet · 동의 관리 · 알림 settings) · 54000 too_many_consents → reason 'limit'(동의 관리 글은 카피 묶음 tooMany) · 데모 서버 4값 검사 · 같은 오류 꼴 · 시험 s3aConsentSource 2 |
| ③ 검수 결함 | 끝(커밋 ③) — QP-10 데모 채팅 신고 · 차단 → 설정 신고 내역 · 차단 목록(demo_note_chat_safety, 실서버는 0031 이 같은 표) · QP-09 대화형 설문 요약이 done 이면 07 다시 확인 없이 확정 → 08(실패 · 미완료는 지금처럼 07) · QP-32 T1 [설문으로] → 설문 v2 한 문항 입구(notice politics · religion) — 그 문항만 하고 T1 로 · 시험 s3aDefects 6 · serverFlow source 칸 맞춤 |
| ④ '9단계 중 n등급' 확인 | 끝 — v5 화면에 안 나옴(후보 등급 카드는 from=reveal 에서 가림 · 09 는 v4_daily_recs 꺼짐) → 그대로 · 1.1 정리 목록 |
| 카피 묶음(마케팅 '3부-아 카피 끝') | 진행 — 20장 · 13-1 · 12-Q |
