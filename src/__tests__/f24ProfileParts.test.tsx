// F24 후속(D-142): 10 상대 상세 새 부품 두 개 — 결혼관 칸(MarriageViews) · 질문 카드 칸(PromptCards).
//  공개를 켠 칸만 · 데이터가 없으면 칸 전체 0 · 숫자 · 점수 · 등급 · 비교 말 0 · 서버 prompts 모양(S14 0018)만 읽음 · 데모 인물 24명 값이 모두 글로 풀림
import { act } from 'react-test-renderer';

import { DEMO_PEOPLE, detailAnswers, promptsOf } from '@/demo/people';
import { MARRIAGE_IDS, MARRIAGE_VIEW, marriageRows, marriageText, MarriageViews } from '@/features/recs/MarriageViews';
import { PROMPT_CARDS, PromptCards, readPrompts } from '@/features/recs/PromptCards';
import { CONTACT_HINT } from '@/content/contactHintCopy';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createRecsApi, parseCandidate } from '@/lib/recsApi';

import { allTexts, has, mount, textOf } from './renderHelpers';

const RANK_WORDS = /점수|등급|순위|등수|상위|하위|%|퍼센트|\d/;

describe('결혼관 칸(MarriageViews)', () => {
  test('값 → 완성 글: 서버 코드 · 데모 보기 이름 · 1~5 숫자(글로만) 모두, 모르는 값 · 빈 값은 null', () => {
    expect(marriageText('E01', 'y2')).toBe('1년에서 2년 사이에 결혼하고 싶어요');
    expect(marriageText('E01', '1년~2년')).toBe('1년에서 2년 사이에 결혼하고 싶어요');
    expect(marriageText('E02', 'yes_strong')).toBe('자녀를 꼭 갖고 싶어요');
    expect(marriageText('E03', 4)).toBe('결혼 뒤에도 둘 다 일하기를 바라는 편이에요');
    expect(marriageText('E05', '5')).toBe('양가 부모님을 가까이에서 자주 돌보고 싶어요');
    expect(marriageText('E06', '부산·대구·울산·경상')).toBe('결혼하면 부산·대구·울산·경상에서 살고 싶어요');
    expect(marriageText('E07', 'joint')).toBe('돈은 한 통장으로 합쳐서 같이 관리하고 싶어요');
    for (const bad of [null, undefined, '', 'zz', 4.5, 9, {}, ['y2']]) expect(marriageText('E01', bad)).toBeNull();
  });

  test('줄: 공개를 켠 칸만 문항 순서대로(결혼 시기 · 자녀 · 맞벌이 · 양가 부모님 · 사는 곳 · 돈 관리) · E04 · 다른 칸은 무시', () => {
    expect(MARRIAGE_IDS).toEqual(['E01', 'E02', 'E03', 'E05', 'E06', 'E07']);
    expect(Object.values(MARRIAGE_VIEW.labels)).toEqual(['결혼 시기', '자녀', '맞벌이', '양가 부모님', '사는 곳', '돈 관리']);
    const rows = marriageRows({ E07: 'separate', E04: 5, E01: 'm6', A12: '김OO', E03: 3 });
    expect(rows.map((r) => [r.id, r.label])).toEqual([
      ['E01', '결혼 시기'],
      ['E03', '맞벌이'],
      ['E07', '돈 관리'],
    ]);
    expect(marriageRows({})).toEqual([]);
  });

  test('그림: 제목 "결혼관" + 켠 줄만 · 숫자 · 등급 · 점수 말 0 · 데이터가 없으면 칸 전체를 그리지 않는다', async () => {
    const tree = await mount(<MarriageViews answers={{ E01: '1년~2년', E03: 5, E06: 'seoul' }} />);
    expect(textOf(tree, 'candidate-marriage-title')).toBe('결혼관');
    expect(textOf(tree, 'candidate-marriage-E01-label')).toBe('결혼 시기');
    expect(textOf(tree, 'candidate-marriage-E03-text')).toBe('결혼 뒤에도 둘 다 일하기를 꼭 바라요'); // 5 도 숫자 없이 말로
    expect(has(tree, 'candidate-marriage-E02')).toBe(false); // 끈 칸
    expect(allTexts(tree).filter((t) => t !== '1년에서 2년 사이에 결혼하고 싶어요' && RANK_WORDS.test(t))).toEqual([]);
    const empty = await mount(<MarriageViews answers={{ A12: '박OO', E04: 3 }} />);
    expect(empty.toJSON()).toBeNull();
    act(() => tree.unmount());
  });

  test('데모 인물 24명: 공개로 켠 결혼관 값이 모두 글로 풀린다(빠지는 줄 0)', () => {
    for (const p of DEMO_PEOPLE) expect(marriageRows(detailAnswers(p)).length).toBe(Object.keys(p.marriage).length);
    expect(marriageRows(detailAnswers(DEMO_PEOPLE[1]))).toEqual([]); // 박OO: 하나도 켜지 않음 → 칸 없음
  });
});

