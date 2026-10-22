// 사진 id 목록 → 서명 URL(메모리에서만). 서버 주소는 300초 뒤 만료되므로(backend photo URL_SECONDS)
//  - 만료 전(REFRESH_MS)에 다시 받는다 → 탭을 계속 열어 둬도 사진이 이어서 보인다
//  - 못 받은 사진(null · 던짐)은 RETRY_MS 뒤 최대 RETRY_MAX 번 다시 받는다
//  - 한 장이 던져도 나머지는 그대로 보인다
import { useEffect, useState } from 'react';

export const PHOTO_URL_REFRESH_MS = 240_000;
export const PHOTO_URL_RETRY_MS = 5_000;
export const PHOTO_URL_RETRY_MAX = 3;

type Urls = Readonly<Record<string, string | null>>;

export function usePhotoUrls(
  ids: readonly (string | null)[],
  load: (id: string) => Promise<string | null>,
  salt = '',
): Urls {
  const [urls, setUrls] = useState<Urls>({});
  const key = ids.filter(Boolean).join('|');
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const wanted = key === '' ? [] : key.split('|');
    const safeLoad = async (id: string) => {
      try {
        return await load(id);
      } catch {
        return null;
      }
    };
    const run = async () => {
      const entries = await Promise.all(wanted.map(async (id) => [id, await safeLoad(id)] as const));
      if (cancelled) return;
      setUrls(Object.fromEntries(entries));
      if (wanted.length === 0) return;
      const missing = entries.some(([, url]) => url == null);
      if (missing) failures += 1;
      else failures = 0;
      if (missing && failures > PHOTO_URL_RETRY_MAX) return; // 계속 못 받으면 멈춘다(다음 화면 진입 때 다시)
      timer = setTimeout(() => void run(), missing ? PHOTO_URL_RETRY_MS : PHOTO_URL_REFRESH_MS);
    };
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // key · salt 가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, salt]);
  return urls;
}
