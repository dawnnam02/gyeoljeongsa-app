// 3부-자 공통(ⓒ) — onLayout 폭 0 꼴 전수 · 터치 48 × 48 글자 버튼 · 줄 끝 규칙은 jest 밖(Python)이라 여기서 안 본다.
//  react-native-web 0.21 은 요소가 처음 붙을 때 onLayout 이 있어야 크기를 지켜본다(useElementLayout 이 [ref, observer] 로만 관찰을 시작).
//  그래서 '불러오는 중' 칸이 같은 자리 같은 종류 View 로 이어지다 onLayout 이 나중에 생기면 폭이 영영 0 으로 남는다(기내지 쪽 폭 QP-Q2). 고침 = 새로 붙이기(key) 또는 처음부터 onLayout.
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');
const code = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(path.join(dir, e.name))) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []));
const files = walk(SRC);

// 화면 크기를 onLayout 으로 재는 곳 — 새로 생기면 이 목록을 고치며 위 규칙을 지켰는지 본다(전수 확인 10-29: 아래 8곳은 처음 붙을 때부터 onLayout 이 함수 · 기내지만 key 로 새로 붙임)
const KNOWN = [
  'components/BottomSheet.tsx',
  'components/Screen.tsx',
  'features/ai/TraitBar.tsx',
  'features/inflight/MagazineScreen.tsx',
  'features/recs/CandidateScreen.tsx',
  'features/splash/AppSplash.tsx',
  'features/surveyV2/PoliticsSlider.tsx',
  'hooks/useScrollCue.ts',
];

describe('onLayout 폭 0 꼴 전수(3부-자 ⓒ)', () => {
  test('onLayout 을 쓰는 파일 = 확인한 목록 그대로(새 곳이 생기면 규칙을 지켰는지 보고 목록에 더한다)', () => {
    const using = files.filter((f) => /\bonLayout\b/.test(code(path.relative(SRC, f)))).map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(using.sort()).toEqual([...KNOWN].sort());
  });

  test('onLayout 값이 조건식이 아니다(처음엔 없다가 나중에 생기는 꼴 0) — onLayout={cond ? fn : undefined} · onLayout={a && fn}', () => {
    const bad: string[] = [];
    for (const f of files) {
      const rel = path.relative(SRC, f).split(path.sep).join('/');
      for (const m of code(rel).matchAll(/onLayout=\{([^}]*)\}/g)) if (/\?|&&|\|\||undefined|null/.test(m[1])) bad.push(`${rel}: onLayout={${m[1].trim()}}`);
    }
    expect(bad).toEqual([]);
  });

  test('기내지 쪽 칸: onLayout 을 단 View 를 key 로 새로 붙인다(불러오는 중 칸을 이어 쓰지 않음)', () => {
    const t = code('features/inflight/MagazineScreen.tsx');
    expect(t).toMatch(/<View key="mag-pages" style=\{if2Styles\.flex\} onLayout=\{onLayout\}>/);
    // 불러오는 중 · 없음 · 닫힘 화면은 다른 View 라 위 칸과 이어지지 않는다
    expect(t).toMatch(/if \(!issued\) \{[\s\S]*?testID="screen-mag"[\s\S]*?\}\n/);
  });

  test('타입 엽서 앞면 · 짐 싸기는 onLayout 으로 크기를 재지 않는다(퍼센트 칸 + 비율)', () => {
    expect(code('features/inflight/TypeCardScreen.tsx')).not.toMatch(/onLayout|measure\(/);
  });
});

describe('글자 버튼 터치 48 × 48(QP-40 공통)', () => {
  test('TextButton 은 가로 · 세로 모두 최소 touchMin', () => {
    const t = code('components/TextButton.tsx');
    expect(t).toMatch(/minHeight: size\.touchMin, minWidth: size\.touchMin/);
  });
});
