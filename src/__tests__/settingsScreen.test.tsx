// 12 설정(F7 통과 조건 1 · 3 · 5): 목록 차례 · 이동 · 인증 서류 준비 중 · 로그아웃 · 하위 화면(알림 · 보안 · 동의 관리 · 차단 목록 · 신고 내역 · 고객센터 · 안전 안내 · 라이선스 · 이미지 고지)
// 카피 글자 그대로 · 등급 · 점수 글 0 · 토큰 · 공통 Pressable · 360 폭 넘침 요인 0(정적 검사)
import fs from 'node:fs';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import path from 'node:path';

import { CHILD_SAFETY, COMMON, SAFETY_GUIDE, SUPPORT } from '@/content/copy';
import { CONSENT_ITEMS } from '@/content/consentContent';
import { BLOCKED, CONSENT_MANAGE, IMAGE_CREDIT, LICENSES, NOTIFY, REPORTS, SECURITY, SETTINGS } from '@/content/settingsCopy';
import { SupportPage } from '@/features/settings/InfoPages';
import { pushStatusOf, type PushStatus } from '@/features/settings/deviceDeps';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';
import { blockedHead, fillContact, reportDate, SETTINGS_ROWS } from '@/features/settings/settingsLogic';
import type { SettingsApi } from '@/lib/settingsApi';
import { arrowsFrom } from '@/navigation/flow';
import { PREFERENCES_EDIT_ENABLED } from '@/config/flags';
import { useSecurityStore } from '@/store/securityStore';

import { allTexts, find, has, hasText, isOpen, mount, must, press, textOf } from './renderHelpers';

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때(npm run check) 첫 화면 그리기가 30초를 넘는 일이 있었다

// 같은 testID 가 겹쳐 있을 때(부품 → 안쪽 요소) 그 값을 가진 첫 요소의 값
const propOf = (tree: ReactTestRenderer, id: string, key: string): any => tree.root.findAll((n) => n.props.testID === id && n.props[key] !== undefined)[0]?.props[key];
const textIn = (tree: ReactTestRenderer, id: string): string | null => {
  for (const n of tree.root.findAll((x) => x.props.testID === id)) {
    const t = n.findAll((c) => typeof c.props.children === 'string').map((c) => c.props.children as string);
    if (t.length) return t[0];
  }
  return null;
};

const mockRouter = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, settingsApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

const NOW = Date.UTC(2026, 9, 15, 3, 0, 0); // 2026-10-15 12:00 KST

type Api = jest.Mocked<SettingsApi>;
function makeApi(over: Partial<SettingsApi> = {}): Api {
  const api = {
    loadBlocked: jest.fn(async () => ({ ok: true as const, data: [{ userId: 'u1', name: '박OO', age: 29 }, { userId: 'u2', name: '최OO', age: 33 }] })),
    unblock: jest.fn(async () => ({ ok: true as const })),
    loadReports: jest.fn(async () => ({
      ok: true as const,
      data: [
        { id: 'r1', status: 'reviewing' as const, createdAt: '2026-10-14T05:00:00Z' },
        { id: 'r2', status: 'done' as const, createdAt: '2025-12-03T05:00:00Z' },
        { id: 'r3', status: 'received' as const, createdAt: '2026-10-15T02:00:00Z' },
      ],
    })),
    loadNotify: jest.fn(async () => ({ ok: true as const, data: { recommendation: true, like: true, match: true, chat: true } })),
    saveNotify: jest.fn(async () => ({ ok: true as const })),
    loadConsents: jest.fn(async () => ({ ok: true as const, data: { CK4: true, CK9: true } })),
    setOptional: jest.fn(async () => ({ ok: true as const })),
    startWithdraw: jest.fn(async () => ({ ok: true as const })),
    confirmWithdraw: jest.fn(async () => ({ ok: true as const })),
    signOut: jest.fn(async () => undefined),
    ...over,
  };
  return api as unknown as Api;
}

