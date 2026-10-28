// 02 · 03 이 서버와 주고받는 일을 모의 서버(데모 모드의 모의 클라이언트)로 처음부터 끝까지 따라가 본다.
// 모의 서버는 실제 서버(backend/functions · migrations)와 같은 규칙 · 같은 오류 코드를 쓴다(lib/demoBackend.ts).
//   otp-gate(24시간 5번 · 60초 · 5번 틀리면 10분 잠금 · 3분 안에 입력) · underage-reject(3번 거절이면 30일 잠금) · save_answers · consents
import { CONSENT_CODES, type ConsentCode } from '@/content/types';
import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { createAuthApi } from '@/lib/authApi';
import { buildConsentRows, loadActiveConsents, recordConsents } from '@/lib/consentApi';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { changedConsents, consentStage, loadProgressStage } from '@/lib/progress';
import { REQUIRED_CODES, REQUIRED_SET } from '@/features/consent/consentLogic';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
// 한국 시각 2026-10-14 12:00 (UTC 03:00)
const START = Date.UTC(2026, 9, 14, 3, 0, 0);

function setup() {
  const clock = { now: START };
  const backend = createDemoBackend({ now: () => clock.now });
  const client = createDemoClient(backend);
  return { clock, backend, client, api: createAuthApi(client) };
}
type Setup = ReturnType<typeof setup>;

// 앱 로그(safeLog)가 내는 줄을 모아 둔다: 시험 출력을 어지럽히지 않고, 개인정보가 로그에 새지 않는지 아래에서 확인한다
let logged: string[] = [];
beforeEach(() => {
  logged = [];
  jest.spyOn(console, 'log').mockImplementation((line: unknown) => void logged.push(String(line)));
});
afterEach(() => {
  jest.restoreAllMocks();
});

// 인증번호를 받아 맞게 입력해 로그인한다
async function signIn({ api }: Setup, email = 'new@email.co') {
  expect(await api.sendCode(email)).toEqual({ ok: true });
  expect(await api.verifyCode(email, DEMO_OTP_CODE)).toEqual({ ok: true });
}

const allChecked = () => Object.fromEntries(CONSENT_CODES.map((c) => [c, true])) as Record<ConsentCode, boolean>;

describe('인증번호 발송 · 확인 (otp-gate 와 같은 규칙)', () => {
  test('이메일 형식이 아니면 거절한다', async () => {
    const { api } = setup();
    expect(await api.sendCode('abc')).toEqual({ ok: false, reason: 'invalid-email' });
  });

  test('보내고 맞게 입력하면 세션이 저장된다', async () => {
    const s = setup();
    expect(await s.api.hasSession()).toBe(false);
    await signIn(s, 'Hello@Email.com');
    expect(await s.api.hasSession()).toBe(true);
    expect(await s.api.sessionEmail()).toBe('hello@email.com'); // 대소문자는 같은 이메일로 본다
  });

  test('틀린 인증번호는 wrong 이고 세션이 생기지 않는다', async () => {
    const s = setup();
    await s.api.sendCode('a@b.co');
    expect(await s.api.verifyCode('a@b.co', '000000')).toEqual({ ok: false, reason: 'wrong' });
    expect(await s.api.hasSession()).toBe(false);
  });

  test('보내지 않은 이메일 · 3분이 지난 번호는 틀린 것과 같다(서버가 구분하지 않는다)', async () => {
    const s = setup();
    expect(await s.api.verifyCode('never@sent.co', DEMO_OTP_CODE)).toEqual({ ok: false, reason: 'wrong' });
    await s.api.sendCode('a@b.co');
    s.clock.now += 3 * MIN + 1;
    expect(await s.api.verifyCode('a@b.co', DEMO_OTP_CODE)).toEqual({ ok: false, reason: 'wrong' });
  });

  test('한 번 쓴 인증번호는 다시 쓸 수 없다', async () => {
    const s = setup();
    await signIn(s);
    expect(await s.api.verifyCode('new@email.co', DEMO_OTP_CODE)).toEqual({ ok: false, reason: 'wrong' });
  });

  test('5번 틀리면 잠긴다: 잠긴 동안은 맞는 번호도 locked, 10분 뒤 풀린다', async () => {
    const s = setup();
    await s.api.sendCode('a@b.co');
    for (let i = 0; i < 4; i += 1) expect(await s.api.verifyCode('a@b.co', '111111')).toEqual({ ok: false, reason: 'wrong' });
    expect(await s.api.verifyCode('a@b.co', '111111')).toEqual({ ok: false, reason: 'locked' }); // 5번째
    expect(await s.api.verifyCode('a@b.co', DEMO_OTP_CODE)).toEqual({ ok: false, reason: 'locked' });
    expect(await s.api.sendCode('a@b.co')).toEqual({ ok: false, reason: 'too-many' }); // 잠긴 동안은 발송도 막는다
    s.clock.now += 10 * MIN;
    expect(await s.api.sendCode('a@b.co')).toEqual({ ok: true });
    expect(await s.api.verifyCode('a@b.co', DEMO_OTP_CODE)).toEqual({ ok: true });
  });

  test('보낸 뒤 60초 안에 또 보내면 거절하고, 같은 이메일 24시간 5번을 넘기면 6번째부터 거절한다', async () => {
    const s = setup();
    expect(await s.api.sendCode('a@b.co')).toEqual({ ok: true });
    expect(await s.api.sendCode('a@b.co')).toEqual({ ok: false, reason: 'too-many' }); // 60초 안
    for (let i = 0; i < 4; i += 1) {
      s.clock.now += 61_000;
      expect(await s.api.sendCode('a@b.co')).toEqual({ ok: true });
    }
    s.clock.now += 61_000;
    expect(await s.api.sendCode('a@b.co')).toEqual({ ok: false, reason: 'too-many' }); // 6번째
    s.clock.now += DAY; // 24시간이 지나면 다시 센다
    expect(await s.api.sendCode('a@b.co')).toEqual({ ok: true });
  });

  test('발송 실패(fail 로 시작하는 데모 주소)는 send-failed 이다', async () => {
    const { api } = setup();
    expect(await api.sendCode('fail@email.co')).toEqual({ ok: false, reason: 'send-failed' });
  });

  test('인증번호가 6자리 숫자가 아니면 틀린 것이다', async () => {
    const s = setup();
    await s.api.sendCode('a@b.co');
    expect(await s.api.verifyCode('a@b.co', '12345')).toEqual({ ok: false, reason: 'wrong' });
  });
});

