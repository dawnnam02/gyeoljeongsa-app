// v4 기능 켜기 스위치(K12 1-2 C1 · backend/S12_변경기록.md 4-1 · K19 2-5). 앱이 읽는 것은 get_feature_flags() 하나다.
//  응답: { flags: { 키: boolean }, modes: { 키: 'live' | 'demo' } } · 정지 · 탈퇴 계정은 응답 전체가 null
//  · 키 목록은 한 파일(src/config/featureKeys.json, 87개 = K12 9 · K15 3 · K19 2-5 새 키 75, F22 · D-122). 목록 밖 키는 버린다
//  · 서버가 키를 모르거나(아직 등록 전) · 값이 boolean 이 아니거나 · 스위치를 못 읽으면 그 키의 live 값을 쓴다:
//    구현된 기능(E 묶음 7개)은 켜짐(지금 동작 유지), 새 기능은 꺼짐(닫힌 쪽으로 실패, K12 C1). prelaunch · review_required 는 켜짐이 닫힌 쪽(K20 1-3 · D-126). 서버가 false 를 주면 false
//  · null 응답(정지 · 탈퇴, 쓸 수 없는 계정)은 전부 꺼짐
//  · 모드를 모르면 'live' 로 본다(데모 라벨은 테스트 웹에서 'demo' 일 때만)
//  · 스위치가 꺼진 기능의 화면은 그리지 않는다. safe_share 는 서버 함수가 없고 이 스위치만 읽는다
//  · 화면은 hooks/useFeatureFlags 로 읽는다(한 번 불러 나눠 쓴다). 로그에는 이벤트 이름과 코드만
import type { SupabaseClient } from '@supabase/supabase-js';

import { FEATURE_KEY_LIST, FEATURE_KEYS, liveDefault, type FeatureKey } from '@/config/featureKeys';

import { safeLog } from './log';
import { readDbFailure } from './serverError';

export { FEATURE_KEYS, type FeatureKey };
export type FeatureMode = 'live' | 'demo';
export type FeatureFlags = {
  loaded: boolean; // 서버가 답했나(못 읽었으면 false — 그때는 키마다 live 값)
  on: Readonly<Record<FeatureKey, boolean>>;
  mode: Readonly<Record<FeatureKey, FeatureMode>>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const each = <T,>(pick: (key: FeatureKey) => T): Record<FeatureKey, T> => Object.fromEntries(FEATURE_KEY_LIST.map((k) => [k.key, pick(k.key)])) as Record<FeatureKey, T>;

// 스위치를 못 읽었을 때: 키마다 live 값(구현된 기능만 켜짐)
export const FLAGS_FALLBACK: FeatureFlags = { loaded: false, on: each(liveDefault), mode: each(() => 'live') };
// 쓸 수 없는 계정(null 응답): 전부 꺼짐
export const FLAGS_ALL_OFF: FeatureFlags = { loaded: true, on: each(() => false), mode: each(() => 'live') };

export function parseFlags(raw: unknown): FeatureFlags {
  if (!isRecord(raw)) return FLAGS_ALL_OFF;
  const flags = isRecord(raw.flags) ? raw.flags : {};
  const modes = isRecord(raw.modes) ? raw.modes : {};
  return {
    loaded: true,
    on: each((k) => (typeof flags[k] === 'boolean' ? (flags[k] as boolean) : liveDefault(k))),
    mode: each((k) => (modes[k] === 'demo' ? 'demo' : 'live')),
  };
}

// 목록 밖 키는 늘 꺼짐
export const isOn = (flags: FeatureFlags, key: FeatureKey): boolean => flags.on[key] === true;

export function createFeatureFlagsApi(client: SupabaseClient) {
  return {
    // 못 읽으면 FLAGS_FALLBACK(loaded=false). 화면은 꺼진 기능을 그리지 않을 뿐 오류 글을 보이지 않는다
    async load(): Promise<FeatureFlags> {
      try {
        const { data, error } = await client.rpc('get_feature_flags');
        if (error) {
          const f = readDbFailure(error);
          safeLog({ event: 'flags.load.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
          return FLAGS_FALLBACK;
        }
        return parseFlags(data);
      } catch {
        safeLog({ event: 'flags.load.fail', code: 'client' });
        return FLAGS_FALLBACK;
      }
    },
  };
}

export type FeatureFlagsApi = ReturnType<typeof createFeatureFlagsApi>;