function setup(over: Partial<SettingsApi> = {}, push: PushStatus = 'granted') {
  const api = makeApi(over);
  const deps: SettingsDeps = {
    api,
    now: () => NOW,
    resetLocal: jest.fn(),
    pushStatus: jest.fn(async () => push),
    requestPush: jest.fn(async () => 'granted' as PushStatus),
    copyText: jest.fn(async () => true),
    openMail: jest.fn(async () => undefined),
  };
  return { api, deps };
}
const trees: ReactTestRenderer[] = [];
const show = async (deps: SettingsDeps) => {
  const tree = await mount(<SettingsScreen deps={deps} />);
  trees.push(tree);
  return tree;
};
afterEach(async () => {
  await act(async () => trees.splice(0).forEach((t) => t.unmount()));
});

beforeEach(() => {
  jest.clearAllMocks();
  useSecurityStore.setState({ captureBlock: false });
});

describe('12 설정 규칙', () => {
  test('줄 차례 = Figma 12 · 12b(카피.md 12 목록): 정보 묶음 2줄은 맨 아래 · 임시 설문(F2L) 동안 "희망 조건 수정"은 숨김(D-48)', () => {
    expect(PREFERENCES_EDIT_ENABLED).toBe(false);
    expect(SETTINGS_ROWS.map((r) => r.label)).toEqual([
      '알림',
      '공개 범위',
      '내 등급',
      '아는 분 피하기',
      '인증 서류 제출',
      '크레딧 · 구매 내역',
      '차단 목록',
      '신고 내역',
      '보안',
      '고객센터',
      '동의 관리',
      '이용약관 · 개인정보 처리방침',
      '안전 안내',
      '오픈소스 라이선스',
      '이미지 출처 고지',
      '사업자 정보',
    ]);
    expect(SETTINGS_ROWS.filter((r) => r.group === 'info').map((r) => r.key)).toEqual(['licenses', 'image-credit', 'business-info']); // 사업자 정보는 값이 모두 있을 때만 화면에 그린다(QP-A)
  });

  test('신고 날짜(R-D18-2): 올해는 "10월 15일", 해가 다르면 "2025년 12월 3일", 한국 날짜 · 시각 없음', () => {
    expect(reportDate('2026-10-15T02:00:00Z', NOW)).toBe('10월 15일');
    expect(reportDate('2026-10-14T15:30:00Z', NOW)).toBe('10월 15일'); // UTC 14일 15:30 = KST 15일 00:30
    expect(reportDate('2025-12-03T05:00:00Z', NOW)).toBe('2025년 12월 3일');
    expect(reportDate('잘못된 값', NOW)).toBe('');
    expect(REPORTS.status).toEqual({ received: '접수됨', reviewing: '확인 중', done: '처리됨' }); // R-D18-1
  });

  test('차단한 분 한 줄 "박OO · 29" · 고객센터 값이 없으면 원본 자리 그대로', () => {
    expect(blockedHead('박OO', 29)).toBe('박OO · 29');
    expect(blockedHead('박OO', null)).toBe('박OO');
    expect(fillContact(SUPPORT.emailLabel, { email: null, hours: null })).toBe('문의 이메일 {고객센터 이메일}');
    expect(fillContact(SUPPORT.emailLabel, { email: 'help@example.test', hours: '평일 10시~18시' })).toBe('문의 이메일 help@example.test');
    expect(fillContact(SUPPORT.hoursLabel, { email: null, hours: '평일 10시~18시' })).toBe('운영 시간 평일 10시~18시');
  });
});

describe('12 하위 화면 이름 = flow.ts 의 sub:* (F-1)', () => {
  test('목록의 하위 화면 11개(QP-A 사업자 정보 · R-A 아는 분 피하기 포함)는 모두 flow.ts 화살표(sub:*)에 있다', () => {
    const subs = arrowsFrom('12').map((x) => x.to).filter((to) => to.startsWith('sub:')).map((to) => to.slice(4));
    const pages = SETTINGS_ROWS.flatMap((r) => (r.action.kind === 'page' ? [r.action.page] : []));
    expect(pages).toHaveLength(11);
    for (const page of pages) expect(subs).toContain(page);
    expect(subs).toEqual(expect.arrayContaining(['terms', 'privacy'])); // 한 줄 → 03 읽기 시트의 탭 2개
  });
});

