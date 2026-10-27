// 03 약관 · 동의 화면(F1 통과 조건 3 · 4 · 5 · 6): 체크 9칸 + 맨 위 칸 + 안내 상자 · 필수 미체크 오류 · 모두 동의 토글 ·
// 요약 · 전문 시트 · 저장(동의 기록) · 뒤로가기 · 문구가 바뀐 뒤 재동의.
import { act } from 'react-test-renderer';
import { BackHandler } from 'react-native';

import { CONSENT_ERROR, CONSENT_ITEMS, CONSENT_LINKS, CONSENT_NOTICE, CONSENT_SUBTITLE, CONSENT_TOP } from '@/content/consentContent';
import { COMMON, CONSENT } from '@/content/copy';
import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { ConsentRow } from '@/features/consent/ConsentRow';
import { ConsentScreen, type ConsentDeps } from '@/features/consent/ConsentScreen';
import type { ConsentRowInput } from '@/lib/consentApi';

import { allTexts, find, has, hasText, isOpen, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
const mockParams: Record<string, string | undefined> = {};
const mockSetStage = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Stack: { Screen: () => null },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/store', () => ({ useSignupStore: { getState: () => ({ setStage: mockSetStage }) } }));
jest.mock('@/lib/services', () => ({ likesApi: {}, authApi: {}, supabase: {} }));

jest.setTimeout(30_000); // 화면을 통째로 그리는 시험이라 느린 PC 에서는 기본 5초가 모자란다

type Tree = Awaited<ReturnType<typeof mount>>;
const CODES = CONSENT_ITEMS.map((i) => i.code);
const REQUIRED = CONSENT_ITEMS.filter((i) => i.required).map((i) => i.code);
const OPTIONAL = CONSENT_ITEMS.filter((i) => !i.required).map((i) => i.code);

function makeDeps(overrides: Partial<ConsentDeps> = {}) {
  const record = jest.fn<ReturnType<ConsentDeps['record']>, [ConsentRowInput[]]>(async () => ({ ok: true }));
  const signOut = jest.fn(async () => undefined);
  const deps: ConsentDeps = {
    userId: async () => 'user-1',
    loadActive: async () => ({ ok: true, rows: [] }),
    record,
    signOut,
    ...overrides,
  };
  return { deps, record, signOut };
}

let backHandlers: (() => boolean | null | undefined)[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  mockRouter.canDismiss.mockReturnValue(false);
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler as () => boolean | null | undefined);
    return { remove: () => undefined };
  });
});
afterEach(() => jest.restoreAllMocks());

const render = (deps: ConsentDeps) => mount(<ConsentScreen deps={deps} />);
const checked = (tree: Tree, id: string) => must(tree, id).props['aria-checked'] as boolean;
const rowChecked = (tree: Tree, code: string) => checked(tree, `consent-check-${code}`);
const states = (tree: Tree) => Object.fromEntries(CODES.map((code) => [code, rowChecked(tree, code)]));
const emphasized = (tree: Tree) => tree.root.findAllByType(ConsentRow).filter((row) => row.props.emphasized).map((row) => row.props.item.code as string);
const toggle = (tree: Tree, code: string) => press(tree, `consent-check-${code}`);
const checkAllRequired = async (tree: Tree) => {
  for (const code of REQUIRED) await toggle(tree, code);
};

