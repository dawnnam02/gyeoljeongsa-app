// R1 A⑦ 공통(렌더 없는 시험): 스위치 키 87 · 훅 저장소 · V10 연락처 모양(T10-01 문장 세트) · T04 · K11 글 규칙 도구 · T11 · T09 접근성 점검 도구 · 토스트 상수 · 스크롤 단서 판단.
//  렌더 시험은 r1CommonParts.test.tsx. 기준: 팀장/세부청사진/R1_배정.md · 기획/K19_기능총목록.md 2-5 · 기획/K15_K13반영.md 2-1 · 3장 · 마케팅/B17_변경기록.md 5장
//  F22(10-18): K19 2-5 표가 40 → 74키(R0 40 · R2 33 · 출시 뒤 1)로 늘어 앱 목록 · 기대값을 함께 맞췄다. prelaunch 는 live 켜짐(닫힌 쪽) · demo 꺼짐(K20 1-3 · 4-3)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { demoDefault, FEATURE_KEY_LIST, FEATURE_KEYS, isFeatureKey, isPendingKey, liveDefault } from '@/config/featureKeys';
import { TOAST_MAX_CHARS, TOAST_MS, toastFits } from '@/config/toast';
import { CONTACT_HINT } from '@/content/contactHintCopy';
import { createFlagsStore } from '@/hooks/useFeatureFlags';
import { hasMoreBelow } from '@/hooks/useScrollCue';
import { a11yJoin, roleWordIn } from '@/lib/a11yLabel';
import { findContactShapes, hintFor } from '@/lib/contactShape';
import { FLAGS_FALLBACK, isOn, parseFlags, type FeatureFlags } from '@/lib/featureFlagsApi';

import { testOutside } from './helpers/outsideDocs';

const APP = path.resolve(__dirname, '..', '..');
const ROOT = path.resolve(APP, '..');
const node = (script: string, args: string[] = []) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [path.join(APP, 'scripts', script), ...args], { cwd: APP, encoding: 'utf8' }) };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { code: err.status ?? 1, out: err.stdout ?? '' };
  }
};

jest.setTimeout(180_000); // 점검 도구를 node 로 돌린다(바쁜 기계에서 느림)