describe('생년월일 확인 (underage-reject 와 같은 규칙) · 저장(save_answers)', () => {
  test('로그인 전에는 거절한다(session)', async () => {
    const { api } = setup();
    expect(await api.checkBirth('1995-03-12')).toEqual({ ok: false, reason: 'session' });
    expect(await api.saveBirth('1995-03-12')).toEqual({ ok: false, reason: 'session' });
  });

  test('경계: 생일 당일은 통과, 하루 전날은 거절(한국 날짜 기준)', async () => {
    const s = setup();
    await signIn(s);
    expect(await s.api.checkBirth('2002-10-14')).toEqual({ ok: true }); // 2026-10-14 에 만 24세(가입 나이, F22)
    expect(await s.api.checkBirth('2002-10-15')).toEqual({ ok: false, reason: 'underage' });
  });

  test('F22: 만 19~23세(예전 기준이면 통과)는 거절한다 · 23세 3번 거절이면 잠긴다(K20 5장 7번)', async () => {
    const s = setup();
    await signIn(s);
    expect(await s.api.checkBirth('2007-10-14')).toEqual({ ok: false, reason: 'underage' }); // 오늘 만 19세
    expect(await s.api.checkBirth('2003-10-14')).toEqual({ ok: false, reason: 'underage' }); // 오늘 만 23세
    expect(await s.api.checkBirth('2003-01-01')).toEqual({ ok: false, reason: 'underage' }); // 3번째: 잠김
    expect(await s.api.checkBirth('2002-10-14')).toEqual({ ok: false, reason: 'blocked' });
  });

  test('입력 실수(형식 · 1950 이전 · 미래)는 format 이고 거절 횟수에 세지 않는다', async () => {
    const s = setup();
    await signIn(s);
    for (const bad of ['1995-02-30', '1949-12-31', '2026-10-15', 'abc']) expect(await s.api.checkBirth(bad)).toEqual({ ok: false, reason: 'format' });
    for (let i = 0; i < 5; i += 1) await s.api.checkBirth('1995-02-30'); // 아무리 해도 잠기지 않는다
    expect(await s.api.checkBirth('1995-03-12')).toEqual({ ok: true });
  });

  test('첫 거절부터 30일 안에 3번 거절되면 30일 동안 잠긴다: 이후에는 날짜와 상관없이 blocked', async () => {
    const s = setup();
    await signIn(s);
    expect(await s.api.checkBirth('2010-01-01')).toEqual({ ok: false, reason: 'underage' });
    expect(await s.api.checkBirth('2010-01-02')).toEqual({ ok: false, reason: 'underage' });
    expect(await s.api.checkBirth('2010-01-03')).toEqual({ ok: false, reason: 'underage' }); // 3번째: 이번 거절로 잠긴다
    expect(await s.api.checkBirth('1990-01-01')).toEqual({ ok: false, reason: 'blocked' }); // 어른 날짜도 거절
    s.clock.now += 30 * DAY + 1;
    expect(await s.api.checkBirth('1990-01-01')).toEqual({ ok: true });
  });

  test('통과한 생년월일을 저장하면 서버가 알고 있다. 만 19세 미만 날짜는 저장도 거절한다', async () => {
    const s = setup();
    await signIn(s);
    expect(await s.api.saveBirth('2010-01-01')).toEqual({ ok: false, reason: 'server' });
    expect(s.backend.peek.birthDate('new@email.co')).toBeNull();
    expect(await s.api.saveBirth('1995-03-12')).toEqual({ ok: true });
    expect(s.backend.peek.birthDate('new@email.co')).toBe('1995-03-12');
  });
});

