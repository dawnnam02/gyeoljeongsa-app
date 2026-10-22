// F23(청사진 10-5 P10): 한글 입력(IME) — 조합 중에는 글을 가공 · 자르기 · 되쓰기 하지 않고, 최대 글자 수 · 검사는 조합이 끝난 뒤.
//  ① 규칙(lib/imeText) ② 공통 TextField 웹 동작(조합 시작 · 끝 이벤트를 흉내) ③ 설문 v2 이름 검사는 조합된 글자(NFC)로
import { useState } from 'react';
import { Platform, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { TextField } from '@/components/TextField';
import { capChars, imeChange, imeEnd, imeIdle, imeStart, imeValue } from '@/lib/imeText';
import { check, qOf } from '@/features/surveyV2/model';

// 웹의 DOM 칸처럼 ref 가 시험용 칸(createNodeMock)을 받도록 TextInput 을 얇은 겉으로 바꾼다(조합 이벤트를 걸 수 있게)
jest.mock('react-native/Libraries/Components/TextInput/TextInput', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const TextInputHost = React.forwardRef<unknown, Record<string, unknown>>((props, ref) => React.createElement('TextInput', { ...props, ref }));
  TextInputHost.displayName = 'TextInput';
  return { __esModule: true, default: TextInputHost };
});

describe('규칙(lib/imeText)', () => {
  test('글자 단위로 자른다(서버 char_length 와 같게)', () => {
    expect(capChars('김민지', 2)).toBe('김민');
    expect(capChars('김민지', undefined)).toBe('김민지');
    expect(capChars('😀😀😀', 2)).toBe('😀😀');
  });
  test('조합 중에는 자르지 않고 그대로 알린다, 끝나면 자른다', () => {
    let g = imeStart('가나다라');
    const mid = imeChange(g, '가나다라마바', 5);
    expect(mid.emit).toBe('가나다라마바');
    expect(imeValue(mid.gate, '부모가 바꾼 값')).toBe('가나다라마바'); // 부모 값으로 되쓰지 않는다
    g = mid.gate;
    const done = imeEnd('가나다라마바', 5);
    expect(done.emit).toBe('가나다라마');
    expect(imeValue(done.gate, '가나다라마')).toBe('가나다라마');
  });
  test('조합 밖 입력(붙여 넣기 등)은 바로 자른다', () => {
    expect(imeChange(imeIdle(''), 'abcdefg', 5).emit).toBe('abcde');
  });
});

// ── 공통 TextField(웹) ──
type Listener = () => void;
function fakeNode() {
  const listeners: Record<string, Listener[]> = {};
  return {
    value: '',
    addEventListener: (t: string, fn: Listener) => void (listeners[t] = [...(listeners[t] ?? []), fn]),
    removeEventListener: (t: string, fn: Listener) => void (listeners[t] = (listeners[t] ?? []).filter((x) => x !== fn)),
    fire: (t: string) => (listeners[t] ?? []).forEach((fn) => fn()),
    count: (t: string) => (listeners[t] ?? []).length,
  };
}

function Harness({ transform, max, seen }: { transform?: (v: string) => string; max?: number; seen: string[] }) {
  const [v, setV] = useState('');
  return (
    <TextField
      label="이름"
      value={v}
      maxLength={max}
      onChangeText={(t) => {
        seen.push(t);
        setV(transform ? transform(t) : t);
      }}
      testID="f"
    />
  );
}

const inputOf = (tree: ReactTestRenderer) => tree.root.findByType(TextInput);
const realOS = Platform.OS;

