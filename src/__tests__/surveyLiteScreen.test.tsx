// 임시(F2L) — AYLA'S 설문으로 교체 예정
// F2L 1단계 조건 1 · 2 · 4: 04 짧은 설문 화면 — 10쪽 렌더러 · 필수 미입력 시 [다음] 흐림 + 이유 · 진행바 · [다음] 저장 · 임시 저장 · 이어서 작성 ·
// 05 사진 3칸 → [올리고 설문 마치기] → 스타일 저장 · 제출 · ai-profile start → 06(동의 없음 03 · 한도 07 · 연결 오류 머묾)
import { act } from 'react-test-renderer';
import { AppState, BackHandler, Text } from 'react-native';

import { LITE_COMMON, PHOTOS_LITE, SURVEY_LITE } from '@/content/surveyLiteCopy';
import type { PickedImage } from '@/features/photosLite/photoPipeline';
import type { PhotoPicker } from '@/features/photosLite/photoPicker';
import { PhotosLiteScreen, type PhotosLiteDeps } from '@/features/photosLite/PhotosLiteScreen';
import { LITE_PAGES } from '@/features/surveyLite/liteModel';
import { SurveyLiteScreen, type SurveyLiteDeps } from '@/features/surveyLite/SurveyLiteScreen';
import type { RunOutcome } from '@/lib/aiApi';
import type { LiteAnswers, LiteSnapshot, LoadOutcome, SaveOutcome, UploadOutcome } from '@/lib/surveyLiteApi';

import { allTexts, find, has, hasText, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/lib/services', () => ({ likesApi: {}, aiApi: {}, supabase: {} }));

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때 시간 초과를 막는다(F2L · F6 통합 10-16)

const NOW = Date.UTC(2026, 9, 15, 3, 0, 0);
const snapshot = (over: Partial<LiteSnapshot> = {}): LiteSnapshot => ({ answers: { A01: '1995-03-12' }, birthLocked: true, photos: [], ...over });

function surveySetup(first: LoadOutcome = { ok: true, data: snapshot() }, save: (v: LiteAnswers) => SaveOutcome = () => ({ ok: true })) {
  const saved: LiteAnswers[] = [];
  const load = jest.fn(async () => first);
  const saveAnswers = jest.fn(async (values: LiteAnswers) => {
    saved.push(values);
    return save(values);
  });
  const deps: SurveyLiteDeps = { api: { load, saveAnswers }, now: () => NOW };
  return { deps, load, saveAnswers, saved };
}

const step = (tree: Awaited<ReturnType<typeof mount>>) => textOf(tree, 'surveylite-step');
const question = (tree: Awaited<ReturnType<typeof mount>>) => textOf(tree, 'surveylite-question');
const fill = (tree: Awaited<ReturnType<typeof mount>>) => {
  const node = find(tree, 'surveylite-progress-fill');
  const style = [node?.props.style].flat(3).reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...(s ?? {}) }), {});
  // F21: 진행 막대는 너비 대신 scaleX 로 채운다 — 기대값(%)은 그대로 비교
  const scaleX = ((style.transform as { scaleX?: number }[] | undefined) ?? []).find((t) => t.scaleX !== undefined)?.scaleX ?? 0;
  return `${Math.round(scaleX * 100)}%`;
};
const dimmed = (tree: Awaited<ReturnType<typeof mount>>, id: string) => must(tree, id).props.dimmed === true; // Button 의 흐린 모양(R7)
// 칸(View) 안 글자
const labelOf = (tree: Awaited<ReturnType<typeof mount>>, id: string) =>
  must(tree, id)
    .findAllByType(Text)
    .map((node) => String(node.props.children))
    .join('');