describe('화면 구성 (동의문구 3-1: 위에서 아래 순서)', () => {
  test('제목 · 부제가 카피.md 03 그대로이고, 상단 바 제목은 "약관 동의"다', async () => {
    const tree = await render(makeDeps().deps);
    expect(hasText(tree, '약관 동의')).toBe(true);
    expect(textOf(tree, 'consent-title')).toBe('시작하려면 동의가 필요해요');
    expect(textOf(tree, 'consent-subtitle')).toBe(CONSENT_SUBTITLE);
    expect(CONSENT_SUBTITLE).toBe('꼭 필요한 항목에만 [필수]를 붙였어요. [선택] 항목은 동의하지 않아도 가입할 수 있어요.');
  });

  test('체크 줄 9개가 CK1 ~ CK9 순서로 있고, 안내 상자는 CK3 와 CK4 사이에 있다', async () => {
    const tree = await render(makeDeps().deps);
    const ids = tree.root
      .findAll((n) => typeof n.props.testID === 'string' && /^consent-(row-CK\d|notice)$/.test(n.props.testID))
      .map((n) => n.props.testID as string)
      .filter((id, i, all) => all.indexOf(id) === i);
    expect(ids).toEqual(['consent-row-CK1', 'consent-row-CK2', 'consent-row-CK3', 'consent-notice', 'consent-row-CK4', 'consent-row-CK5', 'consent-row-CK6', 'consent-row-CK7', 'consent-row-CK8', 'consent-row-CK9']);
  });

  test('체크 줄 9개의 글이 법무 확정 문구(동의문구.md 4장)와 한 글자도 다르지 않다', async () => {
    const tree = await render(makeDeps().deps);
    const texts = allTexts(tree);
    for (const item of CONSENT_ITEMS) {
      expect(texts).toContain(item.label);
      expect(must(tree, `consent-check-${item.code}`).props.accessibilityLabel).toBe(item.label);
    }
    expect(CONSENT_ITEMS.map((i) => i.label)).toEqual([
      '[필수] 이용약관에 동의해요',
      '[필수] 만 24세 이상이에요', // D-100 · D-123(동의문구 CK2 · 판 consent-2026.10.18-v1)
      '[필수] 개인정보 수집·이용에 동의해요',
      '[선택] 민감정보(종교) 수집·이용에 동의해요',
      '[필수] 부모님 정보 입력 안내를 확인했어요',
      '[필수] 내 프로필이 다른 회원에게 보이는 것에 동의해요',
      '[필수] 운영팀이 내 사진을 확인하는 것에 동의해요',
      '[필수] AI 정리를 위한 정보 전송(해외 이전)에 동의해요',
      '[선택] 마케팅 알림(이벤트·새 소식) 받기에 동의해요',
    ]);
  });

  test('맨 위 칸 "필수 항목 모두 동의"와 덧붙이는 안내 "선택 항목은 따로 골라요."가 있다', async () => {
    const tree = await render(makeDeps().deps);
    expect(hasText(tree, '필수 항목 모두 동의')).toBe(true);
    expect(hasText(tree, '선택 항목은 따로 골라요.')).toBe(true);
    expect(CONSENT_TOP.label).toBe('필수 항목 모두 동의');
  });

  test('선택 칸(CK4 · CK9)과 확인 칸(CK5)에는 덧붙이는 안내가 항상 보인다', async () => {
    const tree = await render(makeDeps().deps);
    // 3부-사: CK4 덧붙이는 안내는 동의문구 4-4(consent-2026.10.27-v2 · L22) 판 — 생성 파일 글 그대로
    for (const note of ['동의하지 않아도 가입할 수 있어요. 다만 탑승권은 살 수 없어요.', '부모님 정보를 입력하는 것은 선택이에요.', '받지 않아도 서비스는 똑같이 쓸 수 있어요.']) expect(hasText(tree, note)).toBe(true);
  });

  test('안내 상자: 제목 "알아 두세요" + 본문이 CK4 를 체크하든 안 하든 보인다', async () => {
    const tree = await render(makeDeps().deps);
    expect(hasText(tree, '알아 두세요')).toBe(true);
    expect(hasText(tree, CONSENT_NOTICE.body)).toBe(true);
    await toggle(tree, 'CK4');
    expect(hasText(tree, CONSENT_NOTICE.body)).toBe(true);
    await toggle(tree, 'CK4');
    expect(hasText(tree, CONSENT_NOTICE.body)).toBe(true);
  });

  test('아래: 링크 줄 "이용약관 · 개인정보 처리방침 보기" + 작은 글씨 "동의한 내용과 처리방침은 설정에서 다시 볼 수 있어요."', async () => {
    const tree = await render(makeDeps().deps);
    expect(hasText(tree, '이용약관 · 개인정보 처리방침 보기')).toBe(true);
    expect(textOf(tree, 'consent-links-note')).toBe('동의한 내용과 처리방침은 설정에서 다시 볼 수 있어요.');
    expect(CONSENT_LINKS.small).toBe('동의한 내용과 처리방침은 설정에서 다시 볼 수 있어요.');
  });

  test('각 칸마다 "보기 ›" 가 있고, 체크 칸과 터치 영역이 따로다', async () => {
    const tree = await render(makeDeps().deps);
    for (const code of CODES) {
      expect(has(tree, `consent-more-${code}`)).toBe(true);
      expect(must(tree, `consent-more-${code}`).props.onPress).not.toBe(must(tree, `consent-check-${code}`).props.onPress);
    }
    expect(allTexts(tree).filter((t) => t === '보기 ›')).toHaveLength(9);
  });

  test('시안의 옛 문구("전체 동의" · "부모님 정보는 구간으로만 저장되고…")는 쓰지 않는다', async () => {
    const tree = await render(makeDeps().deps);
    expect(allTexts(tree).some((t) => t === '전체 동의' || t.includes('구간으로만 저장'))).toBe(false);
  });
});

