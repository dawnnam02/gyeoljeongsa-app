// AIT-A · 모의 업체 응답(AIT_MODE=mock · 단위 시험용). 업체를 부르지 않고, 검사기를 통과하는 고정 꼴 글을 만든다.
// 목적: 서버 함수와 상태 기계를 실호출 없이 끝까지 돌려 보기. 글 품질을 재는 용도가 아니다.

import type { CallSpec } from './chat.ts';
import type { EvidenceCard } from './cards.ts';
import { quoteInSource } from './text.ts';
import { COMPAT_DICT, SIGN_CODES, ELEMENT_CODES } from './features.ts';
import type { CompatInput } from './features.ts';

const VARIANTS: Readonly<Record<string, readonly string[]>> = {
  restate: ['말씀하신 내용을 이렇게 이해했어요.', '그 일이 마음에 계속 남으셨군요.'],
  problem_line: ['지금 가장 마음에 걸리는 점은 말씀하신 그 상황이라고 정리해 봤어요.'],
  summary: ['지금까지 들은 이야기를 이렇게 정리해 봤어요.'],
  trait: ['말씀하신 대목을 보면 상대는 감정을 천천히 표현하는 성향으로 보여요.', '말씀하신 행동으로는 거리를 두며 생각을 정리하는 쪽에 가까워 보여요.', '말씀하신 모습은 신중하게 반응하는 성향으로 보여요.'],
  trait_weak: ['근거가 약하지만 상대는 신중한 쪽에 가까워 보여요.', '말씀하신 대목만 보면 상대는 조용히 지켜보는 성향으로 보여요.', '확실하지 않지만 상대는 속도를 천천히 맞추는 쪽에 가까워 보여요.'],
  reason: ['그 행동은 바쁜 상황이 겹친 탓일 수 있어요.'],
  counter: ['반대로 단순히 여유가 없었을 수도 있어요.'],
  check: ['직접 편하게 물어보거나 며칠 지켜보는 방법이 있어요.'],
  direction: ['이번 주에는 하고 싶은 말을 한 문장으로 적어 보는 쪽이 부담이 적어 보여요.'],
  because: ['말씀하신 상황을 보면 서로 확인하지 못한 부분이 커 보여요.', '마음의 정도를 보면 먼저 이야기를 나누는 쪽이 부담이 적어 보여요.', '말씀하신 바람과 가장 가깝게 이어지는 길이라서 그렇게 보여요.'],
  option: ['직접 물어보면 속마음을 알 수 있지만 상대가 부담스러워할 수도 있어요.', '시간을 두고 지켜보면 마음이 가라앉지만 답답함이 길어질 수 있어요.', '내가 원하는 것을 먼저 적어 보면 정리가 되지만 말로 옮기기는 쉽지 않을 수 있어요.'],
  first_action: ['이번 주에 하고 싶은 말을 한 문장으로 먼저 적어 보세요.'],
  change_if: ['상대가 거리를 두고 싶다고 직접 말한다면 방향이 달라질 수 있어요.'],
  question: ['이 정리가 지금 마음과 비슷한가요?'],
};

function pickQuote(text: string): string {
  const t = text.trim();
  for (const cand of [t.slice(0, 16), t.slice(0, 8), t.slice(0, 4)]) {
    if (cand.replace(/[^0-9A-Za-z가-힣]/g, '').length >= 2) return cand.trim();
  }
  return t.slice(0, 2);
}

