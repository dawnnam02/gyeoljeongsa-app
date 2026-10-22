// 데모 모드 모의 서버가 돌려주는 AI 결과 한 건. ai/시험/mock_20.json 의 첫 번째 사례(clean) 출력에서 traits · tags · summary · evidence 를 그대로 옮겼다
// (시험 demoAi.test.ts 가 원본과 같은지 본다). Claude 를 부르지 않은 모의 값이다.
export const DEMO_AI_RESULT = {
  "traits": {
    "extraversion": 12,
    "planning": 74,
    "family": 92,
    "economy": 77,
    "conflict": 71
  },
  "tags": [
    "가족 중심",
    "조용한 편",
    "함께 모으기",
    "꼼꼼함",
    "맞벌이 선호"
  ],
  "summary": "가정을 삶의 중심에 두고 조용히 보내는 시간을 소중하게 여겨요. 맞벌이를 원하고 결혼 후에는 돈을 합쳐서 함께 관리하고 싶어요. 갈등이 생기면 바로 대화로 풀려고 하고 계획을 세우고 지키는 편이에요.",
  "evidence": {
    "extraversion": [
      "E08",
      "E11"
    ],
    "planning": [
      "E09",
      "E12"
    ],
    "family": [
      "E04",
      "E05",
      "E13",
      "T01",
      "T02"
    ],
    "economy": [
      "E03",
      "E07",
      "E13"
    ],
    "conflict": [
      "E10",
      "T02"
    ]
  }
} as const;

// 직접 입력 모드의 처음값(모의). 실제 서버는 설문 답으로 계산한 값을 준다(ai/설계.md 9-3)
export const DEMO_MANUAL_INITIAL = { extraversion: 30, planning: 70, family: 80, economy: 60, conflict: 70 } as const;
