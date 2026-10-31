// AIT-F ⑦: 서버 판 export 가 만든 API 경로 번들(dist-ait/server/_expo/functions/api/ai/[feature]+api.js)을 Node 에서 그대로 불러
//  모의 모드(AIT_MODE 없음)로 부른다. 같은 번들 코드(핸들러 · 모의 응답 · 서명 · 공식 SDK 감싸기)가 돌아가는지 본다. 네트워크 0 · 업체 호출 0(fetch 를 막아 둔다) · 유료 0.
//  Cloudflare Workers 에서의 실행은 아니다(여기는 Node) — 번들이 node 전용 모듈을 요구하지 않는지는 check-ait-bundle 이 보고, 실제 Workers 동작은 배포 뒤 AIT-W 몫(미확인).
//  시험용 값은 모두 실행 때 만든다(소스에 완성된 꼴 0). 출력은 통과 · 실패와 상태 코드뿐.
// 사용: node scripts/smoke-ait-server.mjs   종료 코드 0 통과 · 1 실패 · 2 번들 없음
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(appDir, 'dist-ait', 'server', '_expo', 'functions', 'api', 'ai', '[feature]+api.js');
if (!fs.existsSync(file)) {
  console.error('서버 판 번들이 없어요 — 먼저 node scripts/export-ait.mjs');
  process.exit(2);
}
const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');
process.env['AI_ACCESS_' + 'CODE'] = CODE;
process.env['AIT_SIGN_' + 'KEY'] = 'smoke-signing-secret-' + 'abcd'.repeat(6);
delete process.env.AIT_MODE; // 기본 = 모의
delete process.env['ANTHROPIC_' + 'API_KEY'];
let netCalls = 0;
globalThis.fetch = async () => {
  netCalls += 1;
  throw new Error('네트워크 호출 금지');
};
const logs = [];
const origLog = console.log;
console.log = (l) => logs.push(String(l));

const mod = createRequire(import.meta.url)(file);
const host = 'lovedecide--demo.expo.app';
const call = async (body, headers = {}, method = 'POST') => {
  const r = await mod[method](new Request(`https://${host}/api/ai/x`, { method, headers: { 'content-type': 'application/json', 'x-ait-code': CODE, host, ...headers }, body: method === 'GET' ? undefined : JSON.stringify(body) }));
  return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
};
const results = [];
const check = (name, ok) => results.push([name, !!ok]);

const noCode = await call({ feature: 'horoscope' }, { 'x-ait-code': '' });
const wrong = await call({ feature: 'horoscope' }, { 'x-ait-code': 'x' });
check('코드 없음 401 · 틀림과 같은 본문', noCode.status === 401 && JSON.stringify(noCode.json) === JSON.stringify(wrong.json));
check('GET 405', (await call({}, {}, 'GET')).status === 405);
check('다른 출처 403', (await call({ feature: 'horoscope' }, { origin: 'https://other.example' })).status === 403);
const features = [
  ['horoscope', { feature: 'horoscope', sun_sign: 'leo', day_element: 'wood' }],
  ['compat', { feature: 'compat', shared: [{ k: 'hobby', v: 'travel' }] }],
  ['coach', { feature: 'coach', field: 'intro', text: '주말에는 주로 집에서 쉬거나 산책을 해요' }],
  ['chat', { feature: 'chat', asker_text: '요즘 상대의 답이 늦어져서 마음이 쓰여요' }],
];
for (const [name, body] of features) {
  const r = await call(body);
  check(`${name}: 200 · 모의(mock) · 코드 ok`, r.status === 200 && r.json?.mode === 'mock' && r.json?.code === 'ok');
}
const crisis = await call({ feature: 'chat', asker_text: '죽고 싶다는 생각이 계속 들어요' });
check('위기 낱말 → 고정 카드', crisis.json?.code === 'crisis' && crisis.json?.card?.id === 'crisis');
check('응답 머리: no-store · nosniff · noindex', noCode.headers.get('cache-control') === 'no-store' && noCode.headers.get('x-content-type-options') === 'nosniff' && noCode.headers.get('x-robots-tag') === 'noindex');
console.log = origLog;
check('업체 호출(네트워크) 0', netCalls === 0);
check('로그에 코드 · 서명 키 · 입력 글 0', !logs.join('\n').includes(CODE) && !logs.join('\n').includes('smoke-signing') && !logs.join('\n').includes('산책'));
let bad = 0;
for (const [name, ok] of results) {
  console.log(`[${ok ? '통과' : '실패'}] ${name}`);
  if (!ok) bad += 1;
}
console.log(`서버 번들 점검: 통과 ${results.length - bad} · 실패 ${bad} · 로그 ${logs.length}줄 · 네트워크 호출 ${netCalls}`);
process.exit(bad ? 1 : 0);
