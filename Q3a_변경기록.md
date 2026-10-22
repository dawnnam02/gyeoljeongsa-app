# Q3a 변경기록 (앱개발직원, 2026-10-17)
기준: 팀장/세부청사진/Q3a.md · 검수/Q5a_앱_버그.md · 디자인/D22_UI규격_제안.md. 시작 시험: jest 893 통과 / 48묶음.

## 진행 상태
| 단위 | 상태 | 비고 |
|---|---|---|
| Q5A-01 | 완료 | navigation/entry.ts(resolveEntryHref) + app/index.tsx. 로그인 있음 → get_progress → routeForStage. 실패 시 02. 시험 entryResolve |
| Q5A-02 | 완료 | usePhotoUrls: 240초 재받기·5초 간격 3회 재시도·던짐 흡수. PhotoBox broken은 uri 바뀌면 초기화. 08도 같은 훅. 시험 photoUrlRefresh |
| Q5A-03 | 완료 | shop/parts.tsx sellerText: 값 없는 칸을 빼고, 모두 비면 null → REFUND_GUIDE.sellerSoon('판매자 정보는 준비 중이에요.'). 박아 둔 시험 3곳 갱신. 시험 sellerLine |
| Q5A-05 | 완료 | shopLogic.priceOf: 카피의 금액 자리를 서버 price_krw로 교체. 시험 shopPrice |
| Q5A-04 | 완료 | recsLogic.galleryPhotos: 'none' 칸은 빼고, 하나도 없으면 기본 그림 한 쪽. 쪽이 1개면 '사진 n / 3' 표시와 화살표 없음. 시험 recsScreen 추가 |
| Q5A-06 | 완료 | components/KeyboardAvoid(iOS padding). 07 요약 고치기·04 설문·신고 사유·탈퇴 인증번호 4곳. TagEditor는 07 안. 시험 keyboardAvoid. 실기기(iOS) 확인은 미확인 |
| Q5A-07 | 확인 | F14·S8d로 이미 해결: GradeSwitches가 grade.loadProcessing(서버 get_grade_processing)을 읽음. 시험 s8dConnect·settingsGrade |
| Q5A-09 | 완료 | LikesScreen·RecommendationsScreen load에 요청 번호(마지막 읽기만 반영) |
| Q5A-11 | 완료 | MatchOnceSheet: [받기] 누른 때의 k를 고정 |
| Q5A-12 | 완료 | subStatusText: 끝나는 날이 없으면 '이용 중' |
| Q5A-13 | 완료 | ptsText: 0.95 이상은 정수. 시험 shopPrice |
| Q5A-14 | 완료 | /shop?from=outside 로 연 상세의 ‹ 는 router.back(10·12로 복귀). 시험 shopScreen |
| Q5A-16 | 이유 | 데모 한정. 한국 09시 배치=UTC 자정이라 UTC 날짜가 곧 추천 날짜(주석만 남김) |
| Q5A-10 | 완료 | PurchaseSheet: 상품별 요청 ID를 시트가 닫혀도 유지(성공·확정 거절 때만 지움). 시험 shopScreen |
| Q5A-15 | 완료 | PhotosLiteScreen pressSlot 동기 가드(pressingRef) |
| Q5A-17 | 이유 | 구매 복원은 서버 restore 응답이 판정. 이용권만 있는 경우는 서버(demo_restore_purchases 범위) → 팀장에게 넘김 |
| Q5A-18 | 완료 | subViewOf: billing_retry는 active와 무관하게 '결제 문제' |
| B14-1 | 완료 | PURCHASES16_DRAFT→PURCHASES16, ReportPage EMPTY_NOTE→REPORT16.emptyNote, CANDIDATE.openTitle/openLabels check:copy 정식 대조. 가안 [참고]는 판매자 줄 한 건만 남음 |
| B14-2 | 완료 | 12 GradeSwitches 확인창(SETTINGS16.stopConfirm, 멈출 때만), REFUND_GUIDE 이용권 환불 줄(환불 줄 뒤). check:copy 실패 0(법무 C4 대조에서 걸리지 않음) |

## 버그 단계 끝 (조건 1~3): tsc 0 · eslint 0 · jest 915/915(53묶음) · check:copy 통과 71 실패 0. 다음: F15

## F15 (조건 4~6)
| 단위 | 상태 | 비고 |
|---|---|---|
| tokens.ts + 가이드.md 크기 값 | 완료 | button52·buttonSmall36·input52·chip32·touchMin48·header56·avatarTouch48, type 5단계(heading·body16/24·small·caption13). check:tokens 4/4 |
| 부품 minHeight/확대 제한 | 완료 | Chip·ScreenHeader·TabHeader·TextField·riskChip·탭바 minHeight, HEADER_MAX_SCALE 1.3(헤더 제목·탭 라벨) |
| 하단 고정 위 16 | 완료 | footer 9곳 paddingTop 16, 아래 20→16 |
| 시험 값 갱신 | 완료 | tabBar·v2Components·f11Shell 12건(13/18·minHeight·48·12). 점검 스크립트 기준 글자 13·터치 48로 |
| 360·390 재실행 | 완료 | check:web:demo 후 web-f13 52/52·web-f14 13/13 각 폭(가로 넘침 0·글자 13 미만 0·터치 48 미만 0). 12 멈추기 확인창 단계 추가. 캡처 확인/스크린샷/F15_360, F15_390 |
| 조건 6 | 완료 | tsc 0 · eslint 0 · jest 915/915(53묶음) · check:copy 71/0 · check:tokens 4/0 |
