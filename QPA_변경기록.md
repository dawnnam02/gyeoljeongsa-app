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
| 카피 묶음(마케팅 '3부-아 카피 끝') | 끝(커밋 카피) — 20장: TRAITS.axisNote · GI.howProcess(법무 C10 ③ 앞 두 문장) · goalTitle · links[1] · goalHead · goalPromise · goalPick 지움 · survey.common.declinedValue(답 확인 결과만) · T1 profile_missing · grade_pending · BOARDING.tasks.avoid · AVOID.saving([더하기] 점 셋 읽기 이름) / 13-1 POL.needConsent / 12-Q ck4OffBoarded · ck15OffBoarded(판매 마감 전 · 이번 회차 탑승권 있을 때만) · tooMany(동의 관리 · 설문 CK4 · CK15 · CK16 카드) · SUPPORT.contactPending · check:copy 20장 대조(SEC20 · X 새 1항) 104/0 · 시험 s3aCopy 10 · 카피.md 원본은 손대지 않음(옛 줄 교체 · '반영' 표시는 마케팅) · 데모 회사 이름은 앱에 없음(D45 시안 · 테스트웹) |

# 3부-자 (D-223 후속 · 10-28 ~) — 라운지 · 연애 기능 검수 결함 묶음 · 상태 저장(멈춰도 이어감)

- 기준: 팀장 지시(3부-자) · 검수 `QP_결함목록.md` QP-39 ~ 49 · `LG_검수표.md` 7장 · `IF2_검수표.md` · backend `R_변경기록.md` 12장(0044 앱 넘김) · 카피 19-13 · 21장 · 기획 정책 PF-08 · 16 · 21 · 22 · 23 · 31 · 33 · 화면 B1 · IF-MAG · 04 · 07 · T4 · `ai/IF2/문구_라이브러리.json`(travel_types 12 · pack_quiz 7 · trip_places 12) · `계산명세.md` 10-1 · 10-2 · 팀장 점검일지 416
- 지킨 선: backend · 법무 · 다른 직원 파일 수정 0(카피.md 는 19-13 이 정한 '앱 커밋에서 19-2 표로 옮김'만) · 실서버 · 유료 · AI 호출 · live · 스위치 켜기 0 · 푸시 0(팀장) · `npm audit fix --force` 0 · 카피 · 법무 줄은 '카피 도착' 뒤

## 3부-자 세부청사진(착수 전)

| # | 할 일 | 통과 조건(측정) |
|---|---|---|
| 1 | 법무 도착(QP-47): gen:legal --fingerprints · 12 생성형 AI 고지 둘째 문장 = 법무 5-6 | 처리방침 지문만 바뀜 · 동의 판 그대로 · '이번 주 타로' 앱 0(grep) · 법무 시험 통과 |
| 2 | 라운지 QP-39 · 같은 꼴 전수: accessibilityState(checked · selected · expanded) 옆에 aria 같은 값 | 스캔 0곳 · 웹 공감 aria-pressed · 신고 사유 aria-checked |
| 3 | 라운지 QP-40: 위기 카드 [닫기] 48 × 48 | 웹 터치 48 이상 |
| 4 | 카피 19-13 `LOUNGE.row.lineRulesChanged`: 줄 intro + has_seat → 새 한 줄 · 첫 입장 시트 맨 위 `intro.rulesChanged`(있음 — 확인) · 카피.md 19-13 줄을 19-2 표로 · check:copy LG 210 | check:copy 0 · 시험 |
| 5 | 0044 넘김: 줄 = `get_lounge_row_state`(intro 면 has_seat 를 lounge_state 로 한 번 더) · 숨긴 좌석 = `get_lounge_my_hidden` · [다시 보기] = `lounge_hide(post, false)` · 실시간 `closed` → 화면 닫힘 · 글 비움 · 구독 끊기 · 데모 모의 서버 같은 이름 · 모양 | 시험(응답 키 · 구독 끊김) · web-lounge |
| 6 | 07 · 대화형 설문 끝(chatDone) → `confirm_profile(null)` → 08(06 · 07 건너뜀 · 실패면 지금처럼) · 데모 같은 길 | 시험 |
| 7 | 연애 기능 QP-43(안 탄 분 기내지 notBoarded — 탑승권 상태로 가림) · QP-46(동의 시트 저절로 0) · QP-48(흐린 칸 글 = sub 토큰 · 대비 4.5+) · QP-49(궁합 ① '{같은 점}' 줄마다 · 두 줄까지) · QP-44(B1 탑승권 표 회차 번호 0 — 정책 PF-08) | 시험 · web-if2 |
| 8 | 여행 타입 12 · 짐 싸기 7 · 여행지 12 = 라이브러리 원본(생성기) · 데모 타입 = 계산명세 10-1(fun_calc travel_type 같은 값) · 짐 싸기는 기기에만 · 노선 두 역 · 기내지 ⑤ 여행지 글 | gen --check · 시험(타입 경계 · 노선) · 웹 |
| 9 | onLayout 폭 0 꼴(불러오는 중 칸 뒤 같은 자리 View 에 onLayout) 다른 화면 전수 · 고침 | 목록 · 웹 |
| 10 | node-forge: 메이저 아닌 해법(overrides 등) — 시험 다 통과할 때만 | npm audit 줄어듦 · jest · 웹 |
| 11 | (카피 도착 뒤) 강퇴 · 나감 [돌아가기] → T4 · `FUN.ck17.link` '동의하고 보기' → IF-CK17 · 07 · 04 끝 [내 여행 타입 보기] · 그 밖 마케팅 3부-자 줄 | check:copy 0 · 웹 |
| 12 | 바닥선: tsc · jest · check:copy · tokens · 웹 전부(f1 · f3 · f7 · w6 · d46 · lounge · if2 3폭) · check_sec2(F-05s만 + LG-a 보안 몫) | 숫자 |

## 3부-자 진행

| 단계 | 상태 |
|---|---|
| 청사진 | 끝 |
| 1 법무(QP-47) | 끝(커밋 1) — gen:legal --fingerprints 처리방침 지문만 바뀜(ad0f07284147 → 7dec841d9b78 판 · 동의 판 13개 그대로) · IMAGE_CREDIT.aiWriting '이번 주 카드' · '이번 주 타로' 앱 0(grep) · 법무 시험(legalContent · legalGen · consentLogic jest) 39/39 |
| 2 ~ 5 라운지(커밋 b3db992) | 끝 — QP-39 `lib/webAria.ts`(aria-pressed) + 공감 알약 aria-pressed · 신고 사유 aria-checked · 기장 고른 칸 aria-selected · GradeChip aria-expanded(같은 꼴 전수 스캔 → 코드 전체 jest 로 못 박음: accessibilityState 29곳 중 짝 없는 곳 0) · QP-40 TextButton minWidth 48(위기 [닫기] 48 × 48) · 강퇴 · 나감 [돌아가기] → `/chat`(라벨은 카피.md 에 줄 없어 `LOUNGE_BACK_TO_LIST` 로 LOUNGE 밖에 둠 — 마케팅 확인 대기) · 19-13 `LOUNGE.row.lineRulesChanged` 를 19-2 표로 옮김 + check:copy LG 209 → 210 · 0044: `get_lounge_row_state`(T4 줄 — intro 면 `lounge_state` 로 has_seat 한 번 더 → 약속 바뀜 줄) · `get_lounge_my_hidden`(숨긴 좌석 시트를 열 때 · 객실에 처음 닿을 때 채움, [다시 보기] = `lounge_hide(post, false)`) · 실시간 `closed`(화면 닫힘 · 글 비움 · 구독 끊김 + 상태 한 번 다시 읽기) · 데모 모의 서버 같은 이름 · 모양(`rowLineOf` 지움 → `rowLineText`/`rowKeyOf`) · 시험 s3jaLounge 12 |
| 6 대화형 끝 확정(커밋 9faaab7) | 끝 — `aiApi.confirm(id \| null)` · `features/ai/interviewConfirm.ts`(null 확정 → 안 되면 건 id → 안 되면 지금 길) · TraitsScreen: 건이 없어도 chatDone 이면 null 확정 → 08, 05 사진 마치기(PhotosLite)에서도 chatDone 이면 ai-profile start 없이 확정 → 08 · 데모 `confirm_profile(null)`(대화형 정리 done 일 때만 · `demoShared.interviewDone`) · s3aDefects QP-09 기대값 `confirm(null)` · 시험 s3jaInterview 6 + surveyLite 1 |
| 7 연애 기능 QP-43 · 44 · 45 · 46 · 48 · 49(커밋 bb51239) | 끝 — QP-43 기내지 `none` 을 탑승권 상태로 가름(`magazineNoneKind`: 판매 중 · 마감 뒤 공개 전인데 탑승권 없음 = `MAGAZINE.notBoarded` · 그 밖 = `closed` · 라우트가 `boardingServices().api.load()` 를 넘김) · QP-46 `asked` 메모와 쪽 도착 때 `setSheet('ck17')` 를 지움 → ① 쪽 안 한 줄 + [동의하고 보기] `FUN.ck17.agreeView` 를 누를 때만 시트 · QP-48 `HomeCell` 열 수 없는 칸 · 동의 시트 ② 줄 · 작별 엽서 고르기의 `full` 칸을 투명도 0.4 대신 `offLook="own"` + sub 색(대비 sub/bg 5.34 · sub/card 4.78 ≥ 4.5) · QP-49 `sameLines`(코드 하나 `same.one` · 둘 `same.two` · 갈래 문장, 줄 안 '두 분 다' 0, 두 줄까지) + `txSeq`(같은 이름 자리 여럿에 차례로) · QP-44 `BOARDING.round` = 글 하나 '이번 주'(T3 `REVEAL.kicker` · 사기 시트 요약은 `CREDITS.round` 로 번호 그대로) · QP-45 offNote 카피 반영 · 카피.md 21-22 줄을 21장 표(키 백틱 꼴)로 옮김 → IF2 키 줄 372 → 376(`check-copy` 기대값 · `gen-if2-copy` 다시 = 글 375) · 21-18 에 `BOARDING.round` · 21-19 매핑 갱신 · 21-22 줄마다 '반영(3부-자 · 10-29)' |
| 8 열두 타입 · 짐 싸기 7 · 열두 여행지(커밋 bb51239) | 끝 — `gen-if2-assets` 가 라이브러리 `travel_types`(12) · `pack_quiz`(7 × 3) · `trip_places`(12)와 디자인 타입소재 33개(타입 12 · 짐 21 — `types` · `items` 로 나눔, 둘 다 `film_camera` 라) · 엽서 앞면 하늘 띠(`typeSky`, 시안에서 띠 넷 + 테두리만)를 앱 사본 · if2art.json 에 옮김 · `TypeCardScreen` 새로: 짐 싸기 7문항(진행 숫자 0 · 기기에만 `typeBag` · [나중에 하기]) → 엽서 앞(타입 소재 38.75% + 짐 일곱 12.5% 한 칸씩, 디자인 목록 배치 그대로 · 이름 · 앞면 한 줄 `TYPE_CARD.result.line` · 읽기 이름 `a11y.front`) → 뒷면(설명 세 줄 · 노선도 두 역 이름 + 까닭 `route.why` · 끝줄 · 대화 팁 `tip` 은 안 그림) · 홈 B3 · B6 칸: 타입이 있어도 짐을 안 쌌으면 "짐을 싸면 …" · 기내지 ⑤ 쪽: `trip_no` → 여행지 글 + 둘이 하기 좋은 일 한 줄 · 데모 타입 `travelType`(funCalc 에 fun_calc.travel_type · type_routes 식 그대로, 대화 방식 없으면 갈등 대처 축) — 실서버는 타입 계산이 서버에 아직 없어 칸 0 · 첫마디 실마리 칩: 갈래 소재 칩은 이름 글이 없어 건너뜀(칩 3 → 2) · 시험 s3jaFun 35 |
| 9 onLayout 폭 0 꼴 전수(커밋 9fcbfbc) | 끝 — `onLayout`/`measure` 를 쓰는 파일 8곳 전수: 처음 붙을 때부터 onLayout 이 함수인 곳 7(BottomSheet · Screen BottomCTA · TraitBar · CandidateScreen · AppSplash · PoliticsSlider · useScrollCue) + 기내지(이미 `key="mag-pages"` 로 새로 붙임) → 새로 고칠 곳 0. 시험 s3jaCommon: 사용 파일 목록 고정 · 값이 조건식인 꼴 0 · 기내지 key · TextButton 48 × 48 |
| 10 node-forge(커밋 9fcbfbc) | 끝 — `npm update node-forge`(package-lock 만, 1.4.0 → 1.4.2 · 같은 메이저 · package.json 0 · --force 0 · zod 손대지 않음). 새 번들 build · 웹 점검 · jest 전부 통과한 뒤에만 둠. npm audit(10-29) 전 low 12 · moderate 6 · high 4 · critical 0 → 후 low 12 · moderate 6 · high 3 · critical 0. 10-30 다시 잼: low 12 · moderate 3 · high 6 — 권고 DB 가 바뀌어 `decode-uri-component` 계열(← query-string ← expo-router)이 high 로 올라옴(node-forge 는 목록에서 빠짐) · 남은 high = expo · @expo/cli · zod · expo-router · query-string · decode-uri-component 모두 메이저 해법 또는 override(0.2.2 → 0.4.3+)라 이번엔 손대지 않음 |
| 11 카피 도착 뒤 줄(커밋 b3db992 · bb51239) | 끝 — 강퇴 · 나감 [돌아가기] → T4(라운지 커밋) · `FUN.ck17.link` → `agreeView`(연애 커밋) · 07 · 04 끝 [내 여행 타입 보기] 입구: 스위치 `type_card` 켜짐(데모 처음값)이면 07 은 확정 뒤 같은 화면에서 [내 여행 타입 보기] · [다음] 두 버튼(안 눌러도 [다음] → 08, 저절로 넘어감 0), 04 대화형은 끝 화면(done)에 [내 여행 타입 보기] + [다음] 같은 크기. 두 버튼 글은 카피.md 에 줄이 없어 코드 상수(`LOUNGE_BACK_TO_LIST` '돌아가기' · `features/ai/typeEntry.ts` '내 여행 타입 보기') — 마케팅 확인 대기 · 웹 점검 스크립트 21개가 07 → 08 직행을 가정해 `b.traitsNext()`(browser 도우미) 한 줄씩 더함 |
| 12 바닥선(커밋 9fcbfbc · 이 변경기록 커밋) | 끝 — tsc 0 · jest 107묶음 1,882/1,882 · check:copy 106/0(LG 210 · IF2 키 줄 376) · check:tokens 5/0 · lint 0 · 웹 점검: if2 360 · 390 · 430 각 125/0 · lounge 360 · 390 · 430 각 72/0 · f1 76/0 · f3 75/0 · f7 65/0 · w6 36/0 · d46 17/0 · check_sec2 128건 = 통과 123 · 실패 1(F-05s) · 정보 4 · 법무 시험(legalContent · legalGen · consentLogic) 39/39 · 생성기(gen:if2) 마지막 돌린 시각 2026-10-30 11:04 · 원본 `ai/IF2/문구_라이브러리.json` 수정 시각 10-29 14:38(QP-50 ~ 53 여행지 문장 8곳 + cc-hobby 꺼 둠이 이미 들어 있음) |

