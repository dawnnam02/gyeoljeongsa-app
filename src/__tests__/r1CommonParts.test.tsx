// R1 A⑦ 공통(렌더 시험): 스위치 훅 · V10 연락처 안내 줄 · T12 스크롤 단서 · T09 읽는 차례(부품마다).
//  렌더 없는 시험은 r1Common.test.ts
import { ScrollView, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ContactHint, ContactReceiverNote, CONTACT_HINT_DELAY_MS } from '@/components/ContactHint';
import { ScrollCue } from '@/components/ScrollCue';
import { CONTACT_HINT } from '@/content/contactHintCopy';
import { V4W01 } from '@/content/v4Wave01Copy';
import { MeetFeedbackCard } from '@/features/meetFeedback/MeetFeedbackCard';
import { createFlagsStore, useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useScrollCue } from '@/hooks/useScrollCue';
import { parseFlags, type FeatureFlags } from '@/lib/featureFlagsApi';

import { readingOrder } from './a11yOrder';
import { find, must, textOf } from './renderHelpers';

jest.setTimeout(180_000); // 첫 렌더가 모듈을 처음 불러와 바쁜 기계에서 느리다(F19 과 같은 이유)

const render = (el: React.ReactElement): ReactTestRenderer => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(el);
  });
  return tree;
};

describe('스위치 훅 useFeatureFlags', () => {
  function Probe({ store }: { store: ReturnType<typeof createFlagsStore> }) {
    const { isOn, flags } = useFeatureFlags(store);
    return <Text testID="probe">{`${isOn('featured_pick') ? 'F' : 'f'}${isOn('grade_view') ? 'G' : 'g'}${flags.loaded ? 'L' : 'l'}`}</Text>;
  }

  test('불러오기 전에는 live 값(새 기능 꺼짐 · 구현된 기능 켜짐) → 불러오면 바뀐다 · 화면 둘이 써도 요청 1번', async () => {
    let resolve: (f: FeatureFlags) => void = () => undefined;
    const load = jest.fn(() => new Promise<FeatureFlags>((r) => (resolve = r)));
    const store = createFlagsStore(load);
    const a = render(<Probe store={store} />);
    const b = render(<Probe store={store} />);
    expect(textOf(a, 'probe')).toBe('fGl');
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => resolve(parseFlags({ flags: { featured_pick: true, grade_view: false }, modes: {} })));
    expect(textOf(a, 'probe')).toBe('FgL');
    expect(textOf(b, 'probe')).toBe('FgL');
    const c = render(<Probe store={store} />); // 이미 불렀으면 다시 부르지 않는다
    expect(textOf(c, 'probe')).toBe('FgL');
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('V10 연락처 안내 줄 ContactHint', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));

  test('0.5초 멈춘 뒤에 나타나고, 모양을 지우면 바로 사라진다 · 스크린리더 "안내, …" 한 번(polite)', () => {
    const tree = render(<ContactHint field="public" text="카톡 주세요" />);
    expect(find(tree, 'contact-hint')).toBeNull();
    wait(CONTACT_HINT_DELAY_MS - 1);
    expect(find(tree, 'contact-hint')).toBeNull();
    wait(1);
    expect(textOf(tree, 'contact-hint-text')).toBe(CONTACT_HINT.publicField);
    const row = must(tree, 'contact-hint');
    expect(row.props.accessibilityLabel).toBe(`${CONTACT_HINT.a11yPrefix}${CONTACT_HINT.publicField}`);
    expect(row.props.accessibilityLiveRegion).toBe('polite');
    expect(readingOrder(tree)).toEqual([{ label: `안내, ${CONTACT_HINT.publicField}`, role: null }]); // 한 포커스
    act(() => tree.update(<ContactHint field="public" text="카톡 주세요 더 쓰는 중" />));
    expect(find(tree, 'contact-hint')).not.toBeNull(); // 쓰는 중에 깜빡이지 않는다
    act(() => tree.update(<ContactHint field="public" text="주말에 산책해요" />));
    expect(find(tree, 'contact-hint')).toBeNull(); // 바로 사라짐
  });

  test('칸 종류별 글(편지 = 막힘 · 공개 칸 링크 · 비공개) · 스위치 꺼짐이면 그리지 않는다 · 서버 요청 0', () => {
    const fetchSpy = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    const cases: [Parameters<typeof ContactHint>[0]['field'], string, string][] = [
      ['letter', '010-1234-5678', CONTACT_HINT.letter],
      ['public', 'bit.ly/abc', CONTACT_HINT.publicLink],
      ['private', '@myid', CONTACT_HINT.privateField],
    ];
    for (const [field, text, want] of cases) {
      const tree = render(<ContactHint field={field} text={text} />);
      wait(CONTACT_HINT_DELAY_MS);
      expect(textOf(tree, 'contact-hint-text')).toBe(want);
    }
    const off = render(<ContactHint field="letter" text="010-1234-5678" enabled={false} />);
    wait(CONTACT_HINT_DELAY_MS);
    expect(off.toJSON()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('받는 쪽 고정 한 줄은 글을 판정하지 않고 늘 같은 글', () => {
    const tree = render(<ContactReceiverNote />);
    expect(textOf(tree, 'contact-receiver-note')).toBe(CONTACT_HINT.receiverNote);
  });
});

describe('T12 스크롤 단서', () => {
  function Long() {
    const cue = useScrollCue();
    return (
      <>
        <ScrollView testID="scroll" {...cue.handlers}>
          <Text>내용</Text>
        </ScrollView>
        <ScrollCue visible={cue.more} />
      </>
    );
  }

  test('내용이 창보다 길면 띠가 보이고, 끝까지 내리면 사라진다 · 꾸밈이라 스크린리더 · 누름에서 빠진다', () => {
    const tree = render(<Long />);
    const sv = () => must(tree, 'scroll');
    expect(find(tree, 'scroll-cue')).toBeNull();
    act(() => sv().props.onLayout({ nativeEvent: { layout: { width: 360, height: 600, x: 0, y: 0 } } }));
    act(() => sv().props.onContentSizeChange(360, 1400));
    const band = must(tree, 'scroll-cue');
    expect(band.props.pointerEvents).toBe('none');
    expect(band.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(readingOrder(tree).map((s) => s.label)).toEqual(['내용']);
    act(() => sv().props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 800 } } }));
    expect(find(tree, 'scroll-cue')).toBeNull();
  });
});

describe('T09 읽는 차례 · 이름에 역할 말 0 (부품마다)', () => {
  test('만남 뒤 피드백 카드: 제목 → 상대 → 닫기 → 보조 → 답하기, 이름에 "버튼" 없음', () => {
    const tree = render(<MeetFeedbackCard prompt={{ kind: 'ask', matchId: 'm1', head: '한OO · 서울 강서구' }} now={0} onAnswer={jest.fn()} onDismiss={jest.fn()} onEdit={jest.fn()} />);
    const order = readingOrder(tree);
    expect(order.map((s) => s.label)).toEqual([V4W01.meet.cardTitle, '한OO · 서울 강서구', V4W01.meet.dismissA11y, V4W01.meet.cardSub, V4W01.meet.answerButton]);
    expect(order.filter((s) => s.role === 'button').map((s) => s.label)).toEqual([V4W01.meet.dismissA11y, V4W01.meet.answerButton]);
    expect(order.filter((s) => /버튼/.test(s.label))).toEqual([]);
  });
});
