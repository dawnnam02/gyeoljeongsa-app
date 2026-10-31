/**
 * @jest-environment node
 */
// IF5-F1 ① 앱 저장소(secureStorage if5Storage)는 withKeyIndex 꼴 — 열쇠 목록을 함께 두고 clearAll 이 목록대로 지운다 · 새로 깐 기기에서 비운다(보안 확인 두 가지 가운데 하나)
import { forgetStaleDeviceStorage, if5Storage } from '@/lib/secureStorage';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios } }));


describe('IF5-F1 ① if5Storage (withKeyIndex)', () => {
  test('쓴 열쇠를 목록 한 곳(device.keys.if5)에 적고 지우면 목록에서도 빠진다', async () => {
    await if5Storage.setItem('my.time.v1', '{"hour":1,"minute":2}');
    await if5Storage.setItem('my.spot.v1', '"서울"');
    expect(JSON.parse((await if5Storage.getItem('device.keys.if5')) ?? '[]')).toEqual(['my.time.v1', 'my.spot.v1']);
    await if5Storage.removeItem('my.time.v1');
    expect(JSON.parse((await if5Storage.getItem('device.keys.if5')) ?? '[]')).toEqual(['my.spot.v1']);
  });
  test('새로 깐 기기 처리(forgetStaleDeviceStorage)가 목록대로 지운다 — 목록 파일도 0', async () => {
    await if5Storage.setItem('my.time.v1', '{"hour":1,"minute":2}');
    await if5Storage.setItem('my.asked.v1', '1');
    await forgetStaleDeviceStorage();
    expect([...mockStore.keys()].filter((k) => k.includes('my.') || k.includes('device.keys.if5'))).toEqual([]);
  });
  test('열쇠 목록에는 이름만 있다(값 0)', async () => {
    await if5Storage.setItem('my.time.v1', '{"hour":15,"minute":20}');
    expect((await if5Storage.getItem('device.keys.if5')) ?? '').not.toMatch(/15|20|hour/);
    await if5Storage.clearAll();
  });
});