describe('처음 상태 · 모두 동의 토글 (F1 조건 3)', () => {
  test('처음에는 맨 위 칸을 포함해 전부 해제이고 [동의하고 계속]은 흐리다', async () => {
    const tree = await render(makeDeps().deps);
    expect(Object.values(states(tree)).every((v) => v === false)).toBe(true);
    expect(checked(tree, 'consent-all')).toBe(false);
    expect(must(tree, 'consent-submit').props.dimmed).toBe(true);
    expect(has(tree, 'consent-error')).toBe(false);
  });

  test('맨 위 칸을 켜면 필수 7칸이 모두 켜지고 선택 2칸은 그대로 꺼져 있다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-all');
    for (const code of REQUIRED) expect(rowChecked(tree, code)).toBe(true);
    for (const code of OPTIONAL) expect(rowChecked(tree, code)).toBe(false);
    expect(checked(tree, 'consent-all')).toBe(true);
    expect(must(tree, 'consent-submit').props.dimmed).toBe(false);
  });

  test('맨 위 칸을 끄면 필수 7칸이 모두 꺼지고, 먼저 켜 둔 선택 칸은 그대로다', async () => {
    const tree = await render(makeDeps().deps);
    await toggle(tree, 'CK4');
    await toggle(tree, 'CK9');
    await press(tree, 'consent-all');
    await press(tree, 'consent-all');
    for (const code of REQUIRED) expect(rowChecked(tree, code)).toBe(false);
    expect(rowChecked(tree, 'CK4')).toBe(true);
    expect(rowChecked(tree, 'CK9')).toBe(true);
    expect(checked(tree, 'consent-all')).toBe(false);
  });

  test('필수 7칸을 하나씩 모두 켜면 맨 위 칸도 켜지고, 하나를 끄면 맨 위 칸도 꺼진다', async () => {
    const tree = await render(makeDeps().deps);
    await checkAllRequired(tree);
    expect(checked(tree, 'consent-all')).toBe(true);
    await toggle(tree, 'CK7');
    expect(checked(tree, 'consent-all')).toBe(false);
  });

  test('선택 칸만 켜도 맨 위 칸은 켜지지 않는다', async () => {
    const tree = await render(makeDeps().deps);
    await toggle(tree, 'CK4');
    await toggle(tree, 'CK9');
    expect(checked(tree, 'consent-all')).toBe(false);
    expect(must(tree, 'consent-submit').props.dimmed).toBe(true);
  });

  test('체크한 칸을 다시 누르면 해제된다', async () => {
    const tree = await render(makeDeps().deps);
    await toggle(tree, 'CK1');
    expect(rowChecked(tree, 'CK1')).toBe(true);
    await toggle(tree, 'CK1');
    expect(rowChecked(tree, 'CK1')).toBe(false);
  });
});

