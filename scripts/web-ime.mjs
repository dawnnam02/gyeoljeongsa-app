// F23 웹 점검: 한글 입력(IME) — 브라우저 입력기 흉내(CDP Input.imeSetComposition · insertText)로 글 칸마다 한글을 조합해 넣고,
//  화면 칸의 글 = 입력한 글인지 본다(청사진 v4 10-5 P10). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  조합 방식 두 가지: 음절마다 확정(윈도 · 맥 입력기) · 단어 통째 조합(안드로이드 Gboard 식). 폰처럼 느린 기기를 흉내 내려고 CPU 를 IME_CPU 배(기본 4) 늦춘다.
//   1. 설문 v2 이름(A12): '김민지' 두 방식 · 조합 단계마다 칸 글 = 조합 글 · [다음] 뒤 저장 값 '김민지'
//   2. 설문 v2 학교 검색(B02): '서울대학교' → 칸 글 그대로 · 첫 결과 서울대학교
//   3. 설문 v2 세부사항(T04, 최대 200): 197자 + '김민지' → 조합 중 자르지 않음 · 끝난 뒤 200자 · 한 글자 더 조합하면 조합 중에는 보이고 끝난 뒤 200자로(자모 찌꺼기 0)
//   4. 설문 v2 결혼 이야기(Q17): '명절에는 양가를 번갈아 가요' 조합 · 저장
//   5. 07 내 성향: 요약 고치기(여러 줄) · 태그 더하기 칸
//   6. 10 신고 사유 설명 칸
//  끝으로 콘솔 오류 0 · 바깥 요청 0. 캡처: 확인/스크린샷/[SHOT_SUBDIR]/F23_*.png · 폭 SHOT_WIDTH(기본 390)
// 사용: SHOT_WIDTH=360 SHOT_SUBDIR=F23_360 node scripts/web-ime.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';
import { fillSurveyV2 } from './lib/surveyV2Driver.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷', process.env.SHOT_SUBDIR ?? '');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const cpu = Number(process.env.IME_CPU ?? 4);

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log(`[미확인] ${path.relative(APP_DIR, distDir)}/index.html 이 없어요. 먼저 npm run check:web:demo 를 하세요.`);
  process.exit(2);
}
if (!findBrowser()) {
  console.log('[미확인] Edge 또는 Chrome 을 찾지 못했어요. BROWSER_PATH 에 실행 파일 경로를 주면 돼요.');
  process.exit(2);
}

const results = [];
function check(group, title, ok, detail = '') {
  results.push({ group, title, ok });
  console.log(`[${ok ? '통과' : '실패'}] ${group}. ${title}${detail ? ` — ${detail}` : ''}`);
}

// 한글 → 조합 단계(초성 → 초성+중성 → 받침까지). 글자가 아니면 그대로 한 단계
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function stepsOf(ch) {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return [ch];
  const cho = Math.floor(code / 588);
  const jung = Math.floor((code % 588) / 28);
  const jong = code % 28;
  const open = String.fromCharCode(0xac00 + cho * 588 + jung * 28);
  return jong ? [CHO[cho], open, ch] : [CHO[cho], ch];
}

const b = await openBrowser({ distDir, shotDir, width, height: 800 });
const shot = async (name) => {
  const file = `F23_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${process.env.SHOT_SUBDIR ? `${process.env.SHOT_SUBDIR}/` : ''}${file}`);
};
const S = (id) => `[data-testid="${id}"]`;
const q = (id) => `window.__q(${JSON.stringify(id)})`;
const domVal = (id) => b.evaluate(`(() => { const el = [...document.querySelectorAll('${S(id)}')].find((e) => window.__visible(e)) ?? document.querySelector('${S(id)}'); return el ? el.value : null; })()`);
const tap = async (id) => {
  await b.click(S(id));
  await sleep(150);
};
const focus = (id) => b.evaluate(`(() => { const el = [...document.querySelectorAll('${S(id)}')].find((e) => window.__visible(e)); el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); return true; })()`);
// 입력기 없이 글을 통째로 넣는다(조합 시험 앞 준비 · 지우기)
const setRaw = async (id, text) => {
  await b.evaluate(`(() => { const el = [...document.querySelectorAll('${S(id)}')].find((e) => window.__visible(e)); el.focus(); const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set; set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.setSelectionRange?.(el.value.length, el.value.length); })()`);
  await sleep(200);
};
const throttle = (rate) => b.cdp.send('Emulation.setCPUThrottlingRate', { rate }).catch(() => undefined);

