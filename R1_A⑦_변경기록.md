# R1 · A⑦ 공통 변경기록 — 스위치 훅 확장 · V10 안내 부품 · T04 · T09 · T11 · T12 · K11

- 2026-10-18 · 앱개발직원2(F19 이어서) · 배정 `팀장/세부청사진/R1_배정.md` · 기준 `기획/K19_기능총목록.md` 2-3 · 2-4 · 2-5 · 3장 · `기획/K15_K13반영.md` 2-1 · 3장 · `마케팅/B17_변경기록.md` 5장 · `마케팅/카피.md` 1-1 · 7장 · 척추 v2(`팀장/척추.md`)
- 범위: **새 파일 + `scripts/` 점검 도구만.** 기존 화면 · theme · package.json 수정 0(F17 작업 중). 내가 F19에서 만든 새 파일 3개(`lib/featureFlagsApi.ts` · `lib/v4Demo.ts` · F19 시험 2개)는 A⑦ 몫이라 고쳤다. 기존 점검 도구 `scripts/check-copy.mjs`에는 새 그룹을 부르는 줄 2개만 더했다.
- 유료 0 · 실서버 0 · .env 0 · 새 패키지 0 · app/ 밖 수정 0(읽기만: `backend/migrations` · `마케팅/카피.md` · `기획/K19`).

## 1. 대조

| 몫 | 한 일 | 결과 | 근거 |
|---|---|---|---|
| 스위치 훅 확장 | 키 한 목록 `src/config/featureKeys.json` 52개(K12 9 · K15 3 · K19 2-5 새 키 40) + 읽는 함수 `config/featureKeys.ts` + 훅 `hooks/useFeatureFlags.ts`(한 번 불러 나눠 씀, 같은 때 요청 1번). 서버가 모르는 키 · 못 읽음 = 키의 live 값(구현된 기능 E 7개만 켜짐, 새 기능 꺼짐), null(정지 · 탈퇴) = 전부 꺼짐. 데모(v4Demo)도 52키를 낸다(`v4off` = live 처음값) | ○ | r1Common · r1CommonParts · f19Wave01Api |
| V10 안내 부품 | `components/ContactHint.tsx`(0.5초 멈추면 · 모양 없어지면 바로 사라짐 · polite 한 번 · 막지 않음 · 스위치 꺼짐이면 없음) · `ContactReceiverNote`(받는 쪽 고정 한 줄) · 판정 `lib/contactShape.ts`(서버 `text_guard`와 같은 식, 기기 안 · 로그 0) · 글 `content/contactHintCopy.ts`(카피.md 7장 B17 확정 글 그대로) · 낱말 사본 `content/contactWords.ts`(생성, `scripts/gen-contact-words.mjs`) | ○ | T10-01 문장 세트: 연락처 60 중 59 찾음 · 평범한 문장 100 중 오탐 1(텔레비전, 서버와 같음) |
| T04 | `scripts/check-copy-rules.mjs` — B17 5장 R1~R18 → check:copy 그룹 T04(R1~R3 · R5~R17 실패 규칙 16개, R4 사람 검토 목록, R18은 앱 시험 T3-02로 넘김). 토스트 상수: F17이 `theme/motion.ts`에 둔 `TOAST_MS`(5초, 팀장 10-17)를 `config/toast.ts`가 그대로 다시 내보내고 글 규칙(40자 · 두 문장)만 더함 | ○ | `node scripts/check-copy.mjs` 91 통과 · 0 실패(전 72 + 새 19) |
| T09 | 이름 잇기 `lib/a11yLabel.ts`(제목 → 내용 → 상태, 빈 조각 건너뜀) · 역할 말 찾기 · 읽는 차례 시험 도우미 `__tests__/a11yOrder.ts` · check-a11y A3(이름에 '버튼' · '단추' 0) | ○ | 지금 코드 0건 · 부품 읽는 차례 시험 |
| T11 | `scripts/check-a11y.mjs`(새 패키지 없이 TS 구문 나무): A1 이름 없는 눌림 요소 · A2 이름 없는 날 입력 칸 · A3 이름에 역할 말 | ○ | .tsx 103개 · 위반 0 · 일부러 어긴 화면은 잡음 |
| T12 | 스크롤 단서 `hooks/useScrollCue.ts`(판단) · `components/ScrollCue.tsx`(옅은 띠, 꾸밈 · 누름 통과) · check-a11y 참고 목록(글자만 있는 링크 TextButton 13곳) | ○(부품 · 목록) | 배치 규칙 '다음 영역이 조금 보이게' · 링크 → 버튼 모양은 디자인 D22 한 줄 뒤 |
| K11 | check:copy 그룹 K11 3개: 심사 낱말(28) · 기술 말 탓(43) · 공포 말(52). 22 · 23 · 53은 기계로 못 재 사람 검토 | ○ | 허용 1(아동 안전 고지의 '법적 조치') |

