// F12 조건 3 · U31: 승인 전 사진 칸 = 기본 그림 + 그 아래 "사진 확인 중"(겹치지 않음). 승인 칸은 사진, 11 작은 원은 그림만.
// D42-P(D-176): 기본 그림 = 빛 실루엣 한 장이 칸을 꽉 채운다(cover). 칸 크기를 잴 필요가 없어 예전 onLayout 은 지웠다.
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { Image } from 'react-native';

import { RECS } from '@/content/copy';
import { PhotoBox } from '@/features/recs/PhotoBox';
import { AVATAR_ART } from '@/theme/uiAssets';

import { has, mount, must } from './renderHelpers';

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
});
const show = async (el: React.ReactElement) => {
  const tree = await mount(el);
  shown.push(tree);
  return tree;
};
const boxOf = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props.testID === id && n.props.accessible === true)[0];

describe('PhotoBox (U31)', () => {
  test('확인 중: 기본 그림 + 아래 "사진 확인 중" 글(그림 위에 겹치지 않고 같은 칸 안 위아래로 나란히)', async () => {
    const tree = await show(<PhotoBox state="pending" testID="pb" />);
    expect(has(tree, 'pb-default')).toBe(true);
    expect(has(tree, 'pb-checking')).toBe(true);
    const text = must(tree, 'pb-checking');
    expect(text.findAll((n) => n.props.children === RECS.photoChecking).length).toBeGreaterThan(0);
    expect(RECS.photoChecking).toBe('사진 확인 중');
    expect(JSON.stringify(boxOf(tree, 'pb').props.style)).not.toContain('absolute');
    expect(JSON.stringify(text.props.style ?? '')).not.toContain('absolute');
  });

  test('기본 그림 = 빛 실루엣이 칸을 꽉 채운다(cover · 폭 100%)', async () => {
    const tree = await show(<PhotoBox state="none" testID="pk" />);
    const art = tree.root.findAll((n) => n.props.testID === 'pk-default').at(-1)!;
    expect(art.props.source).toBe(AVATAR_ART.silhouette);
    expect(art.props.resizeMode).toBe('cover');
    expect(JSON.stringify(art.props.style)).toContain('"width":"100%"');
  });

  test('사진 없음(미등록 · 반려)은 그림만, 승인 칸은 사진을 그린다', async () => {
    const none = await show(<PhotoBox state="none" testID="pn" />);
    expect(has(none, 'pn-default')).toBe(true);
    expect(has(none, 'pn-checking')).toBe(false);
    const ok = await show(<PhotoBox state="approved" uri="https://example.test/a.jpg" testID="pa" />);
    expect(has(ok, 'pa-default')).toBe(false);
    expect(ok.root.findAllByType(Image)[0].props.source).toEqual({ uri: 'https://example.test/a.jpg' });
  });
});
