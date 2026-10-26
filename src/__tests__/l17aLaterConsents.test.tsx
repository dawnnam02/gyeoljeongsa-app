// L17A(법무 L17 1 · 2차 앱 반영): 03 밖 선택 동의 CK11 ~ CK16 — 판 형식(DB 검사) · 글(동의문구 4-11 ~ 4-16) · 12 동의 관리 줄 · 정치 막대 · CK16 카드 · 탑승권 계약 설명 · 탈퇴 크레딧 줄
import type { ReactTestRenderer } from 'react-test-renderer';

import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { CK10_TEXT_VERSION } from '@/config/gradeConsent';
import { CONSENT_TEXT_VERSION_SHAPE, LATER_CONSENT_VERSIONS } from '@/config/laterConsent';
import { CONSENT_LATER_ITEMS, CONSENT_LATER_NAMES } from '@/content/consentContent';
import { LEGAL_TERMS } from '@/content/legalTerms';
import { CONSENT_LATER, CONSENT_MANAGE, WITHDRAW } from '@/content/settingsCopy';
import { CHAT_V6 } from '@/content/surveyChatCopy';
import { LATER_CONSENT_CODES } from '@/content/types';
import { termsArticle } from '@/features/consent/TermsArticleSheet';
import { ConsentManagePage } from '@/features/settings/ConsentManagePage';
import { CHAT_SERVER } from '@/features/surveyChat/api';
import { POL_SERVER } from '@/features/surveyV2/politics';
import { POL } from '@/features/surveyV2/politicsCopy';
import type { OptionalCode, SettingsApi } from '@/lib/settingsApi';

import { has, hasText, isOpen, mount, press, textOf } from './renderHelpers';

jest.setTimeout(60_000);
jest.mock('@/lib/services', () => ({ settingsApi: {}, supabase: {} }));

const propOf = (tree: ReactTestRenderer, id: string, key: string): any => tree.root.findAll((n) => n.props.testID === id && n.props[key] !== undefined)[0]?.props[key];

describe('판 형식 — DB 검사(0001 consents.text_version)', () => {
  test('CK15 판은 consent-2026.10.26-v1(판_관리 2-1 · D-190) — 옛 가정값(consent-2026.10.22-가정)은 형식 위반이었다', () => {
    expect(POL_SERVER.consentVersion).toBe('consent-2026.10.26-v1');
    expect(CONSENT_TEXT_VERSION_SHAPE.test('consent-2026.10.22-가정')).toBe(false);
  });
  test('앱이 기록하는 모든 동의 판(CK1 ~ CK16)이 DB 검사 모양이다', () => {
    const all = [...Object.values(CONSENT_TEXT_VERSIONS), CK10_TEXT_VERSION, ...Object.values(LATER_CONSENT_VERSIONS), POL_SERVER.consentVersion, CHAT_SERVER.consentVersion];
    expect(all.length).toBe(9 + 1 + 6 + 2);
    for (const v of all) expect(v).toMatch(/^consent-[0-9]{4}[.][0-9]{2}[.][0-9]{2}-v[0-9]+$/);
    expect(Object.keys(LATER_CONSENT_VERSIONS)).toEqual([...LATER_CONSENT_CODES]);
  });
});

describe('글 — 동의문구 1-1 · 4-11 ~ 4-16 (gen:legal)', () => {
  test('CK11 ~ CK16 여섯 칸: 이름 · 체크 문구 · 요약 · 전문이 있고, 요약에 버튼 글(전문 보기 ›)은 섞이지 않는다', () => {
    expect(CONSENT_LATER_NAMES.map((n) => n.code)).toEqual([...LATER_CONSENT_CODES]);
    expect(CONSENT_LATER_ITEMS.map((i) => i.code)).toEqual([...LATER_CONSENT_CODES]);
    for (const i of CONSENT_LATER_ITEMS) {
      expect(i.required).toBe(false);
      expect(i.label.startsWith('[선택] ')).toBe(true);
      expect(i.summary.length).toBeGreaterThan(2);
      expect(i.summary.some((s) => s.startsWith('전문 보기'))).toBe(false);
      expect(i.fullText.length).toBeGreaterThan(2);
      expect(i.more).toBe('전문 보기 ›');
    }
  });
  test('CK16 카드 글 = 4-16 · 정치 막대 POL9 ~ POL12 = 4-15', () => {
    const ck16 = CONSENT_LATER_ITEMS.find((i) => i.code === 'CK16')!;
    expect(CHAT_V6['CHAT.CK16.why']).toBe(ck16.why);
    expect(CHAT_V6['CHAT.CK16.optional']).toBe(ck16.note);
    expect(CHAT_V6['CHAT.CK16.more']).toBe(ck16.more);
    expect(ck16.summary).toContain(`보관: ${CHAT_V6['CHAT.CK16.keep']}`);
    expect(ck16.summary).toContain(`거두기: ${CHAT_V6['CHAT.CK16.withdraw']}`);
    const ck15 = CONSENT_LATER_ITEMS.find((i) => i.code === 'CK15')!;
    expect([POL.consentTitle, POL.consentBody, POL.consentNote, POL.consentCheck]).toEqual([ck15.title, ck15.why, ck15.note, ck15.label]);
  });
  test('탑승권 계약 설명: 약관 제14조의2 글을 그대로 잘라 온다(③ 결혼중개 계약 설명 포함)', () => {
    const a = termsArticle('제14조의2');
    expect(a?.title).toBe('제14조의2 (탑승권과 크레딧)');
    expect(a?.blocks.length).toBeGreaterThan(3);
    expect(a?.blocks.some((b) => 'text' in b && b.text.includes('결혼중개 계약'))).toBe(true);
    expect(LEGAL_TERMS.length).toBeGreaterThan(a!.blocks.length);
  });
  test('탈퇴 크레딧 줄은 해요체 한 줄 · 약관 제22조 ⑧ 뜻(남은 크레딧 못 씀)', () => {
    expect(WITHDRAW.credit).toMatch(/크레딧은 쓸 수 없게 돼요/);
    expect(WITHDRAW.credit).not.toMatch(/[!]|합니다/);
  });
});

