// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 데모 모드(EXPO_PUBLIC_DEMO_MODE=1)의 짧은 설문 · 사진 저장소. lib/surveyLiteApi.ts 와 같은 모양(SurveyLiteApi)을 메모리에서 한다.
// 약속: 서버에 요청하지 않고 기기 · 브라우저 저장소에 아무것도 쓰지 않는다. 페이지를 닫으면 사라진다(데모 메모리).
//  · 답: 사용자(모의 로그인)마다 메모리에 둔다 — [다음] · [임시 저장]이 저장하고, 화면을 떠났다 돌아오면 이어서 보인다
//        A01 생년월일만은 02 에서 받은 값을 모의 서버(lib/demoBackend.ts 의 profiles.birth_date)에서 읽고, 바꾸면 모의 서버 save_answers 로 보낸다
//  · 값 검사: 서버 검사식(backend 0001 validate_survey_answer)과 같은 모양 규칙만 흉내 낸다(문항표 보기 · 범위 · 글자 수)
//  · 사진: 실제 사진을 고르지 않는다. 칸을 누르면 예시 그림(아래 DEMO_LITE_IMAGES, 90×120 JPEG · EXIF 없음)이 같은 메타 걷기 · 검사를 거쳐
//          '확인 중'(pending) 행이 된다. 서버 finalize 처럼 JPEG 표지 · 10MB 를 본다
//  · 마치기: submit 은 메모리 표시, AI 시작은 모의 서버의 ai-profile(start)을 그대로 부른다(06 이 그 건을 읽는다)
//  · 장면(이메일 앞부분): litesavefail = 저장이 인터넷 문제로 실패 · litephotofail = 칸마다 첫 올리기가 실패
//  · 화면 점검(scripts/web-f2l.mjs)이 볼 수 있게 데모 모드 웹에서만 읽기 전용 창구 __surveyLitePeek 를 연다(메모리 안 값만)
import type { SupabaseClient } from '@supabase/supabase-js';

import { LITE_QUESTIONS } from '@/content/surveyLiteCopy';

import type { RunOutcome } from './aiApi';
import { LITE_IDS, PHOTO_SLOTS, splitForServer, type LiteAnswers, type LiteValue, type PhotoSlot, type SlotRow, type SurveyLiteApi } from './surveyLiteApi';

