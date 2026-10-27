// 정식 설문 v2(F20) 웹 점검 도우미: 지금 화면(시작 안내 또는 문항)에서 필수 흐름을 끝까지 답하고, 결혼 이야기 · 세부사항은 건너뛰어 검토 화면까지 간다.
//  W8: 흐름 끝의 정치성향 단계는 politics='answer'(기본: CK15 체크 → 막대 가운데 누름 → [다음]) 또는 'later'([나중에 할게요])
//  web-f2l(05 사진 앞 길) 등 v2 를 지나가야 하는 점검이 쓴다. 답은 남성 · 대학교 · 대기업 · 희망 조건 대부분 '상관없어요'(F03 만 활성).
//  b = lib/browser.mjs 의 openBrowser 결과. 반환: { ok, answered, stage }
import { sleep } from './browser.mjs';

const CHOICE = {
  A02: 'male', A06: 'none', A07: 'never', A08: 'none', A11: 'done', B01: 'univ', B06: 'grad', B07: 'no', B04: 'none', C01: 'large', C03: 'staff', C04: 'regular',
  C05: 'inc06', C06: 'ast04', D04: 'pas03', D05: '1', D06: 'first', A09: 'no', A10: 'rare', E12: 'morning', E10: 'talk_now', E01: 'y1', E02: 'yes', E06: 'seoul', E07: 'joint',
  F03: 'univ', F14: 'any', F15: 'any', F16: 'any', F05: 'any',
};
const TEXT = {
  A12: '김하나', B03: '경영학', C02: '한빛전자', T01: '조용한 주말을 좋아하고 산책을 자주 하는 편이에요.', T02: '평일 저녁에는 같이 밥을 먹고 주말에는 함께 걷고 싶어요.', T03: '서로를 존중하는 마음이에요.',
};

export async function fillSurveyV2(b, { log = () => undefined, politics = 'answer' } = {}) {
  const q = (id) => `window.__q(${JSON.stringify(id)})`;
  const tap = async (id) => {
    await b.click(`[data-testid="${id}"]`);
    await sleep(150);
  };
  const type = async (id, value) => {
    await b.type(`[data-testid="${id}"]`, value);
    await sleep(150);
  };
  const currentId = () =>
    b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid^="v2-block-"]')].find((e) => window.__visible(e)); return el ? el.getAttribute('data-testid').slice(9) : null; })()`);
  const stage = () => b.evaluate(`['v2-intro','v2-politics','v2-story','v2-appeal','v2-review'].find((id) => !!window.__q(id)) ?? 'flow'`);

  if (!(await b.waitFor(`!!${q('v2-screen')} && !${q('v2-loading')}`, 10000))) return { ok: false, answered: 0, stage: 'none' };
  if ((await stage()) === 'v2-intro') await tap('v2-start');
  let answered = 0;
  for (let guard = 0; guard < 90 && (await stage()) === 'flow'; guard += 1) {
    const id = await currentId();
    if (!id) {
      await sleep(200);
      continue;
    }
    const moved = () => b.waitFor(`!${q(`v2-block-${id}`)}`, 1500);
    let done = false;
    if (id === 'A06' && (await b.evaluate(`!!${q('chat-card-REL')}`))) {
      // 3부-사: CK4 가 없으면 A06 자리에 종교 동의 카드(체크 + [동의하고 답할게요]) → 보기
      await tap('chat-rel-check');
      await tap('chat-rel-agree');
      await b.waitFor(`!!${q('v2-A06-opt-none')}`, 4000);
    }
    if (CHOICE[id]) {
      await tap(`v2-${id}-opt-${CHOICE[id]}`);
      done = await moved();
    } else if (TEXT[id]) await type(`v2-${id}-input`, TEXT[id]);
    else if (id === 'A05') await type('v2-A05-input', '172');
    else if (id === 'A03') {
      await tap('v2-A03-sido-seoul');
      await tap('v2-A03-sigungu-22');
    } else if (id === 'B02' || id === 'B05') {
      await type(`v2-${id}-search`, '연대');
      await b.waitFor(`!!${q(`v2-${id}-hit-0`)}`, 5000);
      await tap(`v2-${id}-hit-0`);
    } else if (id === 'D08' || id === 'D09') await tap(`v2-${id}-opt-unknown`);
    else if (id === 'E11') await tap('v2-E11-opt-travel');
    else if (/^E(0[3-5]|0[89]|1[4-6])$|^F11$/.test(id)) {
      await tap(`v2-${id}-opt-3`);
      done = await moved();
    } else if (id === 'E13') await tap('v2-E13-keep');
    else if (id === 'F01' || id === 'F02') await tap(`v2-${id}-any`);
    else if (['F04', 'F06', 'F07', 'F08', 'F09', 'F10'].includes(id)) await tap(`v2-${id}-opt-any`);
    else if (id === 'F13') await tap('v2-F13-opt-F03');
    if (!done) {
      await tap('v2-next');
      await moved();
    }
    answered += 1;
    log(id);
  }
  if (await b.waitFor(`!!${q('v2-politics')}`, 4000)) {
    if (politics === 'answer') {
      await tap('v2-pol-check');
      await tap('v2-pol-slider-track');
    }
    await tap(politics === 'answer' ? 'v2-next' : 'v2-pol-later');
    log('politics');
  }
  // 결혼 이야기 · 세부사항은 [건너뛰기]
  for (const s of ['v2-story', 'v2-appeal']) {
    if (await b.waitFor(`!!${q(s)}`, 4000)) await tap('v2-skip');
  }
  const ok = await b.waitFor(`!!${q('v2-review')}`, 5000);
  return { ok, answered, stage: await stage() };
}