### 3부-자 못 한 것 · 남은 넘김 · 척추 대조

- 못 한 것: 실기기(TalkBack · VoiceOver)에서 aria 읽기 · 엽서 앞면 배치 · 실서버 연결(0044 함수 이름은 데모 모의 서버와 시험으로만 맞춤) · 비필수 웹 점검 f6 · f11 · f13 · f17 · f18 · f21 · f22 · f24 · d42i · d42m 은 07 → 08 길(가입)은 지나지만 v4 옛 기대값 · 애니메이션 때문에 실패 — 이번 변경과 무관하다고 보나 기준 번들과 대조는 안 함.
- 마케팅 넘김: [돌아가기](강퇴 · 나감) · [내 여행 타입 보기] 버튼 글 줄 · `ct-` 소재 칩 틀의 갈래 이름(21-22가 갈래를 문장으로 바꿔 틀 `{v}` 에 못 넣음 → 그 칩은 건너뜀).
- 백엔드 넘김: 내 여행 타입 서버 계산(`get_my_travel_type` 가칭) · 실서버는 타입 칸 0.
- 보안 넘김: `decode-uri-component` 계열 high 3(10-30 권고 갱신) · 웹 점검 도구를 쓰는 검수 · 테스트웹은 07 확정 뒤 [다음] 한 번이 더 필요.
- 척추 대조: 줄(등급 · 점수) 영향 0 — 타입은 5축만(가족 중심 · 경제관 제외 · 등급 입력 0)이고 매칭 계산에 안 들어감 · 짝 영향 0 · 홈 숫자 0(B1 회차 번호도 '이번 주'로 뺌) · 동의 저절로 0(CK17 시트는 [동의하고 보기]를 누를 때만) · 재촉 · 압박 · 중독 장치 0(짐 싸기 진행 숫자 0 · 입구는 안 눌러도 [다음]).

# 3부-차 (D-230 · 파도 B · 10-30 ~) — 법무 반영 · 위기 카드 공용 · 대화방 위기 안내 · 1.0 경계 한 줄 · 들쑥날쑥 jest · 상태 저장(멈춰도 이어감)

- 기준: 팀장 지시(`팀장/세부청사진/3부차_묶음.md` 파도 B) · 카피 19-6 · 21-23 · 22-10 · 12 · 기획 정책 P4-29 ~ 36 · 화면 요구 T4 '위기 도움 카드' · 점검일지 442 · 443 · 444 · 445 · backend `R_변경기록.md` 13장(0045) · `ai/IF3/G08_경계고침.md` 4-3 · 법무 `판_관리.md` 2-1 · 보안 IF3 8장(재설치 기기 글)
- 지킨 선: backend · 법무 · 다른 직원 파일 수정 0(카피.md 는 21-23 '표로 옮김'만) · 실서버 · 유료 · AI 호출 · live · 스위치 켜기 0 · `npm audit fix --force` 0 · backend/.env 읽기 0 · 푸시 0(팀장) · 이 묶음에 안 넣음: 카피 22장 화면(IF3-F) · 실제 AI 연결(AIT-F)
- 시작 상태: HEAD `ab681ea` · tsc 0 · check:copy 102/4(A · I · O · IF2) · jest legal 2 실패(법무 원본 변경)

## 3부-차 세부청사진(착수 전)

| # | 할 일 | 통과 조건(측정) |
|---|---|---|
| 1 | ⑤ 법무 반영: `gen:legal -- --fingerprints`(terms f7091d41515e · privacy 87a5ecdabdf7) · `gen-if2-assets`(CK17 시트) · `laterConsent.ts` CK17A consent-2026.10.30-v1 · CK17B consent-2026.10.28-v2 · check-copy 1061행 정규식 · `IMAGE_CREDIT.aiWriting` 법무 5-6 새 글 · `LOUNGE_RULES_NOW` lounge-rules-2026.10.30-v1 · `RULES_ARTICLE` 제9조의4(조를 엶 — 약속 전체 보기가 제9조의4 시트를 연다) | check:copy 의 A · I · O 통과 · IF2 는 ④ ⑨ 뒤 · 법무 jest(legalContent · legalGen · consentLogic) 통과 · 지문 12자리가 지시와 같음 |
| 2 | ① 3부-자의 타입 소재 33 SVG 확인만 | `if2art.json` 타입 소재 12 + 짐 21 있음(수정 0) |
| 3 | ② ⑨ 카피 21-23 반영 · 위기 카드 공용: 카피.md 21-23 줄을 해당 장 표(키 백틱 꼴)로 옮김 + 줄 수 맞춤(LG 210 → 211 · IF2 376 → 383) · `LOUNGE.backToList` · `LOUNGE.none.body` · `left.body` · `promise[0]` · `promise[3]` · `TYPE_CARD.entry.open` · `FIRST_HINT.groupChip.*` 6(ct- 번호 홀수 a · 짝수 b) · `CRISIS.note · close · a11y` 공용(라운지 · 대화방 · 12) · 둘째 줄 `SAFETY.emergency` 상수(카드 · 12 안전 안내 같이 부름) · 12 안전 안내에 109 한 줄 · check:copy 에 CRISIS 그룹 · 12 두 줄 대조 | check:copy A · I · O · IF2 · LG 통과 · 새 실패 0 · 카드 시험(라운지 · 12) |
| 4 | ② 라운지 카드 계정 기준 하루 3번 · 다시 열어도 안 뜸(화면 메모리 · 기기 저장 0) | 시험: 세 번까지 뜨고 4번째 안 뜸 · 목록을 다시 불러와도 지난 글 아래 카드 0 · 저장소 쓰기 0 · web-lounge |
| 5 | ③ 0045: `together_send` · `together_answer` `{ok:false, code:'rate_limited'}` → 채팅 `limited` 글 · `opened:false` 화면 그대로 | 시험(모의 응답 두 함수 · 화면 글) |
| 6 | ④ 재설치 때 IF2 기기 글 9종도 비움(`purgeStaleSessionOnFreshInstall` 넓힘 — iOS 키체인 남음) | 시험(새로 깐 표지 없고 키 9종이 남아 있으면 비움 · 있으면 건드리지 않음 · 웹은 건너뜀) |
| 7 | ⑥ 대화방 위기 안내: `CrisisCard` 공용 · 보낸 본인에게만 · 내 말풍선 아래 한 장 · 목록 불러오기 · 받은 글 0 · 데모 모의 응답(`chatDemo.ts` '사라지고 싶' 등 · 하루 3번 뒤 0) · 실서버 칸은 응답에 칸 없으면 0(백엔드 0047 뒤) | 시험(뜨는 때 · 안 뜨는 때 P4-33) · web-f5 계열 · 상대 화면 흔적 0 |
| 8 | ⑦ 1.0 별자리 경계 한 줄: `SIGN_CUSP.pair · why`(순서 없는 한 쌍) · 0046 `sky` = `{signs, zodiacs}`(데모도) · funCalc cusp 24 → 36 | iffInflight 시험 36일 · 경계 12곳 3일 같은 쌍 · 기내지 화면 시험 · web-if2 |
| 9 | ⑧ 들쑥날쑥 jest 하나 찾기 · 고침(jest 5회 이름 · 원인) | jest 5회 연속 전부 통과 |
| 10 | 바닥선: tsc · jest 5회 · check:copy 실패 0 · tokens 0 · lint · 웹 lounge · if2(360 · 390 · 430) · f1 · f3 · f7 · w6 · d46 · check_sec2 · 새 CRLF 0 | 숫자 |

## 3부-차 진행