/** 챗봇 모의 응답(JSON 객체). plan의 min 개수를 맞춰 쓴다 */
export function mockChatOutput(call: CallSpec, cards: ReadonlyMap<string, EvidenceCard>, opts: { useCard?: boolean } = {}): Record<string, unknown> {
  const useCard = opts.useCard !== false;
  const stage = call.stage;
  const src = call.newTexts.asker || call.newTexts.partner;
  const q = pickQuote(src);
  const card = [...cards.values()].find((c) => c.use_in.includes(stage) && (!c.safety_only || call.stateAfterResolve.safety));
  const sentences: Array<Record<string, unknown>> = [];
  for (const item of call.plan.items) {
    const kind = item.kinds[0];
    for (let i = 0; i < item.min; i++) {
      const ref = [`내 말 ${call.userN}`];
      const quotes = [{ n: call.userN, q }];
      let text: string;
      let k = kind;
      let strength = '-';
      if (kind === 'trait') {
        const weak = !(useCard && card);
        text = (VARIANTS[weak ? 'trait_weak' : 'trait'] as readonly string[])[i % 3];
        strength = weak ? '약함' : '보통';
      } else {
        const list = VARIANTS[kind] as readonly string[];
        text = list[i % list.length];
      }
      if (kind === 'restate' && i === 0 && call.diagnosisAsked) text = '진단은 할 수 없어요. 말씀하신 행동으로 보면 신중한 쪽에 가까워 보여요.';
      if (kind === 'question') sentences.push({ kind: k, text, strength: '-', refs: [], quotes: [] });
      else {
        const refs = [...ref];
        if (useCard && card && (kind === 'trait' || kind === 'because')) refs.push(card.id);
        sentences.push({ kind: k, text, strength, refs, quotes });
      }
    }
  }
  const second = (src.trim().slice(-8).trim() || q);
  const slots = {
    fact: q, my_reading: '', wish: q, problem_line: '', other_obs: [q, second], my_guess: q, context: '', traits: [], my_need: q, my_line: '', deadline: '',
  };
  return { stage, sentences, slots, flags: [] };
}

/** 업체 응답 모양으로 감싼다 */
export function asApiResult(obj: unknown, stopReason: string | null = 'end_turn'): { stop_reason: string | null; content: unknown[] } {
  return { stop_reason: stopReason, content: [{ type: 'text', text: JSON.stringify(obj) }] };
}

export function mockCompatOutput(input: CompatInput): Record<string, unknown> {
  const first = input.shared[0];
  const label = COMPAT_DICT[first.k].values[first.v];
  return { same_line: `두 분 다 ${label}에 관심이 있어요.`, topics: [`${label}에서 가장 기억에 남는 일은 무엇이에요?`, `${label} 이야기를 하면 어떤 점이 가장 즐거워요?`] };
}

const SIGN_KO: Readonly<Record<string, string>> = {
  aquarius: '물병자리', pisces: '물고기자리', aries: '양자리', taurus: '황소자리', gemini: '쌍둥이자리', cancer: '게자리',
  leo: '사자자리', virgo: '처녀자리', libra: '천칭자리', scorpio: '전갈자리', sagittarius: '사수자리', capricorn: '염소자리',
};
const ELEM_KO: Readonly<Record<string, string>> = { wood: '나무', fire: '불', earth: '흙', metal: '쇠', water: '물' };

export function mockHoroscopeOutput(input: { sun_sign: string; day_element: string }): Record<string, unknown> {
  const s = SIGN_KO[input.sun_sign];
  const e = ELEM_KO[input.day_element];
  return {
    star: `${s}는 자기만의 방식으로 생각을 넓혀 가는 이미지라고 해요. 새로운 것에 호기심을 갖고 천천히 다가가는 쪽이래요.`,
    saju: `${e} 기운은 자기만의 결로 자라나는 힘을 상징한다고 해요. 서두르지 않고 제 속도를 지키는 이미지예요.`,
  };
}

export function mockCoachOutput(input: { field: string; text: string }): Record<string, unknown> {
  const t = input.text.trim();
  if (t.length < 14) return { keep: '쓰신 글의 첫 문장은 그대로 살려도 좋아 보여요.', findings: [] };
  const quote = t.slice(0, 12).trim();
  if (!quoteInSource(quote, t)) return { keep: '', findings: [] };
  return {
    keep: '쓰신 글의 첫 문장은 그대로 살려도 좋아 보여요.',
    findings: [{
      quote,
      point: '읽는 분은 어떤 모습인지 떠올리기 어려울 수 있어요.',
      ask: '그 부분에서 가장 기억에 남는 경험은 무엇이에요?',
      options: [`${quote}, 예를 들면 ○○`],
    }],
  };
}

export { SIGN_CODES, ELEMENT_CODES };
