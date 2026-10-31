// IF2-F(D-223): 기내 서비스 앱 사본 두 개를 만든다(손으로 옮기지 않는다).
//  ① src/content/if2Library.json — AI직원 0원 문구 라이브러리(ai/IF2/문구_라이브러리.json)에서 1.0 화면이 쓰는 묶음만
//     별자리 · 사주 일간 · 그 주 기운 · 타로 22 · 연애 이야기 · 질문 60 · 궁합 0원 틀 · 첫 인사 칩. 둘 중 하나(balance)는 F-68 1.1이라 뺀다.
//     일간 글자(codes.stems[].char)는 앱에 가져오지 않는다(보안 S-4 · 기획 PF-14 — 화면에 일간 글자 0)
//     3부-자: 내 여행 타입 12(이름 · 앞면 한 줄 · 설명 세 줄 · 노선 두 역과 까닭 · 대화 팁) · 짐 싸기 7문항 · 이번 여행지 12(기내지 ⑤ 쪽)도 같은 원본에서
//  ② assets/illustrations/if2art.json — 디자인 원본(디자인/IF2_기내서비스/원본/) 그림 SVG 글. 색은 에셋 안에만(check:tokens B)
//     타로 앞면 22 + 뒷면 · 주머니 소품 · 짐 가방 · 타입 엽서 앞 · 소인 · 우표 · 표지 · 여행지 · 오행 결 다섯 · 별자리 점선 · 노선도 · 도장 · 짐표 · 로고 타일
// 사용: node scripts/gen-if2-assets.mjs          → 두 파일을 다시 쓴다
//       node scripts/gen-if2-assets.mjs --check  → 두 파일이 최신인지 보기만(어긋나면 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appDir, '..');
const LIB_SRC = path.join(root, 'ai', 'IF2', '문구_라이브러리.json');
const ART_DIR = path.join(root, '디자인', 'IF2_기내서비스', '원본');
export const LIB_OUT = path.join(appDir, 'src', 'content', 'if2Library.json');
export const ART_OUT = path.join(appDir, 'assets', 'illustrations', 'if2art.json');

export function buildLibrary(src = LIB_SRC) {
  const d = JSON.parse(fs.readFileSync(src, 'utf8'));
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
  return {
    판: d.meta['판'],
    codes: {
      signs: d.codes.signs.map((s) => pick(s, ['code', 'name', 'element'])),
      stems: d.codes.stems.map((s) => pick(s, ['code', 'element', 'image'])), // 일간 글자(char) 0
      elements5: d.codes.elements_5,
      elements4: d.codes.elements_4,
    },
    zodiac: d.zodiac_weekly.map((x) => pick(x, ['id', 'text'])),
    stemIntro: d.saju_stem_intro.map((x) => pick(x, ['id', 'stem', 'text'])),
    sajuWeek: d.saju_week.map((x) => pick(x, ['id', 'text'])),
    tarot: d.tarot.map((x) => pick(x, ['no', 'name', 'upright', 'line', 'question'])),
    column: d.column.map((x) => pick(x, ['id', 'title', 'body'])),
    questions: d.questions.map((x) => pick(x, ['id', 'depth', 'text'])),
    compat: {
      common: d.compat.common.map((x) => pick(x, ['id', 'field', 'on', 'text'])),
      saju: d.compat.saju.map((x) => pick(x, ['id', 'text'])),
      star: d.compat.star.map((x) => pick(x, ['id', 'text'])),
      topic: d.compat.topic.map((x) => pick(x, ['id', 'text'])),
    },
    chips: d.chips.map((x) => pick(x, ['id', 'text'])),
    // 3부-자(QP-43 ~ 49 묶음 · 계산명세 10-1 · 10-2): 열두 타입 · 짐 싸기 일곱 문항 · 열두 여행지. 소재 설명(motif)은 디자인 힌트라 앱에 안 가져온다
    travelTypes: d.travel_types.map((x) => pick(x, ['id', 'code', 'energy', 'plan', 'style', 'name', 'line', 'desc', 'routes', 'tip'])),
    packQuiz: d.pack_quiz.map((x) => pick(x, ['id', 'q', 'options'])),
    tripPlaces: d.trip_places.map((x) => pick(x, ['id', 'trip_no', 'name', 'body', 'together'])),
  };
}

