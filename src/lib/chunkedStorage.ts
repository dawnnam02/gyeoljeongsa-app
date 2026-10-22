// 값을 조각으로 나눠 저장하는 저장소 껍데기(보안/구성.md 4-1, 시험 통과본을 따른다).
// SecureStore 는 값 하나가 약 2048바이트를 넘으면 거부할 수 있다(Expo 문서).
// 한글 한 글자는 3바이트라서 조각을 600자로 자른다(최대 1800바이트).
// 보안/구성.md 원문과 다른 점 둘:
//  1) 이모지 같은 서로게이트 쌍의 한가운데에서는 자르지 않는다(쪼개면 UTF-8로 저장할 때 글자가 깨진다).
//  2) 읽기 · 쓰기 · 지우기를 한 줄로 세워 차례로 실행한다. 조각을 여러 번 쓰는 동안 다른 쓰기가 끼어들면
//     조각이 섞이기 때문이다(글자를 칠 때마다 저장이 이어지는 설문 임시 저장이 이 경우다).
export type Store = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
};

export const CHUNK_SIZE = 600;

export function splitIntoChunks(value: string, chunk: number = CHUNK_SIZE): string[] {
  const parts: string[] = [];
  let i = 0;
  while (i < value.length) {
    let end = Math.min(i + chunk, value.length);
    if (end < value.length) {
      const last = value.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end -= 1; // 앞 절반만 남기지 않는다
    }
    parts.push(value.slice(i, end));
    i = end;
  }
  return parts.length > 0 ? parts : [''];
}

export function chunkedStorage(store: Store, chunk: number = CHUNK_SIZE) {
  let tail: Promise<unknown> = Promise.resolve();
  function inOrder<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined); // 앞 작업이 실패해도 줄은 이어진다
    return run;
  }

  const count = async (key: string) => Number((await store.get(`${key}.n`)) ?? 0);

  return {
    getItem: (key: string): Promise<string | null> =>
      inOrder(async () => {
        const n = await count(key);
        if (!n) return null;
        let out = '';
        for (let i = 0; i < n; i++) {
          const part = await store.get(`${key}.${i}`);
          if (part == null) return null; // 조각이 빠졌으면 값 없음으로 본다
          out += part;
        }
        return out;
      }),

    setItem: (key: string, value: string): Promise<void> =>
      inOrder(async () => {
        const parts = splitIntoChunks(value, chunk);
        const old = await count(key);
        for (let i = 0; i < parts.length; i++) await store.set(`${key}.${i}`, parts[i]);
        await store.set(`${key}.n`, String(parts.length));
        for (let i = parts.length; i < old; i++) await store.del(`${key}.${i}`);
      }),

    removeItem: (key: string): Promise<void> =>
      inOrder(async () => {
        const n = await count(key);
        for (let i = 0; i < n; i++) await store.del(`${key}.${i}`);
        await store.del(`${key}.n`);
      }),
  };
}
