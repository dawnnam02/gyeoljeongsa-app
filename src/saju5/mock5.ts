// IF5-A · 모의 업체 응답. 사실 묶음(facts)에서 검사기를 통과하는 고정 꼴 글을 만든다.
// 목적: 서버 함수 · 검사기를 실호출 없이 끝까지 돌려 보기(글 품질을 재는 용도가 아님). 단어는 사실에서 가져온다.

import type { Feature5 } from './spec5.ts';

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function asResult(obj: unknown): { stop_reason: 'end_turn'; content: unknown[]; usage: { input_tokens: number; output_tokens: number } } {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 0, output_tokens: 0 } };
}

const dayGanji = (f: Rec): string => (f.pillars as Array<{ pos: string; ganji: string }>).find((p) => p.pos === '일주')!.ganji;

export function mockOutput5(feature: Feature5, facts: Rec): Rec {
  switch (feature) {
    case 'reading': {
      const dm = facts.day_master as Rec;
      const lack = (facts.elements.lacking as string[])[0];
      return {
        headline: `${dm.element}의 결을 가진 나의 이야기`,
        sections: [
          { title: '기본 결', body: `나를 나타내는 기운은 ${dm.element}의 ${dm.polarity}이에요. 일주는 ${dayGanji(facts)}로 읽혀요.` },
          { title: '오행의 균형', body: lack ? `${lack}의 기운은 아직 채워 갈 자리가 있어요. 그래서 새로 배우는 일이 힘이 되기 쉬워요.` : '여러 기운이 고르게 있어서 균형을 잡기 쉬운 편이에요. 한쪽으로 쏠리지 않게 쉬어 가며 살펴봐요.' },
          { title: '사람과 관계', body: '가까운 사람과는 천천히 마음을 여는 흐름이에요. 한 번 신뢰하면 오래 곁을 지키는 편이에요.' },
          { title: '일과 배움', body: '맡은 일을 차근차근 쌓아 가는 결이에요. 작은 성취를 기록해 두면 힘이 돼요.' },
        ],
        closing: '나의 결을 알고 나면 선택이 조금 더 편해져요. 오늘은 그 결을 따라 작은 한 걸음을 떼어 봐요.',
      };
    }
    case 'compat': {
      const ea = facts.a.day_master.element as string;
      const eb = facts.b.day_master.element as string;
      return {
        headline: `${ea}의 결과 ${eb}의 결이 만나요`,
        summary: '두 사람은 서로 다른 결을 가져서 배울 점이 많아 보여요.',
        sections: [
          { title: '서로의 기본 결', body: `나는 ${ea}의 결이고 상대는 ${eb}의 결이에요. 서로의 속도가 달라서 이야기할 거리가 많아요.` },
          { title: '채워 주는 기운', body: '한쪽에 적은 기운을 다른 쪽이 넉넉히 갖고 있을 때 서로 기대기 쉬워요. 그럴 땐 고맙다고 말로 건네 봐요.' },
          { title: '함께 있을 때', body: '둘이 있으면 서로 자극이 되는 지점도 있어요. 속도를 맞추면 편안해져요.' },
        ],
        tips: ['이번 주에 서로 좋아하는 것을 한 가지씩 알려 줘 봐요.', '대화가 길어질 땐 잠깐 쉬어 가며 이야기해 봐요.'],
      };
    }
    case 'daewoon': {
      const items = (facts.items as Rec[]).slice(0, 3);
      return {
        overview: '대운은 십 년 단위로 바뀌는 큰 흐름이에요. 지금 시기를 알면 힘을 어디에 쓸지 가늠하기 쉬워요.',
        periods: items.map((it, i) => ({
          ganji: it.ganji, ages: `만 ${it.start_age_years}세부터`, theme: ['준비하는 시기', '자리 잡는 시기', '넓혀 가는 시기'][i],
          body: `${it.stem_sipsung}의 기운이 들어오는 시기예요. ${it.stem_element}의 결이 힘을 받아요.`,
        })),
        now: '지금은 하던 일을 다지기에 좋은 때예요. 작은 목표를 하나 정해 봐요.',
      };
    }
    case 'sinyeon': {
      const w = facts.wolun as Rec[];
      return {
        headline: `${facts.year}년 한 해의 흐름`.replace(/^/, ''),
        flow: `올해는 ${facts.seun.stem_sipsung}의 기운이 중심에 서는 흐름이에요. 차분히 쌓으면 결실이 보이기 쉬워요.`,
        months: w.map((m) => ({ month: `${Number(String(m.starts).slice(5, 7))}월`, body: `${m.stem_sipsung}의 기운이 들어와요. 이번 달은 작은 일 하나를 끝맺어 봐요.` })),
        keep: '올해는 꾸준히 기록하는 습관을 붙들어 봐요.',
      };
    }
    case 'wolun':
      return {
        headline: '이번 달은 차분히 다지는 달이에요',
        body: `이번 달은 ${facts.month.stem_sipsung}의 기운이 들어와요. 하던 일을 정리하며 방향을 잡기 좋아요.`,
        do: ['하고 싶은 일을 한 줄로 적어 봐요.', '가까운 사람에게 안부를 건네 봐요.'],
        ease: ['무리해서 일정을 늘리지 않아도 좋아요.'],
      };
    case 'daily':
      return {
        headline: '천천히 걸어도 괜찮은 하루',
        body: `오늘은 ${facts.iljin.stem_sipsung}의 기운이 중심이에요. 서두르지 않고 하나씩 하면 마음이 편해요.`,
        small_step: '점심 뒤에 십 분만 자리를 비우고 걸어 봐요.'.replace('십 분', '짧게'),
      };
    case 'taekil': {
      const days = facts.days as Array<{ date: string; tone: string }>;
      const good = days.filter((d) => d.tone === 'good').slice(0, 2);
      const pick = good.length ? good : days.filter((d) => d.tone !== 'rest').slice(0, 1);
      return {
        intro: '전통 달력의 한 가지 방식으로 본 참고예요. 아래 날이 비교적 어울려요.',
        picks: pick.map((d) => ({ date: d.date, why: '이 날은 일을 새로 시작하기에 어울리는 흐름이에요.' })),
        rest: days.some((d) => d.tone === 'rest') ? '쉬어 가는 날로 나온 날은 다른 날을 권해요.' : '',
        tip: '날짜를 정하기 전에 두 분의 일정을 먼저 맞춰 봐요.',
      };
    }
    case 'chat':
      return { reply: '물어봐 주셔서 고마워요. 사실에 있는 흐름으로 보면 차분히 쌓아 가는 결이에요.', ask: '요즘 가장 마음이 쓰이는 일이 있나요?', flags: [] };
    case 'summary':
      return { summary: '사용자는 자신의 흐름을 알고 싶어 했어요. 차분히 쌓아 가는 결이라는 이야기를 나눴어요. 작은 목표를 정해 보기로 했어요.' };
  }
}
