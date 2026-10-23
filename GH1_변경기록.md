# GH1 변경기록 — 저장소만 받은 곳에서 시험이 통과하도록 (2026-10-23)

지시: 팀장 GH1(본인 승인 10-23). 기능 코드 수정 0, 시험 · README · 도우미만 고쳤다. 커밋 · 푸시는 하지 않았다(팀장이 대조한 뒤 한다).

## 무엇이 문제였나

| 실패 묶음 | 원인 |
|---|---|
| demoAi · legalContent · legalGen · likesApi · r1Common · surveyLiteModel · surveyV2Copy · surveyV2Csv · surveyV2Schools | 저장소 밖 문서(법무 · 기획 · 마케팅 · 데이터 · ai · backend)를 읽다가 ENOENT, 또는 그 문서를 읽는 스크립트(check-copy · check-copy-rules · gen-legal-content)가 실패 |
| recsScreen · splash | 디자인 원본을 읽는 것에 더해, 앱 경로를 `작업폴더/app/…` 로 적어서 폴더 이름이 `app` 이 아닌 복제본(`gyeoljeongsa-app`)에서는 앱 안 파일도 못 찾았다 |
| gradeScreen · likesScreen · onboardingScreen · surveyV2Screen | 저장소 밖 문서를 읽지 않는다. 복제본에서 다시 돌리니 둘 다(원래 · 고친 뒤) 통과. 묶음 하나가 90~177초 걸리는 무거운 화면 시험이라 바쁜 기계에서 시험 하나가 30초 제한을 넘은 것으로 본다(문서와 무관). 기능 코드가 아니라 손대지 않았다 |

## 고친 것

- 새 도우미 `src/__tests__/helpers/outsideDocs.ts`: `APP_DIR`(폴더 이름과 무관) · `outsidePath` · `hasOutside` · `describeOutside(문서들)` · `testOutside(문서들)` · `whenOutside(문서들, fn)` · `readOutside`(없으면 빈 글) · 문서 묶음 `LEGAL_DOCS` · `CHECK_COPY_DOCS`. 문서가 없으면 그 검사만 건너뛰고 `[건너뜀] 저장소 밖 문서 없음: … ` 한 줄을 찍는다.
- 시험 15개 파일:

| 파일 | 바꾼 것 |
|---|---|
| demoAi | mock_20.json 대조 시험 1개 → testOutside |
| legalContent | check:copy 묶음 → describeOutside(CHECK_COPY_DOCS) |
| legalGen | 법무 게시본 생성 묶음 → describeOutside(LEGAL_DOCS) |
| likesApi | 읽기를 readOutside 로(모으는 단계에서 터지지 않게), '글 원본 대조' 묶음 → describeOutside |
| r1Common | check-copy-rules 실행 시험 → testOutside(카피.md). 조용히 return 하던 K19 · 금칙어 시험 2개 → testOutside |
| recsScreen | 디자인 원본 비교 줄만 whenOutside, 앱 그림 경로는 APP_DIR |
| splash | 디자인 원본 비교 시험 → testOutside, app.json · 스플래시 파일 경로는 APP_DIR(복제본에서도 돈다) |
| surveyLiteModel | 읽기 → readOutside, 문서 대조 시험 5개 → testOutside, `작업폴더/app` 경로 → APP_DIR |
| surveyV2Copy | 읽기 → readOutside, 카피 대조 시험(test.each 78 + 3) → testOutside. 글 규칙 묶음은 그대로 돈다 |
| surveyV2Csv | CSV 없으면 rows = [] · 묶음 → describeOutside |
| surveyV2Schools | 판 해시 시험 1개 → testOutside |
| f11Shell · f13aAssets · f24DemoPeople · staticRules(2) | 이미 `if (!exists) return` 으로 조용히 통과하던 디자인 원본 비교 → testOutside(건너뛴 사실이 보이게) |

- `README.md` 맨 위에 '동업자 시작하기'(필요한 것 · 처음 한 번 · 작업 규칙 · 주의) 표를 새로 썼다. 기존 내용은 그대로 아래에 두고 머리만 '내부 기록 — 결정사 앱 (app/)' 으로 바꿨으며, `../` 경로는 팀 작업 폴더라는 안내 한 줄을 달았다.

## 저장소 밖 문서를 읽는 스크립트(고치지 않음, 동업자는 쓰지 않음)

`check-copy.mjs`(+ `lib/legal-source.mjs` · `lib/legal-markers.mjs`) · `gen-legal-content.mjs` · `check-copy-rules.mjs` · `check-tokens.mjs`(디자인/가이드.md) · `gen-schools.mjs` · `gen-contact-words.mjs`(없으면 안내만) · `link-demo-people.mjs` · `web-f3.mjs`. 그래서 README 에는 `npm test` · `npm run typecheck` 만 적고 `npm run check` · `check:*` · `gen:*` 는 팀 문서가 있어야 돈다고 적었다.

## 확인

| 확인 | 결과 |
|---|---|
| 이 폴더 jest 전체 | 78묶음 · 1,501 통과 · 실패 0 · 건너뜀 0 (지금과 같은 수) |
| 저장소 밖 문서 없는 흉내(스크래치패드 gh1_test, `git ls-files`(+새 파일) 복사 · node_modules 는 clone_test 것을 junction) | 78묶음 · 실패 0 · 통과 1,384 · 건너뜀 117 (묶음 2개 legalGen · surveyV2Csv 는 전부 건너뜀) |
| 고치기 전 같은 흉내(clone_test) | 11묶음 실패 · 15 시험 실패 · 4묶음은 시작도 못 함 |
| `npx tsc --noEmit` · `npx eslint src/__tests__` | 오류 0 · 경고 0 |
