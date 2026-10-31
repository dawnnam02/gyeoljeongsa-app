// 최종 청사진 F-1: 라우트 16 = K2 화면 ID 1:1(K7 로 16 상점이 더해졌다), 분기 표의 화살표가 코드에 있다.
import fs from 'node:fs';
import path from 'node:path';

import { arrowsFrom, FLOW, type Branch, type Dest } from '@/navigation/flow';
import { destName, resolveDest } from '@/navigation/resolve';
import { SCREEN_IDS, SCREENS, screenById, TAB_SCREEN_IDS } from '@/navigation/screens';
import { routeForStage } from '@/navigation/stage';
import {
  chipOf,
  chipProgress,
  isSurveyStep,
  nextStep,
  PREFERENCE_STEPS,
  prevStep,
  SURVEY_CHIPS,
  SURVEY_PROGRESS_TOTAL,
  SURVEY_STEPS,
} from '@/navigation/surveySteps';
import { PROGRESS_STAGES } from '@/types/account';

const APP_DIR = path.resolve(__dirname, '..', 'app');

// src/app 아래 라우트 파일을 주소로 바꾼다. 그룹 (tabs) 는 주소에 나오지 않는다.
function routeFiles(dir: string, base = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full, `${base}/${entry.name}`);
    if (!entry.name.endsWith('.tsx') || entry.name.startsWith('_') || entry.name === 'index.tsx') return [];
    const route = `${base}/${entry.name.replace(/\.tsx$/, '')}`.replace(/\/\([^)]*\)/g, '');
    return [route];
  });
}

describe('화면 ID 16개 = 라우트 16개 (F-1)', () => {
  test('화면 ID는 01~16 열여섯 개 + V5 새 화면 T1 · T3 · T5 · T4 · T4R + 16G(내 등급, D-200 ②) + T6(탑승객 라운지, D-220 LG-F)이고 겹치지 않는다', () => {
    expect(SCREEN_IDS).toHaveLength(30); // + IF2-F 기내지 · 내 여행 타입 · 짝에게 보이는 내 모습(D-223) + IF3-F 하늘 도감(3부-카) + IF5-F1 사주 마당 · 달력 · 오늘 하루
    expect(new Set(SCREENS.map((s) => s.id)).size).toBe(30);
    expect(SCREENS.map((s) => s.id)).toEqual([...SCREEN_IDS]);
  });

  test('라우트 파일 목록과 화면 표가 1:1 이다(diff 0)', () => {
    const files = routeFiles(APP_DIR).sort();
    const registry = SCREENS.map((s) => s.route).sort();
    expect(files).toEqual(registry);
    expect(files).toHaveLength(30);
  });

  test('13 · 14 · 15 는 09 · 11 · 02 의 상태이고, 나머지 13개는 K2 화면이다(16 상점 포함)', () => {
    expect(screenById('13').stateOf).toBe('09');
    expect(screenById('14').stateOf).toBe('11');
    expect(screenById('15').stateOf).toBe('02');
    expect(SCREENS.filter((s) => !s.stateOf)).toHaveLength(27); // K2 13 + V5 T1 · T3 · T5 · T4 · T4R + 16G + T6(LG-F) + IF-MAG · IF-TYPE · IF-PREVIEW(IF2-F) + IF-BOOK(IF3-F) + IF-MADANG · IF-SJ-CAL · IF-SJ-TODAY(IF5-F1)
  });

  test('탭바는 추천 · 호감 · 상점 · 설정 4개이고 탭 화면은 09 · 11 · 16 · 12 (그리고 상태 13 · 14). 08 내 프로필은 탭 밖 화면이다(F11)', () => {
    expect(TAB_SCREEN_IDS.map((id) => screenById(id).route)).toEqual([
      '/boarding',
      '/chat',
      '/recommendations',
      '/likes',
      '/shop',
      '/settings',
    ]);
    expect(
      SCREENS.filter((s) => s.tabBar)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['09', '11', '12', '13', '14', '16', 'T1', 'T4']);
    expect(screenById('08').tabBar).toBe(false);
    expect(fs.existsSync(path.join(APP_DIR, '(tabs)', 'profile.tsx'))).toBe(false); // 08 은 (tabs) 그룹 밖 src/app/profile.tsx
    expect(fs.existsSync(path.join(APP_DIR, 'profile.tsx'))).toBe(true);
    const layout = fs.readFileSync(path.join(APP_DIR, '(tabs)', '_layout.tsx'), 'utf8');
    const order = [...layout.matchAll(/<Tabs\.Screen name="([a-z-]+)"/g)].map((m) => m[1]);
    expect(order.slice(0, 6)).toEqual(['boarding', 'chat', 'recommendations', 'likes', 'shop', 'settings']); // V5: 탑승권 · 채팅 · (숨긴 09 · 11 · 16) · 설정
    expect(order.slice(6)).toEqual(['recommendations-empty', 'likes-empty']); // 탭 칸 없는 상태 화면
  });
});

