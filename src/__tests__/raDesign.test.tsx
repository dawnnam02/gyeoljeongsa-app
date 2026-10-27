// R-A 디자인 QA(디자인/D43_디자인QA.md) 앱 몫 — 높음 7 · 아이콘 14곳 · 사진 칸 그림 · 데모 줄(FB-011)
import fs from 'fs';
import path from 'path';

import { LockNote } from '@/components/LockNote';
import { PhotoSlotArt } from '@/components/PhotoSlotArt';
import { SETTINGS_ROWS } from '@/features/settings/settingsLogic';
import { illustration } from '@/theme/illustrations';

import { allTexts, has, mount } from './renderHelpers';

const APP = path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(APP, 'src', f), 'utf8');

describe('D43 높음', () => {
  test('C1 가입 아래 안내: 그림 글자 🔒 대신 1안 security 아이콘', async () => {
    const tree = await mount(<LockNote text="안내" textTestID="t" />);
    expect(has(tree, 'lock-note-icon')).toBe(true);
    expect(allTexts(tree).join('')).not.toContain('\u{1F512}');
    tree.unmount();
  });
  test('B1 07 정리 중 = organizing 장면 · B2 T5 불러오기 실패 = error 장면(상태 칸 240)', () => {
    expect(read('features/ai/AnalysisScreen.tsx')).toContain('<Illustration scene="organizing" maxWidth={illustration.state}');
    expect(read('features/ai/AnalysisScreen.tsx')).not.toContain('<Ring');
    expect(read('features/boarding/CreditScreen.tsx')).toContain('<Illustration scene="error" maxWidth={illustration.state}');
  });
  test('D1 그림 칸 최대 390 · 온보딩 그림 칸 가운데', () => {
    expect(illustration.hero).toBe(390);
    expect(read('features/onboarding/OnboardingScreen.tsx')).toContain("art: { alignSelf: 'center', width: '100%', maxWidth: illustration.hero");
  });
  test('E1 웹 글자 낱말 단위 줄바꿈(keep-all)', () => {
    expect(read('components/AppText.tsx')).toContain("wordBreak: 'keep-all'");
  });
});

describe('D43 A 아이콘 14곳', () => {
  test('설정 줄마다 아이콘(알림 bell · 고객센터 support · 약관 document · 신고 report · 차단 block · 내 등급 my_icon_view)', () => {
    for (const r of SETTINGS_ROWS) expect(r.icon).toBeTruthy();
    const by = Object.fromEntries(SETTINGS_ROWS.map((r) => [r.key, r.icon]));
    expect(by).toMatchObject({ notifications: 'bell', support: 'support', legal: 'document', reports: 'report', blocked: 'block', grade: 'my_icon_view', credits: 'credit' });
  });
  test('로그아웃 · 탈퇴 · 대화 메뉴(연장 · 나가기 · 신고) · 신고 시트 · T5 · 08 알약 · 연장 상태 줄에 아이콘을 쓴다', () => {
    const s = read('features/settings/SettingsScreen.tsx');
    expect(s).toContain('icon="logout"');
    expect(s).toContain('icon="withdraw"');
    const c = read('features/chat/ChatRoomScreen.tsx');
    for (const n of ['icon="extend"', 'icon="leave"', 'icon="report"', "icon: 'extend'", "lead={room.myExtend ? 'accept' : undefined}"]) expect(c).toContain(n);
    const r = read('features/safety/ReportBlockSheet.tsx');
    expect(r).toContain('<Icon name="report"');
    expect(r).toContain('<Icon name="block"');
    expect(read('features/boarding/CreditScreen.tsx')).toContain('<Icon name="credit"');
    const p = read('features/profile/ProfileScreen.tsx');
    expect(p).toContain('lead="verified"');
    expect(p).toContain('lead="photo_checking"');
  });
});

describe('D43 B5 사진 칸 그림 · FB-011', () => {
  test('사진 칸 세 장이 새 그림(옛 PNG 0)', async () => {
    for (const name of ['face', 'full', 'free'] as const) {
      const tree = await mount(<PhotoSlotArt name={name} testID={`art-${name}`} />);
      expect(has(tree, `art-${name}`)).toBe(true);
      tree.unmount();
    }
    expect(read('features/photosLite/PhotosLiteScreen.tsx')).not.toContain('H2_PHOTO_GUIDE');
  });
  test('데모 건너뛰기 줄은 글자 버튼 한 줄(큰 버튼 셋 0) · 이름 · testID 그대로', () => {
    const d = read('features/ai/DemoSkipBar.tsx');
    expect(d).not.toContain('<Button ');
    for (const id of ['demo-skip-ok', 'demo-skip-fail', 'demo-skip-slow']) expect(d).toContain(id);
  });
});