const ART_FILES = {
  tarotBack: 'tarot/tarot_back.svg',
  pocketMag: 'pocket_mag.svg',
  pocketPostcard: 'pocket_postcard.svg',
  pocketTarotBack: 'pocket_tarot_back.svg',
  suitcase: 'suitcase_open.svg',
  typeFront: 'type_front_train.svg',
  postmark: 'postmark.svg',
  stamp: 'stamp_jeju.svg',
  cover: 'cover_jeju.svg',
  place: 'place_jeju.svg',
  constellation: 'constellation_sample.svg',
  metro: 'metro_line.svg',
  seal: 'seal.svg',
  tagMeet: 'tag_meet.svg',
  logoTile: 'logo_tile_no_sparkle.svg',
  grainWood: 'grain_wood.svg',
  grainFire: 'grain_fire.svg',
  grainEarth: 'grain_earth.svg',
  grainMetal: 'grain_metal.svg',
  grainWater: 'grain_water.svg',
};

const svgOf = (file) =>
  fs
    .readFileSync(path.join(ART_DIR, file), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/<\?xml[^>]*\?>\s*/, '')
    .replace(/\s*class="[^"]*"/, '')
    .trim();

// 3부-자: 타입 소재 12 · 짐 소품 21(디자인/IF2_기내서비스/타입소재/ — 96 × 96 칸, 색은 토큰 일곱뿐, 엽서 앞면 종이 위에만). 코드 = 라이브러리 travel_types[].code · pack_quiz[].options[].item
//  타입 코드와 짐 코드가 둘 다 film_camera 라 한 표에 섞지 않고 types · items 로 나눈다(디자인 목록.md 1장)
const TYPE_ART_DIR = path.join(root, '디자인', 'IF2_기내서비스', '타입소재');
const typeSvg = (name) =>
  fs
    .readFileSync(path.join(TYPE_ART_DIR, name), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/<\?xml[^>]*\?>\s*/, '')
    .trim();

export function buildArt() {
  const out = { 원본: '디자인/IF2_기내서비스/원본 (IF2-D) · 타입소재 (3부-자)' };
  for (const [k, f] of Object.entries(ART_FILES)) out[k] = svgOf(f);
  out.tarot = Array.from({ length: 22 }, (_, i) => svgOf(`tarot/tarot_${String(i).padStart(2, '0')}.svg`));
  // 엽서 앞면 바탕: 시안 type_front_train.svg 의 하늘 띠 넷 + 흰 테두리만(그림은 빼고) — 타입 소재 · 짐 소품이 이 위에 놓인다(디자인 목록.md 1장)
  const front = out.typeFront;
  const sky = [...front.matchAll(/<rect x="0" y="[\d.]+" width="320" height="[\d.]+" fill="#[0-9A-Fa-f]{6}"\/>/g)].map((m) => m[0]);
  const border = /<rect x="9" y="9" width="302" height="182"[^>]*\/>/.exec(front)?.[0];
  if (sky.length !== 4 || !border) throw new Error('엽서 앞면 시안에서 하늘 띠 · 테두리를 읽지 못했어요');
  out.typeSky = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">${sky.join('')}${border}</svg>`;
  const lib = JSON.parse(fs.readFileSync(LIB_SRC, 'utf8'));
  out.types = Object.fromEntries(lib.travel_types.map((t) => [t.code, typeSvg(`type_${t.code}.svg`)]));
  const items = [...new Set(lib.pack_quiz.flatMap((q) => q.options.map((o) => o.item)))];
  out.items = Object.fromEntries(items.map((c) => [c, typeSvg(`item_${c}.svg`)]));
  return out;
}