describe('스위치 키 한 목록(K19 2-5) · 앱이 87키를 읽는다', () => {
  const NEW_KEYS = 75; // K19 2-5 표(10-18 D-122 · D-126판): R0 38 · R2 36 · 출시 뒤 1 — waitlist → review_required, rude_warn 넣고 꺼 둠, contact_reveal 새로

  const V5_KEYS = ['v4_daily_recs', 'v4_likes', 'v4_shop']; // V5(W10 · D-152): 숨긴 v4 화면 스위치 — K19 표 밖의 묶음 V5
  const V6_KEYS = ['survey_chat']; // V6-F(D-182): 대화형 설문 화면 스위치 — K19 표 밖의 묶음 V6(서버 0033 과 같은 이름)
  const R_KEYS = ['chat_push']; // R-A(D-199): 대화방 새 글 알림 토큰 등록 스위치 — K19 표 밖의 묶음 R(서버 0036 과 같은 이름, 처음 꺼짐)
  const k19 = () => FEATURE_KEY_LIST.filter((k) => !['K12', 'K15', 'V5', 'V6', 'R'].includes(k.group));

  test('92키 = K12 9 · K15 3 · 새 키 75 · V5 3 · V6 1 · R 1, 이름은 겹치지 않고 snake_case', () => {
    expect(FEATURE_KEYS).toHaveLength(12 + NEW_KEYS + V5_KEYS.length + V6_KEYS.length + R_KEYS.length);
    expect(new Set(FEATURE_KEYS).size).toBe(12 + NEW_KEYS + V5_KEYS.length + V6_KEYS.length + R_KEYS.length);
    expect(FEATURE_KEY_LIST.filter((k) => k.group === 'R').map((k) => k.key)).toEqual(R_KEYS);
    expect(FEATURE_KEY_LIST.filter((k) => k.group === 'V5').map((k) => k.key)).toEqual(V5_KEYS);
    expect(FEATURE_KEY_LIST.filter((k) => k.group === 'V6').map((k) => k.key)).toEqual(V6_KEYS);
    for (const k of FEATURE_KEYS) expect(k).toMatch(/^[a-z][a-z0-9_]*$/);
    const old = ['featured_pick', 'meet_feedback', 'safe_share', 'risk_flags', 'contact_block', 'profile_prompts', 'doc_verify', 'selfie_verify', 'ai_feedback', 'contact_hint', 'quiet_hours', 'login_notice'];
    expect(FEATURE_KEYS.slice(0, 12)).toEqual(old);
    expect(k19()).toHaveLength(NEW_KEYS);
    expect(FEATURE_KEY_LIST.filter((k) => k.group === 'K20').map((k) => k.key)).toEqual(['prelaunch', 'avoid_org', 'vouch']);
  });

  testOutside(['기획/K19_기능총목록.md'])('K19 2-5 표의 키 75개와 글자 그대로 같다(문서가 옆에 있을 때 · 키 칸 괄호 안 설명의 이름은 키가 아니다)', () => {
    const doc = path.join(ROOT, '기획', 'K19_기능총목록.md');
    if (!fs.existsSync(doc)) return;
    const text = fs.readFileSync(doc, 'utf8').replace(/\r\n/g, '\n');
    const from = text.indexOf('### 2-5.');
    const table = text.slice(from, text.indexOf('\n- ', from));
    const keys = table.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| **합') && !l.startsWith('| 묶음')).flatMap((l) => [...(l.split('|')[2] ?? '').replace(/\([^)]*\)/g, '').matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]));
    expect(keys).toHaveLength(NEW_KEYS);
    expect(table).toContain(`**${NEW_KEYS}**`); // 표의 '합' 줄도 같은 수
    expect([...keys].sort()).toEqual(k19().map((k) => k.key).sort());
  });

  test('live 값: 구현된 기능(E) 7개 + review_required · prelaunch(켜짐이 닫힌 쪽, D-126 · K20 1-3)만 켜짐 · 팀장 판단 전 키 0(D-122)', () => {
    expect(FEATURE_KEYS.filter(liveDefault)).toEqual(['grade_engine', 'grade_view', 'grade_badge', 'grade_pause', 'sub_uprank', 'region_widen', 'appearance_score', 'review_required', 'prelaunch']);
    expect(FEATURE_KEYS.filter(isPendingKey)).toEqual([]);
    expect(isFeatureKey('waitlist')).toBe(false); // review_required 로 이름이 정해짐(D-126)
    expect(isFeatureKey('featured_pick')).toBe(true);
    expect(isFeatureKey('nope')).toBe(false);
  });

  test('demo 처음값: review_required · prelaunch 만 꺼짐(테스트 웹은 지금 동작 · 심사를 끈 데모, 정책 1-2 7번) · avoid_org · vouch 켜짐(K20 4-3) · 목록 밖은 꺼짐', () => {
    expect(FEATURE_KEYS.filter((k) => !isPendingKey(k) && !demoDefault(k))).toEqual(['review_required', 'prelaunch', ...V5_KEYS, ...R_KEYS]); // V5: 숨긴 v4 화면은 데모에서도 꺼짐(v4on 장면만 켜짐) · R: chat_push 데모도 꺼짐
    expect(demoDefault('avoid_org')).toBe(true);
    expect(demoDefault('vouch')).toBe(true);
    expect(demoDefault('rude_warn')).toBe(true); // 넣고 꺼 둔 키(live 꺼짐) — 데모 시드처럼 켜짐
    expect(demoDefault('nope')).toBe(false);
  });

  test('서버가 모르는 키는 live 값(E 켜짐 · 새 기능 꺼짐) · false 는 false · boolean 아니면 live 값 · 목록 밖 키는 버림', () => {
    const f = parseFlags({ flags: { featured_pick: true, grade_view: false, grade_badge: 'yes', unknown: true }, modes: {} });
    expect(f.on.featured_pick).toBe(true);
    expect(f.on.grade_view).toBe(false); // 서버가 끈 것
    expect(f.on.grade_badge).toBe(true); // 이상한 값 → live 값
    expect(f.on.sub_uprank).toBe(true); // 서버가 아직 모르는 E 키 → 지금 동작 유지
    expect(f.on.pinned_like).toBe(false); // 아직 모르는 새 키 → 꺼짐
    expect(f.on.prelaunch).toBe(true); // 아직 모르는 prelaunch → 켜짐(닫힌 쪽, K20 1-3)
    expect(parseFlags({ flags: { prelaunch: false }, modes: {} }).on.prelaunch).toBe(false); // 서버가 끈 것
    expect('unknown' in f.on).toBe(false);
    expect(isOn(f, 'unknown')).toBe(false);
    expect(FEATURE_KEYS.filter((k) => FLAGS_FALLBACK.on[k])).toEqual(FEATURE_KEYS.filter(liveDefault));
  });

  test('키 이름 목록은 JSON 하나 — .ts 쪽에는 등급 · 외모 기능 낱말이 없다(staticRules 의 허용 목록 · score 금지와 부딪히지 않음)', () => {
    for (const file of ['config/featureKeys.ts', 'lib/featureFlagsApi.ts', 'hooks/useFeatureFlags.ts', 'lib/v4Demo.ts']) {
      expect(fs.readFileSync(path.join(APP, 'src', ...file.split('/')), 'utf8')).not.toMatch(/grade|score|rating/i);
    }
  });
});

