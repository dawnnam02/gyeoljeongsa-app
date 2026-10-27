// lib/settingsApi(실서버 계약 = backend/스키마.md 9장) 를 lib/settingsDemo(같은 모양의 모의 서버) 위에서 돌린다(F7 조건 3 · 4).
//  차단 목록 · 해제 · 신고 내역 · 알림 열 · 선택 동의 켜기/끄기 · delete-account start/confirm(틀림 · 잠금 · 발송 실패 · 3분) · 오류 코드 해석
import type { SupabaseClient } from '@supabase/supabase-js';

import { chunkedStorage } from '@/lib/chunkedStorage';
import { createSettingsApi, parseBlocked, parseReports } from '@/lib/settingsApi';
import { createDemoSettings, DEMO_WITHDRAW_CODE, type DemoSettingsUser } from '@/lib/settingsDemo';
import { createSecurityStore } from '@/store/securityStore';

import { createMemoryStore } from './memoryStore';

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때(npm run check) 첫 화면 그리기가 30초를 넘는 일이 있었다

let clock = Date.UTC(2026, 9, 15, 3, 0, 0);

// settingsDemo 를 supabase 클라이언트 모양으로 감싼다(시험 전용. 2단계에서는 demoBackend 가 같은 일을 한다)
function demoClient(email: string) {
  const demo = createDemoSettings({ now: () => clock });
  const user: DemoSettingsUser & { inserted: unknown[] } = { id: 'me', email, consents: [{ item_code: 'CK4', agreed: true, revoked_at: null }], inserted: [] };
  const client = {
    rpc: (name: string, args?: Record<string, unknown>) => demo.rpc(user, name, args),
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ maybeSingle: async () => ({ data: demo.profileRow(user), error: null }) }),
          update: async (values: Record<string, unknown>) => demo.updateProfile(user, values),
        };
      }
      if (table === 'consents') {
        const rows = () => user.consents.filter((c) => c.agreed && c.revoked_at === null).map((c) => ({ item_code: c.item_code, text_version: 'consent-2026.10.14-v1' }));
        return {
          select: () => ({ eq: () => ({ is: async () => ({ data: rows(), error: null }) }) }),
          insert: async (input: { item_code: string }[]) => {
            for (const r of input) user.consents.push({ item_code: r.item_code, agreed: true, revoked_at: null });
            user.inserted.push(...input);
            return { data: null, error: null };
          },
        };
      }
      throw new Error(table);
    },
    functions: { invoke: (name: string, opts: { body: Record<string, unknown> }) => (name === 'delete-account' ? demo.deleteAccount(user, opts.body) : Promise.reject(new Error(name))) },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }), signOut: jest.fn(async () => ({ error: null })) },
  } as unknown as SupabaseClient;
  return { api: createSettingsApi(client, 'test'), demo, user, client };
}

beforeEach(() => {
  clock = Date.UTC(2026, 9, 15, 3, 0, 0);
});

describe('응답 읽기: 아는 키만', () => {
  test('차단 목록 · 신고 내역 모양이 아니면 null, 모르는 상태 · 키는 버린다', () => {
    expect(parseBlocked(null)).toBeNull();
    expect(parseBlocked([{ user_id: 'a', name: '박OO', age: 29, extra: 1 }, { nope: true }])).toEqual([{ userId: 'a', name: '박OO', age: 29 }]);
    expect(parseReports([{ id: 'r', status: 'weird', created_at: 'x' }, { id: 'r2', status: 'done', created_at: '2026-10-14T00:00:00Z', reason_code: 'RP1' }])).toEqual([
      { id: 'r2', status: 'done', createdAt: '2026-10-14T00:00:00Z' },
    ]);
  });
});

