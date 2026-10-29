// 대화형 설문 '내 성향'을 마친 분의 확정 길(3부-자 · 백엔드 0044 12-4 `confirm_profile(null)`).
//  · 인터뷰 정리(get_interview_summary status done)가 있으면 06 AI 정리 · 07 확인 없이 서버가 그 결과(분석 5축)로 확정 → 08
//  · 확정이 안 되면(분석 대기 · 동의 · 설문 · 사진 빠짐 · 연결 오류) 지금 길 그대로(06 → 07)
//  · 앱 기기 모듈 · 서버 연결은 부를 때 한 번만 만든다(화면을 열기 전엔 읽지 않음)
import type { AiApi } from '@/lib/aiApi';

// 대화형 설문 정리를 마쳤나
export const interviewDone = async (): Promise<boolean> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { surveyChatDeps } = require('@/features/surveyChat/deps') as typeof import('@/features/surveyChat/deps');
    const r = await surveyChatDeps().chat.summary();
    return r.ok && r.data.status === 'done';
  } catch {
    return false;
  }
};

// 마쳤으면 confirm_profile(null) 로 확정. 안 되면 건 id 가 있을 때 그 건으로(0004 길 — 0044 전 서버 · 건이 있는 분). true = 확정됨(→ 08), false = 지금 길로(07 · 06)
export async function confirmFromInterview(confirm: AiApi['confirm'], done: () => Promise<boolean>, resultId: string | null = null): Promise<boolean> {
  try {
    if (!(await done())) return false;
    if ((await confirm(null)).ok) return true;
    return resultId !== null && (await confirm(resultId)).ok;
  } catch {
    return false;
  }
}
