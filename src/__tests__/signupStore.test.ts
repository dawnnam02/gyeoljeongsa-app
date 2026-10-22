import { chunkedStorage } from '@/lib/chunkedStorage';
import { createSignupStore, SIGNUP_STORE_KEY } from '@/store/signupStore';

import { createMemoryStore } from './memoryStore';

const longText = '결혼하면 서로의 시간을 존중하며 함께 성장하는 가정을 꾸리고 싶어요. '.repeat(20); // 300자 안팎의 자유 서술

// 저장이 끝날 때까지 기다린다: 저장소는 읽기 · 쓰기를 한 줄로 세우므로 읽기 하나가 끝나면 앞선 쓰기도 끝난 것이다.
const flush = (storage: ReturnType<typeof chunkedStorage>) => storage.getItem(SIGNUP_STORE_KEY);

describe('가입 진행 상태 저장소 (F0 통과 조건 5: 앱 재시작 뒤 값 복원)', () => {
  test('설문 임시 저장분은 앱을 껐다 켠 뒤에도 복원된다', async () => {
    const { store: backing } = createMemoryStore(); // 기기 안 SecureStore 에 해당. 앱이 꺼져도 남는다

    // 첫 실행: 설문 몇 쪽을 입력한다
    const storageA = chunkedStorage(backing);
    const first = createSignupStore(storageA);
    await first.persist.rehydrate();
    first.getState().setAnswer('A02', '여성');
    first.getState().setAnswer('A03', { sido: '서울', sigungu: '마포구' });
    first.getState().setAnswer('E13', ['가족', '일', '건강', '돈']);
    first.getState().setAnswer('F01', { min: 0, max: 5 });
    first.getState().setAnswer('A06', null); // '답하지 않음'
    first.getState().setAnswer('T01', longText);
    first.getState().setLastStep('22');
    first.getState().setStage('consented');
    await flush(storageA);

    // 앱 재시작: 같은 기기 저장소, 새 저장소 객체
    const storageB = chunkedStorage(backing);
    const second = createSignupStore(storageB);
    await second.persist.rehydrate();

    const { survey, stage } = second.getState();
    expect(survey.answers).toEqual({
      A02: '여성',
      A03: { sido: '서울', sigungu: '마포구' },
      E13: ['가족', '일', '건강', '돈'],
      F01: { min: 0, max: 5 },
      A06: null,
      T01: longText,
    });
    expect(survey.lastStep).toBe('22');
    expect(survey.updatedAt).not.toBeNull();
    expect(stage).toBeNull(); // 진행 단계는 서버가 원본이라 저장하지 않는다
  });

  test('저장소에 쓴 값은 한도를 넘지 않는 조각들이다(긴 한글 포함)', async () => {
    const { store: backing, data } = createMemoryStore(); // 2048바이트를 넘으면 던진다
    const storage = chunkedStorage(backing);
    const s = createSignupStore(storage);
    await s.persist.rehydrate();
    s.getState().setAnswer('T01', longText);
    await flush(storage);
    expect(data.size).toBeGreaterThan(2); // 조각이 여러 개
  });

  test('답을 지우면 키가 사라진다', async () => {
    const { store: backing } = createMemoryStore();
    const s = createSignupStore(chunkedStorage(backing));
    s.getState().setAnswer('A02', '남성');
    s.getState().setAnswer('A05', 178);
    s.getState().removeAnswer('A02');
    expect(Object.keys(s.getState().survey.answers)).toEqual(['A05']);
  });

  test('로그아웃 · 탈퇴: resetAll 은 메모리와 기기 저장소를 모두 비운다(점검표 A-14)', async () => {
    const { store: backing, data } = createMemoryStore();
    const storage = chunkedStorage(backing);
    const s = createSignupStore(storage);
    await s.persist.rehydrate();
    s.getState().setAnswer('A02', '여성');
    s.getState().setStage('traits-confirmed');
    await flush(storage);
    expect(data.size).toBeGreaterThan(0);

    s.getState().resetAll();
    await flush(storage);

    expect(s.getState().survey.answers).toEqual({});
    expect(s.getState().stage).toBeNull();
    expect(data.size).toBe(0); // 조각도 개수 키도 남지 않는다
  });

  test('글자를 칠 때마다 저장이 이어져도(빠른 연속 저장) 마지막 값이 남는다', async () => {
    const { store: backing } = createMemoryStore({ delayMs: 1 });
    const storage = chunkedStorage(backing);
    const s = createSignupStore(storage);
    await s.persist.rehydrate();
    for (let i = 1; i <= 15; i++) s.getState().setAnswer('T02', '가'.repeat(i * 100));
    await flush(storage);

    const restored = createSignupStore(chunkedStorage(backing));
    await restored.persist.rehydrate();
    expect(restored.getState().survey.answers['T02']).toBe('가'.repeat(1500));
  });
});
