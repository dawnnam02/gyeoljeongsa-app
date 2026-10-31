// AIT-F ⑤ ⑥ ⑦ 화면 시험 — 시험용 AI 코드 칸 · 네 기능(고민 정리 · 궁합 카드 AI판 · 문장 다듬기 · 별자리 풀이) · 시험자 동의 시트 · 화면 상태(로딩 · 오류 · 위기 · 끝).
//  보안 앱 시험 ATF-05 ~ 15 · 20 ~ 29 가운데 화면 몫. 서버는 가짜 fetch 가 대신한다(네트워크 0 · 유료 0). 글은 카피 23장 사본(aitCopy)과 한 글자씩 같아야 한다.
import fs from 'node:fs';
import path from 'node:path';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { AIT_TEXT } from '@/content/aitCopy';
import { AitCodePage } from '@/features/settings/AitCodePage';
import { CoachSheet, applyOption } from '@/features/ait/CoachSheet';
import { CompatAiBlock, sharedOf } from '@/features/ait/CompatAiBlock';
import { ConcernChat, noteKeys } from '@/features/ait/ConcernChat';
import { StarAiBlock, horoscopeBody } from '@/features/ait/StarAiBlock';
import { aitStore } from '@/features/ait/aitStore';
import { ait } from '@/features/ait/aitText';

import { Text } from 'react-native';

import { allTexts, has, hasText, isOpen, mount, must, press, typeInto } from './renderHelpers';

// 같은 testID 가 부품(바깥) → 글자(안쪽)로 겹쳐 있으면 안쪽 글자까지 내려가 읽는다
const textOf = (tree: ReactTestRenderer, id: string): string | null => {
  const nodes = tree.root.findAll((n) => n.props.testID === id);
  if (nodes.length === 0) return null;
  for (const n of nodes) {
    const s = n.findAllByType(Text).map((x) => [x.props.children].flat().join('')).join('');
    if (s) return s;
  }
  return '';
};

jest.setTimeout(90_000);
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
const mockMem = new Map<string, string>();
jest.mock('@/lib/secureStorage', () => ({
  secureStore: { get: async (k: string) => mockMem.get(k) ?? null, set: async (k: string, v: string) => void mockMem.set(k, v), del: async (k: string) => void mockMem.delete(k) },
}));

const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');
const flush = () => act(async () => new Promise((r) => setTimeout(r, 10)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
const realFetch = global.fetch;

type Reply = Record<string, unknown>;
function serve(...replies: Reply[]) {
  const f = jest.fn();
  for (const r of replies) f.mockResolvedValueOnce({ json: async () => r });
  f.mockResolvedValue({ json: async () => ({ ok: false, code: 'unavailable', mode: 'mock' }) });
  global.fetch = f as unknown as typeof fetch;
  return f;
}
const sent = (f: jest.Mock, i = 0) => ({ url: f.mock.calls[i][0] as string, init: f.mock.calls[i][1] as { headers: Record<string, string>; body: string }, body: JSON.parse((f.mock.calls[i][1] as { body: string }).body) as Record<string, unknown> });
const ok = (display: unknown, extra: Reply = {}): Reply => ({ ok: true, code: 'ok', mode: 'mock', display, ...extra });
const err = (code: string, extra: Reply = {}): Reply => ({ ok: false, code, mode: 'mock', ...extra });
const card = (id: string, lines: string[], options: string[], extra: Reply = {}): Reply => ({ ok: false, code: id === 'minor' ? 'refused_intent' : 'crisis', mode: 'mock', card: { id, lines, options }, ...extra });
async function grant(consent = true) {
  await aitStore.load();
  await aitStore.setCode(CODE);
  if (consent) await aitStore.setConsent();
}
// 첫 전송: 동의 시트가 떠 있으면 체크하고 동의한 뒤 기다린다
async function sendFirst(tree: ReactTestRenderer) {
  await press(tree, 'concern-send');
  await flush();
  if (isOpen(tree, 'concern-consent')) {
    await press(tree, 'concern-consent-check');
    await press(tree, 'concern-consent-confirm');
  }
  await flush();
}
const everyProp = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON());

beforeEach(() => {
  mockMem.clear();
  aitStore.reset();
});
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  global.fetch = realFetch;
});