// 예시 그림 3장(얼굴 정면 · 전신 · 자유 자리. 사람 사진이 아닌 단순한 도형). 90×120 JPEG, EXIF 없음
export const DEMO_LITE_IMAGES: Readonly<Record<PhotoSlot, string>> = {
  face:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAB4AFoDASIAAhEBAxEB/8QAGgABAAMBAQEAAAAAAAAAAAAAAAQGBwUCA//EADkQAAEDAwIDBAUKBwAAAAAAAAEAAgMEBREhMQYSQVFhgZEHEyIjcRQVFkJSVKOywdI1RXJ0g7HC/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAERMf/aAAwDAQACEQMRAD8A1lERYbEREBERAREQEREBERAREQERfCtq4qCjlq5ziOJpcdRk9wz1OwQfV72RRukkc1jGglznHAAG5JXKm4rscEron3Bhc3csa548wCCs+vN9rL1UufM9zIc5ZA13ssxt8Tqdf00XMU1rGxUdwo7hHz0lTFMAATyOyW52yNx4qSsYhnlp5WywSvikbs9ji0jxC0fhTiI3qmdDU8oq4AOYjA9YPtAf76ajtwCWLAiIqgiIgIiICpfpCrgI6W3tLSSTM8YORuG67a5d5BXRZ96QGPF5p5C1wY6nADsaEhzsjPiPMKVYqqIijQp9jrhbb1S1bi0MZJh5cCcNOjjp3EqAvTGPlkbHG1z3uIDWtGSSdgAg2lERaYEREBERAVc42tb6+0CohY10tIS8kux7GPax06A+HnY0QYoivN94G9dLJVWpzGF2ppnaDOueU9M6aHTvA0VXm4fvEEron22pLm7lkZePMZBWW9c5WDg21vr70yoLGugpCHvJdj2teXHiM9mnn7tvBF0rHB1SG0cRAOX+045H2QfhnON1frdbqa1UbKWlZysbqSd3HqSepVS1KREVZEREBERAXl72RRukkc1jGglznHAAG5JUC9XqmslGZ5zzPdpFEDq8/oO09PILNrtfa+8y81VLhgxywsyGNI64zvqde9RZGiVHFFkppAyS4xOJGfdgyDzaCF8vpjYPv/4Mn7Vl6Jq41D6Y2D7/APgyftXUpq2krOb5LVQz8mOb1UgdjO2cfBY2vpDPLTytlglfFI3Z7HFpHiE0xs6KqcNcYfOEraK5FjJ3YEUoGBIew9jj5HbTTNrVQRERBEUW6TSU9prJ4ncskUD3sdjOCGkhBmnEd4feLrJI2RxpoyWwNzoG9uMDfGe3YdFyURZbEREBERB6Y98UjZI3OY9pBa5pwQRsQVqvDl1+d7NFUOOZm+7m/rHXYDUYOnbhZQrz6O5pHQV0Bd7tjmPa3GxIIP5R5KxKuSIirIoV6/gVw/tZPylTVDu7Hy2aujja573U8ga1oySS04ACDIERFlsREQEREBXb0dfzH/F/2qSrv6O2PEdwkLXBjjGA7GhI5sjPiPMKl4uiIirAiIgyO92x9ous1I7mLGnMbj9Zh2OcDPYe8FQERZbEREBERAWpcKWx9rscccvMJZj66Rp+qSBgYwMaAZ78oisSuyiIqy//2Q==',
  full:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAB4AFoDASIAAhEBAxEB/8QAGQABAQEBAQEAAAAAAAAAAAAAAAcFBAYD/8QANhAAAgEDAgMECAMJAAAAAAAAAAECAwQRBQYSITE1QXSyBzZRYXGBgsITYpEXIjJSVJKxwdL/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAWEQEBAQAAAAAAAAAAAAAAAAAAAUH/2gAMAwEAAhEDEQA/AKyADDYAAABl3e5dGsa7oXF9BVI/xRhGU8POMPhTw+XQDUB86NelcUo1aFWFWnLpOElJP5o+gAAAAAAAAAAAYe79Sr6Zocp28pQq1qipKcXhwym218k1889xMCvavpdLWNOqWdV8PFhwmopuEl0a/wAfBsmt3trWLOu6UrCtVx0nRg5xaz1yvh0fMlajT2NqVe31hWHFKVC5UswzyjJLPF+ix817CiHldpbXq6ZUlfX8Yq5acadLlL8Nd7z7X7u5v28vVBKAAqAAAAAAAAJ9u/cdxcX1XTrWrKnbUW4VHBtOpLGJJ+5c1jo+vPljyp3a127qHiqnmZwmW3Zpuq3mk3Kr2laUOacoZ/dnjuku/q/9FV0y/p6np1C9pLEascuP8r6Ne/DTRHiobO9VrP6/PIsStsAFZAAAAAAAASLWu3dQ8VU8zOE7ta7d1DxVTzM4TLYVDZ3qtZ/X55EvKhs71Ws/r88ixK2wAVkAAAAAAABKNy2lWz3BeRqrH4lWVWDSeHGTysfrj4pmWet9IFzVepW9q3F0o0VUS4VlSbknzxnoly6ckZeiaPb6lpuqXNadWM7Ojx01BpJvEnzyvyojbGKvtq0q2O3rS3rrhqKLk44aa4m5Yee9Z5kttrmrZ3MLig4xq03mLlFSw/bhrBZhEoACsgAAAAAAAJ56QO3aPhY+aQ2p2FuHwv21B6QO3aPhY+aQ2p2FuHwv21CNY8uWsihaxCgAKyAAAAAAAAnnpA7do+Fj5pDanYW4fC/bUNndG177W9Sp3NtVt4QjRUGqkpJ5Tb7k/aNE2vfabpuqW1arbyneUeCm4Sk0niS55X5kRrE+LWTz9n+rf1Fn/fL/AJKGIUABWQAAAAAAAAAAAAAAAAAAf//Z',
  free:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAB4AFoDASIAAhEBAxEB/8QAGwABAAMAAwEAAAAAAAAAAAAAAAUGBwIDBAH/xAAzEAABAwMCBAMGBQUAAAAAAAABAAIDBAURIUEGEjFRImFxExQVMoGRUqGxweEHIzPR8P/EABkBAQEBAQEBAAAAAAAAAAAAAAABAgMFBP/EAB0RAQEBAAICAwAAAAAAAAAAAAABAgMRITEEEhP/2gAMAwEAAhEDEQA/ANXREUdRERAREQERcZJGRRukke1jGAuc5xwAB1JKDkihJOM+Ho5HRuuLSWkglsb3D6EDB9QpiCeGphbNTysmjd8r43BzTt1CNXGs+45oiIyIiICIiAiIgLO+P75PLXus8T3Mp4Q0yjGPaOI5hruACNO+ewWiLNOP7XPT3t1w5XOp6oNw/GjXAY5fsM7dT2KlfV8WZ/TyqqsfBl8ntt3hoy9zqWrkDHR4zhx0a4dtcZ8u+Aq4pvhG1z3G/wBM+NrhFTSNmlkxkNwcgfUjH3OyzHpcszcX7NaREW3hiIiAiIgIiIC6qqlgrqWSmqYmywyDDmO3/wC7rtRD0qsn9O7M+RzmzVkYcSQxsjcN8hlpP3Vht9upLXSimooGwxAl2ASck7knU/VelEb1yb1OtURERgREQERRt7vdPY6aOadpkMkga1jSObG517D8yBpnKCSRfGPZLG2SNwexwBa5pyCDuCvqAiIgIiICIiAiIg6ayrioKOWrnOI4mlx1GT5DO56BZTd7pLeLjJWSjl5sBjOYkMaOgH6+pKlOLb/8WrPdoNKWmcQCHZEjunNppjt6nvgV5ZtVcOCL6IZPhNS8NY8l0DnOOjjjwdteo6a565V5WLLTeGL+y8UIjmkHvsQ/utxjmGdHAfbPnsNElKnERFpBFC8R8RR2OKIMayaokcD7IuwQzc/sP3wQpSjq4q+jiq4DmOVocNRkeRxuOhQdyIiAqjxrf/d4nWmn/wAkrQZnh3yN/Dpud87HfOkzxDe2WO3+2DRJPIeWJhO/c74Hl3A0zlZa975ZHSSOL3uJLnOOSSdyVLSOKIiwovZa7lNarhFVwOPhPjaDjnbu0+v8rxog2GgroblQxVlOSY5RkcwwRrgg+hBXC6XKG1W+WrncPCPA0nHO7Zo9f5VC4Sv/AMJrPdp9aWpcASXYEbunNrpjv6Dtg+fiW+PvVw8OBTQFzYQB1G7jnXXA02++d9+E6R9fXTXKulrKggySnJ5RgDTAA9AApXhbiD4NWGOoc80c3zgahjvx4/I4/PACgUWVbQx7JY2yRuD2OALXNOQQdwV9VJ4N4jf7RtqrZRyYxTvedQdmf6+3YC7LcvaMju90lvFxkrJRy82AxnMSGNHQD9fUleJEXNRERAREQEREBERAVkh46usMEcXsqaTkaG88jXFzsDqTzalVtFQREUBERAREQEREBERAREQf/9k=',
};

