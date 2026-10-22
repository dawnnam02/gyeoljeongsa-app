// 화면 시험 도우미(react-test-renderer 만 쓴다). 시험 파일이 아니다(이름이 .test 로 끝나지 않는다).
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

export async function mount(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

// testID 로 요소를 찾는다. 같은 testID 가 겹쳐 있으면(컴포넌트 → 안쪽 요소) 가장 바깥 것이 먼저다.
export const find = (tree: ReactTestRenderer, id: string): ReactTestInstance | null => tree.root.findAll((node) => node.props.testID === id)[0] ?? null;
export const must = (tree: ReactTestRenderer, id: string): ReactTestInstance => {
  const node = find(tree, id);
  if (!node) throw new Error(`testID "${id}" 요소가 없어요`);
  return node;
};
export const has = (tree: ReactTestRenderer, id: string): boolean => find(tree, id) !== null;

const flatten = (children: unknown): string => {
  if (children === null || children === undefined || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flatten).join('');
  return '';
};

// testID 요소(글자 컴포넌트)가 보여 주는 글
export const textOf = (tree: ReactTestRenderer, id: string): string | null => {
  const node = find(tree, id);
  return node ? flatten(node.props.children) : null;
};

// 화면에 있는 모든 글(RN Text) 목록
export const allTexts = (tree: ReactTestRenderer): string[] =>
  tree.root
    .findAllByType(Text)
    .map((node) => flatten(node.props.children))
    .filter((t) => t.length > 0);

export const hasText = (tree: ReactTestRenderer, text: string): boolean => allTexts(tree).includes(text);

// 누르기 · 입력(요소가 받은 handler 를 직접 부른다). 비활성(disabled)인 것은 실제로는 눌리지 않으므로 부르지 않는다.
export async function press(tree: ReactTestRenderer, id: string): Promise<void> {
  const node = must(tree, id);
  if (node.props.disabled) return;
  await act(async () => {
    await node.props.onPress?.();
  });
}

export async function typeInto(tree: ReactTestRenderer, id: string, value: string): Promise<void> {
  const node = must(tree, id);
  await act(async () => {
    node.props.onChangeText(value);
  });
}

// 시트(Modal)가 열려 있는가. 닫힌 Modal 도 요소는 트리에 남으므로 visible 값을 본다(testID 가 없는 닫힌 시트는 없는 것으로 본다)
export const isOpen = (tree: ReactTestRenderer, id: string): boolean => {
  const node = find(tree, id);
  return node !== null && node.props.visible !== false;
};
