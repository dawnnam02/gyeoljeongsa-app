// QP-A 2부-나: 검수 결함(검수/QP_결함목록.md) 고침 시험 — QP-01 공개 뒤 10 · QP-04 자리 글 숨김 · QP-09 성향 막대 숫자 · QP-13 말풍선 누르는 면 · 마케팅 QPM 3-2.
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';

import { LegalBlockList } from '@/components/LegalBlocks';
import { fillText, visibleLegalBlocks } from '@/content/fillLegal';
import { LEGAL_PRIVACY } from '@/content/legalPrivacy';
import { LEGAL_TERMS } from '@/content/legalTerms';
import type { LegalBlock } from '@/content/types';
import { TraitBar, TraitSlider } from '@/features/ai/TraitBar';
import { BOARDING, CREDITS } from '@/features/boarding/boardingCopy';
import { CHAT } from '@/features/chat/chatCopy';
import { CandidateScreen, type CandidateDeps } from '@/features/recs/CandidateScreen';
import { MeBubble } from '@/features/surveyChat/parts';
import { createGradeApi } from '@/lib/gradeApi';
import { createLikesApi } from '@/lib/likesApi';
import { createRecsApi } from '@/lib/recsApi';
import { size } from '@/theme/tokens';

import { allTexts, has, mount, press } from './renderHelpers';
import { makeShopRig } from './shopRig';

jest.setTimeout(90_000);

const mockRouter = { setParams: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, gradeApi: {}, profileApi: { facePhotoUrl: async () => null }, supabase: {} }));

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of shown.splice(0)) tree.unmount();
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
});
const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

async function openCandidate(params: Record<string, string>, chat?: CandidateDeps['chat']) {
  const rig = await makeShopRig('plain');
  Object.assign(mockParams, params);
  const api = createRecsApi(rig.client, rig.deps.now);
  const pairState = jest.spyOn(api, 'pairState');
  const grade = createGradeApi(rig.client);
  const partnerGrade = jest.spyOn(grade, 'partnerGrade');
  const deps: CandidateDeps = { api, likes: createLikesApi(rig.client), grade, chat, toastMs: 50 };
  const tree = await mount(<CandidateScreen deps={deps} />);
  shown.push(tree);
  await flush();
  return { tree, pairState, partnerGrade, api };
}

describe('QP-01(치명) · 공개 뒤 10 상대 상세는 보기 + [대화 시작하기]만', () => {
  test('T3 [프로필 자세히 보기]로 오면 넘기기 · 호감 · 수락/거절 · 왜 추천 · 수락 뒤 연락 줄 0, 아래 버튼은 [대화 시작하기] 하나 → 그 대화방', async () => {
    const { tree, pairState, partnerGrade } = await openCandidate({ id: 'demo-cand-1', from: 'reveal', chat: 'demo-chat-1-1' });
    expect(has(tree, 'candidate-head')).toBe(true);
    for (const id of ['candidate-pass', 'candidate-like', 'candidate-accept', 'candidate-decline', 'candidate-connected', 'candidate-why', 'candidate-grade', 'candidate-prompts-note']) expect(has(tree, id)).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/추천|호감|수락한 뒤|등급/);
    expect(pairState).not.toHaveBeenCalled(); // 짝은 이미 이어졌다 — 호감 상태 · 상대 등급을 읽지 않는다
    expect(partnerGrade).not.toHaveBeenCalled();
    await press(tree, 'candidate-chat');
    expect(mockRouter.push).toHaveBeenCalledWith('/chat/demo-chat-1-1');
  });

  test('R-A: 대화방에서 연 10 의 차단은 v5 대화 함수(방 번호)로 — v4 block_user 를 부르지 않는다', async () => {
    const chat = { report: jest.fn(async () => ({ ok: true as const })), block: jest.fn(async () => ({ ok: true as const })) };
    const { tree, api } = await openCandidate({ id: 'demo-cand-1', from: 'reveal', chat: 'demo-chat-1-1' }, () => chat);
    const v4Block = jest.spyOn(api, 'block');
    await press(tree, 'candidate-header-right');
    await press(tree, 'report-menu-block');
    await press(tree, 'report-block-confirm-confirm');
    await flush();
    expect(chat.block).toHaveBeenCalledWith('demo-chat-1-1');
    expect(v4Block).not.toHaveBeenCalled();
  });

  test('대화방 번호가 없으면 아래 버튼 자리도 없다 · 뒤로는 T3(없으면 탑승권 탭)', async () => {
    const { tree } = await openCandidate({ id: 'demo-cand-1', from: 'reveal' });
    expect(has(tree, 'candidate-cta')).toBe(false);
    expect(has(tree, 'candidate-chat')).toBe(false);
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await press(tree, 'candidate-header-back');
    expect(mockRouter.replace).toHaveBeenCalledWith('/boarding');
  });

  test('옛 v4 길(09 · 11에서 연 10, 스위치가 켜졌을 때만)은 그대로 — [넘기기] · [호감 보내기]가 있다', async () => {
    const { tree } = await openCandidate({ id: 'demo-cand-1' });
    expect(has(tree, 'candidate-pass')).toBe(true);
    expect(has(tree, 'candidate-chat')).toBe(false);
  });
});