describe('필수 미체크 오류 (R7: 흐린 버튼을 눌러도 이동하지 않고 이유를 보인다)', () => {
  test('처음 눌러도 저장하지 않고 "필수 항목에 모두 동의해야 시작할 수 있어요." 가 보이며 필수 7칸이 강조된다', async () => {
    const { deps, record } = makeDeps();
    const tree = await render(deps);
    await press(tree, 'consent-submit');
    expect(textOf(tree, 'consent-error')).toBe('필수 항목에 모두 동의해야 시작할 수 있어요.');
    expect(textOf(tree, 'consent-error')).toBe(CONSENT_ERROR);
    expect(emphasized(tree).sort()).toEqual([...REQUIRED].sort());
    expect(record).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockSetStage).not.toHaveBeenCalled();
  });

  test('체크를 눌러 가며 채우면 강조가 하나씩 풀리고, 모두 채우면 오류 문구가 사라진다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-submit');
    await toggle(tree, 'CK1');
    expect(emphasized(tree)).not.toContain('CK1');
    expect(emphasized(tree)).toContain('CK2');
    expect(has(tree, 'consent-error')).toBe(true);
    for (const code of REQUIRED.filter((c) => c !== 'CK1')) await toggle(tree, code);
    expect(emphasized(tree)).toEqual([]);
    expect(has(tree, 'consent-error')).toBe(false);
  });

  test('선택 칸은 비어 있어도 강조하지 않는다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-submit');
    for (const code of OPTIONAL) expect(emphasized(tree)).not.toContain(code);
  });

  test('만 19세 이상 확인(CK2)만 빼고 모두 체크하고 눌러도 진행하지 못한다(F1 조건 5)', async () => {
    const { deps, record } = makeDeps();
    const tree = await render(deps);
    for (const code of REQUIRED.filter((c) => c !== 'CK2')) await toggle(tree, code);
    expect(must(tree, 'consent-submit').props.dimmed).toBe(true);
    await press(tree, 'consent-submit');
    expect(emphasized(tree)).toEqual(['CK2']);
    expect(has(tree, 'consent-error')).toBe(true);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('동의하고 계속 → 동의 기록 저장 → 04-01 (F1 조건 4)', () => {
  test('필수 7칸만 체크: 필수 7줄은 동의함으로, 선택 2줄(CK4 · CK9)은 동의하지 않음으로 한 번에 저장한다', async () => {
    const { deps, record } = makeDeps();
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await press(tree, 'consent-submit');
    expect(record).toHaveBeenCalledTimes(1);
    const rows = record.mock.calls[0][0];
    expect(rows).toHaveLength(9);
    expect(rows.map((r) => r.item_code)).toEqual(CODES);
    for (const row of rows) expect(row.agreed).toBe(REQUIRED.includes(row.item_code));
  });

  test('행마다 사용자 · 항목 코드 · 동의 여부 · 문구 판 · 앱 버전이 들어간다', async () => {
    const { deps, record } = makeDeps();
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await press(tree, 'consent-submit');
    for (const row of record.mock.calls[0][0]) {
      expect(row.user_id).toBe('user-1');
      expect(row.text_version).toBe(CONSENT_TEXT_VERSIONS[row.item_code]);
      expect(row.text_version).toMatch(/^consent-\d{4}\.\d{2}\.\d{2}-v\d+$/);
      expect(typeof row.app_version).toBe('string');
      expect(row.app_version.length).toBeLessThanOrEqual(32);
    }
  });

  test('선택 칸도 체크하면 9줄 모두 동의함이다', async () => {
    const { deps, record } = makeDeps();
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await toggle(tree, 'CK4');
    await toggle(tree, 'CK9');
    await press(tree, 'consent-submit');
    expect(record.mock.calls[0][0].every((r) => r.agreed)).toBe(true);
  });

  test('저장하기 전에는 아무것도 저장하지 않는다(체크만 해서는 서버 호출이 없다)', async () => {
    const { deps, record } = makeDeps();
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await toggle(tree, 'CK4');
    expect(record).not.toHaveBeenCalled();
  });

  test('저장이 끝나면 진행 단계를 "동의 끝"으로 알리고 04-01 로 간다(지나온 화면을 쌓아 두지 않는다)', async () => {
    mockRouter.canDismiss.mockReturnValue(true);
    const { deps } = makeDeps();
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await press(tree, 'consent-submit');
    expect(mockSetStage).toHaveBeenCalledWith('consented');
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/survey/[step]', params: { step: '01' } });
  });

  test('같은 버튼을 두 번 눌러도 저장 요청은 한 번이다(R9)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { deps, record } = makeDeps({
      record: jest.fn(async () => {
        await gate;
        return { ok: true } as const;
      }),
    });
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await act(async () => {
      const first = must(tree, 'consent-submit').props.onPress();
      const second = must(tree, 'consent-submit').props.onPress();
      release();
      await Promise.all([first, second]);
    });
    expect(deps.record).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled(); // makeDeps 의 기본 record 는 덮어썼다
  });

  test('저장하는 동안 버튼은 불러오는 모양이다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { deps } = makeDeps({
      record: async () => {
        await gate;
        return { ok: true };
      },
    });
    const tree = await render(deps);
    await press(tree, 'consent-all');
    let pending!: Promise<void>;
    await act(async () => {
      pending = must(tree, 'consent-submit').props.onPress();
    });
    expect(must(tree, 'consent-submit').props.loading).toBe(true);
    await act(async () => {
      release();
      await pending;
    });
  });

  test('저장에 실패하면(인터넷) 공통 문구가 보이고 체크는 그대로이며 이동하지 않는다. 다시 누르면 저장된다', async () => {
    let fail = true;
    const { deps } = makeDeps({ record: async () => (fail ? { ok: false, reason: 'network' } : { ok: true }) });
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await toggle(tree, 'CK9');
    await press(tree, 'consent-submit');
    expect(textOf(tree, 'consent-error')).toBe(COMMON.offline);
    expect(rowChecked(tree, 'CK9')).toBe(true);
    expect(checked(tree, 'consent-all')).toBe(true);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockSetStage).not.toHaveBeenCalled();
    fail = false;
    await press(tree, 'consent-submit');
    expect(mockSetStage).toHaveBeenCalledWith('consented');
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  test('서버 문제는 공통 서버 문구가 보인다', async () => {
    const { deps } = makeDeps({ record: async () => ({ ok: false, reason: 'server' }) });
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await press(tree, 'consent-submit');
    expect(textOf(tree, 'consent-error')).toBe(COMMON.server);
  });

  test('로그인이 풀렸으면 저장하지 않고 02 로 보낸다(분기 ⑦)', async () => {
    const { deps, record } = makeDeps({ userId: async () => null });
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await press(tree, 'consent-submit');
    expect(record).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { reason: 'session' } });
  });
});