// ================================================================ 코드 칸
describe('AIT-F ⑤ 설정 › 시험용 AI 코드 (ATF-03 ~ 05 · 카피 23-6)', () => {
  test('글은 카피 23-6 그대로 · 코드 없음 상태 · 입력 칸은 가려 입력 · 자동완성 끔', async () => {
    const tree = keep(await mount(<AitCodePage onBack={jest.fn()} onToast={jest.fn()} />));
    await flush();
    expect(textOf(tree, 'settings-ait-lead')).toBe(AIT_TEXT['AIT_SET.lead']);
    expect(textOf(tree, 'settings-ait-status')).toBe(AIT_TEXT['AIT_SET.status.off']);
    expect(textOf(tree, 'settings-ait-check')).toBe(AIT_TEXT['AIT_SET.check']);
    expect(textOf(tree, 'settings-ait-share')).toBe(AIT_TEXT['AIT_SET.share']);
    expect(textOf(tree, 'settings-ait-noeffect')).toBe(AIT_TEXT['AIT_SET.noEffect']);
    expect(textOf(tree, 'settings-ait-head-note')).toBe(AIT_TEXT['AIT.testNote']);
    const input = must(tree, 'settings-ait-input');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoComplete).toBe('off');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.label).toBe(AIT_TEXT['AIT_SET.a11y.field']);
    // 웹(시험은 ios)이 아닌 곳의 보관 안내 — 이 시험에서는 기기 안전 저장 글
    expect(textOf(tree, 'settings-ait-store')).toBe(AIT_TEXT['AIT_SET.native']);
    expect(must(tree, 'settings-ait-save').props.disabled).toBe(true);
  });

  test('코드 넣기 → 상태 · 토스트 · 입력 칸 비움, 화면 어디에도 코드 값 0 · 서버 호출 0 · 지우기 → 없음 (ATF-05 CANARY)', async () => {
    const onToast = jest.fn();
    const f = serve();
    const tree = keep(await mount(<AitCodePage onBack={jest.fn()} onToast={onToast} />));
    await flush();
    await typeInto(tree, 'settings-ait-input', CODE);
    expect(must(tree, 'settings-ait-save').props.disabled).toBeFalsy();
    await press(tree, 'settings-ait-save');
    await flush();
    expect(aitStore.get().code).toBe(CODE);
    expect(onToast).toHaveBeenCalledWith(AIT_TEXT['AIT_SET.saved']);
    expect(textOf(tree, 'settings-ait-status')).toBe(AIT_TEXT['AIT_SET.status.on']);
    expect(must(tree, 'settings-ait-input').props.value).toBe('');
    expect(everyProp(tree)).not.toContain(CODE);
    expect(f).not.toHaveBeenCalled(); // 저장해도 서버를 부르지 않는다
    await press(tree, 'settings-ait-clear');
    await flush();
    expect(aitStore.get().code).toBeNull();
    expect(onToast).toHaveBeenLastCalledWith(AIT_TEXT['AIT_SET.cleared']);
    expect(textOf(tree, 'settings-ait-status')).toBe(AIT_TEXT['AIT_SET.status.off']);
  });
});

