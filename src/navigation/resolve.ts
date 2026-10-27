// 화살표의 도착(Dest)을 실제 이동으로 바꾼다. 자리 표시 화면과 이후 화면이 같이 쓴다.
import type { Href } from 'expo-router';

import type { Dest } from './flow';
import { screenById, type ScreenId } from './screens';
import {
  nextStep,
  PREFERENCE_FIRST,
  prevStep,
  SURVEY_STEPS,
  type SurveyStep,
} from './surveySteps';

export type NavTarget =
  | { readonly kind: 'href'; readonly href: Href }
  | { readonly kind: 'back' } // 진입한 화면으로(스택에서 한 칸 뒤로)
  | { readonly kind: 'none'; readonly reason: 'stay' | 'by-stage' | 'sub' | 'edge' };

export type NavContext = {
  readonly surveyStep?: SurveyStep; // 지금 보고 있는 설문 쪽(04:next · 04:prev 에 필요)
  readonly origin?: ScreenId; // 이동을 시작하는 화면(희망 조건 수정이 어디서 왔는지 남기는 데 쓴다)
};

const survey = (step: SurveyStep, params: Record<string, string> = {}): NavTarget => ({
  kind: 'href',
  href: { pathname: '/survey/[step]', params: { step, ...params } },
});

// '희망 조건 수정' 상태로 들어갈 때 돌아올 곳(K2 04): 12 에서 왔으면 12, 09 · 13 에서 왔으면 09
function editPreferences(origin: ScreenId | undefined): NavTarget {
  const from = origin === '12' ? 'settings' : 'recommendations';
  return survey(PREFERENCE_FIRST, { mode: 'edit-preferences', from });
}

export function resolveDest(dest: Dest, ctx: NavContext = {}): NavTarget {
  switch (dest) {
    case 'stay':
      return { kind: 'none', reason: 'stay' };
    case 'by-stage':
      return { kind: 'none', reason: 'by-stage' };
    case 'entry':
      return { kind: 'back' };
    case '04:first':
      return survey(SURVEY_STEPS[0]);
    case '04:last':
      return survey(SURVEY_STEPS[SURVEY_STEPS.length - 1]);
    case '04:25':
      return editPreferences(ctx.origin);
    case '04:next': {
      const next = ctx.surveyStep ? nextStep(ctx.surveyStep) : null;
      return next ? survey(next) : { kind: 'none', reason: 'edge' };
    }
    case '04:prev': {
      const prev = ctx.surveyStep ? prevStep(ctx.surveyStep) : null;
      return prev ? survey(prev) : { kind: 'none', reason: 'edge' };
    }
    case 'sub:notifications':
    case 'sub:security':
    case 'sub:consent-management':
    case 'sub:blocked-list':
    case 'sub:report-history':
    case 'sub:support':
    case 'sub:terms':
    case 'sub:privacy':
    case 'sub:licenses':
    case 'sub:image-credit':
    case 'sub:safety':
    case 'sub:business-info':
    case 'sub:avoid':
      return { kind: 'none', reason: 'sub' }; // 12 안의 쪽(features/settings/SettingsScreen 의 page). 라우트가 아니다
    default:
      return { kind: 'href', href: screenById(dest).href };
  }
}

// 버튼에 보일 도착 이름
export function destName(dest: Dest, ctx: NavContext = {}): string {
  if (dest === 'stay') return '같은 화면에 머묾';
  if (dest === 'by-stage') return '진행 단계대로';
  if (dest === 'entry') return '진입한 화면';
  if (dest === '04:first') return '04-01 설문';
  if (dest === '04:last') return '04-32 설문';
  if (dest === '04:25') return '04-25 희망 조건 수정';
  if (dest === '04:next') return ctx.surveyStep ? `04-${nextStep(ctx.surveyStep) ?? '끝'} 설문` : '다음 쪽';
  if (dest === '04:prev') return ctx.surveyStep ? `04-${prevStep(ctx.surveyStep) ?? '처음'} 설문` : '이전 쪽';
  if (dest.startsWith('sub:')) return `12의 하위 화면(${dest.slice(4)})`;
  const def = screenById(dest as ScreenId);
  return `${def.id} ${def.name}`;
}