describe('공통 TextField — 웹 한글 조합', () => {
  let node: ReturnType<typeof fakeNode>;
  beforeEach(() => {
    (Platform as { OS: string }).OS = 'web';
    node = fakeNode();
  });
  afterEach(() => {
    (Platform as { OS: string }).OS = realOS;
  });

  async function mount(el: React.ReactElement) {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(el, { createNodeMock: () => node });
    });
    return tree;
  }
  // 브라우저가 하는 순서: 조합 시작 → (글이 바뀔 때마다 input) → 조합 끝
  async function compose(tree: ReactTestRenderer, steps: string[]) {
    await act(async () => node.fire('compositionstart'));
    for (const s of steps) {
      node.value = s;
      await act(async () => inputOf(tree).props.onChangeText(s));
    }
    await act(async () => node.fire('compositionend'));
  }

  test("'김민지' 조합: 칸 글 = 입력한 글, 조합 중 칸이 부모 값으로 바뀌지 않는다", async () => {
    const seen: string[] = [];
    const tree = await mount(<Harness seen={seen} max={10} />);
    expect(node.count('compositionstart')).toBe(1);
    await act(async () => node.fire('compositionstart'));
    for (const s of ['ㄱ', '기', '김', '김ㅁ', '김미', '김민', '김민ㅈ', '김민지']) {
      node.value = s;
      await act(async () => inputOf(tree).props.onChangeText(s));
      expect(inputOf(tree).props.value).toBe(s);
    }
    await act(async () => node.fire('compositionend'));
    expect(inputOf(tree).props.value).toBe('김민지');
    expect(seen[seen.length - 1]).toBe('김민지');
  });

  test('부모가 값을 바꿔도(숫자만) 조합 중에는 칸을 되쓰지 않고, 끝난 뒤에 부모 값으로', async () => {
    const seen: string[] = [];
    const tree = await mount(<Harness seen={seen} transform={(v) => v.replace(/\D/g, '')} />);
    await act(async () => node.fire('compositionstart'));
    node.value = 'ㄱ';
    await act(async () => inputOf(tree).props.onChangeText('ㄱ'));
    expect(inputOf(tree).props.value).toBe('ㄱ'); // 부모는 '' 로 저장했지만 칸은 그대로
    node.value = '가';
    await act(async () => inputOf(tree).props.onChangeText('가'));
    await act(async () => node.fire('compositionend'));
    expect(inputOf(tree).props.value).toBe('');
  });

  test('최대 글자 수: 웹은 DOM maxlength 를 쓰지 않고, 조합 중에는 자르지 않으며 끝난 뒤 자른다', async () => {
    const seen: string[] = [];
    const tree = await mount(<Harness seen={seen} max={5} />);
    expect(inputOf(tree).props.maxLength).toBeUndefined();
    await compose(tree, ['가나다라', '가나다라마', '가나다라마ㅂ', '가나다라마바']);
    expect(seen).toContain('가나다라마바'); // 조합 중에는 그대로 알림(자르기 0)
    expect(seen[seen.length - 1]).toBe('가나다라마');
    expect(inputOf(tree).props.value).toBe('가나다라마');
  });

  test('조합 밖 입력은 그대로 쓰되 최대 글자 수로 자른다', async () => {
    const seen: string[] = [];
    const tree = await mount(<Harness seen={seen} max={3} />);
    await act(async () => inputOf(tree).props.onChangeText('abcdef'));
    expect(inputOf(tree).props.value).toBe('abc');
  });

  test('iOS · Android 는 플랫폼 입력기에 맡긴다(maxLength 그대로 · 되쓰기 규칙 없음)', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const seen: string[] = [];
    const tree = await mount(<Harness seen={seen} max={4} />);
    expect(inputOf(tree).props.maxLength).toBe(4);
    expect(node.count('compositionstart')).toBe(0);
  });
});

describe('설문 v2 이름 검사는 조합이 끝난 글자로', () => {
  test('풀어 쓴 자모(NFD)도 조합된 글자(NFC)로 보고 검사한다', () => {
    const nfd = '김민지'.normalize('NFD');
    expect(check(qOf('A12'), { kind: 'text', text: nfd }, {})).toEqual({ state: 'ok', value: '김민지' });
  });
  test('조합 중인 자모(김민ㅈ)는 [다음]에서 막는다(값을 고치지 않고 이유만)', () => {
    expect(check(qOf('A12'), { kind: 'text', text: '김민ㅈ' }, {}).state).toBe('invalid');
  });
});
