// 임시(F2L) — AYLA'S 설문으로 교체 예정
// F2L 1단계 조건 3: 사진 다시 만들기(긴 변 ≤ 1600 · JPEG · EXIF · GPS 0 · 10MB) · 비공개 버킷 업로드 계약 · photos 행 '확인 중' · 데모 예시 그림
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  base64ToBytes,
  bytesToBase64,
  fitLongEdge,
  inspectJpeg,
  jpegDataUri,
  PHOTO_LONG_EDGE,
  PHOTO_MAX_BYTES,
  preparePhoto,
  stripJpegMetadata,
  type JpegEncoder,
} from '@/features/photosLite/photoPipeline';
import { unavailablePicker } from '@/features/photosLite/photoPicker';
import { createSurveyLiteApi, PHOTO_BUCKET } from '@/lib/surveyLiteApi';
import { createDemoLiteMemory, createSurveyLiteDemoApi, DEMO_LITE_IMAGES, demoLiteProgress } from '@/lib/surveyLiteDemo';

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때 시간 초과를 막는다(F2L · F6 통합 10-16)

// ── 시험용 JPEG 만들기 ────────────────────────────────────────────────
const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 255, (payload.length + 2) & 255, ...payload];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const APP0 = seg(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
// EXIF: 'Exif\0\0' + TIFF(II) + IFD0 1칸 = GPSInfo(0x8825)
const EXIF_GPS = seg(0xe1, [...ascii('Exif'), 0, 0, 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x25, 0x88, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0]);
const EXIF_PLAIN = seg(0xe1, [...ascii('Exif'), 0, 0, 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x0f, 0x01, 2, 0, 4, 0, 0, 0, ...ascii('ACME'), 0, 0, 0, 0]);
const XMP_GPS = seg(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii('<x exif:GPSLatitude="37"/>')]);
const COMMENT = seg(0xfe, ascii('camera owner'));
const DQT = seg(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]);
const SOS_AND_DATA = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0x56, 0xff, 0xd9];
const jpeg = (...parts: number[][]) => new Uint8Array([0xff, 0xd8, ...parts.flat(), ...SOS_AND_DATA]);

