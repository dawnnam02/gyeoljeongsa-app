// 기능 켜기 스위치 키 — 목록 원본은 같은 폴더의 featureKeys.json 하나다(R1 A⑦ · K19 2-5). 여기는 그 목록을 읽는 함수만 둔다.
//  · 앱(lib/featureFlagsApi · hooks/useFeatureFlags) · 데모(lib/v4Demo) · 점검 도구(scripts)가 같은 JSON 을 읽는다. 키를 더하거나 빼면 JSON 만 고친다
//  · live = 서버가 키를 모를 때 · 스위치를 못 읽었을 때 앱이 쓰는 값. 구현된 기능(group E)과 prelaunch · review_required(켜짐이 닫힌 쪽, K20 1-3 · D-126)만 켜짐
//  · demo = 데모 처음값(F22 · K20 4-3). 적지 않은 키는 켜짐(데모 시드처럼), prelaunch · review_required 만 꺼짐(테스트 웹은 지금 동작 그대로)
//  · pending = 팀장 판단 뒤 서버에 등록할 키(지금은 서버에 없다 → live 값 꺼짐)
import data from './featureKeys.json';

export type FeatureKeyInfo = { key: string; group: string; id: string; live: boolean; demo?: boolean; pending?: boolean };
export type FeatureKey = string;

export const FEATURE_KEY_LIST: readonly FeatureKeyInfo[] = (data as { keys: FeatureKeyInfo[] }).keys;
export const FEATURE_KEYS: readonly FeatureKey[] = FEATURE_KEY_LIST.map((k) => k.key);

const byKey = new Map(FEATURE_KEY_LIST.map((k) => [k.key, k]));
export const isFeatureKey = (key: string): boolean => byKey.has(key);
export const liveDefault = (key: FeatureKey): boolean => byKey.get(key)?.live === true;
export const isPendingKey = (key: FeatureKey): boolean => byKey.get(key)?.pending === true;
// 데모 처음값: 목록 밖 · pending 키는 꺼짐, demo 를 적은 키는 그 값, 나머지는 켜짐
export const demoDefault = (key: FeatureKey): boolean => {
  const info = byKey.get(key);
  if (!info || info.pending) return false;
  return info.demo ?? true;
};

// V5(D-152 · W10): 티켓 매칭 전환으로 숨기는 v4 화면 스위치. 꺼져 있으면 그 탭 · 라우트 · 들어가는 버튼이 없다(코드 · 시험은 그대로)
export const V5_HIDE_KEYS = { dailyRecs: 'v4_daily_recs', likes: 'v4_likes', shop: 'v4_shop' } as const;
const V5_KEYS: readonly string[] = Object.values(V5_HIDE_KEYS);
// 데모 장면: 이메일 앞부분에 v4on 이 있으면 숨긴 v4 화면 스위치를 켠다(예전 화면 웹 점검 web-f4 ~ f24 가 쓴다). 그 밖은 데모 처음값
export const demoSceneDefault = (key: FeatureKey, email: string | null | undefined): boolean => {
  if (V5_KEYS.includes(key) && (email ?? '').split('@')[0].toLowerCase().includes('v4on')) return true;
  return demoDefault(key);
};
