// 탭 화면 오른쪽 위 원형 사진(F11, 화면 ID 09 · 11 · 12 · 13 · 14 · 16)이 보여 줄 내 얼굴 정면 사진 주소 한 개.
//  · 사진 열람 URL 은 300초짜리라 메모리에만 두고 저장 · 로그에 남기지 않는다(보안/구성.md 6-2). 4분이 지나면 다시 받는다
//  · 못 받으면(사진 없음 · 반려 · 오류) uri = null → 그림 부품이 기본 프로필 그림을 그린다. 이 경우는 30초 뒤 다시 확인한다
//  · 탭 화면이 여섯이라도 읽기는 한 번이다(진행 중인 읽기를 함께 쓴다). 08 을 떠나거나 로그아웃 · 탈퇴하면 forgetMyFace 로 비운다
import { create } from 'zustand';

export const FACE_FRESH_MS = 240_000;
export const FACE_RETRY_MS = 30_000;

type FaceState = { uri: string | null; checkedAt: number };
export const useMyFaceStore = create<FaceState>(() => ({ uri: null, checkedAt: 0 }));

export type FaceSource = { facePhotoUrl?: () => Promise<string | null> };

let inflight: Promise<void> | null = null;
let epoch = 0; // 읽는 동안 로그아웃 · 계정 바뀜이 있었으면 늦게 온 주소를 버린다

export function isFaceStale(state: FaceState, now: number): boolean {
  if (state.checkedAt === 0) return true;
  return now - state.checkedAt >= (state.uri ? FACE_FRESH_MS : FACE_RETRY_MS);
}

export function forgetMyFace(): void {
  epoch += 1;
  inflight = null;
  useMyFaceStore.setState({ uri: null, checkedAt: 0 });
}

export function refreshMyFace(source: FaceSource, now: () => number = Date.now): Promise<void> {
  if (!isFaceStale(useMyFaceStore.getState(), now())) return Promise.resolve();
  if (inflight) return inflight;
  const mine = epoch;
  const run = (async () => {
    let uri: string | null = null;
    try {
      uri = typeof source.facePhotoUrl === 'function' ? await source.facePhotoUrl() : null;
    } catch {
      uri = null; // 읽기에 실패해도 화면은 기본 프로필 그림으로 계속 뜬다
    }
    if (mine === epoch) useMyFaceStore.setState({ uri, checkedAt: Math.max(1, now()) });
  })().finally(() => {
    if (inflight === run) inflight = null;
  });
  inflight = run;
  return run;
}
