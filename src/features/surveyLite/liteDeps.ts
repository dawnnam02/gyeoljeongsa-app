// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 화면이 기본으로 쓰는 연결: 데모 모드면 메모리(lib/surveyLiteDemo.ts), 아니면 실서버 계약(lib/surveyLiteApi.ts).
// 처음 부를 때 한 번만 만든다. 화면 시험은 이 파일 대신 deps 를 직접 넣는다.
import { env } from '@/config/env';
import { aiApi, supabase } from '@/lib/services';
import { createSurveyLiteApi, type SurveyLiteApi } from '@/lib/surveyLiteApi';
import { createSurveyLiteDemoApi } from '@/lib/surveyLiteDemo';

let instance: SurveyLiteApi | null = null;

export function surveyLiteApi(): SurveyLiteApi {
  if (!instance) instance = env.demoMode ? createSurveyLiteDemoApi(supabase, aiApi) : createSurveyLiteApi(supabase, aiApi);
  return instance;
}