describe('사진 다시 만들기 — 크기', () => {
  test('긴 변을 1600 이하로 줄이고 비율을 지킨다. 작은 사진은 늘리지 않는다', () => {
    expect(PHOTO_LONG_EDGE).toBe(1600);
    expect(fitLongEdge(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitLongEdge(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitLongEdge(1600, 900)).toEqual({ width: 1600, height: 900 });
    expect(fitLongEdge(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitLongEdge(0, 600)).toEqual({ width: 0, height: 0 });
  });
});

describe('사진 다시 만들기 — 메타데이터(EXIF · GPS · XMP · 주석) 0', () => {
  test('EXIF GPS · XMP GPS · 주석을 찾아낸다', () => {
    expect(inspectJpeg(jpeg(APP0, EXIF_GPS, DQT))).toEqual({ jpeg: true, exif: true, gps: true, metaSegments: 1 });
    expect(inspectJpeg(jpeg(APP0, EXIF_PLAIN, DQT))).toMatchObject({ exif: true, gps: false });
    expect(inspectJpeg(jpeg(APP0, XMP_GPS, COMMENT, DQT))).toMatchObject({ exif: false, gps: true, metaSegments: 2 });
    expect(inspectJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toMatchObject({ jpeg: false });
  });

  test('걷어 낸 뒤에는 APP0 · 양자화표 · 그림 데이터만 남고 EXIF · GPS · 주석은 0', () => {
    const dirty = jpeg(APP0, EXIF_GPS, XMP_GPS, COMMENT, DQT);
    const clean = stripJpegMetadata(dirty);
    expect(clean).not.toBeNull();
    expect(inspectJpeg(clean as Uint8Array)).toEqual({ jpeg: true, exif: false, gps: false, metaSegments: 0 });
    expect(Array.from(clean as Uint8Array)).toEqual(Array.from(jpeg(APP0, DQT)));
    expect(stripJpegMetadata(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  test('preparePhoto: 인코더에 줄인 크기를 주고, 결과의 메타를 걷고, 검사한 JPEG 만 돌려준다', async () => {
    const encode = jest.fn<ReturnType<JpegEncoder>, Parameters<JpegEncoder>>(async () => jpeg(APP0, EXIF_GPS, DQT)); // 인코더가 EXIF 를 남겨도
    const out = await preparePhoto({ uri: 'blob:x', width: 4032, height: 3024, bytes: 5_000_000 }, encode);
    expect(encode).toHaveBeenCalledWith(expect.anything(), { width: 1600, height: 1200 }, 0.85);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect([out.file.width, out.file.height]).toEqual([1600, 1200]);
    expect(Math.max(out.file.width, out.file.height)).toBeLessThanOrEqual(1600);
    expect(inspectJpeg(out.file.bytes)).toEqual({ jpeg: true, exif: false, gps: false, metaSegments: 0 });
  });

  test('preparePhoto: 고른 파일이 10MB 를 넘거나 · 그리지 못하거나 · JPEG 가 아니면 올리지 않는다', async () => {
    const encode: JpegEncoder = async () => jpeg(APP0, DQT);
    expect(PHOTO_MAX_BYTES).toBe(10485760);
    expect(await preparePhoto({ uri: 'x', width: 100, height: 100, bytes: PHOTO_MAX_BYTES + 1 }, encode)).toEqual({ ok: false, code: 'size' });
    expect(await preparePhoto({ uri: 'x', width: 100, height: 100, bytes: 10 }, async () => null)).toEqual({ ok: false, code: 'format' });
    expect(await preparePhoto({ uri: 'x', width: 100, height: 100, bytes: 10 }, async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({ ok: false, code: 'format' });
    expect(await preparePhoto({ uri: 'x', width: 0, height: 0, bytes: 10 }, encode)).toEqual({ ok: false, code: 'format' });
  });

  test('base64 왕복 · 미리보기 data URI(메모리)', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
    expect(bytesToBase64(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('/9j/');
    expect(jpegDataUri(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('data:image/jpeg;base64,/9j/');
  });

  test('데모 예시 그림 3장은 JPEG 이고 EXIF · GPS 가 없으며 긴 변 1600 이하(90×120)', () => {
    for (const b64 of Object.values(DEMO_LITE_IMAGES)) {
      const bytes = base64ToBytes(b64);
      expect(inspectJpeg(bytes)).toEqual({ jpeg: true, exif: false, gps: false, metaSegments: 0 });
      expect(bytes.length).toBeLessThan(4000);
    }
  });

  test('iOS · Android 고르기 패키지는 2단계(통합) 전까지 쓸 수 없음으로 표시된다', async () => {
    expect(unavailablePicker.available).toBe(false);
    expect(await unavailablePicker.pick()).toBeNull();
  });
});

// ── 실서버 계약(가짜 클라이언트) ──────────────────────────────────────
type Call = { kind: string; name?: string; args?: unknown };
function fakeClient(options: { photoFail?: Record<string, { status: number; code: string }>; putError?: string; rpcError?: Record<string, string> } = {}) {
  const calls: Call[] = [];
  const httpError = (status: number, code: string) => ({
    name: 'FunctionsHttpError',
    context: { status, json: async () => ({ ok: false, code }) },
  });
  const tableRows: Record<string, unknown[]> = {
    survey_answers: [{ question_id: 'A03', value: { sido: '서울', sigungu: '마포구' } }, { question_id: 'C05', value: null }, { question_id: 'Z99', value: 1 }],
    free_texts: [{ question_id: 'T01', body: '가'.repeat(25) }],
    photos: [{ id: 'p-face', slot: 'face', status: 'pending' }, { id: 'p-old', slot: 'full', status: 'approved' }],
  };
  const client = {
    from: (table: string) => {
      calls.push({ kind: 'from', name: table });
      const chain = {
        select: (cols: string) => {
          calls.push({ kind: 'select', name: table, args: cols });
          return chain;
        },
        in: (col: string, values: unknown[]) => {
          calls.push({ kind: 'in', name: `${table}.${col}`, args: values });
          return Promise.resolve({ data: tableRows[table] ?? [], error: null });
        },
        maybeSingle: () => Promise.resolve({ data: { birth_date: '1995-03-12' }, error: null }),
      };
      return chain;
    },
    rpc: async (name: string, args: unknown) => {
      calls.push({ kind: 'rpc', name, args });
      const failure = options.rpcError?.[name];
      return failure ? { data: null, error: { code: 'P0001', message: failure } } : { data: 1, error: null };
    },
    functions: {
      invoke: async (name: string, { body }: { body: Record<string, unknown> }) => {
        calls.push({ kind: 'invoke', name, args: body });
        const fail = options.photoFail?.[String(body.action)];
        if (fail) return { data: null, error: httpError(fail.status, fail.code) };
        if (body.action === 'upload-url') return { data: { ok: true, path: `u1/${body.slot}/11111111-1111-1111-1111-111111111111.jpg`, signed_url: 'https://x/upload', token: 'tok', max_bytes: 10485760, content_type: 'image/jpeg' }, error: null };
        if (body.action === 'finalize') return { data: { ok: true, photo_id: 'new-photo', slot: 'face', status: 'pending' }, error: null };
        if (body.action === 'url') return { data: { ok: true, url: 'https://signed/view', expires_in: 300 }, error: null };
        return { data: null, error: httpError(400, 'invalid_request') };
      },
    },
    storage: {
      from: (bucket: string) => ({
        uploadToSignedUrl: async (path: string, token: string, body: Uint8Array, opts: unknown) => {
          calls.push({ kind: 'storage', name: bucket, args: { path, token, size: body.length, opts } });
          return options.putError ? { data: null, error: { message: options.putError } } : { data: { path }, error: null };
        },
      }),
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('실서버 계약(lib/surveyLiteApi.ts)', () => {
  const start = jest.fn(async () => ({ kind: 'pending' as const, resultId: null }));

  test('읽기: 12문항 답 · T01 은 free_texts · A01 은 profiles 생년월일(잠김) · 사진은 대기 · 승인 칸만', async () => {
    const { client, calls } = fakeClient();
    const api = createSurveyLiteApi(client, { start });
    const r = await api.load();
    expect(r).toEqual({
      ok: true,
      data: {
        answers: { A03: { sido: '서울', sigungu: '마포구' }, C05: null, T01: '가'.repeat(25), A01: '1995-03-12' },
        birthLocked: true,
        photos: [{ slot: 'face', photoId: 'p-face', status: 'pending' }, { slot: 'full', photoId: 'p-old', status: 'approved' }],
      },
    });
    expect(calls.find((c) => c.name === 'photos.status')?.args).toEqual(['pending', 'approved']);
  });

  test('저장: save_answers(값 모양 그대로, 답하지 않음 = null) + T01 은 save_free_texts', async () => {
    const { client, calls } = fakeClient();
    const api = createSurveyLiteApi(client, { start });
    expect(await api.saveAnswers({ A05: 172, C05: null, T01: '가'.repeat(20) })).toEqual({ ok: true });
    expect(calls.filter((c) => c.kind === 'rpc')).toEqual([
      { kind: 'rpc', name: 'save_answers', args: { p_answers: { A05: 172, C05: null } } },
      { kind: 'rpc', name: 'save_free_texts', args: { p_texts: { T01: '가'.repeat(20) } } },
    ]);
    const failing = createSurveyLiteApi(fakeClient({ rpcError: { save_answers: 'invalid_answer: A05' } }).client, { start });
    expect(await failing.saveAnswers({ A05: 999 })).toEqual({ ok: false, reason: 'server' });
  });

  test("사진: upload-url → 비공개 버킷 'photos' 에 서명 URL 로 JPEG → finalize → '확인 중' 행. 공개 URL 은 만들지 않는다", async () => {
    const { client, calls } = fakeClient();
    const api = createSurveyLiteApi(client, { start });
    const bytes = jpeg(APP0, DQT);
    expect(await api.uploadPhoto('face', { bytes, width: 1600, height: 1200 })).toEqual({ ok: true, photoId: 'new-photo', status: 'pending' });
    expect(PHOTO_BUCKET).toBe('photos');
    expect(calls.filter((c) => c.kind === 'invoke' || c.kind === 'storage')).toEqual([
      { kind: 'invoke', name: 'photo', args: { action: 'upload-url', slot: 'face' } },
      { kind: 'storage', name: 'photos', args: { path: 'u1/face/11111111-1111-1111-1111-111111111111.jpg', token: 'tok', size: bytes.length, opts: { contentType: 'image/jpeg', upsert: false } } },
      { kind: 'invoke', name: 'photo', args: { action: 'finalize', path: 'u1/face/11111111-1111-1111-1111-111111111111.jpg' } },
    ]);
    expect(JSON.stringify(calls)).not.toMatch(/getPublicUrl|public/i);
    expect(await api.photoPreview('new-photo')).toBe('https://signed/view');
  });

  test('사진 실패 코드: 한도 429 · 위치정보 422 · 형식 415 · 크기 413 · 올리기 끊김', async () => {
    const run = async (opts: Parameters<typeof fakeClient>[0]) => createSurveyLiteApi(fakeClient(opts).client, { start }).uploadPhoto('free', { bytes: jpeg(APP0, DQT), width: 10, height: 10 });
    expect(await run({ photoFail: { 'upload-url': { status: 429, code: 'daily_limit' } } })).toEqual({ ok: false, code: 'limit' });
    expect(await run({ photoFail: { finalize: { status: 422, code: 'has_gps' } } })).toEqual({ ok: false, code: 'gps' });
    expect(await run({ photoFail: { finalize: { status: 415, code: 'not_jpeg' } } })).toEqual({ ok: false, code: 'format' });
    expect(await run({ photoFail: { finalize: { status: 413, code: 'too_large' } } })).toEqual({ ok: false, code: 'size' });
    expect(await run({ putError: 'Failed to fetch' })).toEqual({ ok: false, code: 'network' });
  });

  test('마치기: 실서버는 제출 표가 없어 submit 은 그대로 통과, AI 는 ai-profile start 만 부른다', async () => {
    const api = createSurveyLiteApi(fakeClient().client, { start });
    expect(await api.submit()).toEqual({ ok: true });
    await api.startAi();
    expect(start).toHaveBeenCalledTimes(1);
  });
});

// ── 데모 메모리(lib/surveyLiteDemo.ts) ───────────────────────────────
function demoClient(email: string) {
  const rpcs: unknown[] = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: `id-${email}`, email } } } }) },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { birth_date: '1995-03-12' }, error: null }) }) }),
    rpc: async (name: string, args: unknown) => {
      rpcs.push({ name, args });
      return { data: 1, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, rpcs };
}

describe('데모 메모리: 임시 저장 · 이어서 · 사진 · 장면', () => {
  test('저장한 답이 메모리에 남아 다시 읽으면 이어진다(02 의 생년월일은 잠김)', async () => {
    const memory = createDemoLiteMemory();
    const { client } = demoClient('demo@email.com');
    const start = jest.fn(async () => ({ kind: 'pending' as const, resultId: null }));
    const api = createSurveyLiteDemoApi(client, { start }, memory);
    expect(await api.saveAnswers({ A05: 172, T01: '가'.repeat(20) })).toEqual({ ok: true });
    const again = createSurveyLiteDemoApi(client, { start }, memory); // 화면을 떠났다 돌아옴
    const r = await again.load();
    expect(r.ok && r.data).toEqual({ answers: { A05: 172, T01: '가'.repeat(20), A01: '1995-03-12' }, birthLocked: true, photos: [] });
    expect(await api.saveAnswers({ A05: 999 })).toEqual({ ok: false, reason: 'server' }); // 서버 검사식과 같은 규칙
    expect(await api.submit()).toEqual({ ok: true });
    await api.startAi();
    expect(start).toHaveBeenCalled();
  });

  test('사진: JPEG 만 받아 칸마다 확인 중 1장(새로 올리면 교체), 미리보기는 메모리 data URI', async () => {
    const api = createSurveyLiteDemoApi(demoClient('p@email.com').client, { start: jest.fn() }, createDemoLiteMemory());
    const bytes = base64ToBytes(DEMO_LITE_IMAGES.face);
    const first = await api.uploadPhoto('face', { bytes, width: 90, height: 120 });
    expect(first).toMatchObject({ ok: true, status: 'pending' });
    const second = await api.uploadPhoto('face', { bytes, width: 90, height: 120 });
    const r = await api.load();
    expect(r.ok && r.data.photos).toEqual([{ slot: 'face', photoId: second.ok ? second.photoId : '', status: 'pending' }]);
    expect(await api.photoPreview(second.ok ? second.photoId : '')).toMatch(/^data:image\/jpeg;base64,\/9j\//);
    expect(await api.uploadPhoto('full', { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), width: 1, height: 1 })).toEqual({ ok: false, code: 'format' });
    expect(await api.uploadPhoto('full', { bytes: new Uint8Array(PHOTO_MAX_BYTES + 1), width: 1, height: 1 })).toEqual({ ok: false, code: 'size' });
  });

  test('장면 litesavefail(저장 인터넷 실패) · litephotofail(칸마다 첫 올리기 실패)', async () => {
    const save = createSurveyLiteDemoApi(demoClient('litesavefail@email.com').client, { start: jest.fn() }, createDemoLiteMemory());
    expect(await save.saveAnswers({ A05: 172 })).toEqual({ ok: false, reason: 'network' });
    const photo = createSurveyLiteDemoApi(demoClient('litephotofail@email.com').client, { start: jest.fn() }, createDemoLiteMemory());
    const bytes = base64ToBytes(DEMO_LITE_IMAGES.free);
    expect(await photo.uploadPhoto('free', { bytes, width: 90, height: 120 })).toEqual({ ok: false, code: 'network' });
    expect(await photo.uploadPhoto('free', { bytes, width: 90, height: 120 })).toMatchObject({ ok: true });
  });

  test('A01 을 바꿔 보내면 모의 서버 save_answers 로 넘긴다(생년월일 원본은 모의 서버)', async () => {
    const { client, rpcs } = demoClient('a01@email.com');
    const api = createSurveyLiteDemoApi(client, { start: jest.fn() }, createDemoLiteMemory());
    expect(await api.saveAnswers({ A01: '1990-01-01' })).toEqual({ ok: true });
    expect(rpcs).toEqual([{ name: 'save_answers', args: { p_answers: { A01: '1990-01-01' } } }]);
  });

  test('2단계 통합용 진행 요약: 처음 빈 필수 문항 · 확인 중 칸 수 · 제출 표시', async () => {
    const memory = createDemoLiteMemory();
    const { client } = demoClient('prog@email.com');
    const api = createSurveyLiteDemoApi(client, { start: jest.fn() }, memory);
    expect(demoLiteProgress('id-prog@email.com', memory)).toEqual({ firstMissing: 'A03', photoSlots: 0, submitted: false });
    await api.saveAnswers({ A03: { sido: '서울', sigungu: '중구' }, A05: 170 });
    await api.uploadPhoto('face', { bytes: base64ToBytes(DEMO_LITE_IMAGES.face), width: 90, height: 120 });
    expect(demoLiteProgress('id-prog@email.com', memory)).toEqual({ firstMissing: 'B01', photoSlots: 1, submitted: false });
  });
});
