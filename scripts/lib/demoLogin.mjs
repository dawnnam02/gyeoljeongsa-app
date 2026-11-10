// 웹 점검 도구용 가입 도우미(QF2-B8 · FB-022 뒤).
//  로그인이 필요한 화면은 로그인 없이 주소로 직접 열 수 없다(앱 가드 navigation/loginGuard — 로그인이 없으면 처음 화면으로 간다). 점검 도구는 가드를 약하게 하지 않고,
//  데모 가입을 약관 동의까지 마친 뒤(세션이 생긴 상태) 앱 안 이동(주소 바꾸기 + popstate)으로 화면을 연다. 데모 세션은 메모리뿐이라 새로 불러오면(b.open) 다시 사라진다.
//  가입 도우미는 가입 화면에서 시작하므로(전체 불러오기) 앞 흐름의 상태를 이어받지 않는다.
import { sleep } from './browser.mjs';

const sel = (id) => `[data-testid="${id}"]`;

// 데모 가입: 이메일 → 인증번호(123456) → 생년월일 → 약관 동의까지 마치고 설문 첫 화면(/survey/01)에 선다. 성공하면 true
export async function signUpToSurvey(b, email) {
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
  await b.evaluate(`(() => { const el = window.__q('screen-03'); if (el) el.scrollTop = 0; })()`);
  await b.click(sel('consent-submit'));
  return b.waitFor(`location.pathname === '/survey/01'`, 15000);
}

// 앱 안 이동(새로 불러오지 않는다 — 데모 세션이 남는다). 주소는 쿼리를 포함해도 된다
export async function goInApp(b, pathAndQuery) {
  await b.evaluate(`(() => { history.pushState(null, '', ${JSON.stringify(pathAndQuery)}); dispatchEvent(new PopStateEvent('popstate', { state: null })); return true; })()`);
  await sleep(900);
}
