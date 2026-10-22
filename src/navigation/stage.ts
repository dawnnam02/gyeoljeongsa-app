// 로그인한 뒤 어디로 가나. 원본: 기획/화면_요구사항.md 2-3 표(분기 ② 재진입).
// 서버가 계정의 '진행 단계'를 알려 주고, 앱은 이 표대로만 간다. 앱이 단계를 추측하지 않는다.
import type { Href } from 'expo-router';

import type { ProgressStage } from '@/types/account';

import type { SurveyStep } from './surveySteps';

export function routeForStage(
  stage: ProgressStage | null,
  firstUnansweredStep: SurveyStep = '01',
): Href {
  switch (stage) {
    case null: // 서버 값을 아직 모르면 안전하게 02에서 다시 확인한다
    case 'withdrawn': // 탈퇴한 이메일은 새 이메일과 같게 02부터(재가입 제한은 K3)
      return '/sign-in';
    case 'email-verified':
      return { pathname: '/sign-in', params: { open: 'birthdate' } };
    case 'birthdate-passed':
      return '/consent';
    case 'consent-changed':
      return { pathname: '/consent', params: { mode: 'reconsent' } };
    case 'consented':
      return { pathname: '/survey/[step]', params: { step: firstUnansweredStep } };
    case 'survey-complete':
      return '/photos';
    case 'ai-processing':
      return '/analysis';
    case 'ai-failed':
      return { pathname: '/analysis', params: { state: 'failed' } };
    case 'traits-pending':
      return '/traits';
    case 'traits-confirmed':
      return '/recommendations';
    case 'blocked': // 로그인 불가 안내 화면은 K3 · L2 가 문구를 정한 뒤 F1이 만든다. 그때까지 02에서 안내
      return { pathname: '/sign-in', params: { reason: 'blocked' } };
  }
}
