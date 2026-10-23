// 파일 내용으로 바로 확인하는 규칙들. 화면이 늘어도 어겨지지 않게 npm test 에 넣어 둔다.
//  F0 통과 조건 7(등급 · 점수 필드 없음) · 8(앱 이름 · 번들 ID)
//  최종 청사진 F-8(app.json · eas.json) · 보안 점검표 A-13(백업 끔) · E-01(EXPO_PUBLIC_ 셋뿐: 주소 · 키 · 데모 표시) · F-01(https만) · E-02(.env 제외)
import fs from 'node:fs';
import path from 'node:path';

import { testOutside } from './helpers/outsideDocs';

const APP_DIR = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(APP_DIR, 'src');

const read = (...parts: string[]) => fs.readFileSync(path.join(APP_DIR, ...parts), 'utf8');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

// 시험 파일은 검사 대상이 아니다(규칙 글자를 시험 코드에 적어야 하므로).
const appSources = walk(SRC_DIR).filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`));

type AppJson = {
  expo: {
    name: string;
    slug: string;
    scheme: string;
    icon: string;
    userInterfaceStyle: string;
    ios: { bundleIdentifier: string; infoPlist: Record<string, string> };
    android: {
      package: string;
      allowBackup: boolean;
      adaptiveIcon: { foregroundImage: string; backgroundImage?: string; monochromeImage?: string; backgroundColor: string };
    };
    web: { favicon: string; output: string; lang: string };
    plugins: unknown[];
  };
};
const appJson = JSON.parse(read('app.json')) as AppJson;

// PNG 머리: 너비 · 높이 · 색 종류(2 = RGB 알파 없음, 6 = RGBA)
function pngInfo(relativePath: string) {
  const bytes = fs.readFileSync(path.join(APP_DIR, relativePath));
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

// F0 조건 7(등급 · 점수 필드 없음)은 F13 조건 6 에서 등급 기능에 맞게 정리했다(등급 구독 · 내 등급 · 상대 배지가 들어왔다, 청사진 Q6 · D-56).
//  · 점수 값은 어디에도 없다: rating · score 는 src 어디에도 없다(총 원점수 · 추천 점수 · 외모 점수는 받지도 보이지도 않는다)
//  · 등급(grade)은 등급 기능 파일에서만: 허용 목록 밖 파일에 grade 가 나오면 실패한다. 새 파일이 grade 를 쓰면 이 목록에 넣고 이유를 적는다
//  · 화면 글의 '등급 · 점수' 허용 구역은 scripts/check-copy.mjs S 그룹과 화면 시험이 지킨다(카피.md 16-J)
const GRADE_ALLOWED_FILES = [
  'lib/gradeApi.ts', // get_my_grade · get_partner_grade · list_grade_history · request_grade_access · set_grade_processing
  'lib/shopApi.ts', // get_shop_state 등: 상품 키 grade_sub_1m 등
  'lib/shopDemo.ts', // 데모 모드 모의 서버(16 상점 · 등급)
  'lib/demoRecs.ts', // 모의 서버 09 · 10: 구독자 순서 · 상대 등급 배지
  'lib/demoBackend.ts', // 모의 서버 연결
  'demo/people.ts', // F24 데모 인물 24명: 서버가 가진 등급 값(1~9) 흉내 · 끼리끼리 순서. 화면에는 지금 규칙대로(구독자 + CK10)만
  'lib/recsApi.ts', // 09 · 10 응답의 grade_no 읽기
  'lib/services.ts', // gradeApi 연결
  'lib/settingsApi.ts', // 12 등급 계산 멈추기 · 내 등급 보이기(CK10)
  'lib/settingsDemo.ts', // 모의 서버 12
  'content/shopCopy.ts', // 16 상점 · 등급 화면 글 묶음 이름
  'config/gradeConsent.ts', // CK10 내 등급 보이기 문구 판
  'store/gradeSettingsStore.ts', // 12 등급 계산 멈추기 스위치 값
  'features/settings/GradeSwitches.tsx', // 12 내 등급 보이기 · 등급 계산 멈추기
  'features/settings/SettingsScreen.tsx', // 12: 등급 스위치 · 탈퇴 확인창 구독 안내 연결
  'features/recs/RecommendationsScreen.tsx', // 09 등급 배지(gradeNo)
  'features/recs/CandidateScreen.tsx', // 10 상대 등급
];
const GRADE_ALLOWED_DIRS = ['features/shop/', 'features/grade/'];
const rel = (file: string) => path.relative(SRC_DIR, file).split(path.sep).join('/');
const gradeAllowed = (file: string) => GRADE_ALLOWED_FILES.includes(rel(file)) || GRADE_ALLOWED_DIRS.some((dir) => rel(file).startsWith(dir));

describe('F13 조건 6: 등급 말은 등급 기능 파일에서만, 점수 값은 어디에도 없다 (청사진 Q6, K2 R2, 카피 16-J)', () => {
  test('src/types 에 grade · rating · score 가 없다', () => {
    const typeFiles = walk(path.join(SRC_DIR, 'types'));
    expect(typeFiles.length).toBeGreaterThan(0);
    for (const file of typeFiles) expect(fs.readFileSync(file, 'utf8')).not.toMatch(/grade|rating|score/i);
  });

  test('rating · score 는 화면 · 컴포넌트 · 저장소 · 모의 서버 코드 어디에도 없다(점수 값 노출 금지는 그대로)', () => {
    // 서버 상품 키 'score_view'(X6)는 데모 시드의 이름일 뿐 값이 아니다. 그 한 낱말만 빼고 본다
    const hits = appSources.filter((file) => /rating|score/i.test(fs.readFileSync(file, 'utf8').replace(/score_view/g, '')));
    expect(hits.map(rel)).toEqual([]);
  });

  test('grade 는 등급 기능 파일(허용 목록 · 등급 폴더)에만 있다', () => {
    const hits = appSources.filter((file) => /grade/i.test(fs.readFileSync(file, 'utf8')) && !gradeAllowed(file));
    expect(hits.map(rel)).toEqual([]);
  });

  test('허용 목록의 파일이 모두 실제로 있다(낡은 목록 방지)', () => {
    for (const file of GRADE_ALLOWED_FILES) expect(fs.existsSync(path.join(SRC_DIR, ...file.split('/')))).toBe(true);
  });

  test('09 · 10 응답 읽기는 등급 번호 하나(grade_no)만 아는 키로 둔다: 점수 · 순위 · 퍼센트 키 이름이 코드에 없다', () => {
    const recs = fs.readFileSync(path.join(SRC_DIR, 'lib', 'recsApi.ts'), 'utf8');
    expect(recs).not.toMatch(/percent|rank/i);
  });
});

describe('F0 조건 8 · F-8: app.json', () => {
  test('앱 이름은 결정사, 번들 ID는 com.gyeoljeongsa.app (D-13 가정)', () => {
    expect(appJson.expo.name).toBe('결정사');
    expect(appJson.expo.slug).toBe('gyeoljeongsa');
    expect(appJson.expo.scheme).toBe('gyeoljeongsa');
    expect(appJson.expo.ios.bundleIdentifier).toBe('com.gyeoljeongsa.app');
    expect(appJson.expo.android.package).toBe('com.gyeoljeongsa.app');
  });

  test('app.json 이 가리키는 그림 파일이 모두 있다', () => {
    const paths: string[] = [];
    (function collect(node: unknown) {
      if (typeof node === 'string') {
        if (node.startsWith('./')) paths.push(node);
      } else if (node && typeof node === 'object') Object.values(node).forEach(collect);
    })(appJson);
    expect(paths.length).toBeGreaterThanOrEqual(5);
    for (const p of paths) expect(fs.existsSync(path.join(APP_DIR, p))).toBe(true);
  });

  test('아이콘 규격: iOS 1024 정사각 알파 없음 · Android 전경 1024 알파 있음 · 배경 1024', () => {
    expect(pngInfo(appJson.expo.icon)).toEqual({ width: 1024, height: 1024, colorType: 2 });
    expect(pngInfo(appJson.expo.android.adaptiveIcon.foregroundImage)).toEqual({ width: 1024, height: 1024, colorType: 6 });
    const background = appJson.expo.android.adaptiveIcon.backgroundImage;
    expect(background).toBeDefined();
    expect(pngInfo(background as string)).toMatchObject({ width: 1024, height: 1024 });
    expect(appJson.expo.android.adaptiveIcon.monochromeImage).toBe('./assets/icon/adaptive-monochrome.png'); // Android 테마 아이콘(F17)
    expect(pngInfo(appJson.expo.android.adaptiveIcon.monochromeImage as string)).toEqual({ width: 1024, height: 1024, colorType: 6 });
  });

  test('권한 문구는 한국어이고 사진 문구는 법무 확정 문구(동의문구 5-4)와 같다', () => {
    const { infoPlist } = appJson.expo.ios;
    expect(infoPlist.NSPhotoLibraryUsageDescription).toBe('사진을 고르려면 사진 접근 권한이 필요해요. 올리려고 고른 사진만 사용해요.');
    for (const key of ['NSPhotoLibraryUsageDescription', 'NSCameraUsageDescription']) {
      expect(infoPlist[key]).toMatch(/[가-힣]/);
      expect(infoPlist[key]).not.toMatch(/[A-Za-z]{4,}/); // 영어 문장이 섞이지 않는다
    }
  });

  test('A-13: Android 자동 백업을 끈다 (SecureStore 복원 오류 방지)', () => {
    expect(appJson.expo.android.allowBackup).toBe(false);
  });

  test('화면 방향 세로 · 라이트 하나(다크 색은 가이드에 없음)', () => {
    expect(appJson.expo.userInterfaceStyle).toBe('light');
  });

  test('웹: 정적 호스팅용 단일 페이지(single)이고 문서 언어는 ko 이다(테스트웹 TW1, 2026-10-14)', () => {
    expect(appJson.expo.web.output).toBe('single');
    expect(appJson.expo.web.lang).toBe('ko');
  });
});

describe('F-8: eas.json', () => {
  const eas = JSON.parse(read('eas.json')) as {
    cli: { appVersionSource: string };
    build: Record<string, unknown>;
    submit: Record<string, unknown>;
  };

  test('빌드 프로필 셋(development · preview · production)과 제출 production 이 있다', () => {
    expect(Object.keys(eas.build).sort()).toEqual(['development', 'preview', 'production']);
    expect(Object.keys(eas.submit)).toEqual(['production']);
    expect(eas.cli.appVersionSource).toBe('local');
  });

  test('비밀이 들어 있지 않다(스토어 계정 · 키 이름 없음)', () => {
    expect(read('eas.json')).not.toMatch(/appleId|ascAppId|serviceAccountKeyPath|password|secret|token/i);
  });
});

describe('보안 점검표 E-01 · F-01 · E-02', () => {
  // 서버 접속용 둘 + 데모 모드 켬/끔 표시 하나(2026-10-14 팀장 결정, 테스트웹 TW1). 점검표 E-01 의 기대값을 이 셋으로 고친다(SEC2).
  const NAMES = ['EXPO_PUBLIC_DEMO_MODE', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_URL'];
  const scanned = [
    ...appSources.map((file) => fs.readFileSync(file, 'utf8')),
    read('app.json'),
    read('eas.json'),
    read('package.json'),
    read('.env.example'),
  ];

  test('E-01: EXPO_PUBLIC_ 변수는 주소 · publishable 키 · 데모 표시 셋뿐이다(비밀 없음)', () => {
    const found = new Set(scanned.flatMap((text) => text.match(/EXPO_PUBLIC_[A-Z0-9_]+/g) ?? []));
    expect([...found].sort()).toEqual(NAMES);
  });

  test('.env.example 에는 이름만 있고 값이 없다', () => {
    const lines = read('.env.example').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line));
    expect(lines.map((line) => line.split('=')[0]).sort()).toEqual(NAMES);
    for (const line of lines) expect(line.split('=')[1]).toBe('');
  });

  test('F-01: 앱 코드에 http:// 가 없다(https만)', () => {
    const hits = appSources.filter((file) => fs.readFileSync(file, 'utf8').includes('http://'));
    expect(hits).toEqual([]);
  });

  test('앱 코드 · 설정 파일에 secret · service 키 모양이 없다', () => {
    const patterns = [new RegExp('sb_' + 'secret_'), new RegExp('service' + '_role', 'i'), new RegExp('eyJ[A-Za-z0-9_-]{20,}')];
    for (const text of scanned) for (const pattern of patterns) expect(text).not.toMatch(pattern);
  });

  test('E-02: .gitignore 가 .env 와 node_modules 를 제외하고 .env.example 은 올린다', () => {
    const ignore = read('.gitignore').split(/\r?\n/).map((line) => line.trim());
    expect(ignore).toEqual(expect.arrayContaining(['node_modules/', '.env', '.env.*', '!.env.example']));
  });

  test('로그는 safeLog 하나로만: console 은 src/lib/log.ts 에만 있다', () => {
    const hits = appSources.filter((file) => /\bconsole\./.test(fs.readFileSync(file, 'utf8')));
    expect(hits.map((file) => path.relative(SRC_DIR, file).split(path.sep).join('/'))).toEqual(['lib/log.ts']);
  });
});

describe('누르는 효과 · 탭바 (팀장 지시 2026-10-14, 디자인 D10)', () => {
  const rel = (file: string) => path.relative(SRC_DIR, file).split(path.sep).join('/');
  const tabsLayout = fs.readFileSync(path.join(SRC_DIR, 'app', '(tabs)', '_layout.tsx'), 'utf8');
  const tabIcons = fs.readFileSync(path.join(SRC_DIR, 'theme', 'tabIcons.ts'), 'utf8');

  test('버튼 · 카드 · 탭은 공통 Pressable 로만 누른다: react-native 의 Pressable · Touchable* 를 가져오는 파일은 하나뿐', () => {
    const importer = /import\s*(?:type\s*)?\{[^}]*\b(?:Pressable|Touchable\w+)\b[^}]*\}\s*from\s*['"]react-native['"]/;
    const hits = appSources.filter((file) => importer.test(fs.readFileSync(file, 'utf8')));
    expect(hits.map(rel)).toEqual(['components/Pressable.tsx']);
  });

  test('탭바의 각 칸도 공통 Pressable 이다(tabBarButton → TabBarButton, ripple 만)', () => {
    expect(tabsLayout).toContain('tabBarButton: (props) => <TabBarButton tab={name} {...props} />');
    const button = fs.readFileSync(path.join(SRC_DIR, 'components', 'TabBarButton.tsx'), 'utf8');
    expect(button).toContain("from './Pressable'");
    expect(button).toContain('effect="ripple"'); // 가이드 10-3: 탭 칸은 ripple 만
  });

  test('현재 탭은 채움 아이콘 + 라벨 Bold(captionBold 토큰) 브랜드색, 나머지는 Regular 회색 토큰이다', () => {
    const parts = fs.readFileSync(path.join(SRC_DIR, 'components', 'TabBarParts.tsx'), 'utf8');
    expect(parts).toContain("variant={active ? 'captionBold' : 'caption'}");
    expect(parts).toContain("tone={active ? 'accent' : 'sub'}");
    expect(parts).toContain('active ? TAB_ICONS[name].active : TAB_ICONS[name].inactive');
    expect(tabsLayout).toContain('tabBarIcon: () => <TabIcon name={name} />');
    expect(tabsLayout).toContain('tabBarLabel: () => <TabLabel name={name} title={title} />');
    expect(tabsLayout).not.toContain('captionMedium'); // 가이드 5장의 '활성 Medium'은 Bold 로 바뀌었다
  });

  test('탭 아이콘 파일 8개가 모두 있고 512×512 PNG(알파 있음)이다', () => {
    const files = [...tabIcons.matchAll(/require\('([^']+)'\)/g)].map((m) => path.resolve(SRC_DIR, 'theme', m[1]));
    expect(files).toHaveLength(8);
    for (const file of files) {
      const bytes = fs.readFileSync(file);
      expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20), bytes[25]]).toEqual([512, 512, 6]);
    }
  });

  // 디자인 폴더가 옆에 있을 때만 비교한다(앱만 따로 떼어 두면 건너뛴다). 원본이 바뀌면 다시 복사해야 한다.
  testOutside(['디자인/아이콘/탭바'])('앱에 복사한 탭 아이콘 8개가 디자인 원본(디자인/아이콘/탭바)과 바이트까지 같다', () => {
    const designDir = path.resolve(APP_DIR, '..', '디자인', '아이콘', '탭바');
    if (!fs.existsSync(designDir)) return;
    const pairs: Record<string, string> = {
      '01_추천_활성_채움': 'recommend-on-filled',
      '01_추천_비활성': 'recommend-off',
      '02_호감_활성_채움': 'likes-on-filled',
      '02_호감_비활성': 'likes-off',
      '03_상점_활성_채움': 'shop-on-filled', // D19 A1 · A2 (프로필 탭은 빠지고 상점이 들어왔다, F11)
      '03_상점_비활성': 'shop-off',
      '04_설정_활성_채움': 'settings-on-filled',
      '04_설정_비활성': 'settings-off',
    };
    for (const [designName, appName] of Object.entries(pairs)) {
      const original = fs.readFileSync(path.join(designDir, designName + '.png'));
      const copy = fs.readFileSync(path.join(APP_DIR, 'assets', 'icons', 'tab', appName + '.png'));
      expect(copy.equals(original)).toBe(true);
    }
    expect([...tabIcons.matchAll(/require\('[^']*-on-filled\.png'\)/g)]).toHaveLength(4); // 현재 탭은 채움 아이콘
  });
});

describe('05 사진 칸 카메라 아이콘 (본인 지시 · 팀장 결정 2026-10-14: A안 정리본)', () => {
  const photoIcons = fs.readFileSync(path.join(SRC_DIR, 'theme', 'photoIcons.ts'), 'utf8');

  test('theme/photoIcons.ts 가 색변형/06_카메라추가_보조 복사본(512×512 PNG, 알파 있음)을 가리킨다', () => {
    const match = /require\('([^']+)'\)/.exec(photoIcons);
    expect(match?.[1]).toBe('../../assets/icons/photo/camera-add-sub.png');
    const bytes = fs.readFileSync(path.resolve(SRC_DIR, 'theme', match?.[1] ?? ''));
    expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20), bytes[25]]).toEqual([512, 512, 6]);
  });

  testOutside(['디자인/아이콘/색변형/06_카메라추가_보조.png'])('디자인 원본(디자인/아이콘/색변형/06_카메라추가_보조.png)과 바이트까지 같다', () => {
    const original = path.resolve(APP_DIR, '..', '디자인', '아이콘', '색변형', '06_카메라추가_보조.png');
    if (!fs.existsSync(original)) return; // 디자인 폴더가 옆에 없으면 건너뛴다
    const copy = fs.readFileSync(path.join(APP_DIR, 'assets', 'icons', 'photo', 'camera-add-sub.png'));
    expect(copy.equals(fs.readFileSync(original))).toBe(true);
  });
});

describe('F1: 01 온보딩 · 02 가입 · 03 동의 · 15 인증 실패', () => {
  const routeSource = (name: string) => fs.readFileSync(path.join(SRC_DIR, 'app', name), 'utf8');
  const pngSize = (file: string) => {
    const bytes = fs.readFileSync(file);
    expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20), bytes[25]];
  };

  test('본문이 있는 화면(01 · 02 · 03 · 15 · 04 · 05 임시판)은 자리 표시 화면이 아니고 features/ 의 본문을 쓴다', () => {
    for (const file of ['onboarding.tsx', 'sign-in.tsx', 'consent.tsx', 'sign-in-code-error.tsx', 'survey/[step].tsx', 'photos.tsx']) {
      const source = routeSource(file);
      expect(source).not.toContain('ScreenPlaceholder');
      expect(source).toContain('@/features/');
    }
  });

  test('앱에 복사한 UI 아이콘(뒤로 · 체크 · 닫기)은 512×512 PNG(알파 있음)이고 디자인 원본과 바이트까지 같다', () => {
    const pairs: Record<string, string> = { back: '05_뒤로가기', check: '07_체크', close: '08_닫기' };
    for (const [appName, designName] of Object.entries(pairs)) {
      const copy = path.join(APP_DIR, 'assets', 'icons', 'ui', `${appName}.png`);
      expect(pngSize(copy)).toEqual([512, 512, 6]);
      const original = path.resolve(APP_DIR, '..', '디자인', '아이콘', '투명', `${designName}.png`);
      if (fs.existsSync(original)) expect(fs.readFileSync(copy).equals(fs.readFileSync(original))).toBe(true); // 디자인 폴더가 옆에 있을 때만 비교한다
    }
  });

  test('최종 로고(D17 A1~A6): 가로 로고 여백 없는 판 1244×544 투명 · 심볼 · 앱 아이콘 · adaptive 전경/배경 · 파비콘이 디자인 원본과 바이트까지 같고, 화면 높이는 폭 ÷ 2.287', () => {
    const DESIGN = path.resolve(APP_DIR, '..', '디자인', '로고', '최종');
    const pairs: [string, string, [number, number, number]][] = [
      ['logo/wordmark.png', '결정사_로고_가로_tight.png', [622, 272, 6]],
      ['logo/wordmark@2x.png', '결정사_로고_가로_2x_tight.png', [1244, 544, 6]],
      ['logo/wordmark@3x.png', '결정사_로고_가로_3x_tight.png', [1866, 816, 6]],
      ['icon/symbol.png', '결정사_심볼.png', [1200, 1200, 6]],
      ['icon/app-icon.png', '결정사_앱아이콘_1024.png', [1024, 1024, 2]],
      ['icon/adaptive-foreground.png', '결정사_앱아이콘_adaptive_전경_1024.png', [1024, 1024, 6]],
      ['icon/adaptive-background.png', '결정사_앱아이콘_adaptive_배경_1024.png', [1024, 1024, 2]],
      ['icon/adaptive-monochrome.png', '결정사_앱아이콘_adaptive_단색_1024.png', [1024, 1024, 6]], // Android 13 테마 아이콘(F17, app.json monochromeImage)
      ['icon/favicon.png', '결정사_파비콘_48.png', [48, 48, 6]],
    ];
    for (const [app, design, size] of pairs) {
      const copy = path.join(APP_DIR, 'assets', app);
      expect(pngSize(copy)).toEqual(size);
      const original = path.join(DESIGN, design);
      if (fs.existsSync(original)) expect(fs.readFileSync(copy).equals(fs.readFileSync(original))).toBe(true);
    }
    const layoutSource = fs.readFileSync(path.join(SRC_DIR, 'theme', 'layout.ts'), 'utf8');
    expect(layoutSource).toContain('WORDMARK_PX = { w: 622, h: 272 }');
  });

  test('theme/uiAssets.ts 가 복사한 파일을 가리킨다', () => {
    const source = fs.readFileSync(path.join(SRC_DIR, 'theme', 'uiAssets.ts'), 'utf8');
    for (const file of ['icons/ui/back.png', 'icons/ui/check.png', 'icons/ui/close.png', 'logo/wordmark.png']) {
      expect(source).toContain(`../../assets/${file}`);
      expect(fs.existsSync(path.join(APP_DIR, 'assets', file))).toBe(true);
    }
  });

  test('법무 확정 문구를 화면 코드에 옮겨 적지 않았다: "[필수] ~" · "[선택] ~" 글은 src/content 의 생성 파일에만 있다', () => {
    const literal = /['"`]\[(필수|선택)\]/;
    const hits = appSources.filter((file) => literal.test(fs.readFileSync(file, 'utf8'))).map((file) => path.relative(SRC_DIR, file).split(path.sep).join('/'));
    expect(hits).toEqual(['content/consentContent.ts']);
  });

  test('글 점검 · 법무 문서 옮기기 명령이 npm 스크립트로 있고 npm run check 에 글 점검이 든다', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['check:copy']).toContain('scripts/check-copy.mjs');
    expect(pkg.scripts['gen:legal']).toContain('scripts/gen-legal-content.mjs');
    expect(pkg.scripts.check).toContain('npm run check:copy');
    for (const file of ['scripts/check-copy.mjs', 'scripts/gen-legal-content.mjs', 'scripts/lib/legal-source.mjs', 'scripts/lib/legal-output.mjs']) expect(fs.existsSync(path.join(APP_DIR, file))).toBe(true);
  });

  test('서버 함수 이름은 앱 코드에서 otp-gate · underage-reject 로 부르고 Supabase Auth 의 /otp 를 직접 부르지 않는다(관문 우회 금지, 보안/구성.md 3-3)', () => {
    const joined = appSources.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(joined).toContain("'otp-gate'");
    expect(joined).toContain("'underage-reject'");
    expect(joined).not.toMatch(/signInWithOtp\s*\(/);
    expect(joined).not.toMatch(/\/auth\/v1\/otp/);
  });
});
