# V6-F 변경 기록 (앱 · 대화형 설문)

- 지시: 세부계획 V6-F · `팀장/세부청사진/V6_대화형설문.md` · 청사진_v5 14장 · 결정 D-161 ~ D-170 · D-182(본인 "넘어가", 2단계 투입)
- 기준: 시안 `디자인/V6_대화형설문/index.html`(AYLA'S 모양 2판, 확정 5건 A · D-165) · 문구 `기획/V6_대화형설문_문구.md` · `기획/V6_문구.csv` · AI 산출물 `ai/V6/` · 서버 `backend/작업중/0033_survey_interview.sql` · `functions/survey-interview` · `survey-analyze`
- 유료 0 · 실제 API 호출 0 · .env 0 · audit fix 0 · git commit/push 0(팀장 몫)

## 1. 만든 것 · 고친 것(파일 주인)

| 파일 | 무엇 | 구분 |
|---|---|---|
| `src/features/surveyChat/SurveyChatScreen.tsx` | 화면: 시작 → 1부 → 정치 → CK16 → 2부 → 정리 → 07 내 성향 → 글 문항 → 답 한눈에 보기 | 새 |
| `src/features/surveyChat/ChatInput.tsx` | 1부 입력 자리(설문 v2 부품 재사용) · 정치 막대 카드 | 새 |
| `src/features/surveyChat/parts.tsx` | AI · 내 말풍선, 구분 줄, 입력 중 점 3개, 글 입력 줄 | 새 |
| `src/features/surveyChat/model.ts` | 1부 대화 줄 만들기 · 지금 물을 문항(순수 함수) | 새 |
| `src/features/surveyChat/copy.ts` | 변형 고르기(회원 ID 고정) · 값 채우기 · 조사 · 받아 주는 말 고르기 · 2부 칸 이름 | 새 |
| `src/features/surveyChat/behavior.ts` | 입력 행동 숫자 6개 계산기(CK16 동의자만) | 새 |
| `src/features/surveyChat/api.ts` | 0033 앱 함수 5 · Edge 2 · CK16 동의 | 새 |
| `src/features/surveyChat/localChat.ts` · `deps.ts` · `switch.ts` | 이어하기 자리 저장 · 기본 연결 · 스위치 | 새 |
| `src/content/surveyChatCopy.ts` | 화면 글 434개(CHAT_V6, 자동 생성) | 새 |
| `src/demo/surveyChatBackend.ts` · `surveyChatScripts.ts` | 데모 모의 서버(대본 P01 정상 · P21 늦음 · P26 실패 · 분석 예시 P01) | 새 |
| `src/app/survey/[step].tsx` | 라우트 연결 한 줄(스위치 켜짐이면 대화형) + import 2줄 | 고침 |
| `src/config/featureKeys.json` | 키 `survey_chat`(묶음 V6, live 꺼짐 · 데모 켜짐) | 고침(1줄) |
| `src/__tests__/r1Common.test.ts` | 키 수 90 → 91(V6 묶음 1) 맞춤 | 고침(최소 5줄) |
| `scripts/check-copy.mjs` | 묶음 W: CHAT_V6 ↔ 카피.md 13장 한 글자씩 · 느낌표 · 등급 · 점수 0 | 고침(더함) |
| `scripts/web-v6f.mjs` | 웹 점검(360 · 390 · 동작 줄이기 · 한글 입력) | 새 |
| `마케팅/카피.md` 13장 | 같은 글 434줄 표(V6-K 393 + 시안 확정 13곳 등 41) | 더함 |
| `src/__tests__/surveyChatLogic.test.ts` · `surveyChatScreen.test.tsx` | 새 시험 31개 | 새 |

- surveyV2 부품은 고치지 않았다(재사용만): `QuestionInput` · `SchoolInput` · `OptionChip` · `PublicToggle` · `PoliticsSlider` · `model`(check · normalizeAnswers · answerText) · `api`(save) · `politics`.

## 2. 흐름과 규칙

| 항목 | 한 것 |
|---|---|
| 1부 문항 | 설문 v2 필수 흐름(보이는 것만) — T01~T03 은 2부로(D-163). 정치 막대는 희망 조건 끝 |
| AI 말 | `CHAT.{문항}.{1~3}` 가운데 회원 ID + 문항 ID 씨앗으로 하나(다시 열어도 같음). 섹션 끝 줄 → 구분 줄 '다음 이야기 · {섹션}' → 시작 줄 |
| 받아 주는 말 | 답 종류로만 고름(V6-K 표 '답 종류'). '알겠어요.'만 있는 줄은 세 문항에 한 번쯤 |
| 보내기 | 하나 고르기 = 누르면 바로. 구간 [이 구간으로 할게요] · 나머지 [이렇게 할게요] · 선택 문항(B03 · F12) [건너뛰기] |
| 저장 | 설문 v2 와 같은 차이 계산(normalizeAnswers → save_answers · clear_answers · save_free_texts · visibility_settings) |
| 고치기 | 내 답 말풍선 누름 → 그 자리에서 '이 답을 고칠게요.' + 부품 + [그대로 둘게요] [바꾸기], 뒤 대화 흐림 → '고친 답으로 바꿔 두었어요.'(앞에 새 필수 문항이 생기면 EDIT.chain 도) |
| 이어하기 | 서버 답에서 대화 줄을 다시 만든다. 1부: '{월}월 {일}일 · 여기서 멈췄어요' + RESUME.part1 + [이어서 하기] [답 한눈에 보기]. 2부: interview_resume 로 문답 + RESUME.part2. 정리 중: RESUME.summary |
| 진행 표시 | 머리 아래 '지금 이야기 · {섹션 · 칸 이름}'만(숫자 · 퍼센트 0) |
| CK16 | 2부 바로 앞 카드(무엇 · 왜 · 키 기록 안 함 · 90일 · 거두기 · 안 해도 됨) + 같은 무게(보조 모양 둘 · 같은 크기) 버튼. 서버가 이미 동의를 알면 묻지 않음 |
| 2부 | 글 입력(1000자) → survey-interview turn. 6초 넘으면 '답을 천천히 읽고 있어요.' · 통신 실패면 '다른 이야기로 이어 가 볼게요.' + 아직 안 물은 칸 예비 질문(멈춤 0) · 25턴(서버 429 · 앱도 셈) · [여기까지 할게요] = 바로 정리(시트 0) |
| 정리 · 07 | set_state wrap → survey-analyze → get_interview_summary. 요약 · 결혼에 대한 생각(이유 + 1부 E01 · E07 보기 글) · 자기소개 초안(facts.T01) · 이야기하는 방식 칩(가정 키 style_chips). 숫자 0. [고치기] → edit_interview_summary(user_edited, 원본 보기) · [이대로 좋아요] → T01 저장 → T02 · T03 은 AI 초안을 칸에 넣고 본인이 확인 |
| 2부 꺼짐 · 실패 | 스위치 off · 시작 실패 → 2부 없이 T01~T03 을 1부 말(CHAT.T0x)로 묻는다. 하루 3번 넘음 → TALK.dailyLimit + [답 한눈에 보기] |
| 끝 | [답 한눈에 보기] → `/survey/v2`(설문 v2 검토 → 제출 → 05) |

## 3. 입력 행동 숫자(행동지표.md)
- CK16 동의자만 계산기를 만든다. 동의가 없으면 요청에 `behavior` 키 자체가 없다(시험).
- 메시지 하나 동안 카운터 13개만 들고, 보낼 때 6개로 줄이고 0 으로 되돌림. 키 배열 · 시각 목록 · 기기 저장 0(코드 검사 시험).
- 한글 조합: 보이는 글자 수(NFC · grapheme) 차이 하나로 — 조합 단계 · 조합 중 자모 지움은 지움 0, 글자 수가 줄 때만 지움. 5글자 넘게 한 번에 늘면(붙여넣기 · 음성) 그 메시지 null. 1분 넘게 백그라운드 null.
- 기기 종류: 웹 = `pc`, 앱 = `phone`(interview_start p_device) → 서버가 PC 는 pace null. 스크린리더가 켜져 있으면 null 로 보냄.

## 4. 모션 · 모양
- 말풍선 · 카드: D42 2안 일상 `scene2.bubble`(아래 6 → 240ms, edOut). 동작 줄이기면 투명도만(motion `Rise`). 입력 중 점 3개 = 900ms 투명도만, 동작 줄이기면 가운데만 진하게 멈춤.
- 머리 아래 섹션 이름은 바뀔 때 150ms 투명도.
- 모양: AI = accentSoft 원 32 '결' + bubbleAi 말풍선(위 왼쪽 6) · 나 = accentAlt 알약 · 큰 부품은 흰 카드(bg · line 1 · 둥글기 16) · 정리 중 그림 = D42 `organizing` 장면.

## 5. 서버 이름 맞출 곳(가정 · 미확인)
| # | 앱이 가정한 것 | 서버(0033 · Edge) 지금 | 넘길 곳 |
|---|---|---|---|
| 1 | `get_interview_summary` 응답에 `style_chips`(갈래 코드 deliberate · warm · candid, 숫자 0) | 없음 → 앱은 칩 줄을 그리지 않음 | 팀장 → 백엔드 · AI(분석 style 숫자 → 갈래 코드) |
| 2 | 사실 칸 `facts` 가 `{T01: 글}` 또는 `{T01: {text, turns}}` | 암호화 jsonb(모양 미확인) — 둘 다 읽음 | 백엔드 확인 |
| 3 | CK16 동의 판 `consent-2026.10.23-가정` | 법무 V6-L 판 미정 | 법무 |
| 4 | 앱 쪽 예비 질문(통신 실패 때) — 그 턴 글은 서버에 저장 안 됐을 수 있음 | Edge 는 자기 실패만 예비 질문 | 팀장 판단(다음 턴에 다시 보내기 여부) |

## 6. 영향 · 남은 것
- 데모는 스위치 켜짐 → 데모 웹 `/survey/01` 이 대화형 시작으로 바뀜. **web-f2l A · B**(데모 `/survey/01` = 설문 v2 시작 가정)는 바뀐 화면을 보게 됨 — 팀장 판단(f2l 을 `/survey/v2` 로 한 줄 바꾸거나 데모 장면 키). 다른 web-f* 는 데모 건너뛰기 줄만 써서 그대로(대화형 아래에도 붙음).
- 시안 '키 슬라이더'는 설문 v2 의 [−] 값 [+] 부품을 그대로 썼다(재사용 지시).
- `theme/illustrations.ts` 의 `organizing` 주석 '자리 없음'은 이제 쓰는 곳이 생김 — 주석 고치기는 디자인 몫.
- '늦음' 기준 6초(ai/V6 iv.slow) — 카피 메모는 8초 가정. 바꾸려면 `deps.SLOW_MS` 한 곳.

## 7. 점검 결과(10-26)
| 점검 | 결과 |
|---|---|
| tsc | 0 |
| eslint(expo lint) | 0 |
| jest 전체 | 81 묶음 · 1,538 통과(새 31: 저장 키 대조 · CK16 없이 행동 숫자 0 · 25턴 · 이어하기 1부 · 2부 · 고치기 · 늦음 · 통신 실패 · 스위치 꺼짐 · 07 고치기 · 계산기 한글 조합 등) |
| check:copy | 통과 96 · 실패 0(새 W 2) |
| check:tokens · check:grade | 통과 |
| web-v6f 390 · 360 · 동작 줄이기 | 26/26 · 26/26 · 26/26 |
| web-ime(회귀) | 16/16 |
| web-f2l(회귀) | A · B 실패 — 6장 첫 줄(데모 /survey/01 이 대화형으로 바뀜, 예상된 영향) |
- 웹에서 고친 것: RN-web 의 스크린리더 값이 늘 참이라 웹은 그 검사를 빼고(기기 앱만), 보내기 원은 누르는 면 48(보이는 원 40), 데모 공유 메모리를 설문 v2 모의 서버와 같게(검토 화면이 같은 답을 봄).

## 8. 팀장 결정 반영 (D-186 · D-187, 10-26)
| # | 결정 | 한 것 |
|---|---|---|
| ① | web-f2l 은 v2 화면 점검 → `/survey/v2` 로 | `scripts/web-f2l.mjs` 고침(허락). **전**: 동의 뒤 `/survey/01` 에서 v2 시작 안내 · 데모 건너뛰기 줄을 기대(A). **후**: `/survey/01`(데모 = 대화형)이 뜨면 로그인을 지닌 채 화면 안 이동(history.pushState + popstate)으로 `/survey/v2`, A 는 '/survey/v2 = v2 시작 안내'(건너뛰기 줄은 v2 주소에 없어 뺌). B 이후 그대로 |
| ② | 못 보낸 턴 글은 기기에 잠시 → 다음 턴 앞에 한 번 다시 · 두 번 실패면 '보내지 못한 글' + 다시 보내기 | 기기 메모리(`pending`, 저장소 0)에 한 개. 다음 턴 앞에 같은 `turn` 번호로 다시 보냄 → 또 실패면 그 말풍선 아래 '보내지 못한 글' · [다시 보내기](새 번호로). 새 글 2개(카피.md 13장 · D-186) |
| D-187 | 요청에 `turn`(몇 번째 답) · 같은 번호면 서버가 저장 없이 그 턴 AI 말(`duplicate: true`) · 앞지르면 400 | 앱은 서버가 확인한 수 + 1 을 `turn` 으로 보낸다. 다시 보낸 턴이 duplicate 면 그 AI 말을 그 글 뒤(지금 말풍선 앞)에 이어 붙임 · 새로 받은 턴이면 답은 버림(대화는 예비 질문으로 이어 감). 데모 모의 서버도 같은 규칙(+ 시험 옵션 failTurns · dropReplies) |
| ③ | CK16 판 | `consent-2026.10.26-v1` |
| ④ | 늦음 6초 유지 | 카피.md 13장에 메모 한 줄(8초 가정 → 6초) |
| style_chips | 서버가 갈래 코드를 주는 지금 방식 유지 | 그대로(앱 카피가 글을 붙임) |

- 남은 가장자리(보고): 다시 보낸 글이 두 번 다 실패했는데 실제로는 서버가 받았던 경우, 다음 새 글이 같은 번호로 가서 duplicate 로 돌아올 수 있음 — 그때도 AI 말을 이어 붙여 멈춤은 0. 드문 경우라 따로 막지 않음
- 시험 더함 3: 다시 보내기 성공(새로 받음) · duplicate 이어 붙임 · 두 번 실패 → 보내지 못한 글 → 다시 보내기. jest 1,541 통과
