// 신고 · 차단 공용 시트 ReportBlockSheet(F7 통과 조건 2): 11b 구성 · 사유 8개 · RP6 안내 · 익명 안내 · 설명(선택 200자 / 기타 10자) · 오류 4종 + 실패 · 차단 확인 · 완료 알림
// recsApi 의 report · block 과 같은 모양의 api 를 받는다(F5 · F6 재사용). ⋯ 더보기 버튼 · 한 줄 안전 안내도 여기서 본다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { COMMON, REPORT_SHEET, SAFETY } from '@/content/copy';
import { MoreButton } from '@/features/safety/MoreButton';
import { ReportBlockSheet } from '@/features/safety/ReportBlockSheet';
import { checkReport, OTHER_INDEX, REPORT_CODES, reportFailure, type SafetyApi } from '@/features/safety/reportLogic';
import { SafetyLine } from '@/features/safety/SafetyLine';

import { allTexts, has, hasText, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때(npm run check) 첫 화면 그리기가 30초를 넘는 일이 있었다

// 같은 testID 가 겹쳐 있을 때(부품 → 안쪽 요소) 그 값을 가진 첫 요소의 값
const propOf = (tree: ReactTestRenderer, id: string, key: string): any => tree.root.findAll((n) => n.props.testID === id && n.props[key] !== undefined)[0]?.props[key];

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

function setup(api: Partial<SafetyApi> = {}) {
  const full: jest.Mocked<SafetyApi> = {
    report: jest.fn(async () => ({ ok: true as const })),
    block: jest.fn(async () => ({ ok: true as const })),
    ...api,
  } as jest.Mocked<SafetyApi>;
  const handlers = { onClose: jest.fn(), onReported: jest.fn(), onBlocked: jest.fn(), onUnavailable: jest.fn() };
  return { api: full, handlers };
}
const show = (s: ReturnType<typeof setup>) => mount(<ReportBlockSheet visible targetId="t1" api={s.api} {...s.handlers} />);

describe('신고 규칙', () => {
  test('사유 8개 = 정책 5-2 RP1~RP8 · 카피.md 11 이름 그대로', () => {
    expect(REPORT_CODES).toEqual(['RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'RP6', 'RP7', 'RP8']);
    expect(REPORT_SHEET.reasons).toEqual(['가짜 프로필·사칭', '허위 정보', '부적절한 사진', '욕설·혐오·성적 표현', '연락처·광고·외부 유도', '미성년자로 보임', '금전 요구·사기 의심', '기타']);
  });

  test('사유 없음 → 사유 오류 · 200자 넘음 · 기타는 10자 이상', () => {
    expect(checkReport(null, '')).toEqual({ field: 'reason', text: '신고 사유를 골라 주세요.' });
    expect(checkReport(0, '')).toBeNull();
    expect(checkReport(0, 'a'.repeat(201))).toEqual({ field: 'desc', text: '200자까지 쓸 수 있어요.' });
    expect(checkReport(0, 'a'.repeat(200))).toBeNull();
    expect(checkReport(OTHER_INDEX, '  짧은 글  ')).toEqual({ field: 'desc', text: '10자 이상 써 주세요.' });
    expect(checkReport(OTHER_INDEX, '열 글자 이상 적었어요')).toBeNull();
  });

  test('서버 거절 코드 → 글(already_reported · invalid_reason · description_required · invalid_description · 인터넷 · 그 밖)', () => {
    expect(reportFailure('already').text).toBe('이미 신고했어요.');
    expect(reportFailure('invalid_reason').text).toBe('신고 사유를 골라 주세요.');
    expect(reportFailure('description_required').text).toBe('10자 이상 써 주세요.');
    expect(reportFailure('invalid_description').text).toBe('200자까지 쓸 수 있어요.');
    expect(reportFailure('network').text).toBe(COMMON.offline);
    expect(reportFailure('server').text).toBe('신고하지 못했어요. 다시 시도해 주세요.');
  });
});

describe('ReportBlockSheet 화면', () => {
  test('선택 시트: 제목 "신고 · 차단" · 신고하기/차단하기 + 작은 글 · 취소(11b)', async () => {
    const s = setup();
    const tree = await show(s);
    expect(isOpen(tree, 'report-menu')).toBe(true);
    for (const t of [REPORT_SHEET.title, REPORT_SHEET.report, REPORT_SHEET.reportHint, REPORT_SHEET.block, REPORT_SHEET.blockHint, REPORT_SHEET.cancel]) expect(hasText(tree, t)).toBe(true);
    await press(tree, 'report-menu-cancel');
    expect(s.handlers.onClose).toHaveBeenCalled();
  });

  test('신고: 사유 8개 · RP6 아래 24시간 안내 · 익명 안내 · 설명 자리표시 → 제출 → 시트 닫고 부모에게 알림', async () => {
    const s = setup();
    const tree = await show(s);
    await press(tree, 'report-menu-report');
    expect(isOpen(tree, 'report-reasons')).toBe(true);
    expect(hasText(tree, REPORT_SHEET.reasonTitle)).toBe(true);
    for (const code of REPORT_CODES) expect(has(tree, `report-reason-${code}`)).toBe(true);
    expect(textOf(tree, 'report-minor-note')).toBe('만 24세 미만으로 보인다는 신고가 들어오면 24시간 안에 먼저 확인해요.');
    expect(textOf(tree, 'report-anonymous-note')).toBe('신고한 분이 누구인지는 상대에게 알리지 않아요.');
    expect(propOf(tree, 'report-desc', 'placeholder')).toBe('무슨 일이 있었는지 적어 주세요. (선택)');
    await press(tree, 'report-submit');
    expect(textOf(tree, 'report-reason-error')).toBe('신고 사유를 골라 주세요.');
    expect(s.api.report).not.toHaveBeenCalled();
    await press(tree, 'report-reason-RP6');
    expect(propOf(tree, 'report-reason-RP6', 'accessibilityState').checked).toBe(true);
    await press(tree, 'report-submit');
    expect(s.api.report).toHaveBeenCalledWith('t1', 'RP6', '');
    expect(s.handlers.onReported).toHaveBeenCalled();
  });

  test('기타: 자리표시가 10자 안내로 바뀌고, 짧으면 칸 아래 "10자 이상 써 주세요."(11e)', async () => {
    const s = setup();
    const tree = await show(s);
    await press(tree, 'report-menu-report');
    await press(tree, 'report-reason-RP8');
    expect(propOf(tree, 'report-desc', 'placeholder')).toBe('무슨 일이 있었는지 10자 이상 적어 주세요.');
    await typeInto(tree, 'report-desc', '짧아요');
    await press(tree, 'report-submit');
    expect(propOf(tree, 'report-desc', 'error')).toBe('10자 이상 써 주세요.');
    expect(s.api.report).not.toHaveBeenCalled();
  });

  test('서버가 이미 신고했다고 하면 "이미 신고했어요." · 실패는 "신고하지 못했어요…" · 볼 수 없는 상대면 부모에게', async () => {
    const already = setup({ report: jest.fn(async () => ({ ok: false as const, reason: 'already' as const })) });
    const tree = await show(already);
    await press(tree, 'report-menu-report');
    await press(tree, 'report-reason-RP1');
    await press(tree, 'report-submit');
    expect(textOf(tree, 'report-error')).toBe('이미 신고했어요.');
    expect(already.handlers.onReported).not.toHaveBeenCalled();

    const gone = setup({ report: jest.fn(async () => ({ ok: false as const, reason: 'unavailable' as const })) });
    const tree2 = await show(gone);
    await press(tree2, 'report-menu-report');
    await press(tree2, 'report-reason-RP2');
    await press(tree2, 'report-submit');
    expect(gone.handlers.onUnavailable).toHaveBeenCalled();
  });

  test('제출 두 번 눌러도 요청 한 번(R9)', async () => {
    let release: (v: { ok: true }) => void = () => undefined;
    const s = setup({ report: jest.fn(() => new Promise<{ ok: true }>((r) => (release = r))) });
    const tree = await show(s);
    await press(tree, 'report-menu-report');
    await press(tree, 'report-reason-RP3');
    const submit = must(tree, 'report-submit');
    await act(async () => {
      submit.props.onPress();
      submit.props.onPress();
    });
    await act(async () => release({ ok: true }));
    expect(s.api.report).toHaveBeenCalledTimes(1);
  });

  test('차단: 확인창(N17, 11f) → [차단하기] → 부모에게 알림 · 실패는 시트로 돌아와 "차단하지 못했어요…"', async () => {
    const s = setup();
    const tree = await show(s);
    await press(tree, 'report-menu-block');
    expect(isOpen(tree, 'report-block-confirm')).toBe(true);
    expect(textOf(tree, 'report-block-confirm-title')).toBe('이분을 차단할까요? 서로 보이지 않게 돼요.');
    await press(tree, 'report-block-confirm-confirm');
    expect(s.api.block).toHaveBeenCalledWith('t1');
    expect(s.handlers.onBlocked).toHaveBeenCalled();

    const bad = setup({ block: jest.fn(async () => ({ ok: false as const, reason: 'server' as const })) });
    const tree2 = await show(bad);
    await press(tree2, 'report-menu-block');
    await press(tree2, 'report-block-confirm-confirm');
    expect(textOf(tree2, 'report-menu-error')).toBe('차단하지 못했어요. 다시 시도해 주세요.');
    expect(bad.handlers.onBlocked).not.toHaveBeenCalled();
  });

  test('차단 확인창 [취소]는 선택 시트로, 사유 화면 ‹ 도 선택 시트로', async () => {
    const s = setup();
    const tree = await show(s);
    await press(tree, 'report-menu-block');
    await press(tree, 'report-block-confirm-cancel');
    expect(isOpen(tree, 'report-menu')).toBe(true);
    await press(tree, 'report-menu-report');
    await press(tree, 'report-reasons-header-back');
    expect(isOpen(tree, 'report-menu')).toBe(true);
    expect(s.api.block).not.toHaveBeenCalled();
  });

  test('화면 글에 등급 · 점수 말이 없다', async () => {
    const s = setup();
    const tree = await show(s);
    await press(tree, 'report-menu-report');
    expect(allTexts(tree).filter((t) => /등급|점수/.test(t))).toEqual([]);
  });
});

describe('⋯ 더보기 · 한 줄 안전 안내', () => {
  test('⋯ 의 스크린리더 이름 "더보기"(N33) · 누르는 면 44', async () => {
    const onPress = jest.fn();
    const tree = await mount(<MoreButton onPress={onPress} testID="more" />);
    expect(propOf(tree, 'more', 'accessibilityLabel')).toBe('더보기');
    await press(tree, 'more');
    expect(onPress).toHaveBeenCalled();
  });

  test('한 줄 안전 안내(N34) 글 그대로', async () => {
    const tree = await mount(<SafetyLine />);
    expect(textOf(tree, 'safety-line')).toBe(SAFETY.line);
  });
});
