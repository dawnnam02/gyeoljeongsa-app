// QF2-B9 [1] 사주 '종합 풀이'(full)를 모든 길(데모 · 실서버 · AI 서버 판)에서 끈다 — 값 고지와 실제 차감이 어긋나서.
//  서버 값표는 saju_full 이지만 ai-run 에는 종합 기능이 없어 풀이 · 대운 · 올해가 따로 차감된다(합이 더 크다). 화면이 알린 값과 청구가 다르면 안 된다.
//  끄는 곳은 한 곳: FORTUNE_TRIM.fullReading(false). 코드는 그대로 두어 true 한 줄로 켠다.
//  들어가는 문(코드 위치): ① SajuMadangScreen 종합 풀이 카드(saju-full-card) ② AiBlock kind='full' ③ runAi kind='full' ④ 마일리지 가격표 풀이 줄(priceRows) — 사주 마당 메뉴(SajuYardScreen)에는 처음부터 없음.
import fs from 'node:fs';
import path from 'node:path';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { FORTUNE_TRIM } from '@/config/fortuneTrim';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi, type MileageApi } from '@/features/mileage/mileageApi';
import { priceRows } from '@/features/mileage/mileageLogic';
import { MileageScreen } from '@/features/mileage/MileageScreen';
import type { MileageDeps } from '@/features/mileage/mileageService';
import { AiBlock } from '@/features/saju/ai/AiBlock';
import { createAiResults } from '@/features/saju/ai/aiResults';
import { runAi } from '@/features/saju/ai/aiRun';
import type { AiServices } from '@/features/saju/ai/aiService';
import { memoryInputStorage } from '@/features/saju/deviceInput';

import { allTexts, has, mount } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, router: mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: () => undefined, Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));

jest.setTimeout(60_000);
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  Object.assign(FORTUNE_TRIM, { fullReading: false });
});

const flagsAll = () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])) as Record<string, boolean>;
const src = (...p: string[]) => path.join(__dirname, '..', ...p);
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(path.join(d, e.name))) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []));