describe("'보기 ›' 요약 시트 · 전문 시트 (동의문구 3-2 규칙 3 · 4)", () => {
  test("'보기 ›'를 누르면 시트가 열린다: 제목(체크 문구) · 왜 필요한지 · 요약 · 동의하지 않으면 · [전문 보기]", async () => {
    const tree = await render(makeDeps().deps);
    expect(isOpen(tree, 'consent-sheet')).toBe(false);
    await press(tree, 'consent-more-CK2');
    expect(isOpen(tree, 'consent-sheet')).toBe(true);
    const ck2 = CONSENT_ITEMS.find((i) => i.code === 'CK2');
    const texts = allTexts(tree);
    expect(texts.filter((t) => t === ck2?.label).length).toBeGreaterThanOrEqual(2); // 목록의 칸 + 시트 제목
    expect(textOf(tree, 'consent-why')).toBe('미성년자를 보호하려고 만 24세 이상만 이용할 수 있어요.'); // 이유 문장은 법무 V52 검토 중(D123_C①)
    for (const line of ck2?.summary ?? []) expect(texts).toContain(line);
    expect(textOf(tree, 'consent-declined')).toBe('동의하지 않으면: 가입할 수 없어요.');
    expect(hasText(tree, '전문 보기')).toBe(true);
  });

  test('요약 맨 위에 "왜 필요한지" 한 줄이 먼저 나온다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-more-CK1');
    const sheet = must(tree, 'consent-summary-CK1');
    const firstText = sheet.findAll((n) => typeof n.props.children === 'string')[0];
    expect(firstText.props.children).toBe('회원이 함께 지킬 이용 규칙이라서 동의가 필요해요.');
  });

  test('9칸 모두 요약 시트가 열리고 요약 줄이 법무 문서 그대로 보인다', async () => {
    const tree = await render(makeDeps().deps);
    for (const item of CONSENT_ITEMS) {
      await press(tree, `consent-more-${item.code}`);
      const texts = allTexts(tree);
      for (const line of item.summary) expect(texts).toContain(line);
      expect(textOf(tree, 'consent-declined')).toBe(`${item.declinedLabel}: ${item.declined}`);
      await press(tree, 'consent-sheet-close');
      expect(isOpen(tree, 'consent-sheet')).toBe(false);
    }
  });

  test('CK5 는 "동의하지 않으면" 대신 "확인하지 않으면: 이 안내를 확인해야 가입할 수 있어요. …" 줄이다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-more-CK5');
    expect(textOf(tree, 'consent-declined')).toBe('확인하지 않으면: 이 안내를 확인해야 가입할 수 있어요. 부모님 정보를 입력하는 것은 선택이에요.');
  });

  test('[전문 보기]를 누르면 같은 시트 아래에 전문(합니다체)이 열린다. 누르기 전에는 전문이 없다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-more-CK2');
    const sentence = '회원은 가입 신청일 현재 만 24세 이상이어야 합니다. 만 24세 이상이란 만 24세 생일이 지난 사람을 말합니다.';
    expect(allTexts(tree).some((t) => t.startsWith(sentence))).toBe(false);
    await press(tree, 'consent-full-open');
    expect(allTexts(tree).some((t) => t.startsWith(sentence))).toBe(true);
    expect(has(tree, 'consent-full-open')).toBe(false); // 열린 뒤에는 버튼이 없다
  });

  test('CK1 의 전문은 이용약관 전체다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-more-CK1');
    await press(tree, 'consent-full-open');
    expect(hasText(tree, '운영자 정보')).toBe(true); // 약관 본문의 첫 장
  });

  test('전문 시트를 닫았다가 다른 칸을 열면 전문은 다시 닫힌 채로 시작한다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-more-CK2');
    await press(tree, 'consent-full-open');
    await press(tree, 'consent-sheet-close');
    await press(tree, 'consent-more-CK3');
    expect(has(tree, 'consent-full-open')).toBe(true);
  });

  test("'보기 ›'를 눌러도 체크는 바뀌지 않는다. 전문을 읽지 않아도 체크할 수 있다", async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-more-CK1');
    await press(tree, 'consent-sheet-close');
    expect(rowChecked(tree, 'CK1')).toBe(false);
    await toggle(tree, 'CK1'); // 시트를 열지 않고도 체크
    expect(rowChecked(tree, 'CK1')).toBe(true);
  });
});

