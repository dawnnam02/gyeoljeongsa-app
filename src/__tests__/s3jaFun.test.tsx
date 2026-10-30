// 3부-자 연애 기능 묶음 — 검수 QP-43(안 탄 분 기내지) · QP-44(홈 회차 번호 0) · QP-45(같은 취미 끈 글) · QP-46(동의 시트 저절로 0) · QP-48(흐린 칸 대비 4.5+) · QP-49(궁합 ① 줄)
//  + 열두 타입 · 짐 싸기 7 · 열두 여행지를 라이브러리 원본으로(데모 타입 = fun_calc 같은 값) + 07 · 04 끝 [내 여행 타입 보기] 입구.
//  서버 · AI 호출 0 — 라이브러리(content/if2Library.json ← ai/IF2/문구_라이브러리.json) · 데모 모의 서버만 읽는다.
import fs from 'node:fs';
import path from 'node:path';

import { StyleSheet, Text } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import art from '../../assets/illustrations/if2art.json';
import { CK17 } from '@/content/ck17Content';
import lib from '@/content/if2Library.json';
import { travelType, typeRoutes, talkStyle, typeId, TYPE_ORDER } from '@/demo/funCalc';
import { demoTypeSource } from '@/demo/typeDemo';
import type { BoardingState } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { TicketCard } from '@/features/boarding/TicketCard';
import { TraitsScreen, type TraitsDeps } from '@/features/ai/TraitsScreen';
import { TYPE_ENTRY_HREF } from '@/features/ai/typeEntry';
import { createDeviceNotes } from '@/features/inflight/deviceNotes';
import { HomeCell } from '@/features/inflight/If2Parts';
import { Ck17Sheet } from '@/features/inflight/If2Sheets';
import { isPacked, PACK_COUNT, PACK_QUIZ, packedItems, sameLines, travelTypeOf, tripPlaceOf } from '@/features/inflight/if2Library';
import { tx, txSeq } from '@/features/inflight/if2Text';
import type { InflightApi, Magazine } from '@/features/inflight/inflightApi';
import { magazineNoneKind } from '@/features/inflight/inflightLogic';
import { MagazineScreen } from '@/features/inflight/MagazineScreen';
import { TypeCardScreen } from '@/features/inflight/TypeCardScreen';
import { LOUNGE } from '@/features/lounge/loungeCopy';
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';
import { DEMO_AI_RESULT } from '@/lib/demoAiSample';
import { colors } from '@/theme/tokens';
import type { AiRow } from '@/types/ai';

import { allTexts, has, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]), Stack: { Screen: () => null }, Redirect: () => null };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
const mockLoadLatest = jest.fn();
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: { loadLatest: (...a: unknown[]) => mockLoadLatest(...a) }, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/store', () => ({ useSignupStore: { getState: () => ({ setStage: jest.fn(), resetAll: jest.fn() }) } }));

jest.setTimeout(90_000);

const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  jest.clearAllMocks();
});
const ids = (tree: ReactTestRenderer, re: RegExp) => [...new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && re.test(n.props.testID)).map((n) => n.props.testID as string))];
const inner = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props.testID === id).at(-1);

// ── 대비(WCAG 상대 휘도) — 토큰 값으로 계산
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

