// W5 채팅 첨부 — iOS · Android(D-159: expo-audio · expo-image-picker). 기기 모듈은 대역으로 바꿔 흐름만 본다.
import { createNativeMedia } from '@/features/chat/chatMediaNative';

const mockPerm = { granted: true };
const mockPick = jest.fn();
const mockRecorder = { prepareToRecordAsync: jest.fn(async () => undefined), record: jest.fn(), stop: jest.fn(async () => undefined), uri: 'file:///rec.m4a' as string | null };
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: async () => mockPerm,
  launchImageLibraryAsync: (...a: unknown[]) => mockPick(...a),
}));
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: async () => mockPerm,
  setAudioModeAsync: async () => undefined,
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a', sampleRate: 44100, numberOfChannels: 2, bitRate: 128000, android: {}, ios: {}, web: {} } },
  AudioModule: { AudioRecorder: jest.fn(() => mockRecorder) },
  createAudioPlayer: jest.fn(() => ({ addListener: jest.fn(), play: jest.fn(), pause: jest.fn(), remove: jest.fn() })),
}));
jest.mock('expo-audio/build/utils/options', () => ({ createRecordingOptions: (o: unknown) => o }));

// 메타 없는 아주 작은 JPEG(SOI · SOS · EOI)
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x00, 0xff, 0xd9]);

beforeEach(() => {
  mockPerm.granted = true;
  mockPick.mockReset();
  global.fetch = jest.fn(async () => ({ arrayBuffer: async () => JPEG.buffer.slice(0) })) as unknown as typeof fetch;
});

describe('W5 앱(iOS · Android) 사진 · 음성', () => {
  test('사진 · 음성 단추를 켠다(패키지 설치 뒤)', () => {
    const m = createNativeMedia();
    expect(m.photo).toBe(true);
    expect(m.voice).toBe(true);
  });
  test('사진: 보관함에서 한 장 · EXIF 끔 · 품질 0.85 → 메타 걷은 JPEG', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg', fileSize: 1000 }] });
    const r = await createNativeMedia().pickPhoto();
    expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], exif: false, quality: 0.85 }));
    expect(r.ok).toBe(true);
  });
  test('사진: 닫으면 cancel · 10MB 넘으면 size · 권한 없으면 unavailable', async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    expect(await createNativeMedia().pickPhoto()).toEqual({ ok: false, reason: 'cancel' });
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg', fileSize: 11 * 1024 * 1024 }] });
    expect(await createNativeMedia().pickPhoto()).toEqual({ ok: false, reason: 'size' });
    mockPerm.granted = false;
    expect(await createNativeMedia().pickPhoto()).toEqual({ ok: false, reason: 'unavailable' });
  });
  test('음성: 모노 64kbps m4a 로 최대 60초 녹음 → audio/mp4 · 마이크 권한 없으면 denied', async () => {
    const m = createNativeMedia();
    expect(await m.startRecording()).toBe('ok');
    expect(mockRecorder.record).toHaveBeenCalledWith({ forDuration: 60 });
    const rec = await m.stopRecording();
    expect(rec).toMatchObject({ contentType: 'audio/mp4', uri: 'file:///rec.m4a' });
    mockPerm.granted = false;
    expect(await createNativeMedia().startRecording()).toBe('denied');
  });
});