// ③ src/content/moneySafetyWords.ts — 안전 안내 카드(F-39 · 정책 PF-56)의 기기 판정 낱말. 원본 = 서버 거르기 사전(backend/migrations/*.sql private.text_guard_terms)
//    money 낱말 전부 + 다른 앱 유도 꼴(url 낱말 · 연락 수단 가운데 대화방을 옮기자는 꼴) — 판 = 그 목록의 지문(서버 사전이 바뀌면 판이 바뀐다, 보안 IC-20 · IFF-09)
//    카톡 · 인스타처럼 연락처를 나누는 흔한 이름은 넣지 않는다(T-20 연락처 자유 · 정책 PF-56 '연락처 꼴 한 줄은 1.0에서 뺌')
//    STEMS: 거르기에 걸리지 않는 돈 · 투자 꼴 줄기(정책 PF-56 '돈 · 투자 · 코인 · 송금') — 앱 쪽 덧붙임(판에 함께 셈)
const MIGRATIONS = path.join(root, 'backend', 'migrations');
export const SAFETY_OUT = path.join(appDir, 'src', 'content', 'moneySafetyWords.ts');
const LURE_CONTACT = new Set(['텔레', '텔레그램', 'telegram', '오픈채팅', '오픈카톡', '왓츠앱', 'whatsapp', '위챗', 'wechat', '라인아이디', 'line id']);
const STEMS = ['투자', '코인', '송금', '입금', '계좌', '대출', '빌려', '수익률', '리딩'];
export function buildSafetyWords(dir = MIGRATIONS) {
  const money = new Set();
  const lure = new Set();
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    for (const block of sql.matchAll(/insert\s+into\s+private\.text_guard_terms\s*\(kind,\s*term\)\s*values([\s\S]*?);/gi)) {
      for (const m of block[1].matchAll(/\(\s*'(money|url|contact)'\s*,\s*'((?:[^']|'')*)'\s*\)/g)) {
        const term = m[2].replace(/''/g, "'").toLowerCase();
        if (m[1] === 'money' && term !== 'abuse') money.add(term);
        else if (m[1] === 'url' && !['http://', 'https://', 'www.', 'url'].includes(term)) lure.add(term);
        else if (m[1] === 'contact' && LURE_CONTACT.has(term)) lure.add(term);
      }
    }
  }
  const words = [...money].sort();
  const lures = [...lure].sort();
  let h = 0x811c9dc5;
  for (const ch of [...words, '|', ...lures, '|', ...STEMS].join('\n')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const version = `tg-${h.toString(16).padStart(8, '0')}`;
  const list = (xs) => xs.map((x) => `  ${JSON.stringify(x)},`).join('\n');
  return [
    '// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-if2-assets.mjs (IF2-F · 정책 PF-56 · 보안 IC-20)',
    '// 원본: backend/migrations/*.sql private.text_guard_terms(money 전부 · url · 대화방을 옮기자는 연락 수단) + 앱 줄기 STEMS. 판 = 목록 지문',
    '// 쓰는 곳: features/inflight/inflightLogic moneySafetyHit(안전 안내 카드 — 기기 판정 · 저장 · 전송 0)',
    '',
    `export const MONEY_SAFETY_DICT_VERSION = ${JSON.stringify(version)};`,
    'export const MONEY_SAFETY_WORDS: readonly string[] = [',
    list(words),
    '];',
    'export const MONEY_SAFETY_LURES: readonly string[] = [',
    list(lures),
    '];',
    'export const MONEY_SAFETY_STEMS: readonly string[] = [',
    list(STEMS),
    '];',
    '',
  ].join('\n');
}