// ── 라이브러리 원본 대조용 읽기
const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('QP-43 이번 회차에 안 탄 분이 기내지에 오면 notBoarded(탑승권 상태로 가림)', () => {
  const none: Magazine = { state: 'none' };
  const api = (m: Magazine | 'off'): Pick<InflightApi, 'magazine' | 'weekCard' | 'pickWeekCard' | 'preQuestions'> => ({
    magazine: async () => (m === 'off' ? { ok: false, code: 'off' } : { ok: true, data: m }),
    weekCard: async () => ({ ok: true, data: { state: 'none' } }),
    pickWeekCard: async () => ({ ok: false, code: 'none' }),
    preQuestions: async () => ({ ok: true, data: { state: 'none', questions: [] } }),
  });
  const boarding = (phase: string, ticket: unknown) => async () => ({ phase, ticket }) as unknown as BoardingState;
  const ck17 = { load: async () => ({ ok: true as const, data: { a: false, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
  const open = async (m: Magazine | 'off', b?: () => Promise<BoardingState | null>) => {
    const tree = keep(await mount(<MagazineScreen deps={{ api: api(m), ck17, ...(b ? { boarding: b } : {}) }} />));
    await wait();
    return tree;
  };

  test('판정: 판매 중 · 마감 뒤 공개 전인데 탑승권이 없을 때만 notBoarded · 그 밖은 closed', () => {
    expect(magazineNoneKind({ phase: 'on_sale', ticket: null })).toBe('notBoarded');
    expect(magazineNoneKind({ phase: 'closed', ticket: null })).toBe('notBoarded');
    expect(magazineNoneKind({ phase: 'on_sale', ticket: { roundNo: 1 } })).toBe('closed'); // 탔고 닫힘(탑승 취소 포함)
    expect(magazineNoneKind({ phase: 'revealed', ticket: null })).toBe('closed'); // 공개 뒤: 다 같이 닫힘
    expect(magazineNoneKind({ phase: 'before_sale', ticket: null })).toBe('closed');
    expect(magazineNoneKind(null)).toBe('closed'); // 탑승권 상태를 못 읽음 = 지금 글
  });

  test('안 탄 분: 기내지는 이번 회차 탑승객에게 열려요 + [탑승권으로] · 쪽 0 · 맛보기 0', async () => {
    const tree = await open(none, boarding('on_sale', null));
    expect(textOf(tree, 'mag-none-text')).toBe(tx('MAGAZINE.notBoarded'));
    expect(allTexts(tree)).not.toContain(tx('MAGAZINE.closed'));
    expect(has(tree, 'mag-pager')).toBe(false);
    expect(has(tree, 'mag-cover')).toBe(false);
    await press(tree, 'mag-home');
    expect(mockRouter.replace).toHaveBeenCalledWith('/boarding');
  });

  test('탔는데 닫힌 분 · 스위치 꺼짐 · 탑승권 상태를 못 읽음 = 이번 호는 착륙과 함께 닫혔어요', async () => {
    expect(textOf(await open(none, boarding('revealed', { roundNo: 1 })), 'mag-none-text')).toBe(tx('MAGAZINE.closed'));
    expect(textOf(await open(none, boarding('on_sale', { roundNo: 1 })), 'mag-none-text')).toBe(tx('MAGAZINE.closed'));
    expect(textOf(await open('off', boarding('on_sale', null)), 'mag-none-text')).toBe(tx('MAGAZINE.closed'));
    expect(textOf(await open(none, async () => null), 'mag-none-text')).toBe(tx('MAGAZINE.closed'));
    expect(textOf(await open(none), 'mag-none-text')).toBe(tx('MAGAZINE.closed')); // 연결을 안 준 화면(옛 시험)
  });
});

describe('QP-44 홈 B1 탑승권 표에 회차 번호 0(정책 PF-08)', () => {
  test('BOARDING.round 는 글 하나 "이번 주" · 탑승권 칸 · 읽기 이름에 회차 번호 0', async () => {
    expect(BOARDING.round).toBe('이번 주');
    const tree = keep(await mount(<TicketCard roundNo={7} regionName="수도권" when="12월 23일 수요일 오후 6시" status="탑승 완료" />));
    expect(textOf(tree, 'ticket-round')).toBe('이번 주');
    const label = String(must(tree, 'ticket').props.accessibilityLabel);
    expect(label).toContain('이번 주');
    expect(label).not.toMatch(/\d+회차/);
    expect(allTexts(tree).filter((t) => /\d+회차/.test(t))).toEqual([]);
    const none = keep(await mount(<TicketCard roundNo={null} regionName={null} when={null} status="아직 사지 않았어요" />));
    expect(has(none, 'ticket-round')).toBe(false); // 회차가 없으면 칸째 없음
  });
  test('홈 밖(T3 공개 · 사기 시트 · T5 내역)의 회차 번호는 그대로', () => {
    expect(read('features/boarding/RevealScreen.tsx')).toContain('REVEAL.kicker(CREDITS.round(result.roundNo))');
    expect(read('features/boarding/BoardingScreen.tsx')).toContain('BOARDING.sheet.summary(CREDITS.round(state.round.no)');
  });
});

describe('T4 작별 엽서(기획 화면 요구 287 · 정책 PF-57 · 팀장 10-29): 푸시 없음 — 시트 · 말풍선 글에 알림 말 0', () => {
  test('FAREWELL 글에 알림 · 푸시 · 알려 드려요 꼴 0 · 고른 문장은 한 줄 안에서 고침(거르기) · 실패하면 나가지 않음 한 줄', () => {
    const src = read('features/inflight/if2CopyData.ts');
    const lines = src.split(/\r?\n/).filter((l) => l.startsWith('  "FAREWELL.'));
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines) expect(l).not.toMatch(/알림|푸시|알려 ?드|전해 ?드/);
    expect(tx('FAREWELL.pick.edit')).toBe('고쳐 쓰기');
    expect(tx('FAREWELL.failed')).toContain('다시 시도');
    const t = read('features/inflight/ChatIf2.tsx').replace(/\/\/.*$/gm, '');
    expect(t).not.toMatch(/푸시|notification|expo-notifications/i);
  });
});

describe('QP-45 · QP-46 카피 반영', () => {
  test('같은 취미 끈 글(21-17): 1.0 같은 점은 취미뿐이라 다른 같은 점 말 0 · 첫마디 실마리도 빠진다고 말함', () => {
    expect(tx('PROFILE.sameHobby.offNote')).toBe('꺼 두면 짝과 같은 취미가 궁합 카드와 첫마디 실마리에 나오지 않아요.');
    expect(tx('PROFILE.sameHobby.offNote')).not.toContain('다른 같은 점');
  });
  test('기내지 ① 쪽 버튼 글 = 동의하고 보기 · 옛 [동의 관리 열기] 키 0', () => {
    expect(tx('FUN.ck17.agreeView')).toBe('동의하고 보기');
    expect(Object.keys(lib).length).toBeGreaterThan(0);
    const src = read('features/inflight/if2CopyData.ts');
    expect(src).not.toContain('"FUN.ck17.link"');
    expect(src).not.toContain('"PAIR_CARD.same.line"');
    expect(src).toContain('"FUN.ck17.agreeView"');
  });
  test('기내지 코드에 동의 시트를 저절로 띄우는 길 0(쪽에 닿을 때 setSheet 없음 · 이번 실행 asked 메모 없음)', () => {
    const t = read('features/inflight/MagazineScreen.tsx').replace(/\/\/.*$/gm, '');
    expect(t).not.toMatch(/asked\s*=\s*new Set|asked\.has|asked\.add/);
    expect((t.match(/setSheet\('ck17'\)/g) ?? []).length).toBe(1); // 버튼 onPress 한 곳뿐
    expect(t).toMatch(/onPress=\{\(\) => setSheet\('ck17'\)\}/);
  });
});

describe('QP-48 흐린 칸 글 대비 4.5+(투명도 대신 sub 토큰)', () => {
  test('토큰 대비: sub 글은 bg · card 면 위에서 4.5 이상', () => {
    expect(contrast(colors.sub, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.sub, colors.card)).toBeGreaterThanOrEqual(4.5);
  });
  test('아직 열 수 없는 홈 칸(기내지 발행 전): 투명도 0 · 이름 글 sub · 그림 sub', async () => {
    const off = keep(await mount(<HomeCell icon="magazine" name="기내지" line="목요일 아침에 나와요" testID="cell-off" />));
    const on = keep(await mount(<HomeCell icon="magazine" name="기내지" line="경주행 이번 호" onPress={() => undefined} testID="cell-on" />));
    const flat = (tree: ReactTestRenderer, id: string) => StyleSheet.flatten(inner(tree, id)?.props.style as never) as { opacity?: number };
    expect(flat(off, 'cell-off').opacity).toBeUndefined();
    const nameColor = (tree: ReactTestRenderer, id: string) => (StyleSheet.flatten(inner(tree, `${id}-name`)?.props.style as never) as { color?: string }).color;
    expect(nameColor(off, 'cell-off')).toBe(colors.sub);
    expect(nameColor(on, 'cell-on')).toBe(colors.text);
    expect(contrast(nameColor(off, 'cell-off') as string, colors.card)).toBeGreaterThanOrEqual(4.5);
  });
  test('동의 시트 ②: ①에 동의하기 전에도 투명도 0 · 글 sub(왜 못 고르는지 알리는 글이 읽힘)', async () => {
    const tree = keep(await mount(<Ck17Sheet visible onClose={() => undefined} onSave={async () => true} />));
    await wait();
    const b = inner(tree, 'if2-ck17-b');
    const style = StyleSheet.flatten(b?.props.style as never) as { opacity?: number };
    expect(style.opacity).toBeUndefined();
    expect(tree.root.findAll((n) => n.props.testID === 'if2-ck17-b' && n.props.disabled === true).length).toBeGreaterThan(0); // 누를 수 없는 칸(①에 동의해야 고름)
    const labelColor = (id: string) => {
      const row = tree.root.findAll((n) => n.props.testID === id)[0];
      const label = row.findAllByType(Text).find((t) => (t.props.children as unknown) === (id.endsWith('-b') ? CK17.checkB : CK17.checkA));
      return (StyleSheet.flatten(label?.props.style as never) as { color?: string }).color;
    };
    expect(labelColor('if2-ck17-b')).toBe(colors.sub); // ①에 동의하기 전: 못 고르는 칸은 sub 색(흐림 0)
    expect(labelColor('if2-ck17-a')).toBe(colors.text);
    expect(contrast(colors.sub, colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
  test('기내 서비스 화면 코드에 alpha.disabled 로 흐리는 곳 0(투명도 흐림 = 글 대비 1.7 ~ 2.4)', () => {
    const dir = path.join(SRC, 'features', 'inflight');
    for (const f of fs.readdirSync(dir).filter((n) => /\.tsx$/.test(n))) {
      const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
      expect(`${f}: ${/alpha\.disabled|alpha\.dim\b/.test(t)}`).toBe(`${f}: false`);
    }
  });
});

describe('QP-49 궁합 카드 ① 두 분 다 — 머리 한 번 + 줄은 …을 좋아해요(줄 안 두 분 다 0 · 겹말 0)', () => {
  test('코드 하나 · 둘 · 갈래 · 받침에 맞는 조사 · 두 줄까지', () => {
    expect(sameLines([{ code: 'reading' }])).toEqual(['독서·공부를 좋아해요']);
    expect(sameLines([{ code: 'reading' }, { code: 'travel' }])).toEqual(['독서·공부와 여행을 좋아해요']);
    expect(sameLines([{ code: 'travel' }, { code: 'food' }])).toEqual([`${QUESTION_COPY.E11?.opt?.travel}과 ${QUESTION_COPY.E11?.opt?.food}를 좋아해요`]);
    expect(sameLines([{ group: 'move' }])).toEqual([tx('PAIR_CARD.hobbyGroup.move')]);
    expect(sameLines([{ code: 'reading' }, { group: 'out' }])).toEqual(['독서·공부를 좋아해요', '밖에서 보내는 시간을 좋아해요']);
    expect(sameLines([{ group: 'home' }, { group: 'out' }, { code: 'game' }]).length).toBeLessThanOrEqual(2);
    expect(sameLines([])).toEqual([]);
    expect(sameLines([{ group: 'other' }])).toEqual([]); // 모르는 갈래는 그리지 않음
    for (const l of sameLines([{ code: 'reading' }, { code: 'travel' }])) expect(l).not.toContain('두 분 다');
  });
  test('같은 이름 자리가 여럿인 글: 앞 {취미}에 첫째 · 뒤 {취미}에 둘째(조사 따로)', () => {
    expect(txSeq('PAIR_CARD.same.two', { 취미: ['독서·공부', '여행'] })).toBe('독서·공부와 여행을 좋아해요');
    expect(txSeq('PAIR_CARD.same.two', { 취미: ['여행', '독서·공부'] })).toBe('여행과 독서·공부를 좋아해요');
    expect(txSeq('PAIR_CARD.same.two', { 취미: ['여행'] })).toBe('여행과 여행을 좋아해요'); // 값이 모자라면 마지막 값을 다시
  });
  test('갈래 문장 셋은 문장 하나(… 좋아해요) · 숫자 · 느낌표 · 라이브러리 틀(cc-hobby)을 더 쓰지 않음', () => {
    for (const k of ['move', 'out', 'home'] as const) expect(tx(`PAIR_CARD.hobbyGroup.${k}`)).toMatch(/좋아해요$/);
    expect(read('features/inflight/if2Library.ts').replace(/\/\/.*$/gm, '')).not.toMatch(/cc-hobby/);
  });
});

describe('내 여행 타입 12 — 계산명세 10-1(fun_calc.travel_type) 같은 값', () => {
  const T = (extraversion: number, planning: number, conflict: number) => travelType({ extraversion, planning, conflict });
  test('경계: 외향성 · 계획성 50 = 높음 · 49 = 낮음 / 갈등 대처 33 이하 차분 · 67 이상 솔직 · 사이 다정(대화 방식 없을 때)', () => {
    expect(T(50, 50, 50)).toBe('tt-08'); // 여럿 · 계획 · 다정
    expect(T(49, 49, 50)).toBe('tt-05'); // 조용히 · 즉흥 · 다정
    expect(T(49, 50, 33)).toBe('tt-01'); // 조용히 · 계획 · 차분
    expect(T(49, 50, 34)).toBe('tt-02');
    expect(T(49, 50, 66)).toBe('tt-02');
    expect(T(49, 50, 67)).toBe('tt-03');
    expect(T(50, 49, 33)).toBe('tt-10'); // 여럿 · 즉흥 · 차분
    expect(T(50, 49, 67)).toBe('tt-12');
  });
  test('0 ~ 100 격자 전수: 12타입이 모두 나오고 오류 0 · 가족 중심 · 경제관은 쓰지 않는다(입력에 없음)', () => {
    const seen = new Set<string>();
    for (let e = 0; e <= 100; e += 5) for (let p = 0; p <= 100; p += 5) for (const c of [0, 33, 34, 50, 66, 67, 100]) seen.add(T(e, p, c) as string);
    expect(seen.size).toBe(12);
    expect([...seen].sort()).toEqual(Array.from({ length: 12 }, (_, i) => typeId(i)));
  });
  test('대화 방식 4칸이 있으면 그 값: 차분 = 신중함 · 다정 = (따뜻함 + 표현) / 2 · 솔직 = 솔직함 중 가장 큰 쪽 · 같으면 차분 → 다정 → 솔직', () => {
    expect(talkStyle({ deliberation: 70, expressiveness: 40, warmth: 40, candor: 50 }, 50)).toBe('calm');
    expect(talkStyle({ deliberation: 30, expressiveness: 80, warmth: 70, candor: 50 }, 50)).toBe('warm');
    expect(talkStyle({ deliberation: 30, expressiveness: 40, warmth: 40, candor: 90 }, 50)).toBe('frank');
    expect(talkStyle({ deliberation: 60, expressiveness: 60, warmth: 60, candor: 60 }, 50)).toBe('calm');
    expect(talkStyle({ deliberation: 10, expressiveness: 60, warmth: 60, candor: 60 }, 50)).toBe('warm');
    expect(talkStyle(null, null)).toBeNull();
    expect(travelType({ extraversion: 60, planning: 60, conflict: null })).toBeNull(); // 대화 방식도 갈등 대처도 없으면 타입 0
  });
  test('타입 이름 차례 = 계산명세 표(tt-01 ~ 12) · 노선 두 역 = 규칙(자기 0 · 모든 타입이 두 번씩 · ②는 서로)', () => {
    const names = ['기차 창가 여행자', '엽서 쓰는 여행자', '지도 접는 여행자', '골목 산책 여행자', '작은 책방 여행자', '필름 카메라 여행자', '길잡이 깃발 여행자', '도시락 싸는 여행자', '시간표 여행자', '모닥불 여행자', '장터 구경 여행자', '자전거 여행자'];
    names.forEach((n, i) => expect(travelTypeOf(typeId(i))?.name).toBe(n));
    expect(lib.travelTypes).toHaveLength(12);
    const indeg: Record<string, number> = {};
    for (let i = 0; i < 12; i += 1) {
      const id = typeId(i);
      const [a, b] = typeRoutes(id);
      expect(a).not.toBe(id);
      expect(b).not.toBe(id);
      expect(travelTypeOf(id)?.routes.map((r) => r.to)).toEqual([a, b]); // 라이브러리 노선 = 규칙
      expect(typeRoutes(b)[1]).toBe(id); // ②는 서로를 가리킴
      for (const x of [a, b]) indeg[x] = (indeg[x] ?? 0) + 1;
      const t = TYPE_ORDER[i];
      expect(travelTypeOf(id)).toMatchObject({ energy: t[0], plan: t[1], style: t[2] });
    }
    expect(new Set(Object.values(indeg))).toEqual(new Set([2]));
  });
});

describe('데모 모의 서버의 타입 = 계산명세 10-1 식(fun_calc 같은 값)', () => {
  const rowOf = (traits: Record<string, number>, over: Partial<AiRow> = {}) => ({ ok: true, row: { id: 'r', status: 'ok', source: 'ai', retryCount: 0, createdAt: null, confirmedAt: '2026-10-29T00:00:00Z', original: { traits: DEMO_AI_RESULT.traits, tags: [], summary: '', evidence: [] }, edited: { traits, tags: [], summary: '' }, ...over } });
  test('확정한 성향(수정본이 있으면 수정본)의 5축으로 타입 id 를 정한다', async () => {
    mockLoadLatest.mockResolvedValueOnce(rowOf({ extraversion: 80, planning: 20, family: 50, economy: 50, conflict: 50 }));
    expect(await demoTypeSource.mine()).toBe('tt-11'); // 여럿 · 즉흥 · 다정
    mockLoadLatest.mockResolvedValueOnce(rowOf({ extraversion: 20, planning: 80, family: 90, economy: 10, conflict: 10 }, { edited: null }));
    expect(await demoTypeSource.mine()).toBe(travelType(DEMO_AI_RESULT.traits)); // 수정본이 없으면 AI 원본
    mockLoadLatest.mockResolvedValueOnce(rowOf({ extraversion: 20, planning: 80, family: 0, economy: 100, conflict: 20 }));
    expect(await demoTypeSource.mine()).toBe('tt-01'); // 가족 중심 · 경제관은 쓰지 않는다
  });
  test('확정 전 · 정리 실패 · 읽기 실패는 타입 0(칸째 숨김)', async () => {
    mockLoadLatest.mockResolvedValueOnce(rowOf({ extraversion: 80, planning: 20, family: 50, economy: 50, conflict: 50 }, { confirmedAt: null }));
    expect(await demoTypeSource.mine()).toBeNull();
    mockLoadLatest.mockResolvedValueOnce(rowOf({ extraversion: 80, planning: 20, family: 50, economy: 50, conflict: 50 }, { status: 'failed' }));
    expect(await demoTypeSource.mine()).toBeNull();
    mockLoadLatest.mockResolvedValueOnce({ ok: false, reason: 'network' });
    expect(await demoTypeSource.mine()).toBeNull();
    mockLoadLatest.mockRejectedValueOnce(new Error('x'));
    expect(await demoTypeSource.mine()).toBeNull();
  });
  test('타입 계산 코드는 데모 폴더에만(기내 서비스 화면 · API 파일은 funCalc 를 가져오지 않는다 — 실서버에는 타입 계산이 아직 없음)', () => {
    const dir = path.join(SRC, 'features', 'inflight');
    for (const f of fs.readdirSync(dir).filter((n) => /\.(ts|tsx)$/.test(n))) expect(`${f}: ${/funCalc|travelType\(|typeRoutes\(/.test(fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, ''))}`).toBe(`${f}: false`);
  });
});

describe('라이브러리 원본: 타입 12 · 짐 싸기 7 · 여행지 12 · 그림 33', () => {
  test('열두 타입: 앞면 한 줄 · 설명 세 줄 · 노선 두 역(까닭) · 대화 팁 / 판정 · 우열 · 숫자 말 0', () => {
    for (const t of lib.travelTypes) {
      expect(t.desc).toHaveLength(3);
      expect(t.routes).toHaveLength(2);
      for (const r of t.routes) expect(r.why.length).toBeGreaterThan(10);
      const all = [t.name, t.line, ...t.desc, ...t.routes.map((r) => r.why), t.tip].join(' ');
      expect(all).not.toMatch(/\d|[!！]|잘 맞|안 맞|상극|최고|1등|희귀|퍼센트|점수|등급/);
    }
  });
  test('짐 싸기 7문항 · 문항마다 보기 3 · 짐 코드 21개가 겹치지 않음', () => {
    expect(PACK_COUNT).toBe(7);
    expect(PACK_QUIZ.every((q) => q.options.length === 3)).toBe(true);
    const items = PACK_QUIZ.flatMap((q) => q.options.map((o) => o.item));
    expect(items).toHaveLength(21);
    expect(new Set(items).size).toBe(21);
  });
  test('열두 여행지: trip_no 1 ~ 12 = 라운지 여행지 이름 차례 · 글 한 편 + 둘이 하기 좋은 일 한 줄', () => {
    expect(lib.tripPlaces.map((p) => p.trip_no)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(lib.tripPlaces.map((p) => p.name)).toEqual([...LOUNGE.trip.names]);
    for (const p of lib.tripPlaces) {
      expect(p.body.length).toBeGreaterThan(30);
      expect(p.together.length).toBeGreaterThan(10);
    }
    expect(tripPlaceOf(1)?.name).toBe('경주');
    expect(tripPlaceOf(13)).toBeNull();
    expect(tripPlaceOf(null)).toBeNull();
  });
  test('그림: 타입 소재 12 · 짐 소품 21이 라이브러리 코드와 1:1 · 글자 0 · 토큰 밖 색 0', () => {
    const typeCodes = lib.travelTypes.map((t) => t.code);
    expect(Object.keys(art.types).sort()).toEqual([...typeCodes].sort());
    const itemCodes = PACK_QUIZ.flatMap((q) => q.options.map((o) => o.item));
    expect(Object.keys(art.items).sort()).toEqual([...itemCodes].sort());
    const tokenHex = new Set(Object.values(colors).map((c) => c.toUpperCase()));
    for (const xml of [...Object.values(art.types), ...Object.values(art.items)] as string[]) {
      expect(xml).not.toMatch(/<text|<image|<filter/);
      for (const m of xml.matchAll(/#[0-9A-Fa-f]{6}/g)) expect(tokenHex.has(m[0].toUpperCase())).toBe(true);
    }
    expect(art.typeSky).toContain('<rect');
    expect(art.typeSky).not.toContain('<path'); // 하늘 띠 + 테두리만(그림은 뺌)
  });
});

describe('IF-TYPE 내 여행 타입 화면 — 짐 싸기 → 엽서 → 뒷면', () => {
  const ALL = ['thermos', 'paper_map', 'umbrella', 'postcard', 'notebook', 'plant', 'stamp_book'];
  test('짐을 아직 안 쌌으면 짐 싸기부터(엽서 0) · 문항 7 · 답할 때마다 가방에 하나 · 진행 숫자 0 · [나중에 하기]는 뒤로', async () => {
    const notes = createDeviceNotes();
    const tree = keep(await mount(<TypeCardScreen source={{ mine: async () => 'tt-07' }} notes={notes} />));
    await wait();
    expect(has(tree, 'type-quiz')).toBe(true);
    expect(has(tree, 'type-postcard')).toBe(false);
    expect(textOf(tree, 'type-quiz-intro')).toBe(tx('TYPE_CARD.quiz.intro'));
    expect(textOf(tree, 'type-quiz-note')).toBe(tx('TYPE_CARD.quiz.picksNote'));
    for (let i = 0; i < PACK_COUNT; i += 1) {
      expect(textOf(tree, 'type-quiz-question')).toBe(PACK_QUIZ[i].q);
      expect(ids(tree, new RegExp(`^type-quiz-${i}-`))).toHaveLength(3);
      expect(allTexts(tree).filter((t) => /\d/.test(t))).toEqual([]); // 문항 수 · 진행 숫자 0
      if (i === 1) expect(String(must(tree, 'type-quiz-bag').props.accessibilityLabel)).toBe(tx('TYPE_CARD.a11y.bag', { '짐 이름 차례': '따뜻한 보온병' }));
      await press(tree, `type-quiz-${i}-${ALL[i]}`);
      await wait(10);
    }
    expect(notes.get().typeBag).toEqual(ALL); // 기기에만
    expect(isPacked(notes.get().typeBag)).toBe(true);
    expect(has(tree, 'type-quiz')).toBe(false);
    expect(has(tree, 'type-postcard')).toBe(true);
    const later = keep(await mount(<TypeCardScreen source={{ mine: async () => 'tt-07' }} notes={createDeviceNotes()} />));
    await wait();
    await press(later, 'type-quiz-later');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  test('엽서 앞: 타입 소재 하나 + 고른 짐 일곱 · 이름 · 앞면 한 줄 · 읽기 이름에 한 줄과 소품 / 뒷면: 설명 세 줄 · 노선도 두 역(이름 + 까닭) · 끝줄 · 대화 팁 0', async () => {
    const notes = createDeviceNotes();
    notes.set('typeBag', ALL);
    const tree = keep(await mount(<TypeCardScreen source={{ mine: async () => 'tt-07' }} notes={notes} />));
    await wait();
    const t = travelTypeOf('tt-07');
    if (!t) throw new Error('타입');
    expect(textOf(tree, 'type-name')).toBe(t.name);
    expect(textOf(tree, 'type-line')).toBe(t.line);
    expect(has(tree, 'type-postcard-type')).toBe(true);
    expect(ids(tree, /^type-postcard-item-/).sort()).toEqual(ALL.map((c) => `type-postcard-item-${c}`).sort());
    const label = String(must(tree, 'type-front').props.accessibilityLabel);
    expect(label).toContain(t.name);
    expect(label).toContain(t.line);
    expect(label).toContain('따뜻한 보온병');
    expect(label).not.toMatch(/, $/);
    await press(tree, 'type-flip');
    const back = allTexts(tree);
    for (const l of t.desc) expect(back).toContain(l);
    expect(back).toContain(tx('TYPE_CARD.route.mine'));
    const stations = t.routes.map((r) => ({ name: travelTypeOf(r.to)?.name ?? '', why: r.why }));
    stations.forEach((s, i) => {
      expect(textOf(tree, `type-route-${i}-name`)).toBe(s.name);
      expect(textOf(tree, `type-route-${i}-why`)).toBe(s.why);
    });
    expect(stations[0].name).not.toBe(stations[1].name); // 두 역 같은 무게 · 서로 다른 타입
    expect(String(must(tree, 'type-route').props.accessibilityLabel)).toBe(
      txSeq('TYPE_CARD.a11y.route', { '타입 이름': stations.map((s) => s.name), '역 까닭': stations.map((s) => s.why) }),
    );
    expect(String(must(tree, 'type-route').props.accessibilityLabel)).toContain(stations[0].why);
    expect(String(must(tree, 'type-route').props.accessibilityLabel)).toContain(stations[1].why);
    expect(back.join(' ')).not.toContain(t.tip); // 대화 팁은 1.1 — 1.0 화면에 안 그림
    expect(back).toContain(tx('TYPE_CARD.footer'));
    expect(back).not.toContain(tx('TYPE_CARD.share'));
    expect(back.filter((x) => /\d/.test(x))).toEqual([]);
  });

  test('짐 코드 21개가 문항 차례로만 엽서에 놓임: 다른 문항의 코드 · 모르는 코드는 버림(불완전하면 짐 싸기부터)', () => {
    expect(packedItems(['thermos', 'umbrella'])).toEqual(['thermos', null, 'umbrella', null, null, null, null]);
    expect(isPacked(['thermos', 'umbrella'])).toBe(false);
    expect(isPacked([...ALL, 'nope'])).toBe(true);
    expect(packedItems(['nope'])).toEqual([null, null, null, null, null, null, null]);
  });

  test('서버 값이 없는 실서버(타입 0): 불러오지 못함 한 줄 · 홈 칸 글: 타입은 있고 짐을 안 쌌으면 "짐을 싸면 엽서가 나와요"', async () => {
    const none = keep(await mount(<TypeCardScreen source={{ mine: async () => null }} notes={createDeviceNotes()} />));
    await wait();
    expect(textOf(none, 'type-none')).toBe(tx('TYPE_CARD.loadFailed'));
  });
});

describe('기내지 ⑤ 이번 여행지(계산명세 10-2): 여행지 글 + 둘이 하기 좋은 일 한 줄(모든 회원 같은 글)', () => {
  test('발행된 호의 trip_no 에 맞는 글 한 편이 ⑤ 쪽에 라이브러리 값 그대로', async () => {
    const mag: Magazine = { state: 'issued', issueDate: '2026-12-17', tripNo: 3, weekElement: 'wood', column: null, ck17a: false, sky: null, grain: null };
    const api = {
      magazine: async () => ({ ok: true as const, data: mag }),
      weekCard: async () => ({ ok: true as const, data: { state: 'none' as const } }),
      pickWeekCard: async () => ({ ok: false as const, code: 'none' }),
      preQuestions: async () => ({ ok: true as const, data: { state: 'none' as const, questions: [] } }),
    };
    const ck17 = { load: async () => ({ ok: true as const, data: { a: false, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
    const tree = keep(await mount(<MagazineScreen deps={{ api, ck17 }} />));
    await wait();
    for (let i = 0; i < 5; i += 1) await press(tree, 'mag-next'); // 표지 → ① ② ③ ④ ⑤
    const place = tripPlaceOf(3);
    expect(place?.name).toBe('전주');
    expect(textOf(tree, 'mag-place-body')).toBe(place?.body);
    expect(textOf(tree, 'mag-place-together')).toBe(place?.together);
    expect(allTexts(tree)).toContain(tx('MAGAZINE.page.placeSub', { 여행지: '전주' }));
  });
});

describe('07 확정 끝 [내 여행 타입 보기] 입구(정책 PF-33) — 안 눌러도 [다음] · 저절로 넘어감 0', () => {
  const row: AiRow = { id: 'r1', status: 'ok', source: 'ai', retryCount: 0, createdAt: null, confirmedAt: null, original: { traits: { ...DEMO_AI_RESULT.traits }, tags: [...DEMO_AI_RESULT.tags], summary: DEMO_AI_RESULT.summary, evidence: JSON.parse(JSON.stringify(DEMO_AI_RESULT.evidence)) }, edited: null };
  const deps = (): TraitsDeps => ({ api: { loadLatest: async () => ({ ok: true, row }), saveEdited: async () => ({ ok: true }), confirm: jest.fn(async () => ({ ok: true as const })), manual: async () => ({ kind: 'ok', resultId: 'r1' }) }, setStage: jest.fn() });
  const nav = () => mockRouter.replace.mock.calls.concat(mockRouter.push.mock.calls).map((c) => c[0]);

  test('type_card 켜짐: 확정하면 같은 화면에 입구 + [다음] 두 버튼 · 바로 넘어가지 않음 · 입구 = IF-TYPE · [다음] = 08(처음 한 번)', async () => {
    const tree = keep(await mount(<TraitsScreen deps={deps()} typeOn />));
    await wait();
    await press(tree, 'traits-confirm');
    await wait();
    expect(nav()).toEqual([]); // 저절로 넘어가지 않는다
    expect(has(tree, 'traits-confirm')).toBe(false);
    expect(must(tree, 'traits-type-entry').props.label).toBe(tx('TYPE_CARD.entry.open'));
    expect(must(tree, 'traits-type-entry').props.variant).toBe('secondary');
    expect(must(tree, 'traits-next').props.label).toBe('다음');
    await wait(200);
    expect(nav()).toEqual([]); // 기다려도 그대로
    await press(tree, 'traits-type-entry');
    expect(mockRouter.push).toHaveBeenCalledWith(TYPE_ENTRY_HREF);
    await press(tree, 'traits-next');
    expect(nav()).toContainEqual({ pathname: '/profile', params: { first: '1' } });
  });

  test('type_card 꺼짐(실서버 처음값): 지금처럼 확정하면 바로 08', async () => {
    const tree = keep(await mount(<TraitsScreen deps={deps()} />));
    await wait();
    await press(tree, 'traits-confirm');
    await wait();
    expect(nav()).toContainEqual({ pathname: '/profile', params: { first: '1' } });
    expect(has(tree, 'traits-type-entry')).toBe(false);
  });

  test('입구 글은 카피 21-5 TYPE_CARD.entry.open 키(코드 상수가 아님 — 3부-차 반영) · 권유 말 · 숫자 0', () => {
    expect(tx('TYPE_CARD.entry.open')).toBe('내 여행 타입 보기');
    expect(TYPE_ENTRY_HREF).toBe('/type-card');
    expect(tx('TYPE_CARD.entry.open')).not.toMatch(/\d|[!！]|꼭|지금/);
  });
});