describe('12 목록 화면', () => {
  test('상단 "설정" · 줄 13개(사업자 정보는 값이 비어 숨김) · 정보 묶음 · 로그아웃 · 탈퇴하기 · 인증 서류 "준비 중"', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    expect(hasText(tree, SETTINGS.headerTitle)).toBe(true);
    for (const row of SETTINGS_ROWS) expect(has(tree, `settings-row-${row.key}`)).toBe(row.key !== 'business-info');
    expect(textIn(tree, 'settings-info-label')).toBe('정보');
    expect(hasText(tree, '준비 중')).toBe(true);
    expect(hasText(tree, '로그아웃')).toBe(true);
    expect(propOf(tree, 'settings-withdraw', 'accessibilityLabel')).toBe('탈퇴하기');
    expect(allTexts(tree).some((t) => t.includes('모든 데이터 삭제'))).toBe(false); // 동의문구 5-6
  });

  test('인증 서류 제출: 이동 없음 + 토스트 "준비 중이에요"(N19)', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-verification');
    expect(has(tree, 'settings-toast')).toBe(true);
    expect(hasText(tree, SETTINGS.verificationToast)).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test('공개 범위 → 08 프로필 탭 · 희망 조건 수정 줄은 임시 설문 동안 없다(D-48)', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-visibility');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/profile');
    expect(has(tree, 'settings-row-preferences')).toBe(false);
    expect(hasText(tree, SETTINGS.rows.preferences)).toBe(false);
  });

  test('이용약관 · 개인정보 처리방침 → 03 과 같은 읽기 시트', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-legal');
    expect(has(tree, 'legal-tab-terms')).toBe(true);
    expect(has(tree, 'legal-tab-privacy')).toBe(true);
  }, 90_000); // 약관 전문을 그리는 시트라 여러 시험이 함께 돌 때 오래 걸릴 수 있다

  test('로그아웃: 확인창 없이 로그인 정보 · 임시 저장을 지우고 01(쌓지 않음)', async () => {
    const { deps, api } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-logout');
    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(deps.resetLocal).toHaveBeenCalledTimes(1);
    expect(has(tree, 'settings-ck4-off')).toBe(false); // 확인창 없음
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding');
  });

  test('로그아웃 동시 두 번 눌림 → 요청 한 번(R9)', async () => {
    let release: () => void = () => undefined;
    const { deps, api } = setup({ signOut: jest.fn(() => new Promise<void>((r) => (release = r))) });
    const tree = await show(deps);
    const node = must(tree, 'settings-logout');
    await act(async () => {
      node.props.onPress();
      node.props.onPress();
    });
    await act(async () => release());
    expect(api.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('12 하위 화면', () => {
  test('알림(v5, 12-Q · 화면_요구사항 12-2): 서비스 2줄 "이번 주 만날 분이 정해졌을 때"(notify_match — 서버 P8 이 읽는 열) · "대화방에 새 글이 왔을 때"(notify_chat) + 작은 글 + 마케팅 · 호감 · 연결 줄 없음', async () => {
    const { deps, api } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-notifications');
    expect(hasText(tree, NOTIFY.headerTitle)).toBe(true);
    expect(NOTIFY.recommendation).toBe('이번 주 만날 분이 정해졌을 때');
    expect(NOTIFY.chat).toBe('대화방에 새 글이 왔을 때');
    for (const label of [NOTIFY.recommendation, NOTIFY.chat, NOTIFY.chatNote, NOTIFY.marketing]) expect(hasText(tree, label)).toBe(true);
    for (const label of [NOTIFY.like, NOTIFY.match]) expect(hasText(tree, label)).toBe(false);
    expect(has(tree, 'settings-notify-like') || has(tree, 'settings-notify-recommendation')).toBe(false);
    NOTIFY.marketingNotes.forEach((line, i) => expect(textOf(tree, `settings-marketing-note-${i}`)).toBe(line));
    await press(tree, 'settings-notify-match');
    expect(api.saveNotify).toHaveBeenCalledWith('match', false);
    expect(propOf(tree, 'settings-notify-match', 'accessibilityState').checked).toBe(false);
    expect(propOf(tree, 'settings-notify-chat', 'accessibilityState').checked).toBe(true); // 처음 켜짐
    await press(tree, 'settings-notify-chat');
    expect(api.saveNotify).toHaveBeenCalledWith('chat', false);
  });

  test('알림: 저장 실패면 되돌리고 이유, 마케팅은 CK9 철회 + 토스트 N10, 푸시 거부면 R-D18-3 안내', async () => {
    const { deps, api } = setup({ saveNotify: jest.fn(async () => ({ ok: false as const, reason: 'network' as const })) }, 'denied');
    const tree = await show(deps);
    await press(tree, 'settings-row-notifications');
    expect(textOf(tree, 'settings-push-denied')).toBe('알림이 꺼져 있어요. 설정에서 허용해 주세요.');
    await press(tree, 'settings-notify-match');
    expect(propOf(tree, 'settings-notify-match', 'accessibilityState').checked).toBe(true);
    expect(textOf(tree, 'settings-notifications-error')).toBe(COMMON.offline);
    await press(tree, 'settings-notify-marketing');
    expect(api.setOptional).toHaveBeenCalledWith('CK9', false);
    expect(hasText(tree, NOTIFY.saved)).toBe(true);
  });

  test('알림: 권한을 아직 안 물었으면 안내 글(동의문구 5-5)을 먼저 보이고, 서비스 알림을 켤 때만 시스템 창을 띄운다', async () => {
    const { deps } = setup({ loadNotify: jest.fn(async () => ({ ok: true as const, data: { recommendation: false, like: true, match: false, chat: true } })) }, 'undetermined');
    const tree = await show(deps);
    await press(tree, 'settings-row-notifications');
    expect(textOf(tree, 'settings-push-prime')).toBe(NOTIFY.pushPrime);
    expect(deps.requestPush).not.toHaveBeenCalled(); // 열기만 해서는 묻지 않는다
    await press(tree, 'settings-notify-match'); // 켜기 → 묻는다
    expect(deps.requestPush).toHaveBeenCalledTimes(1);
    expect(has(tree, 'settings-push-prime')).toBe(false); // 허용 뒤 안내 글은 사라진다
  });

  test('푸시 권한 읽기: 허용 · 거부(다시 묻기 불가 포함) · 아직', () => {
    expect(pushStatusOf({ granted: true, status: 'granted' })).toBe('granted');
    expect(pushStatusOf({ granted: false, status: 'denied' })).toBe('denied');
    expect(pushStatusOf({ granted: false, status: 'undetermined', canAskAgain: false })).toBe('denied');
    expect(pushStatusOf({ granted: false, status: 'undetermined', canAskAgain: true })).toBe('undetermined');
    expect(pushStatusOf(null)).toBe('undetermined');
  });

  test('보안: "상대 화면 캡처 차단" 처음값 꺼짐(D-23 BD-4), 누르면 확인창 없이 켜짐 · 설명 글 N32', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-security');
    expect(propOf(tree, 'settings-capture-block', 'accessibilityState').checked).toBe(false);
    expect(textOf(tree, 'settings-capture-note')).toBe(SECURITY.captureBlockNote);
    await press(tree, 'settings-capture-block');
    expect(useSecurityStore.getState().captureBlock).toBe(true);
    expect(allTexts(tree).some((t) => t.includes('완전히'))).toBe(false);
  });

  test('동의 관리: 선택 2줄은 03 글 그대로 + 스위치, 필수 7줄은 보기 ›, CK4 끄기는 확인창(N25) → 철회 → 토스트', async () => {
    const { deps, api } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-consents');
    for (const code of ['CK4', 'CK9']) {
      const item = CONSENT_ITEMS.find((i) => i.code === code);
      expect(propOf(tree, `settings-consent-${code}`, 'accessibilityLabel')).toBe(item?.label);
    }
    // 3부-사(카피 12-Q M9): CK4 켜짐이면 덧붙이는 안내 대신 '끄면…' 한 줄 · CK9 는 덧붙이는 안내 그대로
    expect(hasText(tree, CONSENT_MANAGE.ck4OnNote)).toBe(true);
    expect(hasText(tree, CONSENT_ITEMS.find((i) => i.code === 'CK4')?.note ?? '-')).toBe(false);
    expect(hasText(tree, CONSENT_ITEMS.find((i) => i.code === 'CK9')?.note ?? '-')).toBe(true);
    expect(CONSENT_ITEMS.filter((i) => i.required).every((i) => has(tree, `settings-consent-view-${i.code}`))).toBe(true);
    expect(textOf(tree, 'settings-consents-required-note')).toBe(CONSENT_MANAGE.requiredNote);
    await press(tree, 'settings-consent-CK4');
    expect(api.setOptional).not.toHaveBeenCalled();
    expect(isOpen(tree, 'settings-ck4-off')).toBe(true);
    expect(textOf(tree, 'settings-ck4-off-title')).toBe('종교 정보 동의를 끌까요?');
    await press(tree, 'settings-ck4-off-confirm');
    expect(api.setOptional).toHaveBeenCalledWith('CK4', false);
    expect(propOf(tree, 'settings-consent-CK4', 'accessibilityState').checked).toBe(false);
    expect(hasText(tree, CONSENT_MANAGE.saved)).toBe(true);
    expect(hasText(tree, CONSENT_ITEMS.find((i) => i.code === 'CK4')?.note ?? '-')).toBe(true); // 꺼지면 덧붙이는 안내로
    // 3부-사(법무 L22 C5): CK4 다시 켜기는 토글 한 번이 아니라 종교 동의 카드(고지 전부 · 체크 · 같은 무게 버튼)를 거친다. CK9 는 확인창 없이
    const calls = (api.setOptional as jest.Mock).mock.calls.length;
    await press(tree, 'settings-consent-CK4');
    expect(isOpen(tree, 'settings-ck4-card')).toBe(true);
    expect(api.setOptional).toHaveBeenCalledTimes(calls);
    await press(tree, 'chat-rel-agree'); // 체크 없이 → 이유 한 줄 · 기록 0
    expect(api.setOptional).toHaveBeenCalledTimes(calls);
    await press(tree, 'chat-rel-check');
    await press(tree, 'chat-rel-agree');
    expect(api.setOptional).toHaveBeenLastCalledWith('CK4', true);
    await press(tree, 'settings-consent-CK9');
    expect(api.setOptional).toHaveBeenLastCalledWith('CK9', false);
  });

  test('동의 관리: 보기 › 는 03 요약 시트를 연다 · 저장 실패면 스위치 그대로 + 이유', async () => {
    const { deps } = setup({ setOptional: jest.fn(async () => ({ ok: false as const, reason: 'server' as const })) });
    const tree = await show(deps);
    await press(tree, 'settings-row-consents');
    await press(tree, 'settings-consent-view-CK1');
    expect(has(tree, 'consent-summary-CK1')).toBe(true);
    await press(tree, 'settings-consent-CK9');
    expect(propOf(tree, 'settings-consent-CK9', 'accessibilityState').checked).toBe(true);
    expect(textOf(tree, 'settings-consents-error')).toBe(CONSENT_MANAGE.saveFailed);
  });

  test('차단 목록: "박OO · 29" + [차단 해제] → 줄이 사라짐, 0건이면 "차단한 분이 없어요"', async () => {
    const { deps, api } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-blocked');
    expect(textOf(tree, 'settings-blocked-head-u1')).toBe('박OO · 29');
    expect(propOf(tree, 'settings-unblock-u1', 'accessibilityLabel')).toBe('박OO · 29 차단 해제');
    expect(hasText(tree, BLOCKED.unblock)).toBe(true);
    await press(tree, 'settings-unblock-u1');
    expect(api.unblock).toHaveBeenCalledWith('u1');
    expect(has(tree, 'settings-blocked-row-u1')).toBe(false);
    expect(hasText(tree, '차단을 풀었어요.')).toBe(true); // U28: 확인창 없이 바로 + 토스트
    expect(has(tree, 'settings-confirm')).toBe(false);
    await press(tree, 'settings-unblock-u2');
    expect(hasText(tree, BLOCKED.empty)).toBe(true);
  });

  test('차단 목록: 불러오기 실패 → 공통 문구 + 다시 시도 · 해제 실패 → 줄 그대로 + 이유', async () => {
    let first = true;
    const { deps } = setup({
      loadBlocked: jest.fn(async () => {
        if (first) {
          first = false;
          return { ok: false as const, reason: 'network' as const };
        }
        return { ok: true as const, data: [{ userId: 'u1', name: '박OO', age: 29 }] };
      }),
      unblock: jest.fn(async () => ({ ok: false as const, reason: 'server' as const })),
    });
    const tree = await show(deps);
    await press(tree, 'settings-row-blocked');
    expect(hasText(tree, COMMON.offline)).toBe(true);
    await press(tree, 'settings-blocked-retry');
    expect(has(tree, 'settings-blocked-row-u1')).toBe(true);
    await press(tree, 'settings-unblock-u1');
    expect(has(tree, 'settings-blocked-row-u1')).toBe(true);
    expect(textOf(tree, 'settings-blocked-action-error')).toBe('차단을 풀지 못했어요. 다시 시도해 주세요.');
    expect(hasText(tree, '차단을 풀었어요.')).toBe(false);
  });

  test('신고 내역: 신고한 날 + 상태만(누구를 신고했는지 없음) · 0건 문구', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-reports');
    expect(textOf(tree, 'settings-report-date-r1')).toBe('10월 14일');
    expect(textOf(tree, 'settings-report-date-r2')).toBe('2025년 12월 3일');
    expect(hasText(tree, '확인 중')).toBe(true);
    expect(hasText(tree, '처리됨')).toBe(true);
    expect(hasText(tree, '접수됨')).toBe(true);
    expect(allTexts(tree).some((t) => t.includes('OO'))).toBe(false);

    const empty = setup({ loadReports: jest.fn(async () => ({ ok: true as const, data: [] })) });
    const tree2 = await show(empty.deps);
    await press(tree2, 'settings-row-reports');
    expect(hasText(tree2, REPORTS.empty)).toBe(true);
  });

  test('고객센터(QP-04 · Q9-N6): 값이 정해지기 전에는 이메일 · 운영 시간 · 아동 안전 연락처 줄과 [복사] · [메일 앱 열기]가 없고, 자리 글 {…} 이 화면에 없다 · 아동 안전 문의 글은 「아래 연락처」 문장을 뺀 앱 신고 길 문장만', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-support');
    for (const id of ['settings-support-card', 'settings-support-email', 'settings-support-hours', 'settings-support-copy', 'settings-support-mail', 'settings-child-contact']) expect(has(tree, id)).toBe(false);
    for (const text of [CHILD_SAFETY.row, CHILD_SAFETY.policy]) expect(hasText(tree, text)).toBe(true);
    expect(textOf(tree, 'settings-child-body')).toBe("앱에서는 신고 사유 '미성년자로 보임'이나 '부적절한 사진'으로도 알릴 수 있어요.");
    expect(CHILD_SAFETY.body.endsWith(textOf(tree, 'settings-child-body') ?? '-')).toBe(true); // 카피 원본 문장 그대로(새 글 0)
    expect(allTexts(tree).some((t) => t.includes('아래 연락처'))).toBe(false);
    expect(allTexts(tree).some((t) => /\{[^}]+\}/.test(t))).toBe(false);
  });

  test('고객센터(QP-04): 값이 있으면 줄 · 버튼이 보이고 [복사] · [메일 앱 열기]가 그 값을 쓴다 · 운영 시간만 비면 그 줄만 없다', async () => {
    const { deps } = setup();
    const tree = await mount(<SupportPage deps={deps} contact={{ email: 'help@example.com', hours: null }} onBack={() => undefined} onToast={() => undefined} />);
    trees.push(tree);
    expect(textOf(tree, 'settings-support-email')).toBe('문의 이메일 help@example.com');
    expect(has(tree, 'settings-support-hours')).toBe(false);
    expect(textOf(tree, 'settings-child-contact')).toBe('아동 안전 담당 연락처 help@example.com');
    expect(textOf(tree, 'settings-child-body')).toBe(CHILD_SAFETY.body); // 연락처가 있으면 '아래 연락처' 문장까지 그대로
    await press(tree, 'settings-support-mail');
    expect(deps.openMail).toHaveBeenCalledWith('help@example.com');
    await press(tree, 'settings-support-copy');
    expect(deps.copyText).toHaveBeenCalledWith('help@example.com');
  });

  test('안전 안내: 제목 + 7줄(N34) · 오픈소스 라이선스: 안내(법무 5-6) + Lucide · Pretendard · npm 3줄, 누르면 전문 · 이미지 출처 고지(N30)', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    await press(tree, 'settings-row-safety');
    expect(textOf(tree, 'settings-safety-title')).toBe(SAFETY_GUIDE.title);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => textOf(tree, `settings-safety-line-${i}`))).toEqual([...SAFETY_GUIDE.lines, SAFETY_GUIDE.minorNote]);
    await press(tree, 'settings-safety-header-back');
    expect(has(tree, 'settings-rows')).toBe(true);

    await press(tree, 'settings-row-licenses');
    expect(textOf(tree, 'settings-licenses-intro')).toBe(LICENSES.intro);
    expect(propOf(tree, 'settings-license-lucide', 'accessibilityLabel')).toBe('Lucide · ISC · MIT');
    expect(propOf(tree, 'settings-license-pretendard', 'accessibilityLabel')).toBe('Pretendard · OFL');
    expect(propOf(tree, 'settings-license-npm', 'accessibilityLabel')).toBe('npm 패키지 · MIT');
    await press(tree, 'settings-license-lucide');
    expect(allTexts(tree).some((t) => t.startsWith('ISC License'))).toBe(true);
    await press(tree, 'settings-licenses-header-back');

    await press(tree, 'settings-row-image-credit');
    expect(textOf(tree, 'settings-image-credit-body')).toBe(IMAGE_CREDIT.body);
  });
});