describe('진행 단계 (K2 2-3 표) — 서버에서 읽어 정한다', () => {
  test('새 이메일 → 생년월일을 내기 전 → 낸 뒤 · 동의 전 → 동의 끝', async () => {
    const s = setup();
    await signIn(s);
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'email-verified' });
    await s.api.saveBirth('1995-03-12');
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'birthdate-passed' });
    const rows = buildConsentRows({ userId: (await s.api.userId()) ?? '', shown: CONSENT_CODES, checked: allChecked(), required: REQUIRED_SET, appVersion: '0.1.0' });
    expect(await recordConsents(s.client, rows)).toEqual({ ok: true });
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'consented' });
  });

  test('로그아웃하고 같은 이메일로 다시 들어오면 가입된 이메일이라 진행 단계대로 간다', async () => {
    const s = setup();
    await signIn(s);
    await s.api.saveBirth('1995-03-12');
    await s.api.signOut();
    expect(await s.api.hasSession()).toBe(false);
    s.clock.now += 61_000;
    await signIn(s);
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'birthdate-passed' });
  });

  test('동의 기록이 없으면 서버 값이 비어 있어도 판정을 멈추지 않는다(로그인 전이면 account_status 행이 없다 → server)', async () => {
    const { client } = setup();
    expect(await loadProgressStage(client)).toEqual({ ok: false, reason: 'server' });
  });
});

