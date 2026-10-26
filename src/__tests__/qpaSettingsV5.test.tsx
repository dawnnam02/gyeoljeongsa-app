// QP-A 1부(D-196): 마케팅 확정 문구(카피.md 12-Q · 14장) 반영 — 사업자 정보 줄 · 신고번호 한 줄(값 없으면 숨김 / 있으면 보임) · 약관 맨 아래 한 줄 ·
//  동의 관리 확정 글(CONSENT_MANAGE) · 설문 · 프로필 '추천' 글 → '짝' 글. 값은 content/businessInfo.ts 한 곳(FILL_INS)에서 읽고 지금은 모두 비어 있다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { BUSINESS_INFO, businessRows, reportNoLine, type BusinessInfo } from '@/content/businessInfo';
import { PROFILE } from '@/content/copy';
import { CHAT_V6 } from '@/content/surveyChatCopy';
import { SURVEY_LITE } from '@/content/surveyLiteCopy';
import { BUSINESS, CONSENT_MANAGE, SETTINGS, WITHDRAW } from '@/content/settingsCopy';
import * as settingsCopy from '@/content/settingsCopy';
import { GRADE16, SETTINGS16 } from '@/content/shopCopy';
import { LegalReader } from '@/features/consent/LegalReader';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';
import type { SettingsApi } from '@/lib/settingsApi';

import { allTexts, has, hasText, mount, must, press, textOf } from './renderHelpers';

jest.setTimeout(90_000);

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

const EMPTY: BusinessInfo = { name: null, ceo: null, reportNo: null, bizRegNo: null, address: null, phone: null };
const FULL: BusinessInfo = { name: '결정사(시험)', ceo: '홍길동', reportNo: '서울-강남-국내-2027-0001', bizRegNo: '000-00-00000', address: '서울특별시 시험구 시험로 1', phone: '02-000-0000' };

function deps(business?: BusinessInfo): SettingsDeps {
  const api = {
    loadBlocked: jest.fn(async () => ({ ok: true as const, data: [] })),
    unblock: jest.fn(async () => ({ ok: true as const })),
    loadReports: jest.fn(async () => ({ ok: true as const, data: [] })),
    loadNotify: jest.fn(async () => ({ ok: true as const, data: { recommendation: true, like: true, match: true } })),
    saveNotify: jest.fn(async () => ({ ok: true as const })),
    loadConsents: jest.fn(async () => ({ ok: true as const, data: { CK4: true, CK9: true } })),
    setOptional: jest.fn(async () => ({ ok: true as const })),
    startWithdraw: jest.fn(async () => ({ ok: true as const })),
    confirmWithdraw: jest.fn(async () => ({ ok: true as const })),
    signOut: jest.fn(async () => undefined),
  } as unknown as SettingsApi;
  return {
    api,
    business,
    now: () => Date.UTC(2026, 9, 27, 3, 0, 0),
    resetLocal: jest.fn(),
    pushStatus: jest.fn(async () => 'granted' as const),
    requestPush: jest.fn(async () => 'granted' as const),
    copyText: jest.fn(async () => true),
    openMail: jest.fn(async () => undefined),
  };
}

const trees: ReactTestRenderer[] = [];
const show = async (d: SettingsDeps) => {
  const tree = await mount(<SettingsScreen deps={d} />);
  trees.push(tree);
  return tree;
};
afterEach(async () => {
  await act(async () => trees.splice(0).forEach((t) => t.unmount()));
});
beforeEach(() => jest.clearAllMocks());