const MAX_BYTES = 10485760; // 서버 photo 함수와 같은 10MB
const SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

type DemoPhoto = { id: string; status: 'pending'; preview: string };
type DemoLiteUser = {
  answers: Record<string, LiteValue>;
  photos: Partial<Record<PhotoSlot, DemoPhoto>>;
  submitted: boolean;
  saveCalls: number;
  uploadCalls: number;
  failedSlots: PhotoSlot[]; // litephotofail: 이미 한 번 실패한 칸
};
export type DemoLiteMemory = { users: Map<string, DemoLiteUser>; seq: number };
export const createDemoLiteMemory = (): DemoLiteMemory => ({ users: new Map(), seq: 0 });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

// 서버 검사식과 같은 모양 규칙(문항표 선택지 칸을 읽는다)
export function demoValueOk(id: string, input: LiteValue): boolean {
  const value: unknown = input;
  const q = LITE_QUESTIONS.find((row) => row.id === id);
  if (!q) return false;
  const options = q.options.split(' / ');
  const decline = options.includes('답하지 않음');
  switch (q.type) {
    case '날짜':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case '지역':
      return isRecord(value) && Object.keys(value).sort().join() === 'sido,sigungu' && SIDO.includes(String(value.sido)) && typeof value.sigungu === 'string' && value.sigungu.length >= 1 && value.sigungu.length <= 30;
    case '숫자': {
      const m = /^(\d+)~(\d+)/.exec(q.options);
      return !!m && isInt(value, Number(m[1]), Number(m[2]));
    }
    case '선택':
    case '구간':
      return (value === null && decline) || (typeof value === 'string' && options.includes(value));
    case '척도':
      return isInt(value, 1, 5);
    case '순위':
      return Array.isArray(value) && value.length === options.length && [...value].sort().join() === [...options].sort().join();
    case '텍스트': {
      const m = /(\d+)~(\d+)자/.exec(q.options);
      return typeof value === 'string' && !!m && [...value].length >= Number(m[1]) && [...value].length <= Number(m[2]);
    }
    case '범위':
      return value === '상관없음' || (isRecord(value) && Object.keys(value).every((k) => (k === 'younger' || k === 'older') && isInt(value[k], 0, 15)));
    case '복수 선택':
      return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every((v) => options.includes(v));
    default:
      return false; // 사진은 photos 로만
  }
}