describe('04 설문 쪽 (K2 3장)', () => {
  test('01~32 중 12가 결번이라 31쪽이다', () => {
    expect(SURVEY_STEPS).toHaveLength(31);
    expect(isSurveyStep('12')).toBe(false);
    expect(isSurveyStep('33')).toBe(false);
    expect(isSurveyStep('01')).toBe(true);
    expect(SURVEY_PROGRESS_TOTAL).toBe(32); // 31쪽 + 05 사진
  });

  test('칩별 쪽 수: 기본 6 · 학력 2 · 직업 3 · 가족 3 · 성향 9 · 희망 8', () => {
    const counts = SURVEY_CHIPS.map((chip) => SURVEY_STEPS.filter((s) => chipOf(s) === chip).length);
    expect(counts).toEqual([6, 2, 3, 3, 9, 8]);
    expect(chipProgress('02')).toEqual({ chip: '기본', index: 2, total: 6 });
    expect(chipProgress('13')).toEqual({ chip: '가족', index: 1, total: 3 });
    expect(chipProgress('32')).toEqual({ chip: '희망', index: 8, total: 8 });
  });

  test('다음 · 이전: 결번 12를 건너뛰고, 처음과 끝은 null 이다', () => {
    expect(nextStep('11')).toBe('13');
    expect(prevStep('13')).toBe('11');
    expect(nextStep('32')).toBeNull(); // 04-32 다음은 05
    expect(prevStep('01')).toBeNull();
  });

  test('희망 조건 수정은 04-25~04-32 여덟 쪽', () => {
    expect(PREFERENCE_STEPS).toEqual(['25', '26', '27', '28', '29', '30', '31', '32']);
  });
});