describe('사업자 정보 · 신고번호 값(한 곳)', () => {
  test('지금 값은 모두 비어 있다(신고 수리 전) → 신고번호 줄 · 사업자 정보 줄 모두 없음', () => {
    expect(BUSINESS_INFO).toEqual(EMPTY);
    expect(reportNoLine()).toBeNull();
    expect(businessRows()).toBeNull();
  });

  test('신고번호 줄 글 꼴 = 카피.md 12-Q "국내결혼중개업 신고번호 {신고번호}" · 빈칸 · 공백만 있는 값은 없는 것과 같다', () => {
    expect(reportNoLine(FULL)).toBe('국내결혼중개업 신고번호 서울-강남-국내-2027-0001');
    expect(reportNoLine({ ...EMPTY, reportNo: '   ' })).toBeNull();
    expect(reportNoLine({ ...EMPTY, reportNo: 'A-1' })).toBe('국내결혼중개업 신고번호 A-1');
  });

  test('사업자 정보 줄 6개는 값이 모두 있을 때만 · 차례는 12-Q 그대로(상호 · 대표자 · 신고번호 · 사업자등록번호 · 사무소 주소 · 전화번호)', () => {
    expect(businessRows(FULL)?.map((r) => `${r.label} ${r.value}`)).toEqual([
      '상호 결정사(시험)',
      '대표자 홍길동',
      '국내결혼중개업 신고번호 서울-강남-국내-2027-0001',
      '사업자등록번호 000-00-00000',
      '사무소 주소 서울특별시 시험구 시험로 1',
      '전화번호 02-000-0000',
    ]);
    for (const key of Object.keys(FULL) as (keyof BusinessInfo)[]) expect(businessRows({ ...FULL, [key]: null })).toBeNull();
    expect(BUSINESS.headerTitle).toBe(SETTINGS.rows.businessInfo);
  });
});