describe('훅 저장소(createFlagsStore): 한 번 불러 나눠 쓴다', () => {
  const flags = (on: Record<string, boolean>): FeatureFlags => parseFlags({ flags: on, modes: {} });

  test('처음은 live 값 · 같은 때 두 번 불러도 요청 1번 · 끝나면 알림 · 실패는 live 값', async () => {
    let resolve: (f: FeatureFlags) => void = () => undefined;
    const load = jest.fn(() => new Promise<FeatureFlags>((r) => (resolve = r)));
    const store = createFlagsStore(load);
    expect(store.get()).toBe(FLAGS_FALLBACK);
    expect(store.started()).toBe(false);
    const heard = jest.fn();
    const off = store.subscribe(heard);
    const a = store.refresh();
    const b = store.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    resolve(flags({ featured_pick: true }));
    await Promise.all([a, b]);
    expect(isOn(store.get(), 'featured_pick')).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    const failing = createFlagsStore(() => Promise.reject(new Error('x')));
    await failing.refresh();
    expect(failing.get()).toBe(FLAGS_FALLBACK);
  });
});

describe('V10 연락처 모양 판정(K15 10-03 · T10-01 문장 세트)', () => {
  const CONTACT: string[] = [
    // 전화번호 변형 20
    '010-1234-5678로 연락 주세요', '제 번호는 01012345678 이에요', '010 1234 5678', '010.1234.5678', '(010) 1234-5678',
    '공일공 일이삼사 오육칠팔', '공일공-일이삼사-오육칠팔', '０１０－１２３４－５６７８', '010 - 1234 - 5678', '연락처 010-9876-5432 남겨요',
    '02-123-4567 사무실이에요', '031-234-5678 집 전화', '+82 10 1234 5678', '번호 010 12 34 56 78 이에요', '010-2222-3333 문자 주세요',
    '공일공 구팔칠육 오사삼이', '010)1234)5678', '010 . 1234 . 5678', '핸드폰 01055556666', 'O1O-1234-5678',
    // 이메일 10
    'abc@naver.com', 'my.name@gmail.com 으로 주세요', 'hello_kim@daum.net', 'test+1@kakao.com', 'KIM@NAVER.COM',
    'park99@hanmail.net', '메일 lee.s@company.co.kr', 'a.b-c@sub.domain.org', 'me@icloud.com', '이메일은 love@outlook.com 이에요',
    // 링크 10
    'https://open.kakao.com/o/abc', 'www.instagram.com/myid', 'bit.ly/abc123', 'naver.me/xyz', 'myblog.tistory.com 놀러 오세요',
    'example.co.kr 에 있어요', 'youtu.be/abc 봐 주세요', 'http://abc.xyz', 'goo.gl/maps/x', 't.me/myname',
    // @아이디 10
    '@myid', '여기로 @hello_world', '@kim.minsu', '아이디 @abc123', '@한글아이디', '연락은 @summer_day', '@park-jy', '@j.k.lee', '팔로우 @coffee_lover', '@seoul2026',
    // 연락 수단 이름 10
    '카톡 주세요', '카카오톡으로 연락해요', '오픈채팅 드릴게요', '인스타 해요', '텔레그램 있어요', '라인아이디 알려 주세요', '왓츠앱 써요', 'kakao id 알려줘', '페북 친구해요', '카 톡 주세요',
  ];
  const ORDINARY: string[] = [
    '안녕하세요. 서울에서 일하는 32살 회사원이에요.', '주말에는 한강에서 자전거를 타요.', '키는 178cm이고 운동을 좋아해요.', '2026년 안에 결혼하고 싶어요.', '연봉은 5천만 원 정도예요.',
    '가족과 저녁을 자주 먹어요.', '요리를 배우는 중이에요.', '책 읽는 걸 좋아해요. 요즘은 소설을 읽어요.', '아침 7시에 일어나서 산책해요.', '강아지를 키우고 싶어요.',
    '부모님과 가까이 살고 싶어요.', '여행은 1년에 두 번쯤 가요.', '커피보다 차를 좋아해요.', '대화가 잘 통하는 분이면 좋겠어요.', '서로 존중하는 관계를 원해요.',
    '저는 차분한 편이에요.', '맞벌이를 생각하고 있어요.', '아이는 2명 정도 생각해요.', '주 3회 헬스장에 가요.', '사진 찍는 걸 좋아해요.',
    '등산을 자주 다녀요. 북한산을 좋아해요.', '영화관에서 영화 보는 걸 좋아해요.', '텔레비전 보는 걸 좋아해요.', '음악은 클래식을 즐겨 들어요.', '피아노를 10년 쳤어요.',
    '대학에서 경영학을 공부했어요.', '지금은 은행에서 일해요.', '야근은 거의 없어요.', '저녁 6시면 퇴근해요.', '주말엔 봉사활동을 해요.',
    '종교는 없어요.', '술은 가끔 한두 잔 해요.', '담배는 피우지 않아요.', '반려동물을 좋아해요.', '고양이 두 마리와 살아요.',
    '서로의 시간을 존중했으면 해요.', '진지하게 만나고 싶어요.', '결혼 후에도 일을 계속할 거예요.', '집안일은 나눠서 하고 싶어요.', '돈 관리는 함께 의논해요.',
    '부모님 부양은 상황에 따라 함께 정하고 싶어요.', '결혼 후에는 경기도에 살고 싶어요.', '수원에 집이 있어요.', '하루 8시간 일해요.', '2층 집에 살아요.',
    '3남매 중 둘째예요.', '형이 한 명 있어요.', '어머니는 선생님이셨어요.', '아버지와 낚시를 다녀요.', '요즘 수영을 배워요.',
    '제 장점은 꾸준함이에요.', '단점은 조금 느린 거예요.', '맛집 찾아다니는 걸 좋아해요.', '김치찌개를 잘 끓여요.', '빵 굽는 게 취미예요.',
    '겨울보다 여름이 좋아요.', '바다가 보이는 곳을 좋아해요.', '제주도에 1년 살았어요.', '일본어를 조금 해요.', '영어 공부를 다시 시작했어요.',
    '저축을 꾸준히 하고 있어요.', '신중하게 결정하는 편이에요.', '웃음이 많은 편이에요.', '말을 잘 들어 주는 편이에요.', '약속 시간을 잘 지켜요.',
    '첫 만남은 조용한 카페가 좋아요.', '전시회 보는 걸 좋아해요.', '봄에 벚꽃 보러 가요.', '가을 단풍을 좋아해요.', '주말 오전에는 늦잠을 자요.',
    '이번 주 일요일에 삼겹살 먹어요.', '일이 많아도 주말은 쉬어요.', '사이좋은 가족을 꿈꿔요.', '오래 함께할 분을 찾아요.', '서로 응원하는 사이가 좋아요.',
    '기념일을 잘 챙겨요.', '편지를 쓰는 걸 좋아해요.', '정리 정돈을 잘해요.', '운전은 10년째 하고 있어요.', '자동차보다 기차 여행이 좋아요.',
    '2025년에 이직했어요.', '회사까지 30분 걸려요.', '퇴근 후 1시간 걸어요.', '마라톤 하프 코스를 뛰어 봤어요.', '요가를 5년 했어요.',
    '조카가 3명 있어요.', '명절에는 고향에 가요.', '부산이 고향이에요.', '대구에서 학교를 다녔어요.', '광주에 친척이 많아요.',
    '느긋한 여행을 좋아해요.', '사람 많은 곳보다 조용한 곳이 좋아요.', '손으로 만드는 걸 좋아해요.', '식물을 키워요. 몬스테라가 있어요.', '감사한 마음을 잘 표현해요.',
    '천천히 알아가고 싶어요.', '믿음이 가장 중요하다고 생각해요.', '대화로 문제를 풀어요.', '서로 배려하는 사이가 되고 싶어요.', '만나서 이야기 나눠요.',
  ];

  test('세트 크기: 연락처 모양 60 · 평범한 소개 100', () => {
    expect(CONTACT).toHaveLength(60);
    expect(ORDINARY).toHaveLength(100);
  });

  test('연락처 모양 60개 중 54개 이상 찾고, 평범한 문장 100개 중 안내가 뜨는 것은 3개 이하(T10-01)', () => {
    const missed = CONTACT.filter((s) => findContactShapes(s).length === 0);
    const falseHits = ORDINARY.filter((s) => findContactShapes(s).length > 0);
    expect(CONTACT.length - missed.length).toBeGreaterThanOrEqual(54);
    expect(falseHits.length).toBeLessThanOrEqual(3);
    expect(falseHits).toContain('텔레비전 보는 걸 좋아해요.'); // 알려진 오탐(서버와 같음, S12 5장 10번)
  });

  test('모양 이름: 전화 · 이메일 · @아이디 · 연락 수단 · 링크, 글 안 자리 순서', () => {
    expect(findContactShapes('010-1234-5678').map((h) => h.shape)).toEqual(['phone']);
    expect(findContactShapes('abc@naver.com').map((h) => h.shape)).toEqual(['email', 'link']);
    expect(findContactShapes('@myid').map((h) => h.shape)).toEqual(['handle']);
    expect(findContactShapes('카톡 주세요').map((h) => h.shape)).toEqual(['app']);
    expect(findContactShapes('www.a.kr 그리고 카톡').map((h) => h.shape)).toEqual(['link', 'app']);
    expect(findContactShapes('')).toEqual([]);
  });

  test('칸 종류별 안내 하나(D-75): 편지 = 막힘 · 공개 칸 = 먼저 찾은 모양(링크면 링크 줄) · 비공개 칸 = 보이지 않음 · 모양 없으면 없음', () => {
    expect(hintFor('letter', '카톡 주세요')).toBe('letter');
    expect(hintFor('letter', 'www.abc.com')).toBe('letter');
    expect(hintFor('public', '010-1234-5678')).toBe('publicField');
    expect(hintFor('public', 'bit.ly/abc 와 카톡')).toBe('publicLink');
    expect(hintFor('public', '카톡이나 bit.ly/abc')).toBe('publicField');
    expect(hintFor('private', '@myid')).toBe('privateField');
    expect(hintFor('public', '주말에 산책해요')).toBeNull();
    expect(CONTACT_HINT.letter).toContain('보낼 수 없어요'); // 막는 칸만 '보낼 수 없어요'
    expect(CONTACT_HINT.publicField).toContain('적지 않아도 괜찮아요'); // 공개 칸은 안내만
  });

  test('안내 글은 카피.md 7장(B17 확정)과 글자 그대로 · 쓰지 않을 말(금지 · 위반 · 제재 · 불가 · 의심 · 처벌 · 경고 · 차단) 0', () => {
    const strings: string[] = [];
    (function collect(v: unknown) {
      if (typeof v === 'string') strings.push(v);
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    })(CONTACT_HINT);
    expect(strings).toHaveLength(12);
    for (const s of strings) expect(s).not.toMatch(/금지|위반|제재|불가|의심|처벌|경고|차단|[!！]/);
    const copy = path.join(ROOT, '마케팅', '카피.md');
    if (!fs.existsSync(copy)) return;
    const section = fs.readFileSync(copy, 'utf8').split(/^## 7\. /m)[1] ?? '';
    for (const s of strings) expect(section).toContain(s);
  });

  testOutside(['backend/migrations'])('연락 수단 이름 사본(contactWords.ts)이 서버 금칙어 표(0016 시드)와 같다', () => {
    if (!fs.existsSync(path.join(ROOT, 'backend', 'migrations'))) return;
    expect(node('gen-contact-words.mjs', ['--check']).code).toBe(0);
  });
});

describe('T04 · K11 글 규칙 도구(check-copy-rules.mjs) — check:copy 그룹 T04 · K11', () => {
  testOutside(['마케팅/카피.md'])('지금 앱 글: 실패 0(허용 목록은 이유와 함께 [참고]로 나온다)', () => {
    const r = node('check-copy-rules.mjs', ['--json']);
    const out = JSON.parse(r.out) as { results: { group: string; title: string; ok: boolean }[]; notes: string[] };
    expect(out.results.filter((x) => !x.ok).map((x) => x.title)).toEqual([]);
    expect(out.results.filter((x) => x.group === 'T04').map((x) => x.title.split(' ')[0])).toEqual(['R1', 'R2', 'R3', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17']);
    expect(out.results.filter((x) => x.group === 'K11')).toHaveLength(3);
    expect(out.notes.some((n) => n.startsWith('R4 '))).toBe(true);
    expect(out.notes.some((n) => n.startsWith('R18 '))).toBe(true);
    expect(r.code).toBe(0);
  });

  test('일부러 어긴 글 파일을 넣으면 그 규칙이 실패한다(임시 키 글은 대조를 미룬다)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-copy-'));
    fs.writeFileSync(
      path.join(dir, 'bad.ts'),
      [
        'export const BAD = {',
        "  saveDone: '저장했어요!',",
        "  sorryFailed: '죄송해요. 저장하지 못했어요',",
        "  blameError: '잘못 입력하셨어요.',",
        "  closeA11y: '닫기 버튼',",
        "  serverError: '서버 문제로 저장하지 못했어요.',",
        "  formal: '저장되었습니다.',",
        '};',
        "export const FEATURED = { label: '오늘 가장 잘 맞는 1등 분' };",
        "export const CONTACT_HINT = { letter: '연락처는 금지돼요.' };",
        "export const V4W01 = { meet: { send: 'meet.send' } };",
      ].join('\n'),
      'utf8',
    );
    const out = JSON.parse(node('check-copy-rules.mjs', ['--json', '--content', dir, '--copy', path.join(dir, 'none.md')]).out) as { results: { title: string; ok: boolean }[]; counts: { temp: number } };
    const failed = out.results.filter((x) => !x.ok).map((x) => x.title.split(' ')[0]);
    expect(failed).toEqual(expect.arrayContaining(['R1', 'R2', 'R3', 'R5', 'R8', 'R10', 'R11', 'R13', 'R16', 'K11-43']));
    expect(out.counts.temp).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('T11 · T09 접근성 점검 도구(check-a11y.mjs)', () => {
  test('지금 앱 코드: 이름 없는 눌림 요소 0 · 이름 없는 입력 칸 0 · 이름에 버튼 0', () => {
    const r = node('check-a11y.mjs', ['--json']);
    const out = JSON.parse(r.out) as { files: number; A1: string[]; A2: string[]; A3: string[]; T12: string[] };
    expect(out.files).toBeGreaterThan(50);
    expect([...out.A1, ...out.A2, ...out.A3]).toEqual([]);
    expect(r.code).toBe(0);
  });

  test('일부러 어긴 화면을 넣으면 잡는다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-a11y-'));
    fs.writeFileSync(
      path.join(dir, 'Bad.tsx'),
      [
        "import { TextInput } from 'react-native';",
        "import { Pressable } from '@/components/Pressable';",
        'export function Bad({ go }: { go: () => void }) {',
        '  return (',
        '    <>',
        '      <Pressable onPress={go} />',
        "      <Pressable accessibilityLabel={`저장 버튼`} onPress={go} />",
        '      <Card onPress={go} />',
        '      <TextInput value="" />',
        "      <TextButton label='더 보기' onPress={go} />",
        '    </>',
        '  );',
        '}',
      ].join('\n'),
      'utf8',
    );
    const out = JSON.parse(node('check-a11y.mjs', ['--json', '--src', dir]).out) as { A1: string[]; A2: string[]; A3: string[]; T12: string[] };
    expect(out.A1).toHaveLength(2);
    expect(out.A2).toHaveLength(1);
    expect(out.A3).toEqual(["Bad.tsx:7 이름에 '버튼'"]);
    expect(out.T12).toHaveLength(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('이름 잇기(T09): 빈 조각은 건너뛰고 ", " 로 · 역할 말 찾기', () => {
    expect(a11yJoin('김OO · 32 · 서울 강남구', null, '', '호감 보냄', false, undefined)).toBe('김OO · 32 · 서울 강남구, 호감 보냄');
    expect(roleWordIn('저장 버튼')).toBe('버튼');
    expect(roleWordIn('김OO 프로필 보기')).toBeNull();
  });
});

describe('T04 토스트 상수 · T12 스크롤 단서 판단', () => {
  test('토스트 5초 · 40자 · 두 문장(카피.md 1-1)', () => {
    expect(TOAST_MS).toBe(5_000);
    expect(TOAST_MAX_CHARS).toBe(40);
    expect(toastFits('답해 주셔서 고마워요.')).toBe(true);
    expect(toastFits('가'.repeat(41))).toBe(false);
    expect(toastFits('하나예요. 둘이에요. 셋이에요.')).toBe(false);
  });

  test('아래에 더 있나: 내용이 창보다 길고 끝까지 내리지 않았을 때만', () => {
    expect(hasMoreBelow(600, 1200, 0)).toBe(true);
    expect(hasMoreBelow(600, 1200, 600)).toBe(false);
    expect(hasMoreBelow(600, 1200, 595)).toBe(false); // 끝 8 안쪽은 다 본 것
    expect(hasMoreBelow(600, 500, 0)).toBe(false);
    expect(hasMoreBelow(0, 1200, 0)).toBe(false); // 아직 크기를 모름
  });
});
