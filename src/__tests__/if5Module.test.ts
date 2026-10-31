/**
 * @jest-environment node
 */
// IF5-F1 ④ ⑤ ⑦ 모듈 시험 — 계산 모듈 사본(src/saju5) = 원본(ai/IF5/ts) · calc5.py 정답과 같은 계산 · 미리 쓴 글 조각(판 2026-10-31.3) 전수 검사 · 스위치 20키 · 글 사본 생성기.
//  저장소 복제본(공개 저장소)에는 ai/ · 마케팅/ 이 없어 원본 대조는 건너뛴다(GH1) — 사본끼리의 시험은 그대로 돈다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { demoDefault, FEATURE_KEY_LIST, liveDefault } from '@/config/featureKeys';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { checkText5 } from '@/saju5/check_text5';
import { allNodes5, FRAGMENTS5, sharedNodes5 } from '@/saju5/fragments5';
import { NAMES5, checkNames5, displayStrings } from '@/saju5/names5';
import { BIRTH_PLACES, build_chart, gj } from '@/saju5/saju_calc5';

const APP = path.resolve(__dirname, '..', '..');
const ROOT = path.resolve(APP, '..');
const hasOrigin = fs.existsSync(path.join(ROOT, 'ai', 'IF5', 'ts'));
const hasCopyDoc = fs.existsSync(path.join(ROOT, '마케팅', '카피.md'));
const run = (script: string, ...args: string[]) => spawnSync(process.execPath, [path.join(APP, 'scripts', script), ...args], { encoding: 'utf8' });

(hasOrigin ? describe : describe.skip)('IF5-F1 ② 계산 모듈 사본 = 원본 (동기 검사)', () => {
  test('node scripts/sync-if5.mjs --check 가 같음 · 파일 11개(코드 7 + 데이터 4) · 원본은 읽기만', () => {
    const r = run('sync-if5.mjs', '--check');
    expect(r.stdout + r.stderr).toMatch(/IF5 동기 같음: 파일 11개/);
    expect(r.status).toBe(0);
  });
  test('들이지 않은 것: partner5(F2) · AI 요청 · 원가 · 대화 모듈이 앱 소스에 없다(번들에 지시문 0 — IFF5-35)', () => {
    const names = fs.readdirSync(path.join(APP, 'src', 'saju5'));
    for (const n of ['partner5.ts', 'request5.ts', 'generated5.ts', 'cost5.ts', 'chat5.ts', 'input5.ts', 'mock5.ts']) expect(names).not.toContain(n);
  });
  test('앱 사본의 줄끝은 LF 뿐(새 CRLF 0)', () => {
    for (const f of fs.readdirSync(path.join(APP, 'src', 'saju5'))) if (f.endsWith('.ts')) expect(fs.readFileSync(path.join(APP, 'src', 'saju5', f), 'utf8')).not.toContain('\r');
  });
});

