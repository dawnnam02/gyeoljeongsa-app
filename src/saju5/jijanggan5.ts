// IF5-F1b · 지장간(地藏干) 표 — 12지 → 숨은 천간(여기 · 중기 · 정기). 데이터는 ts/data/jijanggan5.json.
// 상태: 통설(만세력에 흔한 월률분야 표) · 서적별 원문 대조 미확인 · 역술 자문 전 가안. 갈래는 jijanggan5.json 의 variants 에 적었다.
// 의존성: saju_calc5.ts(천간 · 지지 이름 · 십성 · 본기 천간). 정기 = 본기 천간(BRANCH_MAIN_STEM)과 같아야 하며 시험이 확인한다.

import jijangJson from './data/jijanggan5.json';
import { BRANCH_MAIN_STEM, STEMS, sipsung } from './saju_calc5.ts';

export type HiddenRole = 'yeogi' | 'junggi' | 'jeonggi';
export interface HiddenStem {
  stem: number;                   // 0 갑 … 9 계
  name: string;                   // '갑' …
  role: HiddenRole;               // 여기 · 중기 · 정기
  roleKo: string;                 // '여기' · '중기' · '정기'
  days: number;                   // 절입 뒤 30일 가운데 이 천간이 쓰이는 날 수
}
export interface HiddenStemVariant { branch: number; name: string; hidden: Array<[number, number | null]>; note: string }

interface Raw {
  note: string; status: string;
  branches: Array<{ branch: number; ko: string; hanja: string; hidden: Array<[number, number]> }>;
  variants: HiddenStemVariant[];
}
const RAW = jijangJson as unknown as Raw;

export const HIDDEN_STEM_STATUS: string = RAW.status;
const ROLE_KO: Record<HiddenRole, string> = { yeogi: '여기', junggi: '중기', jeonggi: '정기' };

function roleAt(i: number, n: number): HiddenRole {
  if (i === n - 1) return 'jeonggi';
  return i === 0 ? 'yeogi' : 'junggi';
}

/** 지지 번호(0 자 … 11 해) → 숨은 천간 목록(여기 → 중기 → 정기 차례). 2개(자 · 묘 · 유) 또는 3개. */
export function hiddenStems(branch: number): HiddenStem[] {
  if (!Number.isInteger(branch) || branch < 0 || branch > 11) throw new Error('bad_branch');
  const hid = RAW.branches[branch].hidden;
  return hid.map(([stem, days], i) => {
    const role = roleAt(i, hid.length);
    return { stem, name: STEMS[stem], role, roleKo: ROLE_KO[role], days };
  });
}

/** 내 일간 기준으로 숨은 천간마다 십성 이름을 붙여서 돌려준다. */
export function hiddenStemSipsung(dayStem: number, branch: number): Array<HiddenStem & { sipsung: string }> {
  return hiddenStems(branch).map((h) => ({ ...h, sipsung: sipsung(dayStem, h.stem) }));
}

/** 이 지지의 정기(마지막 숨은 천간). 본기 천간(BRANCH_MAIN_STEM)과 같다. */
export const hiddenMainStem = (branch: number): number => BRANCH_MAIN_STEM[branch];

/** 표마다 다른 갈래(통설과 다르게 적는 표). 출처는 미확인이라 화면에 쓰지 말고 역술 자문용 참고로만 둔다. */
export function hiddenStemVariants(branch: number): HiddenStemVariant[] {
  return RAW.variants.filter((v) => v.branch === branch);
}
