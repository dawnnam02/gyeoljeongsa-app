// 시험용 메모리 저장소. SecureStore 를 흉내 낸다: 값 하나가 2048바이트(UTF-8)를 넘으면 거부한다.
import type { Store } from '@/lib/chunkedStorage';

export const SECURESTORE_LIMIT_BYTES = 2048;

export function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function createMemoryStore(options: { delayMs?: number } = {}) {
  const data = new Map<string, string>();
  const sleep = () => (options.delayMs ? new Promise((r) => setTimeout(r, options.delayMs)) : Promise.resolve());
  const store: Store = {
    async get(key) {
      await sleep();
      return data.get(key) ?? null;
    },
    async set(key, value) {
      await sleep();
      if (utf8Bytes(value) > SECURESTORE_LIMIT_BYTES) throw new Error('SecureStore 한도(2048바이트)를 넘음');
      data.set(key, value);
    },
    async del(key) {
      await sleep();
      data.delete(key);
    },
  };
  return { store, data };
}
