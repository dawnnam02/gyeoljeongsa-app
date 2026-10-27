// F13 조건 5 → v5(QP-A, 카피.md 12-Q): 12 설정 — '크레딧 · 구매 내역' 줄(→ T5) · '등급 계산 멈추기'(set_grade_processing, 카피 C7) · 멈춤 상태 화면(reason 'stopped')
//  '내 등급 보이기'(CK10) 줄 · 탈퇴 확인창 구독 안내(NV36)는 v5에 없다. 실제 settingsApi · gradeApi 를 모의 서버 위에서 돌린다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { WITHDRAW } from '@/content/settingsCopy';
import * as shopCopy from '@/content/shopCopy';
import { GRADE16, SETTINGS16, SHOP16 } from '@/content/shopCopy';
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

describe('12 목록 · 줄 (v5, QP-A)', () => {
  test('"크레딧 · 구매 내역" 줄이 인증 서류 제출 아래에 있고, 누르면 T5 크레딧 · 내역(/credits)으로 간다 · 옛 "구매 · 등급 구독" 줄은 없다', async () => {
    const { tree } = await open('plain');
    expect(must(tree, 'settings-row-credits').props.label).toBe('크레딧 · 구매 내역');
    expect(has(tree, 'settings-row-purchase')).toBe(false);
    expect('settingsRow' in SHOP16).toBe(false);
    await tap(tree, 'settings-row-credits');
    expect(mockRouter.push).toHaveBeenCalledWith('/credits');
  });

  test('등급 스위치는 "등급 계산 멈추기"(처음값 꺼짐) + v5 설명 하나 — "내 등급 보이기" 줄과 아래 글은 없다(12-Q)', async () => {
    const { tree } = await open('plain');
    expect(has(tree, 'settings-grade-switches')).toBe(true);
    expect(has(tree, 'settings-grade-show')).toBe(false);
    expect(hasText(tree, '내 등급 보이기')).toBe(false);
    expect(hasText(tree, '등급 계산 멈추기')).toBe(true);
    expect(hasText(tree, '멈추면 내 등급을 지우고 더 계산하지 않아요. 등급이 없으면 짝을 고를 수 없어서, 다시 켜기 전까지 탑승권을 살 수 없어요.')).toBe(true);
    expect(must(tree, 'settings-grade-stop').props.on).toBe(false);
    expect('showRow' in SETTINGS16 || 'showNote' in SETTINGS16).toBe(false);
  });

  test('이 화면의 등급 말은 "등급 계산 멈추기"와 설명뿐이고 구독 · 점수 · 순위 말은 없다', async () => {
    const { tree } = await open('plain');
    const withWord = allTexts(tree).filter((t) => /등급|점수|순위/.test(t));
    expect(withWord).toEqual(['내 등급', '등급 계산 멈추기', SETTINGS16.stopNote]); // '내 등급' 줄(D-200 ②) · 멈추기 줄
    expect(allTexts(tree).some((t) => /점수|순위|구독/.test(t))).toBe(false);
  });

  test('등급 계산을 멈췄다 다시 켜도 CK10 동의 기록은 생기거나 바뀌지 않는다(v5에 쓰는 곳 없음 — 기록 처리는 법무 · 서버 몫)', async () => {
    const { tree, backend, email } = await open('plain');
    await tap(tree, 'settings-grade-stop');
    await tap(tree, 'settings-grade-stop-confirm-confirm');
    await tap(tree, 'settings-grade-stop');
    expect(consentsOf(backend, email)).toHaveLength(0);
  });

  test('grade 연결이 없으면(옛 시험 · 읽기 전용 화면) 스위치 묶음을 그리지 않는다', async () => {
    const { tree } = await open('plain', false);
    expect(has(tree, 'settings-grade-switches')).toBe(false);
  });

  test('멈춤 여부를 읽지 못해도(인터넷 끊김) 스위치 줄은 이 기기 값으로 그린다', async () => {
    const rig = await makeShopRig('plain');
    const settings = createSettingsApi(rig.client, 'test');
    const grade = { ...rig.gradeApi, loadProcessing: async () => ({ ok: false as const, reason: 'network' as const }) };
    const deps: SettingsDeps = { api: settings, grade, now: () => rig.deps.now(), resetLocal: jest.fn(), pushStatus: async () => 'granted', requestPush: async () => 'granted', copyText: async () => true, openMail: async () => undefined };
    const tree = await mount(<SettingsScreen deps={deps} />);
    trees.push(tree);
    await flush();
    expect(must(tree, 'settings-grade-stop').props.on).toBe(false);
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
    expect(SETTINGS16.stopConfirm.body).toBe('멈추면 내 등급이 지워지고, 다시 켜기 전까지 탑승권을 살 수 없어요. 크레딧은 그대로 남아요. 설정에서 다시 켜면 다시 계산해요.');
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
    expect(await rig.gradeApi.loadMine()).toMatchObject({ ok: true, data: { kind: 'pending', reason: 'stopped' } }); // 0039 v5: 모든 회원이 멈춤 상태를 본다(구독 잠금 0)
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
    expect(GRADE16.howReview).toContain('멈추면 내 등급이 지워지고 짝을 고르는 데도 더는 쓰이지 않아서, 다시 켜기 전까지 탑승권을 살 수 없어요.');
  });
});

describe('탈퇴 확인창 아래 줄 (v5, QP-A · 12-Q WITHDRAW.credit)', () => {
  test('구독자였던 사람도 구독 안내(NV36) · [구독 관리] 없이 크레딧 줄 하나만 있다', async () => {
    const { tree } = await open('shopsub');
    await tap(tree, 'settings-withdraw');
    expect(textOf(tree, 'withdraw-confirm-note-text')).toBe('탈퇴하면 남은 크레딧은 더 쓸 수 없어요. 공개 전인 탑승권은 이용약관 제14조의2에 따라 처리해요.');
    expect(find(tree, 'withdraw-confirm-note-action')).toBeNull();
    expect('WITHDRAW_SUB_NOTE' in shopCopy).toBe(false);
  });

  test('구독이 없으면 크레딧 줄(약관 제22조 ⑧, L17A)만 있다', async () => {
    const { tree } = await open('plain');
    await tap(tree, 'settings-withdraw');
    expect(textOf(tree, 'withdraw-confirm-note-text')).toBe(WITHDRAW.credit);
    expect(find(tree, 'withdraw-confirm-note-action')).toBeNull();
    expect(allTexts(tree).some((t) => t.includes('구독'))).toBe(false);
  });
});
