// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// 최종 청사진 F-3(색 · 글자는 tokens.ts 만) · F-4(개인정보 로그 0)를 린트로 막는다.
const noHardcodedStyle = [
  {
    selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
    message: '색을 직접 쓰지 않는다. src/theme/tokens.ts 의 colors 를 쓴다(F-3).',
  },
  {
    selector: 'Literal[value=/^(rgb|hsl)a?[(]/]',
    message: '색을 직접 쓰지 않는다. 투명도는 src/theme/color.ts 의 withAlpha 로 만든다(F-3).',
  },
  {
    selector: "Property[key.name='fontWeight']",
    message: '굵기는 fontWeight 가 아니라 글꼴 파일(font.regular · medium · bold)로 정한다(가이드 2장).',
  },
];

// 누르는 모든 것(버튼 · 카드 · 탭)은 공통 Pressable 하나로 눌린다(팀장 지시 2026-10-14, 디자인 D10).
const pressableOnly = {
  paths: [
    {
      name: 'react-native',
      importNames: ['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback'],
      message: '누르는 것은 src/components/Pressable.tsx 의 Pressable 을 쓴다(누름 효과 규격).',
    },
  ],
};

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error', // 로그는 src/lib/log.ts 의 safeLog 하나로만(보안/구성.md 8-1)
      'no-restricted-syntax': ['error', ...noHardcodedStyle],
      'no-restricted-imports': ['error', pressableOnly],
    },
  },
  {
    // 토큰을 정의하고 토큰에서 파생하는 자리
    files: ['src/theme/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // 공통 Pressable 은 react-native 의 Pressable 을 감싸는 곳이라 예외
    files: ['src/components/Pressable.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // AIT-F ②: src/server/ait 의 파일은 ai/AIT/ts 원본을 scripts/sync-ait.mjs 로 그대로 복사한 것이라 앱 쪽 스타일 규칙을 걸지 않는다(원본 수정 0 — 고칠 게 있으면 AI 직원에게 넘김)
    files: ['src/server/ait/**/*.ts'],
    rules: { 'import/export': 'off', '@typescript-eslint/array-type': 'off', '@typescript-eslint/no-unused-vars': 'off' }, // IF5-QF2: 원본이 안 쓰는 가져오기(CRISIS_CARD 등)가 남은 채 복사돼도 경고를 내지 않는다(원본 수정 0)
  },
  {
    // IF5-F1: src/saju5 의 파일은 ai/IF5/ts 원본을 scripts/sync-if5.mjs 로 복사한 것이라(경로 · JSON 가져오기 꼴만 바꿈) 앱 쪽 스타일 규칙을 걸지 않는다(원본 수정 0 — 고칠 게 있으면 AI 직원에게 넘김)
    // IF5-F2 ⑯: src/server/saju5 도 같은 원본 복사본(서버 전용 AI 요청 모듈) — handler5.ts 는 앱이 따로 쓰는 파일이지만 같은 규칙을 얹는다
    files: ['src/saju5/**/*.ts', 'src/server/saju5/**/*.ts'],
    rules: { 'import/export': 'off', 'import/first': 'off', '@typescript-eslint/array-type': 'off', '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': 'off' },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
]);
