// 채팅 첨부 — iOS · Android(D-159 패키지 승인: expo-audio · expo-image-picker, Expo 57 고정표 버전). 웹 · 데모는 chatMedia.ts.
//  · 사진: 사진 보관함에서 한 장(편집 0) → JPEG 품질 0.85 · 메타(EXIF · GPS) 걷기 · 10MB 검사. 서버도 GPS 사진은 받지 않는다(has_gps)
//  · 음성: m4a(AAC) · 모노 · 64kbps — 60초 ≈ 0.5MB(서버 한도 60초 · 3MB 안). 녹음 권한은 마이크 단추를 처음 누를 때 묻는다
//  · 재생: createAudioPlayer 하나씩(다른 것을 틀면 앞의 것은 멈추고 지움)
//  · 패키지는 처음 쓸 때 불러온다(시험 · 웹 번들이 기기 모듈을 읽지 않게)
//  · 녹음 파일 · 고른 사진은 앱 임시 칸에만 있고 보내고 나면 쓰지 않는다. 로그 0
/* eslint-disable @typescript-eslint/no-require-imports */
import { inspectJpeg, PHOTO_MAX_BYTES, stripJpegMetadata } from '@/features/photosLite/photoPipeline';

import { VOICE_MAX_MS } from './chatLogic';
import type { ChatMedia, PickedPhoto, Recording, RecordStart } from './chatMedia';

type ExpoAudio = typeof import('expo-audio');
type Picker = typeof import('expo-image-picker');
type Recorder = InstanceType<ExpoAudio['AudioModule']['AudioRecorder']>;
type Player = ReturnType<ExpoAudio['createAudioPlayer']>;

const readBytes = async (uri: string): Promise<Uint8Array> => new Uint8Array(await (await fetch(uri)).arrayBuffer());

export function createNativeMedia(): ChatMedia {
  const audio = () => require('expo-audio') as ExpoAudio;
  const picker = () => require('expo-image-picker') as Picker;
  let rec: { recorder: Recorder; startedAt: number } | null = null;
  let playing: { key: string; player: Player } | null = null;

  const stopPlaying = (key?: string) => {
    if (!playing || (key && playing.key !== key)) return;
    const p = playing;
    playing = null;
    try {
      p.player.pause();
      p.player.remove();
    } catch {
      /* 이미 지움 */
    }
  };

  return {
    photo: true,
    voice: true,
    async pickPhoto(): Promise<PickedPhoto> {
      try {
        const ip = picker();
        const perm = await ip.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return { ok: false, reason: 'unavailable' };
        const r = await ip.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, exif: false, allowsEditing: false });
        if (r.canceled || !r.assets?.[0]) return { ok: false, reason: 'cancel' };
        const a = r.assets[0];
        if (a.fileSize && a.fileSize > PHOTO_MAX_BYTES) return { ok: false, reason: 'size' };
        const clean = stripJpegMetadata(await readBytes(a.uri));
        if (!clean) return { ok: false, reason: 'format' };
        const info = inspectJpeg(clean);
        if (!info.jpeg || info.exif || info.gps) return { ok: false, reason: 'format' };
        if (clean.length > PHOTO_MAX_BYTES) return { ok: false, reason: 'size' };
        return { ok: true, bytes: clean, uri: a.uri };
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    },
    async startRecording(): Promise<RecordStart> {
      try {
        const ea = audio();
        const perm = await ea.requestRecordingPermissionsAsync();
        if (!perm.granted) return 'denied';
        await ea.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        const { createRecordingOptions } = require('expo-audio/build/utils/options') as typeof import('expo-audio/build/utils/options');
        const options = createRecordingOptions({ ...ea.RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64_000 });
        const recorder = new ea.AudioModule.AudioRecorder(options) as Recorder;
        await recorder.prepareToRecordAsync();
        recorder.record({ forDuration: VOICE_MAX_MS / 1000 });
        rec = { recorder, startedAt: Date.now() };
        return 'ok';
      } catch {
        rec = null;
        return 'unavailable';
      }
    },
    async stopRecording(): Promise<Recording | null> {
      const r = rec;
      rec = null;
      if (!r) return null;
      try {
        await r.recorder.stop();
        await audio().setAudioModeAsync({ allowsRecording: false });
        const uri = r.recorder.uri;
        if (!uri) return null;
        return { bytes: await readBytes(uri), contentType: 'audio/mp4', durationMs: Math.min(VOICE_MAX_MS, Date.now() - r.startedAt), uri };
      } catch {
        return null;
      }
    },
    cancelRecording() {
      const r = rec;
      rec = null;
      if (r) void r.recorder.stop().catch(() => undefined);
    },
    async play(key, uri, durationMs, onTick, onEnd) {
      if (!uri) return false;
      stopPlaying();
      try {
        const ea = audio();
        await ea.setAudioModeAsync({ playsInSilentMode: true });
        const player = ea.createAudioPlayer(uri);
        playing = { key, player };
        player.addListener('playbackStatusUpdate', (s) => {
          onTick(Math.min(durationMs, Math.round((s.currentTime ?? 0) * 1000)));
          if (s.didJustFinish) {
            stopPlaying(key);
            onEnd();
          }
        });
        player.play();
        return true;
      } catch {
        stopPlaying(key);
        return false;
      }
    },
    stop: (key) => stopPlaying(key),
  };
}