const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

const shared = createDemoLiteMemory();

// 2단계 통합용(app/확인/F2L_통합목록.md 4장): 모의 서버 get_progress 가 임시 설문 진행을 알게 한다.
// firstMissing = 처음 빈 필수 문항 ID(04 쪽 순서, A01 은 모의 서버가 원본이라 뺀다) · photoSlots = 확인 중 칸 수
export function demoLiteProgress(userId: string, memory: DemoLiteMemory = shared): { firstMissing: string | null; photoSlots: number; submitted: boolean } {
  const user = memory.users.get(userId);
  const answers = user?.answers ?? {};
  const required = LITE_QUESTIONS.filter((q) => q.required === '예' && q.id !== 'A01' && q.id !== 'G01');
  const missing = required.find((q) => !(q.id in answers));
  return { firstMissing: missing ? missing.id : null, photoSlots: user ? PHOTO_SLOTS.filter((slot) => user.photos[slot]).length : 0, submitted: user?.submitted ?? false };
}

export function createSurveyLiteDemoApi(client: SupabaseClient, ai: { start: () => Promise<RunOutcome> }, memory: DemoLiteMemory = shared): SurveyLiteApi {
  async function me(): Promise<{ id: string; email: string; user: DemoLiteUser } | null> {
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user?.id) return null;
    let state = memory.users.get(user.id);
    if (!state) {
      state = { answers: {}, photos: {}, submitted: false, saveCalls: 0, uploadCalls: 0, failedSlots: [] };
      memory.users.set(user.id, state);
    }
    return { id: user.id, email: String(user.email ?? ''), user: state };
  }
  const local = (email: string) => email.split('@')[0];

  // 화면 점검이 볼 수 있는 읽기 전용 창구(데모 모드 웹에서만)
  const host = globalThis as { document?: unknown; __surveyLitePeek?: unknown };
  if (host.document !== undefined && memory === shared) {
    host.__surveyLitePeek = () =>
      [...memory.users.values()].map((u) => ({
        answered: Object.keys(u.answers).sort(),
        answers: u.answers,
        photos: PHOTO_SLOTS.map((slot) => ({ slot, status: u.photos[slot]?.status ?? 'none' })),
        submitted: u.submitted,
        saveCalls: u.saveCalls,
        uploadCalls: u.uploadCalls,
      }));
  }

  return {
    demo: true,

    async load() {
      const who = await me();
      if (!who) return { ok: false, reason: 'server' };
      const { data, error } = await client.from('profiles').select('birth_date').maybeSingle();
      if (error) return { ok: false, reason: 'server' };
      const birth = isRecord(data) && typeof data.birth_date === 'string' ? data.birth_date : null;
      const answers: Record<string, LiteValue> = { ...who.user.answers };
      if (birth) answers.A01 = birth;
      const photos: SlotRow[] = PHOTO_SLOTS.flatMap((slot) => {
        const p = who.user.photos[slot];
        return p ? [{ slot, photoId: p.id, status: p.status }] : [];
      });
      return { ok: true, data: { answers, birthLocked: birth !== null, photos } };
    },

    async saveAnswers(values: LiteAnswers) {
      const who = await me();
      if (!who) return { ok: false, reason: 'server' };
      who.user.saveCalls += 1;
      if (local(who.email).startsWith('litesavefail')) return { ok: false, reason: 'network' };
      const { answers, texts } = splitForServer(values);
      const all: Record<string, LiteValue> = { ...answers, ...texts };
      for (const [id, value] of Object.entries(all)) if (!LITE_IDS.includes(id) || !demoValueOk(id, value)) return { ok: false, reason: 'server' }; // 하나라도 틀리면 아무것도 저장하지 않는다
      if ('A01' in all) {
        const { error } = await client.rpc('save_answers', { p_answers: { A01: all.A01 } }); // 생년월일은 모의 서버가 원본
        if (error) return { ok: false, reason: 'server' };
      }
      for (const [id, value] of Object.entries(all)) if (id !== 'A01') who.user.answers[id] = value;
      return { ok: true };
    },

    async uploadPhoto(slot, file) {
      const who = await me();
      if (!who) return { ok: false, code: 'server' };
      who.user.uploadCalls += 1;
      if (local(who.email).startsWith('litephotofail') && !who.user.failedSlots.includes(slot)) {
        who.user.failedSlots.push(slot);
        return { ok: false, code: 'network' };
      }
      if (file.bytes.length > MAX_BYTES) return { ok: false, code: 'size' };
      if (!isJpeg(file.bytes)) return { ok: false, code: 'format' };
      memory.seq += 1;
      const photo: DemoPhoto = { id: `demo-lite-photo-${memory.seq}`, status: 'pending', preview: `data:image/jpeg;base64,${toBase64(file.bytes)}` };
      who.user.photos[slot] = photo; // 한 칸에 대기 1장: 새로 올리면 이전 대기 사진은 교체된다(서버 photo_register 와 같음)
      return { ok: true, photoId: photo.id, status: 'pending' };
    },

    async photoPreview(photoId) {
      const who = await me();
      if (!who) return null;
      return PHOTO_SLOTS.map((slot) => who.user.photos[slot]).find((p) => p?.id === photoId)?.preview ?? null;
    },

    async submit() {
      const who = await me();
      if (!who) return { ok: false, reason: 'server' };
      who.user.submitted = true;
      return { ok: true };
    },

    startAi: () => ai.start(),
  };
}
