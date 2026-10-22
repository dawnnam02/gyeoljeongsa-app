// 06 · 07 의 순수 규칙: 시간(3초 · 60초 · 120초) · 막대 5단위 · 칩 · 요약 검사 · 직접 입력 후보
import { currentStep, GIVE_UP_AFTER_MS, isGiveUp, isSlow, POLL_INTERVAL_MS, progressRatio, RETRY_LOCK_MS, SLOW_AFTER_MS } from '@/features/ai/analysisLogic';
import { checkDraft, checkNewTag, checkSummary, clampTrait, removeTag, setTrait, snapTrait, toEdited, toggleCandidate } from '@/features/ai/traitsLogic';
import { failureFromRetryCount } from '@/lib/aiApi';
import { MANUAL_TAG_FALLBACK } from '@/content/traitsContent';

describe('06 시간 규칙 (화면_요구사항 06)', () => {
  test('3초 간격 · 60초 안내 · 120초 실패 · 다시 시도 3초 잠금', () => {
    expect(POLL_INTERVAL_MS).toBe(3000);
    expect(SLOW_AFTER_MS).toBe(60_000);
    expect(GIVE_UP_AFTER_MS).toBe(120_000);
    expect(RETRY_LOCK_MS).toBe(3000);
    expect(isSlow(59_999)).toBe(false);
    expect(isSlow(60_000)).toBe(true);
    expect(isGiveUp(119_999)).toBe(false);
    expect(isGiveUp(120_000)).toBe(true);
  });

  test('단계 글: 0~20초 정리 · 20~40초 성향 파악 · 그 뒤 중요도 제안', () => {
    expect([0, 19_999, 20_000, 39_999, 40_000, 200_000].map(currentStep)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  test('진행바는 앞으로만 가고 끝나기 전에는 가득 차지 않는다', () => {
    let prev = -1;
    for (let t = 0; t <= 200_000; t += 5000) {
      const r = progressRatio(t);
      expect(r).toBeGreaterThanOrEqual(prev);
      expect(r).toBeLessThan(1);
      prev = r;
    }
  });

  test('실패 단계 표(설계 9-2): 다시 시도 횟수 → 버튼', () => {
    expect([0, 1, 2, 3].map((n) => failureFromRetryCount(n)).map((f) => [f.stage, f.retriesLeft, f.showRetry, f.showManual])).toEqual([
      [1, 3, true, false],
      [2, 2, true, false],
      [3, 1, true, true],
      [4, 0, false, true],
    ]);
  });
});

describe('07 막대', () => {
  test('0~100 정수, 5단위로 맞춘다', () => {
    expect([-5, 0, 2, 3, 74, 100, 130].map(snapTrait)).toEqual([0, 0, 0, 5, 75, 100, 100]);
    expect(clampTrait(101.4)).toBe(100);
    const base = { extraversion: 10, planning: 20, family: 30, economy: 40, conflict: 50 };
    expect(setTrait(base, 'family', 62)).toEqual({ ...base, family: 60 });
  });
});

describe('07 칩 · 요약 (N14)', () => {
  test('칩: 2~8자 · 중복 불가 · 전화번호 · 링크 불가 · # 는 뗀다', () => {
    expect(checkNewTag('유머러스', ['차분함'])).toEqual({ ok: true, tag: '유머러스' });
    expect(checkNewTag(' #유머러스 ', [])).toEqual({ ok: true, tag: '유머러스' });
    expect(checkNewTag('가', [])).toMatchObject({ ok: false, message: '2~8자로 써 주세요.' });
    expect(checkNewTag('아홉글자이상태그입니다', [])).toMatchObject({ ok: false, message: '2~8자로 써 주세요.' });
    expect(checkNewTag('차분함', ['차분함'])).toMatchObject({ ok: false, message: '이미 있는 말이에요.' });
    expect(checkNewTag('010-1234-5678', [])).toMatchObject({ ok: false, message: '전화번호나 링크는 쓸 수 없어요.' });
    expect(checkNewTag('www.a', [])).toMatchObject({ ok: false, message: '전화번호나 링크는 쓸 수 없어요.' });
  });

  test('요약: 20자 이상 · 전화번호 · 링크 불가 · 직접 입력은 비워도 된다', () => {
    expect(checkSummary('짧아요.', false)).toMatchObject({ ok: false, message: '20자 이상 써 주세요.' });
    expect(checkSummary('', false).ok).toBe(false);
    expect(checkSummary('', true).ok).toBe(true);
    expect(checkSummary('계획을 세우고 지키는 편이고, 가족과 보내는 시간을 중요하게 여겨요.', false).ok).toBe(true);
    expect(checkSummary('계획을 세우고 지키는 편이고, 홈페이지는 https://x.kr 이에요.', false)).toMatchObject({ ok: false, message: '전화번호나 링크는 쓸 수 없어요.' });
  });

  test('후보에서 고르기는 최대 5개, 지우기는 그 칩만', () => {
    let tags: string[] = [];
    for (const t of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) tags = toggleCandidate(tags, t);
    expect(tags).toEqual(['a1', 'b2', 'c3', 'd4', 'e5']);
    expect(toggleCandidate(tags, 'b2')).toEqual(['a1', 'c3', 'd4', 'e5']);
    expect(removeTag(tags, 'a1')).toEqual(['b2', 'c3', 'd4', 'e5']);
  });

  test('저장 전 검사: 칩 1개 이상 · 직접 입력만 요약을 비울 수 있다 · 저장할 값은 공백을 뗀다', () => {
    const traits = { extraversion: 10, planning: 20, family: 30, economy: 40, conflict: 50 };
    expect(checkDraft({ traits, tags: [], summary: '' }, { manual: true })).toMatchObject({ ok: false, field: 'tags' });
    expect(checkDraft({ traits, tags: ['차분함'], summary: '' }, { manual: true }).ok).toBe(true);
    expect(checkDraft({ traits, tags: ['차분함'], summary: '' }, { manual: false })).toMatchObject({ ok: false, field: 'summary' });
    expect(toEdited({ traits, tags: ['차분함'], summary: '  앞뒤 공백  ' }).summary).toBe('앞뒤 공백');
  });
});

describe('직접 입력 후보 목록', () => {
  test('각 2~8자이고 겹치지 않는다 (서버 검사 8자 이하)', () => {
    expect(new Set(MANUAL_TAG_FALLBACK).size).toBe(MANUAL_TAG_FALLBACK.length);
    for (const tag of MANUAL_TAG_FALLBACK) {
      expect(tag.length).toBeGreaterThanOrEqual(2);
      expect(tag.length).toBeLessThanOrEqual(8);
    }
  });
});