// 조합해서 넣기. mode = syllable(음절마다 확정) | word(단어 통째 조합). 조합 단계마다 칸 글을 기록해 '앞 글 + 조합 글'과 같은지 본다
async function compose(id, text, mode = 'syllable') {
  await focus(id);
  const before = (await domVal(id)) ?? '';
  const bad = [];
  await throttle(cpu);
  let acc = '';
  for (const ch of text) {
    for (const st of stepsOf(ch)) {
      const comp = mode === 'word' ? acc + st : st;
      await b.cdp.send('Input.imeSetComposition', { text: comp, selectionStart: comp.length, selectionEnd: comp.length });
      await sleep(20);
      const now = await domVal(id);
      const want = before + (mode === 'word' ? comp : acc + st);
      if (now !== want) bad.push(`${st}: 칸 …${JSON.stringify((now ?? '').slice(-4))} ≠ 조합 …${JSON.stringify(want.slice(-4))}`);
    }
    if (mode === 'syllable') await b.cdp.send('Input.insertText', { text: ch });
    acc += ch;
  }
  if (mode === 'word') await b.cdp.send('Input.insertText', { text: acc });
  await sleep(300);
  await throttle(1);
  return { value: await domVal(id), bad, before };
}
const jamoLeft = (s) => /[ㄱ-ㅣ]/.test(s ?? '');
const peek = () => b.evaluate('(window.__surveyV2Peek ? window.__surveyV2Peek() : [])');