| 단계 | 상태 |
|---|---|
| 청사진 | 끝 |
| ⑤ 법무 반영(커밋 8c76c6a) | 끝 — gen:legal --fingerprints(약관 f7091d41515e · 처리방침 87a5ecdabdf7 · 동의 판 13개 그대로) · gen-if2-assets(CK17 시트 9줄 요약) · CK17A consent-2026.10.30-v1 · CK17B consent-2026.10.28-v2 · check-copy CK17 정규식(판_관리 두 줄 모두 대조) · `IMAGE_CREDIT.aiWriting` 법무 5-6 새 글(카피 21-18 표에 줄 옮김) · `LOUNGE_RULES_NOW` lounge-rules-2026.10.30-v1 · `RULES_ARTICLE` 제9조의4(조가 생겨 '약속 전체 보기'가 그 조 시트를 엶 — 코드는 그대로) |
| ① 타입 소재 33 SVG | 확인만 — if2art.json types 12 + items 21 (gen-if2-assets 다시 돌려도 파일 변화 0) |
| ② ⑨ 카피 21-23 반영 · 위기 카드 공용(커밋 6cb58ac) | 끝 — 카피.md 21-23 줄을 19장(LOUNGE.backToList · left.body · none.body · promise[0] · [3]) · 19-14 새 절(CRISIS.note · close · a11y) · 12 안전 안내 맨 위 두 줄 · 21장(TYPE_CARD.entry.open · FIRST_HINT.groupChip 6) · 21-18(IMAGE_CREDIT.aiWriting) 표로 옮김 + 21-23 줄에 '반영' · LG 210 → 211 · IF2 376 → 383 · 새 대조 그룹 CR(19-14) · IF3(22-10 SIGN_CUSP) · `copy.ts` SAFETY.emergency · CRISIS · CRISIS_LINE · 공용 `features/safety/CrisisCard` · 12 안전 안내 맨 위 두 줄(settings-safety-emergency · -crisis) · 라운지: 보낸 직후 응답의 help 만 + `crisisBudget` 하루 3번(한국 날짜, 라운지 · 대화방 합쳐, 모듈 변수 — 저장 0, 로그아웃 · 탈퇴에서 비움) · 목록에서 불러온 help 는 안 씀(다시 열어도 안 뜸) |
| ③ ⑥ 0045 · 대화방 위기(커밋 6d603ba) | 끝 — `rate_limited`(JSON · DB 오류 P0001 모두 같은 코드) → `CHAT.send.limited` · TogetherCard 재시도 때 앞 오류 걷음 · opened:false 그대로 · `ChatApi.send` 응답 `help`(없으면 키 없음) · ChatRoomScreen 내 말풍선(또는 같이 열어 보는 질문 카드) 아래 한 장 · 새 카드가 뜨면 앞 카드 걷힘 · 데모 chatDemo · inflightChatDemo 모의 응답(위기 낱말 + 하루 3번 뒤 0) · 시험 s3chaCrisis 22 |
| ⑦ 1.0 경계 한 줄(커밋 65e56ec) | 끝 — `content/if3Copy.ts` SIGN_CUSP.pair · why · 기내지 ① 쪽에서만(경계 날 한 줄 + 사실 한 문장 + 두 별자리 글 같은 크기) · 파서 `sky = {signs, zodiacs}`(옛 sign · cusp · zodiac 모양은 안 읽음) · funCalc.sunSign `signs` 달력 순 쌍 · 경계 36일 · 시험 iffInflight C4 · 경계 날 응답 · 파서 · iffInflightUi 경계 화면 |
| ④ 재설치 비움(커밋 614a926) | 끝 — `purgeStaleSessionOnFreshInstall` 이 `forgetInflightNotes()`(IF2 기기 글 9종) 호출 · 표식 있으면 그대로 · 웹은 건너뜀 · 시험 supabaseClient 2건 |
| ⑧ 들쑥날쑥 jest | 원인 찾음 · 고침 — **`surveyChatScreen.test.tsx` 1번 '시작 → 1부 전부 대화로 → … → 답 한눈에 보기'**. 한가한 기계에서도 50 ~ 75초(5회 최고 74.8초) 걸리는 가장 긴 시험인데 시간 제한이 180초라, 계산이 바쁜 기계(8코어에서 CPU 부하 프로세스 32개)에서는 180초를 넘겨 `Exceeded timeout of 180000 ms` → 이어지는 같은 파일 시험 12개가 '렌더러 해제됨' 오류로 줄줄이 실패(13건, 다른 파일 0). 부하 8개 2회 · 한가할 때 5회는 전부 통과(재현 안 됨). 고침: 이 파일 `jest.setTimeout` 180_000 → 600_000. 부하 속 재검증은 PC가 멈춰 못 끝냄(팀장 지시로 부하 시험 중단) — 한가한 5회 연속 통과(1,909/1,909, 409 ~ 653초)만 근거. 시험 자체를 빠르게 하는 길은 '넘길 것'(대화 한 글자씩 치기 · 문항 80개를 모두 renderer 로 누름) |
| ⑧ 둘째 원인(한가한 기계에서 3번째 회 1건) | 찾음 · 고침 — **`gradeScreen.test.tsx` '[내 등급 알려 주세요] → … → 토스트 NV69'**. 시험 도우미 `shopRig.ts` 가 토스트 보이는 시간을 400ms 로 줘서(글은 `setTimeout` 으로 걷힘) 시험이 토스트를 보기 전에 사라지면 실패(`hasText(...요청을 받았어요...)` false). 고침: `toastMs` 400 → 3,000. 고친 뒤 한가한 3회 연속 1,909/1,909. 같은 꼴 후보(`shopScreen` · `f16Shop` 의 `toastMs: 50`)는 한 번도 안 실패해 손대지 않고 넘김 |
| 바닥선(부하 없이, 끝) | tsc 0 · eslint 0 · jest 108묶음 1,909/1,909 — 처음 5회 연속 통과 + 고친 뒤 3회 연속 통과 · check:copy 108/0 · tokens 5/0 · 웹 lounge 360 · 390 · 430 각 73/0 · if2 360 · 390 · 430 각 125/0 · f1 76/0 · f3 75/0 · f7 65/0 · w6 36/0 · d46 17/0(PC가 바빠 브라우저가 늦은 회는 다시 돌려 통과) · check_sec2 실패 F-05s만 · 줄끝 새 CRLF 0 |

### 3부-차 못 한 것 · 넘김 · 척추 대조

- 못 한 것: 실기기(TalkBack · VoiceOver)에서 도움 카드 읽기 · 실서버 연결(대화방 `help` 칸은 백엔드 0047 뒤 — 응답에 칸이 없으면 0, 키 이름이 lounge_post 와 같은 `help` 인지 확인 필요) · 부하 속 재검증(PC가 멈춰 중단)
- 백엔드 넘김: 0047 `send_chat_message` · `together_send` · `together_answer` 응답 `help` 한 칸(계정 기준 하루 3번 · 라운지 합쳐) · 내 여행 타입 서버 계산
- 마케팅 넘김: 11 신고 시트 맨 아래 `SAFETY.emergency` 고정 줄(NFK07-01)은 이번에 안 넣음(12 안전 안내 · 카드만) · 카피 12 옛 줄 501(`aiWriting`)은 21-18 이 앞서므로 옛 글로 남음
- 보안 넘김: 재설치 뒤 키체인에 남을 수 있는 `avoidStorage`(피할 회사 · 학교 원문) · `appStateStorage`(설문 임시 저장)도 같은 꼴 — 이번 범위(IF2 9종) 밖 · IF3-F 에서 G-06 날짜 추가
- 시험 빠르게(넘길 것): `surveyChatScreen` 1번이 문항 80개를 한 글자씩 누르며 50 ~ 75초 — 시험용 빠른 길(답을 한 번에 넣는 도우미)이 있으면 시간 제한을 다시 줄일 수 있음
- 척추 대조: 줄(등급 · 점수) 영향 0 · 짝 영향 0 · 위기 낱말 판정은 서버(앱에 목록 0) · 저장 0(하루 3번 셈은 화면 메모리, 로그아웃에서 비움) · 상대 화면 흔적 0 · 별자리 경계는 순서 없는 한 쌍(대표 · 전날 · 당일 말 0) · 재촉 · 압박 · 중독 장치 0

# 3부-카 (D-237 · 10-31 ~) — 위기 칸 이름 맞춤 · 내 여행 타입 서버 연결 · IF3-F 축소판(G-02 · 03 · 04 · 07) · 정리 · 재설치 비움 · 시험 빠르게 · 법무 IF5-L2 반영 · 상태 저장(멈춰도 이어감)

- 기준: 팀장 지시 `팀장/세부청사진/3부카_앱묶음.md` ① ~ ⑥ + 중간 지시 ⑦(법무 IF5-L2, `법무/IF5_반영기록.md` 5장) · backend `R_변경기록.md` 15장(0047) · 0046(get_my_ways · get_my_birth_week) · 카피 22장 · 정책 PG장 · 디자인 `디자인/IF3/` · AI `ai/IF3/` · 점검일지 FB-017 ~ 020
- 지킨 선: 푸시 0(팀장) · `EXPO_PUBLIC_` 새로 0 · 키 · 비밀 값 0 · backend/.env 열기 0 · 실서버 · 실호출 · 결제 0 · 백엔드 · 보안 · 법무 · 카피 원본 수정 0(카피.md 는 22장 머리 '앱 반영(일부)' 한 줄만 더함) · 새 CRLF 0(원래 CRLF 인 파일은 그대로)
- 시작 상태: HEAD `8d0d94a` · 법무 원본이 작업 중 14:05 ~ 14:13 에 바뀌어(다른 직원 IF5-L2) check:copy A · I · IF2 와 jest legal 2건이 실패하던 것을 ⑦ 에서 맞춤

## 3부-카 세부청사진(착수 전)

| # | 할 일 | 통과 조건(측정) |
|---|---|---|
| ① | 위기 칸 이름: 대화방 · 같이 열어 보기 응답은 `crisis`(라운지 `lounge_post` 만 `help`) · 데모 모의 서버도 같은 이름 | 시험: crisis 참이면 카드 · 거짓 · 없음 · 옛 이름 help 는 0 · 라운지 help 그대로 |
| ② | 내 여행 타입 서버 연결: `get_my_travel_type()` 상태 5종(ready tt-01 ~ 12 · none · not_ready · feature_off · forbidden) · 실서버 앱 안 계산 0 | 상태 5종 화면 시험 · 숫자 0 |
| ③ | IF3-F 축소: G-02 · G-03 · G-04 · G-07(G-01 · 05 · 06 은 IF5-F) · 스위치 7개 live:false · 캡처 막기 · 공유 · 복사 0 · 데모 · 카피 22장 | 열람 기록 · 모으기 · 본 표시 0 · 경계 '두 별자리 함께' 0 · 푸시 0 · check:copy IF3 41키 |
| ④ | 정리 FB-017 ~ 020 | 각 스크립트 통과 · 앱 결함이면 고친 줄 |
| ⑤ | 재설치 비움 넓힘: avoidStorage · appStateStorage | 시험(표식 없으면 비움 · 있으면 그대로) |
| ⑥ | 시험 빠르게: surveyChatScreen 1번 도우미 → 시간 제한 되돌림 · shopScreen · f16Shop toastMs 50 | jest 3회 연속 통과 |
| ⑦ | 법무 IF5-L2 반영(팀장 중간 지시): gen:legal 지문 · ck17Content · laterConsent 판 · check-copy 정규식 · jest 처리방침 소절 45 | check:copy 실패 0 · jest legal 통과 |

## 3부-카 진행

| 단계 | 상태 |
|---|---|
| 청사진 | 끝 |
| ① 위기 칸 이름(커밋 75ec770) | 끝 — `chatApi.send` · `inflightApi.togetherSend` · `togetherAnswer` 가 응답 `crisis` 를 읽음(참일 때만 `crisis: true` · 거짓 · 없음 · 옛 이름 `help` 는 키 0) · 대화방 · 같이 열어 보기 카드 코드는 이름만 바뀜 · 라운지 `lounge_post` 는 `help` 그대로 · 데모 `chatDemo` · `inflightChatDemo` 모의 서버가 `crisis`(together 는 참/거짓 둘 다, 서버 모양) · 시험 s3chaCrisis 22 |
| ② 내 여행 타입 서버 연결(커밋 6a6507b) | 끝 — `features/inflight/typeApi.ts`: `get_my_travel_type()` 응답을 상태 5종(ready tt-01 ~ 12 · none · not_ready · feature_off · forbidden)으로 읽음(12 밖 id · 모르는 모양 · 네트워크 끊김은 not_ready · 5축 숫자 키는 읽지 않음) · `TypeSource.state?()` 추가(없는 옛 원천은 mine 으로 갈음) · 실서버 `inflightServices().type` = `createTypeSource(rpcOf(supabase))`(앱 안 계산 0) · 데모는 그대로 funCalc · 타입 화면 칸 넷(`type-state-none · notready · feature_off · forbidden`) + not_ready 만 [다시 시도] · 시험 s3kaType 8 |
| ③ IF3-F 축소판(커밋 a1b0742 · 카피.md 22장 머리 한 줄) | 끝 — 아래 '③ 만든 것' |
| ④ 정리(커밋 82e751b 앱 · 4f1d3aa 점검 도구) | 끝 — 아래 '④ FB 표' |
| ⑤ 재설치 비움 넓힘(커밋 3a62763) | 끝 — `secureStorage.ts` `withKeyIndex`: `appStateStorage` · `avoidStorage` 가 쓴 열쇠를 목록 한 곳(`device.keys.appState` · `device.keys.avoid`)에 적고 `clearAll` 이 목록 + 목록 전 고정 열쇠 둘(`gyeoljeongsa.signup` · `chat.meetScene.v1`)을 지움 · `purgeStaleSessionOnFreshInstall` 이 IF2 기기 글 9종 뒤에 `forgetStaleDeviceStorage()` 부름 · 표식 있으면 그대로 · 웹은 건너뜀 · 시험 supabaseClient 3건 |
| ⑥ 시험 빠르게(커밋 ed6979c) | 끝 — surveyChatScreen 1번: 1부 앞 열 장(A12 · A02 · A03 · A05 · A06 · A07 · A08 · B01 · B02 · B06)만 사람처럼 누르고 나머지는 `answerPart1Fast`(같은 `save` 길로 한 번에 넣고 화면을 다시 열어 [이어하기] → 정치 막대) · 이 시험 한가할 때 약 5초(전엔 50 ~ 75초) · 파일 시간 제한 600 → 180초 되돌림 · shopScreen · f16Shop `toastMs` 50 → 3,000 |
| ⑦ 법무 IF5-L2 반영(커밋 2a178c9) | 끝 — `gen:legal -- --fingerprints`: 약관 f7091d41515e → 744bd43ff8a4 · 처리방침 87a5ecdabdf7 → 32ff0ee6e8f4(팀장 예상과 같음) · 바뀐 생성 파일 `legalTerms.ts` · `legalPrivacy.ts` · `consentContent.ts`(주석 숫자만) · `gen-if2-assets` → `ck17Content.ts`(동의문구 4-17 새 글) · `laterConsent.ts` CK17A `consent-2026.10.31-v1` · CK17B `consent-2026.10.28-v3` · `check-copy.mjs` 옛 판 정규식 둘 · jest `legalContent` · `legalGen` 처리방침 소절 42 → 45 |