describe('F7 공통 규칙(조건 5)', () => {
  const ROOT = path.resolve(__dirname, '..');
  const files = [
    ...fs.readdirSync(path.join(ROOT, 'features', 'settings')).map((f) => path.join(ROOT, 'features', 'settings', f)),
    ...fs.readdirSync(path.join(ROOT, 'features', 'safety')).map((f) => path.join(ROOT, 'features', 'safety', f)),
    path.join(ROOT, 'content', 'settingsCopy.ts'),
    path.join(ROOT, 'lib', 'settingsApi.ts'),
    path.join(ROOT, 'lib', 'settingsDemo.ts'),
  ].filter((f) => /\.tsx?$/.test(f));
  const source = (f: string) => fs.readFileSync(f, 'utf8');

  test('색 hex · rgb 직접 쓰기 0, react-native Pressable · Touchable 직접 쓰기 0', () => {
    for (const f of files) {
      expect(source(f)).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
      expect(source(f)).not.toMatch(/import\s*\{[^}]*\b(?:Pressable|Touchable\w*)\b[^}]*\}\s*from\s*['"]react-native['"]/);
    }
  });

  test('360 폭 넘침 요인 0: 화면 코드에 고정 폭 숫자(width: 숫자)가 없다 — 폭은 토큰 · layout · flex 로만', () => {
    for (const f of files) expect(source(f)).not.toMatch(/\b(?:min|max)?[wW]idth\s*:\s*\d/);
  });

  test('화면 글에 등급 · 점수 · 순위 말은 허용 목록(NV35 한 줄) 밖에 없다(목록 · 하위 화면 전부)', async () => {
    const { deps } = setup();
    const tree = await show(deps);
    const seen = new Set(allTexts(tree));
    for (const row of ['notifications', 'consents', 'blocked', 'reports', 'support', 'safety']) {
      await press(tree, `settings-row-${row}`);
      for (const t of allTexts(tree)) seen.add(t);
      const back = find(tree, `settings-${row === 'consents' ? 'consents' : row === 'notifications' ? 'notifications' : row}-header-back`);
      if (back) await press(tree, back.props.testID as string);
    }
    // v5(QP-A, 12-Q): 옛 줄 '구매 · 등급 구독'(NV35)이 '크레딧 · 구매 내역'으로 바뀌어 grade 연결이 없는 목록 · 하위 화면에는 등급 · 점수 · 순위 · 구독 말이 0
    expect([...seen].filter((t) => /등급|점수|순위|구독/.test(t))).toEqual(['내 등급']); // R-A(D-200 ②): 12 '내 등급' 줄 하나(허용 구역 '12 설정 줄')
  });
});