describe('화살표 (K2 2-1 · 2-2 · 2-3 · 4장)', () => {
  test('분기 ①~⑧이 모두 화살표로 있다', () => {
    const found = new Set(FLOW.map((x) => x.branch).filter((b): b is Branch => b !== undefined));
    expect([...found].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('열여섯 화면 모두 나가는 화살표가 하나 이상 있다', () => {
    for (const id of SCREEN_IDS) expect(arrowsFrom(id).length).toBeGreaterThan(0);
  });

  test('모든 화살표의 도착이 풀린다(알 수 없는 도착 0)', () => {
    for (const arrow of FLOW) {
      const origin = arrow.from === 'START' || arrow.from === 'ANY' ? undefined : arrow.from;
      expect(() => resolveDest(arrow.to, { surveyStep: '10', origin })).not.toThrow();
      expect(() => destName(arrow.to, { surveyStep: '10' })).not.toThrow();
    }
  });

  test('주요 이동 12개가 있다', () => {
    const has = (from: string, to: string) => FLOW.some((x) => x.from === from && x.to === to);
    expect(has('01', '02')).toBe(true);
    expect(has('02', '03')).toBe(true);
    expect(has('03', '04:first')).toBe(true);
    expect(has('04', '05')).toBe(true);
    expect(has('05', '06')).toBe(true);
    expect(has('06', '07')).toBe(true);
    expect(has('07', '08')).toBe(true);
    expect(has('08', '09')).toBe(true);
    expect(has('09', '10')).toBe(true);
    expect(has('11', '10')).toBe(true);
    expect(has('12', '01')).toBe(true); // 로그아웃 · 탈퇴
    expect(has('ANY', '02')).toBe(true); // 분기 ⑦
  });

  // K4(2026-10-14)가 K2 12 설정에 더한 것: 보안 · 정보 2줄 · 탈퇴 인증번호 재확인(분기 ①에 12 포함)
  test('12 설정: 하위 화면 13개(QP-A 사업자 정보 · R-A 아는 분 피하기 포함)가 모두 화살표로 있고 라우트가 아닌 12 안의 쪽으로 풀린다(F7)', () => {
    const subs = arrowsFrom('12')
      .map((x) => x.to)
      .filter((to) => to.startsWith('sub:'));
    expect([...subs].sort()).toEqual([
      'sub:avoid',
      'sub:blocked-list',
      'sub:business-info',
      'sub:consent-management',
      'sub:image-credit',
      'sub:licenses',
      'sub:notifications',
      'sub:privacy',
      'sub:report-history',
      'sub:safety',
      'sub:security',
      'sub:support',
      'sub:terms',
    ]);
    for (const sub of subs) expect(resolveDest(sub as Dest)).toEqual({ kind: 'none', reason: 'sub' });
  });

  test('12 탈퇴: 확인창 → 재확인 단계(머묾) · 재확인 실패(분기 ①) · 취소(머묾) · 확정 → 01', () => {
    const withdraw = arrowsFrom('12').filter((x) => x.label.includes('탈퇴'));
    expect(withdraw.filter((x) => x.to === 'stay')).toHaveLength(3);
    expect(withdraw.filter((x) => x.to === '01')).toHaveLength(1);
    expect(withdraw.some((x) => x.to === 'stay' && x.branch === 1)).toBe(true); // 분기 ① 의 12
  });

  // F11(K7 A5 · A6 · A7): 탭바 이동은 09 · 11 · 16 · 12 · 13 · 14 에서 네 탭으로, 원형 사진은 같은 여섯 화면에서 08 로, 08 의 ‹ 는 들어온 화면으로
  test('탭 화면 여덟에서 원형 사진 → 08, 탭바 이동은 탭 6개 중 나머지, 08 → 들어온 화면(F11 · V5 T1 · T4 더함)', () => {
    const tabScreens = ['T1', 'T4', '09', '11', '16', '12', '13', '14'] as const;
    for (const from of tabScreens) {
      const photo = arrowsFrom(from).filter((x) => x.to === '08' && x.label === '오른쪽 위 원형 사진');
      expect(photo).toHaveLength(1);
      expect(photo[0].tab).toBeUndefined(); // 탭바 이동이 아니다
      expect(arrowsFrom(from).filter((x) => x.tab)).toHaveLength(from === '13' || from === '14' ? 6 : 5);
    }
    expect(FLOW.filter((x) => x.tab && x.to === '08')).toHaveLength(0); // 탭바에 프로필 칸은 없다
    expect(arrowsFrom('08').some((x) => x.to === 'entry')).toBe(true);
    expect(resolveDest('08')).toEqual({ kind: 'href', href: '/profile' });
    expect(resolveDest('16')).toEqual({ kind: 'href', href: '/shop' });
  });

  test('05 다시 올리기 상태: 올리기 성공과 ‹ 뒤로가기가 모두 08 로 간다', () => {
    expect(arrowsFrom('05').filter((x) => x.to === '08')).toHaveLength(2);
  });

  test('희망 조건 수정 진입은 어디서 왔는지 남긴다(12는 settings, 13은 recommendations)', () => {
    expect(resolveDest('04:25', { origin: '12' })).toEqual({
      kind: 'href',
      href: { pathname: '/survey/[step]', params: { step: '25', mode: 'edit-preferences', from: 'settings' } },
    });
    expect(resolveDest('04:25', { origin: '13' })).toEqual({
      kind: 'href',
      href: { pathname: '/survey/[step]', params: { step: '25', mode: 'edit-preferences', from: 'recommendations' } },
    });
  });

  test('설문 쪽 이동: 04:next 는 끝에서, 04:prev 는 처음에서 이동이 없다', () => {
    expect(resolveDest('04:next', { surveyStep: '32' })).toEqual({ kind: 'none', reason: 'edge' });
    expect(resolveDest('04:prev', { surveyStep: '01' })).toEqual({ kind: 'none', reason: 'edge' });
    expect(resolveDest('04:next', { surveyStep: '11' })).toEqual({
      kind: 'href',
      href: { pathname: '/survey/[step]', params: { step: '13' } },
    });
  });
});

describe('로그인한 뒤 어디로 가나 (K2 2-3 표)', () => {
  test('진행 단계 11개가 모두 이동을 가진다', () => {
    expect(PROGRESS_STAGES).toHaveLength(11);
    for (const stage of PROGRESS_STAGES) expect(routeForStage(stage)).toBeTruthy();
    expect(routeForStage(null)).toBe('/sign-in');
  });

  test('표대로 간다', () => {
    expect(routeForStage('email-verified')).toEqual({ pathname: '/sign-in', params: { open: 'birthdate' } });
    expect(routeForStage('birthdate-passed')).toBe('/consent');
    expect(routeForStage('consent-changed')).toEqual({ pathname: '/consent', params: { mode: 'reconsent' } });
    expect(routeForStage('consented', '07')).toEqual({ pathname: '/survey/[step]', params: { step: '07' } });
    expect(routeForStage('survey-complete')).toBe('/photos');
    expect(routeForStage('ai-processing')).toBe('/analysis');
    expect(routeForStage('ai-failed')).toEqual({ pathname: '/analysis', params: { state: 'failed' } });
    expect(routeForStage('traits-pending')).toBe('/traits');
    expect(routeForStage('traits-confirmed')).toBe('/recommendations');
    expect(routeForStage('withdrawn')).toBe('/sign-in');
  });
});
