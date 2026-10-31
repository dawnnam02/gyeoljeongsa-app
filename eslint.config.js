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
    rules: { 'import/export': 'off', '@typescript-eslint/array-type': 'off' },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
]);
