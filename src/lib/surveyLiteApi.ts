// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 짧은 설문(04) · 사진 등록(05)이 서버와 주고받는 일(실서버 계약). 데모 모드는 lib/surveyLiteDemo.ts 가 같은 모양으로 메모리에서 한다.
// 원본: backend/스키마.md 4장 '답(value)의 JSON 모양' · 9-6 save_answers · save_free_texts · 9-7 photo 함수 · photos 표 · ai/설계.md 14-2.
//  · 읽기: survey_answers(12문항 중 답한 것) · free_texts(T01) · profiles.birth_date(A01, 02 에서 받은 값) · photos(대기 · 승인 칸)
//  · 저장: 문항ID → 값 묶음을 save_answers 한 번(T01 은 save_free_texts). '답하지 않음'은 JSON null 로 보낸다(스키마 4장 14)
//  · 사진: photo(upload-url) → 서명 URL 로 비공개 버킷 'photos' 에 JPEG 올리기 → photo(finalize) → photos 행 '확인 중'(pending)
//          공개 URL 은 만들지 않는다. 미리보기 URL(300초)은 메모리에서만 쓴다
//  · 마치기: 앱은 설문 본문을 보내지 않고 ai-profile 에 {action:'start'} 만 보낸다(ai/설계.md 14-2)
// 로그에는 이벤트 이름과 코드만 남긴다(답 · 경로 · 서명 URL 금지).
import type { SupabaseClient } from '@supabase/supabase-js';

import { LITE_QUESTIONS } from '@/content/surveyLiteCopy';

import type { RunOutcome } from './aiApi';
import { safeLog } from './log';
import { readDbFailure, readFunctionFailure } from './serverError';

// 서버 survey_answers.value 의 모양 그대로(스키마 4장). 키가 있으면 답한 것, 값 null 은 '답하지 않음'(값 없음)
export type RegionValue = { readonly sido: string; readonly sigungu: string };
export type AgeGapValue = { readonly younger?: number; readonly older?: number };
export type LiteValue = string | number | readonly string[] | RegionValue | AgeGapValue | null;
export type LiteAnswers = Readonly<Record<string, LiteValue>>;

export type PhotoSlot = 'face' | 'full' | 'free';
export const PHOTO_SLOTS: readonly PhotoSlot[] = ['face', 'full', 'free'];
export type SlotRow = { readonly slot: PhotoSlot; readonly photoId: string; readonly status: 'pending' | 'approved' };

export type LiteSnapshot = {
  readonly answers: LiteAnswers;
  readonly birthLocked: boolean; // A01 을 02 에서 이미 받았다(가입 뒤에는 바꿀 수 없다: immutable_after_signup)
  readonly photos: readonly SlotRow[];
};

export type LiteFailure = 'network' | 'server';
export type LoadOutcome = { ok: true; data: LiteSnapshot } | { ok: false; reason: LiteFailure };
export type SaveOutcome = { ok: true } | { ok: false; reason: LiteFailure };
export type JpegFile = { readonly bytes: Uint8Array; readonly width: number; readonly height: number };
// 사진 올리기 실패: 형식(415 not_jpeg) · 크기(413 too_large) · 위치정보(422 has_gps) · 한도(429 slot_limit · daily_limit) · 인터넷 · 그 밖
export type UploadFailCode = 'network' | 'server' | 'format' | 'size' | 'gps' | 'limit';
export type UploadOutcome = { ok: true; photoId: string; status: 'pending' } | { ok: false; code: UploadFailCode };

export type SurveyLiteApi = {
  readonly demo: boolean;
  load(): Promise<LoadOutcome>;
  saveAnswers(values: LiteAnswers): Promise<SaveOutcome>;
  uploadPhoto(slot: PhotoSlot, file: JpegFile): Promise<UploadOutcome>;
  photoPreview(photoId: string): Promise<string | null>;
  submit(): Promise<SaveOutcome>;
  startAi(): Promise<RunOutcome>;
};

export const LITE_IDS: readonly string[] = LITE_QUESTIONS.map((q) => q.id);
export const FREE_TEXT_IDS: readonly string[] = ['T01'];
export const PHOTO_BUCKET = 'photos'; // 비공개 버킷(backend 0003: public=false · 10MB · image/jpeg)

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSlot = (v: unknown): v is PhotoSlot => v === 'face' || v === 'full' || v === 'free';
const dbReason = (error: { code?: string | null; message?: string | null }): LiteFailure => (readDbFailure(error).network ? 'network' : 'server');

// T01 은 free_texts 로, 나머지는 survey_answers 로 나눈다(스키마 4장 2: 다른 표로 들어가면 트리거가 거부)
export function splitForServer(values: LiteAnswers): { answers: Record<string, LiteValue>; texts: Record<string, string> } {
  const answers: Record<string, LiteValue> = {};
  const texts: Record<string, string> = {};
  for (const [id, value] of Object.entries(values)) {
    if (!LITE_IDS.includes(id) || id === 'G01') continue; // 사진은 photos 표로만 간다
    if (FREE_TEXT_IDS.includes(id)) {
      if (typeof value === 'string') texts[id] = value;
    } else answers[id] = value;
  }
  return { answers, texts };
}

