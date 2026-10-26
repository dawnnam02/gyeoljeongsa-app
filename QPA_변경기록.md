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
