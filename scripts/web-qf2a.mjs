// QF2-A 웹 점검(F-01 · F-02 시트 단추 바닥 고정 · F-13 없는 주소 · Q2-21 결제 닫힘 · Q2-20 운세 정리 끔). 무료 · 네트워크 없음(로컬 서버 + 로컬 헤드리스 브라우저).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/ 또는 스크래치 폴더 인자). 사람이 하는 순서대로 누른다.
//  1 없는 주소(/nope-route): 앱 말투 제목 · 본문 · [홈으로] · 영어 기본 화면 0 → [홈으로] → 앱 시작
//  2 가입 → 폭 360 · 390 · 430(높이 740 · 844 · 844)마다:
//    · 탑승권 사기 시트(F-01): [결제하기] · 가격 · 마감 안내가 화면 안에(바닥 고정) · 위 칸은 스크롤 · 계약 요약 · [결혼중개 계약 설명 보기]는 스크롤로 닿음
//    · 사주 동의 시트(F-02): [이어 가기]가 화면 안에(바닥 고정) · 항목 칸은 스크롤로 마지막 항목까지 닿음
//  3 사주 마당(운세 정리 D-245 처음값): 일 · 돈 · 사람 · 이번 달 · 날짜 고르기 · 달력 칸 0, 네 기둥 · 내 결 · 올해 · 인연 · 계절표 · 상대 · 읽는 법 칸은 있음
// 사용: node scripts/web-qf2a.mjs [번들 폴더]   WEB_TOTAL_MS(기본 10분) 안에 끝나지 않으면 브라우저를 닫고 끝낸다
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷', 'QF2A');

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

const b = await openBrowser({ distDir, shotDir, width: 390, height: 844 });
const sel = (id) => `[data-testid="${id}"]`;
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const waitVis = (id, ms = 8000) => b.waitFor(`!!${visQ(id)}`, ms);
const waitGone = (id, ms = 6000) => b.waitFor(`!${visQ(id)}`, ms);
const pageText = () => b.evaluate(`document.body.innerText`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-qf2a-target]').forEach((e) => e.removeAttribute('data-qf2a-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-qf2a-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(150);
  await b.click('[data-qf2a-target="1"]');
};
const goto = (p) => b.evaluate(`(() => { history.pushState(null, '', ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent('popstate', { state: null })); return true; })()`);
const rectOf = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; if (!el) return null; const r = el.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height, ih: window.innerHeight, iw: window.innerWidth }; })()`);
// 요소가 화면 안(위 0 이상 · 아래 innerHeight 이하 · 좌우 안)에 통째로 보이는가
const inside = (r) => !!r && r.t >= -0.5 && r.b <= r.ih + 0.5 && r.l >= -0.5 && r.r <= r.iw + 0.5;
const scrollInfo = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; if (!el) return null; const sc = [el, ...el.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 2 && ['auto', 'scroll'].includes(getComputedStyle(n).overflowY)); return sc ? { sh: sc.scrollHeight, ch: sc.clientHeight } : { sh: el.scrollHeight, ch: el.clientHeight, none: true }; })()`);
const scrollBottom = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; if (!el) return false; const sc = [el, ...el.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 2 && ['auto', 'scroll'].includes(getComputedStyle(n).overflowY)); if (sc) sc.scrollTop = sc.scrollHeight; return true; })()`);

async function signUp(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000);
  await b.type(sel('signin-email'), email);
  await b.clickText('인증번호 받기');
  await b.waitFor(`(() => { const el = document.querySelector('${sel('signin-code')}'); return !el.readOnly && !el.disabled; })()`);
  await b.type(sel('signin-code'), '123456');
  await b.clickText('확인');
  await b.waitFor(`!!document.querySelector('${sel('signin-birth')}')`);
  await b.type(sel('signin-birth'), '19970312');
  await b.clickText('확인');
  await b.waitFor(`location.pathname === '/consent' && document.body.innerText.includes('시작하려면 동의가 필요해요')`);
  await b.click(sel('consent-all'));
  await b.evaluate(`(() => { const el = window.__q('screen-03'); el.scrollTop = 0; })()`);
  await b.click(sel('consent-submit'));
  await b.waitFor(`location.pathname === '/survey/01'`);
  await b.clickText('설문 완료 · 정상 응답');
  await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 40000);
  await b.click(sel('traits-confirm'));
  await b.traitsNext();
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/boarding'`, 20000);
}