### ③ 만든 것 (IF3-F 축소판 — G-02 · 03 · 04 · 07)

| 칸 | 자리 | 내용 |
|---|---|---|
| G-02 창밖 하늘 | 기내지 ① 쪽 맨 위(이번 주 하늘 칸 위) | 발행일(`get_magazine` 의 `issue_date`)로 앱에 든 하늘 52주 표(`content/skyWeeks.json` — 104호, 2027-01-07 ~ 2028-12-31)에서 찾아 달 사건 글 또는 목요일 저녁 달 모양 글 + 절기 든 주만 절기 글 · 달 그림 · 호 날짜 범위 · 동의(CK17A) 꺼짐에도 보임 · 표 밖 호 · 날짜 없음은 칸째 없음(오류 글 0) · 변형 v1 / v2 = 표 첫 호부터 센 호 번호 홀 · 짝 |
| G-03 하늘 도감 | 새 화면 `/sky-book`(IF-BOOK) · 들어오는 곳 둘: 기내지 뒤표지 [하늘 도감 보기] · 12 설정 정보 묶음 '하늘 도감' 줄(스위치 `sky_book`) · 홈 입구 0 | 별자리 열두 칸(물병자리부터 달력 차례 · 번호 0 · 이름 · 해가 머무는 때 · 원소 · 성질 · 글, 칸을 누르면 펼침 한 번에 하나 · 기억 0) + 카드 스물두 장(전통 차례 · 이름 · 뜻) · 끝 '도감은 여기까지예요.' + [닫기] · 끝줄 `FUN.footer` + 새 `FUN.aiNote` · 서버 호출 0 · 내 별자리 표시 · 본 표시 · 모으기 · 순위 · 공유 0 · 스위치 꺼짐이면 주소로 와도 홈으로 |
| G-04 사랑하는 방식 · 말하는 방식 | 기내지 ① 쪽 '나의 결' 아래 접힘(CK17A 켠 분 쪽 안) | 닫힌 채 시작 · 펼칠 때만 `get_my_ways()` 한 번(저장 0 · 접으면 값을 비움 · 펼침 기억 0) · 금성 · 수성 별자리 하나씩(경계 날 '두 별자리 함께' 0) + 모두에게 같은 안내 한 줄(`MY_WAYS.note` = AI `planet_notice` 글자 같음) · `consent_required` → 같은 틀 안내 + [동의하고 보기](누를 때만 동의 시트) · 불러오지 못함 + [다시 시도] · none → 줄째 없음 · 캡처 막기 처음부터 켬(`useAlwaysCaptureBlock`) |
| G-07 생일 주간 엽서 | 기내지 ④ 쪽 질문 아래 | ④ 쪽에 닿았을 때 `get_my_birth_week()` 한 번(쪽을 넘겨도 다시 안 부름) · 참일 때만 카드 한 장(촛불 그림 · 질문 셋 읽기만 · 답 칸 0 · 저장 0 · 카드 끝줄 `MAGAZINE.love.footer` · '나만 보는 화면이에요.') · 질문 묶음 = (발행 해 mod 4) + 1(서버는 참/거짓만 줌) · 거짓 · none · 오류는 칸째 없음 · 캡처 막기 켬 |
| 공통 | | 스위치 7개 `featureKeys.json` group IF3 live:false(G-01 · 05 · 06 키도 서버 0046 과 같은 이름으로 — 화면 0) · 카피 22장 41키 사본 `content/if3Copy.ts`(생성기 `scripts/gen-if3-copy.mjs`) · 라이브러리 · 하늘표 · 그림 사본(생성기 `scripts/gen-if3-assets.mjs`) · `check:copy` IF3 그룹 넓힘(41키 + SIGN_CUSP 2 한 글자씩 · 금지 낱말 · 나만 보는 글은 기내지 쪽 파일에서만) · 데모 모의 서버 `get_my_ways` · `get_my_birth_week`(값은 모의 — 실제 천문 값 아님) · 데모 기내지 `issue_date` 는 하늘표 범위(2027-01-14)로 보임(호 번호 · 카드 값은 그대로) · 시험 s3kaSky 29 + s3kaDemo 4 |

### ④ FB 표

| 번호 | 뜻 | 처리 | 앱 결함? |
|---|---|---|---|
| FB-017 | 04 끝 두 버튼 크기 다름 | `SurveyChatScreen` 끝 화면을 `CtaPair`(1:2) 대신 07 과 같은 반반(`chat-end-pair` · flex 1:1) | 앱 결함 — 고침 |
| FB-018 | 데모 줄 안내 글 한 줄 잘림 | `DemoSkipBar` 안내 `numberOfLines` 1 → 3 | 데모 전용 — 고침 |
| FB-019 | 점검 도구 기대값 낡음 | f20 W8 글 · f2l 05 안내 '점수를 매기지 않아요' 문장 제외 후 셈 · d42m 막 열린 방의 만남 장면 [건너뛰기] 뒤 글 보냄 · d42i 데모 장면 여덟 가지(최대 9번) · f24 · f13 구독자 칩 · 10 등급 배지 0(등급 구독은 v4 숨김) · f13 NV53 '다 해도 아이콘이 꼭 바뀌는 건 아니에요.' · 올리는 방법 줄은 있는 만큼 · 12 '등급 계산 멈추기' · 탈퇴 확인창 v5 글 · f18 조건 2 v5(10 구독 안내 줄 0 · 12 구매 줄 0) · f21 12 등급 스위치 · 탭 넘김 4 아래에서(이동 0 아님) · f7 정보 묶음 '하늘 도감' 줄 · if2 날짜 글 숫자로 안 셈 | 앱 결함 아님(기대값) — 고침 |
| FB-020 | 라운지 '공감받았어요' 같은 화면에서 안 보임 | `LoungeScreen` — 내 글을 인용한 새 글이 오면 내 글 하나만 다시 읽어 합침(남의 글 인용은 건너뜀 · 목록 전체 다시 읽기 0 · 새 점 0) | 데모 한계 — 고침(시험 lgfLounge 갱신) |

### 3부-카 바닥선(끝 · 부하 없이 하나씩)

| 항목 | 숫자 |
|---|---|
| tsc | 0 |
| eslint(`npm run lint`) | 0 |
| jest(`--maxWorkers=3`) 3회 연속 | 111묶음 1,953 / 1,953 × 3회(137 · 144 · 156초) |
| check:copy | 통과 108 · 실패 0(IF3 그룹 43줄 = 하늘 읽기 41키 + SIGN_CUSP 2) |
| check:tokens | 통과 5 · 실패 0 |
| 웹 lounge | 360 · 390 · 430 각 73/0 |
| 웹 if2 | 360 · 390 · 430 각 125/0 |
| 웹 f1 · f3 · f7 · w6 · d46 | 76/0 · 75/0 · 65/0 · 36/0 · 17/0 |
| 웹 ④ 스크립트 | d42i 22/0 · d42m 12/0 · f24 46/0 · f13 52/0 · f18 9/0 · f21 32/0 · f2l 20/0 · f20 34/0 |
| check_sec2(`SEC_SKIP_AUDIT=1`) | 145건 = 통과 140 · 실패 0 · 정보 5 — IF3-m 통과('앱 featureKeys.json 새 7키 7/7 · live false') |
| 새 CRLF | 0(CRLF 파일 61개 · 'LF 로 저장돼 있는데 작업본이 CRLF' 48개 — 시작 때와 같음, 새 파일 CR 0) |
| 끝난 뒤 `Get-Process node` | 2개(내가 띄운 것 0 — 다른 도구) |

웹 번들은 `expo export --max-workers 2`(데모 모드 · `.env` 안 읽음 · EXPO_NO_DOTENV)로 한 번 다시 만들었고, 웹 점검은 하나씩 이어서 돌림.

### 3부-카 못 한 것 · 확인 못 한 것

- 실기기(TalkBack · VoiceOver · 캡처 막기가 실제로 막히는지) · 실서버 연결 — 응답 모양은 백엔드 `R_변경기록.md` 15장 · 0046 주석 기준의 가짜 응답으로만 시험(미확인)
- G-01 읽는 법 · G-05 세 기둥 · G-06 만난 날의 하늘 · CK17A 새 항목 ③ 태어난 시각 · ④ 태어난 곳 · ⑤ 성별(대운) 칸 · CK17D · CK19 · CK20 시트: IF5-F 몫이라 만들지 않음. **사실 적어 둠(팀장 지시)**: ⑦ 로 `ck17Content.ts` 가 새 동의문구 4-17 글(체크 ① 문장 · 안내 · 본문 1 ~ 5가 ③ ④ ⑤ 를 말함)로 바뀌었는데 시트에는 ① ② 칸만 있다 → 글과 칸이 어긋난 상태. 스위치 `inflight_mag` · `pair_card` 가 실서버에서 꺼져 있어 지금은 보이지 않지만, **IF5-F 가 ③ ④ ⑤ 칸을 만들기 전에 켜면 안 됨**
- 타입 화면 none · feature_off · forbidden 전용 글이 카피에 없어 `TYPE_CARD.loadFailed` 를 같이 씀(칸 testID 만 다름) · 사랑하는 방식 불러오기 오류도 전용 키가 없어 `MAGAZINE.loadFailed` 재사용 → 마케팅에 전용 글 요청
- 데모 기내지 `issue_date` 를 2027-01-14 로 보임(하늘표가 2027-01-07 부터라 데모 1회차 2026-12-17 은 표 밖) → 실제 출시(2027-04 ~)에는 영향 0. 데모에서 진짜 날짜로 보이려면 AI 가 2026-12 표를 더해야 함
- 생일 질문 묶음: AI 계산명세는 '서버가 묶음 번호를 줌'인데 0046 은 참/거짓만 준다 → 앱이 발행 해로 정함(12월 말 ~ 1월 초에 걸친 호는 명세의 '생일 해'와 해가 다를 수 있음) — AI · 백엔드 확인 필요
- 재설치 비움: 열쇠 목록이 생기기 전(이번 커밋 전)에 쓴 회원별 열쇠(설문 임시 저장 · 피할 회사 · 학교)는 목록에 없어 못 비움(출시 전이라 영향 0) · 고정 열쇠 둘은 목록 없이도 지움
- ⑥ 1번 시험은 이제 1부 앞 열 장만 사람처럼 눌러(나머지는 같은 저장 길로 한 번에) — 80장을 모두 눌러 보는 길은 웹 점검(f20 · v6f)이 맡음
- 점검 도구 f13 · f18 · f21 · f24 는 v4 구독 흐름(등급 구독 · 구독자 칩)을 보던 스크립트라 v5 에서 없는 길은 '없다'를 확인하는 쪽으로 최소 수정 — 이 스크립트를 v4 기록으로 접을지는 팀장 판단
- 새 웹 점검 스크립트는 만들지 않음(하늘 읽기 화면은 jest 33건 + 기존 if2 점검 · 설정 f7 로 확인)

### 3부-카 넘김 (팀장 경유)