describe('settingsApi × 모의 서버', () => {
  test('차단 목록(장면 settings: 2명) → 해제 → 1명, 이미 풀린 해제(not_found)도 성공으로', async () => {
    const { api } = demoClient('settings@example.test');
    const first = await api.loadBlocked();
    expect(first.ok && first.data.map((p) => `${p.name} · ${p.age}`)).toEqual(['박OO · 29', '최OO · 33']);
    expect(await api.unblock('demo-blocked-1')).toEqual({ ok: true });
    expect(await api.unblock('demo-blocked-1')).toEqual({ ok: true });
    const after = await api.loadBlocked();
    expect(after.ok && after.data.map((p) => p.userId)).toEqual(['demo-blocked-2']);
  });

  test('신고 내역: 최신순 · 상태 3종 · 사유 코드 · 상대는 화면 자료에 없다', async () => {
    const { api } = demoClient('settings@example.test');
    const r = await api.loadReports();
    expect(r.ok && r.data.map((x) => x.status)).toEqual(['reviewing', 'done', 'received']);
    expect(r.ok && Object.keys(r.data[0]).sort()).toEqual(['createdAt', 'id', 'status']);
  });

  test('인터넷 문제(장면 setfail) → network', async () => {
    const { api } = demoClient('setfail@example.test');
    expect(await api.loadBlocked()).toEqual({ ok: false, reason: 'network' });
    expect(await api.loadReports()).toEqual({ ok: false, reason: 'network' });
    expect(await api.saveNotify('like', false)).toEqual({ ok: false, reason: 'network' });
  });

  test('알림: 처음값 켜짐 4개(+ 대화방 새 글 notify_chat, 0036), 바꾼 열만 저장', async () => {
    const { api, demo } = demoClient('a@example.test');
    expect(await api.loadNotify()).toEqual({ ok: true, data: { recommendation: true, like: true, match: true, chat: true } });
    expect(await api.saveNotify('match', false)).toEqual({ ok: true });
    expect(demo.peek('me').notify).toEqual({ notify_recommendation: true, notify_like: true, notify_match: false, notify_chat: true });
    expect(await api.saveNotify('chat', false)).toEqual({ ok: true });
    expect(demo.peek('me').notify).toEqual({ notify_recommendation: true, notify_like: true, notify_match: false, notify_chat: false });
  });

  test('선택 동의: CK4 끄기 = revoke_consent(철회 시각), CK9 켜기 = 지금 판으로 동의 행 더하기', async () => {
    const { api, user } = demoClient('a@example.test');
    expect(await api.loadConsents()).toEqual({ ok: true, data: { CK4: true, CK9: false, CK11: false, CK12: false, CK13: false, CK14: false, CK15: false, CK16: false } });
    expect(await api.setOptional('CK4', false)).toEqual({ ok: true });
    expect(user.consents[0].revoked_at).not.toBeNull();
    expect(await api.setOptional('CK9', true)).toEqual({ ok: true });
    expect(user.inserted).toEqual([expect.objectContaining({ user_id: 'me', item_code: 'CK9', agreed: true, app_version: 'test' })]);
    expect(await api.loadConsents()).toEqual({ ok: true, data: { CK4: false, CK9: true, CK11: false, CK12: false, CK13: false, CK14: false, CK15: false, CK16: false } });
  });

  test('탈퇴: start → 틀림(wrong) → 맞음(확정), 3분 지나면 맞는 번호도 wrong, 5번 틀리면 limit(잠금)', async () => {
    const { api, demo } = demoClient('a@example.test');
    expect(await api.startWithdraw()).toEqual({ ok: true });
    expect(await api.confirmWithdraw('000000')).toEqual({ ok: false, reason: 'wrong' });
    expect(demo.peek('me').withdrawn).toBe(false);
    expect(await api.confirmWithdraw(DEMO_WITHDRAW_CODE)).toEqual({ ok: true });
    expect(demo.peek('me').withdrawn).toBe(true);

    const late = demoClient('b@example.test');
    await late.api.startWithdraw();
    clock += 181_000;
    expect(await late.api.confirmWithdraw(DEMO_WITHDRAW_CODE)).toEqual({ ok: false, reason: 'wrong' });

    const many = demoClient('c@example.test');
    await many.api.startWithdraw();
    for (let i = 0; i < 4; i += 1) expect(await many.api.confirmWithdraw('999999')).toEqual({ ok: false, reason: 'wrong' });
    expect(await many.api.confirmWithdraw('999999')).toEqual({ ok: false, reason: 'limit' });
    expect(await many.api.confirmWithdraw(DEMO_WITHDRAW_CODE)).toEqual({ ok: false, reason: 'limit' });
    expect(many.demo.peek('me').withdrawn).toBe(false);
  });

  test('탈퇴 발송: 60초 안 다시 보내기 · 24시간 5번 → limit, 메일 실패 → send', async () => {
    const { api } = demoClient('a@example.test');
    expect(await api.startWithdraw()).toEqual({ ok: true });
    expect(await api.startWithdraw()).toEqual({ ok: false, reason: 'limit' });
    expect(await demoClient('wdlimit@example.test').api.startWithdraw()).toEqual({ ok: false, reason: 'limit' });
    expect(await demoClient('wdsendfail@example.test').api.startWithdraw()).toEqual({ ok: false, reason: 'send' });
  });

  test('신고 · 차단이 오면(F5 · F6) 차단 목록 · 신고 내역에 오른다(P5-03)', async () => {
    const { api, demo, user } = demoClient('a@example.test');
    demo.noteReport(user, 'demo-blocked-2', 'RP2');
    const blocked = await api.loadBlocked();
    expect(blocked.ok && blocked.data.map((p) => p.userId)).toEqual(['demo-blocked-2']);
    const reports = await api.loadReports();
    expect(reports.ok && reports.data.map((r) => r.status)).toEqual(['received']);
  });

  test('로그아웃은 이 기기만(scope local)', async () => {
    const { api, client } = demoClient('a@example.test');
    await api.signOut();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('캡처 차단 값은 기기에 남는다(팀장 결정 ⑥, SecureStore 조각 저장소)', () => {
  test('처음값 꺼짐 → 켜면 저장되고, 앱을 다시 켜도(새 저장소 인스턴스) 켜짐', async () => {
    const backing = createMemoryStore();
    const first = createSecurityStore(chunkedStorage(backing.store));
    await first.persist.rehydrate();
    expect(first.getState().captureBlock).toBe(false);
    first.getState().setCaptureBlock(true);
    await new Promise((r) => setTimeout(r, 0));
    const second = createSecurityStore(chunkedStorage(backing.store));
    await second.persist.rehydrate();
    expect(second.getState().captureBlock).toBe(true);
  });
});
