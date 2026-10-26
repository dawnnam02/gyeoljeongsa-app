// F13 조건 5: 12 설정 — '구매 · 등급 구독'(NV35) 줄 · '내 등급 보이기'(CK10) · '등급 계산 멈추기'(set_grade_processing, 카피 C7) · 멈춤 상태 화면(reason 'stopped')
//  구독 이용 중 탈퇴 확인창의 안내(NV36 + [구독 관리]) · 구독 끝남(NV65). 실제 settingsApi · gradeApi 를 모의 서버 위에서 돌린다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { WITHDRAW } from '@/content/settingsCopy';
import { GRADE16, SETTINGS16, SHOP16, WITHDRAW_SUB_NOTE } from '@/content/shopCopy';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';
import { createSettingsApi } from '@/lib/settingsApi';
import { resetGradeSettings, useGradeSettingsStore } from '@/store/gradeSettingsStore';

import { allTexts, find, has, hasText, mount, must, press, textOf } from './renderHelpers';
import { makeShopRig } from './shopRig';

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
jest.mock('@/lib/services', () => ({ likesApi: {}, settingsApi: {}, gradeApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

const trees: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => trees.splice(0).forEach((t) => t.unmount()));
});
beforeEach(() => {
  jest.clearAllMocks();
  act(() => resetGradeSettings());
});
const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const tap = async (tree: ReactTestRenderer, id: string) => {
  await press(tree, id);
  await flush();
};

async function open(scene: string, withGrade = true) {
  const rig = await makeShopRig(scene);
  const settings = createSettingsApi(rig.client, 'test');
  const deps: SettingsDeps = {
    api: settings,
    grade: withGrade ? rig.gradeApi : undefined,
    now: () => rig.deps.now(),
    resetLocal: jest.fn(),
    pushStatus: async () => 'granted',
    requestPush: async () => 'granted',
    copyText: async () => true,
    openMail: async () => undefined,
  };
  const tree = await mount(<SettingsScreen deps={deps} />);
  trees.push(tree);
  await flush();
  return { tree, settingsDeps: deps, ...rig };
}
const consentsOf = (backend: Awaited<ReturnType<typeof makeShopRig>>['backend'], email: string) => backend.peek.consents(email).filter((c) => c.item_code === 'CK10');

describe('12 목록 · 줄', () => {
  test('"구매 · 등급 구독"(NV35) 줄이 인증 서류 제출 아래에 있고, 누르면 16 상점의 이용권 · 구매 내역 쪽으로 간다(V2-8)', async () => {
    const { tree } = await open('plain');
    expect(must(tree, 'settings-row-purchase').props.label).toBe('구매 · 등급 구독');
    expect(SHOP16.settingsRow).toBe('구매 · 등급 구독');
    await tap(tree, 'settings-row-purchase');
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/shop', params: { page: 'inventory', from: '12' } }); // from = 연 화면(F18: ‹ 가 12 로)
  });

  test('등급 스위치 둘: "내 등급 보이기"(처음값 꺼짐) + 설명 · "등급 계산 멈추기"(처음값 꺼짐) + 설명(C7) — 글자 그대로', async () => {
    const { tree } = await open('plain');
    expect(has(tree, 'settings-grade-switches')).toBe(true);
    expect(hasText(tree, '내 등급 보이기')).toBe(true);
    expect(hasText(tree, '켜면 등급 구독 회원이 추천에서 내 등급을 볼 수 있어요.')).toBe(true);
    expect(hasText(tree, '등급 계산 멈추기')).toBe(true);
    expect(hasText(tree, '멈추면 내 등급을 지우고 더 계산하지 않아요. 등급 구독 회원의 추천 상대를 고르는 데도 쓰이지 않아요. 등급 구독 중이면 내 등급 화면이 비어요.')).toBe(true);
    expect(must(tree, 'settings-grade-show').props.on).toBe(false);
    expect(must(tree, 'settings-grade-stop').props.on).toBe(false);
    expect(SETTINGS16.stopNote).toContain('내 등급 화면이 비어요');
  });

  test('이 화면의 등급 말은 허용 줄(NV35 · 내 등급 보이기 · 등급 계산 멈추기와 설명)뿐이고 점수 · 순위 말은 없다', async () => {
    const { tree } = await open('plain');
    const withWord = allTexts(tree).filter((t) => /등급|점수|순위/.test(t));
    expect(withWord).toEqual(['구매 · 등급 구독', '내 등급 보이기', SETTINGS16.showNote, '등급 계산 멈추기', SETTINGS16.stopNote]);
    expect(allTexts(tree).some((t) => /점수|순위/.test(t))).toBe(false);
  });

  test('grade 연결이 없으면(옛 시험 · 읽기 전용 화면) 스위치 묶음을 그리지 않는다', async () => {
    const { tree } = await open('plain', false);
    expect(has(tree, 'settings-grade-switches')).toBe(false);
  });
});