## 2. 만든 · 고친 파일

| 파일 | 새/고침 | 내용 |
|---|---|---|
| `src/config/featureKeys.json` | 새 | 키 52 · 묶음 · ID · live · pending. **JSON인 이유**: 키 이름 `grade_*` · `appearance_score`가 .ts에 있으면 기존 `staticRules.test.ts`(등급 말 허용 목록 · score 금지)에 걸린다. 화면 글이 아니라 서버 스위치 이름이고 scripts도 같은 파일을 읽어야 해서 JSON으로 뒀다. 팀장이 원하면 staticRules 허용 목록에 넣고 .ts로 옮긴다(4장 1번) |
| `src/config/featureKeys.ts` | 새 | 목록 읽기 · `liveDefault` · `isPendingKey` · `isFeatureKey` |
| `src/hooks/useFeatureFlags.ts` | 새 | `createFlagsStore`(시험용) · `appFlagsStore`(앱, 처음 쓸 때 서버 연결) · `useFeatureFlags()` |
| `src/lib/featureFlagsApi.ts` | 고침(F19 새 파일) | 9키 → 52키, 키별 live 값, `FLAGS_FALLBACK` 추가 |
| `src/lib/v4Demo.ts` | 고침(F19 새 파일) | 스위치 52키(pending 2개는 서버에 없음), `v4off` = live 처음값 |
| `src/lib/contactShape.ts` | 새 | 모양 5가지 · 칸별 안내 고르기 |
| `src/components/ContactHint.tsx` | 새 | 안내 줄 · 받는 쪽 고정 줄 |
| `src/content/contactHintCopy.ts` | 새 | CONTACT_HINT 12줄(카피.md 7장 그대로) |
| `src/content/contactWords.ts` | 새(생성) | 연락 수단 28 · 링크 낱말 7(웹 주소 머리 3개는 판정식이 잡아 뺌 — 앱 코드에 http:// 0 규칙) |
| `src/config/toast.ts` | 새 | `TOAST_MS`(theme/motion 그대로) · `toastFits` |
| `src/lib/a11yLabel.ts` | 새 | `a11yJoin` · `roleWordIn` |
| `src/hooks/useScrollCue.ts` · `src/components/ScrollCue.tsx` | 새 | T12 |
| `scripts/check-copy-rules.mjs` · `scripts/lib/content-strings.mjs` | 새 | T04 · K11 규칙(글은 실행하지 않고 TS 구문 나무에서 꺼냄) |
| `scripts/check-copy.mjs` | 고침(2줄) | import 1줄 + `runCopyRules(...)` 호출 1줄 |
| `scripts/check-a11y.mjs` | 새 | T11 · T09 · T12 점검 |
| `scripts/gen-contact-words.mjs` | 새 | contactWords.ts 생성 · `--check` |
| `src/__tests__/r1Common.test.ts` · `r1CommonParts.test.tsx` · `a11yOrder.ts` | 새 | 시험 · 도우미 |
| `src/__tests__/f19Wave01Api.test.ts` · `f19Wave01Parts.test.tsx` | 고침(F19 새 파일) | 52키 · live 값 반영, 강조 라벨 최상급 금지('가장' · '최고' 다시 막음, 팀장 결정) |

## 3. 연결할 자리(각 화면 주인 · F17 뒤, 줄 번호는 10-18 기준)

| 기존 파일 | 줄 근처 | 할 일 | 주인 |
|---|---|---|---|
| `package.json` scripts | — | `"check:a11y": "node scripts/check-a11y.mjs"` · `"gen:contact-words": "node scripts/gen-contact-words.mjs"` 추가, `check`에 `npm run check:a11y` 더하기 | F17 뒤(A⑦) |
| `src/lib/demoBackend.ts` | 644~662 `rpc()` | `v4.handles(name)` 넘김(F19 변경기록 3장과 같은 자리) — 이게 없으면 데모 모드는 스위치를 못 읽어 live 값(새 기능 꺼짐)으로 돈다 | F19 2단계 |
| 각 화면 | 화면 위 | `const { isOn } = useFeatureFlags();` → `isOn('featured_pick')` 등. 꺼지면 그리지 않음 | A①~A⑥ |
| `src/features/recs/RecommendationsScreen.tsx` | 41 `toastMs: 3_500` · 277 접근성 이름 | `TOAST_MS` · `a11yJoin(…)` | A① |
| `src/features/recs/CandidateScreen.tsx` | 44 `toastMs: 3_500` | `TOAST_MS` | A② |
| `src/features/likes/LikesScreen.tsx` | 42 `toastMs: 3_500` | `TOAST_MS` | A③ |
| `src/features/shop/ShopScreen.tsx` | 47 `toastMs: 3_000` | `TOAST_MS` | A⑤ |
| `src/features/settings/SettingsScreen.tsx` | 48 `TOAST_MS = 2500` | `config/toast`의 `TOAST_MS` | A④ |
| 08 질문 소개 입력(V06, 아직 없음) · 10 호감 시트 편지 칸(편지 본체, 아직 없음) · 04 직접 쓴 칸 | 글 칸 바로 아래 | `<ContactHint field="public" | "letter" text={…} enabled={isOn('contact_hint')} />` | A② · A③ · A⑥ |
| 11 받은 호감 편지 · 10 '저를 소개해요' 구역 | 글 위 · 아래 | `<ContactReceiverNote />` + 글 자동 링크 끔(10-12) | A③ · A② |
| `src/features/consent/ConsentScreen.tsx` · `src/features/grade/GradePages.tsx`(16-G1) | ScrollView | `useScrollCue` + `<ScrollCue />` | A⑥ · A⑤ |
| 글자만 있는 링크 13곳(check-a11y 참고 목록) | — | D22 규칙이 나오면 버튼 모양으로 | 디자인 D① → 각 화면 |
| `src/__tests__/staticRules.test.ts` | 63~80 허용 목록 | (선택) `config/featureKeys.ts`를 허용 목록에 넣고 키를 .ts로 옮길지 | 팀장 결정 |

## 4. 실행 결과 · 못 한 것 · 결정할 것

| 실행(10-18) | 결과 |
|---|---|
| `npx jest src/__tests__/r1Common src/__tests__/f19Wave01 src/__tests__/staticRules.test.ts` | 5파일 **107 통과 · 실패 0**(새 r1 2파일 25 · F19 48 · 기존 staticRules 34) |
| `npx tsc --noEmit` | 내 파일 오류 0. 전체로는 1건 — F17 작업 중 파일 `src/motion/primitives.tsx(11)` |
| `npx eslint`(새 · 고친 파일 20개) | 오류 0 |
| `node scripts/check-copy.mjs` | 통과 91 · 실패 0(새 그룹 T04 16 · K11 3) |
| `node scripts/check-a11y.mjs` | A1 · A2 · A3 위반 0(.tsx 103개), 참고 T12 13곳 |
| `node scripts/check-tokens.mjs` | 통과 5 · 실패 0 |
| `node scripts/gen-contact-words.mjs --check` | 최신(연락 수단 28 · 링크 7) |

- 척추 대조(v2): 마디 3 정확한 줄(연락처 안내 · 접근성 · 글 규칙은 줄 계산에 닿지 않음, 안내 판정 결과를 추천 · 등급에 쓰지 않음) · 4 진지함 · 5 정성(느낌표 · 사과 · 공포 말 · 재촉 말 점검, 토스트 5초). 스위치 훅은 마디 전부의 켜고 끄기 자리. 네 질문 ① 줄을 흐리지 않음(등급 · 외모 계산 키는 live 켜짐 그대로, 끄는 것은 본인 확인 뒤) ② 끼리끼리와 무관해 깨지 않음 ③ 진지한 사람에게 도움(연락처 안내 · 읽기 쉬움) ④ 차분 · 품위(막지 않는 안내 · 빨간색 · 진동 0) → 모두 예. 벗어난 것 없음.

| 번호 | 내용 | 누가 |
|---|---|---|
| 1 | 키 목록을 JSON으로 둔 것(2장 첫 줄) 그대로 둘지, staticRules 허용 목록을 고쳐 .ts로 옮길지 | 팀장 |
| 2 | T11의 `eslint-plugin-react-native-a11y` 설치(K15 3장 13번)는 package.json이 막혀 대신 `check-a11y.mjs`로 했다. 설치가 필요하면 F17 뒤 | 팀장 |
| 3 | check:copy 허용 목록 '고칠 것': `SETTINGS.verificationToast`('준비 중이에요' — 토스트인데 마침표 없음) → 문구 주인 C① · 앱 12 주인 | C① · A④ |
| 4 | check:copy 허용 목록 '예외 대기': `LIKES.acceptDone`(B17 8장 4번) | 팀장 |
| 5 | T12 배치 규칙('다음 영역이 조금 보이게') · 글자만 있는 링크 → 버튼 모양 규칙은 D22 한 줄이 먼저 | 디자인 D① |
| 6 | R18(안심 공유 문장 = 카피.md 조합 예)은 F19 2단계에서 문장 틀을 확정 글로 바꾼 뒤 T3-02 기대 문장으로 | F19 2단계 |
| 7 | F17 파일 `src/motion/primitives.tsx`에 tsc 오류 1건(10-18 01시 실행 때, F17 작업 중) — 내 파일 아님 | F17 |
