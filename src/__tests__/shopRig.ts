// 16 상점 화면 시험 도우미(시험 파일이 아니다): 데모 모의 서버(lib/shopDemo)에 로그인한 사용자로 ShopScreen 에 넣을 deps 를 만든다.
import type { ShopDeps } from '@/features/shop/shopTypes';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createGradeApi } from '@/lib/gradeApi';
import { createShopApi } from '@/lib/shopApi';

export const SHOP_START = Date.UTC(2026, 9, 16, 3, 0, 0); // 한국 시각 2026-10-16 12:00

let counter = 0;
export async function makeShopRig(scene = 'plain', now: () => number = () => SHOP_START) {
  counter += 1;
  const backend = createDemoBackend({ now });
  const client = createDemoClient(backend);
  const email = `${scene}${counter}@email.co`;
  await backend.invoke('otp-gate', { body: { action: 'send', email } });
  await backend.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  let n = 0;
  const deps: ShopDeps = {
    api: createShopApi(client),
    grade: createGradeApi(client),
    now,
    newId: () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`,
    toastMs: 3_000, // 3부-차 ⑧: 400ms 였을 때 바쁜 기계에서 토스트가 시험이 보기 전에 사라져 gradeScreen '내 등급 알려 주세요' 시험이 가끔 실패했다(글은 setTimeout 으로 걷힘)
    slowMs: 30_000,
  };
  return { backend, client, deps, email, gradeApi: createGradeApi(client) };
}