let exitCode = 0;
try {
  // ═══ 1. 없는 주소 ═══
  await b.open('/nope-route', `document.body.innerText.includes('찾을 수 없는 화면이에요')`);
  const nf = await pageText();
  check('1', '없는 주소: 앱 말투 제목 · 본문 · [홈으로]', nf.includes('찾을 수 없는 화면이에요') && nf.includes('주소가 바뀌었거나 없어졌을 수 있어요.') && nf.includes('홈으로'), nf.replace(/\s+/g, ' ').slice(0, 60));
  check('1', '영어 기본 화면(Unmatched Route · Sitemap · Go back) 0', !/Unmatched|Sitemap|Go back|could not be found/i.test(nf), '');
  const nfBtn = await rectOf('not-found-home');
  check('1', '[홈으로] 터치 48 이상 · 화면 안', !!nfBtn && nfBtn.h >= 47.5 && inside(nfBtn), nfBtn ? `높이 ${Math.round(nfBtn.h)}` : '단추 없음');
  console.log(`       스크린샷 ${await b.shot('QF2A_없는주소_390x844.png')}`);
  await tap('not-found-home');
  check('1', '[홈으로] → 앱 시작(/)이 알맞은 첫 화면으로(로그인 전 01 온보딩)', await b.waitFor(`location.pathname === '/onboarding'`, 8000), await b.evaluate('location.pathname'));

  // ═══ 2. 가입 → 폭마다 시트 ═══
  check('2', '가입(데모) → 탑승권 홈', await signUp('qf2a1@email.com'), '');
  const WIDTHS = [
    [360, 740],
    [390, 844],
    [430, 844],
  ];
  for (const [w, h] of WIDTHS) {
    await b.viewport(w, h);
    await sleep(300);
    // ── 탑승권 사기 시트(F-01)
    await goto('/boarding');
    await b.waitFor(`location.pathname === '/boarding'`, 6000);
    const hasBuy = await waitVis('boarding-buy', 10000);
    check('2', `${w} 폭: 홈에 [탑승권 사기]가 보인다(판매 중 장면)`, hasBuy, '');
    if (hasBuy) {
      await tap('boarding-buy');
      check('2', `${w} 폭: 사기 시트가 열린다`, await waitVis('boarding-sheet-footer', 8000), '');
      await sleep(700); // 열리는 움직임(520ms)이 끝난 뒤
      const pay = await rectOf('boarding-pay');
      const price = await rectOf('boarding-sheet-price');
      const dead = await rectOf('boarding-sheet-deadline');
      check('2', `${w} 폭: [결제하기]가 시트를 스크롤하지 않고도 화면 안에 보인다(F-01)`, inside(pay), pay ? `단추 ${Math.round(pay.t)}~${Math.round(pay.b)} / 화면 ${pay.ih}` : '단추 없음');
      check('2', `${w} 폭: 가격 · 마감 안내도 화면 안(바닥 줄)`, inside(price) && inside(dead), `가격 ${price ? Math.round(price.b) : '-'} · 마감 ${dead ? Math.round(dead.b) : '-'}`);
      check('2', `${w} 폭: [결제하기] 터치 높이 48 이상`, !!pay && pay.h >= 47.5, pay ? `${Math.round(pay.h)}` : '');
      const sc = await scrollInfo('boarding-sheet-scroll');
      console.log(`       위 칸 스크롤 ${sc ? JSON.stringify(sc) : '없음'}`);
      console.log(`       스크린샷 ${await b.shot(`QF2A_사기시트_${w}x${h}.png`)}`);
      await scrollBottom('boarding-sheet-scroll');
      await sleep(250);
      const link = await rectOf('boarding-contract');
      const footerTop = (await rectOf('boarding-sheet-footer'))?.t ?? 0;
      check('2', `${w} 폭: 위 칸을 끝까지 내리면 [결혼중개 계약 설명 보기]에 닿는다(바닥 줄 위)`, !!link && link.t >= 0 && link.b <= footerTop + 1, link ? `링크 아래 ${Math.round(link.b)} · 바닥 줄 위 ${Math.round(footerTop)}` : '링크 없음');
      console.log(`       스크린샷 ${await b.shot(`QF2A_사기시트_아래_${w}x${h}.png`)}`);
      await b.click(sel('boarding-sheet-scrim'));
      await waitGone('boarding-sheet-footer', 4000);
    }
    // ── 사주 동의 시트(F-02)
    await goto('/saju');
    await b.waitFor(`location.pathname === '/saju'`, 6000);
    const agreeOk = await waitVis('saju-ck17-agree', 10000);
    check('2', `${w} 폭: 사주 마당에 [동의하고 보기]가 보인다(동의 전)`, agreeOk, '');
    if (agreeOk) {
      await tap('saju-ck17-agree');
      check('2', `${w} 폭: 동의 시트가 열린다`, await waitVis('if2-ck17-go', 8000), '');
      await sleep(700);
      const go = await rectOf('if2-ck17-go');
      check('2', `${w} 폭: [이어 가기]가 스크롤 없이 화면 안에 보인다(F-02)`, inside(go), go ? `단추 ${Math.round(go.t)}~${Math.round(go.b)} / 화면 ${go.ih}` : '단추 없음');
      check('2', `${w} 폭: [이어 가기] 터치 높이 48 이상`, !!go && go.h >= 47.5, go ? `${Math.round(go.h)}` : '');
      const first = await rectOf('if2-ck17-a');
      check('2', `${w} 폭: 첫 동의 칸도 화면 안`, inside(first), first ? `${Math.round(first.t)}~${Math.round(first.b)}` : '');
      console.log(`       스크린샷 ${await b.shot(`QF2A_동의시트_${w}x${h}.png`)}`);
      await scrollBottom('if2-ck17-scroll');
      await sleep(250);
      const last = await rectOf('if2-ck17-e');
      const goAfter = await rectOf('if2-ck17-go');
      check('2', `${w} 폭: 칸을 끝까지 내리면 마지막 항목(성별)이 [이어 가기] 위에 보인다`, !!last && !!goAfter && last.b <= goAfter.t + 1 && last.t >= 0, last && goAfter ? `마지막 ${Math.round(last.b)} · 단추 위 ${Math.round(goAfter.t)}` : '');
      console.log(`       스크린샷 ${await b.shot(`QF2A_동의시트_아래_${w}x${h}.png`)}`);
      await tap('if2-ck17-close');
      await waitGone('if2-ck17-go', 4000);
    }
  }

  // ═══ 3. 사주 마당(운세 정리 처음값) ═══
  await b.viewport(390, 844);
  await goto('/saju');
  await waitVis('saju-ck17-agree', 8000);
  await tap('saju-ck17-agree');
  await waitVis('if2-ck17-a', 6000);
  await tap('if2-ck17-a');
  await tap('if2-ck17-c');
  await tap('if2-ck17-d');
  await tap('if2-ck17-go');
  check('3', '동의 뒤 내 정보 안내 한 줄', await waitVis('saju-empty', 8000), '');
  await tap('saju-fill');
  await waitVis('saju-in-save', 6000);
  await tap('saju-in-save');
  check('3', '저장하고 보기 → 내 네 기둥', await waitVis('saju-pillars', 12000), '');
  const kept = ['saju-pillars', 'saju-kyeol', 'saju-year', 'saju-love', 'saju-season', 'saju-partner-card', 'saju-guide-card', 'saju-end'];
  const gone = ['saju-work', 'saju-month', 'saju-pick', 'saju-cal-card', 'saju-full-card'];
  const present = await b.evaluate(`${JSON.stringify(kept)}.filter((id) => !!document.querySelector('[data-testid="' + id + '"]'))`);
  const stray = await b.evaluate(`${JSON.stringify(gone)}.filter((id) => !!document.querySelector('[data-testid="' + id + '"]'))`);
  check('3', '남긴 칸 8곳이 모두 있다(네 기둥 · 내 결 · 올해 · 인연 · 계절표 · 상대 · 읽는 법 · 끝줄)', present.length === kept.length, `${present.length}/${kept.length}`);
  check('3', '끈 칸 5곳이 없다(일 · 돈 · 사람 · 이번 달 · 날짜 고르기 · 달력 · 종합)', stray.length === 0, stray.join(', '));
  const text = await pageText();
  check('3', "화면 글에 '날짜 고르기' · '만세력' · '일 · 돈 · 사람' · '종합 풀이' 입구 0", !/날짜 고르기|만세력|일 · 돈 · 사람|종합 풀이/.test(text), '');
  console.log(`       스크린샷 ${await b.shot('QF2A_사주마당_390x844.png')}`);

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('9', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (error) {
  exitCode = 1;
  console.log(`[실패] 점검 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 3).join(' | ')}`);
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nQF2-A 웹 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
process.exitCode = exitCode || (failed > 0 ? 1 : 0);
setTimeout(() => process.exit(process.exitCode ?? 0), 3000).unref();
