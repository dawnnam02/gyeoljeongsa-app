// 상대 생일 음력 선택(QF2 Q2-09 · 기획 QF2-09 · 정책 PS-21 · 61 개정) — 변환은 기기 안(saju5/lunar5 의 표 · 네트워크 0).
//  · 서버 · AI 로 가는 것은 변환된 양력 8자리 하나뿐이다 — 음력 원값은 이 파일 밖으로 나가지 않는다 · 저장 0 · 로그 0 · 클립보드 0
//  · 만 19세 판정 · 범위(1961-08-10 이후)는 호출한 쪽(partnerLocal)이 변환된 양력으로 본다
//  · 윤달은 음력일 때만. 없는 달 · 없는 날 · 표 밖 해는 이유별 오류로 돌려준다(계산 단추 잠김)
import { LunarError, lunarToSolar } from '@/saju5/lunar5';

import { isRealDate } from './sajuLogic';

export type CalMode = 'solar' | 'lunar';
export type CalErrorKey = 'invalid' | 'range' | 'leapMonth' | 'day';
export type CalLine =
  | { kind: 'hint' } // 날짜를 다 넣기 전
  | { kind: 'ok'; mode: CalMode; year: number; month: number; day: number; solarDigits: string } // 계산에 쓸 양력
  | { kind: 'error'; key: CalErrorKey };

const LUNAR_FIRST_YEAR = 1960; // 표 범위(만세력 표 1960-01-01 ~ 2051-12-31)
const LUNAR_LAST_YEAR = 2051;
const two = (n: number) => String(n).padStart(2, '0');

export function convertBirth(digits: string, mode: CalMode, leap: boolean): CalLine {
  if (!/^\d{8}$/.test(digits)) return { kind: 'hint' };
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (mode === 'solar') {
    if (!isRealDate(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`)) return { kind: 'error', key: 'invalid' };
    return { kind: 'ok', mode, year: y, month: m, day: d, solarDigits: digits };
  }
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 30) return { kind: 'error', key: 'invalid' }; // 음력에 있을 수 없는 날짜
  if (y < LUNAR_FIRST_YEAR || y > LUNAR_LAST_YEAR) return { kind: 'error', key: 'range' };
  try {
    const s = lunarToSolar(y, m, d, leap);
    return { kind: 'ok', mode, year: s.year, month: s.month, day: s.day, solarDigits: `${String(s.year).padStart(4, '0')}${two(s.month)}${two(s.day)}` };
  } catch (e) {
    const code = e instanceof LunarError ? e.code : 'invalid_date';
    if (code === 'no_such_lunar_day') return { kind: 'error', key: 'day' };
    if (code === 'no_such_lunar_month') return { kind: 'error', key: leap ? 'leapMonth' : 'range' };
    if (code === 'out_of_range') return { kind: 'error', key: 'range' };
    return { kind: 'error', key: 'invalid' };
  }
}