(hasOrigin ? describe : describe.skip)('IF5-F1 ② 앱 안 계산 = calc5.py 정답(고정 시험 벡터)', () => {
  const vec = JSON.parse(hasOrigin ? fs.readFileSync(path.join(ROOT, 'ai', 'IF5', 'ts', 'tests', 'fixtures', 'calc_vectors5.json'), 'utf8') : '{"cases":[]}') as { cases: { in: [number, number, number, number | null, number | null, 'M' | 'F' | null, string | null]; out: { p?: (number | null)[]; cb?: string; fl?: string } | null }[] };
  test('출생 사례 전부: 네 기둥 번호 · 조합 글자 · 플래그가 같다(오류 사례는 오류)', () => {
    const bad: string[] = [];
    let n = 0;
    for (const c of vec.cases) {
      const [year, month, day, hour, minute, gender, place] = c.in;
      let chart;
      try {
        chart = build_chart({ year, month, day, hour, minute, gender, place });
      } catch {
        chart = null;
      }
      if (!c.out || !c.out.p) continue; // 파이썬도 오류 — 앱도 던졌는지 아래에서 센다
      n += 1;
      if (!chart) {
        bad.push(`${c.in.join(',')}: 앱이 던짐`);
        continue;
      }
      const P = chart.pillars;
      const got = [P.year, P.month, P.day, P.hour];
      if (JSON.stringify(got) !== JSON.stringify(c.out.p)) bad.push(`${c.in.join(',')}: ${got} / ${c.out.p}`);
      const norm = (list: string[]) => list.filter((f) => f).sort().join(',');
      if (c.out.fl !== undefined && norm(chart.flags) !== norm(c.out.fl.split(/[,;]/))) bad.push(`${c.in.join(',')}: 플래그 ${chart.flags}/${c.out.fl}`);
    }
    expect(n).toBeGreaterThan(3000);
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('IF5-F1 ② 앱 안 계산 기본값', () => {
  test('1994-03-14 15:20 서울 → 일주 · 입춘 전후 · 시각 모름은 세 기둥 + 두 가지(경계 날) 처리', () => {
    const c = build_chart({ year: 1994, month: 3, day: 14, hour: 15, minute: 20, gender: 'F', place: '서울' });
    expect(c.pillars.hour).not.toBeNull();
    expect(gj(c.pillars.year)).toBe('갑술');
    const unknown = build_chart({ year: 1994, month: 3, day: 14 });
    expect(unknown.pillars.hour).toBeNull();
    expect(unknown.flags).toContain('hour_unknown');
    const ipchun = build_chart({ year: 2025, month: 2, day: 3 }); // 입춘이 든 날: 시각 모름이면 해 · 달이 두 가지
    expect(ipchun.combos.length).toBe(2);
  });
  test('범위 밖(1961-08-10 이전)은 던진다 · 모르는 지점은 던진다', () => {
    expect(() => build_chart({ year: 1960, month: 5, day: 5 })).toThrow('out_of_range');
    expect(() => build_chart({ year: 1990, month: 5, day: 5, hour: 3, minute: 0, place: '화성' })).toThrow('unknown_place');
  });
  test('대표 지점 23곳 = 카피 24장 SAJU.input.place.p01 ~ p23 이름과 차례가 같다', () => {
    const ids = Object.keys(BIRTH_PLACES);
    expect(ids).toHaveLength(23);
    ids.forEach((id, i) => expect(IF5_TEXT[`SAJU.input.place.p${String(i + 1).padStart(2, '0')}` as keyof typeof IF5_TEXT]).toBe(id));
  });
});

describe('IF5-F1 ④ 미리 쓴 글 조각 · 이름표', () => {
  test('판 2026-10-31.3 · 조각 478(고르는 자리별 글) · 이름표 판 같음', () => {
    expect(FRAGMENTS5.version).toBe('2026-10-31.3');
    expect(NAMES5.version).toBe('2026-10-31.3');
    // 조각 478 = 고르는 자리별 글 칸(공통 조각은 한 번씩) — 그 가운데 7칸은 일부러 비워 둔 칸(글 0)이라 글이 있는 칸은 471
    const own = allNodes5().filter((n) => !n.ref).flatMap((n) => Object.values(n.node.map));
    const shared = sharedNodes5().flatMap((n) => Object.values(n.node.map));
    const all = [...own, ...shared];
    expect(all).toHaveLength(478);
    expect(all.filter((t) => t !== '')).toHaveLength(471);
  });
  test('조각 전부가 순화 검사기(check_text5 · 미리 쓴 글 단계)를 통과한다', () => {
    const bad: string[] = [];
    const seen = new Set<string>();
    for (const n of [...allNodes5().map((x) => x.node), ...sharedNodes5().map((x) => x.node)]) {
      for (const [k, t] of Object.entries(n.map)) {
        if (!t || seen.has(t)) continue;
        seen.add(t);
        const text = t.replace(/\{topic\}/g, '이 계절은').replace(/\{q\}/g, '첫 석 달은');
        if (checkText5(text, { stage: 'fragment', kind: n.kind }).length) bad.push(`${k}: ${t.slice(0, 30)}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  test('옛 label(충 · 형 · 원진 같은 내부 관계 낱말)이 화면 글에 0 — 관계 말은 화면 말(부딪히기 쉬운 결 · 엇갈리기 쉬운 결)', () => {
    const OLD = ['육충', '지지충', '천간충', '삼형', '원진', '상충', '형살'];
    const texts: string[] = [];
    for (const n of [...allNodes5().map((x) => x.node), ...sharedNodes5().map((x) => x.node)]) for (const t of Object.values(n.map)) if (t) texts.push(t);
    for (const [, text] of displayStrings(NAMES5).map((d) => [d[0], d[1]] as const)) texts.push(text);
    const hits = texts.filter((t) => OLD.some((w) => t.includes(w)));
    expect(hits).toEqual([]);
    expect(texts.some((t) => t.includes('부딪히기 쉬운 결'))).toBe(true);
    expect(texts.some((t) => t.includes('엇갈리기 쉬운 결'))).toBe(true);
  });
  test('이름표 검사(checkNames5)가 빈다', () => {
    expect(checkNames5(NAMES5)).toEqual([]);
  });
});

describe('IF5-F1 ⑤ 스위치 20키 (기획/IF5_스위치.md — 서버 이름 saju_yard · mileage · mileage_charge)', () => {
  const NEW17 = ['saju_yard', 'saju_home', 'saju_reading', 'saju_season', 'saju_year', 'saju_calendar', 'saju_today', 'saju_pickday', 'saju_partner', 'pair_card_saju', 'saju_ai', 'saju_talk', 'mileage', 'mileage_spend', 'mileage_charge', 'mileage_gift', 'rest_hint'];
  const KEEP3 = ['three_pillars', 'read_guide', 'meet_sky'];
  test('새 17키 + 이어 쓰는 IF3 3키 = 20키가 목록에 있고 모두 live false', () => {
    const keys = FEATURE_KEY_LIST.map((k) => k.key);
    for (const k of [...NEW17, ...KEEP3]) {
      expect(keys).toContain(k);
      expect(liveDefault(k)).toBe(false);
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect(FEATURE_KEY_LIST.filter((k) => k.group === 'IF5')).toHaveLength(17);
  });
  test('데모에서는 켬 — 실제 AI 를 부를 수 있는 saju_ai · saju_talk 와 실제 결제를 부를 수 있는 mileage_charge 만 데모도 꺼짐', () => {
    for (const k of [...NEW17, ...KEEP3]) expect(demoDefault(k)).toBe(!['saju_ai', 'saju_talk', 'mileage_charge'].includes(k));
  });
  test('check_sec2 IF5-m2: 서버 스위치 3키(saju_yard · mileage · mileage_charge)가 앱 목록에 있다', () => {
    const flat = JSON.stringify(JSON.parse(fs.readFileSync(path.join(APP, 'src', 'config', 'featureKeys.json'), 'utf8')));
    for (const k of ['saju_yard', 'mileage', 'mileage_charge']) expect(flat).toContain(`"${k}"`);
  });
});

(hasCopyDoc ? describe : describe.skip)('IF5-F1 ⑦ 글 사본 = 카피 (생성기 --check)', () => {
  test('gen-if5-copy --check (if5Copy.ts = 카피 24장 318키)', () => {
    const r = run('gen-if5-copy.mjs', '--check');
    expect(r.stdout + r.stderr).toContain('if5Copy.ts 최신');
    expect(r.status).toBe(0);
  });
  test('gen-if3-copy --check (if3Copy.ts = 카피 22장 81키)', () => {
    const r = run('gen-if3-copy.mjs', '--check');
    expect(r.stdout + r.stderr).toContain('if3Copy.ts 최신');
  });
});

describe('IF5-F1 ⑦ 글 사본 틀', () => {
  test('318키 · 값 틀 자리 채우기 · 조사', () => {
    expect(Object.keys(IF5_TEXT)).toHaveLength(318);
    expect(t5('SAJU.cal.month', { 년: 2027, 월: 3 })).toBe('2027년 3월');
    expect(t5('SAJU.guide.help.title', { 낱말: '다섯 기운' })).toBe('다섯 기운 이 뭐예요?');
  });
  test('법무 필수 끝줄 원문 · 점수 · 퍼센트 · 순위 말 0', () => {
    expect(IF5_TEXT['SAJU.card.footer']).toBe('AI가 쓴 글이에요. 재미로 보는 이야기예요. 상담이나 진단이 아니에요. 매칭에는 쓰이지 않아요');
    for (const [k, v] of Object.entries(IF5_TEXT)) if (k.startsWith('SAJU.')) expect(v).not.toMatch(/점수|퍼센트|순위|판정|%/);
  });
});
