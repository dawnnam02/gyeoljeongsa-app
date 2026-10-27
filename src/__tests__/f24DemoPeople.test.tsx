// F24(청사진 v4 10-5 P8 · P9 · D-140): 데모 인물 24명 데이터 모양 · 금지 낱말 0 · 실명 0 · 등급 분포 · 끼리끼리 순서 · 사진 연결 · 앞 일 정리(OnboardingLaunchLine).
import fs from 'node:fs';
import path from 'node:path';

import { act } from 'react-test-renderer';

import { asMale, cardProfile, DEMO_PEOPLE, detailAnswers, promptsOf, kinOrder, kkFromEmail, legacyPhotoScene, likePersonOf, LIKE_IDS, ME_PERSON_N, photoKeyOf, photosOf, poolFor } from '@/demo/people';
import { demoPhotoCount, demoPhotoUri } from '@/demo/peoplePhotos';
import { createKinDemo, KIN_DEMO, nextKin } from '@/demo/kinDemo';
import { OnboardingLaunchLine } from '@/features/prelaunch/OnboardingLaunchLine';
import { REASON_NAMES } from '@/features/recs/recsLogic';
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createProfileApi } from '@/lib/profileApi';
import { createRecsApi } from '@/lib/recsApi';

import { testOutside } from './helpers/outsideDocs';
import { has, mount } from './renderHelpers';

const T0 = Date.UTC(2026, 9, 16, 3, 0, 0);
const APP = path.resolve(__dirname, '..', '..');
const SCHOOLS = fs.readFileSync(path.join(APP, 'src', 'data', 'schools', 'schoolIndex.json'), 'utf8');

const textsOf = (p: (typeof DEMO_PEOPLE)[number]): string[] => [p.intro, ...Object.values(p.stories).filter((v): v is string => typeof v === 'string'), ...Object.values(p.marriage).filter((v): v is string => typeof v === 'string')];
// 화면 글 규칙(check-copy-rules T04 R1 · R2 · R8 · R9 · R12 · R13)과 같은 낱말 + 실제 회사 이름
const BANNED = [/[!！]/, /죄송|미안|양해/, /점수|순위|등급|등수|1등|1위|가장|최고|최상|제일|상위|하위|별점|평점|%|퍼센트|인기|베스트/, /놓치지|서두르|지금 바로|마감|곧 사라|남은 시간|오늘까지|마지막 기회/, /검증됨|보증|안전한 (사람|분|회원)/, /(습니다|십시오|합니다|입니다)\.?$/, /소개/];
const COMPANIES = /삼성|현대|엘지|LG|SK|에스케이|롯데|카카오|네이버|쿠팡|한화|포스코|CJ|씨제이|KT|케이티|신세계|이마트|배민|토스|당근|하이닉스|기아|대한항공|아시아나|한전|한국전력|코레일|우리은행|국민은행|신한|하나은행|농협|구글|애플|아마존|마이크로소프트|테슬라|넷플릭스|스타벅스/i;
const FORBIDDEN_KEY = /^(grade|score|rank|rating|percent|match_score|level)$/i;

async function login(email: string, options: Parameters<typeof createDemoBackend>[0] = {}) {
  const backend = createDemoBackend({ now: () => T0, ...options });
  const client = createDemoClient(backend);
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return { backend, client };
}
type ListItem = { candidate_id: string; photos: { state: string; photo_id: string | null }[]; grade_no?: number };
const listOf = async (client: ReturnType<typeof createDemoClient>) => ((await client.rpc('list_today_recommendations', {})).data as { items: ListItem[]; region_hint: boolean });
const ids = (items: { candidate_id: string }[]) => items.map((i) => Number(i.candidate_id.replace('demo-cand-', '')));