describe('질문 카드 칸(PromptCards)', () => {
  test('readPrompts: 서버 모양 { code, question, answer } 만 · 빈 글 · 같은 질문 · 모양이 틀린 줄은 빼고 3장까지 · hint 같은 다른 키는 읽지 않는다', () => {
    const raw = [
      { code: 'Q01', question: '주말에 가장 오래 하는 일은?', answer: ' 산책이요. ', hint: 'contact', state: 'ok' },
      { code: 'Q01', question: '같은 질문', answer: '두 번째' },
      { code: 'Q02', question: '요즘 빠져 있는 것은?', answer: '' },
      'x',
      null,
      { code: 'Q17', question: '명절을 보내고 싶은 모습은?', answer: '가족과 조용히요.' },
      { code: 'Q18', question: 'q', answer: 'a' },
      { code: 'Q19', question: 'q2', answer: 'a2' },
    ];
    const cards = readPrompts(raw);
    expect(cards).toEqual([
      { code: 'Q01', question: '주말에 가장 오래 하는 일은?', answer: '산책이요.' },
      { code: 'Q17', question: '명절을 보내고 싶은 모습은?', answer: '가족과 조용히요.' },
      { code: 'Q18', question: 'q', answer: 'a' },
    ]);
    expect(Object.keys(cards[0]).sort()).toEqual(['answer', 'code', 'question']);
    for (const bad of [undefined, null, {}, 'prompts', 3]) expect(readPrompts(bad)).toEqual([]);
  });

  test('그림: 제목 "저를 소개해요" · 카드마다 질문(작은 글씨) + 답(본문) · 아래 받는 쪽 고정 한 줄 · 없으면 칸 전체 0', async () => {
    const tree = await mount(
      <PromptCards
        prompts={[
          { code: 'Q17', question: '명절을 보내고 싶은 모습은?', answer: '양가를 하루씩 나눠 다녀오고 싶어요.' },
          { code: 'Q20', question: '둘이 정하고 싶은 돈 약속 하나는?', answer: '큰 지출은 같이 상의해요.' },
        ]}
      />,
    );
    expect(textOf(tree, 'candidate-prompts-title')).toBe(PROMPT_CARDS.title);
    expect(PROMPT_CARDS.title).toBe('저를 소개해요');
    expect(textOf(tree, 'candidate-prompts-0-q')).toBe('명절을 보내고 싶은 모습은?');
    expect(textOf(tree, 'candidate-prompts-1-a')).toBe('큰 지출은 같이 상의해요.');
    expect(has(tree, 'candidate-prompts-2')).toBe(false);
    expect(has(tree, 'candidate-prompts-note') && allTexts(tree).includes(CONTACT_HINT.receiverNote)).toBe(true);
    expect(allTexts(tree).filter((t) => RANK_WORDS.test(t))).toEqual([]);
    for (const none of [[], null, undefined]) expect((await mount(<PromptCards prompts={none} />)).toJSON()).toBeNull();
    act(() => tree.unmount());
  });

  test('4장 이상이 와도 3장까지만', async () => {
    const many = ['Q01', 'Q02', 'Q03', 'Q04'].map((code) => ({ code, question: `${code} 질문은?`, answer: '답이에요.' }));
    const tree = await mount(<PromptCards prompts={many} />);
    expect(has(tree, 'candidate-prompts-2')).toBe(true);
    expect(has(tree, 'candidate-prompts-3')).toBe(false);
    act(() => tree.unmount());
  });
});

describe('데모 서버 → 두 부품(10 에 넣으면 보일 값)', () => {
  test('김OO: prompts 2장 · 결혼관 3줄(결혼 시기 · 자녀 · 사는 곳) / 박OO: 둘 다 칸 있음 · 없음', async () => {
    const email = 'f24parts@email.com';
    const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 16, 3, 0, 0) }));
    await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
    await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
    await client.rpc('list_today_recommendations', {});
    const kim = (await client.rpc('get_candidate_profile', { p_target: 'demo-cand-1' })).data as { answers: Record<string, unknown>; prompts?: unknown };
    expect(readPrompts(kim.prompts).map((c) => c.code)).toEqual(['Q17', 'Q20']);
    expect(marriageRows(kim.answers).map((r) => r.label)).toEqual(['결혼 시기', '자녀', '사는 곳']);
    const park = (await client.rpc('get_candidate_profile', { p_target: 'demo-cand-2' })).data as { answers: Record<string, unknown>; prompts?: unknown };
    expect(readPrompts(park.prompts)).toHaveLength(2);
    expect(marriageRows(park.answers)).toEqual([]);
    expect(promptsOf(DEMO_PEOPLE[0])).toHaveLength(2);
  });
});

describe('데이터 길(D-144): lib/recsApi 가 서버 prompts 를 살려 온다', () => {
  test('parseCandidate: prompts 를 readPrompts 로 읽는다(hint · state 같은 키는 버림) · 없으면 빈 목록', () => {
    const d = parseCandidate({ user_id: 'u', answers: { E01: 'y2' }, photos: [], reasons: [], prompts: [{ code: 'Q05', question: '처음 만나면 나누고 싶은 이야기는?', answer: '좋아하는 동네 이야기요.', hint: 'contact', slot: 1 }] });
    expect(d?.prompts).toEqual([{ code: 'Q05', question: '처음 만나면 나누고 싶은 이야기는?', answer: '좋아하는 동네 이야기요.' }]);
    expect(parseCandidate({ user_id: 'u', answers: {}, photos: [], reasons: [] })?.prompts).toEqual([]);
    expect(parseCandidate({ user_id: 'u', answers: {}, photos: [], reasons: [], prompts: 'x' })?.prompts).toEqual([]);
  });

  test('데모 서버 → recsApi.loadCandidate: 김OO 질문 카드 2장이 화면 데이터까지 온다 · 11 에서 연 상대(별칭)도', async () => {
    const email = 'f24path@email.com';
    const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 16, 3, 0, 0) }));
    await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
    await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
    const api = createRecsApi(client);
    await api.loadToday();
    const kim = await api.loadCandidate('demo-cand-1');
    expect(kim.ok && kim.data?.prompts?.map((c) => c.code)).toEqual(['Q17', 'Q20']);
    const match = await api.loadCandidate('demo-match-1');
    expect(match.ok && match.data?.prompts?.length).toBe(2);
  });
});
