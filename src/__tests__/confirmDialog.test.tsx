// 공통 확인창 ConfirmDialog(D8 3차 M4 · M5 · 검수 Q4-4): 제목 20 Bold · 버튼 세로(주 버튼 위 · 취소 아래) · 본문/보조 선택 · 요청 중 · 오류 · 뒤로가기 = 취소.
// 07 확정 실패 4종 · 차단 확인 · 탈퇴 확인 · 종교 동의 끄기가 이 틀 하나를 쓴다.
import { StyleSheet } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { type } from '@/theme/tokens';

import { find, has, mount, press, textOf } from './renderHelpers';

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때(npm run check) 첫 화면 그리기가 30초를 넘는 일이 있었다

const flat = (style: unknown): Record<string, unknown> => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;

function show(over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const element = <ConfirmDialog visible title="제목" body="본문" confirmLabel="주 버튼" cancelLabel="취소" onConfirm={onConfirm} onCancel={onCancel} testID="dlg" {...over} />;
  return { onConfirm, onCancel, element };
}

describe('ConfirmDialog (D8 M4 · M5)', () => {
  test('제목은 20 Bold(type.title) · 본문 15 text · 보조 12', async () => {
    const s = show({ sub: '보조 글' });
    const tree = await mount(s.element);
    expect(find(tree, 'dlg-title')?.props.variant).toBe('title');
    expect(type.title.fontSize).toBe(20);
    expect(type.title.fontFamily).toMatch(/Bold/);
    expect(find(tree, 'dlg-body')?.props.variant).toBe('body');
    expect(find(tree, 'dlg-body')?.props.tone).toBe('text');
    expect(find(tree, 'dlg-sub')?.props.variant).toBe('caption');
    expect(textOf(tree, 'dlg-title')).toBe('제목');
  });

  test('버튼은 세로: 주 버튼이 위, 취소가 아래이고 같은 줄(가로 배치)이 아니다', async () => {
    const tree = await mount(show().element);
    const confirm = find(tree, 'dlg-confirm');
    const cancel = find(tree, 'dlg-cancel');
    expect(confirm && cancel).toBeTruthy();
    const box = confirm?.parent;
    expect(box).toBe(cancel?.parent); // 두 버튼이 같은 상자 안에 바로 있다(반쪽 칸으로 감싸지 않는다)
    const kids = box?.children ?? [];
    expect(kids.indexOf(confirm as never)).toBeLessThan(kids.indexOf(cancel as never));
    expect(flat(box?.props.style).flexDirection ?? 'column').toBe('column');
  });

  test('본문 · 보조는 없으면 그리지 않는다(차단 확인은 제목 한 줄)', async () => {
    const tree = await mount(show({ body: undefined }).element);
    expect(has(tree, 'dlg-body')).toBe(false);
    expect(has(tree, 'dlg-sub')).toBe(false);
  });

  test('누르면 onConfirm · onCancel, 요청 중이면 주 버튼이 불러오는 표시이고 취소도 막힌다, 오류는 버튼 위 한 줄', async () => {
    const s = show();
    const tree = await mount(s.element);
    await press(tree, 'dlg-confirm');
    await press(tree, 'dlg-cancel');
    expect(s.onConfirm).toHaveBeenCalledTimes(1);
    expect(s.onCancel).toHaveBeenCalledTimes(1);
    const busy = show({ busy: true, error: '처리하지 못했어요.' });
    const tree2 = await mount(busy.element);
    expect(find(tree2, 'dlg-confirm')?.props.loading).toBe(true);
    expect(find(tree2, 'dlg-cancel')?.props.disabled).toBe(true);
    expect(textOf(tree2, 'dlg-error')).toBe('처리하지 못했어요.');
  });

  test('Android 뒤로가기(onRequestClose)는 취소와 같다', async () => {
    const s = show();
    const tree = await mount(s.element);
    const modal = tree.root.findAll((n) => n.props.testID === 'dlg' && typeof n.props.onRequestClose === 'function')[0];
    modal.props.onRequestClose();
    expect(s.onCancel).toHaveBeenCalledTimes(1);
  });
});