- 마케팅: ① 카피 22장 머리 '앱 반영(일부)' 한 줄을 내가 더함(그 줄만) — 확인 · ② 타입 화면 none / feature_off / forbidden 글 · 사랑하는 방식 불러오기 오류 글 · ③ 22장 나머지 키(READ_GUIDE · THREE_PILLARS · MEET_SKY 36키)는 IF5-F 반영 대기
- AI: 하늘표 2026-12 줄(데모용) · 생일 질문 묶음 번호 위치(서버 vs 앱) · IF5-F 용 읽는 법 · 세 기둥 라이브러리 사본(이번엔 `howto` 7편의 제목만 도감 원소 · 성질 이름으로 가져옴)
- 백엔드: 0047 `crisis` · `get_my_travel_type` 응답을 앱이 위 모양대로 읽음 — 실제 응답과 다르면 알려 달라 · 0046 `get_my_ways` · `get_my_birth_week` 도 같음
- 보안: IF3-m 통과(새 7키) · IC3-20 재설치 비움 넓힘(설문 임시 저장 · 피할 회사 · 학교)은 열쇠 목록 방식 — 확인 요청 · G-04 · G-07 캡처 막기 훅 `useAlwaysCaptureBlock`(12 설정과 상관없이 켬)
- 법무: 위 '못 한 것' 둘째 줄(시트 글은 새 판 · 칸은 없음)
- IF5-F(다음 앱 묶음): G-01 · 05 · 06 · CK17A ③ ④ ⑤ 칸 · CK17D · CK19 · CK20 시트 · 이 묶음의 `if3Copy.ts` · `if3Logic.ts` · `SkyParts.tsx` 에 이어 붙임

### 3부-카 척추 대조

- 줄 · 등급 영향 0(하늘 읽기 값은 배치 · 등급 · 성실도 어디에도 안 들어감 — 앱은 서버 응답의 별자리 코드 · 참/거짓만 읽고 계산하지 않음) · 짝 영향 0 · 노출 영향 0(나만 보는 칸 — 상대 · 짝 · 홈 입구 0, 도감 입구는 뒤표지 한 줄 + 설정 정보 줄뿐)
- 푸시 0 · 숫자 배지 0 · 새 표시 · 본 표시 · 열람 기록 · 모으기 · 연속 0(도감 펼침도 기기에 기억하지 않음) · 저장 0(G-04 응답은 접으면 비움 · G-07 은 읽기만) · 공유 · 복사 0 · 캡처 막기 기본 켬 · 경계 '두 별자리 함께' 0(금성 · 수성은 하나씩 + 같은 안내 한 줄)
- 네 질문: ① 줄을 흐리지 않나 — 예(영향 0) ② 필수 일치를 깨지 않나 — 예 ③ 진지한 사람에게 도움 — 예(위기 카드가 대화방에서 `crisis` 로 정확히 뜸 · 재미 칸은 줄 · 짝에 0) ④ 차분 · 기다림을 즐겁게 — 예(끝 있음: 도감은 여기까지 · 엽서는 이번 호까지 · 접힘은 닫힌 채 시작 · 재촉 · 압박 · 중독 장치 0)
- 벗어난 것: 없음

# AIT-F (D-233 · D-236 · 10-31 ~) — 테스트 웹 실제 AI 시험 연결 앱 쪽: 서버 함수 · 접근 코드 칸 · 네 기능 · 동의 시트 · 모의 시험 · 상태 저장(멈춰도 이어감)

- 기준: 팀장 지시 `팀장/세부청사진/AIT-F_앱.md` ① ~ ⑦ · `팀장/세부청사진/AIT_실제AI_시험연결.md` · `ai/AIT/README.md` 1 · 2 · 7장 · `보안/AIT_위협.md`(서버 52 · 앱 29 · 배포 전 20) · 카피 23장(193키) · 법무 `IF4_메모.md` 16 · 17장
- 지킨 선: **실호출 0**(시험은 모의 · 가짜 업체, 진짜 Anthropic 호출 0 · 유료 0) · 열쇠 · 코드 · 서명 키 값 0(소스 · 로그 · 응답 · 시험 고정값, 시험 값은 실행 때 조립) · `EXPO_PUBLIC_` 새로 0 · `.env` 열기 · 만들기 0 · `eas env:*` 0 · 푸시 0 · 배포 0 · `npm audit fix --force` 0 · `ai/AIT/` · `카피.md` · `법무/` · `backend/` 수정 0 · 마일리지 · IF5 사주 새 기능 0 · 새 CRLF 0
- 시작 상태: HEAD `6ca4aca` · jest 111묶음 1,953건

## AIT-F 세부청사진 ↔ 만든 것

| # | 할 일 | 만든 것 |
|---|---|---|
| ① 서버 판 설정 | 정적 데모(`web.output "single"`)는 그대로 · 서버 판은 따로 | `app.config.js`: `AIT_SERVER_EXPORT=1` 일 때만 `web.output "server"`(기본은 app.json 그대로) · `scripts/export-ait.mjs`(`npm run check:web:ait` → `dist-ait/`, `dist-*/` 라 저장소 밖 · check_sec2 의 dist · dist-demo 와 섞이지 않음) · 정적 데모 export · `deploy_demo.ps1 -SkipBuild` 흐름은 그대로(건드린 파일 0) |
| ② API 경로 · 동기 | `/api/ai/*` → `handleAi` · `ai/AIT/ts` 복사 + `--check` | `src/app/api/ai/[feature]+api.ts`(얇은 문 · 모든 방법 → 같은 문) · `src/server/ait/`(원본 19파일 복사 + 앱 전용 `route.ts`) · `scripts/sync-ait.mjs`(복사 · `--check` · 줄끝만 CRLF → LF · 앱 전용 파일 · 원본에서 사라진 파일 처리) · `npm run ait:sync` · `ait:check` · `tsconfig`: `allowImportingTsExtensions`(원본이 `./x.ts` 로 가져오므로) · eslint: `src/server/ait/**` 는 원본 복사라 `import/export` · `array-type` 만 끔 |
| ③ 업체 호출 | 공식 SDK · 모델 · max_tokens · effort 서버 상수 · mock 에서 호출 0 · 키 없으면 not_ready | `@anthropic-ai/sdk` **0.135.0**(정확한 판 고정 · 2026-10-15 공개 · 16일 됨) · `route.ts` `anthropicUpstream`: `maxRetries 0` · 60초 `AbortSignal` · 도구 0 · 요청 꼴은 `request.ts` 그대로 · 모델 id 도 `request.ts` · 실패는 `UpstreamError`(상태 · 이름 · 앞 40자 · timeout 만) · `AIT_MODE` 가 live + 키 + 작업 공간 ID(`AIT_WORKSPACE_ID`)가 있을 때만 live(아니면 모의 — 업체 호출 0) · 응답 머리 `anthropic-workspace-id` 가 다르거나 없으면 응답을 버리고 그 격리를 잠금(AC-08 첫 응답 확인 방식) |
| ④ 열쇠 | 서버 `process.env` 에서만 · 값 0 | `route.ts` 한 곳에서 요청마다 읽음(`ANTHROPIC_API_KEY` · `AI_ACCESS_CODE` · `AIT_SIGN_KEY` + `AIT_MODE` · `AIT_CHAT_MODEL` · `AIT_WORKSPACE_ID`) · 로그 출구는 `sink` 한 곳(handler 의 `logRecord` 허용 키만) · 최상위 try/catch(던져진 오류는 어디에도 안 나감) · 응답 머리 `no-store` · `nosniff` · `noindex` · `no-referrer` · CORS 머리 0 · 큰 본문은 읽지 않고 413 |
| ⑤ 코드 칸 | 설정 '시험용 AI 코드' · 네이티브 SecureStore · 웹 메모리만 · 지우기 | `features/settings/AitCodePage.tsx`(카피 23-6 17키 · 가려 입력 `secureTextEntry` — `TextField` 에 한 줄 더함 · 자동완성 끔 · 저장해도 서버 호출 0 · 입력 칸 비움) · `features/ait/aitStore.ts`(코드 + 시험자 동의 판 · 시각 기록 — 웹 메모리 · 네이티브 `secureStore`) · 로그아웃 · 재설치 비움에 `aitStore.forget()` · 입구는 데모 판에서만(`aitEnabled` = 기존 `EXPO_PUBLIC_DEMO_MODE`) |
| ⑥ 네 기능 화면 | 코드 있으면 실제 · 없으면 데모 글 · 동의 시트 · 카피 23장 그대로 | 홈 B6 셋째 칸 → `ConcernChat`(전체 시트: 첫 화면 · 입력 · 다섯 단계 이름(숫자 0) · 칩 · 근거 눌러 열기 · 약한 근거 · 위기 · 폭력 · 거절 · 미성년 카드 · 끝 화면 · 턴 상한 0) · 궁합 카드 시트 안 `CompatAiBlock` · 기내지 ① 쪽 `StarAiBlock`(경계 날 AI 호출 0) · 미리보기 화면 [문장 다듬기] → `CoachSheet` · `AitConsentSheet`(체크 → 동의 · 미리 체크 0) · 글은 `content/aitCopy.ts`(생성기 `scripts/gen-ait-copy.mjs` — 189키 + 글 없는 4키) · `check:copy` AIT 그룹 |
| ⑦ 시험 | 서버 경로 · 앱 · 대응표 | 새 시험 5개 파일(aitServer · aitClient · aitScreens · aitEntry · aitSync) · 아래 대응표 · `scripts/check-ait-bundle.mjs` · `smoke-ait-server.mjs` · `web-ait.mjs` |

## AIT-F 앱 시험 ATF-01 ~ 29 대응표 (`보안/AIT_위협.md` 7장)

