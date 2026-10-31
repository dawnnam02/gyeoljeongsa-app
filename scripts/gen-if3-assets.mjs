// IF3-F(3부-카 ③ · 축소판 G-02 · 03 · 04 · 07): 하늘 읽기 앱 사본 셋을 만든다(손으로 옮기지 않는다).
//  ① src/content/if3Library.json — AI직원 0원 문구 라이브러리3(ai/IF3/문구_라이브러리3.json)에서 이번 화면 넷이 쓰는 묶음만
//     창밖 하늘(sky_moon_event · sky_moon_stage · sky_moon_alt · sky_term_frame · sky_terms) · 하늘 도감(dogam_signs · dogam_cards · 원소 · 성질 이름은 howto hw-03 ~ 09 제목) ·
//     금성 · 수성 풀이(venus_signs · mercury_signs · planet_notice) · 생일 질문(birthday_questions) · 달 모양 이름 8 · 요일 이름 · 별자리 이름
//     세 기둥(stems · month_branches · year_branches) · 읽는 법 본문(howto) · 만난 날의 하늘(sky_day_*)은 IF5-F(G-01 · 05 · 06)에서 붙인다
//  ② src/content/skyWeeks.json — 하늘 52주 표(ai/IF3/하늘표_2027_2028.json) 중 weeks 만(발행 목요일 키 · 그 주 달 사건 · 절기 · 목요일 저녁 달 모양). 일별 표(daily)는 G-06 몫이라 뺀다
//  ③ assets/illustrations/if3art.json — 디자인 원본(디자인/IF3/원본/) 달 8 · 별자리 12 SVG 글. 색은 에셋 안에만(check:tokens B)
// 사용: node scripts/gen-if3-assets.mjs          → 세 파일을 다시 쓴다
//       node scripts/gen-if3-assets.mjs --check  → 세 파일이 최신인지 보기만(어긋나면 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appDir, '..');
const LIB_SRC = path.join(root, 'ai', 'IF3', '문구_라이브러리3.json');
const SKY_SRC = path.join(root, 'ai', 'IF3', '하늘표_2027_2028.json');
const ART_DIR = path.join(root, '디자인', 'IF3', '원본');
export const LIB_OUT = path.join(appDir, 'src', 'content', 'if3Library.json');
export const SKY_OUT = path.join(appDir, 'src', 'content', 'skyWeeks.json');
export const ART_OUT = path.join(appDir, 'assets', 'illustrations', 'if3art.json');

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

export function buildLibrary(src = LIB_SRC) {
  const d = JSON.parse(fs.readFileSync(src, 'utf8'));
  const howto = d.howto.filter((h) => ['hw-03', 'hw-04', 'hw-05', 'hw-06', 'hw-07', 'hw-08', 'hw-09'].includes(h.id));
  return {
    판: d.meta['판'],
    codes: {
      signs: d.codes.signs.map((s) => pick(s, ['code', 'name', 'element', 'quality', 'start', 'end'])),
      moonStages: d.codes.moon_stages,
      weekdays: d.codes.weekdays,
      terms: d.codes.terms,
    },
    names: howto.map((h) => pick(h, ['id', 'topic', 'title'])), // 원소 이름(hw-03 ~ 06 제목) · 성질 이름(hw-07 ~ 09 제목)
    moonEvent: d.sky_moon_event.map((x) => pick(x, ['id', 'kind', 'variant', 'text'])),
    moonStage: d.sky_moon_stage.map((x) => pick(x, ['id', 'stage', 'text'])),
    moonAlt: d.sky_moon_alt.map((x) => pick(x, ['id', 'text'])),
    termFrame: d.sky_term_frame.map((x) => pick(x, ['id', 'variant', 'text'])),
    terms: d.sky_terms.map((x) => pick(x, ['id', 'index', 'name', 'text'])),
    dogamSigns: d.dogam_signs.map((x) => pick(x, ['id', 'code', 'order', 'name', 'element', 'quality', 'start', 'text'])),
    dogamCards: d.dogam_cards.map((x) => pick(x, ['id', 'no', 'name', 'meaning'])),
    planetNotice: d.planet_notice.map((x) => pick(x, ['id', 'text'])),
    venus: d.venus_signs.map((x) => pick(x, ['id', 'sign', 'text'])),
    mercury: d.mercury_signs.map((x) => pick(x, ['id', 'sign', 'text'])),
    birthdayQuestions: d.birthday_questions.map((x) => pick(x, ['id', 'set', 'text'])),
  };
}

export function buildSkyWeeks(src = SKY_SRC) {
  const t = JSON.parse(fs.readFileSync(src, 'utf8'));
  return {
    범위: t.meta['범위'],
    weeks: t.weeks.map((w) => ({
      issue: w.issue,
      end: w.end,
      stage: w.moon_issue.stage,
      alt: w.moon_issue.alt,
      events: w.moon_events.map((e) => pick(e, ['kind', 'name', 'date', 'weekday'])),
      terms: w.terms.map((e) => pick(e, ['name', 'index', 'date', 'weekday'])),
    })),
  };
}

const SIGN_ART = ['aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn'];
const MOON_ART = ['moon_new', 'moon_waxing_crescent', 'moon_first_quarter', 'moon_waxing_gibbous', 'moon_full', 'moon_waning_gibbous', 'moon_last_quarter', 'moon_waning_crescent'];

export function buildArt(dir = ART_DIR) {
  const read = (name) => fs.readFileSync(path.join(dir, `${name}.svg`), 'utf8').trim();
  return {
    moons: MOON_ART.map((n) => read(n)), // 달 모양 번호 0 ~ 7 차례(달 없는 밤 → 그믐달)
    candle: read('art_candle'), // 생일 주간 엽서 촛불(G-07)
    signs: Object.fromEntries(SIGN_ART.map((c) => [c, read(`z_${c}`)])),
  };
}

const json = (v) => `${JSON.stringify(v, null, 1)}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outs = [
    [LIB_OUT, json(buildLibrary())],
    [SKY_OUT, json(buildSkyWeeks())],
    [ART_OUT, json(buildArt())],
  ];
  if (process.argv.includes('--check')) {
    const bad = outs.filter(([f, s]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== s);
    if (bad.length) {
      console.error(`어긋남: ${bad.map(([f]) => path.relative(appDir, f)).join(' · ')} — node scripts/gen-if3-assets.mjs 로 다시 만드세요`);
      process.exit(1);
    }
    console.log('if3 사본 셋 최신');
  } else {
    for (const [f, s] of outs) {
      fs.writeFileSync(f, s);
      console.log(`쓴 파일: ${path.relative(appDir, f)} (${s.length}자)`);
    }
  }
}
