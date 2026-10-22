import React from 'react';
import { Image as RNImage } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { PhotoBox } from '@/features/recs/PhotoBox';
import { PHOTO_URL_REFRESH_MS, PHOTO_URL_RETRY_MS, usePhotoUrls } from '@/features/recs/usePhotoUrls';

const latestRef: { current: Readonly<Record<string, string | null>> } = { current: {} };
function Probe({ ids, load }: { ids: string[]; load: (id: string) => Promise<string | null> }) {
  const urls = usePhotoUrls(ids, load);
  React.useEffect(() => {
    latestRef.current = urls;
  });
  return null;
}
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('Q5A-02 사진 주소 만료 전 다시 받기 · 실패 재시도', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('만료 전(240초)에 같은 id 주소를 다시 받는다', async () => {
    let n = 0;
    const load = jest.fn(async (id: string) => `https://x/${id}?v=${++n}`);
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<Probe ids={['a']} load={load} />);
    });
    await flush();
    expect(latestRef.current.a).toBe('https://x/a?v=1');
    await act(async () => {
      jest.advanceTimersByTime(PHOTO_URL_REFRESH_MS);
    });
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(latestRef.current.a).toBe('https://x/a?v=2');
    act(() => r.unmount());
  });

  it('못 받은 사진(던짐 · null)은 다시 시도하고, 한 장이 던져도 나머지는 보인다', async () => {
    let tries = 0;
    const load = jest.fn(async (id: string) => {
      if (id === 'b') {
        tries += 1;
        if (tries === 1) throw new Error('net');
        if (tries === 2) return null;
      }
      return `https://x/${id}`;
    });
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<Probe ids={['a', 'b']} load={load} />);
    });
    await flush();
    expect(latestRef.current).toEqual({ a: 'https://x/a', b: null });
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        jest.advanceTimersByTime(PHOTO_URL_RETRY_MS);
      });
      await flush();
    }
    expect(latestRef.current.b).toBe('https://x/b');
    act(() => r.unmount());
  });

  it('PhotoBox: 읽기 실패로 굳은 뒤 새 주소가 오면 다시 그린다', async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<PhotoBox state="approved" uri="https://x/1" />);
    });
    const images = () => r.root.findAllByType(RNImage);
    act(() => images()[0].props.onError());
    expect(images().some((i) => i.props.source?.uri === 'https://x/1')).toBe(false);
    await act(async () => {
      r.update(<PhotoBox state="approved" uri="https://x/2" />);
    });
    expect(images().some((i) => i.props.source?.uri === 'https://x/2')).toBe(true);
  });
});