// 누른 뒤 이어지는 비동기 일(저장 · 올리기 · 시작)이 끝나기를 기다린다
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
// 그리고 첫 읽기를 기다린다
const show = async (element: React.ReactElement) => {
  const tree = await mount(element);
  await flush();
  return tree;
};
// 누르고 기다리기
const tap = async (tree: Awaited<ReturnType<typeof mount>>, id: string) => {
  await press(tree, id);
  await flush();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }));
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('04 짧은 설문 — 처음부터 끝까지', () => {
  test('10쪽을 차례로: 렌더러 10종 · 필수 · 저장 값 모양 · 진행바 · 마지막 쪽 → 05', async () => {
    const s = surveySetup();
    const onDone = jest.fn();
    const tree = await show(<SurveyLiteScreen deps={s.deps} onDone={onDone} />);

    // 이어서: 02 에서 받은 A01 만 있으면 처음 빈 쪽(A03)에서 시작하고 N03 은 없다
    expect(question(tree)).toBe('지금 사는 지역을 알려 주세요');
    expect(has(tree, 'surveylite-notice')).toBe(false);
    expect(step(tree)).toBe('기본 · 2 / 3');
    expect(labelOf(tree, 'surveylite-chip-current')).toBe('기본'); // 현재 칩(선택 모양)
    expect(fill(tree)).toBe('9%'); // A01 1쪽 끝 ÷ 11
    // ‹ 로 A01 쪽: 잠긴 생년월일(02 에서 받은 값)
    await press(tree, 'surveylite-header-back');
    expect(question(tree)).toBe('생년월일을 알려 주세요');
    expect(must(tree, 'lite-A01-input').props.disabled).toBe(true);
    expect(must(tree, 'lite-A01-input').props.value).toBe('19950312');
    expect(has(tree, 'surveylite-header-back')).toBe(false); // 첫 쪽은 ‹ 없음
    expect(has(tree, 'surveylite-prev')).toBe(false); // 첫 쪽은 [이전] 없음
    await tap(tree, 'surveylite-next');
    expect(s.saveAnswers).not.toHaveBeenCalled(); // 02 에서 받은 A01 은 다시 보내지 않는다

    // A03 지역: 비우고 [다음] → 이동하지 않고 "지역을 골라 주세요."
    expect(dimmed(tree, 'surveylite-next')).toBe(true);
    await tap(tree, 'surveylite-next');
    expect(question(tree)).toBe('지금 사는 지역을 알려 주세요');
    expect(textOf(tree, 'surveylite-error')).toBe(SURVEY_LITE.regionRequired);
    await press(tree, 'lite-A03-quick-0'); // 서울
    await press(tree, 'lite-A03-sigungu');
    expect(isOpen(tree, 'lite-A03-sheet')).toBe(true);
    await press(tree, 'lite-A03-item-22'); // 강남구
    expect(isOpen(tree, 'lite-A03-sheet')).toBe(false);
    expect(dimmed(tree, 'surveylite-next')).toBe(false);
    expect(textOf(tree, 'surveylite-visibility')).toBe('이 항목은 상대에게 보여요.');
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ A03: { sido: '서울', sigungu: '강남구' } });

    // A05 숫자
    expect(step(tree)).toBe('기본 · 3 / 3');
    await typeInto(tree, 'lite-A05-input', '300');
    await tap(tree, 'surveylite-next');
    expect(textOf(tree, 'surveylite-error')).toBe(SURVEY_LITE.required);
    await typeInto(tree, 'lite-A05-input', '1a72');
    expect(must(tree, 'lite-A05-input').props.value).toBe('172'); // 숫자만
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ A05: 172 });

    // B01 선택
    expect(step(tree)).toBe('학력 · 1 / 1');
    await press(tree, 'lite-B01-opt-2');
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ B01: '대졸' });

    // C05 구간 · 답하지 않음 → null
    expect(textOf(tree, 'surveylite-visibility')).toBe('이 항목은 구간으로만 보여요. 프로필에서 바꿀 수 있어요.');
    await press(tree, 'lite-C05-opt-6');
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ C05: null });

    // D03 부모님 학력: 배너 · 법무 한 줄
    expect(has(tree, 'surveylite-parent-banner')).toBe(true);
    expect(hasText(tree, SURVEY_LITE.parentBanner)).toBe(true);
    expect(textOf(tree, 'surveylite-visibility')).toBe(SURVEY_LITE.parentRangeLine);
    await press(tree, 'lite-D03-opt-1');
    await press(tree, 'lite-D03-opt-1'); // 다시 누르면 풀린다 → 미응답
    expect(dimmed(tree, 'surveylite-next')).toBe(true);
    await press(tree, 'lite-D03-opt-4'); // 답하지 않음
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ D03: null });

    // E08 척도
    expect(step(tree)).toBe('성향 · 1 / 3');
    expect(hasText(tree, '매우 내향적') && hasText(tree, '매우 외향적')).toBe(true);
    await press(tree, 'lite-E08-opt-4');
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ E08: 4 });

    // E13 순위: 처음 순서는 답이 아니다
    expect(dimmed(tree, 'surveylite-next')).toBe(true);
    await press(tree, 'lite-E13-confirm'); // N05 "이 순서로 할게요"
    expect(dimmed(tree, 'surveylite-next')).toBe(false);
    await press(tree, 'lite-E13-down-0'); // 가족 ↓
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ E13: ['일', '가족', '돈', '신앙', '여가'] });

    // T01 텍스트: 안내 · 글자 수
    expect(hasText(tree, SURVEY_LITE.freeTextGuide)).toBe(true);
    await typeInto(tree, 'lite-T01-input', '짧은 소개');
    expect(textOf(tree, 'lite-T01-counter')).toBe('5/300');
    await tap(tree, 'surveylite-next');
    expect(textOf(tree, 'surveylite-error')).toBe('20자 이상 써 주세요.');
    const intro = '주말마다 산책하고 책 읽는 걸 좋아하는 사람이에요.';
    await typeInto(tree, 'lite-T01-input', intro);
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ T01: intro });

    // F01 범위
    expect(step(tree)).toBe('희망 · 1 / 1');
    await typeInto(tree, 'lite-F01-younger', '3');
    await press(tree, 'lite-F01-any');
    expect(must(tree, 'lite-F01-younger').props.disabled).toBe(true); // 상관없음 → 숫자 칸 흐림
    expect(fill(tree)).toBe('91%'); // 10쪽 끝 ÷ 11 (05 가 남음)
    await tap(tree, 'surveylite-next');
    expect(s.saved.at(-1)).toEqual({ F01: '상관없음' });
    expect(onDone).toHaveBeenCalledTimes(1);

    // 등급 · 점수 말이 없다
    expect(allTexts(tree).join(' ')).not.toMatch(/등급|점수|순위표/);
  });

  test('[이전] · ‹ 는 저장하지 않고 앞 쪽으로, 값은 남는다', async () => {
    const s = surveySetup({ ok: true, data: snapshot({ answers: { A01: '1995-03-12', A03: { sido: '부산', sigungu: '해운대구' } } }) });
    const tree = await show(<SurveyLiteScreen deps={s.deps} />);
    expect(question(tree)).toBe('키를 알려 주세요');
    await typeInto(tree, 'lite-A05-input', '181');
    await press(tree, 'surveylite-prev');
    expect(question(tree)).toBe('지금 사는 지역을 알려 주세요');
    expect(textOf(tree, 'surveylite-notice')).toBeNull(); // 쪽을 옮기면 N03 은 사라진다
    await tap(tree, 'surveylite-next');
    expect(must(tree, 'lite-A05-input').props.value).toBe('181');
    expect(s.saved).toEqual([{ A03: { sido: '부산', sigungu: '해운대구' } }]);
  });
});

