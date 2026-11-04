// 사주 '오늘 하루' 아침 알림(QF2 Q2-04 · 기획 QF2-04 방식 A · D-240 F 본인 승인 · 법무 L4 기본값 진행) — 기기 안 예약 알림.
//  · 서버 푸시가 아니다: 토큰 등록 0 · 푸시 업체와 무관 · 서버 호출 0 · 분석 0 · 로그 0. 켠 여부 · 시각만 이 기기에 둔다(저장소 열쇠 이름에 사주 · 생일 낱말 0 — check_sec2)
//  · 기본 꺼짐 · 직접 켠 사람만 · 하루 1건(반복 예약 1개 — 켤 때 이전 예약을 먼저 지우고 이 알림 표시가 붙은 예약이 둘 이상이면 다 지운다)
//  · 켜기 전에는 어디서도 알림 권한을 묻지 않는다: 화면이 안내 시트를 먼저 보이고 [알림 받기]를 눌렀을 때만 enable()이 시스템 권한 창을 띄운다. 거부하면 켜지 않고 'denied' 로 돌려준다
//  · 시각 선택지는 오전 8 · 9 · 10 · 11시뿐(8시 이전 0 — 야간 제한 안). 글은 고정 한 줄(사주 값 · 이름 · 숫자 · 연속 · 놓치지 0)
//  · 끄기 · 로그아웃 · 탈퇴 · CK17A 철회 · 스위치 saju_morning 꺼짐이면 예약을 바로 취소한다
//  · expo-notifications 는 부를 때 불러 시험 환경에 네이티브 모듈이 없어도 이 파일을 읽을 수 있다. 사주 화면 폴더(features/saju)는 알림 코드를 가지지 않고 이 파일의 함수만 부른다(IFF5-21 · 30 정적 점검)
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export const MORNING_HOURS = [8, 9, 10, 11] as const;
export type MorningHour = (typeof MORNING_HOURS)[number];
export const MORNING_FLAG = 'saju_morning';
export const MORNING_KIND = 'am_daily'; // 예약 알림 data.kind — 하루 1건 점검에 쓰는 표시
export const MORNING_KEY = 'am.v1'; // 저장소 열쇠(사주 · 생일 · 마일리지 낱말 0)

export type MorningRecord = { on: boolean; hour: MorningHour; id: string | null };
export const MORNING_OFF: MorningRecord = { on: false, hour: 9, id: null };

export type MorningPermission = 'granted' | 'denied' | 'undetermined';
export type MorningDevice = {
  supported: boolean; // 웹 · 알림이 없는 기기는 false → 줄 자체를 그리지 않는다
  permission: () => Promise<MorningPermission>; // 지금 권한(묻지 않음)
  request: () => Promise<MorningPermission>; // 시스템 권한 창
  scheduleDaily: (hour: MorningHour) => Promise<string>; // 매일 hour:00 에 고정 글 1건 — 예약 id
  cancel: (id: string) => Promise<void>;
  cancelAllMorning: () => Promise<void>; // 이 알림 표시(MORNING_KIND)가 붙은 예약을 모두 취소
};
export type MorningStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
export const memoryMorningStorage = (): MorningStorage => {
  const m = new Map<string, string>();
  return { getItem: async (k) => m.get(k) ?? null, setItem: async (k, v) => void m.set(k, v), removeItem: async (k) => void m.delete(k) };
};

export const isMorningHour = (h: unknown): h is MorningHour => typeof h === 'number' && (MORNING_HOURS as readonly number[]).includes(h);

function parse(raw: string | null): MorningRecord {
  if (!raw) return MORNING_OFF;
  try {
    const v = JSON.parse(raw) as Partial<MorningRecord>;
    return { on: v.on === true, hour: isMorningHour(v.hour) ? v.hour : 9, id: typeof v.id === 'string' ? v.id : null };
  } catch {
    return MORNING_OFF;
  }
}

export type EnableOutcome = 'on' | 'denied' | 'failed' | 'unsupported';
export type MorningStore = {
  get: () => MorningRecord;
  ready: () => boolean;
  subscribe: (l: () => void) => () => void;
  supported: () => boolean;
  load: () => Promise<void>;
  enable: (hour: MorningHour) => Promise<EnableOutcome>; // 권한 창 → 허락이면 예약 + 기록
  setHour: (hour: MorningHour) => Promise<'on' | 'failed'>; // 켜 둔 상태에서 시각만 바꿈(예약 다시)
  disable: () => Promise<void>; // 예약 취소 + 기록 지움
  cancelAll: () => Promise<void>; // disable 과 같다(로그아웃 · 탈퇴 · 철회 · 스위치 꺼짐에서 부르는 이름)
};