| ATF | 시험 이름(파일) |
|---|---|
| 01 | aitServer '서버 비밀 변수 이름은 src/server 안에서만 쓰인다' · '소스에 열쇠 · 접근 코드 완성 꼴이 없다' (+ check_sec2 P5-e · P5-e2) — 예외 경로는 팀장 지시대로 `src/server/` 하나(API 경로 파일은 이름을 쓰지 않음) |
| 02 | aitServer 'EXPO_PUBLIC_ 변수 이름은 기존 셋뿐' |
| 03 | aitClient '웹에서는 안전 저장도 쓰지 않는다' · '코드 보관 소스: 브라우저 저장소 · 쿠키 … 0' · web-ait B '저장소 · 쿠키가 비어 있다' |
| 04 | aitClient '넣기 · 읽기 · 지우기 · 동의 기록'(네이티브 저장소 경로) · 소스 `AsyncStorage` 0 — `WHEN_UNLOCKED_THIS_DEVICE_ONLY` 는 기존 `secureStorage.ts` 값 그대로(P7-f 표식 3곳 불변) |
| 05 | aitScreens '코드 칸 … 가려 입력 · 자동완성 끔' · '코드 넣기 … CANARY'(화면 모든 속성에 코드 값 0) · web-ait A · B |
| 06 | aitScreens 네 기능 각각 '코드 없음 → 서버 요청 0'(궁합 · 별자리 · 문장 다듬기 · 챗봇) · aitEntry '코드 없이 열어도 서버 요청 0' · web-ait D |
| 07 | aitScreens 오류 `auth` — 코드 칸 단추만(다시 시도 0) · 서버 문장 안 씀 · aitClient '틀린 코드는 auth' |
| 08 | aitClient '본문은 허용 키만' · '네 기능의 앱 본문이 서버 허용 목록을 통과한다(bad_request 0)' |
| 09 | aitClient '요청 꼴: … 코드는 x-ait-code 머리에만 · credentials omit · no-store' |
| 10 | aitClient '코드 보관 소스: … console · safeLog 0' · aitScreens CANARY (앱 로그 규칙은 기존 `lib/log.ts` 그대로) |
| 11 | aitClient 소스 검사(`AsyncStorage` · `Clipboard` · 공유 0) · 상태는 화면 state 뿐(챗봇 '이 대화 지우기' = 상태 비움) — 새로 고침 · 재설치 · 시트 닫힘으로 사라짐(자동 시험은 소스 검사까지) |
| 12 | aitScreens '공유 · 복사 · 내보내기 · 딥링크 · 마크다운 해석 0'(정적) — 결과는 `Text` 로만 |
| 13 | aitScreens 결과 칸 `AIT.aiLabel` · 시험판 알약 · 시험 안내 · `PAIR_AI.demo` · 챗봇 끝줄 상시 — **데모 ↔ 실제 별도 표식은 없음**(미리 쓴 글은 `AIT.demo.note` 로, AI 글은 'AI가 쓴 글이에요'로 가름 · 카피에 '실제' 표시 키 없음) |
| 14 | aitScreens '입력 화면: 안내 · 칸 둘 + 호칭 칸' · '빈 글은 서버 없이 안내' — 글자 수 숫자는 카피 규칙(숫자 0)대로 보이지 않고 상한은 칸 `maxLength` + `CONCERN.partner.tooLong` |
| 15 | aitScreens '한 턴 …' (호칭 칸 → 매 턴 `partner_alias`) |
| 16 | aitScreens '채팅 · 가입 필수 AI와 분리'(정적) |
| 17 | aitScreens '채팅 쪽 현재 상태 고정' (`chatApi` 서버 함수 = chat-media · photo) |
| 18 | aitScreens '요청에 상대 정보 필드 0' · aitEntry '궁합 … 방 id · 회원 정보 없이' |
| 19 | aitScreens '채팅 · 가입 필수 AI와 분리' · '가입 필수 AI … AIT 코드 · 경로를 참조하지 않는다' |
| 20 | aitClient '챗봇 두 턴: 서명 묶음을 그대로 돌려보내면 이어지고 … 고친 묶음은 거절' · aitScreens '한 턴 … bundle 그대로' — 화면 상태로만 들고 닫으면 사라짐 |
| 21 | aitScreens '끝: … 남은 횟수 숫자 0' · '화면 글에 … 재촉 · 카운트다운 말이 없다' · 푸시 · 먼저 말 걸기 코드 0 |
| 22 | aitScreens '위기 카드 …' · aitClient '위기 글은 서버가 먼저 고정 카드로' — 말풍선 · 입력 칸에 그 글 0 · 낱말 로그 0 |
| 23 | aitScreens '문장 다듬기 … 복사 · 공유 단추 0' · 정적 '공유 · 복사 … 0' |
| 24 | aitScreens 오류 코드 아홉 + 닿지 못함 → 각각 `AIT.code.*` 고정 글(서버 문장 안 보임) |
| 25 | aitScreens `spend_limit` · `limit` → 다시 시도 0 + 미리 쓴 글 안내(`AIT.code.fallback`) |
| 26 | aitScreens 네 기능 코드 없음 · 거절 · 한도 경로 — 미리 쓴 글이 있는 기능(궁합 · 별자리)은 안내 + 위의 미리 쓴 글, **미리 쓴 글이 없는 기능(챗 · 문장 다듬기)은 안내 한 줄**(카피 23-3 이 챗 · 코치는 미리 쓴 글 없다고 정함) · 빈 화면 · 깨짐 0 |
| 27 | aitEntry '궁합 카드 시트 안에 AI 칸 …' · '앱의 취미 코드는 모두 서버 허용 사전에 있다' |
| 28 | aitScreens '별자리 · 사주 … 생년월일 꼴 0' · `horoscopeBody` · 문장 다듬기는 칸 이름 + 문구뿐 |
| 29 | `npm run check:copy` AIT 그룹(189줄 · 서버 고정 문구 30줄 · 느낌표 · 숫자 · 금지 낱말 · 화면 코드 한글 글 0) |
| 대응 못 한 줄 | 없음(줄 11 · 13 · 14 · 26 은 위에 적은 한계 — 자동 시험이 닿는 범위까지) |

## AIT-F 번들 키 grep · SDK · Workers

| 항목 | 결과 |
|---|---|
| 정적 판(`dist-demo`) | `node scripts/check-ait-bundle.mjs --dirs dist-demo`: 서버 변수 이름 · 열쇠 꼴 · 접근 코드 꼴 · JWT · 서버 모듈 글(작업 공간 머리 · 업체 오류 이름 · SDK · 지시문 첫 문장) **0건** · 클라이언트에는 `x-ait-code`(머리 이름) · `/api/ai/` 주소만 있음 |
| 서버 판 클라이언트(`dist-ait/client` · 화면 html · 화면 js) | 같은 검사 **0건**(서버 폴더 밖) |
| 서버 판 서버 함수(`dist-ait/server/_expo/functions/api/ai/[feature]+api.js` 757KB · 모듈 302개) | 열쇠 꼴 · 접근 코드 꼴 · JWT **0건** · 변수 이름을 읽는 파일 1개(허용 — 서버 폴더 js) · `node:` 모듈 요구 0 |
| SDK | `@anthropic-ai/sdk@0.135.0` 고정(npm 시간 표: 0.135.0 = 10-15, 최신 1.3.0 = 10-23 이라 2주 안 됨 → 2주 넘은 가장 새 0.x 판) · 새로 들어온 패키지: `@opentelemetry/api` · `@stablelib/base64` · `fast-sha256` · `json-schema-to-ts` · `standardwebhooks` · `ts-algebra` + SDK · `npm audit` 54건은 SDK 관련 0 |
| Workers 번들 | Metro 서버 번들이 SDK 를 그대로 묶음(302모듈) · `node:` 요구 0 · `smoke-ait-server.mjs`(번들을 Node 에서 불러 모의로 11가지 점검 · 네트워크 호출 0 · 로그에 값 0)가 통과 → **`upstream.ts` fetch 로 바꾸지 않음**. 다만 `upstream.ts` 에는 fetch 호출이 없고 오류 분류뿐이라, 바꿀 일이 생기면 fetch 부분은 새로 써야 함 |
| 미확인 | 실제 Cloudflare Workers(EAS Hosting) 실행 · `crypto.subtle` 동작(Web Crypto 는 Workers 표준이지만 이 환경에서 못 돌림) · CPU · 시간 한도 · 격리 사이 메모리 공유 — 배포 뒤 AIT-W · AIT-Q 가 확인 |

## AIT-F 바닥선 (끝 · 부하 없이 하나씩)

| 항목 | 숫자 |
|---|---|
| tsc | 0 |
| eslint(`npm run lint`) | 0 |
| jest(`--maxWorkers=3`) 3회 연속 | 116묶음 2,060 / 2,060 × 3회(200 · 115 · 124초) — 시작 111묶음 1,953에서 +5묶음 +107건 |
| check:copy | 통과 109 · 실패 0(AIT 그룹 1줄 더) |
| check:tokens | 통과 5 · 실패 0 |
| AIT 동기 검사 | `node scripts/sync-ait.mjs --check` 같음 · 파일 19개 · 지문 59eafd3b540a(끝에 다시 동기해도 같음 — 작업 중 바뀐 원본 text.ts 는 중간 동기에서 반영) |
| 번들 키 grep | 0건(위 표) |
| 웹 점검(dist-demo 다시 만든 뒤) | f7 65/0 · AIT 22/0(새) · f1 76/0 · w6 36/0 · if2 125/0 · lounge 73/0(폭 390) — f7 는 설정 줄이 16 → 17줄이 돼 기대값을 고침 |
| check_sec2(`SEC_SKIP_AUDIT=1`) | 178건 = 통과 163 · 실패 0 · 정보 15(보안이 P5-e · P5-e2 · P7-a 를 좁게 넓힌 뒤) |
| prepush_scan | 확정 0 · 확인 3(`src/server/ait/generated.ts` 457 · 649 · 1334줄 — 근거 카드의 공개 책 출처 주소 조각, 비밀 아님 · 보안이 이 파일의 R6 허용을 좁게 더해야 함) |
| 새 CRLF | 0(바꾼 파일은 원래 줄끝 그대로 · 새 파일 CR 0) |

## AIT-F 못 한 것 · 확인 못 한 것

- 진짜 업체 호출 · 진짜 Workers 실행 · 실기기 · EAS 배포 — 0(범위 밖). 네이티브 판은 서버 주소(`expo-router` `origin`)를 아직 안 줘서 상대 경로 호출이 닿지 못하면 '사용할 수 없음' 글로 내려감(웹 테스트 웹이 목표)
- 프로필 08 화면에는 [문장 다듬기] 입구를 넣지 않음 — 08 에는 글을 쓰는 칸이 없고(설문 답으로 채워짐), 카피가 말한 두 입구 중 홈 B6 '짝에게 보이는 내 모습'(미리보기) 쪽만 만듦
- 신고 단추(`AIT.report.*` · `CONCERN.report.*`) 연결 0 — 서버에 'AI 문장' 신고 대상이 없어 눌러도 갈 곳이 없음(백엔드 · 법무 판단)
- `CONCERN.ref.basis`('이 설명의 바탕: {개념 이름}') 줄 0 — 서버가 개념 이름을 따로 주지 않음(출처 글 · 한계만 줌)
- `CONCERN.rest`('잠깐 쉬어 가요')는 AI 답 8번째부터 한 번 — 뜨는 때는 기획 확정 전 가정
- `AIT.privacy.keep`(운영 서버에는 저장하지 않아요 …)은 '보안 서버 시험 통과 기록이 있을 때만' 조건이라, 서버 시험(aitServer · 저장 모듈 0 · 로그 값 0)이 통과해 `aitConfig.AIT_KEEP_NOTE_ON = true` 로 켬 — 법무 16-4 #7 이 시험 시작 조건이라 끌 수 없음. 보안이 같은 기록으로 인정하는지 팀장 확인 필요
- 작업 공간 확인(AC-08)은 비용 없는 사전 호출(`GET /v1/models`) 없이 **첫 응답 머리 확인**만 — 불일치면 응답을 버리고 잠금(한 번은 업체가 처리함, 문서의 대체 방식)
- 시험은 모두 모의 · 가짜 업체라 **모델이 만든 글의 품질 · 검사기가 걸러 내는 비율은 못 봄**(실호출 평가는 횟수 · 금액을 적어 따로 승인 필요)

## AIT-F 넘김 (팀장 경유)

- 마케팅: ① 카피 23-12 '앱 반영 전' 표시를 '앱 반영'으로 바꾸는 일(내가 `카피.md` 를 못 고침) ② `AIT.privacy.keep` 이 법무 16-3 · 서버 `STORAGE_NOTE` 의 '받은 날부터'를 뺀 글 — 맞춰 달라 ③ 시험자 동의 시트 전용 글이 없어 재사용: 제목 = `AIT.badge` + `AIT.testNote`, 체크 줄 = `AIT.privacy.send`, 단추 = 각 기능 단추 글(`CONCERN.send` · `PAIR_AI.button` · `COACH.send` · `STAR_AI.button`), 닫기 = 4장 닫기 → `AIT.consent.*` 키 요청 ④ 코드 없을 때 챗 · 문장 다듬기에 보일 글이 없어 `AIT_SET.rowLine` 재사용 → 전용 글 요청 ⑤ `AIT.code.limit` 은 '오늘 이용할 수 있는 만큼을 다 썼어요'인데 하루 횟수 한도가 없어져 서버의 `limit` 은 '대화 기록이 오래됨 · 너무 커짐' 뜻 → 글 다시(AI `CODE_TEXT_KO.limit` 와 같음)
- AI: `fixed.ts` 위로 줄(`crisis.l1` · `violence.l1` · `misuse.l1`) · `CARD_NOTE` · `STORAGE_NOTE` 가 카피 23장과 다름(앱은 카피를 쓰고 서버 문장은 안 보임 — check:copy 가 [참고]로 알림) · 원본 `ts/index.ts` 가 `export *` 로 `SIGN_CODES` · `ELEMENT_CODES` 를 두 모듈에서 중복 내보냄(앱 eslint `import/export` 가 걸러 앱 쪽만 끔 — 원본은 안 고침) · `upstream.ts` 에 fetch 가 없음(청사진 문구와 다름)
- 보안: check_sec2 'AIT' 묶음 · `prepush_scan` R6 에 `src/server/ait/generated.ts` 허용 좁게(공개 책 출처 주소) · 'AIT.privacy.keep 켜는 조건' 인정 여부 · 첫 응답 머리 방식의 작업 공간 확인 수용 여부
- 법무: 시험자 동의 시트 글 구성이 16-4 #2 · #6 · #7 을 채우는지(국외 이전 · 상대 실명 쓰지 않기 · 캡처해 보내지 않기 · 업체 보관 30일) · 시험 끝나면 코드 닫기(#10)는 배포 몫
- 테스트웹(AIT-W): `eas deploy` 는 서버 판 export(`npm run check:web:ait`)의 `dist-ait` 를 올리고 `--no-source-maps` 필요(서버 함수 소스맵이 export 에 같이 나옴) · 정적 데모 `dist-demo` 는 그대로 · 올리기 전 `npm run check:ait-bundle` · `check:ait-server`
- 기획 · 디자인: 시험판 알약 · 시트 모양은 기존 부품으로 임시 구성 · `CONCERN.rest` 뜨는 때 · 단계 이름 아래 진행 표시는 PF-02 에 따라 0