describe('동의 기록 저장 (F1 통과 조건 4: 항목별 동의 여부 · 문구 버전)', () => {
  test('필수 7개는 동의한 기록만, 선택 2개(CK4 · CK9)는 예 · 아니오 모두 남는다', () => {
    const checked = allChecked();
    checked.CK4 = false; // 선택 칸을 체크하지 않음
    const rows = buildConsentRows({ userId: 'u1', shown: CONSENT_CODES, checked, required: REQUIRED_SET, appVersion: '0.1.0' });
    expect(rows).toHaveLength(9);
    expect(rows.find((r) => r.item_code === 'CK4')).toMatchObject({ agreed: false });
    expect(rows.find((r) => r.item_code === 'CK9')).toMatchObject({ agreed: true });
    expect(rows.filter((r) => REQUIRED_SET.has(r.item_code)).every((r) => r.agreed)).toBe(true);
  });

  test('필수 칸을 체크하지 않은 채로는 그 칸의 기록을 만들지 않는다(필수는 동의한 기록만)', () => {
    const checked = allChecked();
    checked.CK2 = false;
    const rows = buildConsentRows({ userId: 'u1', shown: CONSENT_CODES, checked, required: REQUIRED_SET, appVersion: '0.1.0' });
    expect(rows.map((r) => r.item_code)).not.toContain('CK2');
    expect(rows).toHaveLength(8);
  });

  test('행마다 사용자 · 문구 판 · 앱 버전이 들어 있고 시각은 서버가 채운다(보내지 않는다)', () => {
    const rows = buildConsentRows({ userId: 'u1', shown: CONSENT_CODES, checked: allChecked(), required: REQUIRED_SET, appVersion: '0.1.0' });
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['agreed', 'app_version', 'item_code', 'source', 'text_version', 'user_id']); // 3부-아: 0041 받은 곳
      expect(row.source).toBe('signup');
      expect(row.user_id).toBe('u1');
      expect(row.app_version).toBe('0.1.0');
      expect(row.text_version).toBe(CONSENT_TEXT_VERSIONS[row.item_code]);
      expect(row.text_version).toMatch(/^consent-\d{4}\.\d{2}\.\d{2}-v\d+$/); // DB 검사식과 같다
    }
  });

  test('보인 칸만 저장한다(재동의: 바뀐 칸만)', () => {
    const rows = buildConsentRows({ userId: 'u1', shown: ['CK3', 'CK4'], checked: { ...allChecked(), CK4: false }, required: REQUIRED_SET, appVersion: '0.1.0' });
    expect(rows.map((r) => `${r.item_code}:${r.agreed}`)).toEqual(['CK3:true', 'CK4:false']);
  });

  test('서버에 한 번에 저장되고 서버가 읽어 줄 때 유효한 동의로 보인다', async () => {
    const s = setup();
    await signIn(s);
    const rows = buildConsentRows({ userId: (await s.api.userId()) ?? '', shown: CONSENT_CODES, checked: { ...allChecked(), CK9: false }, required: REQUIRED_SET, appVersion: '0.1.0' });
    expect(await recordConsents(s.client, rows)).toEqual({ ok: true });
    const stored = s.backend.peek.consents('new@email.co');
    expect(stored).toHaveLength(9);
    const active = await loadActiveConsents(s.client);
    expect(active.ok && active.rows.map((r) => r.item_code).sort()).toEqual(['CK1', 'CK2', 'CK3', 'CK4', 'CK5', 'CK6', 'CK7', 'CK8']); // 동의한 것만(CK9 는 아니오)
  });

  test('같은 판의 동의가 이미 있어 다시 넣으면(응답만 놓친 경우) 서버 기록을 보고 성공으로 본다', async () => {
    const s = setup();
    await signIn(s);
    const rows = buildConsentRows({ userId: (await s.api.userId()) ?? '', shown: CONSENT_CODES, checked: allChecked(), required: REQUIRED_SET, appVersion: '0.1.0' });
    expect(await recordConsents(s.client, rows)).toEqual({ ok: true });
    expect(await recordConsents(s.client, rows)).toEqual({ ok: true }); // 23505 → 확인 → 성공
    expect(s.backend.peek.consents('new@email.co')).toHaveLength(9); // 중복으로 늘지 않는다
  });

  test('로그인하지 않았으면 저장하지 못한다(server)', async () => {
    const { client } = setup();
    const rows = buildConsentRows({ userId: 'u1', shown: CONSENT_CODES, checked: allChecked(), required: REQUIRED_SET, appVersion: '0.1.0' });
    expect(await recordConsents(client, rows)).toEqual({ ok: false, reason: 'server' });
  });

  test('저장할 것이 없으면 요청하지 않고 성공이다', async () => {
    const { client } = setup();
    expect(await recordConsents(client, [])).toEqual({ ok: true });
  });
});

describe('로그에 개인정보가 없다 (보안/구성.md 8-1 · F-4)', () => {
  test('실패가 잇따라도 로그에는 이벤트 이름과 코드만 남고 이메일 · 인증번호 · 생년월일 · 토큰이 없다', async () => {
    const s = setup();
    const email = 'secret.person@private-mail.co';
    await s.api.sendCode('not-an-email');
    await s.api.sendCode(email);
    await s.api.verifyCode(email, '654321'); // 틀림
    await s.api.verifyCode(email, DEMO_OTP_CODE);
    await s.api.checkBirth('2010-05-05'); // 미성년
    await s.api.checkBirth('1995-02-30'); // 형식
    await s.api.saveBirth('2010-05-05'); // 저장 거절
    await s.api.sendCode('fail@private-mail.co');
    expect(logged.length).toBeGreaterThan(0);
    const all = logged.join(' | ');
    for (const secret of [email, 'private-mail', DEMO_OTP_CODE, '654321', '2010', '1995', 'demo-access', 'demo-refresh', '@']) expect(all).not.toContain(secret);
    for (const line of logged) expect(Object.keys(JSON.parse(line)).sort()).toEqual(['code', 'event']);
  });
});

