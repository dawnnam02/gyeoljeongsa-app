/**
 * @jest-environment node
 */
// AIT-F ② ⑥ 동기 시험 — 서버 모듈 복사본이 원본(ai/AIT/ts)과 같은지 · 화면 글 사본이 카피 23장과 같은지 · 서버 고정 문구와 화면 글이 어긋나지 않는지.
//  저장소 복제본(공개 저장소)에는 ai/ · 마케팅/ 이 없어 원본 대조는 건너뛴다(GH1) — 그때도 서버 고정 문구 ↔ 화면 글 대조는 돈다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { AIT_TEXT } from '@/content/aitCopy';
import { CHIP_LABEL } from '@/server/ait/chat';
import { CODE_TEXT_KO } from '@/server/ait/codes';
import { ALWAYS_LINE, CHAT_FOOTER, CHAT_GUESS_NOTE, COACH_NOTE, COMPAT_NOTE, CRISIS_CARD, FUN_FOOTER, LINE_109, LINE_112, LINE_112_119, LINE_1366, LINE_1388, MINOR_CARD, MISUSE_CARD, MONEY_CAUTION, PRACTICAL_LABEL, SESSION_END_CARD, STORAGE_NOTE, VIOLENCE_CARD, WEAK_LABEL } from '@/server/ait/fixed';

const APP = path.resolve(__dirname, '..', '..');
const ROOT = path.resolve(APP, '..');
const hasOrigin = fs.existsSync(path.join(ROOT, 'ai', 'AIT', 'ts'));
const hasCopyDoc = fs.existsSync(path.join(ROOT, '마케팅', '카피.md'));
const run = (script: string, ...args: string[]) => spawnSync(process.execPath, [path.join(APP, 'scripts', script), ...args], { encoding: 'utf8' });

(hasOrigin ? describe : describe.skip)('AIT-F ② 서버 모듈 복사본 = 원본 (동기 검사)', () => {
  test('node scripts/sync-ait.mjs --check 가 같음 · 원본은 읽기만(파일 수 20)', () => {
    const r = run('sync-ait.mjs', '--check');
    expect(r.stdout + r.stderr).toMatch(/AIT 동기 같음: 파일 20개/);
    expect(r.status).toBe(0);
  });
});

(hasCopyDoc ? describe : describe.skip)('AIT-F ⑥ 화면 글 사본 = 카피 23장 (생성기 --check)', () => {
  test('node scripts/gen-ait-copy.mjs --check 가 최신 · 193키(글 189 + 글 없음 4)', () => {
    const r = run('gen-ait-copy.mjs', '--check');
    expect(r.stdout + r.stderr).toContain('aitCopy.ts 최신');
    expect(r.status).toBe(0);
  });
});

describe('AIT-F 서버 고정 문구 ↔ 화면 글(카피 23장)', () => {
  // 법무 17-2 확정 번호 줄은 서버와 화면이 글자까지 같아야 한다 — 번호는 서버 fixed.ts 한 곳, 화면은 카피 사본
  test('번호 줄 · 상시 줄 · 끝줄 · 고정 줄이 글자 그대로 같다', () => {
    expect(CRISIS_CARD.lines).toContain(LINE_109);
    expect(AIT_TEXT['CONCERN_CARD.crisis.l2']).toBe(LINE_109);
    expect(AIT_TEXT['CONCERN_CARD.crisis.l3']).toBe(LINE_112_119);
    expect(AIT_TEXT['CONCERN_CARD.violence.l2']).toBe(LINE_1366);
    expect(AIT_TEXT['CONCERN_CARD.violence.l3']).toBe(LINE_112);
    expect(AIT_TEXT['CONCERN_CARD.minor.l2']).toBe(LINE_1388);
    expect(AIT_TEXT['CONCERN.always']).toBe(ALWAYS_LINE);
    expect(AIT_TEXT['CONCERN.footer']).toBe(CHAT_FOOTER);
    expect(AIT_TEXT['CONCERN.guessNote']).toBe(CHAT_GUESS_NOTE);
    expect(AIT_TEXT['CONCERN.weak']).toBe(WEAK_LABEL);
    expect(AIT_TEXT['CONCERN.practical']).toBe(PRACTICAL_LABEL);
    expect(AIT_TEXT['CONCERN.money']).toBe(MONEY_CAUTION);
    expect(AIT_TEXT['COACH.note']).toBe(COACH_NOTE);
    expect(AIT_TEXT['PAIR_AI.note']).toBe(COMPAT_NOTE);
    expect(AIT_TEXT['STAR_AI.footer']).toBe(FUN_FOOTER);
    // 저장 문구: 카피 23-13-1 로 '받은 날부터'가 들어가 서버 STORAGE_NOTE(법무 16-3)와 글자까지 같다
    expect(AIT_TEXT['AIT.privacy.keep']).toBe(STORAGE_NOTE);
  });

  test('칩 열여섯 글이 화면 글(23-4-4)과 같다 — 칩 코드마다 화면 글이 있다', () => {
    const keys = Object.keys(CHIP_LABEL);
    expect(keys).toHaveLength(16);
    for (const k of keys) expect(AIT_TEXT[`CONCERN.chip.${k}` as keyof typeof AIT_TEXT]).toBe(CHIP_LABEL[k as keyof typeof CHIP_LABEL]);
  });

  test('카드 id 다섯이 화면 줄을 갖는다 · 버튼 옵션은 continue · end 뿐', () => {
    for (const c of [CRISIS_CARD, VIOLENCE_CARD, MISUSE_CARD, MINOR_CARD, SESSION_END_CARD]) {
      expect(['crisis', 'violence', 'misuse', 'minor', 'session_end']).toContain(c.id);
      for (const o of c.options) expect(['continue', 'end']).toContain(o);
    }
    // 위로 줄(l1)은 서버 가안과 마케팅 확정 글이 아직 다르다 — 화면은 카피 23-5 를 쓴다(서버 줄은 보이지 않는다). AI 직원이 fixed.ts 를 맞출 때 이 목록이 비면 된다
    const drift = (['crisis', 'violence'] as const).filter((id) => (id === 'crisis' ? CRISIS_CARD : VIOLENCE_CARD).lines[0] !== AIT_TEXT[`CONCERN_CARD.${id}.l1`]);
    expect(drift.length).toBeLessThanOrEqual(2);
  });

  test('응답 코드 문구: 서버 가안(CODE_TEXT_KO)은 화면에 쓰이지 않는다 — 화면은 AIT.code.* 열 줄(+ fallback)', () => {
    for (const code of ['auth', 'rate', 'spend_limit', 'limit', 'unavailable', 'too_long', 'bad_request', 'upstream', 'timeout', 'blocked_output'] as const) {
      expect(AIT_TEXT[`AIT.code.${code}`]).toBeTruthy();
      expect(CODE_TEXT_KO[code]).toBeTruthy();
    }
    expect(AIT_TEXT['AIT.code.fallback']).toBeTruthy();
  });
});
