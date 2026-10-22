// F12 조건 3 · U31: 승인 전 사진 칸 = 기본 프로필 그림 + 그 아래 "사진 확인 중"(겹치지 않음). 승인 칸은 사진, 11 작은 원은 그림만.
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { Image } from 'react-native';

import { RECS } from '@/content/copy';
import { PhotoBox } from '@/features/recs/PhotoBox';

import { has, mount, must } from './renderHelpers';

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
});
const withSide = async (el: React.ReactElement, id: string) => {
  const tree = await mount(el);
  shown.push(tree);
  await act(async () => {
    tree.root.findAll((n) => n.props.testID === id && typeof n.props.onLayout === 'function')[0].props.onLayout({ nativeEvent: { layout: { width: 200, height: 200 } } });
  });
  return tree;
};

describe('PhotoBox (U31)', () => {
  test('확인 중: 기본 프로필 그림 + 아래 "사진 확인 중" 글(그림 위에 겹치지 않고 같은 칸 안 위아래로 나란히)', async () => {
    const tree = await withSide(<PhotoBox state="pending" testID="pb" />, 'pb');
    expect(has(tree, 'pb-default')).toBe(true);
    expect(has(tree, 'pb-checking')).toBe(true);
    const text = must(tree, 'pb-checking');
    expect(text.findAll((n) => n.props.children === RECS.photoChecking).length).toBeGreaterThan(0);
    expect(RECS.photoChecking).toBe('사진 확인 중');
    const style = JSON.stringify(tree.root.findAll((n) => n.props.testID === 'pb' && typeof n.props.onLayout === 'function')[0].props.style);
    expect(style).not.toContain('absolute');
    expect(JSON.stringify(text.props.style ?? '')).not.toContain('absolute');
  });

  test('사진 없음(미등록 · 반려)은 그림만, 승인 칸은 사진을 그린다', async () => {
    const none = await withSide(<PhotoBox state="none" testID="pn" />, 'pn');
    expect(has(none, 'pn-default')).toBe(true);
    expect(has(none, 'pn-checking')).toBe(false);
    const ok = await withSide(<PhotoBox state="approved" uri="https://example.test/a.jpg" testID="pa" />, 'pa');
    expect(has(ok, 'pa-default')).toBe(false);
    expect(ok.root.findAllByType(Image)[0].props.source).toEqual({ uri: 'https://example.test/a.jpg' });
  });
});