// photo 함수 실패 → 앱 코드
export function uploadFailCode(f: { network: boolean; status: number | null; code: string | null }): UploadFailCode {
  if (f.network) return 'network';
  if (f.code === 'not_jpeg') return 'format';
  if (f.code === 'too_large') return 'size';
  if (f.code === 'has_gps') return 'gps';
  if (f.code === 'slot_limit' || f.code === 'daily_limit' || f.status === 429) return 'limit';
  return 'server';
}

export function createSurveyLiteApi(client: SupabaseClient, ai: { start: () => Promise<RunOutcome> }): SurveyLiteApi {
  async function invokePhoto(body: Record<string, unknown>): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; code: UploadFailCode }> {
    const { data, error } = await client.functions.invoke('photo', { body });
    if (error) {
      const f = await readFunctionFailure(error);
      safeLog({ event: 'lite.photo.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
      return { ok: false, code: uploadFailCode(f) };
    }
    return isRecord(data) && data.ok === true ? { ok: true, data } : { ok: false, code: 'server' };
  }

  return {
    demo: false,

    async load() {
      const answersQ = await client.from('survey_answers').select('question_id,value').in('question_id', [...LITE_IDS]);
      if (answersQ.error) return { ok: false, reason: dbReason(answersQ.error) };
      const textsQ = await client.from('free_texts').select('question_id,body').in('question_id', [...FREE_TEXT_IDS]);
      if (textsQ.error) return { ok: false, reason: dbReason(textsQ.error) };
      const profileQ = await client.from('profiles').select('birth_date').maybeSingle();
      if (profileQ.error) return { ok: false, reason: dbReason(profileQ.error) };
      const photosQ = await client.from('photos').select('id,slot,status').in('status', ['pending', 'approved']);
      if (photosQ.error) return { ok: false, reason: dbReason(photosQ.error) };

      const answers: Record<string, LiteValue> = {};
      for (const row of (answersQ.data ?? []) as unknown[]) {
        if (isRecord(row) && typeof row.question_id === 'string' && LITE_IDS.includes(row.question_id)) answers[row.question_id] = (row.value ?? null) as LiteValue;
      }
      for (const row of (textsQ.data ?? []) as unknown[]) {
        if (isRecord(row) && typeof row.question_id === 'string' && typeof row.body === 'string') answers[row.question_id] = row.body;
      }
      const birth = isRecord(profileQ.data) && typeof profileQ.data.birth_date === 'string' ? profileQ.data.birth_date : null;
      if (birth) answers.A01 = birth; // 원본은 A01 답이고 profiles 는 사본(스키마 4장 3). 둘 중 하나만 있어도 같은 값
      const photos: SlotRow[] = [];
      for (const row of (photosQ.data ?? []) as unknown[]) {
        if (!isRecord(row) || typeof row.id !== 'string' || !isSlot(row.slot)) continue;
        if (row.status !== 'pending' && row.status !== 'approved') continue;
        photos.push({ slot: row.slot, photoId: row.id, status: row.status }); // 한 칸에 승인 1 + 대기 1 이 있으면 화면이 대기(새 사진)를 고른다
      }
      return { ok: true, data: { answers, birthLocked: birth !== null, photos } };
    },

    async saveAnswers(values) {
      const { answers, texts } = splitForServer(values);
      if (Object.keys(answers).length > 0) {
        const { error } = await client.rpc('save_answers', { p_answers: answers });
        if (error) {
          safeLog({ event: 'lite.save.fail', code: String(error.message ?? '').split(':')[0].slice(0, 30) || (error.code ?? 'unknown') });
          return { ok: false, reason: dbReason(error) };
        }
      }
      if (Object.keys(texts).length > 0) {
        const { error } = await client.rpc('save_free_texts', { p_texts: texts });
        if (error) {
          safeLog({ event: 'lite.save_text.fail', code: error.code ?? 'unknown' });
          return { ok: false, reason: dbReason(error) };
        }
      }
      return { ok: true };
    },

    async uploadPhoto(slot, file) {
      const issued = await invokePhoto({ action: 'upload-url', slot });
      if (!issued.ok) return issued;
      const path = issued.data.path;
      const token = issued.data.token;
      if (typeof path !== 'string' || typeof token !== 'string') return { ok: false, code: 'server' };
      const put = await client.storage.from(PHOTO_BUCKET).uploadToSignedUrl(path, token, file.bytes, { contentType: 'image/jpeg', upsert: false });
      if (put.error) {
        const network = /fetch|network|failed to|timeout/i.test(String(put.error.message ?? ''));
        safeLog({ event: 'lite.photo.put.fail', code: network ? 'network' : 'storage' });
        return { ok: false, code: network ? 'network' : 'server' };
      }
      const done = await invokePhoto({ action: 'finalize', path });
      if (!done.ok) return done;
      return typeof done.data.photo_id === 'string' ? { ok: true, photoId: done.data.photo_id, status: 'pending' } : { ok: false, code: 'server' };
    },

    async photoPreview(photoId) {
      const r = await invokePhoto({ action: 'url', photo_id: photoId });
      return r.ok && typeof r.data.url === 'string' ? r.data.url : null; // 300초 서명 URL: 메모리에서만 쓴다
    },

    // 실서버에는 '제출' 표가 따로 없다: 쪽마다 저장한 답이 곧 제출이고, 완료 판정은 get_progress 가 한다(스키마 9-6b)
    async submit() {
      return { ok: true };
    },

    startAi: () => ai.start(),
  };
}
