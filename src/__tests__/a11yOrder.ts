// 시험 도우미(시험 파일이 아니다): 스크린리더가 화면을 읽는 차례를 react-test-renderer 나무에서 뽑는다(R1 A⑦ · T09 · K13 46 · 47).
//  · 멈추는 곳 = accessible 인 요소(누르는 것 · 묶은 카드 · 안내 줄) · 묶이지 않은 글(Text) · 입력 칸
//  · 숨긴 것(accessibilityElementsHidden · importantForAccessibility 'no-hide-descendants')은 아래까지 건너뛴다
//  · 이름 = accessibilityLabel, 없으면 안의 글을 이어 붙인 것. 역할 = accessibilityRole
//  · 화면 차례 = 나무 차례(React Native 는 대부분 그대로 읽는다 — 실기기 TalkBack · VoiceOver 확인은 본인 단계)
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

export type FocusStop = { label: string; role: string | null };

const textOf = (node: ReactTestInstance | string): string => {
  if (typeof node === 'string') return node;
  return node.children.map(textOf).join('');
};
const hidden = (node: ReactTestInstance) => node.props.accessibilityElementsHidden === true || node.props.importantForAccessibility === 'no-hide-descendants';
const hostName = (node: ReactTestInstance): string | null => (typeof node.type === 'string' ? (node.type as string) : null); // 'View' · 'Text' · 'TextInput' …

export function readingOrder(tree: ReactTestRenderer): FocusStop[] {
  const out: FocusStop[] = [];
  const visit = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') return;
    const host = hostName(node);
    if (host !== null) {
      if (hidden(node)) return;
      if (node.props.accessible === true || host === 'TextInput') {
        const label = typeof node.props.accessibilityLabel === 'string' ? node.props.accessibilityLabel : textOf(node);
        out.push({ label, role: node.props.accessibilityRole ?? null });
        return; // 한 포커스로 묶였다: 안은 따로 읽지 않는다
      }
      if (host === 'Text') {
        const label = textOf(node);
        if (label.trim() !== '') out.push({ label, role: node.props.accessibilityRole ?? null });
        return;
      }
    }
    node.children.forEach(visit);
  };
  visit(tree.root);
  return out;
}