describe('QP-04 · 자리 글({…})은 값이 있으면 넣고, 비면 그 줄을 숨긴다', () => {
  test('fillText: 아는 자리만 채운다 · 값이 비면 missing', () => {
    expect(fillText('대표 {대표자}', { 대표자: '홍길동' })).toEqual({ text: '대표 홍길동', missing: false });
    expect(fillText('대표 {대표자}', { 대표자: null })).toEqual({ text: '대표 {대표자}', missing: true });
    expect(fillText('글 {모르는 자리}', { 대표자: null })).toEqual({ text: '글 {모르는 자리}', missing: false });
  });

  test('표는 그 행만 · 문단 · 목록 줄은 그 줄만 숨긴다 · 남은 행이 없으면 표째', () => {
    const blocks: LegalBlock[] = [
      { type: 'table', header: ['항목', '내용'], rows: [['상호', '{운영자 상호 또는 성명}'], ['문의', '도움말']] },
      { type: 'p', text: '이 약관은 {공개일}부터 시행합니다.' },
      { type: 'li', depth: 0, marker: '•', text: '그대로인 줄' },
      { type: 'table', header: ['a'], rows: [['{대표자}']] },
    ];
    const empty = { '운영자 상호 또는 성명': null, 공개일: null, 대표자: null };
    expect(visibleLegalBlocks(blocks, empty)).toEqual([
      { type: 'table', header: ['항목', '내용'], rows: [['문의', '도움말']] },
      { type: 'li', depth: 0, marker: '•', text: '그대로인 줄' },
    ]);
    const full = { '운영자 상호 또는 성명': '결정사(시험)', 공개일: '2027년 1월 1일', 대표자: '홍길동' };
    expect(JSON.stringify(visibleLegalBlocks(blocks, full))).toContain('이 약관은 2027년 1월 1일부터 시행합니다.');
  });

  test('지금(값이 모두 빈) 약관 · 처리방침 화면 글에 자리 글이 하나도 없다', async () => {
    for (const doc of [LEGAL_TERMS, LEGAL_PRIVACY]) {
      const shownBlocks = visibleLegalBlocks(doc);
      expect(JSON.stringify(shownBlocks)).not.toMatch(/\{(운영자|대표자|주소|전화번호|사업자등록번호|결혼중개업|통신판매업|고객센터|공개일|약관 웹|처리방침 웹|스토어|보호책임자|직책|Supabase|수수료표|보증보험)[^}]*\}/);
      expect(shownBlocks.length).toBeGreaterThan(doc.length / 2); // 숨기는 것은 자리 글이 든 줄뿐
    }
    const tree = await mount(<LegalBlockList blocks={LEGAL_TERMS.slice(0, 20)} testID="legal-test" />);
    shown.push(tree);
    expect(allTexts(tree).some((t) => /\{[^}]+\}/.test(t))).toBe(false);
  });
});

describe('QP-09 · QP-13 모양', () => {
  test('07 성향 막대 옆 숫자 글자 0 · 스크린리더 값은 그대로', async () => {
    const tree = await mount(
      <View>
        <TraitBar name="외향성" value={70} testID="t-bar" />
        <TraitSlider name="계획성" value={40} onChange={() => undefined} testID="t-slider" />
      </View>,
    );
    shown.push(tree);
    expect(allTexts(tree)).not.toContain('70');
    expect(allTexts(tree)).not.toContain('40');
    expect(tree.root.findAll((n) => n.props?.testID === 't-bar' && n.props.accessibilityValue?.now === 70).length).toBeGreaterThan(0);
  });

  test('대화형 설문 내 답 말풍선: 누르는 면 높이 48 이상', async () => {
    const tree = await mount(<MeBubble text="여자" onPress={() => undefined} testID="chat-me-A02" />);
    shown.push(tree);
    const node = tree.root.findAll((n) => n.props.testID === 'chat-me-A02' && n.props.style !== undefined)[0];
    const flat = StyleSheet.flatten(node.props.style) as { minHeight?: number };
    expect(flat.minHeight).toBeGreaterThanOrEqual(size.touchMin);
    expect(size.touchMin).toBeGreaterThanOrEqual(48);
  });
});

describe('마케팅 QPM 3-2 · 카피.md 14-5-2 고쳐 확정 글', () => {
  test('짝 없는 회차 이유 줄 없음 · 크레딧 내역 이유 한 줄 · 등급 계산 멈춤 · 채팅 오류 글', () => {
    expect('reasons' in BOARDING.noMatch).toBe(false);
    expect(new Set([CREDITS.reasons.balance, CREDITS.reasons.no_fit, CREDITS.reasons.gap])).toEqual(new Set(['짝을 찾지 못해 돌려받음']));
    expect(BOARDING.ineligible.paused.title).toBe('등급 계산이 멈춰 있어요');
    expect(JSON.stringify([BOARDING, CREDITS])).not.toMatch(/수준이 가까운|남녀 수가 맞지 않아|늦게 탑승한/);
    expect(CHAT.send.limited).toBe('요청이 많았어요. 잠시 뒤에 다시 보내 주세요.');
    expect(CHAT.voice.denied).toBe('음성을 보내려면 마이크 권한이 필요해요. 기기 설정에서 켤 수 있고, 글과 사진은 그대로 보낼 수 있어요.');
  });
});