describe('QF2-B9 [1] 종합 풀이 끔 — 기본값 · 들어가는 문 목록', () => {
  test('끄는 곳은 FORTUNE_TRIM.fullReading 한 곳, 기본 꺼짐', () => {
    expect(FORTUNE_TRIM.fullReading).toBe(false);
  });

  test('문 목록 고정: kind="full" 은 사주 마당 한 곳뿐이고 그 문은 FORTUNE_TRIM.fullReading 뒤에 있다 · 사주 마당 메뉴(SajuYardScreen · sajuYardLogic)에는 종합 풀이가 없다', () => {
    const files = walk(src());
    const doors = files.filter((f) => /kind="full"/.test(strip(fs.readFileSync(f, 'utf8')))).map((f) => path.relative(src(), f).replace(/\\/g, '/'));
    expect(doors).toEqual(['features/saju/SajuMadangScreen.tsx']);
    expect(strip(fs.readFileSync(src('features/saju/SajuMadangScreen.tsx'), 'utf8'))).toMatch(/FORTUNE_TRIM\.fullReading && aiOn/);
    for (const f of ['features/saju/SajuYardScreen.tsx', 'features/saju/sajuYardLogic.ts', 'features/saju/sajuYardCopy.ts']) {
      expect(strip(fs.readFileSync(src(f), 'utf8'))).not.toMatch(/saju_full|kind="full"|SAJU\.full|종합 풀이/);
    }
  });

  test('saju_full 값 이름이 나오는 소스는 정해진 곳뿐(차감표 키 이름 · 서버 키 목록 · 내역 이름 · 가격표 안 꺼짐 조건 · 데모 차감표) — 값을 그리는 곳은 FORTUNE_TRIM 뒤', () => {
    const where = walk(src())
      .filter((f) => /saju_full/.test(strip(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(src(), f).replace(/\\/g, '/'))
      .sort();
    expect(where).toEqual(['demo/mileageDemo.ts', 'features/mileage/mileageApi.ts', 'features/mileage/mileageLogic.ts', 'features/saju/ai/aiRun.ts']);
    const logic = strip(fs.readFileSync(src('features/mileage/mileageLogic.ts'), 'utf8'));
    expect(logic).toMatch(/FORTUNE_TRIM\.fullReading \? \[\.\.\.READ_FEATURES, 'saju_full'\] : READ_FEATURES/);
    expect(strip(fs.readFileSync(src('features/saju/ai/aiRun.ts'), 'utf8'))).toMatch(/req\.kind === 'full' && !FORTUNE_TRIM\.fullReading/);
    expect(strip(fs.readFileSync(src('features/saju/ai/AiBlock.tsx'), 'utf8'))).toMatch(/p\.kind === 'full' && !FORTUNE_TRIM\.fullReading\) return null/);
  });
});

describe('QF2-B9 [1] 실행 · 칸 · 값 줄 0', () => {
  test('runAi kind="full": 세 길(모의 · AI 서버 판 · 실서버) 모두 점검 한 줄 — 요청 0 · 장부 호출 0', async () => {
    for (const route of ['mock', 'eas', 'ai-run'] as const) {
      const edge = { hold: jest.fn(), settle: jest.fn(), release: jest.fn() };
      const post = jest.fn();
      const fetchImpl = jest.fn();
      const out = await runAi(
        { edge, code: () => (route === 'eas' ? 'ait-code' : null), post, route, env: { url: 'https://x.test', apikey: 'k', token: async () => 'tok', fetch: fetchImpl } },
        { kind: 'full', requestId: 'r', chars: 0, facts: { a: 1 }, full: { reading: { a: 1 }, daewoon: { a: 2 }, sinyeon: { a: 3 } } },
      );
      expect(out).toEqual({ kind: 'maint' });
      expect(edge.hold).not.toHaveBeenCalled();
      expect(edge.settle).not.toHaveBeenCalled();
      expect(edge.release).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  test('AiBlock kind="full": 사실을 다 줘도 · 서버 차감표에 saju_full 이 있어도 칸이 그려지지 않는다(이름 · 값 줄 · 버튼 0)', async () => {
    const flags = flagsAll();
    const demo = createDemoMileage({ flags: async () => flags });
    const call = async (fn: string, args: Record<string, unknown> = {}) => demo.rpc({ id: 'u-b9', email: 'b9@email.com' }, fn, args) as never;
    const api = createMileageApi(call);
    const ai: AiServices = { mileage: api, edge: createLedgerEdge(call), consent: createIf5ConsentStore(), results: createAiResults(memoryInputStorage()), code: async () => null, route: 'mock' };
    const tree = await mount(
      <AiBlock id="saju-full" kind="full" svc={ai} showLabel facts={() => ({ a: 1 })} fullFacts={() => ({ reading: { a: 1 }, daewoon: { a: 2 }, sinyeon: { a: 3 } })} store={{ feature: 'full', tag: '2027' }} />,
    );
    mounted.push(tree);
    await wait(100);
    expect(has(tree, 'saju-full-ai')).toBe(false);
    expect(has(tree, 'saju-full-ai-btn')).toBe(false);
    expect(has(tree, 'saju-full-ai-cost')).toBe(false);
    expect(allTexts(tree).join(' ')).not.toMatch(/종합|마일리지/);
    // 서버 차감표에는 값이 있다(데모 차감표 saju_full) — 그래도 그리지 않는다
    const s = await api.state();
    expect(s.ok && s.data.costs.some((c) => c.feature === 'saju_full')).toBe(true);
  });

  test('마일리지 가격표 풀이 줄: 서버가 saju_full 값을 더 싸게 내려 줘도 그 값을 쓰지 않는다 · 켜면(true) 한 줄로 돌아온다', () => {
    const costs = [
      { feature: 'saju_reading', cost: 800 },
      { feature: 'daewoon', cost: 1000 },
      { feature: 'saju_full', cost: 111 },
    ];
    expect(priceRows(costs)).toEqual([{ key: 'read', cost: 800, from: true }]);
    expect(priceRows([{ feature: 'saju_full', cost: 111 }])).toEqual([]); // saju_full 만 있으면 풀이 줄 자체가 없다
    FORTUNE_TRIM.fullReading = true;
    expect(priceRows(costs)).toEqual([{ key: 'read', cost: 111, from: true }]); // 한 줄로 되돌릴 수 있다
  });

  test('마일리지 화면(가격표): 서버 값표에 싼 saju_full 이 끼어도 화면 어디에도 그 값이 없다', async () => {
    const flags = flagsAll();
    const demo = createDemoMileage({ flags: async () => flags });
    const call = async (fn: string, args: Record<string, unknown> = {}) => demo.rpc({ id: 'u-b9', email: 'b9@email.com' }, fn, args) as never;
    const base = createMileageApi(call);
    const api: MileageApi = {
      ...base,
      state: async () => {
        const r = await base.state();
        if (!r.ok) return r;
        return { ok: true as const, data: { ...r.data, costs: [...r.data.costs.filter((c) => c.feature !== 'saju_full'), { feature: 'saju_full', label: '사주 종합 풀이', cost: 111, base: 111, extra: 0, confirm: false }] } };
      },
    };
    const deps: MileageDeps = { api, edge: createLedgerEdge(call), isOn: (k) => flags[k] === true };
    const tree = await mount(<MileageScreen deps={deps} />);
    mounted.push(tree);
    await wait(120);
    expect(has(tree, 'mileage-table')).toBe(true);
    const text = allTexts(tree).join(' ');
    expect(text).not.toMatch(/\b111\b/);
    expect(text).not.toContain('종합');
  });
});
