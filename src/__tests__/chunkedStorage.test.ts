import { chunkedStorage, CHUNK_SIZE, splitIntoChunks } from '@/lib/chunkedStorage';

import { createMemoryStore, utf8Bytes } from './memoryStore';

// 한글 한 글자는 3바이트다. 2048바이트 한도를 훨씬 넘는 긴 값을 만든다.
const longKorean = '가나다라마바사아자차카타파하'.repeat(300); // 4200자 ≈ 12600바이트

describe('chunkedStorage (보안/구성.md 4-1)', () => {
  test('한도를 넘는 한글 값을 저장하고 그대로 복원한다', async () => {
    const { store } = createMemoryStore();
    const storage = chunkedStorage(store);
    await storage.setItem('k', longKorean);
    expect(await storage.getItem('k')).toBe(longKorean);
  });

  test('조각은 모두 한도(2048바이트) 안이다', async () => {
    const { store, data } = createMemoryStore(); // 한도를 넘으면 저장소가 던진다
    await chunkedStorage(store).setItem('k', longKorean);
    const sizes = [...data.values()].map(utf8Bytes);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(CHUNK_SIZE * 3);
  });

  test('덮어쓰기: 짧아지면 남는 조각을 지운다', async () => {
    const { store, data } = createMemoryStore();
    const storage = chunkedStorage(store);
    await storage.setItem('k', longKorean);
    const before = data.size;
    await storage.setItem('k', '짧은 값');
    expect(await storage.getItem('k')).toBe('짧은 값');
    expect(data.size).toBeLessThan(before);
    expect([...data.keys()].sort()).toEqual(['k.0', 'k.n']);
  });

  test('지우기: 조각과 개수 키를 모두 지운다', async () => {
    const { store, data } = createMemoryStore();
    const storage = chunkedStorage(store);
    await storage.setItem('k', longKorean);
    await storage.removeItem('k');
    expect(data.size).toBe(0);
    expect(await storage.getItem('k')).toBeNull();
  });

  test('조각이 하나 빠지면 값 없음으로 본다', async () => {
    const { store, data } = createMemoryStore();
    const storage = chunkedStorage(store);
    await storage.setItem('k', longKorean);
    data.delete('k.2');
    expect(await storage.getItem('k')).toBeNull();
  });

  test('없는 키는 null 이다', async () => {
    const { store } = createMemoryStore();
    expect(await chunkedStorage(store).getItem('none')).toBeNull();
  });

  test('이모지(서로게이트 쌍)를 조각 경계에서 쪼개지 않는다', async () => {
    const { store, data } = createMemoryStore();
    const storage = chunkedStorage(store, 5);
    const value = 'abcd😀efgh😀ij'; // 😀 는 UTF-16 두 칸. 5칸 경계가 쌍의 한가운데에 걸린다
    await storage.setItem('k', value);
    for (const [key, part] of data) {
      if (key.endsWith('.n')) continue;
      expect(part).not.toMatch(/[\ud800-\udbff]$/); // 조각이 앞 절반으로 끝나지 않는다
      expect(part).not.toMatch(/^[\udc00-\udfff]/); // 뒤 절반으로 시작하지도 않는다
    }
    expect(await storage.getItem('k')).toBe(value);
  });

  test('빈 문자열도 저장한다', async () => {
    const { store } = createMemoryStore();
    const storage = chunkedStorage(store);
    await storage.setItem('k', '');
    expect(await storage.getItem('k')).toBe('');
  });

  test('동시에 여러 번 쓰면 마지막 값이 남고 조각이 섞이지 않는다', async () => {
    const { store } = createMemoryStore({ delayMs: 1 });
    const storage = chunkedStorage(store);
    const values = ['가'.repeat(2500), '나'.repeat(900), '다'.repeat(1700), '라'.repeat(10)];
    await Promise.all(values.map((v) => storage.setItem('k', v))); // 기다리지 않고 연달아 쓴다
    expect(await storage.getItem('k')).toBe(values[values.length - 1]);
  });

  test('splitIntoChunks: 이어 붙이면 원래 값이다', () => {
    expect(splitIntoChunks('가나다라마', 2).join('')).toBe('가나다라마');
    expect(splitIntoChunks('')).toEqual(['']);
  });
});