export function createMorning(device: MorningDevice, storage: MorningStorage): MorningStore {
  let state: MorningRecord = MORNING_OFF;
  let loaded = false;
  const listeners = new Set<() => void>();
  const set = (next: MorningRecord) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const save = async (next: MorningRecord) => {
    if (next.on) await storage.setItem(MORNING_KEY, JSON.stringify(next));
    else await storage.removeItem(MORNING_KEY);
    set(next);
  };
  // 예약 1개만 남긴다: 이전 id 취소 + 이 알림 표시가 붙은 예약 전부 취소 뒤 새로 1개
  const reschedule = async (hour: MorningHour, oldId: string | null): Promise<string> => {
    if (oldId) await device.cancel(oldId).catch(() => undefined);
    await device.cancelAllMorning().catch(() => undefined);
    return device.scheduleDaily(hour);
  };
  const disable = async () => {
    const id = state.id;
    if (device.supported) {
      try {
        if (id) await device.cancel(id);
      } catch {
        // 취소 실패는 아래 전부 취소가 다시 시도한다
      }
      try {
        await device.cancelAllMorning();
      } catch {
        // 기기에 예약이 없거나 모듈이 없는 환경
      }
    }
    try {
      await save(MORNING_OFF);
    } catch {
      set(MORNING_OFF);
    }
  };
  return {
    get: () => state,
    ready: () => loaded,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    supported: () => device.supported,
    async load() {
      if (loaded) return;
      try {
        state = parse(await storage.getItem(MORNING_KEY));
      } catch {
        state = MORNING_OFF;
      }
      loaded = true;
      listeners.forEach((l) => l());
    },
    async enable(hour) {
      if (!device.supported) return 'unsupported';
      if (!isMorningHour(hour)) return 'failed';
      try {
        let p = await device.permission();
        if (p === 'undetermined') p = await device.request(); // 켜는 이 순간 처음 묻는다(그 전에는 어디서도 안 묻는다)
        if (p !== 'granted') return 'denied';
        const id = await reschedule(hour, state.id);
        await save({ on: true, hour, id });
        return 'on';
      } catch {
        return 'failed';
      }
    },
    async setHour(hour) {
      if (!state.on || !isMorningHour(hour)) return 'failed';
      try {
        const id = await reschedule(hour, state.id);
        await save({ on: true, hour, id });
        return 'on';
      } catch {
        return 'failed';
      }
    },
    disable,
    cancelAll: disable,
  };
}

// ── 실제 기기(expo-notifications) ─────────────────────────────────────────────
type NotificationsModule = typeof import('expo-notifications');
function notifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}
const permissionOf = (p: { granted?: boolean; status?: string; canAskAgain?: boolean } | null | undefined): MorningPermission => {
  if (!p) return 'undetermined';
  if (p.granted || p.status === 'granted') return 'granted';
  if (p.status === 'denied' || p.canAskAgain === false) return 'denied';
  return 'undetermined';
};

export function deviceMorning(text: { title: string; body: string }, platform: string = Platform.OS): MorningDevice {
  const supported = platform === 'ios' || platform === 'android';
  const need = (): NotificationsModule => {
    const n = notifications();
    if (!n) throw new Error('notifications_unavailable');
    return n;
  };
  return {
    supported,
    permission: async () => permissionOf(await need().getPermissionsAsync()),
    request: async () => permissionOf(await need().requestPermissionsAsync()),
    scheduleDaily: async (hour) => {
      const N = need();
      return N.scheduleNotificationAsync({
        content: { title: text.title, body: text.body, sound: false, data: { kind: MORNING_KIND } }, // 숫자 배지 0 · 소리 0 · 사주 값 0
        trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
      });
    },
    cancel: async (id) => need().cancelScheduledNotificationAsync(id),
    cancelAllMorning: async () => {
      const N = need();
      const all = await N.getAllScheduledNotificationsAsync();
      for (const n of all) if ((n.content.data as { kind?: string } | undefined)?.kind === MORNING_KIND) await N.cancelScheduledNotificationAsync(n.identifier);
    },
  };
}

// ── 앱 한 곳 ──────────────────────────────────────────────────────────────────
let app: MorningStore | null = null;
export function morning(): MorningStore {
  if (!app) {
    // 글은 카피 24-17-1(SAJU.morning.push.*) — 부를 때 불러 이 파일이 글 사본을 늘 가져오지 않게 한다
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { IF5_TEXT } = require('@/content/if5Copy') as typeof import('@/content/if5Copy');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { if5Storage } = require('@/lib/secureStorage') as typeof import('@/lib/secureStorage');
    app = createMorning(deviceMorning({ title: IF5_TEXT['SAJU.morning.push.title'], body: IF5_TEXT['SAJU.morning.push.body'] }), if5Storage);
  }
  return app;
}
export function setMorningForTest(store: MorningStore | null): void {
  app = store;
}

/** 로그아웃 · 탈퇴 · CK17A 철회 · 스위치 꺼짐: 예약을 취소하고 기록을 지운다. 웹 · 모듈 없음 · 저장소 실패에도 던지지 않는다 */
export async function forgetMorning(): Promise<void> {
  try {
    await morning().cancelAll();
  } catch {
    // 알림 모듈 · 저장소를 못 쓰는 환경(시험 · 웹)
  }
}

export function useMorning(store?: MorningStore): MorningRecord {
  const s = store ?? morning();
  useEffect(() => {
    void s.load();
  }, [s]);
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}
