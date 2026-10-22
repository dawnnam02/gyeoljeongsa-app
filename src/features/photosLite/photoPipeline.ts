// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 05 사진: 고른 사진을 올리기 전에 다시 만든다(보안 F-4 · 화면_요구사항 05 · 스키마 9-7).
//  ① 긴 변 1600px 이하로 줄인다(늘리지는 않는다)  ② JPEG 로 다시 인코딩한다(서버는 image/jpeg · 10MB 만 받는다)
//  ③ 다시 만든 JPEG 에서 메타데이터 구획(APP1~APP13 · APP15 · 주석)을 한 번 더 걷어 낸다 — EXIF · 촬영 위치(GPS) · XMP 0
//  ④ 결과를 검사한다: JPEG 표지 · EXIF 없음 · GPS 없음 · 10MB 이하. 하나라도 어긋나면 올리지 않는다
// 그림을 줄이고 인코딩하는 일은 기기 쪽 인코더(photoPicker.ts)가 하고, 여기는 바이트를 다루는 순수 함수만 둔다(시험 가능).
import type { JpegFile } from '@/lib/surveyLiteApi';

export const PHOTO_LONG_EDGE = 1600;
export const PHOTO_MAX_BYTES = 10485760; // 10MB — 서버 photo 함수 MAX_BYTES · 버킷 설정과 같은 값
export const PHOTO_JPEG_QUALITY = 0.85;
export const PHOTO_SIZE_LABEL = '10MB'; // 오류 문구의 {용량}

// 고른 사진(아직 다시 만들기 전)
export type PickedImage = { readonly uri: string; readonly width: number; readonly height: number; readonly bytes: number | null };
// 기기 인코더: 고른 사진을 target 크기 JPEG 로 다시 그려 바이트를 돌려준다. 읽지 못하면 null
export type JpegEncoder = (image: PickedImage, target: { width: number; height: number }, quality: number) => Promise<Uint8Array | null>;

