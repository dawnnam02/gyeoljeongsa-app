// F13 조건 7: 데모 모드의 사진(예전: 1×1 베이지 한 점이 원 · 사진 칸에 늘어나 베이지 빈 칸) → 사진 파일이 없다고 답해서 기본 프로필 그림으로 그린다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { ProfileButton } from '@/components/ProfileButton';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createProfileApi } from '@/lib/profileApi';
import { createRecsApi } from '@/lib/recsApi';
import { forgetMyFace } from '@/store/myFaceStore';

import { has, mount } from './renderHelpers';

const mockProfileApi: { current: { facePhotoUrl: () => Promise<string | null> } } = { current: { facePhotoUrl: async () => null } };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: () => mockProfileApi.current.facePhotoUrl() }, supabase: {} }));

async function login(email: string) {
  const backend = createDemoBackend({ now: () => Date.UTC(2026, 9, 16, 3, 0, 0) });
  await backend.invoke('otp-gate', { body: { action: 'send', email } });
  await backend.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return { backend, client: createDemoClient(backend) };
}

describe('데모 사진 → 기본 그림', () => {
  test('photo 함수는 "파일 없음"(404)으로 답한다 — 1×1 단색 그림을 주지 않는다', async () => {
    const { client } = await login('photook1@email.co');
    const result = await client.functions.invoke('photo', { body: { action: 'url', photo_id: 'x' } });
    expect(result.data).toBeNull();
    expect((result.error as { name?: string }).name).toBe('FunctionsHttpError');
    expect(JSON.stringify(result)).not.toContain('data:image');
  });

  test('사진을 모두 승인받은 계정이어도 내 얼굴 사진 주소 · 상대 사진 주소는 null 이다(앱이 기본 그림을 그린다)', async () => {
    const { client } = await login('photook2@email.co');
    expect(await createProfileApi(client).facePhotoUrl()).toBeNull();
    expect(await createRecsApi(client).photoUrl('demo-ph-1-face')).toBeNull();
  });

  test('머리 오른쪽 위 원형 버튼이 사진 없이 기본 프로필 그림(원 + 사람)으로 뜬다', async () => {
    forgetMyFace();
    const { client } = await login('photook3@email.co');
    mockProfileApi.current = createProfileApi(client);
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = await mount(<ProfileButton />);
    });
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    expect(has(tree, 'profile-button-avatar-default')).toBe(true);
    act(() => tree.unmount());
  });
});
