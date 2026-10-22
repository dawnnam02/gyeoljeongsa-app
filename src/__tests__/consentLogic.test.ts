// 03 동의 화면의 체크 규칙(동의문구 3-2 · 3-3, K2 03 입력 검증, F1 통과 조건 3 · 5): 순서 · 필수 7 / 선택 2 · 모두 동의 연동.
import { CONSENT_ITEMS, CONSENT_LINKS, CONSENT_NOTICE } from '@/content/consentContent';
import type { ConsentCode } from '@/content/types';
import {
  allRequiredChecked,
  canSubmit,
  emptyChecked,
  ITEMS,
  missingRequired,
  REQUIRED_CODES,
  requiredOf,
  shownCodes,
  toggleAllRequired,
  toggleItem,
} from '@/features/consent/consentLogic';

const ALL = shownCodes(null);
const REQUIRED = ['CK1', 'CK2', 'CK3', 'CK5', 'CK6', 'CK7', 'CK8'] as const;
const OPTIONAL = ['CK4', 'CK9'] as const;

describe('체크 칸 9개 구성 (동의문구 2-1 · 3-1)', () => {
  test('위에서 아래 CK1 ~ CK9 순서이고 필수 7 · 선택 2 이다', () => {
    expect(CONSENT_ITEMS.map((i) => i.code)).toEqual(['CK1', 'CK2', 'CK3', 'CK4', 'CK5', 'CK6', 'CK7', 'CK8', 'CK9']);
    expect(REQUIRED_CODES).toEqual([...REQUIRED]);
    expect(ITEMS.filter((i) => !i.required).map((i) => i.code)).toEqual([...OPTIONAL]);
  });

  test('체크 문구 앞에 [필수] · [선택]이 글자로 붙어 있다(색만으로 구분하지 않는다)', () => {
    for (const item of ITEMS) expect(item.label.startsWith(item.required ? '[필수] ' : '[선택] ')).toBe(true);
  });

  test('처음에는 전부 해제다(사전 체크 없음)', () => {
    const checked = emptyChecked();
    expect(Object.values(checked)).toHaveLength(9);
    expect(Object.values(checked).every((v) => v === false)).toBe(true);
    expect(canSubmit(checked, ALL)).toBe(false);
    expect(allRequiredChecked(checked, ALL)).toBe(false);
  });

  test('안내 상자는 체크 칸이 아니다: 제목 "알아 두세요", 체크 줄 9개에 들지 않는다', () => {
    expect(CONSENT_NOTICE.title).toBe('알아 두세요');
    expect(ITEMS.some((i) => i.label.includes(CONSENT_NOTICE.title))).toBe(false);
    expect(CONSENT_LINKS.line).toBe('이용약관 · 개인정보 처리방침 보기');
  });
});

describe('"필수 항목 모두 동의" 연동 (K2 03 입력 검증 · 동의문구 3-2 규칙 6 · 7)', () => {
  test('켜면 필수 7칸이 모두 켜지고 선택 2칸(CK4 · CK9)은 그대로다', () => {
    const next = toggleAllRequired(emptyChecked(), ALL);
    for (const code of REQUIRED) expect(next[code]).toBe(true);
    for (const code of OPTIONAL) expect(next[code]).toBe(false);
    expect(allRequiredChecked(next, ALL)).toBe(true);
  });

  test('선택 칸을 먼저 켜 둔 채로 켜고 끄면 선택 칸은 그대로다(끄면 필수 7칸만 꺼진다)', () => {
    const withOptional = toggleItem(toggleItem(emptyChecked(), 'CK4'), 'CK9');
    const on = toggleAllRequired(withOptional, ALL);
    expect(on.CK4 && on.CK9).toBe(true);
    const off = toggleAllRequired(on, ALL);
    for (const code of REQUIRED) expect(off[code]).toBe(false);
    expect(off.CK4 && off.CK9).toBe(true); // 선택 2칸은 건드리지 않는다
    expect(allRequiredChecked(off, ALL)).toBe(false);
  });

  test('필수 7칸을 하나씩 모두 켜면 맨 위 칸도 켜지고, 그중 하나를 끄면 맨 위 칸도 꺼진다', () => {
    let checked = emptyChecked();
    for (const [i, code] of REQUIRED.entries()) {
      expect(allRequiredChecked(checked, ALL)).toBe(false);
      checked = toggleItem(checked, code);
      if (i === REQUIRED.length - 1) expect(allRequiredChecked(checked, ALL)).toBe(true);
    }
    checked = toggleItem(checked, 'CK6');
    expect(allRequiredChecked(checked, ALL)).toBe(false);
  });

  test('선택 칸만 켜도 맨 위 칸은 켜지지 않는다(필수 7칸만 묶는다)', () => {
    expect(allRequiredChecked(toggleItem(toggleItem(emptyChecked(), 'CK4'), 'CK9'), ALL)).toBe(false);
  });

  test('체크한 칸을 다시 누르면 해제된다', () => {
    const on = toggleItem(emptyChecked(), 'CK1');
    expect(on.CK1).toBe(true);
    expect(toggleItem(on, 'CK1').CK1).toBe(false);
  });

  test('맨 위 칸을 두 번 누르면 원래대로 돌아온다', () => {
    const once = toggleAllRequired(emptyChecked(), ALL);
    const twice = toggleAllRequired(once, ALL);
    expect(twice).toEqual(emptyChecked());
  });
});