describe('링크 줄 → 이용약관 · 개인정보 처리방침 읽기 화면', () => {
  test('링크 줄을 누르면 읽기 화면이 이용약관으로 열리고, 처리방침 탭으로 바꿀 수 있다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-links');
    expect(isOpen(tree, 'legal-reader')).toBe(true);
    expect(must(tree, 'legal-tab-terms').props.variant).toBe('selected');
    await press(tree, 'legal-tab-privacy');
    expect(must(tree, 'legal-tab-privacy').props.variant).toBe('selected');
    expect(hasText(tree, '개인정보 처리방침')).toBe(true);
    await press(tree, 'legal-reader-close');
    expect(isOpen(tree, 'legal-reader')).toBe(false);
  });
});

describe('뒤로가기 (K2 4장 03: 로그인 상태를 끊고 02 로)', () => {
  test('‹ 를 누르면 로그인 상태를 끊고 진행 단계를 비우고 한 칸 뒤(02)로 간다', async () => {
    const { deps, signOut } = makeDeps();
    const tree = await render(deps);
    await press(tree, 'consent-all');
    await press(tree, 'consent-header-back');
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(mockSetStage).toHaveBeenLastCalledWith(null);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  test('쌓인 화면이 없으면(앱을 다시 켜서 바로 03 이 열린 경우) 02 로 갈아 끼운다', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-header-back');
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });

  test('Android 뒤로가기도 같다', async () => {
    const { deps, signOut } = makeDeps();
    await render(deps);
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = backHandlers[backHandlers.length - 1]();
    });
    await act(async () => {});
    expect(handled).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});

describe('동의 문구가 바뀐 뒤 로그인: 바뀐 칸만 다시 (동의문구 3-5 · N28)', () => {
  // F22(D-123): 칸마다 판이 달라졌다(CK2 = consent-2026.10.18-v1, 만 24세). '현재 판'은 칸마다 config/consent 의 값
  const OLD = 'consent-2025.01.01-v1';
  const rowsWithOld = (oldCodes: string[]) => REQUIRED.map((code) => ({ item_code: code, text_version: oldCodes.includes(code) ? OLD : CONSENT_TEXT_VERSIONS[code] }));

  beforeEach(() => {
    mockParams.mode = 'reconsent';
  });

  test('불러오는 동안 "불러오는 중이에요" 가 보인다', async () => {
    const tree = await render(makeDeps({ loadActive: () => new Promise(() => undefined) }).deps);
    expect(has(tree, 'screen-03-loading')).toBe(true);
    expect(hasText(tree, '불러오는 중이에요')).toBe(true);
  });

  test('바뀐 칸(CK3)만 보이고, 제목 · 부제는 N28 문구이며 안내 상자는 (CK4 가 아니라서) 보이지 않는다', async () => {
    const tree = await render(makeDeps({ loadActive: async () => ({ ok: true, rows: rowsWithOld(['CK3']) }) }).deps);
    expect(has(tree, 'consent-row-CK3')).toBe(true);
    for (const code of CODES.filter((c) => c !== 'CK3')) expect(has(tree, `consent-row-${code}`)).toBe(false);
    expect(textOf(tree, 'consent-title')).toBe('동의 내용이 바뀌었어요');
    expect(textOf(tree, 'consent-subtitle')).toBe('바뀐 항목에만 다시 동의해 주세요.');
    expect(has(tree, 'consent-notice')).toBe(false);
    expect(hasText(tree, '동의하고 계속')).toBe(true); // 버튼은 03 과 같다
  });

  test('바뀐 칸을 체크해 [동의하고 계속]을 누르면 그 칸의 기록만 새로 더하고 다음으로 간다', async () => {
    const { deps, record } = makeDeps({ loadActive: async () => ({ ok: true, rows: rowsWithOld(['CK3']) }) });
    const tree = await render(deps);
    expect(must(tree, 'consent-submit').props.dimmed).toBe(true);
    await toggle(tree, 'CK3');
    await press(tree, 'consent-submit');
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0].map((r) => `${r.item_code}:${r.agreed}`)).toEqual(['CK3:true']);
    expect(mockSetStage).toHaveBeenCalledWith('consented');
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  test('바뀐 칸이 없으면 다시 받을 것이 없어 바로 다음 단계로 간다', async () => {
    await render(makeDeps({ loadActive: async () => ({ ok: true, rows: rowsWithOld([]) }) }).deps);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/survey/[step]', params: { step: '01' } });
  });

  test('바뀐 칸을 알아보다 인터넷이 끊기면 안내와 [다시 시도]가 보이고, 누르면 다시 알아본다', async () => {
    let calls = 0;
    const { deps } = makeDeps({
      loadActive: async () => {
        calls += 1;
        return calls === 1 ? { ok: false, reason: 'network' } : { ok: true, rows: rowsWithOld(['CK1']) };
      },
    });
    const tree = await render(deps);
    expect(hasText(tree, COMMON.offline)).toBe(true);
    await press(tree, 'consent-retry');
    expect(has(tree, 'consent-row-CK1')).toBe(true);
    expect(calls).toBe(2);
  });
});

describe('접근성', () => {
  test('체크 칸마다 checkbox 역할과 체크 상태가 있고, 덧붙이는 안내는 힌트로 읽힌다', async () => {
    const tree = await render(makeDeps().deps);
    for (const code of CODES) expect(must(tree, `consent-check-${code}`).props.accessibilityRole).toBe('checkbox');
    expect(must(tree, 'consent-check-CK4').props.accessibilityHint).toBe('동의하지 않아도 가입할 수 있어요. 다만 탑승권은 살 수 없어요.');
    expect(must(tree, 'consent-all').props.accessibilityRole).toBe('checkbox');
  });

  test("'보기 ›' 버튼은 어느 칸의 것인지 이름에 들어 있다", async () => {
    const tree = await render(makeDeps().deps);
    expect(must(tree, 'consent-more-CK3').props.accessibilityLabel).toBe('[필수] 개인정보 수집·이용에 동의해요 보기');
  });

  test('필수 미체크 오류는 알림(alert)으로 읽힌다', async () => {
    const tree = await render(makeDeps().deps);
    await press(tree, 'consent-submit');
    expect(find(tree, 'consent-error')?.props.accessibilityRole).toBe('alert');
    expect(CONSENT.submit).toBe('동의하고 계속');
  });
});
