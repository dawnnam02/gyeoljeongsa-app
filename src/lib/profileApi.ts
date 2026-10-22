// 08 내 프로필이 서버와 주고받는 일. 원본: backend/스키마.md profiles · visibility_settings · survey_answers · verifications · photos · 보안/구성.md 6-2.
//  · 읽기: 본인 행만(RLS). survey_answers(이름 A12 · 생일 A01 · 지역 A03 · 토글 문항 9개) · visibility_settings · verifications · photos
//  · 저장: visibility_settings 의 열 단위 update(바뀐 토글의 열만). 상대 화면은 서버 함수 get_candidate_profile 이 이 표로 거른다 — 앱은 가리는 일을 하지 않는다
//  · 사진: 서버 함수 photo { action:'url', photo_id } 가 300초짜리 서명 URL 을 준다. URL 은 메모리에서만 쓰고 저장 · 로그에 남기지 않는다
//  · 처음 한 번 확인: rpc ack_visibility_review(계약 제안, 서버에 아직 없다 → 없어도 화면은 09 로 간다)
// 로그에는 이벤트 이름과 코드만 남긴다(답 · 이름 금지).
import type { SupabaseClient } from '@supabase/supabase-js';

import { photoViews, TOGGLE_DEFS, TOGGLE_QUESTIONS, type PhotoView, type ToggleChanges, type ToggleState } from '@/features/profile/profileLogic';

import { safeLog } from './log';
import { readDbFailure, readFunctionFailure } from './serverError';

export type ProfileFailure = 'network' | 'server';
export type Verification = 'unverified' | 'pending' | 'verified';

export type ProfileData = {
  name: string | null; // A12 (본인 화면 머리에서 성 + OO 로 가려 보인다)
  birthDate: string | null; // A01
  region: string | null; // A03: '서울 마포구'
  verification: Verification;
  photos: PhotoView[];
  visibility: ToggleState; // 서버에 저장된 토글 9개
  answers: Readonly<Record<string, unknown>>; // 토글 문항 9개의 값(잠금 판정용)
};

export type LoadResult = { ok: true; data: ProfileData } | { ok: false; reason: ProfileFailure };
export type SaveResult = { ok: true } | { ok: false; reason: ProfileFailure };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readRegion(value: unknown): string | null {
  if (!isRecord(value) || typeof value.sido !== 'string') return null;
  return typeof value.sigungu === 'string' && value.sigungu !== '' ? `${value.sido} ${value.sigungu}` : value.sido;
}

export function createProfileApi(client: SupabaseClient) {
  const fail = (error: { code?: string | null; message?: string | null }, event: string): { ok: false; reason: ProfileFailure } => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    return { ok: false, reason: f.network ? 'network' : 'server' };
  };

  async function photoUrl(photoId: string): Promise<string | null> {
    const { data, error } = await client.functions.invoke('photo', { body: { action: 'url', photo_id: photoId } });
    if (error) {
      const f = await readFunctionFailure(error);
      safeLog({ event: 'profile.photo.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
      return null;
    }
    return isRecord(data) && data.ok === true && typeof data.url === 'string' ? data.url : null;
  }

  return {
    async load(): Promise<LoadResult> {
      const ids = ['A01', 'A03', 'A12', ...TOGGLE_QUESTIONS];
      const [answers, visibility, verification, photos] = await Promise.all([
        client.from('survey_answers').select('question_id,value').in('question_id', ids),
        client.from('visibility_settings').select('*').maybeSingle(),
        client.from('verifications').select('status').maybeSingle(),
        client.from('photos').select('id,slot,status,submitted_at').order('submitted_at', { ascending: false }),
      ]);
      for (const r of [answers, visibility, verification, photos]) if (r.error) return fail(r.error, 'profile.load.fail');
      const byId: Record<string, unknown> = {};
      for (const row of (answers.data ?? []) as { question_id: string; value: unknown }[]) byId[row.question_id] = row.value;
      const vis = (visibility.data ?? {}) as Record<string, unknown>;
      const toggles = Object.fromEntries(TOGGLE_DEFS.map((d) => [d.key, typeof vis[d.column] === 'boolean' ? (vis[d.column] as boolean) : d.initial])) as ToggleState;
      const status = (verification.data as { status?: string } | null)?.status;
      return {
        ok: true,
        data: {
          name: typeof byId.A12 === 'string' ? byId.A12 : null,
          birthDate: typeof byId.A01 === 'string' ? byId.A01 : null,
          region: readRegion(byId.A03),
          verification: status === 'verified' ? 'verified' : status === 'pending' ? 'pending' : 'unverified',
          photos: photoViews((photos.data ?? []) as { id: string; slot: string; status: string; submitted_at?: string | null }[]),
          visibility: toggles,
          answers: Object.fromEntries(TOGGLE_QUESTIONS.map((q) => [q, byId[q]])),
        },
      };
    },

    // 바뀐 토글의 열만 고친다(열 단위 권한). 서버는 저장 즉시 새 공개 범위로 상대 화면을 바꾼다(정책 P2-09)
    async saveVisibility(changes: ToggleChanges): Promise<SaveResult> {
      if (Object.keys(changes).length === 0) return { ok: true };
      const { error } = await client.from('visibility_settings').update(changes as Record<string, boolean>);
      if (error) return fail(error, 'profile.save.fail');
      safeLog({ event: 'profile.save.ok', count: Object.keys(changes).length });
      return { ok: true };
    },

    // 사진 열람 URL(300초). 못 받으면 null — 화면은 빈 칸을 보인다
    photoUrl,

    // 탭 화면 오른쪽 위 원형 사진(F11): 내 얼굴 정면 사진 한 장의 열람 URL. 승인됨 · 확인 중만 쓴다(본인은 확인 중인 사진도 본다).
    // 반려 · 없음 · 못 불러옴은 null → 화면이 기본 프로필 그림을 그린다. 08 load 처럼 문항 · 공개 범위를 읽지 않고 사진 표만 읽는다
    async facePhotoUrl(): Promise<string | null> {
      const { data, error } = await client.from('photos').select('id,slot,status,submitted_at').order('submitted_at', { ascending: false });
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'profile.face.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        return null;
      }
      const face = photoViews((data ?? []) as { id: string; slot: string; status: string; submitted_at?: string | null }[]).find((p) => p.slot === 'face');
      if (!face?.id || (face.status !== 'approved' && face.status !== 'pending')) return null;
      return photoUrl(face.id);
    },

    // 07 직후 처음 한 번 확인을 마쳤다는 기록(계약 제안). 서버에 함수가 아직 없으면 실패해도 막지 않는다
    async ackReview(): Promise<void> {
      const { error } = await client.rpc('ack_visibility_review');
      if (error) safeLog({ event: 'profile.ack.skip', code: error.code ?? 'unknown' });
    },
  };
}

export type ProfileApi = ReturnType<typeof createProfileApi>;