describe('12 동의 관리 — CK11 ~ CK16 줄', () => {
  function api(on: Partial<Record<OptionalCode, boolean>>) {
    const a = {
      loadConsents: jest.fn(async () => ({ ok: true as const, data: { CK4: false, CK9: false, CK10: false, CK11: false, CK12: false, CK13: false, CK14: false, CK15: false, CK16: false, ...on } })),
      setOptional: jest.fn(async () => ({ ok: true as const })),
    };
    return a as unknown as jest.Mocked<Pick<SettingsApi, 'loadConsents' | 'setOptional'>>;
  }
  const show = (a: Pick<SettingsApi, 'loadConsents' | 'setOptional'>) => mount(<ConsentManagePage api={a} onBack={() => undefined} onToast={() => undefined} />);

  test('여섯 줄이 1-1 이름으로 보이고(CK16 은 글 쓰는 속도 분석), 꺼진 CK11 ~ CK15 는 잠김 + "처음 쓸 때 따로 물어요."', async () => {
    const tree = await show(api({}));
    for (const { code, name } of CONSENT_LATER_NAMES) {
      const label = propOf(tree, `settings-consent-${code}`, 'accessibilityLabel');
      expect(label).toBe(code === 'CK16' ? '[선택] 글 쓰는 속도 분석' : `[선택] ${name}`);
      expect(propOf(tree, `settings-consent-${code}`, 'accessibilityState').disabled).toBe(code !== 'CK16');
    }
    expect(hasText(tree, CONSENT_LATER.askLater)).toBe(true);
  });

  test('CK16 켜기 → 확인창 없이 기록, 끄기 → 확인창 → 철회', async () => {
    const a = api({});
    const tree = await show(a);
    await press(tree, 'settings-consent-CK16');
    expect(a.setOptional).toHaveBeenLastCalledWith('CK16', true);
    await press(tree, 'settings-consent-CK16');
    expect(isOpen(tree, 'settings-later-off')).toBe(true);
    expect(textOf(tree, 'settings-later-off-title')).toBe(CONSENT_LATER.offTitle);
    await press(tree, 'settings-later-off-confirm');
    expect(a.setOptional).toHaveBeenLastCalledWith('CK16', false);
  });

  test('켜져 있는 CK15 끄기 → 탑승권 안내가 든 확인창 → 철회 · 취소면 그대로', async () => {
    const a = api({ CK15: true });
    const tree = await show(a);
    expect(propOf(tree, 'settings-consent-CK15', 'accessibilityState').disabled).toBe(false);
    await press(tree, 'settings-consent-CK15');
    expect(hasText(tree, CONSENT_LATER.ck15OffBody)).toBe(true);
    await press(tree, 'settings-later-off-cancel');
    expect(a.setOptional).not.toHaveBeenCalled();
    await press(tree, 'settings-consent-CK15');
    await press(tree, 'settings-later-off-confirm');
    expect(a.setOptional).toHaveBeenCalledWith('CK15', false);
    expect(propOf(tree, 'settings-consent-CK15', 'accessibilityState').checked).toBe(false);
  });

  test('보기 › 줄: 필수 7 + CK11 ~ CK16 6 — CK15 는 4-15 요약 시트(전문 보기)', async () => {
    const tree = await show(api({}));
    for (const code of LATER_CONSENT_CODES) expect(has(tree, `settings-consent-view-${code}`)).toBe(true);
    await press(tree, 'settings-consent-view-CK15');
    expect(has(tree, 'consent-summary-CK15')).toBe(true);
    expect(hasText(tree, CONSENT_LATER_ITEMS.find((i) => i.code === 'CK15')!.summary[0])).toBe(true);
    expect(CONSENT_MANAGE.view).toBe('보기 ›');
  });
});
