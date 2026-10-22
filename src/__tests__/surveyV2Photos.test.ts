// F20(D-123): 05 사진 등록의 설문 빈 문항 검사 — 스위치 survey_v2 켜짐이면 정식 설문 v2 진행, 꺼짐이면 임시 설문(지금까지와 같음).
import type { SurveyV2Api } from '@/features/surveyV2/api';
import { photosSurveyMissing } from '@/features/surveyV2/photosCheck';
import { surveyV2On } from '@/features/surveyV2/switch';
import { FLAGS_ALL_OFF, FLAGS_FALLBACK, type FeatureFlags } from '@/lib/featureFlagsApi';

jest.mock('@/lib/services', () => ({ supabase: {}, aiApi: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));

const flagsWith = (on: boolean): FeatureFlags => ({ ...FLAGS_ALL_OFF, on: { ...FLAGS_ALL_OFF.on, survey_v2: on } });
const FULL_LITE = { A01: '1995-03-12', A03: { sido: '서울', sigungu: '강남구' }, A05: 172, B01: '대학교(4년제)', C05: null, D03: '대학교', E08: 3, E13: ['가족'], T01: '글', F01: '상관없음' };

function deps(on: boolean, load: Pick<SurveyV2Api, 'load'>['load']) {
  return { flags: async () => flagsWith(on), api: () => ({ load }) };
}
const snap = (answers: Record<string, unknown>) =>
  ({ ok: true, data: { userKey: 'u', answers, appeal: {}, stories: {}, storySlotsFree: 3, publicOn: {}, proofs: {}, firstMissing: null } }) as Awaited<ReturnType<SurveyV2Api['load']>>;

describe('스위치 survey_v2 읽기(features/surveyV2/switch)', () => {
  test('서버가 알려 주면 그 값, 못 읽으면 데모는 켜짐(데모 처음값) · 실제 앱은 꺼짐(임시 설문)', () => {
    expect(surveyV2On(flagsWith(true), false)).toBe(true);
    expect(surveyV2On(flagsWith(false), true)).toBe(false);
    expect(surveyV2On(FLAGS_FALLBACK, true)).toBe(true);
    expect(surveyV2On(FLAGS_FALLBACK, false)).toBe(false);
  });
});

describe('05 설문 빈 문항 검사', () => {
  test('스위치 꺼짐: 임시 설문 첫 빈 쪽 번호(지금까지와 같다)', async () => {
    const load = jest.fn();
    expect(await photosSurveyMissing({ A01: '1995-03-12' }, deps(false, load))).toBe('02');
    expect(await photosSurveyMissing(FULL_LITE, deps(false, load))).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  test("스위치 켜짐: v2 필수 흐름에 빈 문항이 있으면 'v2'(→ /survey/v2?notice=missing), 다 찼으면 통과", async () => {
    expect(await photosSurveyMissing({}, deps(true, async () => snap({ A12: '김하나' })))).toBe('v2');
    const full = await photosSurveyMissing({}, deps(true, async () => snap(fullV2())));
    expect(full).toBeNull();
  });

  test('스위치 켜짐 · v2 답을 못 읽으면 막지 않는다(서버가 다시 본다)', async () => {
    expect(await photosSurveyMissing({}, deps(true, async () => ({ ok: false, reason: 'network' })))).toBeNull();
  });
});

function fullV2(): Record<string, unknown> {
  return {
    A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165, A06: 'none', A07: 'never', A08: 'none',
    B01: 'hs', B04: 'none', C01: 'student', C05: 'inc01', C06: 'ast01', D08: 'unknown', D09: 'unknown', D04: 'pas01', D05: '0',
    E14: 3, E15: 3, A09: 'no', A10: 'rare', E12: 'morning', E11: ['travel'], E10: 'talk_now', E13: ['family', 'work', 'money', 'leisure', 'health'], E16: 3, E08: 3, E09: 3,
    T01: '조용한 주말을 좋아하고 산책을 자주 하는 편이에요.', E01: 'y1', E02: 'yes', E03: 3, E04: 3, E05: 3, E06: 'seoul', E07: 'joint', T02: '평일 저녁에는 같이 밥을 먹고 싶어요 정말로.', T03: '서로 존중하는 마음이에요.',
    F01: 'any', F02: 'any', F03: 'any', F04: ['any'], F05: 'any', F06: ['any'], F07: ['any'], F08: ['any'], F09: ['any'], F10: ['any'], F14: 'any', F15: 'any', F16: 'any', F11: 3,
  };
}