describe('04 저장 · 이어서', () => {
  test('[임시 저장]: 검증 없이 맞게 쓴 답을 저장하고 머문다 + "임시 저장했어요."(틀린 값은 보내지 않는다)', async () => {
    const s = surveySetup();
    const tree = await show(<SurveyLiteScreen deps={s.deps} />);
    await press(tree, 'lite-A03-quick-1'); // 경기(시·군·구 비어 있음 → 보내지 않음)
    await tap(tree, 'surveylite-header-right');
    expect(s.saved).toEqual([]); // 맞게 쓴 답이 없다(A01 은 잠김)
    expect(labelOf(tree, 'surveylite-toast')).toBe(SURVEY_LITE.savedToast);
    await press(tree, 'lite-A03-sigungu');
    await press(tree, 'lite-A03-item-0'); // 수원시
    await tap(tree, 'surveylite-header-right');
    expect(s.saved.at(-1)).toEqual({ A03: { sido: '경기', sigungu: '수원시' } });
    expect(question(tree)).toBe('지금 사는 지역을 알려 주세요'); // 머문다
    await act(async () => tree.unmount()); // 토스트 타이머 정리
  });

  test('저장 실패: [다음]은 이동하지 않고 "저장하지 못했어요…", 고치면 문구가 사라진다', async () => {
    const s = surveySetup(undefined, () => ({ ok: false, reason: 'network' }));
    const tree = await show(<SurveyLiteScreen deps={s.deps} />);
    await press(tree, 'lite-A03-quick-0');
    await press(tree, 'lite-A03-sigungu');
    await press(tree, 'lite-A03-item-0');
    await tap(tree, 'surveylite-next');
    expect(question(tree)).toBe('지금 사는 지역을 알려 주세요');
    expect(textOf(tree, 'surveylite-save-error')).toBe(SURVEY_LITE.saveFailed);
    await press(tree, 'surveylite-header-right');
    expect(textOf(tree, 'surveylite-save-error')).toBe(SURVEY_LITE.saveFailed);
  });

  test('다시 열면 저장된 답으로 채우고 처음 빈 쪽에서 + N03 "작성하던 곳에서 이어서 시작해요."', async () => {
    const answers = { A01: '1995-03-12', A03: { sido: '서울', sigungu: '중구' }, A05: 170, B01: '석사', C05: '1억~2억' };
    const s = surveySetup({ ok: true, data: snapshot({ answers }) });
    const tree = await show(<SurveyLiteScreen deps={s.deps} />);
    expect(question(tree)).toBe('부모님 중 더 높은 학력을 선택해 주세요');
    expect(textOf(tree, 'surveylite-notice')).toBe(SURVEY_LITE.resume);
    expect(fill(tree)).toBe('45%'); // 5쪽 끝 ÷ 11
    await press(tree, 'surveylite-prev');
    expect(must(tree, 'lite-C05-opt-4').props.variant).toBe('selected');
  });

  test('05 에서 빠진 문항으로 보내면(entry=missing) 그 쪽 + N12 + 이유 문구', async () => {
    const s = surveySetup({ ok: true, data: snapshot({ answers: { A01: '1995-03-12', A03: { sido: '서울', sigungu: '중구' } } }) });
    const tree = await show(<SurveyLiteScreen deps={s.deps} entry="missing" />);
    expect(question(tree)).toBe('키를 알려 주세요');
    expect(textOf(tree, 'surveylite-notice')).toBe(SURVEY_LITE.missing);
    expect(textOf(tree, 'surveylite-error')).toBe(SURVEY_LITE.required);
  });

  test('불러오기 실패 → 공통 문구 + [다시 시도]', async () => {
    const s = surveySetup({ ok: false, reason: 'network' });
    const tree = await show(<SurveyLiteScreen deps={s.deps} />);
    await flush();
    expect(textOf(tree, 'surveylite-load-error')).toBe(LITE_COMMON.offline);
    s.load.mockResolvedValueOnce({ ok: true, data: snapshot() });
    await tap(tree, 'surveylite-retry');
    expect(question(tree)).toBe('지금 사는 지역을 알려 주세요');
  });

  test('앱이 백그라운드로 가면 맞게 쓴 답을 조용히 저장한다(실패해도 문구 없음)', async () => {
    let listener: ((state: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listener = handler as (state: string) => void;
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    const s = surveySetup(undefined, () => ({ ok: false, reason: 'network' }));
    const tree = await show(<SurveyLiteScreen deps={s.deps} />);
    await press(tree, 'lite-A03-quick-0');
    await press(tree, 'lite-A03-sigungu');
    await press(tree, 'lite-A03-item-1');
    await act(async () => listener?.('background'));
    expect(s.saved.at(-1)).toEqual({ A03: { sido: '서울', sigungu: '중구' } });
    expect(has(tree, 'surveylite-save-error')).toBe(false);
  });
});

// ── 05 ────────────────────────────────────────────────────────────────
const fullAnswers = (): LiteAnswers => ({
  A01: '1995-03-12',
  A03: { sido: '서울', sigungu: '중구' },
  A05: 170,
  B01: '대졸',
  C05: null,
  D03: '대졸',
  E08: 3,
  E13: ['가족', '일', '돈', '신앙', '여가'],
  T01: '가'.repeat(25),
  F01: '상관없음',
});

function photosSetup(opts: { demo?: boolean; answers?: LiteAnswers; start?: () => Promise<RunOutcome>; upload?: (slot: string) => UploadOutcome; picker?: Partial<PhotoPicker>; photos?: LiteSnapshot['photos'] } = {}) {
  const saved: LiteAnswers[] = [];
  const order: string[] = [];
  const api = {
    demo: opts.demo ?? true,
    load: jest.fn(async (): Promise<LoadOutcome> => ({ ok: true, data: { answers: opts.answers ?? fullAnswers(), birthLocked: true, photos: opts.photos ?? [] } })),
    saveAnswers: jest.fn(async (v: LiteAnswers): Promise<SaveOutcome> => {
      saved.push(v);
      order.push('save');
      return { ok: true };
    }),
    uploadPhoto: jest.fn(async (slot: string): Promise<UploadOutcome> => opts.upload?.(slot) ?? { ok: true, photoId: `ph-${slot}`, status: 'pending' }),
    photoPreview: jest.fn(async (id: string) => `https://signed/${id}`),
    submit: jest.fn(async (): Promise<SaveOutcome> => {
      order.push('submit');
      return { ok: true };
    }),
    startAi: jest.fn(async (): Promise<RunOutcome> => {
      order.push('start');
      return opts.start ? opts.start() : { kind: 'ok', resultId: 'r1' };
    }),
  };
  const picked: PickedImage = { uri: 'file://pick.jpg', width: 4032, height: 3024, bytes: 3_000_000 };
  const cleanJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x11, 0xff, 0xd9]);
  const picker: PhotoPicker = {
    available: true,
    formatLabel: 'JPG · PNG · HEIC',
    status: jest.fn(async () => 'granted' as const),
    request: jest.fn(async () => 'granted' as const),
    pick: jest.fn(async () => picked),
    encode: jest.fn(async () => cleanJpeg),
    ...opts.picker,
  };
  const deps: PhotosLiteDeps = { api, picker, now: () => NOW, startGraceMs: 200 };
  return { deps, api, picker, saved, order };
}