describe('12 설정 목록 — 값 없으면 숨김 / 있으면 보임', () => {
  test('값이 비면 사업자 정보 줄도 신고번호 한 줄도 없고, {변수} · 준비 중 글도 보이지 않는다', async () => {
    const tree = await show(deps(EMPTY));
    expect(has(tree, 'settings-row-business-info')).toBe(false);
    expect(has(tree, 'settings-report-no')).toBe(false);
    expect(allTexts(tree).some((t) => /신고번호|사업자 정보|\{/.test(t))).toBe(false);
  });

  test('deps 를 주지 않으면 한 곳(BUSINESS_INFO, 지금 비어 있음)을 읽는다 → 숨김', async () => {
    const tree = await show(deps());
    expect(has(tree, 'settings-row-business-info')).toBe(false);
    expect(has(tree, 'settings-report-no')).toBe(false);
  });

  test('신고번호만 있으면 목록 맨 아래 한 줄만 보이고 사업자 정보 줄은 없다', async () => {
    const tree = await show(deps({ ...EMPTY, reportNo: '서울-강남-국내-2027-0001' }));
    expect(textOf(tree, 'settings-report-no')).toBe('국내결혼중개업 신고번호 서울-강남-국내-2027-0001');
    expect(has(tree, 'settings-row-business-info')).toBe(false);
  });

  test('값이 모두 있으면 정보 묶음 맨 끝에 "사업자 정보" 줄 → 누르면 6줄 쪽 · ‹ 로 목록', async () => {
    const tree = await show(deps(FULL));
    expect(must(tree, 'settings-row-business-info').props.label).toBe('사업자 정보');
    expect(textOf(tree, 'settings-report-no')).toBe('국내결혼중개업 신고번호 서울-강남-국내-2027-0001');
    await press(tree, 'settings-row-business-info');
    expect(has(tree, 'settings-business')).toBe(true);
    for (const t of ['상호', '결정사(시험)', '대표자', '홍길동', '국내결혼중개업 신고번호', '사업자등록번호', '사무소 주소', '전화번호', '02-000-0000']) expect(hasText(tree, t)).toBe(true);
    await press(tree, 'settings-business-header-back');
    expect(has(tree, 'settings-rows')).toBe(true);
  });
});

describe('약관 화면 맨 아래 신고번호 한 줄', () => {
  const reader = async (business?: BusinessInfo) => {
    const tree = await mount(<LegalReader visible initial="terms" onClose={() => undefined} business={business} />);
    trees.push(tree);
    return tree;
  };
  test('값이 없으면 없다', async () => {
    expect(has(await reader(EMPTY), 'legal-report-no')).toBe(false);
    expect(has(await reader(), 'legal-report-no')).toBe(false);
  });
  test('값이 있으면 약관 맨 아래에 보이고, 처리방침 탭에는 없다', async () => {
    const tree = await reader(FULL);
    expect(textOf(tree, 'legal-report-no')).toBe('국내결혼중개업 신고번호 서울-강남-국내-2027-0001');
    await press(tree, 'legal-tab-privacy');
    expect(has(tree, 'legal-report-no')).toBe(false);
  });
});

describe('카피.md 12-Q · 14장 확정 글이 앱 글과 같다', () => {
  test('동의 관리: 옛 CONSENT_LATER 5줄이 CONSENT_MANAGE 로 옮겨졌고 CK4 끄기 본문은 v5 글', () => {
    expect('CONSENT_LATER' in settingsCopy).toBe(false);
    expect(CONSENT_MANAGE).toMatchObject({
      askLater: '처음 쓸 때 따로 물어요.',
      offTitle: '동의를 거둘까요?',
      offBody: '거두면 그때부터 모으지 않고, 이미 모은 정보도 바로 지워요.',
      ck15OffBody: '거두면 정치 성향 답을 바로 지워요. 다시 동의하고 답하기 전까지는 탑승권을 살 수 없어요.',
      offConfirm: '거두기',
      ck4OffBody: "입력한 종교 정보가 지워지고 '답하지 않음'으로 바뀌어요. 종교는 꼭 맞아야 하는 조건이라, 다시 답하기 전까지 탑승권을 살 수 없어요.",
    });
    expect(WITHDRAW.credit).toBe('탈퇴하면 남은 크레딧은 더 쓸 수 없어요. 공개 전인 탑승권은 이용약관 제14조의2에 따라 처리해요.');
  });

  test('설정 등급 줄 · 내 등급 화면 글(14-1)에 구독 · 위 등급 말이 없다', () => {
    const texts = [SETTINGS16.stopNote, SETTINGS16.stopConfirm.body, GRADE16.limits, GRADE16.stoppedBody, GRADE16.howWho, GRADE16.howRelation];
    for (const t of texts) expect(t).not.toMatch(/구독|위 등급|먼저 추천/);
    expect(GRADE16.limits.endsWith('등급은 주간 매칭에서 짝을 고르는 데 쓰여요.')).toBe(true);
    for (const k of ['locked', 'lockedSub', 'howTop', 'howFew']) expect(k in GRADE16).toBe(false);
  });

  test('설문 · 프로필 글(14-2): "추천" → "짝"', () => {
    expect(PROFILE.visibilitySubtitle).toBe('공개하지 않은 항목도 짝을 고르는 데에는 쓰여요. 다른 분에게 보이는 항목만 내가 정해요.');
    expect(PROFILE.firstBody.endsWith('짝을 고를 때는 끈 항목도 쓰여요.')).toBe(true);
    expect(SURVEY_LITE.hiddenUsedLine).toBe('이 항목은 상대에게 보이지 않아요. 짝을 고를 때만 쓰여요.');
    expect(QUESTION_COPY.A06.help).toBe('종교는 짝을 고르는 데만 쓰고 등급에는 쓰지 않아요. 종교가 같은 분끼리 이어져요.');
    expect(QUESTION_COPY.F07.help).toBe("'그 외'는 종교를 '그 외'로 고른 분끼리 이어져서 여기서는 고를 수 없어요.");
    expect(QUESTION_COPY.F12.help).toBe('고른 조건은 짝을 고를 때 더 무겁게 봐요. 고르지 않아도 괜찮아요.');
    expect(CHAT_V6['CHAT.F12.ack.t1']).toBe('고른 조건은 짝을 고를 때 더 무겁게 볼게요. 나중에 바꿀 수 있어요.');
  });
});