describe('인물 24명 데이터 모양(P8)', () => {
  test('24명 · 여 12 · 남 12 · 번호 1~24 · 사진 키 p01~p24 한 번씩 · 이름은 성 + OO · 만 24~39세', () => {
    expect(DEMO_PEOPLE).toHaveLength(24);
    expect(DEMO_PEOPLE.filter((p) => p.gender === 'M')).toHaveLength(12);
    expect(DEMO_PEOPLE.filter((p) => p.gender === 'F')).toHaveLength(12);
    expect(DEMO_PEOPLE.map((p) => p.n)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(DEMO_PEOPLE.map((p) => p.key).sort()).toEqual(Array.from({ length: 24 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`));
    for (const p of DEMO_PEOPLE) {
      expect(p.name).toMatch(/^[가-힣]OO$/);
      expect(p.age).toBeGreaterThanOrEqual(24);
      expect(p.age).toBeLessThanOrEqual(39);
    }
    const ages = DEMO_PEOPLE.map((p) => p.age);
    expect([Math.min(...ages), Math.max(...ages)]).toEqual([24, 39]);
  });

  testOutside(['디자인/데모인물/인물목록.csv'])('사진 짝: B24 인물목록.csv 의 성별이 같고 나이 느낌(20대 · 30대)이 만 나이와 맞는다(30~31세 네 분만 20대 후반 그림)', () => {
    const csv = path.join(APP, '..', '디자인', '데모인물', '인물목록.csv');
    if (!fs.existsSync(csv)) return; // 디자인 폴더가 없는 곳에서는 건너뛴다
    const rows = new Map(fs.readFileSync(csv, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(',')).map((c) => [c[0], { gender: c[1] === '남' ? 'M' : 'F', decade: c[2].startsWith('20') ? 20 : 30 }]));
    const off: string[] = [];
    for (const p of DEMO_PEOPLE) {
      const row = rows.get(p.key);
      expect(row?.gender).toBe(p.gender);
      if (row && Math.floor(p.age / 10) * 10 !== row.decade) off.push(`${p.key}:${p.age}`);
    }
    expect(off.length).toBeLessThanOrEqual(4); // 30~31세를 '20대 후반' 그림에 둔 짝(그림 수가 20대 6 · 30대 6이라)
  });

  test('등급 분포: 남 · 여 각각 1~9 가 모두 있다 · 데모 "나"(4)와 같은 등급 · 한 단계 위 · 아래가 남성 쪽에 섞여 있다', () => {
    for (const g of ['M', 'F'] as const) expect([...new Set(DEMO_PEOPLE.filter((p) => p.gender === g).map((p) => p.grade))].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const me = DEMO_PEOPLE.find((p) => p.n === ME_PERSON_N);
    expect(me?.grade).toBe(4);
    const men = DEMO_PEOPLE.filter((p) => p.gender === 'M').map((p) => p.grade);
    expect([3, 4, 5].every((g) => men.includes(g))).toBe(true);
  });

  test('권역 · 종교 · 학교 · 직업 · 학적: 수도권 중심 + 동남 · 충청, 무교 포함 · "그 외" 1~2명, 학교는 설문 v2 학교 목록 이름, 직업은 범주', () => {
    const sido = DEMO_PEOPLE.map((p) => p.region.sido);
    expect(sido.filter((s) => ['서울', '경기', '인천'].includes(s)).length).toBeGreaterThanOrEqual(14);
    expect(sido.some((s) => ['부산', '대구', '울산', '경남', '경북'].includes(s))).toBe(true);
    expect(sido.some((s) => ['대전', '세종', '충북', '충남'].includes(s))).toBe(true);
    const religions = DEMO_PEOPLE.map((p) => p.religion);
    expect(religions).toContain('무교');
    const other = religions.filter((r) => r === '그 외').length;
    expect(other).toBeGreaterThanOrEqual(1);
    expect(other).toBeLessThanOrEqual(2);
    for (const p of DEMO_PEOPLE) {
      expect(SCHOOLS.includes(`"${p.school}"`)).toBe(true);
      expect(Object.values(QUESTION_COPY.B06.opt ?? {})).toContain(p.schoolState);
      expect(p.job).not.toMatch(COMPANIES);
    }
  });

  test('자기소개 · 질문 카드 2~3 · 결혼관 공개 칸: 설문 v2 길이 · 보기 이름 그대로', () => {
    const opt = (id: string) => Object.values(QUESTION_COPY[id]?.opt ?? {});
    for (const p of DEMO_PEOPLE) {
      expect(p.intro.length).toBeGreaterThanOrEqual(20);
      expect(p.intro.length).toBeLessThanOrEqual(300);
      const stories = Object.entries(p.stories);
      expect(stories.length).toBeGreaterThanOrEqual(2);
      expect(stories.length).toBeLessThanOrEqual(3);
      for (const [id, text] of stories) {
        expect(id).toMatch(/^Q(1[7-9]|2[0-4])$/);
        expect((text ?? '').length).toBeGreaterThanOrEqual(10);
        expect((text ?? '').length).toBeLessThanOrEqual(100);
      }
      for (const [id, value] of Object.entries(p.marriage)) {
        expect(['E01', 'E02', 'E03', 'E05', 'E06', 'E07']).toContain(id);
        if (id === 'E03' || id === 'E05') expect([1, 2, 3, 4, 5]).toContain(value);
        else expect(opt(id)).toContain(value);
      }
      for (const r of [...p.reasons, ...p.moreReasons]) expect(Object.keys(REASON_NAMES)).toContain(r);
      expect(p.reasons.length).toBeLessThanOrEqual(3);
    }
    expect(DEMO_PEOPLE.filter((p) => Object.keys(p.marriage).length > 0).length).toBeGreaterThanOrEqual(20);
  });

  test('금지 낱말 0 · 실제 회사 이름 0 · 글 안에 이름 0(성 + OO 도 글에 넣지 않음)', () => {
    const hits: string[] = [];
    for (const p of DEMO_PEOPLE) {
      for (const t of textsOf(p)) {
        for (const re of BANNED) if (t.split(/(?<=[.?])\s+/).some((x) => re.test(x))) hits.push(`${p.key}: ${t} (${re})`);
        if (COMPANIES.test(t)) hits.push(`${p.key}: ${t} (회사)`);
        if (/OO/.test(t)) hits.push(`${p.key}: ${t} (이름)`);
      }
    }
    expect(hits).toEqual([]);
  });

  test('상대에게 가는 값: 09 카드 칸 7개 · 10 상세는 공개 칸 + 결혼관 + 질문 카드, 자기소개(T01) · 가린 칸 · 서열 키 0', () => {
    const park = DEMO_PEOPLE[1];
    expect(Object.keys(cardProfile(park)).sort()).toEqual(['A01', 'A03', 'A07', 'A12', 'B01', 'C01']); // 종교를 가린 박OO
    const kim = detailAnswers(DEMO_PEOPLE[0]);
    expect(kim).toMatchObject({ A12: '김OO', A01: 32, C05: '7천만~1억 원', E01: '1년~2년' });
    expect(kim).not.toHaveProperty('T01');
    expect(kim).not.toHaveProperty('Q17'); // 질문 카드는 answers 밖 prompts(서버 S14 모양)
    expect(promptsOf(DEMO_PEOPLE[0])).toEqual([
      { code: 'Q17', question: '명절을 보내고 싶은 모습은?', answer: DEMO_PEOPLE[0].stories.Q17 },
      { code: 'Q20', question: '둘이 정하고 싶은 돈 약속 하나는?', answer: DEMO_PEOPLE[0].stories.Q20 },
    ]);
    expect(kim).not.toHaveProperty('B02'); // 학교 공개를 켜지 않은 분
    expect(detailAnswers(DEMO_PEOPLE[2])).toHaveProperty('B02', '서울시립대학교');
    expect(detailAnswers(park)).not.toHaveProperty('A06');
    for (const p of DEMO_PEOPLE) expect(Object.keys(detailAnswers(p)).filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
  });
});

describe('장면 · 끼리끼리 순서(S16 흉내)', () => {
  test('이메일 장면: kk1~kk9 · asmale · photocheck', () => {
    expect(kkFromEmail('shopsub-kk2@email.com')).toBe(2);
    expect(kkFromEmail('plain@email.com')).toBeNull();
    expect(asMale('kk4asmale@email.com')).toBe(true);
    expect(legacyPhotoScene('f5photocheck@email.com')).toBe(true);
  });

  test('"나" 4: 같은 등급(문OO) → 한 단계 차이 중 같은 종교(무교) 먼저 → 종교가 다른 분 · 두 단계 …', () => {
    const order = kinOrder(poolFor('a@email.com'), 4, '무교').map((p) => p.n);
    expect(order.slice(0, 6)).toEqual([4, 7, 8, 3, 6, 11]);
    expect(kinOrder(poolFor('a@email.com'), 1, '무교').map((p) => p.n).slice(0, 3)).toEqual([10, 1, 7]);
    expect(kinOrder(poolFor('a@email.com'), 9, '무교').map((p) => p.n).slice(0, 3)).toEqual([12, 9, 5]);
  });

  test('남성 "나"는 여성 후보("나" n 13 · "그 외" 두 분 빠짐) · religionother 는 "그 외"끼리만', () => {
    expect(poolFor('asmale@email.com').map((p) => p.n)).toEqual([14, 15, 16, 17, 18, 19, 20, 22, 23]);
    expect(poolFor('asmale-religionother@email.com').map((p) => p.n)).toEqual([21, 24]);
    expect(poolFor('religionother@email.com')).toEqual([]);
    expect(poolFor('a@email.com').every((p) => p.gender === 'M')).toBe(true);
  });

  test('호감 데모 다섯 = 인물 별칭(여성 "나" → 남성 다섯, 남성 "나" → 여성 다섯)', () => {
    expect(LIKE_IDS.map((id) => likePersonOf(id)?.name)).toEqual(['박OO', '윤OO', '서OO', '문OO', '한OO']);
    expect(LIKE_IDS.map((id) => likePersonOf(id, 'asmale@email.com')?.gender)).toEqual(['F', 'F', 'F', 'F', 'F']);
    expect(likePersonOf('nobody')).toBeNull();
  });
});

describe('데모 서버에 연결(09 · 10 · 11 · 16 · 내 등급)', () => {
  test('기본 계정: 예전 고정 목록(김OO · 박OO · 최OO)이고 사진 3장 모두 승인 · photocheck 는 예전 상태(박OO 확인 중 3장)', async () => {
    const { client } = await login('plain@email.com');
    const list = await listOf(client);
    expect(ids(list.items)).toEqual([1, 2, 3]);
    expect(list.items.every((i) => i.photos.every((ph) => ph.state === 'approved' && ph.photo_id !== null))).toBe(true);
    const legacy = await listOf((await login('photocheck@email.com')).client);
    expect(legacy.items[1].photos.map((ph) => ph.state)).toEqual(['pending', 'pending', 'pending']);
  });

  test('끼리끼리 장면 kk2 · kk8: 오늘 추천이 "나"의 등급 가까운 분으로 바뀌고, 구독자에게는 지금 규칙대로 동의한 분만 칩 값', async () => {
    const two = await listOf((await login('kk2@email.com')).client);
    expect(ids(two.items)).toEqual(kinOrder(poolFor('kk2@email.com'), 2, '무교').slice(0, 3).map((p) => p.n));
    const eight = await listOf((await login('kk8@email.com')).client);
    expect(ids(eight.items)).toEqual([9, 5, 12]);
    expect(eight.items.some((i) => 'grade_no' in i)).toBe(false); // 비구독자: 키 자체가 없다
    const sub = await listOf((await login('shopsub-kk4@email.com')).client);
    expect(ids(sub.items)).toEqual([7, 4, 8]); // 구독자: 나보다 위(3 이하) → 같은 등급 → 그 밖(서버 tier)
    expect(sub.items.some((i) => 'grade_no' in i)).toBe(false); // D-197(CK10 폐지): 구독자에게도 상대 등급 번호 없음
  });

  test('데모 줄(demo_kin_me): "나"의 등급을 바꾸면 09 목록 · 내 등급 · 변화 기록이 같은 값을 쓴다', async () => {
    const { client } = await login('shopsub@email.com');
    expect(ids((await listOf(client)).items)).toEqual([1, 3, 2]); // 처음: 예전 목록(구독자 순서)
    const kin = createKinDemo(client);
    expect(await kin.read()).toEqual({ no: 4, on: false });
    expect(await kin.set(8)).toEqual({ no: 8, on: true });
    expect(ids((await listOf(client)).items)).toEqual([5, 9, 12]); // 끼리끼리 3명(윤OO 8 · 한OO 7 · 서OO 9)을 구독자 순서로: 나보다 위(7 이하) → 같은 등급 → 그 밖
    const my = (await client.rpc('get_my_grade', {})).data as Record<string, unknown>;
    expect([my.grade_icon, 'grade_no' in my]).toEqual(['forest', false]); // 3부-사: 0039 v5 — 8 → 서버 짝 표 'forest', 숫자 키 0
    const hist = (await client.rpc('list_grade_history', {})).data as { items: { to_no: number }[] };
    expect(hist.items[0].to_no).toBe(8);
    expect((await client.rpc('demo_kin_me', { p_no: 10 })).error?.message).toBe('invalid_value');
    expect(KIN_DEMO.label(8, nextKin(8))).toBe('데모 · 끼리끼리: 내 등급 8 (누르면 9)');
    expect(nextKin(9)).toBe(1);
  });

  test('1회 매칭(16): 끼리끼리 장면은 오늘 추천 다음 순서의 분이 온다 · 10 상세에 결혼관 · 질문 카드', async () => {
    const { client } = await login('kk4-moslot@email.com'); // moslot: 1회 매칭 이용권 3장
    await listOf(client);
    const used = await client.rpc('use_match_once', { p_request_id: 'u1' });
    expect(used.error).toBeNull();
    const list = await listOf(client);
    expect(ids(list.items).slice(3)).toEqual([3, 6, 11]);
    const detail = (await client.rpc('get_candidate_profile', { p_target: 'demo-cand-4' })).data as { answers: Record<string, unknown>; prompts: { code: string }[] };
    expect(detail.answers).toMatchObject({ A12: '문OO', E01: '6개월~1년' });
    expect(detail.prompts.map((x) => x.code)).toEqual(['Q21', 'Q19']);
    expect(detail.answers).not.toHaveProperty('T01');
  });

  test('11 호감: 카드 얼굴 사진은 그 인물 사진 · 10 상세는 인물 답과 사진 3장 · 남성 "나"는 여성 다섯', async () => {
    const { client } = await login('plain@email.com');
    const received = (await client.rpc('list_likes', { p_kind: 'received' })).data as { user_id: string; card: { name: string; face_photo_id: string | null } }[];
    expect(received.map((r) => [r.user_id, r.card.name, r.card.face_photo_id])).toEqual([
      ['demo-liker-1', '박OO', 'demo-ph-10-face'],
      ['demo-liker-2', '윤OO', 'demo-ph-9-face'],
    ]);
    const profile = (await client.rpc('get_candidate_profile', { p_target: 'demo-match-1' })).data as { answers: Record<string, unknown>; photos: { state: string }[] };
    expect(profile.answers).toMatchObject({ A12: '한OO', A01: 31, E07: '한 통장으로 합쳐서 같이 관리해요' });
    expect(profile.photos.map((p) => p.state)).toEqual(['approved', 'approved', 'approved']);
    const man = (await client.rpc('list_likes', { p_kind: 'connected' })).data as { card: { name: string } }[];
    expect(man[0].card.name).toBe('한OO');
    const { client: c2 } = await login('asmale@email.com');
    const women = (await c2.rpc('list_likes', { p_kind: 'received' })).data as { card: { name: string } }[];
    expect(women.map((r) => r.card.name)).toEqual(['홍OO', '황OO']);
    const legacy = (await (await login('photocheck@email.com')).client.rpc('list_likes', { p_kind: 'received' })).data as { card: { face_photo_id: string | null } }[];
    expect(legacy.map((r) => r.card.face_photo_id)).toEqual(['demo-ph-10-face', null]);
  });
});

describe('사진 연결(P9): 데모 모드에서만 · 파일이 없으면 기본 그림', () => {
  test('사진 id → 파일 키: demo-ph-{n}-{slot} → pNN_slot, 그 밖은 null', () => {
    expect(photoKeyOf('demo-ph-1-face')).toBe('p21_face'); // 김OO 32 = 그림 p21(남 30대 초반)
    expect(photoKeyOf('demo-ph-24-free')).toBe('p02_free');
    expect(photoKeyOf('demo-ph-25-face')).toBeNull();
    expect(photoKeyOf('x')).toBeNull();
    expect(photosOf(DEMO_PEOPLE[0], false).map((p) => p.photo_id)).toEqual(['demo-ph-1-face', 'demo-ph-1-full', 'demo-ph-1-free']);
  });

  test('시험(데모 모드 아님)에서는 사진 목록을 불러오지 않는다 → 주소 null', () => {
    expect(demoPhotoCount()).toBe(0);
    expect(demoPhotoUri('p01_face')).toBeNull();
  });

  test('사진 주소가 있으면 photo 함수가 인물 사진 · "나"의 사진(p01)을 준다, 남성 "나" · 모르는 id 는 404', async () => {
    const photoUri = (key: string) => `https://demo.test/${key}.webp`;
    const { client } = await login('plain@email.com', { photoUri });
    expect(await createRecsApi(client).photoUrl('demo-ph-1-face')).toBe('https://demo.test/p21_face.webp');
    expect(await createProfileApi(client).facePhotoUrl()).toBe('https://demo.test/p01_face.webp'); // '나' = 그림 p01(여 20대 후반)
    expect(await createRecsApi(client).photoUrl('x')).toBeNull();
    const man = await login('asmale@email.com', { photoUri });
    expect(await createProfileApi(man.client).facePhotoUrl()).toBeNull();
  });

  test('link-demo-people.mjs: 데모 번들에만 들어가는 목록 파일과 자리 이름(app/assets/demo/people)이 있다', () => {
    expect(fs.existsSync(path.join(APP, 'scripts', 'link-demo-people.mjs'))).toBe(true);
    const list = fs.readFileSync(path.join(APP, 'src', 'demo', 'peoplePhotoFiles.ts'), 'utf8');
    expect(list).toContain('PEOPLE_PHOTO_FILES');
    const loader = fs.readFileSync(path.join(APP, 'src', 'demo', 'peoplePhotos.ts'), 'utf8');
    expect(loader).toContain("process.env.EXPO_PUBLIC_DEMO_MODE === '1' ? (require('./peoplePhotoFiles')");
  });
});

describe('앞 일 정리', () => {
  test('OnboardingLaunchLine: 서버 연결을 만들 수 없는 환경(시험 · 설정 없음)에서도 깨지지 않고 아무것도 그리지 않는다', async () => {
    const tree = await mount(<OnboardingLaunchLine />);
    await act(async () => undefined);
    expect(has(tree, 'onboarding-launch-line')).toBe(false);
    act(() => tree.unmount());
  });
});