let exitCode = 0;
try {
  // ═══ 1 · 2 · 3 · 4 설문 v2 ═══
  await b.open('/survey/v2', `!!${q('v2-intro')}`);
  await b.waitFor(`!${q('splash')}`, 8000);
  await tap('v2-start');
  await b.waitFor(`!!${q('v2-A12-input')}`);
  let r = await compose('v2-A12-input', '김민지', 'word');
  check('1', "이름 · 단어 통째 조합(Gboard 식) '김민지': 단계마다 칸 글 = 조합 글 · 끝난 글 그대로", r.value === '김민지' && r.bad.length === 0, `${JSON.stringify(r.value)} ${r.bad.slice(0, 2).join(' / ')}`);
  await setRaw('v2-A12-input', '');
  r = await compose('v2-A12-input', '김민지', 'syllable');
  check('1', "이름 · 음절마다 확정(윈도 · 맥 입력기) '김민지': 단계마다 칸 글 = 조합 글 · 끝난 글 그대로", r.value === '김민지' && r.bad.length === 0, `${JSON.stringify(r.value)} ${r.bad.slice(0, 2).join(' / ')}`);
  await shot('01_이름_조합');
  await tap('v2-next');
  await b.waitFor(`!!${q('v2-block-A02')}`, 5000);
  const saved = (await peek())[0]?.answers?.A12;
  check('1', "[다음] → 저장된 이름 '김민지'(자모 · 빈칸 섞임 0) · 다음 문항", saved === '김민지' && (await b.evaluate(`!!${q('v2-block-A02')}`)), JSON.stringify(saved));

  // A02 ~ B01 을 지나 학교 검색으로
  await tap('v2-A02-opt-male');
  await b.waitFor(`!!${q('v2-block-A03')}`, 4000);
  await tap('v2-A03-sido-seoul');
  await tap('v2-A03-sigungu-22');
  await tap('v2-next');
  await b.waitFor(`!!${q('v2-block-A05')}`, 4000);
  // 1b. 숫자만 받는 칸(키)에 한글을 조합: 조합 중에는 칸 글을 되쓰지 않고(조합이 깨지지 않게), 끝난 뒤 숫자만 남긴다(빈 칸)
  r = await compose('v2-A05-input', '키', 'syllable');
  check('1', "숫자 칸(키)에 한글 '키' 조합: 조합 중 되쓰기 0 · 끝난 뒤 숫자만(빈 칸)", r.bad.length === 0 && r.value === '', `${JSON.stringify(r.value)} ${r.bad.slice(0, 2).join(' / ')}`);
  await b.type(S('v2-A05-input'), '172');
  await tap('v2-next');
  for (const [id, code] of [['A06', 'none'], ['A07', 'never'], ['A08', 'none'], ['A11', 'done'], ['B01', 'univ']]) {
    await b.waitFor(`!!${q(`v2-block-${id}`)}`, 4000);
    await tap(`v2-${id}-opt-${code}`);
    await b.waitFor(`!${q(`v2-block-${id}`)}`, 4000);
  }
  await b.waitFor(`!!${q('v2-B02-search')}`, 4000);
  r = await compose('v2-B02-search', '서울대학교', 'syllable');
  await b.waitFor(`(window.__q('v2-B02-hit-0-name')?.innerText ?? '').trim() === '서울대학교'`, 6000);
  check('2', "학교 검색 '서울대학교': 칸 글 그대로(검색 결과가 바뀌는 동안에도) · 첫 결과 서울대학교", r.value === '서울대학교' && r.bad.length === 0 && (await b.evaluate(`(window.__q('v2-B02-hit-0-name')?.innerText ?? '').trim()`)) === '서울대학교', `${JSON.stringify(r.value)} ${r.bad.slice(0, 2).join(' / ')}`);
  await shot('02_학교검색_조합');
  await tap('v2-B02-hit-0');
  await tap('v2-next');

  // 나머지를 채워 검토로 → 세부사항 · 결혼 이야기
  const walk = await fillSurveyV2(b);
  check('3', '필수 흐름을 끝내고 검토 화면', walk.ok, `${walk.answered} · ${walk.stage}`);
  await tap('v2-review-appeal-edit');
  await b.waitFor(`!!${q('v2-appeal')}`, 4000);
  if (!(await b.evaluate(`!!${q('v2-T04-input')}`))) await tap('v2-T04-head');
  const base = '가'.repeat(197);
  await setRaw('v2-T04-input', base);
  r = await compose('v2-T04-input', '김민지', 'syllable');
  check('3', "세부사항 T04(최대 200): 197자 + '김민지' → 조합 중 자르지 않음 · 끝난 뒤 200자", r.value === `${base}김민지` && r.bad.length === 0, `길이 ${[...(r.value ?? '')].length} ${r.bad.slice(0, 2).join(' / ')}`);
  r = await compose('v2-T04-input', '김', 'syllable');
  check('3', "200자에서 한 글자 더 조합 → 조합 중에는 보이고, 끝난 뒤 200자로 자른다(자모 찌꺼기 0)", r.bad.length === 0 && [...(r.value ?? '')].length === 200 && !jamoLeft(r.value) && (r.value ?? '').endsWith('김민지'), `길이 ${[...(r.value ?? '')].length} ${r.bad.slice(0, 2).join(' / ')}`);
  await b.evaluate(`(() => { const el = window.__q('v2-T04-input'); el && el.scrollIntoView({ block: 'center' }); })()`);
  await shot('03_세부사항_200자');
  await tap('v2-next');
  await b.waitFor(`!!${q('v2-review')}`, 5000);
  const t04 = (await peek())[0]?.texts?.T04 ?? '';
  check('3', '저장된 T04 = 200자 · 끝이 김민지', [...t04].length === 200 && t04.endsWith('김민지'), `길이 ${[...t04].length}`);

  await tap('v2-review-story-edit');
  await b.waitFor(`!!${q('v2-story')}`, 4000);
  await tap('v2-Q17-head');
  r = await compose('v2-Q17-input', '명절에는 양가를 번갈아 가요', 'syllable');
  check('4', "결혼 이야기 Q17 '명절에는 양가를 번갈아 가요'(띄어쓰기 포함) 조합 · 미리보기", r.value === '명절에는 양가를 번갈아 가요' && r.bad.length === 0 && (await b.evaluate(`!!${q('v2-Q17-preview')}`)), `${JSON.stringify(r.value)} ${r.bad.slice(0, 2).join(' / ')}`);
  await shot('04_결혼이야기_조합');
  await tap('v2-next');
  await b.waitFor(`!!${q('v2-review')}`, 5000);
  const story = (await peek())[0]?.prompts?.find((p) => p.code === 'Q17')?.answer;
  check('4', '저장된 결혼 이야기 = 입력한 글', story === '명절에는 양가를 번갈아 가요', JSON.stringify(story));

  // ═══ 5 · 6 가입 → 07 내 성향 → 10 신고 ═══
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!${q('splash')}`, 8000);
  await b.type(S('signin-email'), 'imev4on@email.com'); // V5(W10): 10 신고 칸까지 가려고 숨긴 v4 화면을 켜는 데모 장면
  await b.clickText('인증번호 받기');
  await b.waitFor(`(() => { const el = document.querySelector('${S('signin-code')}'); return el && !el.readOnly && !el.disabled; })()`);
  await b.type(S('signin-code'), '123456');
  await b.clickText('확인');
  await b.waitFor(`!!document.querySelector('${S('signin-birth')}')`);
  await b.type(S('signin-birth'), '19950312');
  await b.clickText('확인');
  await b.waitFor(`location.pathname === '/consent' && document.body.innerText.includes('시작하려면 동의가 필요해요')`);
  await b.click(S('consent-all'));
  await b.evaluate(`(() => { const el = window.__q('screen-03'); if (el) el.scrollTop = 0; })()`);
  await b.click(S('consent-submit'));
  await b.waitFor(`location.pathname === '/survey/01' && !!${q('demo-skip')}`, 10000);
  await b.clickText('설문 완료 · 정상 응답');
  await b.waitFor(`location.pathname === '/traits' && !!${q('traits-confirm')}`, 40000);
  await tap('traits-edit');
  await b.waitFor(`!!${q('summary-input')}`, 5000);
  // 5b. 요약은 200자에서 자른다(07 clipSummary). 199자 + '김민' 조합 → 조합 중에는 자르지 않고, 끝난 뒤 200자(자모 찌꺼기 0)
  const near = '나'.repeat(199);
  await setRaw('summary-input', near);
  r = await compose('summary-input', '김민', 'syllable');
  check('5', "07 요약 199자 + '김민' 조합: 조합 중 자르기 0 · 끝난 뒤 200자 · 자모 찌꺼기 0", r.bad.length === 0 && r.value === `${near}김` && !jamoLeft(r.value), `길이 ${[...(r.value ?? '')].length} 끝 ${JSON.stringify((r.value ?? '').slice(-3))} ${r.bad.slice(0, 2).join(' / ')}`);
  await setRaw('summary-input', '조용한 편이에요.');
  r = await compose('summary-input', ' 차분하고 다정한 편이에요', 'syllable');
  check('5', "07 요약 고치기(여러 줄): '조용한 편이에요.' 뒤에 ' 차분하고 다정한 편이에요' 조합 → 칸 글 = 앞 글 + 입력 글", r.value === '조용한 편이에요. 차분하고 다정한 편이에요' && r.bad.length === 0, `${JSON.stringify(r.value)} ${r.bad.slice(0, 2).join(' / ')}`);
  // 태그가 5개로 차 있으면 [더하기]가 없다 → 하나 지운다
  if (!(await b.evaluate(`!!${q('tag-add')}`))) {
    await b.evaluate(`(() => { const el = document.querySelector('[data-testid^="tag-remove-"]'); el && el.scrollIntoView({ block: 'center' }); return !!el; })()`);
    await b.click('[data-testid^="tag-remove-"]');
  }
  if (await b.evaluate(`!!${q('tag-add')}`)) {
    await tap('tag-add');
    await b.waitFor(`!!${q('tag-input')}`, 4000);
    r = await compose('tag-input', '다정함', 'syllable');
    check('5', "07 태그 더하기 칸 '다정함' 조합", r.value === '다정함' && r.bad.length === 0, `${JSON.stringify(r.value)} ${r.bad.slice(0, 2).join(' / ')}`);
  } else check('5', '07 태그 더하기 칸이 보인다', false, 'tag-add 없음');
  await shot('05_내성향_조합');
  // 고치기를 그만두고 확정 → 08 → 09 → 10 신고
  if (await b.evaluate(`!!${q('traits-cancel')}`)) await tap('traits-cancel');
  else await b.clickText('취소');
  await b.waitFor(`!!${q('traits-confirm')}`, 5000);
  await tap('traits-confirm');
  await b.waitFor(`location.pathname === '/profile' && !!${q('profile-first-confirm')}`, 15000);
  await tap('profile-first-confirm');
  await b.waitFor(`location.pathname === '/recommendations' && !!${q('rec-card-2')}`, 20000);
  await tap('rec-card-2');
  await b.waitFor(`!!${q('candidate-head')}`, 8000);
  await tap('candidate-header-right');
  await b.waitFor(`!!${q('report-menu-report')}`, 5000);
  await tap('report-menu-report');
  await b.waitFor(`!!${q('report-reason-RP8')}`, 5000);
  await tap('report-reason-RP8');
  r = await compose('report-desc', '사진이 실제와 달라 보여요', 'word');
  check('6', "10 신고 사유 설명 '사진이 실제와 달라 보여요'(단어 통째 조합)", r.value === '사진이 실제와 달라 보여요' && r.bad.length === 0, `${JSON.stringify(r.value)} ${r.bad.slice(0, 2).join(' / ')}`);
  await shot('06_신고사유_조합');

  const outside = [...b.requests.values()].filter((x) => !x.url.startsWith(b.origin) && !x.url.startsWith('data:'));
  check('E', '콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && outside.length === 0, `${b.errors.slice(0, 3).join(' | ')} ${outside.slice(0, 2).map((x) => x.url).join(' ')}`);
} catch (error) {
  console.log(`[실패] 진행 중 멈춤: ${error.message}`);
  try {
    await shot('99_멈춤');
  } catch {
    /* 캡처 못 함 */
  }
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((x) => !x.ok).length;
console.log(`\n한글 입력 웹 점검(${width} · CPU ×${cpu}): 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