describe('내 등급 보이기 (CK10 선택 동의)', () => {
  test('켜면 동의 기록 한 줄이 생기고(판 consent-2026.10.15-v1), 끄면 철회된다 · 토스트 "저장했어요."', async () => {
    const { tree, backend, email } = await open('plain');
    expect(consentsOf(backend, email)).toHaveLength(0);
    await tap(tree, 'settings-grade-show');
    const rows = consentsOf(backend, email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ agreed: true, text_version: 'consent-2026.10.15-v1', revoked_at: null });
    expect(must(tree, 'settings-grade-show').props.on).toBe(true);
    expect(hasText(tree, '저장했어요.')).toBe(true);
    await tap(tree, 'settings-grade-show');
    expect(consentsOf(backend, email)[0].revoked_at).not.toBeNull();
    expect(must(tree, 'settings-grade-show').props.on).toBe(false);
  });

  test('CK10 을 꺼도 등급 계산은 멈추지 않는다(두 스위치는 따로 움직인다)', async () => {
    const { tree, backend, email } = await open('shopsub');
    await tap(tree, 'settings-grade-show');
    await tap(tree, 'settings-grade-show');
    expect(backend.peek.shop(email)?.processing).toBe(true);
  });

  test('이미 켜 둔 사람은 켜진 채로 열린다', async () => {
    const rig = await makeShopRig('plain');
    const settings = createSettingsApi(rig.client, 'test');
    await settings.setOptional('CK10', true);
    const deps: SettingsDeps = { api: settings, grade: rig.gradeApi, now: () => rig.deps.now(), resetLocal: jest.fn(), pushStatus: async () => 'granted', requestPush: async () => 'granted', copyText: async () => true, openMail: async () => undefined };
    const tree = await mount(<SettingsScreen deps={deps} />);
    trees.push(tree);
    await flush();
    expect(must(tree, 'settings-grade-show').props.on).toBe(true);
  });

  test('저장 실패는 오류 글만 보이고 스위치는 그대로(인터넷 끊김 → 공통 오류)', async () => {
    const { tree, settingsDeps } = await open('plain');
    settingsDeps.api.setOptional = jest.fn(async () => ({ ok: false as const, reason: 'network' as const }));
    await tap(tree, 'settings-grade-show');
    expect(textOf(tree, 'settings-grade-error')).toBe('인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.');
    expect(must(tree, 'settings-grade-show').props.on).toBe(false);
  });
});

