// 앱 시작 때 어디로 갈지(K2 2-1): 저장된 로그인이 없으면 01, 있으면 서버에 진행 단계를 물어 2-3 표대로.
// 서버 대답이 없을 때(오프라인 · 서버 오류)는 02 로 보내 다시 확인하게 한다.
import type { Href } from 'expo-router';

import type { StageResult } from '@/lib/progress';
import type { ProgressStage } from '@/types/account';

import { routeForStage } from './stage';

export type EntryDeps = {
  hasLogin: () => Promise<boolean>;
  loadStage: () => Promise<StageResult>;
  setStage: (stage: ProgressStage | null) => void;
  firstScreen: Href;
};

export async function resolveEntryHref(deps: EntryDeps): Promise<Href> {
  if (!(await deps.hasLogin())) return deps.firstScreen;
  let result: StageResult;
  try {
    result = await deps.loadStage();
  } catch {
    return routeForStage(null);
  }
  if (!result.ok) return routeForStage(null);
  deps.setStage(result.stage);
  return routeForStage(result.stage);
}