// ④ src/features/inflight/if2IconPaths.ts — 디자인 원본 아이콘 15(원본/paths.json, D42 1안 규격 · 같은 roles) 경로 그대로
export const ICON_OUT = path.join(appDir, 'src', 'features', 'inflight', 'if2IconPaths.ts');
export function buildIcons() {
  const d = JSON.parse(fs.readFileSync(path.join(ART_DIR, 'paths.json'), 'utf8'));
  const lines = Object.entries(d.icons).map(([k, v]) => `  ${k}: { name: ${JSON.stringify(v.name)}, parts: [${v.parts.map((p) => `{ role: ${JSON.stringify(p.role)}, d: ${JSON.stringify(p.d)} }`).join(', ')}] },`);
  return [
    '// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-if2-assets.mjs (IF2-F)',
    '// 원본: 디자인/IF2_기내서비스/원본/paths.json(IF2-D 새 아이콘 15 · D42 1안 규격 24 격자 · 선 1.5 · role shape · line · dot)',
    "import type { IconPart } from '@/components/iconPaths';",
    '',
    'export const IF2_ICON_PATHS = {',
    ...lines,
    '} as const satisfies Record<string, { name: string; parts: readonly IconPart[] }>;',
    '',
  ].join('\n');
}

// ⑤ src/content/ck17Content.ts — 재미 정보 동의 시트(IF-CK17) 글. 원본 = 법무/동의문구.md 4-17 '화면 문구' · 전문(글자 그대로 · 마크다운 표시만 걷음)
//    4-17 머리 '앱 생성기는 이 절을 읽지 않는다 … 시트 글은 앱이 이 절에서 옮겨 쓴다' → 손으로 옮기지 않고 이 생성기가 옮긴다(gen:legal 과 같은 원칙)
export const CK17_OUT = path.join(appDir, 'src', 'content', 'ck17Content.ts');
const CONSENT_DOC = path.join(root, '법무', '동의문구.md');
export function buildCk17(file = CONSENT_DOC) {
  const doc = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const from = doc.search(/^### 4-17\. /m);
  const sec = doc.slice(from, doc.indexOf('\n## ', from));
  const lines = sec.split('\n');
  const tick = (l) => (/`([^`]+)`/.exec(l) ?? [])[1] ?? null;
  const after = (re) => lines.findIndex((l) => re.test(l));
  const iA = after(/^- 체크 ①:/);
  const iB = after(/^- 체크 ②:/);
  const iS = after(/^- 요약\(보기 ›\):/);
  const summary = [];
  for (let i = iS + 1; i < lines.length && lines[i].startsWith('  - '); i += 1) if (!/전문 보기 ›/.test(lines[i])) summary.push(lines[i].slice(4).trim());
  const button = lines[after(/^- 버튼:/)];
  const fullFrom = after(/^\*\*전문 \(합니다체\)\*\*/);
  const full = [];
  for (let i = fullFrom + 1; i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === ''); i += 1) {
    const t = lines[i].replace(/^>\s?/, '').replace(/\*\*/g, '').trim();
    if (t) full.push(t);
  }
  const fullTitle = full.shift() ?? '';
  const head = (mark) => (full.find((l) => l.startsWith(mark)) ?? '').replace(/^\([가-힣]\)\s*/, '').replace(/\s*\[선택\].*$/, '');
  const out = {
    title: tick(lines[after(/^- 제목\(시트 위\):/)]),
    lead: tick(lines[after(/^- 첫 줄:/)]),
    checkA: tick(lines[iA]),
    whyA: tick(lines[iA + 1]),
    checkB: tick(lines[iB]),
    whyB: tick(lines[iB + 1]),
    noteB: tick(lines[iB + 2]),
    summary,
    summaryOpen: '보기 ›',
    fullOpen: '전문 보기 ›',
    go: tick(button),
    close: (/·\s*([가-힣]+)\s*$/.exec(button) ?? [])[1] ?? null,
    fullTitle,
    full,
    rowA: head('(가)'),
    rowB: head('(나)'),
  };
  for (const [k, v] of Object.entries(out)) if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) throw new Error(`동의문구 4-17 에서 ${k} 를 읽지 못했어요`);
  return [
    '// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-if2-assets.mjs (IF2-F · 재미 정보 동의 시트 IF-CK17)',
    '// 원본: 법무/동의문구.md 4-17 화면 문구 · 전문(글자 그대로). 판 = config/laterConsent IF2_CONSENT_VERSIONS(CK17A consent-2026.10.30-v1 · CK17B consent-2026.10.28-v2)',
    '// rowA · rowB = 12 동의 관리 줄 안 두 칸 이름(4-17 전문 (가) · (나) 머리 — 동의문구 5-6 끝 ②)',
    '',
    `export const CK17 = ${JSON.stringify(out, null, 2)} as const;`,
    '',
  ].join('\n');
}

// ⑥ src/content/if5ConsentContent.ts — 사주 마당 동의 시트 글(IF5-F2 ⑪). 원본 = 법무/동의문구.md 4-17 새 칸 ③ ④ ⑤ · 4-18 CK17D · 4-19 CK19 · 4-20 CK20 '화면 문구' · 전문(글자 그대로 · 마크다운 표시만 걷음)
export const IF5_CONSENT_OUT = path.join(appDir, 'src', 'content', 'if5ConsentContent.ts');
export function buildIf5Consent(file = CONSENT_DOC) {
  const doc = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const secOf = (n) => {
    const from = doc.search(new RegExp(`^### 4-${n}\. `, 'm'));
    if (from < 0) throw new Error(`동의문구 4-${n} 절을 찾지 못했어요`);
    const rest = doc.slice(from + 5);
    const next = rest.search(/^#{2,3} /m);
    return (next >= 0 ? doc.slice(from, from + 5 + next) : doc.slice(from)).split('\n');
  };
  const tick = (l) => (l === undefined ? null : (/`([^`]+)`/.exec(l) ?? [])[1] ?? null);
  const ticks = (l) => [...(l ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const idx = (lines, re, from = 0) => {
    for (let i = from; i < lines.length; i += 1) if (re.test(lines[i])) return i;
    return -1;
  };
  const summaryOf = (lines) => {
    const iS = idx(lines, /^- 요약\(보기 ›\):/);
    const out = [];
    for (let i = iS + 1; iS >= 0 && i < lines.length && lines[i].startsWith('  - '); i += 1) if (!/전문 보기 ›/.test(lines[i])) out.push(lines[i].slice(4).trim());
    return out;
  };
  const fullOf = (lines) => {
    const f = idx(lines, /^\*\*전문 \(합니다체\)\*\*/);
    const out = [];
    for (let i = f + 1; f >= 0 && i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === ''); i += 1) {
      const t = lines[i].replace(/^>\s?/, '').replace(/\*\*/g, '').trim();
      if (t) out.push(t);
    }
    return out;
  };
  const need = (name, o) => {
    for (const [k, v] of Object.entries(o)) if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) throw new Error(`동의문구 ${name} 에서 ${k} 를 읽지 못했어요`);
    return o;
  };
  // 4-17 새 칸 ③ ④ ⑤ + 동의하지 않을 때 안내 줄
  const l17 = secOf(17);
  const box = (mark) => {
    const i = idx(l17, new RegExp(`^- 체크 ${mark}:`));
    return { check: tick(l17[i]), why: tick(l17[i + 1]), note: tick(l17[i + 2]) };
  };
  const ck17extra = need('4-17', {
    time: box('③'),
    place: box('④'),
    gender: box('⑤'),
    noHour: tick(l17[idx(l17, /^- 동의하지 않으면\(시주 칸\):/)]),
    noPlace: tick(l17[idx(l17, /^- 동의하지 않으면\(태어난 곳\):/)]),
    noLuck: tick(l17[idx(l17, /^- 동의하지 않으면\(대운 칸\):/)]),
  });
  for (const k of ['time', 'place', 'gender']) need(`4-17 ${k}`, ck17extra[k]);
  // 4-18 CK17D
  const l18 = secOf(18);
  const b18 = ticks(l18[idx(l18, /^- 버튼:/)]);
  const full18 = fullOf(l18);
  const ck17d = need('4-18', {
    title: tick(l18[idx(l18, /^- 제목\(시트 위\):/)]),
    lead: tick(l18[idx(l18, /^- 첫 줄:/)]),
    check: tick(l18[idx(l18, /^- 체크 문구:/)]),
    why: tick(l18[idx(l18, /^- 왜 필요한지:/)]),
    note: tick(l18[idx(l18, /^- 덧붙이는 안내:/)]),
    summary: summaryOf(l18),
    yes: b18[0],
    no: b18[1],
    declined: tick(l18[idx(l18, /^- 동의하지 않으면:/)]),
    fullTitle: full18[0],
    full: full18.slice(1),
  });
  // 4-19 CK19
  const l19 = secOf(19);
  const b19 = ticks(l19[idx(l19, /^- 버튼:/)]);
  const iA = idx(l19, /^- 체크 ①:/);
  const iB = idx(l19, /^- 체크 ②:/);
  const full19 = fullOf(l19);
  const ck19 = need('4-19', {
    title: tick(l19[idx(l19, /^- 제목\(시트 위\):/)]),
    lead: tick(l19[idx(l19, /^- 첫 줄:/)]),
    checkA: tick(l19[iA]),
    whyA: tick(l19[iA + 1]),
    checkB: tick(l19[iB]),
    whyB: tick(l19[iB + 1]),
    noteB: tick(l19[iB + 2]),
    summary: summaryOf(l19),
    yes: b19[0],
    no: b19[1],
    declined: tick(l19[idx(l19, /^- 동의하지 않으면:/)]),
    fullTitle: full19[0],
    full: full19.slice(1),
  });
  // 4-20 CK20
  const l20 = secOf(20);
  const full20 = fullOf(l20);
  const ck20 = need('4-20', {
    check: tick(l20[idx(l20, /^- 체크 문구:/)]),
    why: tick(l20[idx(l20, /^- 왜 필요한지:/)]),
    note: tick(l20[idx(l20, /^- 덧붙이는 안내:/)]),
    summary: summaryOf(l20),
    notChecked: tick(l20[idx(l20, /^- 확인하지 않으면:/)]),
    fullTitle: full20[0],
    full: full20.slice(1),
  });
  return [
    '// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-if2-assets.mjs (IF5-F2 ⑪ · 사주 마당 동의 시트)',
    '// 원본: 법무/동의문구.md 4-17 새 칸 ③ ④ ⑤ · 4-18 CK17D · 4-19 CK19 · 4-20 CK20 화면 문구 · 전문(글자 그대로). 판 = config/laterConsent IF5_CONSENT_VERSIONS (판_관리 2-1)',
    '',
    `export const CK17_EXTRA = ${JSON.stringify(ck17extra, null, 2)} as const;`,
    '',
    `export const CK17D = ${JSON.stringify(ck17d, null, 2)} as const;`,
    '',
    `export const CK19 = ${JSON.stringify(ck19, null, 2)} as const;`,
    '',
    `export const CK20 = ${JSON.stringify(ck20, null, 2)} as const;`,
    '',
  ].join('\n');
}

const render = (o) => `${JSON.stringify(o, null, 1)}\n`;

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const files = [
    [LIB_OUT, render(buildLibrary())],
    [ART_OUT, render(buildArt())],
    [SAFETY_OUT, buildSafetyWords()],
    [ICON_OUT, buildIcons()],
    [CK17_OUT, buildCk17()],
    [IF5_CONSENT_OUT, buildIf5Consent()],
  ];
  if (process.argv.includes('--check')) {
    const stale = files.filter(([f, t]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') !== t).map(([f]) => path.relative(appDir, f));
    if (stale.length) {
      console.log(`[실패] 낡은 파일: ${stale.join(', ')} → node scripts/gen-if2-assets.mjs`);
      process.exit(1);
    }
    console.log('[통과] if2Library.json · if2art.json = 원본');
  } else {
    for (const [f, t] of files) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, t);
      console.log(`→ ${path.relative(appDir, f)} (${Math.round(t.length / 1024)}KB)`);
    }
  }
}
