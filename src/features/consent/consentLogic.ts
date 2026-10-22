// 03 동의 화면의 체크 규칙(동의문구 3-2 · 3-3, K2 03 입력 검증). 화면 없이 값만 바꾸는 순수 함수라서 시험으로 확인한다.
//  · 처음 들어오면 전부 해제다(사전 체크 없음)
//  · 맨 위 칸 "필수 항목 모두 동의"는 필수 7칸만 묶는다. 선택 2칸(CK4 · CK9)은 따로 눌러야 체크된다
//    - 켜면 필수 7칸이 모두 켜지고, 끄면 필수 7칸이 모두 꺼진다. 선택 칸은 그대로다
//    - 필수 7칸을 하나씩 모두 켜면 맨 위 칸도 켜지고, 그중 하나를 끄면 맨 위 칸도 꺼진다(켜짐 여부는 필수 칸에서 계산한다)
//  · 체크한 칸을 다시 누르면 해제된다
//  · [동의하고 계속]은 필수 7칸이 모두 켜져야 눌린다. 비어 있는 채로 누르면 오류 문구를 보이고 빈 칸을 강조한다(R7)
import { CONSENT_ITEMS } from '@/content/consentContent';
import { CONSENT_CODES, type ConsentCode, type ConsentItemContent } from '@/content/types';

export type Checked = Readonly<Record<ConsentCode, boolean>>;

export const ITEMS: readonly ConsentItemContent[] = CONSENT_ITEMS;
export const REQUIRED_CODES: readonly ConsentCode[] = ITEMS.filter((item) => item.required).map((item) => item.code);
export const REQUIRED_SET: ReadonlySet<ConsentCode> = new Set(REQUIRED_CODES);

export const emptyChecked = (): Checked => Object.fromEntries(CONSENT_CODES.map((code) => [code, false])) as Checked;

// 화면에 보이는 칸 중 필수인 것
export const requiredOf = (shown: readonly ConsentCode[]): ConsentCode[] => shown.filter((code) => REQUIRED_SET.has(code));

export function toggleItem(checked: Checked, code: ConsentCode): Checked {
  return { ...checked, [code]: !checked[code] };
}

// 필수 칸이 모두 켜져 있다 = 맨 위 칸이 켜진다. 보이는 필수 칸이 하나도 없으면 켜진 것으로 보지 않는다(맨 위 칸 자체를 그리지 않는다)
export function allRequiredChecked(checked: Checked, shown: readonly ConsentCode[]): boolean {
  const required = requiredOf(shown);
  return required.length > 0 && required.every((code) => checked[code]);
}

// 맨 위 칸을 눌렀을 때: 필수가 모두 켜져 있으면 필수만 모두 끄고, 아니면 필수를 모두 켠다. 선택 칸은 건드리지 않는다
export function toggleAllRequired(checked: Checked, shown: readonly ConsentCode[]): Checked {
  const required = requiredOf(shown);
  const next = !allRequiredChecked(checked, shown);
  return { ...checked, ...Object.fromEntries(required.map((code) => [code, next])) } as Checked;
}

// 아직 체크하지 않은 필수 칸(눌렀을 때 강조한다)
export const missingRequired = (checked: Checked, shown: readonly ConsentCode[]): ConsentCode[] => requiredOf(shown).filter((code) => !checked[code]);

// [동의하고 계속]이 눌릴 수 있는가
export const canSubmit = (checked: Checked, shown: readonly ConsentCode[]): boolean => missingRequired(checked, shown).length === 0;

// 처음 들어올 때는 9칸 모두, 문구가 바뀐 뒤에는 바뀐 칸만 보인다(동의문구 3-5)
export function shownCodes(changed: readonly ConsentCode[] | null): ConsentCode[] {
  return changed === null ? [...CONSENT_CODES] : CONSENT_CODES.filter((code) => changed.includes(code));
}
