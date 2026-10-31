/**
 * @jest-environment node
 */
// IF5-QF2 앱 — 가해 의도 카드 · 갈래 겹침 카드: 화면 쪽 앞거름(데모 · 코드 없는 길)과 서버 모의(/api/ai/…)가 같은 답을 낸다.
//  실호출 0 · 네트워크 0 · 모의 응답만. 팀장이 직접 넣어 확인한 문장 여섯 + 겹침 문장.
import { AIT_TEXT } from '@/content/aitCopy';
import { localPrecheckCard } from '@/features/ait/localPrecheck';
import { parseCard, type AitCard } from '@/features/ait/aitTypes';
import { cardEndsSession, cardLinesOverride, isComposed } from '@/features/ait/safetyCard';
import * as clientFixed from '@/saju5/ait/fixed';
import { createCounters } from '@/server/ait';
import { BRIDGE_MINOR, BRIDGE_VIOLENCE, HARM_INTENT_CARD, LINE_109, LINE_112, LINE_1366, LINE_1388 } from '@/server/ait/fixed';
import { createAitRoute, type RouteEnv, type Upstream } from '@/server/ait/route';
import { prepareChatText } from '@/server/saju5/input5';

const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');
const SIGN = 'test-signing-secret-' + 'abcd'.repeat(6);
const HOST = 'lovedecide--demo.expo.app';
const ENV = { AI_ACCESS_CODE: CODE, AIT_SIGN_KEY: SIGN } as unknown as RouteEnv;

