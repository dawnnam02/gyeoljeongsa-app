// 3부-사 ③(D-219 · 보안 check_sec2 P7-f · SF-05): 만남 장면을 본 방 기록(chat.meetScene.v1)은 AsyncStorage 가 아니라
//  민감한 값 저장소(lib/secureStorage appStateStorage — 네이티브 SecureStore 조각 저장 · 이 기기 전용, 웹은 메모리)에 둔다
import fs from 'node:fs';
import path from 'node:path';

import { chunkedStorage, type Store } from '@/lib/chunkedStorage';
import { createMeetSeen, MEET_SEEN_KEY, meetMemoryOf } from '@/features/chat/meetSeen';

const SRC = path.join(__dirname, '..');
const code = (file: string) =>
  fs
    .readFileSync(path.join(SRC, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

function fakeSecure() {
  const map = new Map<string, string>();
  const store: Store = { get: async (k) => map.get(k) ?? null, set: async (k, v) => void map.set(k, v), del: async (k) => void map.delete(k) };
  return { map, storage: chunkedStorage(store) };
}

describe('③ meetSeen 보관 = appStateStorage(SecureStore 조각 저장)', () => {
  test('코드: AsyncStorage 0 · appStateStorage 를 쓴다(보안 P7-f 허용 표식 3곳 그대로)', () => {
    const src = code('features/chat/meetSeen.ts');
    expect(src).not.toMatch(/AsyncStorage|async-storage/);
    expect(src).toMatch(/appStateStorage/);
  });

  test('기록 · 다시 읽기 · 지우기: 조각 저장소 열쇠 chat.meetScene.v1 · 최근 20방 · 모양이 틀린 값은 버린다', async () => {
    const { map, storage } = fakeSecure();
    const a = createMeetSeen(meetMemoryOf(storage));
    await a.load();
    a.mark('room-1');
    a.mark('room-2');
    await new Promise((r) => setTimeout(r, 0));
    expect(map.get(`${MEET_SEEN_KEY}.n`)).toBe('1');
    expect(JSON.parse(map.get(`${MEET_SEEN_KEY}.0`) ?? '[]')).toEqual(['room-1', 'room-2']);
    const b = createMeetSeen(meetMemoryOf(storage)); // 앱을 다시 켬
    await b.load();
    expect([b.has('room-1'), b.has('room-3')]).toEqual([true, false]);
    b.clear(); // 로그아웃 · 탈퇴
    await new Promise((r) => setTimeout(r, 0));
    expect(map.size).toBe(0);
    await storage.setItem(MEET_SEEN_KEY, JSON.stringify(['ok', 3, '', 'x'.repeat(81)]));
    const c = createMeetSeen(meetMemoryOf(storage));
    await c.load();
    expect(c.get().ids).toEqual(['ok']);
    for (let i = 0; i < 25; i += 1) c.mark(`r${i}`);
    expect(c.get().ids).toHaveLength(20);
  });
});