describe('[동의하고 계속] 활성 조건 (F1 조건 3 · 5)', () => {
  const checkedAll = () => toggleAllRequired(emptyChecked(), ALL);

  test('필수 7칸이 모두 켜져야 눌린다. 선택 칸은 켜지 않아도 된다', () => {
    expect(canSubmit(checkedAll(), ALL)).toBe(true);
    expect(missingRequired(checkedAll(), ALL)).toEqual([]);
  });

  test('필수 칸이 하나라도 비면 눌리지 않고, 비어 있는 칸이 어느 칸인지 알려 준다', () => {
    for (const code of REQUIRED) {
      const checked = toggleItem(checkedAll(), code);
      expect(canSubmit(checked, ALL)).toBe(false);
      expect(missingRequired(checked, ALL)).toEqual([code]);
    }
  });

  test('만 19세 이상 확인(CK2)을 체크하지 않으면 진행할 수 없다(F1 조건 5)', () => {
    const checked = toggleItem(checkedAll(), 'CK2');
    expect(checked.CK2).toBe(false);
    expect(canSubmit(checked, ALL)).toBe(false);
    expect(missingRequired(checked, ALL)).toContain('CK2');
  });

  test('선택 칸(CK4 · CK9)이 비어 있는 것은 오류가 아니다', () => {
    const checked = checkedAll();
    expect(missingRequired(checked, ALL)).not.toContain('CK4');
    expect(missingRequired(checked, ALL)).not.toContain('CK9');
  });
});

describe('문구가 바뀐 뒤: 바뀐 칸만 보인다 (동의문구 3-5, N28)', () => {
  const changed: ConsentCode[] = ['CK3', 'CK4'];

  test('보이는 칸 계산: 처음에는 9칸, 바뀐 뒤에는 바뀐 칸만(순서는 그대로)', () => {
    expect(shownCodes(null)).toHaveLength(9);
    expect(shownCodes(changed)).toEqual(['CK3', 'CK4']);
    expect(shownCodes(['CK9', 'CK1'])).toEqual(['CK1', 'CK9']);
  });

  test('"필수 항목 모두 동의"는 보이는 필수 칸만 묶는다', () => {
    const shown = shownCodes(changed);
    expect(requiredOf(shown)).toEqual(['CK3']);
    const next = toggleAllRequired(emptyChecked(), shown);
    expect(next.CK3).toBe(true);
    expect(next.CK1).toBe(false); // 보이지 않는 칸은 건드리지 않는다
    expect(canSubmit(next, shown)).toBe(true);
    expect(canSubmit(emptyChecked(), shown)).toBe(false);
  });

  test('바뀐 칸이 선택 칸뿐이면 필수 칸이 없어 바로 진행할 수 있고, 맨 위 칸은 켜진 것으로 보지 않는다', () => {
    const shown = shownCodes(['CK9']);
    expect(requiredOf(shown)).toEqual([]);
    expect(canSubmit(emptyChecked(), shown)).toBe(true);
    expect(allRequiredChecked(emptyChecked(), shown)).toBe(false);
  });
});