function route() {
  let clock = Date.UTC(2026, 10, 1, 3, 0, 0);
  const r = createAitRoute({
    env: () => ENV,
    makeUpstream: () => ({ create: async () => ({ data: { stop_reason: 'end_turn', content: [], usage: {} }, workspaceId: 'x' }) }) as Upstream,
    now: () => (clock += 11_000),
    counters: createCounters(),
    lock: { live: false },
    sink: () => undefined,
  });
  return async (body: unknown) => {
    const res = await r(new Request(`https://${HOST}/api/ai/x`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ait-code': CODE, host: HOST }, body: JSON.stringify(body) }));
    return { status: res.status, json: (await res.json()) as Record<string, any> };
  };
}

// 화면이 한 장으로 그리는 줄: 줄을 그대로 그리는 카드는 그 줄, 아니면 카피 23-5 키 줄(CARD_LINES — AitParts 와 같은 표)
const KEYS: Record<string, string[]> = {
  crisis: ['crisis.l1', 'crisis.l2', 'crisis.l3', 'crisis.l4'],
  violence: ['violence.l1', 'violence.l2', 'violence.l3', 'violence.l4'],
  misuse: ['misuse.l1', 'misuse.l2'],
  minor: ['minor.l1', 'minor.l2'],
};
const shown = (c: AitCard): string[] => [...(cardLinesOverride(c) ?? KEYS[c.id].map((k) => AIT_TEXT[`CONCERN_CARD.${k}` as keyof typeof AIT_TEXT]))];

const CASES: { text: string; id: string | null; end?: boolean }[] = [
  { text: '남자친구가 제 위치를 추적하고 있어요', id: 'violence' },
  { text: '제가 남친 위치를 추적하고 있어요', id: 'misuse' },
  { text: '우리 아이가 만 5세예요', id: null },
  { text: '혼자 해요', id: null },
  { text: '남편을 죽이고 싶어요', id: 'harm_intent' },
  { text: '남편이 때려서 죽고 싶어요', id: 'crisis' },
  { text: '저는 고2인데 죽고싶어요', id: 'crisis', end: true },
  { text: '죽고 싶어요', id: 'crisis' },
  { text: '남자친구가 어제 저를 때렸어요', id: 'violence' },
  { text: '저는 고등학생이에요', id: 'minor', end: true },
  { text: '그 사람 휴대폰을 몰래 보고 싶어요', id: 'misuse' },
];

describe('IF5-QF2 화면 앞거름(데모) = 서버 모의: 같은 카드 · 같은 줄', () => {
  test('팀장이 직접 넣어 확인한 문장: 카드 종류', () => {
    for (const c of CASES) expect(localPrecheckCard(c.text)?.id ?? null).toBe(c.id);
  });

  test('앞거름 응답(precheck) 줄 = 화면이 그리는 줄 · 세션 마침 판단도 같다', async () => {
    const post = route();
    for (const c of CASES) {
      const local = localPrecheckCard(c.text);
      const srv = await post({ feature: 's5_chat', text: c.text, precheck: true });
      if (c.id === null) {
        expect(local).toBeNull();
        expect(srv.json.code).toBe('ok');
        continue;
      }
      expect(srv.json.card.id).toBe(c.id);
      const serverCard = parseCard(srv.json.card)!;
      // 화면이 그리는 줄(앞거름) = 서버가 보낸 줄(카피 키 줄과 서버 고정 줄이 같은 글이어야 한다)
      expect(shown(local!)).toEqual(shown(serverCard));
      expect(shown(local!)).toEqual(srv.json.card.lines);
      expect(cardEndsSession(local!)).toBe(c.end === true);
      expect(cardEndsSession(serverCard)).toBe(c.end === true);
      expect(local!.options).toEqual(c.end ? ['end'] : srv.json.card.options);
    }
  });

  test('서버 모의 준비 함수(prepareChatText)와 앞거름이 같은 카드를 낸다', () => {
    for (const c of CASES.filter((x) => x.id !== null)) {
      const prep = prepareChatText(c.text);
      expect(prep.kind).toBe('card');
      if (prep.kind !== 'card') continue;
      const local = localPrecheckCard(c.text)!;
      expect(local.id).toBe(prep.card.id);
      expect(shown(local)).toEqual([...prep.card.lines]);
      expect(cardEndsSession(local)).toBe(c.id === 'minor' || prep.endSession);
    }
  });

  test('가해 의도: 제목 · 위로 · 112 · 109 · 상담 아님 — 1366 0 · 폭력 카드 4번째 줄 0 · 차감 0', () => {
    const card = localPrecheckCard('남편을 죽이고 싶어요')!;
    expect(card.id).toBe('harm_intent');
    const lines = shown(card);
    expect(lines).toEqual([...HARM_INTENT_CARD.lines]);
    expect(lines).toEqual(['지금 마음이 많이 격해졌나 봐요', '잠깐 그 자리에서 벗어나 숨을 고르셔도 돼요.', LINE_112, LINE_109, '저희가 전화 상담을 대신하지 않아요.']);
    expect(lines.join(' ')).not.toMatch(/1366|이해하려고/);
    expect(HARM_INTENT_CARD.charge).toBe(0);
    expect(card.options).toEqual(['continue', 'end']);
  });

  test('위기 + 폭력: 위로 줄 bridge.violence 가 1366 바로 위 · 안전 확인 줄 앞 · 폭력 4번째 줄 0', () => {
    const card = localPrecheckCard('남편이 때려서 죽고 싶어요')!;
    expect(card.id).toBe('crisis');
    expect(card.also).toEqual(['violence']);
    const lines = shown(card);
    const i = lines.indexOf(BRIDGE_VIOLENCE);
    expect(i).toBeGreaterThan(-1);
    expect(lines[i + 1]).toBe(LINE_1366);
    expect(lines[i + 2]).toBe(AIT_TEXT['CONCERN_CARD.crisis.l4']); // 바탕 카드의 안전 확인 줄이 맨 끝
    expect(lines).toHaveLength(i + 3);
    expect(lines).toContain(LINE_109);
    expect(lines.join(' ')).not.toContain('이해하려고');
    expect(lines).not.toContain(LINE_1388);
    expect(cardEndsSession(card)).toBe(false);
    expect(card.options).toEqual(['continue', 'end']);
  });

  test('위기 + 미성년: bridge.minor 가 1388 바로 위 · 세션 마침 · 단추는 end 하나', () => {
    const card = localPrecheckCard('저는 고2인데 죽고싶어요')!;
    expect(card.id).toBe('crisis');
    expect(card.also).toEqual(['minor']);
    const lines = shown(card);
    const i = lines.indexOf(BRIDGE_MINOR);
    expect(i).toBeGreaterThan(-1);
    expect(lines[i + 1]).toBe(LINE_1388);
    expect(cardEndsSession(card)).toBe(true);
    expect(card.options).toEqual(['end']);
  });

  test('서버가 also 를 안 보내도(replyCard 는 id · lines · options 만) 줄에서 겹침 · 마침을 알아본다', () => {
    const bare = parseCard({ id: 'crisis', lines: ['a', BRIDGE_MINOR, LINE_1388, 'z'], options: ['continue', 'end'] })!;
    expect(bare.also).toBeUndefined();
    expect(isComposed(bare)).toBe(true);
    expect(cardEndsSession(bare)).toBe(true);
    const plain = parseCard({ id: 'crisis', lines: ['서버 줄'], options: ['continue', 'end'] })!;
    expect(isComposed(plain)).toBe(false);
    expect(cardLinesOverride(plain)).toBeNull(); // 한 갈래 카드는 계속 카피 키로 그린다(서버 줄을 안 쓴다)
    expect(cardEndsSession(plain)).toBe(false);
    expect(parseCard({ id: 'crisis', lines: [], options: ['end'], also: ['violence', 3, 'minor'] })!.also).toEqual(['violence', 'minor']);
  });

  test('화면 쪽 고정 카드 사본 = 서버 고정 카드(같은 글)', () => {
    expect(clientFixed.HARM_INTENT_CARD.lines).toEqual(HARM_INTENT_CARD.lines);
    expect(clientFixed.BRIDGE_VIOLENCE).toBe(BRIDGE_VIOLENCE);
    expect(clientFixed.BRIDGE_MINOR).toBe(BRIDGE_MINOR);
    expect(clientFixed.LINE_1366).toBe(LINE_1366);
  });
});