## AIT-F 척추 대조

- 줄 · 등급 · 짝 · 점수 영향 0(AI 결과는 화면에만 — 서버 DB · 매칭 데이터 접근 0, 데모 가상 짝의 공개 같은 값만 보냄, `AIT_SET.noEffect` 로 밝힘) · 노출 영향 0(상대 정보 자동 첨부 0 · 결과 공유 · 복사 · 저장 0)
- 푸시 · 재촉 0(먼저 말 걸기 · 남은 횟수 숫자 · 카운트다운 · 하루 횟수 한도 문구 0 · 끝은 사용자가 '충분해요'로 · 위기 낱말은 AI 부르기 전에 고정 카드 · 상시 번호 줄)
- 네 질문: ① 줄을 흐리지 않나 — 예 ② 필수 일치를 깨지 않나 — 예 ③ 진지한 사람에게 도움 — 예(위기 · 폭력 · 미성년 카드 먼저, 상대 분석 허용은 본인 예외 D-234 그대로) ④ 차분 · 기다림을 즐겁게 — 예(중독 장치 0)
- 벗어난 것: 없음

# IF5-F1 (D-237 · 10-31 ~) — 사주 마당 무료 층: 입력 시트 · 계산 길 · 한 화면 · 달력 · 상대 생일(기기 계산) · 홈 입구 · 미리 쓴 글 · 스위치 · 캡처 막기 · 카피 사본 · 3부-카 넘김 · 법무 재생성

- 세부청사진 `팀장/세부청사진/IF5-F_앱.md` 1장 ① ~ ⑧-2 · 3장 바닥선. 마일리지 · AI 호출 · 결제 · 푸시 0(F2 몫). 시작 `1e2ec2e`(jest 116묶음 2,060건) → 끝 아래 커밋. 실호출 0 · `.env` 안 열음.
- 커밋: `6db4d17`(⑤ ⑦ ⑧-2) · `22ffd29`(① ② ③ ④ ⑥ ⑧) · `677c34d`(시험) · `443a510`(saju5 → server 가져오기 0 · 달력 49 · f7) · `0956740`(CRLF 4파일 되돌림) · 이 절 커밋.

## IF5-F1 세부청사진 ↔ 만든 것

| # | 조건 | 만든 것 |
|---|---|---|
| ① | 입력 시트 · 서버 저장 0 · 새 저장소 withKeyIndex · 열쇠 이름에 birth · partner · saju · mileage 0 | `features/saju/SajuInputSheet.tsx`(시각 '모름' 처음값 · 시 0 ~ 23 + 분 5분 간격 · 지점 23곳 목록 + 모름 + 한국 밖 · 성별은 읽기 안내 · 저장 칸 둘 미리 체크 0 · 비워도 저장) · `deviceInput.ts`(저장 칸 켠 항목만 기기 저장 · 끈 칸은 메모리) · `lib/secureStorage.ts` `if5Storage = withKeyIndex(chunkedStorage(secureStore), 'device.keys.if5')` + `forgetStaleIf5Storage`(새 기기 비움) · `forgetSajuDevice`(로그아웃 · 탈퇴 · 새로 깐 기기) |
| ② | 계산 길: 실서버 0048 4함수 · 데모 기기 계산 · 상대 늘 기기 · 오류 7종 · 상대 네트워크 0 | `sajuApi.ts`(get_my_saju · get_my_luck · get_my_day · get_taekil — 시각 · 곳은 요청 인자만, 오류 7종 consent_required · invalid_value · invalid_time · not_ready · feature_off · forbidden · network) · `demo/sajuDemo.ts`(0048 응답 모양 모의 서버 — 계산은 `src/saju5`) · `partnerLocal.ts`(순수 함수 · 서버 호출 0 · 저장 0 · 만 19세 미만은 계산 전에 거름) · 계산 모듈 동기 `scripts/sync-if5.mjs`(+ `--check`, 14파일: saju_calc5 · fragments5 · names5 · check_text5 · rules5 · rules_extra5 · spec5 + 순수 검사기 rules · text · types + 데이터 4) |
| ③ | 사주 마당 한 화면 · 요약 틀 · 달력 두 색 · 날짜 고르기 · 상대 시트 · 오늘 하루 · 홈 입구 · F5-16 · 01 · 12 | `SajuMadangScreen.tsx`(카드: 내 네 기둥 · 내 결 · 올해 흐름 + 열두 달 + 띠 · 이번 달 · 인연 · 일 · 돈 · 사람 · 인생 계절표 · 날짜 고르기 · 둘이 맞춰 보기 · 만세력 달력 · 읽는 법 · 끝줄) · `SajuParts.tsx`(한 장 요약 틀 · 네 기둥 표 · 오행 막대 길이만 · [?] 풀이 시트 · 상태 줄) · `PartnerSheet.tsx` · `SajuCalendarScreen.tsx`(만세력 달력 / 날짜 고르기, 모양 + 색) · `SajuTodayScreen.tsx` · 홈 `InflightHome`(B6 칸 · B7 줄 · 오늘 하루 띠) · 12 설정 '사주 마당' 줄 · 화면 ID 3(IF-MADANG · IF-SJ-CAL · IF-SJ-TODAY) + 라우트 3 + flow 화살표 |
| ④ | 조각 478 · neutral_names5 판 .3 · check_text5 · 옛 label 0 · 관계 말 화면 말 | `src/saju5/data/fragments5.json` · `neutral_names5.json`(둘 다 판 2026-10-31.3) · 시험 `if5Module`: 조각 478칸(글 있는 칸 471 + 일부러 빈 칸 7) 전수 `checkText5` 통과 · 옛 label(육충 · 지지충 · 천간충 · 삼형 · 원진 · 상충 · 형살) 0 · '부딪히기 쉬운 결' · '엇갈리기 쉬운 결' 있음 · 이름표 검사 빈 목록 · calc5.py 정답 벡터 3,300건 기둥 · 플래그 같음 |
| ⑤ | `featureKeys.json` 20키 live:false · 데모 켬 · check_sec2 IF5-m2 | 새 17키(그룹 IF5) + 이어 쓰는 IF3 3키(three_pillars · read_guide · meet_sky) = 20. 서버 이름을 따라 saju_yard · mileage · mileage_charge 사용(기획 가안 saju_madang · mileage_view · mileage_topup과 다름 — 아래 넘김). 데모 꺼짐: saju_ai · saju_talk · mileage_charge. check_sec2 IF5-m2 정보 → 통과(3/3) |
| ⑥ | 사주 값 화면 `useAlwaysCaptureBlock` · 공유 · 복사 0 | 허브(사주 값이 보이는 동안) · 오늘 하루 · 달력 · 상대 시트(열려 있는 동안) 훅 호출 시험(mockForced) · 공유 · 복사 · 알림 · 파일 쓰기 호출 정적 점검 0 |
| ⑦ | 카피 24장 318키 + 22장 남은 36 + 22-14 4키 → 사본 생성기 · check:copy | `scripts/gen-if5-copy.mjs`(`src/content/if5Copy.ts` 318키 — 24-2 ~ 24-11 표, 24-12 이후는 안 읽음) · `gen-if3-copy.mjs` 확장(`if3Copy.ts` 41 → 81키: READ_GUIDE 5 · THREE_PILLARS 22 · MEET_SKY 9 · TYPE_CARD.state.* 3 · MY_WAYS.loadFailed 1) · check:copy 그룹 `IF5`(24장 한 글자씩 · 느낌표 · 법무 금지 낱말 · 앱이 쓰는 키가 24장에 있나 · F1 화면이 F2 몫 글을 안 부르나) · IF3 그룹 설명 갱신 · R5 허용 목록에 `SAJU.status.balanceFailed`(마침표 없이 확정된 24-11 글 — F2 몫 키) · '앱 반영' 표시는 마케팅에 넘김 |
| ⑧ | 3부-카 넘김: TypeCardScreen · SkyParts · 시험 4곳 · birthdayQuestions set | `TypeCardScreen` stateKey별 글(none · featureOff · forbidden 사실 한 문장 · 단추 0 / not_ready만 `TYPE_CARD.loadFailed` + [다시 시도]) · `SkyParts` G-04 failed → `MY_WAYS.loadFailed` · 시험 iffInflightUi · s3jaFun · s3kaType · s3kaSky 기대값 · `BirthWeek.set`(1 ~ 4, 0049 응답 꼴: 참이면 set, 거짓이면 set 키 없음 · 범위 밖 값은 버림) → `birthdayQuestions(issueDate, serverSet)`가 서버 값 우선 · 없으면 (발행 해 mod 4) + 1 · 데모 모의 서버도 같은 꼴(참일 때만 set — 윤일 · 해 넘김 규칙 포함) |
| ⑧-2 | 법무 재생성 · 지문 기록 | 팀장 '법무 반영 끝' 메시지(약관 17:56 · 처리방침 17:51 · 동의문구 수정 0) 뒤 `npm run gen:legal -- --fingerprints`: **바뀐 것 = `legalTerms.ts` · `legalPrivacy.ts` · `consent.ts` 지문 terms `744bd43ff8a4` → `20c57ceb8492` · privacy `32ff0ee6e8f4` → `efa323055ed0` 둘뿐**, `consentContent.ts` · 동의 지문 · 판 13개 변화 0. `gen-if2-assets --check` 같음. 그 사이 check:copy 107/2(A · I)였던 것이 풀려 실패 0 |

## IF5-F1 화면 × 상태 5종 (기획/화면_요구사항.md IF5 셈표)

| 화면 · 칸 | 빈 | 불러오는 중 | 오류 | 범위 밖 | 시각 모름 | 시험 |
|---|---|---|---|---|---|---|
| IF-MADANG 사주 마당 | CK17A 꺼짐: `FUN.ck17.offBody` + [동의하고 보기] / 내 정보 없음: `SAJU.madang.empty` + [내 정보 넣기] (개인 카드 0 · 서버 호출 0 · 날짜 고르기 · 달력 · 읽는 법은 보임) | `saju-loading` 정지 뼈대 + `SAJU.status.loadLab` | 코드별 칸 7종(동의 안내 · 내 정보 다시 · 다시 시도 · 다시 시도 없음) | `SAJU.range.before`(칸째, 나머지 카드 그대로) | 넷째 칸 점선 + `SAJU.hour.unknown` + [시각 넣기] (막지 않음) | if5Saju |
| 홈 '오늘 하루' 띠 · B6 입구 | 스위치 · 동의 꺼짐 → 칸째 0 | 해당 없음(홈은 새로 안 부름 — 동의 읽기만) | 해당 없음(못 읽으면 칸째 0) | 해당 없음(띠는 오늘 날짜만 — 범위 밖 날짜면 띠째 0) | 해당 없음 | if5Home |
| IF-SJ-IN 입력 시트 | 시각 '모름' · 곳 비움 처음값 | 저장 버튼 `loading`(연타 막힘) | `SAJU.status.errBody` + 값 보존 | 한국 밖 → `SAJU.range.abroad`(저장은 눌림) | 시각 모름 → `SAJU.hour.unknown`, 23 ~ 01시 → `SAJU.input.zi` | if5Saju |
| IF-SJ-PARTNER 상대 생일 시트 | CK20 확인 전 입력칸 잠김 | 해당 없음(기기 계산이 즉시 — [맞춰 보기] 한 번 = 계산 한 번) | `calcError` 한 줄 + [생일 다시 넣기] | `outOfRange`(1961-08-10 이전 · 없는 날 · 미래) / `minor`(만 19세 미만 — 결과 0 · 다른 생일 권하는 말 0) | 시각 모름 → `SAJU.partner.hourUnknown` | if5Saju |
| IF-SJ-CARD 결과 한 장(허브 안 카드) | 계산값 없음 → `SAJU.status.empty` | 카드 뼈대 | 칸별 `ErrorBlock` + [다시 시도] | 칸째 범위 줄 | 네 기둥 표 점선 칸 · 시주 필요한 줄만 빠짐 | if5Saju |
| IF-SJ-CAL 달력 · 날짜 고르기 | 용도 안 고름: 달력만 + `SAJU.pick.hint` | `loading`(색 0) | `ErrorBlock` + [다시 시도] | 지원 범위 밖 달 → `SAJU.status.rangeBody` | 해당 없음(날짜 고르기는 시각을 안 씀 — 개인 맞춤 `p_personal` false) | if5Saju |
| IF-SJ-TALK · IF-MILE · IF-MILE-LOG · IF-MILE-OK · 잔액 부족 | F2 몫 — 이번 묶음에 없음 | | | | | |

