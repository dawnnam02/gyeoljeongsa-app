// 채팅 첨부(사진 · 음성) — 기기 쪽. 화면은 이 모양(ChatMedia)만 알고, 시험은 가짜를 넣는다.
//  · 사진: 05 사진과 같은 고르기 · 다시 그리기(features/photosLite: 웹 <input type=file> → canvas JPEG · EXIF · GPS 없음 · 긴 변 1600 · 10MB)
//  · 음성: 웹 = MediaRecorder(녹음) · <audio>(재생). 녹음은 최대 1분(VOICE_MAX_MS), 1초보다 짧으면 보내지 않음
//  · iOS · Android: chatMediaNative.ts(expo-image-picker · expo-audio — D-159 설치 승인)
//  · 데모 모드: 고르지 않고 데모 '나' 사진(p01 free)을 보내고, 녹음은 길이만 잰다(마이크 · 소리 0). 재생은 길이만큼 시간이 흐르는 흉내
//  · 녹음 · 사진 원본은 메모리에만 있다(기기 · 브라우저 저장소 0, 로그 0)
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { mePhotoKey } from '@/demo/people';
import { demoPhotoUri } from '@/demo/peoplePhotos';
import { defaultPicker, type PhotoPicker } from '@/features/photosLite/photoPicker';
import { preparePhoto } from '@/features/photosLite/photoPipeline';

import { VOICE_MAX_MS } from './chatLogic';
import { createNativeMedia } from './chatMediaNative';

export type PickedPhoto = { ok: true; bytes: Uint8Array; uri: string; demoKey?: string } | { ok: false; reason: 'cancel' | 'format' | 'size' | 'unavailable' };
export type Recording = { bytes: Uint8Array; contentType: string; durationMs: number; uri: string };
export type RecordStart = 'ok' | 'denied' | 'unavailable';

export type ChatMedia = {
  readonly photo: boolean; // 사진을 보낼 수 있나
  readonly voice: boolean; // 녹음할 수 있나
  pickPhoto(): Promise<PickedPhoto>;
  startRecording(): Promise<RecordStart>;
  stopRecording(): Promise<Recording | null>; // null = 녹음 없음
  cancelRecording(): void;
  // 재생: 하나만(다른 것을 틀면 앞의 것은 멈춤). onTick(지난 ms) · onEnd. 못 틀면 false
  play(key: string, uri: string | null, durationMs: number, onTick: (ms: number) => void, onEnd: () => void): Promise<boolean>;
  stop(key?: string): void;
};

// 지금 재생 중인 것 하나
type Playing = { key: string; stop: () => void };

function makePlayerSlot() {
  let current: Playing | null = null;
  return {
    take(next: Playing) {
      if (current && current.key !== next.key) current.stop();
      current = next;
    },
    stop(key?: string) {
      if (!current || (key && current.key !== key)) return;
      const c = current;
      current = null;
      c.stop();
    },
    clear(key: string) {
      if (current?.key === key) current = null;
    },
  };
}

// 길이만큼 시간이 흐르는 재생 흉내(데모 · 시험)
function fakePlay(slot: ReturnType<typeof makePlayerSlot>, key: string, durationMs: number, onTick: (ms: number) => void, onEnd: () => void, now: () => number = Date.now) {
  const started = now();
  const timer = setInterval(() => {
    const ms = Math.min(durationMs, now() - started);
    onTick(ms);
    if (ms >= durationMs) {
      clearInterval(timer);
      slot.clear(key);
      onEnd();
    }
  }, 250);
  slot.take({ key, stop: () => clearInterval(timer) });
}

export function createDemoMedia(options: { email: () => string; now?: () => number } = { email: () => '' }): ChatMedia {
  const now = options.now ?? Date.now;
  const slot = makePlayerSlot();
  let recStart: number | null = null;
  return {
    photo: true,
    voice: true,
    async pickPhoto() {
      const key = mePhotoKey('free', options.email()) ?? 'p01_free';
      return { ok: true, bytes: new Uint8Array(0), uri: demoPhotoUri(key) ?? '', demoKey: key };
    },
    async startRecording() {
      recStart = now();
      return 'ok';
    },
    async stopRecording() {
      if (recStart === null) return null;
      const durationMs = Math.min(VOICE_MAX_MS, now() - recStart);
      recStart = null;
      return { bytes: new Uint8Array(0), contentType: 'audio/webm', durationMs, uri: '' };
    },
    cancelRecording() {
      recStart = null;
    },
    async play(key, _uri, durationMs, onTick, onEnd) {
      fakePlay(slot, key, durationMs, onTick, onEnd, now);
      return true;
    },
    stop: (key) => slot.stop(key),
  };
}

