// [3] 안심 공유 문장 만들기(순수 함수, K12 2-3 '문장 만들기는 순수 함수 하나로 분리' · 규칙 3-01~3-05).
//  · 기기 안에서만 만든다. 서버 · 분석 도구로 아무것도 보내지 않는다
//  · 장소 · 메모 · 날짜와 시간은 사용자가 쓴 글 그대로(위치 · 지도 링크 없음, 3-02). 비어 있으면 빈 값
//  · 상대 정보는 스위치를 켠 때만(처음값 꺼짐, D-74 ⑩), 넣는 것은 '성+OO' · 나이 둘뿐(3-03). 이름 전체가 들어와도 첫 글자 + OO 로 가린다.
//    사진 · 학교 · 직장 · 연락처 · 키 · 연봉 같은 값은 받는 자리 자체가 없다(3-04)
//  · 문장은 500자 이하(3-05): 넘으면 메모를 빼고, 그래도 넘으면 500자에서 자른다
//  · 문장 틀은 마케팅 확정 글(NF3-05)이 들어올 자리다. 1단계는 키 이름이 보인다(content/v4Wave01Copy.ts)
import { V4W01 } from '@/content/v4Wave01Copy';

export const SHARE_TEXT_MAX = 500;
export const SHARE_WHEN_MAX = 30; // 날짜와 시간 칸(글로 쓴다 — 날짜 고르기 부품은 새 패키지가 필요해 1단계에 없다)
export const SHARE_PLACE_MAX = 60;
export const SHARE_MEMO_MAX = 40;

export type SharePartner = { name: string; age: number | null };
export type SharePlan = { when: string; place: string; memo: string; includePartner: boolean; partner: SharePartner | null };

const clip = (text: string, max: number) => Array.from(text.trim()).slice(0, max).join('');

// '박OO' → '박OO', '박서준' → '박OO'. 첫 글자만 남긴다
export function maskedName(name: string): string | null {
  const first = Array.from(name.trim())[0];
  return first ? `${first}OO` : null;
}

const validAge = (age: number | null): number | null => (typeof age === 'number' && Number.isInteger(age) && age >= 19 && age < 100 ? age : null);

// max 는 시험에서 줄여 '넘을 때' 규칙을 본다(화면은 늘 500)
export function buildShareText(plan: SharePlan, max: number = SHARE_TEXT_MAX): string {
  const when = clip(plan.when, SHARE_WHEN_MAX);
  const place = clip(plan.place, SHARE_PLACE_MAX);
  const memo = clip(plan.memo, SHARE_MEMO_MAX);
  const name = plan.includePartner && plan.partner ? maskedName(plan.partner.name) : null;
  const age = plan.includePartner && plan.partner ? validAge(plan.partner.age) : null;
  const parts = (withMemo: boolean) =>
    [
      V4W01.share.text.head,
      V4W01.share.text.plan(when === '' ? null : when, place === '' ? null : place),
      name ? V4W01.share.text.partner(name, age) : null,
      V4W01.share.text.closing,
      withMemo && memo !== '' ? V4W01.share.text.memo(memo) : null,
    ]
      .filter((x): x is string => x !== null)
      .join(' ');
  const full = parts(true);
  if (Array.from(full).length <= max) return full;
  const short = parts(false);
  return Array.from(short).slice(0, max).join('');
}