describe('등급 계산 멈추기 (set_grade_processing)', () => {
  test('켜면 서버가 계산을 멈추고(내 등급 삭제), 한 번 더 누르면 다시 계산한다', async () => {
    const { tree, backend, email } = await open('shopsub');
    await tap(tree, 'settings-grade-stop');
    await tap(tree, 'settings-grade-stop-confirm-confirm'); // 멈추는 쪽은 확인창 뒤에
    expect(backend.peek.shop(email)?.processing).toBe(false);
    expect(must(tree, 'settings-grade-stop').props.on).toBe(true);
    expect(useGradeSettingsStore.getState().stopped).toBe(true);
    await tap(tree, 'settings-grade-stop');
    expect(backend.peek.shop(email)?.processing).toBe(true);
    expect(must(tree, 'settings-grade-stop').props.on).toBe(false);
  });

  test('구독자가 멈춰 둔 채 설정을 열면 서버의 reason "stopped" 를 읽어 켜진 채로 보인다', async () => {
    const rig = await makeShopRig('shopsub');
    await rig.gradeApi.setProcessing(false);
    expect(await rig.gradeApi.loadMine()).toMatchObject({ ok: true, data: { kind: 'pending', reason: 'stopped' } });
    const settings = createSettingsApi(rig.client, 'test');
    const deps: SettingsDeps = { api: settings, grade: rig.gradeApi, now: () => rig.deps.now(), resetLocal: jest.fn(), pushStatus: async () => 'granted', requestPush: async () => 'granted', copyText: async () => true, openMail: async () => undefined };
    const tree = await mount(<SettingsScreen deps={deps} />);
    trees.push(tree);
    await flush();
    expect(must(tree, 'settings-grade-stop').props.on).toBe(true);
  });

  test('16-N 확인창: 멈출 때만 뜨고(제목 · 본문 · 멈추기 / 취소), 취소하면 아무것도 바뀌지 않으며, 다시 계산하는 쪽은 묻지 않는다', async () => {
    const { tree, backend, email } = await open('shopsub');
    await tap(tree, 'settings-grade-stop');
    expect(textOf(tree, 'settings-grade-stop-confirm-title')).toBe('등급 계산을 멈출까요?');
    expect(textOf(tree, 'settings-grade-stop-confirm-body')).toBe(SETTINGS16.stopConfirm.body);
    await tap(tree, 'settings-grade-stop-confirm-cancel');
    expect(backend.peek.shop(email)?.processing).not.toBe(false);
    await tap(tree, 'settings-grade-stop');
    await tap(tree, 'settings-grade-stop-confirm-confirm');
    expect(backend.peek.shop(email)?.processing).toBe(false);
    await tap(tree, 'settings-grade-stop'); // 다시 계산: 확인창 없이 바로
    expect(has(tree, 'settings-grade-stop-confirm-title')).toBe(false);
    expect(backend.peek.shop(email)?.processing).toBe(true);
  });

  test('비구독자도 멈출 수 있다(모든 회원 계산 · 모든 회원 멈추기)', async () => {
    const { tree, backend, email } = await open('plain');
    await tap(tree, 'settings-grade-stop');
    await tap(tree, 'settings-grade-stop-confirm-confirm'); // 멈추는 쪽은 확인창 뒤에
    expect(backend.peek.shop(email)?.processing).toBe(false);
  });

  test('S8d: 비구독자가 멈춰 둔 채 설정을 열면 서버 get_grade_processing 값을 읽어 켜진 채로 보인다(앱을 다시 켜도 유지)', async () => {
    const rig = await makeShopRig('plain');
    await rig.gradeApi.setProcessing(false);
    expect(await rig.gradeApi.loadMine()).toMatchObject({ ok: true, data: { kind: 'locked' } }); // 비구독자는 reason 을 못 본다
    const settings = createSettingsApi(rig.client, 'test');
    const deps: SettingsDeps = { api: settings, grade: rig.gradeApi, now: () => rig.deps.now(), resetLocal: jest.fn(), pushStatus: async () => 'granted', requestPush: async () => 'granted', copyText: async () => true, openMail: async () => undefined };
    const tree = await mount(<SettingsScreen deps={deps} />);
    trees.push(tree);
    await flush();
    expect(must(tree, 'settings-grade-stop').props.on).toBe(true);
    await tap(tree, 'settings-grade-stop'); // 다시 계산
    expect(must(tree, 'settings-grade-stop').props.on).toBe(false);
  });

  test('멈춘 구독자의 16-G1 은 비어 있고 C7 설명을 보인다 · 구독 끝남 NV65 에는 "설정에서 등급 계산을 멈출 수 있어요."가 있다', () => {
    expect(SHOP16.endedSub).toContain('설정에서 등급 계산을 멈출 수 있어요.');
    expect(SHOP16.endedSub).toContain('내 등급은 계속 계산되고 등급 구독 회원의 추천 상대를 고르는 데 쓰여요.');
    expect(GRADE16.howReview).toContain('멈추면 내 등급이 지워지고 추천 상대를 고르는 데도 더는 쓰이지 않아요.');
  });
});

describe('탈퇴 확인창 · 구독 이용 중(NV36, 법무 C5)', () => {
  test('구독자: 확인창에 "탈퇴해도 스토어의 등급 구독 결제는 멈추지 않아요…" + [구독 관리] → 16 상점의 구독 관리', async () => {
    const { tree } = await open('shopsub');
    await tap(tree, 'settings-withdraw');
    expect(textOf(tree, 'withdraw-confirm-note-text')).toBe(WITHDRAW_SUB_NOTE);
    expect(WITHDRAW_SUB_NOTE).toBe('탈퇴해도 스토어의 등급 구독 결제는 멈추지 않아요. 먼저 [구독 관리]에서 해지해 주세요. 탈퇴 뒤 결제된 금액은 고객센터로 알려 주시면 돌려드려요.');
    await tap(tree, 'withdraw-confirm-note-action');
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/shop', params: { page: 'manage', from: '12' } });
  });

  test('구독이 없으면 구독 안내 대신 크레딧 줄(약관 제22조 ⑧, L17A)만 있다', async () => {
    const { tree } = await open('plain');
    await tap(tree, 'settings-withdraw');
    expect(textOf(tree, 'withdraw-confirm-note-text')).toBe(WITHDRAW.credit);
    expect(find(tree, 'withdraw-confirm-note-action')).toBeNull();
    expect(allTexts(tree).some((t) => t.includes('구독 결제는 멈추지 않아요'))).toBe(false);
  });
});