type WebAudioHost = {
  navigator?: { mediaDevices?: { getUserMedia?: (c: { audio: boolean }) => Promise<MediaStream> } };
  MediaRecorder?: typeof MediaRecorder;
  Audio?: typeof Audio;
};

export function createWebMedia(picker: PhotoPicker = defaultPicker(), host: WebAudioHost = globalThis as WebAudioHost): ChatMedia {
  const slot = makePlayerSlot();
  const canRecord = typeof host.MediaRecorder === 'function' && typeof host.navigator?.mediaDevices?.getUserMedia === 'function';
  let rec: { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; startedAt: number } | null = null;
  const release = () => {
    rec?.stream.getTracks().forEach((t) => t.stop());
    rec = null;
  };
  return {
    photo: picker.available,
    voice: canRecord,
    async pickPhoto() {
      if (!picker.available) return { ok: false, reason: 'unavailable' };
      const image = await picker.pick();
      if (!image) return { ok: false, reason: 'cancel' };
      const prepared = await preparePhoto(image, picker.encode);
      if (!prepared.ok) return { ok: false, reason: prepared.code };
      const bytes = prepared.file.bytes;
      const blobUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
      return { ok: true, bytes, uri: blobUrl };
    },
    async startRecording() {
      if (!canRecord || !host.MediaRecorder || !host.navigator?.mediaDevices?.getUserMedia) return 'unavailable';
      try {
        const stream = await host.navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new host.MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.start();
        rec = { recorder, stream, chunks, startedAt: Date.now() };
        return 'ok';
      } catch {
        release();
        return 'denied';
      }
    },
    stopRecording() {
      const r = rec;
      if (!r) return Promise.resolve(null);
      return new Promise<Recording | null>((resolve) => {
        r.recorder.onstop = async () => {
          const type = r.recorder.mimeType || 'audio/webm';
          const blob = new Blob(r.chunks, { type });
          const durationMs = Math.min(VOICE_MAX_MS, Date.now() - r.startedAt);
          release();
          resolve({ bytes: new Uint8Array(await blob.arrayBuffer()), contentType: type, durationMs, uri: URL.createObjectURL(blob) });
        };
        r.recorder.stop();
      });
    },
    cancelRecording() {
      if (rec && rec.recorder.state !== 'inactive') {
        rec.recorder.onstop = null;
        rec.recorder.stop();
      }
      release();
    },
    async play(key, uri, durationMs, onTick, onEnd) {
      if (!uri || typeof host.Audio !== 'function') return false;
      const audio = new host.Audio(uri);
      const tick = () => onTick(Math.min(durationMs, Math.round(audio.currentTime * 1000)));
      audio.addEventListener('timeupdate', tick);
      audio.addEventListener('ended', () => {
        slot.clear(key);
        onEnd();
      });
      try {
        await audio.play();
      } catch {
        return false;
      }
      slot.take({ key, stop: () => audio.pause() });
      return true;
    },
    stop: (key) => slot.stop(key),
  };
}

export const unavailableMedia: ChatMedia = {
  photo: false,
  voice: false,
  pickPhoto: async () => ({ ok: false, reason: 'unavailable' }),
  startRecording: async () => 'unavailable',
  stopRecording: async () => null,
  cancelRecording: () => undefined,
  play: async () => false,
  stop: () => undefined,
};

// 앱이 쓰는 것: 데모 → 흉내 · 웹 → 브라우저 · iOS · Android → expo-image-picker · expo-audio
export function defaultChatMedia(email: () => string): ChatMedia {
  if (env.demoMode) return createDemoMedia({ email });
  if (Platform.OS === 'web' && typeof document !== 'undefined') return createWebMedia();
  return createNativeMedia();
}