// ================================================================ 궁합 카드 AI판
describe('AIT-F ⑥ 궁합 카드 AI판 (카피 23-7 · ATF-26 ~ 27)', () => {
  const SAME = [{ code: 'travel' }, { code: 'food' }, { group: 'out' }];
  const SHOWN = { same_line: '두 분 다 여행을 좋아해요.', topics: ['가 보고 싶은 곳이 있나요?', '맛집을 함께 찾아볼까요?'], notes: ['x'] };

  test('보낼 값: 취미 코드만 · 갈래 항목 제외 · 방 id · 회원 정보 0 (ATF-27)', () => {
    expect(sharedOf(SAME)).toEqual([{ k: 'hobby', v: 'travel' }, { k: 'hobby', v: 'food' }]);
    expect(sharedOf([{ group: 'move' }])).toEqual([]);
  });

  test('같은 값이 없으면 안내 글만(AI 호출 0)', async () => {
    const f = serve();
    const tree = keep(await mount(<CompatAiBlock same={[{ group: 'out' }]} onSettings={jest.fn()} />));
    expect(textOf(tree, 'pair-ai-none')).toBe(AIT_TEXT['PAIR_AI.noShared']);
    expect(f).not.toHaveBeenCalled();
  });

  test('코드 없음 → 서버 요청 0 · 미리 쓴 글 안내 + [시험용 AI 코드 넣기]가 설정으로 (ATF-06)', async () => {
    const f = serve();
    const onSettings = jest.fn();
    const tree = keep(await mount(<CompatAiBlock same={SAME} onSettings={onSettings} />));
    await press(tree, 'pair-ai-go');
    await flush();
    expect(textOf(tree, 'pair-ai-demo-note')).toBe(AIT_TEXT['AIT.demo.note']);
    expect(f).not.toHaveBeenCalled();
    await press(tree, 'pair-ai-demo-settings');
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  test('동의 전에는 호출 0 → 체크하고 동의하면 한 번 부른다 · 결과에 AI 표시 · 고정 글 · 점수 말 0 (23-2 · 23-7)', async () => {
    await grant(false);
    const f = serve(ok(SHOWN));
    const tree = keep(await mount(<CompatAiBlock same={SAME} onSettings={jest.fn()} />));
    await press(tree, 'pair-ai-go');
    await flush();
    expect(f).not.toHaveBeenCalled();
    expect(isOpen(tree, 'pair-ai-consent')).toBe(true);
    expect(textOf(tree, 'pair-ai-consent-privacy-send')).toBe(AIT_TEXT['AIT.privacy.send']);
    expect(textOf(tree, 'pair-ai-consent-privacy-keep')).toBe(AIT_TEXT['AIT.privacy.keep']);
    expect(textOf(tree, 'pair-ai-consent-name')).toBe(AIT_TEXT['CONCERN.notice.name']);
    expect(textOf(tree, 'pair-ai-consent-nosend')).toBe(AIT_TEXT['CONCERN.intro.noSend']);
    expect(must(tree, 'pair-ai-consent-confirm').props.disabled).toBe(true); // 체크 전
    await press(tree, 'pair-ai-consent-check');
    await press(tree, 'pair-ai-consent-confirm');
    await flush();
    expect(f).toHaveBeenCalledTimes(1);
    const s = sent(f);
    expect(s.url).toBe('/api/ai/compat');
    expect(s.body).toEqual({ feature: 'compat', shared: [{ k: 'hobby', v: 'travel' }, { k: 'hobby', v: 'food' }] });
    expect(s.init.headers['x-ait-code']).toBe(CODE);
    expect(aitStore.get().consent?.version).toBeTruthy();
    expect(textOf(tree, 'pair-ai-label')).toBe(AIT_TEXT['AIT.aiLabel']);
    expect(textOf(tree, 'pair-ai-same')).toBe(SHOWN.same_line);
    expect(textOf(tree, 'pair-ai-note')).toBe(AIT_TEXT['PAIR_AI.note']);
    expect(textOf(tree, 'pair-ai-demo-note')).toBe(AIT_TEXT['PAIR_AI.demo']);
    expect(textOf(tree, 'pair-ai-head-note')).toBe(AIT_TEXT['AIT.testNote']);
    expect(allTexts(tree).join('')).not.toMatch(/[%!]|점수|\d+점/);
  });

  test.each([
    ['auth', true, false],
    ['spend_limit', false, true],
    ['limit', false, true],
    ['unavailable', false, true],
    ['upstream', false, true],
    ['timeout', false, false],
    ['blocked_output', false, false],
    ['too_long', false, false],
    ['bad_request', false, false],
  ] as const)('오류 %s → 고정 글(서버 문장 안 씀) · 코드 칸 버튼 %s · 미리 쓴 글 안내 %s (ATF-24 · 25)', async (code, settings, fallback) => {
    await grant();
    const f = serve(err(code, { text: '서버가 보낸 문장 ' + code }));
    const tree = keep(await mount(<CompatAiBlock same={SAME} onSettings={jest.fn()} />));
    await press(tree, 'pair-ai-go');
    await flush();
    expect(textOf(tree, 'pair-ai-error-text')).toBe(AIT_TEXT[`AIT.code.${code}` as keyof typeof AIT_TEXT]);
    expect(allTexts(tree).join('')).not.toContain('서버가 보낸 문장');
    expect(has(tree, 'pair-ai-error-settings')).toBe(settings);
    expect(has(tree, 'pair-ai-error-fallback')).toBe(fallback);
    const noRetry = code === 'auth' || code === 'spend_limit' || code === 'limit';
    expect(has(tree, 'pair-ai-error-retry')).toBe(!noRetry);
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('rate 는 [다시 시도]가 잠깐 잠기고 남은 시간 글이 없다 · 닿지 못함(offline)은 unavailable 글', async () => {
    await grant();
    serve(err('rate', { retryAfterSec: 30 }));
    const tree = keep(await mount(<CompatAiBlock same={SAME} onSettings={jest.fn()} />));
    await press(tree, 'pair-ai-go');
    await flush();
    expect(textOf(tree, 'pair-ai-error-text')).toBe(AIT_TEXT['AIT.code.rate']);
    expect(must(tree, 'pair-ai-error-retry').props.disabled).toBe(true);
    expect(allTexts(tree).join('')).not.toMatch(/\d+\s*초/);
    global.fetch = jest.fn().mockRejectedValue(new TypeError('x')) as unknown as typeof fetch;
    const t2 = keep(await mount(<CompatAiBlock same={SAME} onSettings={jest.fn()} />));
    await press(t2, 'pair-ai-go');
    await flush();
    expect(textOf(t2, 'pair-ai-error-text')).toBe(AIT_TEXT['AIT.code.unavailable']);
  });
});

// ================================================================ 별자리 · 사주 풀이
describe('AIT-F ⑥ 별자리 · 사주 풀이 (카피 23-9 · ATF-28)', () => {
  test('코드 뽑기: 별자리 하나 + 일간 오행 · 두 별자리면 경계(AI 호출 0) · 모르는 값은 그리지 않음', () => {
    expect(horoscopeBody(['leo'], 0)).toEqual({ sun_sign: 'leo', day_element: 'wood' });
    expect(horoscopeBody(['leo'], 5)).toEqual({ sun_sign: 'leo', day_element: 'earth' });
    expect(horoscopeBody(['leo'], 9)).toEqual({ sun_sign: 'leo', day_element: 'water' });
    expect(horoscopeBody(['leo', 'virgo'], 3)).toBe('cusp');
    expect(horoscopeBody(['nope'], 3)).toBeNull();
    expect(horoscopeBody([], 3)).toBeNull();
  });

  test('경계 날은 STAR_AI.cusp 글만 · 단추 0 · 서버 요청 0', async () => {
    const f = serve();
    const tree = keep(await mount(<StarAiBlock signs={['leo', 'virgo']} stem={3} onSettings={jest.fn()} />));
    expect(textOf(tree, 'star-ai-cusp')).toBe(AIT_TEXT['STAR_AI.cusp']);
    expect(has(tree, 'star-ai-go')).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  test('보내는 것은 별자리 코드 + 오행 코드뿐(생년월일 꼴 0) → 풀이 두 편 · AI 표시 · 끝줄', async () => {
    await grant();
    const f = serve(ok({ star: '별자리 풀이 글이에요. 천천히 읽어 보세요.', saju: '사주 풀이 글이에요. 가볍게 읽어 보세요.', notes: [] }));
    const tree = keep(await mount(<StarAiBlock signs={['leo']} stem={2} onSettings={jest.fn()} />));
    await press(tree, 'star-ai-go');
    await flush();
    const s = sent(f);
    expect(s.url).toBe('/api/ai/horoscope');
    expect(s.body).toEqual({ feature: 'horoscope', sun_sign: 'leo', day_element: 'fire' });
    expect(s.init.body).not.toMatch(/\d{4}[-./]\d{2}/);
    expect(textOf(tree, 'star-ai-star-text')).toContain('별자리 풀이');
    expect(textOf(tree, 'star-ai-saju-text')).toContain('사주 풀이');
    expect(textOf(tree, 'star-ai-star-label')).toBe(AIT_TEXT['AIT.aiLabel']);
    expect(textOf(tree, 'star-ai-saju-label')).toBe(AIT_TEXT['AIT.aiLabel']);
    expect(textOf(tree, 'star-ai-footer')).toBe(AIT_TEXT['STAR_AI.footer']);
  });

  test('코드 없음 → 서버 요청 0 · 미리 쓴 글 안내', async () => {
    const f = serve();
    const tree = keep(await mount(<StarAiBlock signs={['leo']} stem={2} onSettings={jest.fn()} />));
    await press(tree, 'star-ai-go');
    await flush();
    expect(textOf(tree, 'star-ai-demo-note')).toBe(AIT_TEXT['AIT.demo.note']);
    expect(f).not.toHaveBeenCalled();
  });
});

// ================================================================ 문장 다듬기
describe('AIT-F ⑥ 문장 다듬기 (카피 23-8 · ATF-23 · 28)', () => {
  const OWN = '주말에는 주로 집에서 쉬거나 산책을 해요';
  const DISPLAY = { keep: '솔직한 말투는 그대로 살려 둬요.', findings: [{ quote: '주로 집에서', point: '어떤 모습인지 그림이 잘 안 그려져요.', ask: '요즘 집에서 가장 자주 하는 일은 무엇인가요?', options: ['주말에는 ○○을 하며 집에서 쉬어요'] }], notes: ['x'], autoApply: false };

  test('안내 글 · 칸 이름 · 글자 수 숫자 0 · 복사 · 공유 단추 0', async () => {
    const tree = keep(await mount(<CoachSheet visible onClose={jest.fn()} onSettings={jest.fn()} />));
    expect(textOf(tree, 'coach-lead')).toBe(AIT_TEXT['COACH.lead']);
    expect(textOf(tree, 'coach-fact')).toBe(AIT_TEXT['COACH.factNote']);
    expect(textOf(tree, 'coach-privacy-send')).toBe(AIT_TEXT['AIT.privacy.send']);
    expect(has(tree, 'coach-photo-note')).toBe(false);
    await press(tree, 'coach-field-photo_caption');
    expect(textOf(tree, 'coach-photo-note')).toBe(AIT_TEXT['COACH.photoNote']);
    const texts = allTexts(tree).join('|');
    expect(texts).not.toMatch(/복사|공유|보내기|내보내기/);
  });

  test('너무 짧으면 서버를 부르지 않고 COACH.tooShort', async () => {
    await grant();
    const f = serve();
    const tree = keep(await mount(<CoachSheet visible onClose={jest.fn()} onSettings={jest.fn()} />));
    await typeInto(tree, 'coach-text', '짧아요');
    await press(tree, 'coach-send');
    await flush();
    expect(textOf(tree, 'coach-text-error')).toBe(AIT_TEXT['COACH.tooShort']);
    expect(f).not.toHaveBeenCalled();
  });

  test('코드 없음 → 서버 요청 0 · 코드를 넣으면 AI가 새로 쓴 글로 보여 줘요(미리 쓴 글이 없는 기능)', async () => {
    const f = serve();
    const onSettings = jest.fn();
    const tree = keep(await mount(<CoachSheet visible onClose={jest.fn()} onSettings={onSettings} />));
    await typeInto(tree, 'coach-text', OWN);
    await press(tree, 'coach-send');
    await flush();
    expect(textOf(tree, 'coach-nocode-line')).toBe(AIT_TEXT['AIT_SET.rowLine']);
    expect(f).not.toHaveBeenCalled();
    await press(tree, 'coach-nocode-settings');
    expect(onSettings).toHaveBeenCalled();
  });

  test('보내는 것은 칸 이름 + 문구뿐 → 짚기 · 되묻기 · 고친 안, [입력칸에 넣기]는 눌러야만 바뀌고 자동 적용 0', async () => {
    await grant();
    const f = serve(ok(DISPLAY));
    const tree = keep(await mount(<CoachSheet visible onClose={jest.fn()} onSettings={jest.fn()} />));
    await typeInto(tree, 'coach-text', OWN);
    await press(tree, 'coach-send');
    await flush();
    expect(sent(f).body).toEqual({ feature: 'coach', field: 'intro', text: OWN });
    expect(textOf(tree, 'coach-label')).toBe(AIT_TEXT['AIT.aiLabel']);
    expect(textOf(tree, 'coach-note')).toBe(AIT_TEXT['COACH.note']);
    expect(must(tree, 'coach-text').props.value).toBe(OWN); // 아직 그대로
    expect(hasText(tree, AIT_TEXT['COACH.blank'])).toBe(true); // ○○ 가 있으면 안내
    await press(tree, 'coach-f0-o0-put');
    expect(must(tree, 'coach-text').props.value).toBe('주말에는 주말에는 ○○을 하며 집에서 쉬어요 쉬거나 산책을 해요');
    expect(textOf(tree, 'coach-put-done')).toBe(AIT_TEXT['COACH.putDone']);
  });

  test('applyOption: 짚은 조각이 있으면 그 자리만, 없으면 새 줄 · 빈 칸이면 그대로', () => {
    expect(applyOption('가 나 다', '나', '라')).toBe('가 라 다');
    expect(applyOption('가 나 다', '없음', '라')).toBe('가 나 다\n라');
    expect(applyOption('', '나', '라')).toBe('라');
  });

  test('위기 낱말은 고정 카드(위로 · 번호 · 안전 확인) — 짚기 0 · 단추는 마치기뿐', async () => {
    await grant();
    serve(card('crisis', ['서버 줄'], ['continue', 'end']));
    const tree = keep(await mount(<CoachSheet visible onClose={jest.fn()} onSettings={jest.fn()} />));
    await typeInto(tree, 'coach-text', '문구 문구 문구 문구');
    await press(tree, 'coach-send');
    await flush();
    expect(textOf(tree, 'coach-card-crisis-l2')).toBe(AIT_TEXT['CONCERN_CARD.crisis.l2']);
    expect(allTexts(tree)).not.toContain('서버 줄');
    expect(has(tree, 'coach-card-crisis-continue')).toBe(false);
    expect(has(tree, 'coach-card-crisis-end')).toBe(true);
  });
});

// ================================================================ 챗봇
describe('AIT-F ⑥ 연애 고민 정리 (카피 23-4 · 23-5 · ATF-12 ~ 15 · 20 ~ 22)', () => {
  const D1 = {
    stage: 'S1',
    progress: 1,
    sentences: [
      { kind: 'restate', text: '말씀하신 내용을 이렇게 이해했어요.', refs: [{ label: '내 말 1', type: 'user', quote: '답이 늦어져서' }], weak: false },
      { kind: 'trait', text: '말씀하신 행동으로는 신중한 쪽에 가까워 보여요.', refs: [{ label: 'K-12', type: 'card', cardId: 'K-12', citation: '출처 글 2020', limit: '한계 글', practical: true }], weak: true },
    ],
    notes: ['AI의 추측이에요. 상대의 마음은 상대만 알아요. 들려주신 이야기 안에서 본 해석이에요.', '모르는 서버 줄', '돈을 보내 달라는 이야기는 이유가 무엇이든 멈추고, 가까운 분이나 공식 기관과 먼저 상의해 보세요.'],
    chips: ['stage_before', 'stage_chat', 'unknown_chip'],
    ended: false,
  };
  const open = async () => {
    const tree = keep(await mount(<ConcernChat visible onClose={jest.fn()} onSettings={jest.fn()} />));
    await press(tree, 'concern-start');
    return tree;
  };

  test('첫 화면: 이름 · 상담 아님 · 캡처해 보내지 말기 · 끝줄 · 상시 번호 줄이 카피 그대로 (23-4-1)', async () => {
    const tree = keep(await mount(<ConcernChat visible onClose={jest.fn()} onSettings={jest.fn()} />));
    expect(textOf(tree, 'concern-not-counsel')).toBe(AIT_TEXT['CONCERN.intro.notCounsel']);
    expect(textOf(tree, 'concern-no-send')).toBe(AIT_TEXT['CONCERN.intro.noSend']);
    expect(textOf(tree, 'concern-footer')).toBe(AIT_TEXT['CONCERN.footer']);
    expect(textOf(tree, 'concern-always')).toBe(AIT_TEXT['CONCERN.always']);
    expect(textOf(tree, 'concern-head-note')).toBe(AIT_TEXT['AIT.testNote']);
  });

  test('입력 화면: 안내 · 칸 둘 + 호칭 칸 · 첫 질문 · 다섯 단계 이름(숫자 0) (23-4-2 · 23-4-3)', async () => {
    const tree = await open();
    expect(textOf(tree, 'concern-opening')).toBe(AIT_TEXT['CONCERN.opening']);
    expect(textOf(tree, 'concern-notice-name')).toBe(AIT_TEXT['CONCERN.notice.name']);
    expect(textOf(tree, 'concern-notice-image')).toBe(AIT_TEXT['CONCERN.notice.noImage']);
    expect(textOf(tree, 'concern-notice-partner')).toBe(AIT_TEXT['CONCERN.notice.partnerField']);
    expect(textOf(tree, 'concern-privacy-send')).toBe(AIT_TEXT['AIT.privacy.send']);
    expect(textOf(tree, 'concern-privacy-keep')).toBe(AIT_TEXT['AIT.privacy.keep']);
    expect(has(tree, 'concern-mine')).toBe(true);
    expect(has(tree, 'concern-partner')).toBe(true);
    expect(has(tree, 'concern-alias')).toBe(true);
    expect(must(tree, 'concern-mine').props.label).toBe(AIT_TEXT['CONCERN.field.mine.label']);
    expect(allTexts(tree)).toContain(AIT_TEXT['CONCERN.stage.s1.name']);
    expect(allTexts(tree).join('')).not.toMatch(/[1-5]\s*\/\s*5|단계\s*[1-5]|[1-5]\s*단계/);
  });

  test('빈 글은 서버 없이 안내 · 코드 없음이면 서버 요청 0', async () => {
    const f = serve();
    const tree = await open();
    await press(tree, 'concern-send');
    await flush();
    expect(textOf(tree, 'concern-mine-error')).toBe(AIT_TEXT['CONCERN.mine.empty']);
    await typeInto(tree, 'concern-mine', '요즘 상대의 답이 늦어져서 마음이 쓰여요');
    await press(tree, 'concern-send');
    await flush();
    expect(textOf(tree, 'concern-nocode-line')).toBe(AIT_TEXT['AIT_SET.rowLine']);
    expect(f).not.toHaveBeenCalled();
  });

  test('한 턴: 본문 키 · 서명 묶음 그대로 돌려보냄 · 답 글 · 근거 눌러 열기 · 약한 근거 · 고정 줄은 카피 글 · 모르는 줄은 안 보임', async () => {
    await grant(false);
    const BUNDLE = { payload: 'p-1', mac: 'm-1' };
    const f = serve(ok(D1, { bundle: BUNDLE }), ok({ ...D1, stage: 'S2', chips: ['unknown'], sentences: [], notes: [] }, { bundle: { payload: 'p-2', mac: 'm-2' } }));
    const tree = await open();
    await typeInto(tree, 'concern-mine', '요즘 상대의 답이 늦어져서 마음이 쓰여요');
    await typeInto(tree, 'concern-partner', '요즘 바빠서');
    await typeInto(tree, 'concern-alias', '그 사람');
    await press(tree, 'concern-send');
    await flush();
    // 동의 시트가 먼저
    expect(isOpen(tree, 'concern-consent')).toBe(true);
    expect(f).not.toHaveBeenCalled();
    await press(tree, 'concern-consent-check');
    await press(tree, 'concern-consent-confirm');
    await flush();
    const s = sent(f);
    expect(s.url).toBe('/api/ai/chat');
    expect(s.body).toEqual({ feature: 'chat', asker_text: '요즘 상대의 답이 늦어져서 마음이 쓰여요', partner_text: '요즘 바빠서', partner_alias: '그 사람' });
    // 내가 한 말은 말풍선으로, 답은 종이 칸으로
    expect(allTexts(tree)).toContain('말씀하신 행동으로는 신중한 쪽에 가까워 보여요.');
    expect(textOf(tree, 'concern-item-2-label')).toBe(AIT_TEXT['AIT.aiLabel']);
    expect(textOf(tree, 'concern-item-2-s1-0-weak')).toBe(AIT_TEXT['CONCERN.weak']);
    expect(textOf(tree, 'concern-item-2-note-CONCERN.guessNote')).toBe(AIT_TEXT['CONCERN.guessNote']);
    expect(textOf(tree, 'concern-item-2-note-CONCERN.money')).toBe(AIT_TEXT['CONCERN.money']);
    expect(allTexts(tree)).not.toContain('모르는 서버 줄');
    // 근거 번호를 눌러 연다
    await press(tree, 'concern-item-2-s1-0-ref-0');
    expect(allTexts(tree)).toContain(AIT_TEXT['CONCERN.ref.title']);
    expect(allTexts(tree)).toContain('출처 글 2020');
    expect(allTexts(tree)).toContain(AIT_TEXT['CONCERN.practical']);
    // 칩: 아는 것만 · 카피 글 · 누르면 chip 만 보내고 묶음은 그대로
    expect(has(tree, 'concern-chip-stage_before')).toBe(true);
    expect(has(tree, 'concern-chip-unknown_chip')).toBe(false);
    await press(tree, 'concern-chip-stage_before');
    await flush();
    const s2 = sent(f, 1);
    expect(s2.body.chip).toBe('stage_before');
    expect(s2.body.bundle).toEqual(BUNDLE);
    expect(s2.body.partner_alias).toBe('그 사람'); // 호칭은 매 턴
    expect(s2.body.asker_text).toBe('');
    expect(allTexts(tree)).toContain(AIT_TEXT['CONCERN.stage.s2.name']);
  });

  test('위기 카드: 말풍선에 그 글이 남지 않고 입력 칸이 비며, 카피 23-5 줄 그대로(서버 줄 안 씀) · 이어서 하기 · 마치기 (ATF-22)', async () => {
    await grant();
    serve(card('crisis', ['서버 줄 하나', '서버 줄 둘'], ['continue', 'end'], { bundle: { payload: 'p', mac: 'm' } }));
    const tree = await open();
    await typeInto(tree, 'concern-mine', '위기 낱말이 든 글 CANARY');
    await sendFirst(tree);
    for (const [i, k] of (['l1', 'l2', 'l3', 'l4'] as const).entries()) expect(textOf(tree, `concern-item-0-crisis-l${i + 1}`)).toBe(AIT_TEXT[`CONCERN_CARD.crisis.${k}`]);
    expect(allTexts(tree).join('')).not.toContain('CANARY');
    expect(allTexts(tree).join('')).not.toContain('서버 줄');
    expect(must(tree, 'concern-mine').props.value).toBe('');
    expect(allTexts(tree)).toContain(AIT_TEXT['CONCERN_CARD.option.continue']);
    await press(tree, 'concern-item-0-crisis-continue');
    expect(has(tree, 'concern-item-0-crisis-continue')).toBe(false);
    expect(has(tree, 'concern-mine')).toBe(true);
    expect(allTexts(tree)).not.toContain('CONCERN.footer');
    expect(textOf(tree, 'concern-footer')).toBe(AIT_TEXT['CONCERN.footer']); // 상시 줄은 접힘 밖에 그대로
    expect(textOf(tree, 'concern-always')).toBe(AIT_TEXT['CONCERN.always']);
  });

  test('폭력 카드 · 미성년 카드(입력 칸 닫힘 · 1388은 이 카드에만)', async () => {
    await grant();
    serve(card('violence', ['x'], ['continue', 'end']), card('minor', ['y'], ['end']));
    const tree = await open();
    await typeInto(tree, 'concern-mine', '글 하나');
    await sendFirst(tree);
    expect(textOf(tree, 'concern-item-0-violence-l2')).toBe(AIT_TEXT['CONCERN_CARD.violence.l2']);
    expect(allTexts(tree).join('')).not.toContain('1388');
    await typeInto(tree, 'concern-mine', '글 둘');
    await press(tree, 'concern-send');
    await flush();
    expect(textOf(tree, 'concern-item-1-minor-l2')).toBe(AIT_TEXT['CONCERN_CARD.minor.l2']);
    expect(allTexts(tree)).toContain(AIT_TEXT['CONCERN_CARD.minor.end']);
    expect(has(tree, 'concern-mine')).toBe(false); // 미성년 카드 뒤에는 입력 칸이 없다
  });

  test('마음 힘듦 칩(state_4)은 위로 한 줄 + 번호 줄을 바로 보인다 · 진단 말 0 (23-4-4)', async () => {
    await grant();
    serve(ok({ ...D1, stage: 'S4', chips: ['state_4'], notes: [] }), ok({ ...D1, stage: 'S4', chips: [], notes: [] }));
    const tree = await open();
    await typeInto(tree, 'concern-mine', '글 하나');
    await sendFirst(tree);
    await press(tree, 'concern-chip-state_4');
    await flush();
    const all = allTexts(tree);
    expect(all).toContain(AIT_TEXT['CONCERN_CARD.soft.l1']);
    expect(all).toContain(AIT_TEXT['CONCERN_CARD.crisis.l2']);
  });

  test('오류: 코드 틀림은 코드 칸으로 · 검사 탈락은 같은 글 다시 보내기(입력 유지) · 서버 문장 안 씀', async () => {
    await grant();
    serve(err('blocked_output', { bundle: { payload: 'p', mac: 'm' }, text: '서버 문장' }));
    const tree = await open();
    await typeInto(tree, 'concern-mine', '글 하나');
    await sendFirst(tree);
    expect(textOf(tree, 'concern-error-text')).toBe(AIT_TEXT['AIT.code.blocked_output']);
    expect(must(tree, 'concern-mine').props.value).toBe('글 하나');
    expect(allTexts(tree)).not.toContain('서버 문장');
    expect(has(tree, 'concern-error-retry')).toBe(true);
  });

  test("끝: '충분해요'로 끝나면 끝 화면(제목 · 본문 · 새로 시작 · 닫기 · 지우기) · 남은 횟수 숫자 0 (23-4-6)", async () => {
    await grant();
    const onClose = jest.fn();
    serve(ok({ ...D1, stage: 'S5', chips: ['enough'], notes: [] }), ok({ stage: 'S5', progress: 5, sentences: [], notes: [], chips: [], ended: true }));
    const tree = keep(await mount(<ConcernChat visible onClose={onClose} onSettings={jest.fn()} />));
    await press(tree, 'concern-start');
    await typeInto(tree, 'concern-mine', '글 하나');
    await sendFirst(tree);
    await press(tree, 'concern-chip-enough');
    await flush();
    expect(textOf(tree, 'concern-end-title')).toBe(AIT_TEXT['CONCERN.end.title']);
    expect(textOf(tree, 'concern-end-body')).toBe(AIT_TEXT['CONCERN.end.body']);
    expect(textOf(tree, 'concern-end-no-send')).toBe(AIT_TEXT['CONCERN.intro.noSend']);
    expect(textOf(tree, 'concern-footer')).toBe(AIT_TEXT['CONCERN.footer']);
    expect(allTexts(tree).join('')).not.toMatch(/남은|\d+\s*번|\d+\s*회/);
    await press(tree, 'concern-delete');
    await press(tree, 'concern-delete-dialog-confirm');
    expect(onClose).toHaveBeenCalled();
  });

  test('noteKeys: 아는 서버 고정 줄만 카피 글로 바꾼다', () => {
    expect(noteKeys(['AI의 추측이에요. 어쩌고', '이 설명은 일반적인 연구 개념이에요. 지금 상황의…', '모름'])).toEqual(['CONCERN.guessNote', 'CONCERN.cardNote']);
  });
});

// ================================================================ 글 · 정적 점검
describe('AIT-F 글 · 화면 정적 점검 (ATF-12 · 13 · 16 ~ 19 · 21 · 23 · 29)', () => {
  const dir = path.resolve(__dirname, '..', 'features', 'ait');
  const files = fs.readdirSync(dir).filter((n) => /\.(ts|tsx)$/.test(n));
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  test('ait(): {자리} 채움 · 카피 사본과 같은 글', () => {
    expect(ait('CONCERN.stage.a11y', { '단계 이름': '일어난 일 정리' })).toBe('일어난 일 정리 단계');
    expect(ait('AIT.badge')).toBe('시험판');
    expect(Object.keys(AIT_TEXT)).toHaveLength(189);
  });

  test('채팅 · 가입 필수 AI와 분리: ait 화면 코드가 features/chat · chatApi · supabase · 채팅 표 · functions.invoke 를 가져오지 않는다 (ATF-16 ~ 19)', () => {
    for (const f of files) {
      const t = strip(fs.readFileSync(path.join(dir, f), 'utf8'));
      expect(t).not.toMatch(/features\/chat|chatApi|chatService|chatDemo|supabase|chat_|functions\.invoke|ai-profile|aiApi|useSignupStore/);
    }
  });

  test('채팅 쪽 현재 상태 고정: features/chat 에 AI 경로 · AIT 이름 0 · chatApi 가 부르는 서버 함수는 chat-media · photo 뿐 (ATF-17)', () => {
    const chatDir = path.resolve(__dirname, '..', 'features', 'chat');
    for (const f of fs.readdirSync(chatDir).filter((n) => /\.(ts|tsx)$/.test(n))) expect(strip(fs.readFileSync(path.join(chatDir, f), 'utf8'))).not.toMatch(/\/api\/ai|features\/ait|aitClient|aitStore|x-ait-code/);
    const names = [...fs.readFileSync(path.join(chatDir, 'chatApi.ts'), 'utf8').matchAll(/functions\.invoke\('([a-z-]+)'/g)].map((m) => m[1]).sort();
    expect([...new Set(names)]).toEqual(['chat-media', 'photo']);
  });

  test('가입 필수 AI(설문 · 인터뷰 · 프로필 정리 · 어필 분석)는 AIT 코드 · 경로를 참조하지 않는다 (ATF-19 반대쪽)', () => {
    const feat = path.resolve(__dirname, '..', 'features');
    const lib = path.resolve(__dirname, '..', 'lib');
    const dirs = ['ai', 'surveyChat', 'surveyV2', 'surveyLite', 'onboarding', 'photosLite'].map((d) => path.join(feat, d));
    const files = [...dirs.flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d).map((n) => path.join(d, n)) : [])), path.join(lib, 'aiApi.ts')].filter((f) => /\.(ts|tsx)$/.test(f));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) expect(strip(fs.readFileSync(f, 'utf8'))).not.toMatch(/features\/ait|\/api\/ai|aitClient|aitStore|x-ait-code|\bAIT_/);
  });

  test('요청에 상대 정보 필드 0 — 방 id · 회원 id · 프로필 · 설문 답 · 읽음 · 답장 시간을 인자로 받지 않는다 (ATF-18)', () => {
    const t = strip(fs.readFileSync(path.join(dir, 'aitClient.ts'), 'utf8'));
    expect(t).not.toMatch(/roomId|room_id|userId|user_id|profile|answers|readAt|replyTime/);
  });

  test('공유 · 복사 · 내보내기 · 딥링크 · 마크다운 해석 0 — 결과는 글자로만 (ATF-12 · 23)', () => {
    for (const f of files) {
      const t = strip(fs.readFileSync(path.join(dir, f), 'utf8'));
      expect(t).not.toMatch(/Clipboard|Share\.share|expo-sharing|Linking|dangerouslySetInnerHTML|react-native-markdown|openURL|Markdown/);
    }
  });

  test('화면 글에 느낌표 · 재촉 · 카운트다운 · 등급 말이 없다 (카피 23-10 점검과 같은 뜻)', () => {
    const bad = /!|서두르|지금 바로|마감|오늘만|한정|남은 횟수|카운트/;
    const allowed = new Set(['CONCERN.always', 'CONCERN_CARD.crisis.l3', 'CONCERN_CARD.violence.l3', 'CONCERN_CARD.body.l1']); // 법무 17-2 확정(급한 위험 안내 — 재촉 말이 아님)
    for (const [k, v] of Object.entries(AIT_TEXT)) if (!allowed.has(k)) expect([k, bad.test(v)]).toEqual([k, false]);
  });
});