// 긴 변을 max 이하로(비율 유지, 작은 사진은 그대로)
export function fitLongEdge(width: number, height: number, max = PHOTO_LONG_EDGE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const long = Math.max(width, height);
  if (long <= max) return { width: Math.round(width), height: Math.round(height) };
  const k = max / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;
const APP1 = 0xe1;
const APP14 = 0xee; // Adobe 색 변환 표지: 사람에 대한 정보가 아니고, 빼면 색이 틀어질 수 있어 남긴다
const COM = 0xfe;
const isStandalone = (m: number) => m === 0x01 || (m >= 0xd0 && m <= 0xd7); // 길이 없는 표지(TEM · RST)

type Segment = { marker: number; start: number; end: number }; // [start, end): 0xFF 표지부터 구획 끝까지

// SOS 앞까지 구획을 나눈다. 모양이 틀리면 null
function segments(bytes: Uint8Array): { list: Segment[]; sos: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  const list: Segment[] = [];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    let j = i;
    while (j < bytes.length && bytes[j] === 0xff) j += 1; // 채움 0xFF
    if (j >= bytes.length) return null;
    const marker = bytes[j];
    if (marker === SOS) return { list, sos: i };
    if (marker === EOI) return null; // 그림 데이터 없이 끝남
    if (isStandalone(marker)) {
      list.push({ marker, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    if (j + 2 >= bytes.length) return null;
    const length = (bytes[j + 1] << 8) | bytes[j + 2];
    if (length < 2 || j + 1 + length > bytes.length) return null;
    list.push({ marker, start: i, end: j + 1 + length });
    i = j + 1 + length;
  }
  return null;
}

const isMetaSegment = (marker: number) => (marker >= APP1 && marker <= 0xef && marker !== APP14) || marker === COM;

function ascii(bytes: Uint8Array, from: number, length: number): string {
  let out = '';
  for (let i = from; i < Math.min(bytes.length, from + length); i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

// EXIF(APP1 'Exif\0\0') 안 TIFF 의 IFD0 에 GPS 정보 꼬리표(0x8825)가 있는가
function exifHasGps(bytes: Uint8Array, seg: Segment): boolean {
  const tiff = seg.start + 4 + 6; // FF E1 LL LL 'Exif\0\0'
  if (tiff + 8 > seg.end) return false;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49; // 'II'
  const u16 = (p: number) => (little ? bytes[p] | (bytes[p + 1] << 8) : (bytes[p] << 8) | bytes[p + 1]);
  const u32 = (p: number) => (little ? (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16)) + bytes[p + 3] * 0x1000000 : bytes[p] * 0x1000000 + ((bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > seg.end) return false;
  const count = u16(ifd);
  for (let k = 0; k < count; k += 1) {
    const entry = ifd + 2 + k * 12;
    if (entry + 2 > seg.end) return false;
    if (u16(entry) === 0x8825) return true;
  }
  return false;
}

export type JpegInfo = { readonly jpeg: boolean; readonly exif: boolean; readonly gps: boolean; readonly metaSegments: number };

// 서버 finalize 와 같은 쪽을 앱이 먼저 본다: JPEG 표지 · EXIF · 위치정보(EXIF GPS · XMP GPS)
export function inspectJpeg(bytes: Uint8Array): JpegInfo {
  const parsed = segments(bytes);
  if (!parsed) return { jpeg: false, exif: false, gps: false, metaSegments: 0 };
  let exif = false;
  let gps = false;
  let meta = 0;
  for (const seg of parsed.list) {
    if (!isMetaSegment(seg.marker)) continue;
    meta += 1;
    if (seg.marker !== APP1) continue;
    const head = ascii(bytes, seg.start + 4, 30);
    if (head.startsWith('Exif\u0000')) {
      exif = true;
      if (exifHasGps(bytes, seg)) gps = true;
    } else if (/GPS(Latitude|Longitude)/.test(ascii(bytes, seg.start + 4, seg.end - seg.start - 4))) gps = true; // XMP
  }
  return { jpeg: true, exif, gps, metaSegments: meta };
}

// 메타데이터 구획을 걷어 낸 새 바이트(그림 데이터는 그대로). JPEG 가 아니면 null
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  const parsed = segments(bytes);
  if (!parsed) return null;
  const keep = parsed.list.filter((seg) => !isMetaSegment(seg.marker));
  const head = keep.reduce((n, seg) => n + (seg.end - seg.start), 2);
  const out = new Uint8Array(head + (bytes.length - parsed.sos));
  out[0] = 0xff;
  out[1] = SOI;
  let at = 2;
  for (const seg of keep) {
    out.set(bytes.subarray(seg.start, seg.end), at);
    at += seg.end - seg.start;
  }
  out.set(bytes.subarray(parsed.sos), at);
  return out;
}

export type PrepareOutcome = { ok: true; file: JpegFile } | { ok: false; code: 'format' | 'size' };

// 고른 사진 → 올릴 JPEG. ① 크기 계산 ② 인코딩 ③ 메타 걷기 ④ 검사
export async function preparePhoto(image: PickedImage, encode: JpegEncoder): Promise<PrepareOutcome> {
  if (image.bytes !== null && image.bytes > PHOTO_MAX_BYTES) return { ok: false, code: 'size' }; // 고른 파일부터 10MB 를 넘으면 받지 않는다(가안 10MB 이하)
  const target = fitLongEdge(image.width, image.height);
  if (target.width === 0) return { ok: false, code: 'format' };
  const encoded = await encode(image, target, PHOTO_JPEG_QUALITY);
  if (!encoded) return { ok: false, code: 'format' };
  const clean = stripJpegMetadata(encoded);
  if (!clean) return { ok: false, code: 'format' };
  const info = inspectJpeg(clean);
  if (!info.jpeg || info.exif || info.gps || info.metaSegments > 0) return { ok: false, code: 'format' };
  if (clean.length > PHOTO_MAX_BYTES) return { ok: false, code: 'size' };
  return { ok: true, file: { bytes: clean, width: target.width, height: target.height } };
}

// ── base64 (미리보기 data URI · 데모 예시 그림) ─────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let at = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0) << 6) | (i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0);
    if (at < out.length) out[at++] = (n >> 16) & 255;
    if (i + 2 < clean.length && at < out.length) out[at++] = (n >> 8) & 255;
    if (i + 3 < clean.length && at < out.length) out[at++] = n & 255;
  }
  return out;
}

// 다시 만든 JPEG 의 미리보기(메모리에만 있다. 기기 · 브라우저 저장소에 쓰지 않는다)
export const jpegDataUri = (bytes: Uint8Array) => `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