## IF5-F1 `보안/IF5_위협.md` 앱 줄 중 F1 몫

| 번호 | 대응 | 근거 |
|---|---|---|
| IFF5-17 시각 입력 | 선택 · '모름' 처음값 · 미리 체크 0 · 정오로 채우기 0 · 모름이면 시주 칸 점선 | if5Saju(입력 시트) · 웹 점검 |
| IFF5-18 출생지 | 목록 23곳만 · 자유 글 0 · 위치 권한 0 · 지점 이름이 로그에 0 | 시험 · check_sec2 IF5-ab 통과 |
| IFF5-19 상대 입력 | 이름 · 성별 · 별명 · 연락처 칸 0 · 칸 하나(생년월일) + 선택 시각 · 자동완성 · 자동수정 끔 · CK20 확인 | PartnerSheet 시험(TextInput 속성) |
| IFF5-20 상대 값 로컬 저장 0 | 값은 시트 메모리뿐 · 닫으면 사라짐(다시 열면 빈 칸) · 앱이 뒤로 가면 입력 가림 · 저장소 · 네트워크 호출 0 정적 점검 | if5Saju · if5Module |
| IFF5-21 클립보드 · 공유 | 공유 · 복사 단추 0 · expo-clipboard · expo-sharing 가져오기 0 | if5Module 정적 |
| IFF5-22 캡처 막기 | 허브 · 오늘 하루 · 달력 · 상대 시트에 `useAlwaysCaptureBlock` | if5Saju(훅 인자) |
| IFF5-23 공유 카드 | 공유 카드 자체 없음 | — |
| IFF5-24 로그 | `console.*` 0 · `safeLog` 인자에 입력 값 0 | check_sec2 IF5-ab 통과(92곳) |
| IFF5-25 오류 리포트 | 오류 리포트에 입력 상태 0(로그는 이벤트 이름 + 코드만) | sajuApi |
| IFF5-28 예언 표시 | '재미로 보는 이야기예요' · 끝줄 '결정은 내 몫이에요' · 법무 끝줄 · '쉬어 가는 날' | 웹 점검 · check:copy IF5 |
| IFF5-29 홈 호출 0 | 홈을 열 때 서버 호출 = 홈 상태 + 동의 읽기뿐(get_my_* 0 · AI 0) | if5Home |
| IFF5-30 푸시 0 | 알림 · 푸시 가져오기 0 | if5Module 정적 |
| IFF5-31 로그아웃 · 탈퇴 | `forgetSajuDevice()`를 두 곳(`lib/supabase` 로그아웃 정리 · 설정 `leaveToStart`)에 | 코드 · deviceInput 시험 |
| IFF5-32 재설치 뒤 | `forgetStaleIf5Storage`(열쇠 목록대로) | if5Storage 시험 |
| IFF5-33 매칭 화면 | 추천 · 호감 · 등급 · 채팅 · 탑승권 · 상점 코드가 사주 모듈을 가져오지 않음 | if5Module 정적 |
| IFF5-34 접근성 라벨 | 네 기둥 표는 이름만 읽고 칸 글자는 숨김 · 오행 막대 숫자 라벨 0 | if5Saju |
| IFF5-35 번들 | `src/saju5` 에 AI 요청 · 지시문 · 원가 · 차감표 모듈 0 · `check:ait-bundle` 걸린 것 0 | if5Module · check:ait-bundle |
| IFF5-01 · 03 · 05 · 06 | SDK 새로 0(package.json 의존성 변경 0) · consumeAsync 0 · 연타 방지(저장 버튼 `busy`) · 자동 재시도 0(다시 시도는 사용자가 누름) | check_sec2 IF5-z 통과 · if5Saju |
| IFF5-02 · 04 · 07 ~ 16 | F2 몫(마일리지 · 결제 · AI · 위기 · 대화) | — |

## IF5-F1 바닥선

| 항목 | 결과 |
|---|---|
| tsc | 0 |
| expo lint | 문제 0 |
| jest | 120묶음 2,123건 **3회 연속** 통과 → 정적 점검 시험 4건을 더한 뒤 2,127건 1회 통과(시작 116묶음 2,060건: +4묶음 +67건) |
| check:copy | 통과 110 · 실패 0(IF5 그룹 · IF3 그룹 포함) |
| check:tokens | 통과 5 · 실패 0 |
| check-a11y | A1 ~ A3 통과 |
| sync-ait --check / sync-if5 --check / gen-if5-copy --check / gen-if3-copy --check | 모두 같음 |
| 웹 if2(390) / f7 / lounge(390) | 125 / 0 · 65 / 0 · 73 / 0 |
| 웹 새 점검 `check:saju`(360 · 390 · 430) | 38 / 0 · 38 / 0 · 38 / 0 |
| check_sec2(`SEC_SKIP_AUDIT=1`) | 178건 = 통과 164 · 실패 0 · 정보 14(IF5-m2 정보 → 통과) |
| prepush_scan | 확정 0 · 확인 0 |
| 새 CRLF | 0(원래 CRLF 이던 파일 4개 — routes.test · secureStorage · flow · screens — 는 그 줄끝 그대로) |
| check:bundle-audit | 실패 1(번들 안 `decode-uri-component` 높음 — 패키지 의존성을 안 바꿨고, 권고 목록 날짜 의존으로 보임. 시작 커밋에서도 같은지는 **안 돌려 봄(미확인)**) |
| 끝 node 프로세스 | 1 |

## IF5-F1 못 한 것 · 확인 못 한 것

- **음력 날짜**: 계산 모듈에 음양력 표가 없어(계산명세5 '다음 단계') 달력에 음력 줄을 안 만듦. 그런데 카피 `SAJU.cal.hint`는 '그날의 글자 · 절기 · 음력을 볼 수 있어요'라고 약속함 → 마케팅 확인.
- **G-06 만난 날의 하늘(메모 줄)**: 카피 `MEET_SKY.*` 9키는 사본에 들어왔지만 화면은 안 만듦 — 앱 사본 하늘 라이브러리(if3Library.json · skyWeeks.json)에 `sky_day_stage` · `sky_day_term` · 일별 표가 없음(gen-if3-assets 확장 필요). 달력 날짜 고르기 UI를 메모에서 공유하는 일은 미완.
- **G-01 읽는 법의 기내지 ① 쪽 · 하늘 도감 머리 접힘 칸**: 허브의 '읽는 법' 카드 + [?] 시트(조각 F5-16, 낱말 8 → 칩 9)는 만들었으나 `READ_GUIDE.*` 5키(기내지 접힘 칸용)는 사본에만 있고 화면 연결 0. **G-05** `THREE_PILLARS.*` 22키는 F5-01 카드로 대체되어 경계 날 안내 둘(`cusp.ipchun` · `cusp.month`)만 씀.
- **숨은 글자(지장간) 줄**: `SAJU.table.row.hidden` 은 표 자료(지장간 전부)가 모듈에 없어 줄을 안 만듦(관계의 결 · 기운의 단계 둘만). **'어디서 왔나요'(`SAJU.card.source`)** 줄도 근거 자료가 없어 0.
- **날짜 고르기 '상대 생일 합쳐 보기' 스위치**: 24장에 글 키가 없어 0. 개인 맞춤(`p_personal`)은 서버가 지원하지만 F1은 늘 false(시각 · 곳도 안 보냄).
- **성별 값**: 서버가 profiles 에서 읽으며 앱은 값이 없음 → 입력 시트는 칸 이름 + 안내만(값 표시 0). **인생 계절표 현재 계절 표시**는 시작일 비교로 굵은 글 + 테두리(글 키 없음).
- **partner5**: F2 AI 맞춤 몫이라 동기 대상에서 뺌(request5 · generated5 지시문이 번들에 들어옴).
- 디자인 아이콘 22개는 안 씀(기존 앱 아이콘만) · 실기기 · 스크린리더 · Pretendard 실글꼴 · 저가 안드로이드 60fps — 미확인(헤드리스 브라우저 점검뿐).
- `check:bundle-audit` 위 항목. 실호출 0 · 실결제 0 · 푸시 0.

## IF5-F1 넘김 (팀장 경유)

- 백엔드: ① 서버 스위치 목록에는 `saju_yard` · `mileage` · `mileage_charge` 셋뿐 — 앱 키 17개 가운데 나머지 14(saju_home · saju_reading · saju_season · saju_year · saju_calendar · saju_today · saju_pickday · saju_partner · pair_card_saju · saju_ai · saju_talk · mileage_spend · mileage_gift · rest_hint)를 서버가 모르면 앱은 live 값(꺼짐)을 써서 실서버에선 `saju_yard`를 켜도 하위 카드가 안 보임 → 등록 · 이름 확정 필요 ② `get_my_luck` 월운 응답에 달 이름이 없어 앱이 절기 차례(k)로 근사(입춘 = 2월) ③ 0049 `set` 반영 완료(앱은 있으면 쓰고 없으면 발행 해 규칙).
- 기획: 스위치 가안 이름(saju_madang · mileage_view · mileage_topup)을 서버 이름으로 고쳐 주기 · 대표 지점 목록 23곳 · 시각 입력 방식(앱은 시 0 ~ 23 + 분 5분 간격 칩 — 디자인의 12시진 칸 대신) 확인.
- 마케팅: ① 새 글 요청 — 네 기둥 칸 이름 '해 · 달 · 날 · 시'(디자인 시안 표기) · 시 · 분 단위 '{n}시' · '{n}분' · 계절표 나이 '{n}세 ~ {n}세' ② `SAJU.cal.hint` 음력 약속 ③ `SAJU.status.balanceFailed` 마침표 ④ `SAJU.today.line` 값 틀 자리에 앱이 쓰는 글(조각 F5-12의 '이날 글자의 바탕은 …' 줄 — '오늘' 아님) 괜찮은지 ⑤ 카피 22-14 · 24장 '앱 반영 전' 표시를 '앱 반영'으로(F1 몫 키: 24장 SAJU.* 중 F1 화면이 쓰는 키, 22-14 4키).
- AI: ① 상대 궁합 줄임 문(partner5)은 F2에서 동기 대상으로 더함 ② 음양력 표 · 지장간 표가 있으면 달력 음력 줄 · '숨은 글자' 줄을 켤 수 있음 ③ `names5` 별난 점 이름이 화면에 나오는 글이 괜찮은지 확인.
- 보안: `P5-e2`(서버 폴더 가져오기)를 피하려 `ai/AIT/ts` 의 rules · text · types 를 `src/saju5/ait/` 에 따로 복사함(정규식 · 타입뿐) — 이 복사 위치를 보안이 허용하는지 · `IF5-aa` 가 `src/saju5/**` 안 문자열도 보게 되는지.
- 법무: 입력 시트의 시각 · 곳 저장 칸이 CK17A 항목별 동의(기기 안 저장 선택)와 일치하는지 — 서버 쪽 CK17A 확장 기록(항목별 시각 · 곳)은 F2 ⑪ 동의 시트 몫이라 F1은 기기 칸으로만 둠.

## IF5-F1 척추 대조

- 줄 · 짝 · 순서 · 노출 · 등급 · 탑승권에 0: 사주 결과를 내보내는 코드 · 매칭 화면이 사주 모듈을 가져오는 길 0(정적 점검) · 서버 호출은 본인 계산 읽기뿐 · 상대 생일은 기기를 안 떠남.
- 점수 · 퍼센트 · 판정 · 순위 · 숫자 배지 · 깜빡임 · 푸시 · 연속 접속 표시 0 · 재회운 0 · 겁주기 0('쉬어 가는 날' · '부딪히기 쉬운 결' 화면 말).
- 네 질문: ① 줄을 흐리지 않나 — 예 ② 필수 일치를 깨지 않나 — 예 ③ 진지한 사람에게 도움 — 예(재미 영역, 결과는 짝 · 줄에 안 쓰임을 화면에 밝힘) ④ 차분 · 기다림 즐겁게 — 예(펼침 기억 0 · 끝이 있는 한 화면 · 재촉 · 중독 장치 0).
- 벗어난 것: 없음.
