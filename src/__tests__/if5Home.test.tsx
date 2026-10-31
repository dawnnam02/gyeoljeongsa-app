// IF5-F1 ③ 홈 입구 — B6 '사주 마당' 칸 · B7 접힘 줄 · '오늘 하루' 띠 (정책 PS-34 · 화면_요구사항 홈 B6 입구 · 홈 오늘 하루 띠)
//  홈을 열 때 사주 계산 · AI 호출 0(동의 읽기뿐) · 칸 3 이하 · 숫자 · 점 · '새' 0 · 스위치/동의가 꺼지면 칸째 0(권유 0)
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { IF5_TEXT } from '@/content/if5Copy';
import type { BoardingState } from '@/features/boarding/boardingApi';
import { createDeviceNotes } from '@/features/inflight/deviceNotes';
import { parseHomeState, type InflightApi } from '@/features/inflight/inflightApi';
import { InflightHome } from '@/features/inflight/InflightHome';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { foldRows } from '@/features/inflight/inflightLogic';
import { nowIso, todayBaseLine } from '@/features/saju/sajuLogic';

import { allTexts, has, mount, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]), Redirect: () => null };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/features/chat/chatService', () => ({ chatApi: () => ({}), chatMedia: () => ({}), CHAT_LIST_HREF: '/chat', chatRoomHref: (id: string) => `/chat/${id}`, inflightChatApi: () => ({}) }));
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: () => undefined }));

jest.setTimeout(60_000);
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockRouter.push.mockClear();
});

const NOW = Date.parse('2027-03-20T03:00:00Z');
const flags = (over: Record<string, boolean> = {}) => ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over }) as Record<string, boolean>;
const home = (cells: string[]) => parseHomeState({ stage: 'inflight', blocks: ['B6', 'B7'], me: { cells } });
const boarding = { past: [], ticket: null, round: null, phase: 'on_sale' } as unknown as BoardingState;

async function open(opts: { ck17: boolean; over?: Record<string, boolean>; cells?: string[]; ait?: boolean; typeId?: string | null }) {
  const f = flags(opts.over);
  const calls: string[] = [];
  const ck17: Ck17Api = {
    load: async () => (calls.push('ck17'), { ok: true, data: { a: opts.ck17, b: false } }),
    record: async () => ({ ok: true }),
    revoke: async () => ({ ok: true }),
  };
  const api = { home: async () => (calls.push('home'), { ok: true as const, data: home(opts.cells ?? ['preview']) as never }), pairCard: async () => ({ ok: false as const, code: 'x' }), preQuestions: async () => ({ ok: false as const, code: 'x' }) } as unknown as Pick<InflightApi, 'home' | 'pairCard' | 'preQuestions'>;
  const nav = { open: jest.fn(), chat: jest.fn(), settings: jest.fn(), profileSameHobby: jest.fn() };
  const h = home(opts.cells ?? ['preview']);
  if (!h) throw new Error('home');
  const tree = await mount(
    <InflightHome deps={{ api, ck17, type: { mine: async () => opts.typeId ?? null }, isOn: (k) => f[k] === true, notes: createDeviceNotes(), now: () => NOW, ait: opts.ait ?? false }} home={h} boarding={boarding} nav={nav} onToast={() => undefined} />,
  );
  mounted.push(tree);
  await wait(50);
  return { tree, nav, calls };
}

describe('IF5-F1 ③ 홈 B6 입구 · B7 줄 · 오늘 하루 띠', () => {
  test('스위치 + CK17A 켠 분: B6 에 [사주 마당] 칸(이름 + 한 줄 · 내 글자 0 · 숫자 · 점 · 새 0) → /saju', async () => {
    const { tree, nav } = await open({ ck17: true });
    expect(has(tree, 'home-B6-saju')).toBe(true);
    expect(textOf(tree, 'home-B6-saju-name')).toBe(IF5_TEXT['SAJU.entry.name']);
    expect(textOf(tree, 'home-B6-saju-line')).toBe(IF5_TEXT['SAJU.entry.line']);
    await press(tree, 'home-B6-saju');
    expect(nav.open).toHaveBeenCalledWith('/saju');
  });
  test('CK17A 꺼짐 · saju_home 꺼짐 · saju_yard 꺼짐이면 칸 · 띠째 0(권유 0)', async () => {
    for (const t of [{ ck17: false }, { ck17: true, over: { saju_home: false } }, { ck17: true, over: { saju_yard: false } }] as { ck17: boolean; over?: Record<string, boolean> }[]) {
      const { tree } = await open(t);
      expect(has(tree, 'home-B6-saju')).toBe(false);
      expect(has(tree, 'home-today')).toBe(false);
      expect(allTexts(tree)).not.toContain(IF5_TEXT['SAJU.entry.name']);
    }
  });
  test('오늘 하루 띠: B7 바로 위 한 줄 · 오늘 날짜의 바탕만(모든 회원에게 같은 글) → /saju-today · 숫자 · 점 · 새 · 연속 접속 표시 0', async () => {
    const { tree, nav } = await open({ ck17: true });
    expect(has(tree, 'home-today')).toBe(true);
    expect(textOf(tree, 'home-today-line')).toBe(todayBaseLine(nowIso(NOW)));
    await press(tree, 'home-today');
    expect(nav.open).toHaveBeenCalledWith('/saju-today');
    const strip = allTexts(tree).filter((t) => t === IF5_TEXT['SAJU.today.title'] || t === todayBaseLine(nowIso(NOW)));
    expect(strip.join(' ')).not.toMatch(/\d+일째|연속|새/);
  });
  test('saju_today 만 꺼지면 띠 0 · 칸은 그대로', async () => {
    const { tree } = await open({ ck17: true, over: { saju_today: false } });
    expect(has(tree, 'home-today')).toBe(false);
    expect(has(tree, 'home-B6-saju')).toBe(true);
  });
  test('칸 3 이하: 서버 칸 둘 + AI 입구가 이미 셋이면 B6 칸 대신 B7 접힘 줄 [사주 마당]', async () => {
    const { tree, nav } = await open({ ck17: true, cells: ['type', 'preview'], ait: true, typeId: 'tt-01' });
    expect(has(tree, 'home-B6-saju')).toBe(false);
    await press(tree, 'home-B7-toggle');
    expect(has(tree, 'home-B7-row-saju')).toBe(true);
    await press(tree, 'home-B7-row-saju');
    expect(nav.open).toHaveBeenCalledWith('/saju');
  });
  test('접힘 줄: foldRows 는 sajuRow 일 때만 saju 를 더한다(줄 8 이하 그대로)', () => {
    const s = parseHomeState({ stage: 'matched', blocks: ['B7'] }) as never;
    expect(foldRows(s, { hasPastChat: true, memoElsewhere: true, typeOn: true, previewOn: true })).not.toContain('saju');
    const rows = foldRows(s, { hasPastChat: true, memoElsewhere: true, typeOn: true, previewOn: true, sajuRow: true });
    expect(rows).toContain('saju');
    expect(rows.length).toBeLessThanOrEqual(8);
  });
  test('홈을 열 때 서버 호출은 홈 상태 · 동의 읽기뿐 — 사주 계산(get_my_*) · AI 0', async () => {
    const { calls } = await open({ ck17: true });
    expect(calls.sort()).toEqual(['ck17', 'home'].sort().filter((c) => calls.includes(c)));
    expect(calls.every((c) => c === 'ck17' || c === 'home')).toBe(true);
  });
});