describe('05 사진 3장 · 마치기', () => {
  test('데모: 칸을 누르면 예시 그림이 다시 만들기 · 검사를 거쳐 확인 중으로 올라간다. 3장 전에는 마칠 수 없다', async () => {
    const s = photosSetup();
    const tree = await show(<PhotosLiteScreen deps={s.deps} />);
    expect(hasText(tree, PHOTOS_LITE.title) && hasText(tree, PHOTOS_LITE.subtitle)).toBe(true);
    expect(PHOTOS_LITE.guideLines.every((line) => hasText(tree, line))).toBe(true);
    expect(hasText(tree, PHOTOS_LITE.internalNote)).toBe(true);
    expect(has(tree, 'photoslite-demo-note')).toBe(true);
    expect(dimmed(tree, 'photoslite-finish')).toBe(true);
    await tap(tree, 'photoslite-finish');
    expect(textOf(tree, 'photoslite-message')).toBe(PHOTOS_LITE.needThree);
    for (const slot of ['face', 'full', 'free']) await tap(tree, `photoslite-slot-${slot}`);
    expect(s.api.uploadPhoto).toHaveBeenCalledTimes(3);
    const files = s.api.uploadPhoto.mock.calls.map((c) => (c as unknown as [string, { bytes: Uint8Array; width: number; height: number }])[1]);
    for (const f of files) {
      expect([f.bytes[0], f.bytes[1], f.width, f.height]).toEqual([0xff, 0xd8, 90, 120]);
    }
    expect(['face', 'full', 'free'].every((slot) => has(tree, `photoslite-done-${slot}`) && has(tree, `photoslite-preview-${slot}`))).toBe(true);
    expect(dimmed(tree, 'photoslite-finish')).toBe(false);
  });

  test('[올리고 설문 마치기]: 스타일 저장 → 제출 → ai-profile start → 06 (설문 본문은 보내지 않는다)', async () => {
    const s = photosSetup();
    const tree = await show(<PhotosLiteScreen deps={s.deps} />);
    for (const slot of ['face', 'full', 'free']) await tap(tree, `photoslite-slot-${slot}`);
    await press(tree, 'lite-G03-opt-4'); // 미니멀
    await press(tree, 'lite-G03-opt-0'); // 단정
    expect(textOf(tree, 'photoslite-style-visibility')).toBe('이 항목은 상대에게 보여요.');
    await tap(tree, 'photoslite-finish');
    expect(s.order).toEqual(['save', 'submit', 'start']);
    expect(s.saved).toEqual([{ G03: ['단정', '미니멀'] }]);
    expect(s.api.startAi).toHaveBeenCalledWith(); // 인자 없음
    expect(mockRouter.replace).toHaveBeenCalledWith('/analysis');
  });

  test('3부-자(0044): 대화형 내 성향을 마친 분은 제출 뒤 AI 정리(start) 없이 확정 → 08(06 · 07 건너뜀) · 확정이 안 되면 지금처럼 start → 06', async () => {
    const yes = photosSetup();
    yes.deps.interviewConfirm = jest.fn(async () => true);
    const tree = await show(<PhotosLiteScreen deps={yes.deps} />);
    for (const slot of ['face', 'full', 'free']) await tap(tree, `photoslite-slot-${slot}`);
    await tap(tree, 'photoslite-finish');
    expect(yes.order).toEqual(['submit']); // 스타일을 안 골랐으면 저장 없이 제출까지만
    expect(yes.api.startAi).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/profile', params: { first: '1' } });
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/analysis');
    mockRouter.replace.mockClear();
    const no = photosSetup();
    no.deps.interviewConfirm = jest.fn(async () => false);
    const tree2 = await show(<PhotosLiteScreen deps={no.deps} />);
    for (const slot of ['face', 'full', 'free']) await tap(tree2, `photoslite-slot-${slot}`);
    await tap(tree2, 'photoslite-finish');
    expect(no.order).toEqual(['submit', 'start']);
    expect(mockRouter.replace).toHaveBeenCalledWith('/analysis');
  });

  test('스타일은 필수가 아니다: 비우고 마치면 저장 없이 제출 → start', async () => {
    const s = photosSetup({ start: () => new Promise(() => undefined) }); // start 는 처리 끝까지 응답하지 않는다
    const tree = await show(<PhotosLiteScreen deps={s.deps} />);
    for (const slot of ['face', 'full', 'free']) await tap(tree, `photoslite-slot-${slot}`);
    jest.useFakeTimers();
    try {
      await act(async () => {
        must(tree, 'photoslite-finish').props.onPress();
        await jest.advanceTimersByTimeAsync(250);
      });
    } finally {
      jest.useRealTimers();
    }
    expect(s.order).toEqual(['submit', 'start']);
    expect(mockRouter.replace).toHaveBeenCalledWith('/analysis'); // 잠깐 기다린 뒤 06 이 상태를 읽는다
  });

  test('start 응답: 동의 없음 → 03 · 새 건 한도 → 07 · 연결 오류 → 머물고 공통 문구', async () => {
    for (const [outcome, want] of [
      [{ kind: 'consent' }, '/consent'],
      [{ kind: 'limit' }, '/traits'],
    ] as const) {
      mockRouter.replace.mockClear();
      const s = photosSetup({ start: async () => outcome });
      const tree = await show(<PhotosLiteScreen deps={s.deps} />);
      for (const slot of ['face', 'full', 'free']) await tap(tree, `photoslite-slot-${slot}`);
      await tap(tree, 'photoslite-finish');
      expect(mockRouter.replace).toHaveBeenCalledWith(want);
    }
    mockRouter.replace.mockClear();
    const s = photosSetup({ start: async () => ({ kind: 'error', reason: 'network' }) });
    const tree = await show(<PhotosLiteScreen deps={s.deps} />);
    for (const slot of ['face', 'full', 'free']) await tap(tree, `photoslite-slot-${slot}`);
    await tap(tree, 'photoslite-finish');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(textOf(tree, 'photoslite-message')).toBe(LITE_COMMON.offline);
  });

  test('04 필수가 비어 있으면 그 쪽으로 보낸다 + N12', async () => {
    const answers = { ...fullAnswers() };
    delete (answers as Record<string, unknown>).E08;
    const onMissing = jest.fn();
    const s = photosSetup({ answers });
    const tree = await show(<PhotosLiteScreen deps={s.deps} onMissing={onMissing} />);
    for (const slot of ['face', 'full', 'free']) await tap(tree, `photoslite-slot-${slot}`);
    await tap(tree, 'photoslite-finish');
    expect(onMissing).toHaveBeenCalledWith(LITE_PAGES.find((p) => p.id === 'E08')?.step);
    expect(textOf(tree, 'photoslite-message')).toBe(SURVEY_LITE.missing);
    expect(s.api.startAi).not.toHaveBeenCalled();
  });

  test('실기기 · 웹: 권한 안내(앱 안) → 시스템 권한 → 고르기 → 긴 변 1600 · JPEG 로 다시 만들어 올린다', async () => {
    const s = photosSetup({ demo: false, picker: { status: jest.fn(async () => 'undetermined' as const) } });
    const tree = await show(<PhotosLiteScreen deps={s.deps} />);
    await tap(tree, 'photoslite-slot-face');
    expect(isOpen(tree, 'photoslite-permission')).toBe(true);
    expect(hasText(tree, PHOTOS_LITE.permissionAsk)).toBe(true);
    expect(s.picker.request).not.toHaveBeenCalled(); // 앱 안 안내를 먼저
    await tap(tree, 'photoslite-permission-confirm');
    expect(s.picker.request).toHaveBeenCalledTimes(1);
    expect(s.picker.encode).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file://pick.jpg' }), { width: 1600, height: 1200 }, 0.85);
    expect(s.api.uploadPhoto).toHaveBeenCalledWith('face', expect.objectContaining({ width: 1600, height: 1200 }));
    expect(has(tree, 'photoslite-done-face')).toBe(true);
  });

  test('권한 거부 → 안내 한 줄(동의문구 5-4), 고르지 않는다', async () => {
    const s = photosSetup({ demo: false, picker: { status: jest.fn(async () => 'denied' as const) } });
    const tree = await show(<PhotosLiteScreen deps={s.deps} />);
    await tap(tree, 'photoslite-slot-full');
    expect(textOf(tree, 'photoslite-denied')).toBe(PHOTOS_LITE.permissionDenied);
    expect(s.picker.pick).not.toHaveBeenCalled();
  });

  test('올리기 실패 · 형식 오류 · 한도: 칸마다 오류 모양 + 카피 문구, 다시 누르면 다시 올린다', async () => {
    let fail = true;
    const s = photosSetup({ demo: false, upload: (slot) => (fail ? { ok: false, code: 'network' } : { ok: true, photoId: `ph-${slot}`, status: 'pending' }) });
    const tree = await show(<PhotosLiteScreen deps={s.deps} />);
    await tap(tree, 'photoslite-slot-face');
    expect(textOf(tree, 'photoslite-slot-error')).toBe(PHOTOS_LITE.uploadFailed);
    expect(has(tree, 'photoslite-done-face')).toBe(false);
    fail = false;
    await tap(tree, 'photoslite-slot-face');
    expect(has(tree, 'photoslite-done-face')).toBe(true);
    expect(has(tree, 'photoslite-slot-error')).toBe(false);

    const bad = photosSetup({ demo: false, picker: { encode: jest.fn(async () => null) } });
    const tree2 = await show(<PhotosLiteScreen deps={bad.deps} />);
    await tap(tree2, 'photoslite-slot-free');
    expect(textOf(tree2, 'photoslite-slot-error')).toBe('올릴 수 없는 사진이에요. JPG · PNG · HEIC, 10MB 이하 사진을 올려 주세요.');
    expect(bad.api.uploadPhoto).not.toHaveBeenCalled();

    const limit = photosSetup({ demo: false, upload: () => ({ ok: false, code: 'limit' }) });
    const tree3 = await show(<PhotosLiteScreen deps={limit.deps} />);
    await tap(tree3, 'photoslite-slot-full');
    expect(textOf(tree3, 'photoslite-slot-error')).toBe(LITE_COMMON.server);
  });

  test('이미 올린 사진(대기 · 승인)은 칸에 미리보기로 보이고 3장이면 바로 마칠 수 있다', async () => {
    const s = photosSetup({
      demo: false,
      photos: [
        { slot: 'face', photoId: 'a', status: 'approved' },
        { slot: 'face', photoId: 'b', status: 'pending' },
        { slot: 'full', photoId: 'c', status: 'pending' },
        { slot: 'free', photoId: 'd', status: 'approved' },
      ],
    });
    const tree = await show(<PhotosLiteScreen deps={s.deps} />);
    await flush();
    expect(s.api.photoPreview.mock.calls.map((c) => c[0]).sort()).toEqual(['b', 'c', 'd']); // 한 칸에 둘이면 새로 올린 대기 사진
    expect(must(tree, 'photoslite-preview-face').props.source).toEqual({ uri: 'https://signed/b' });
    expect(dimmed(tree, 'photoslite-finish')).toBe(false);
  });

  test("다시 올리기 상태(08 반려 배지): 반려된 칸만 열리고 스타일은 숨기며 [올리기] → 08, AI 는 다시 돌리지 않는다", async () => {
    const s = photosSetup({
      demo: false,
      photos: [
        { slot: 'full', photoId: 'c', status: 'pending' },
        { slot: 'free', photoId: 'd', status: 'approved' },
      ],
    });
    const tree = await show(<PhotosLiteScreen deps={s.deps} mode="reupload" />);
    expect(has(tree, 'photoslite-style')).toBe(false);
    expect(labelOf(tree, 'photoslite-finish')).toBe(PHOTOS_LITE.reupload);
    expect(must(tree, 'photoslite-slot-full').props.disabled).toBe(true);
    await tap(tree, 'photoslite-slot-full');
    expect(s.picker.pick).not.toHaveBeenCalled();
    await tap(tree, 'photoslite-slot-face'); // 반려된 칸
    expect(s.api.uploadPhoto).toHaveBeenCalledWith('face', expect.anything());
    await tap(tree, 'photoslite-finish');
    expect(mockRouter.replace).toHaveBeenCalledWith('/profile');
    expect(s.api.startAi).not.toHaveBeenCalled();
    expect(s.api.submit).not.toHaveBeenCalled();
  });
});
