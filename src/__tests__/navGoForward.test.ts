// Q2-35: goForward 의 걷어 내기(dismissAll)는 웹에서 브라우저 기록을 되감아 뒤늦은 popstate 로 옛 화면을 되살린다 → 웹에서는 갈아 끼우기만, 기기에서는 예전 순서 그대로.
import { Platform } from 'react-native';

import { dismissAllNow, goForward } from '@/navigation/go';

const fakeRouter = (canDismiss = true) => ({ canDismiss: jest.fn(() => canDismiss), dismissAll: jest.fn(), replace: jest.fn() });

describe('goForward / dismissAllNow (Q2-35)', () => {
  afterEach(() => jest.restoreAllMocks());

  test('기기(iOS · Android): 쌓인 화면이 있으면 모두 걷어 낸 뒤 갈아 끼운다', () => {
    for (const os of ['ios', 'android'] as const) {
      jest.replaceProperty(Platform, 'OS', os);
      const r = fakeRouter(true);
      goForward(r as never, '/traits');
      expect(r.dismissAll).toHaveBeenCalledTimes(1);
      expect(r.replace).toHaveBeenCalledWith('/traits');
      expect(r.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(r.replace.mock.invocationCallOrder[0]);
    }
  });

  test('기기: 쌓인 화면이 없으면 걷어 내지 않고 갈아 끼우기만 한다', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const r = fakeRouter(false);
    goForward(r as never, '/profile');
    expect(r.dismissAll).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith('/profile');
  });

  test('웹: 쌓인 화면이 있어도 걷어 내지 않는다(브라우저 기록을 되감지 않음) · 갈아 끼우기는 그대로', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const r = fakeRouter(true);
    goForward(r as never, '/traits');
    expect(r.dismissAll).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith('/traits');
    dismissAllNow(r as never);
    expect(r.dismissAll).not.toHaveBeenCalled();
  });
});