describe('동의 문구가 바뀐 뒤 (동의문구 3-5: 해당 칸만 다시 동의)', () => {
  const row = (item_code: string, text_version: string) => ({ item_code, text_version });
  const CURRENT = 'consent-2026.10.14-v1';
  const OLD = 'consent-2025.01.01-v1';
  // F22(D-123): 칸마다 판이 달라졌다(CK2 = consent-2026.10.18-v1, 만 24세). '현재 판'은 칸마다 config/consent 의 값
  const all = (version: string) => REQUIRED_CODES.map((c) => row(c, version === CURRENT ? CONSENT_TEXT_VERSIONS[c] : version));

  test('모두 현재 판이면 동의 끝, 필수 기록이 없으면 동의 전', () => {
    expect(consentStage(all(CURRENT))).toBe('consented');
    expect(consentStage([])).toBe('birthdate-passed');
    expect(consentStage([row('CK9', CURRENT)])).toBe('birthdate-passed'); // 선택 칸만 있으면 필수는 아직 안 한 것
  });

  test('필수 칸 일부가 옛 판이면 그 칸만 다시 받는다', () => {
    const rows = all(CURRENT).map((r) => (r.item_code === 'CK3' ? row('CK3', OLD) : r));
    expect(consentStage(rows)).toBe('consent-changed');
    expect(changedConsents(rows)).toEqual(['CK3']);
  });

  test('뒷자리(-vN)만 다른 판은 같은 문구로 본다: 다시 받지 않는다', () => {
    const rows = all(CURRENT).map((r) => (r.item_code === 'CK1' ? row('CK1', CONSENT_TEXT_VERSIONS.CK1.replace(/-v\d+$/, '-v7')) : r));
    expect(consentStage(rows)).toBe('consented');
    expect(changedConsents(rows)).toEqual([]);
  });

  test('선택 칸은 이전에 동의했는데 옛 판일 때만 다시 묻는다(안 했던 선택 칸은 묻지 않는다)', () => {
    expect(changedConsents([...all(CURRENT), row('CK4', OLD)])).toEqual(['CK4']);
    expect(changedConsents(all(CURRENT))).toEqual([]);
    expect(consentStage([...all(CURRENT), row('CK4', OLD)])).toBe('consented'); // 선택 칸은 계속 진행을 막지 않는다
  });

  test('서버 기록으로도 같다: 옛 판으로 동의한 계정은 consent-changed', async () => {
    const s = setup();
    await signIn(s);
    await s.api.saveBirth('1995-03-12');
    const userId = (await s.api.userId()) ?? '';
    const old = REQUIRED_CODES.map((item_code) => ({ user_id: userId, item_code, agreed: true, text_version: OLD, app_version: '0.0.1' }));
    expect(await recordConsents(s.client, old)).toEqual({ ok: true });
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'consent-changed' });
  });
});

describe('get_progress 한 번으로 단계를 정한다 (backend/스키마.md 9-6b)', () => {
  const fakeClient = (reply: { data: unknown; error: { code?: string; message: string } | null }) => {
    const rpc = jest.fn(async () => reply);
    return { client: { rpc } as unknown as Parameters<typeof loadProgressStage>[0], rpc };
  };

  test('rpc get_progress 에 필수 동의 7칸의 현재 판을 넘기고, stage 와 facts 를 읽는다', async () => {
    const { client, rpc } = fakeClient({ data: { stage: 'survey-complete', next_screen: '05', facts: { survey_first_missing: null, photo_slots: 2, consent_needed: [] } }, error: null });
    expect(await loadProgressStage(client)).toEqual({ ok: true, stage: 'survey-complete', facts: { surveyFirstMissing: null, photoSlots: 2, consentNeeded: [] } });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as unknown as [string, { p_consent_versions: Record<string, string> }];
    expect(name).toBe('get_progress');
    expect(Object.keys(args.p_consent_versions)).toEqual(['CK1', 'CK2', 'CK3', 'CK5', 'CK6', 'CK7', 'CK8']);
    for (const version of Object.values(args.p_consent_versions)) expect(version).toMatch(/^consent-\d{4}\.\d{2}\.\d{2}-v\d+$/);
  });

  test('모르는 stage 는 서버 오류로, 인터넷 문제는 network 로 돌려준다', async () => {
    expect(await loadProgressStage(fakeClient({ data: { stage: 'unknown-stage' }, error: null }).client)).toEqual({ ok: false, reason: 'server' });
    expect(await loadProgressStage(fakeClient({ data: null, error: { message: 'Failed to fetch' } }).client)).toEqual({ ok: false, reason: 'network' });
    expect(await loadProgressStage(fakeClient({ data: null, error: { code: '42501', message: 'forbidden' } }).client)).toEqual({ ok: false, reason: 'server' });
  });

  test('stage 는 앱 진행 단계 11개와 같은 이름만 받는다', async () => {
    for (const stage of ['email-verified', 'birthdate-passed', 'consent-changed', 'consented', 'survey-complete', 'ai-processing', 'ai-failed', 'traits-pending', 'traits-confirmed', 'blocked', 'withdrawn']) {
      expect(await loadProgressStage(fakeClient({ data: { stage }, error: null }).client)).toMatchObject({ ok: true, stage });
    }
  });
});
