// 화면이 쓰는 서버 연결 모음. 앱 하나에 클라이언트 하나(lib/supabase.ts)이고, 데모 모드에서는 같은 이름의 모의 클라이언트가 들어온다.
// 화면 시험은 이 파일 대신 createAuthApi · progress · consentApi 에 가짜 클라이언트를 넣어 쓴다.
import { createAiApi } from './aiApi';
import { APP_VERSION } from './appVersion';
import { createAuthApi } from './authApi';
import { createGradeApi } from './gradeApi';
import { createLikesApi } from './likesApi';
import { createProfileApi } from './profileApi';
import { createRecsApi } from './recsApi';
import { createSettingsApi } from './settingsApi';
import { createShopApi } from './shopApi';
import { supabase } from './supabase';

export const authApi = createAuthApi(supabase);
export const aiApi = createAiApi(supabase);
export const profileApi = createProfileApi(supabase);
export const recsApi = createRecsApi(supabase);
export const likesApi = createLikesApi(supabase); // 11 호감 · 10 수락 · 거절(F6)
export const settingsApi = createSettingsApi(supabase, APP_VERSION); // 12 설정(F7)
export const shopApi = createShopApi(supabase); // 16 상점 · 1회 매칭(F13)
export const gradeApi = createGradeApi(supabase); // 16-G 내 등급 · 10 상대 등급 · 12 등급 계산 멈추기(F13)
export { supabase };
