// 데모 인물 24명(F24 · 청사진 v4 10-5 P8 · D-140). 테스트 웹의 09 추천 · 10 상대 상세 · 11 호감 · 16 1회 매칭 · 내 등급 · 08 '나'가 이 사람들로 채워진다.
//  · 모두 가상의 사람이다. 실존 인물 · 실명 · 실제 회사 이름 0 — 표시는 성 + OO, 직업은 '대기업 · 공기업 · 전문직 · 공무원' 같은 범주, 학교는 설문 v2 학교 목록(M14 schoolIndex)에 있는 이름
//  · 남 12(n 1~12 = demo-cand-1~12) · 여 12(n 13~24 = demo-cand-13~24). n 13 은 데모 로그인 계정 '나'(이하나)의 사진 · 결혼관이라 추천 목록에는 나오지 않는다
//  · 데모 '나'는 처음에 여성(이하나 — 08 프로필)이라 남성 12명이 추천 · 호감에 나온다. 이메일에 asmale 이 있으면 '나'가 남성이고 여성이 나온다
//  · 등급(grade)은 서버가 가진 값처럼 1~9 고루(남 1~9 · 여 1~9, '나' 4 와 같은 등급 · 한 단계 위 · 아래가 섞임). 화면에는 지금 규칙 그대로 — 구독자 + 상대 CK10 동의 때만 '{n}등급' 칩
//  · 사진 키 key(pNN) = B24 의 `디자인/데모인물/앱용/pNN_face · full · free.webp`(→ app/assets/demo/people/, scripts/link-demo-people.mjs). B24 인물목록.csv 는 p01~p12 여 · p13~p24 남이라
//    성별 · 나이 느낌으로 짝지었다(예: n 9 윤OO 34 디자이너 = p16 30대 중반 '전시회에서 그림 보기', n 13 '나' 29 = p01 20대 후반 '카페 창가'). 파일이 없으면 사진 함수가 '없음'으로 답해 기본 그림이 보인다
//  · 호감 데모(likesDemo)의 다섯 사람(demo-liker-1~3 · demo-sent-1 · demo-match-1)은 이 24명 중 다섯의 다른 id(별칭)다 — 같은 얼굴 · 같은 답
//  · 상대에게 가는 값은 서버 공개 규칙대로: answers = 공개 칸 + 공개로 켠 결혼관(E01 · E02 · E03 · E05 · E06 · E07), 질문 카드는 answers 밖 prompts[{code, question, answer}](S14 0018 모양).
//    자기소개(T01)는 설문 v2 에서 '나만 보기'라 상대 응답에 넣지 않는다
//  · 글은 해요체 · 담백하게 · 과장 0 · 느낌표 0. 서열 · 재촉 말 0(시험 f24DemoPeople 이 잰다)
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';

type Row = Record<string, unknown>;
export type DemoGender = 'M' | 'F';
export type PhotoSlotName = 'face' | 'full' | 'free';
export type SlotState = 'approved' | 'pending' | 'none';
export type StoryId = 'Q17' | 'Q18' | 'Q19' | 'Q20' | 'Q21' | 'Q22' | 'Q23' | 'Q24';

export type DemoPerson = {
  n: number; // demo-cand-{n} · 사진 id demo-ph-{n}-{slot}
  key: string; // 사진 파일 앞부분 pNN(B24 인물목록.csv 번호 — 성별 · 나이 느낌으로 짝지음, n 과 다르다)
  gender: DemoGender;
  name: string; // 성 + OO
  age: number; // 만 나이
  region: { sido: string; sigungu: string };
  grade: number; // 1~9(서버 값 흉내 — 화면에는 지금 규칙대로만)
  ck10: boolean; // '내 등급 보이기' 동의
  religion: string | null; // A06(null = 가림)
  edu: string; // B01
  school: string; // B02 학교(목록 이름)
  showSchool: boolean; // B02 공개 스위치(b02_school)를 켰는가
  schoolState: string; // B06 학적
  job: string; // C01 범주
  income: string | null; // C05 연봉 구간(null = 가림)
  open: Row; // 그 밖의 공개 칸(키 · 흡연 · 음주 · 병역 · 전공 · 직급 · 부모님 …)
  marriage: Row; // 공개로 켠 결혼관 칸만
  stories: Partial<Record<StoryId, string>>; // 질문 카드 2~3
  intro: string; // T01 자기소개(본인 화면 · AI 정리용 — 상대 응답에는 없음)
  reasons: string[]; // 맞는 점 이름 코드(정책 2-4) — 09 카드 최대 3
  moreReasons: string[]; // 10 상세에서 더 보이는 맞는 점
  legacyPhotos: [SlotState, SlotState, SlotState]; // 예전 데모(F5 ~ F18)의 사진 상태 — 장면 photocheck 에서만(사진 확인 중 · 없음 화면 점검용)
};

const R = (sido: string, sigungu: string) => ({ sido, sigungu });
const A: SlotState = 'approved';
const P: SlotState = 'pending';
const N: SlotState = 'none';
const GRAD = '졸업했어요';

export const DEMO_PEOPLE: readonly DemoPerson[] = [
  // ── 남성 12(처음 '나'(여성)에게 보이는 분들) ──────────────────────────
  {
    n: 1, key: 'p21', gender: 'M', name: '김OO', age: 32, region: R('서울', '강남구'), grade: 2, ck10: true,
    religion: '기독교', edu: '석사', school: '한양대학교', showSchool: false, schoolState: GRAD, job: '대기업', income: '7천만~1억 원',
    open: { A09: '비흡연', A05: 178, D03: '대졸', A04: '부산', A10: '월 1~2회', A11: '군필', A08: '없음', D05: '1명', D06: '첫째(장남·장녀)', B03: '경영학', B04: '없음', C03: '대리·과장급', C04: '정규직', C06: '1억~3억', G02: '보통', G03: ['단정', '캐주얼'] },
    marriage: { E01: '1년~2년', E02: '갖고 싶은 편이에요', E06: '서울' },
    stories: { Q17: '양가를 하루씩 나눠 다녀오고, 마지막 날은 둘이 쉬고 싶어요.', Q20: '큰 지출은 꼭 같이 상의하기로 정하고 싶어요.' },
    intro: '주중에는 일에 집중하고 주말에는 한강을 따라 오래 걸어요. 약속을 잘 지키는 편이에요.',
    reasons: ['F06', 'E02', 'E03'], moreReasons: ['F07', 'E05'], legacyPhotos: [A, A, P],
  },
  {
    n: 2, key: 'p14', gender: 'M', name: '박OO', age: 30, region: R('경기', '성남시'), grade: 6, ck10: true,
    // 종교 · 연봉 · 부모님 칸은 가렸다(A06 · C05 · D03 · D04 없음) — 이유에도 종교가 없다
    religion: null, edu: '대졸', school: '가천대학교', showSchool: false, schoolState: GRAD, job: '전문직', income: null,
    open: { A09: '비흡연', A05: 172 },
    marriage: {},
    stories: { Q22: '저녁에 한 시간은 요리를 하며 혼자 쉬는 시간으로 두고 싶어요.', Q23: '먼저 따뜻한 차를 끓여 놓고 이야기를 꺼내요.' },
    intro: '말수는 적지만 듣는 걸 좋아해요. 요즘은 주말마다 요리를 하나씩 익히고 있어요.',
    reasons: ['F06', 'E05', 'E07'], moreReasons: [], legacyPhotos: [P, P, P],
  },
  {
    n: 3, key: 'p23', gender: 'M', name: '최OO', age: 33, region: R('서울', '송파구'), grade: 3, ck10: false,
    religion: '천주교', edu: '대졸', school: '서울시립대학교', showSchool: true, schoolState: GRAD, job: '공무원', income: '4천만~6천만 원',
    open: { D03: '대졸', D04: '1억~3억 원', A04: '서울', A10: '안 마심', B03: '행정학', C04: '정규직', A05: 175 },
    marriage: { E01: '1년~2년', E02: '꼭 갖고 싶어요', E05: 4 },
    stories: { Q18: '편한 옷차림으로 식사 한 끼를 함께하는 자리면 좋겠어요.', Q24: '달력에 미리 적어 두고 작은 선물을 준비해요.', Q17: '부모님 댁에서 같이 음식을 만들며 보내고 싶어요.' },
    intro: '정해진 일을 끝까지 해내는 편이에요. 퇴근 뒤에는 동네 도서관에 들러요.',
    reasons: ['F06', 'F07', 'E02'], moreReasons: ['E03', 'E06'], legacyPhotos: [A, N, N],
  },
  {
    n: 4, key: 'p18', gender: 'M', name: '문OO', age: 32, region: R('서울', '마포구'), grade: 4, ck10: true,
    religion: '무교', edu: '대졸', school: '경희대학교', showSchool: true, schoolState: GRAD, job: '교사', income: '5천만~6천만 원',
    open: { A05: 176, A09: '비흡연', A11: '군필', B03: '국어교육' },
    marriage: { E01: '6개월~1년', E02: '갖고 싶은 편이에요', E03: 5 },
    stories: { Q21: '저녁마다 아이와 책 한 권을 같이 읽는 시간이 생기면 좋겠어요.', Q19: '두 사람 직장까지 오가는 길이 편한지 먼저 봐요.' },
    intro: '중학생들과 지내다 보니 잘 웃는 편이에요. 방학에는 짧은 여행을 다녀요.',
    reasons: ['F06', 'E01'], moreReasons: ['E03'], legacyPhotos: [A, A, A],
  },
  {
    n: 5, key: 'p24', gender: 'M', name: '한OO', age: 31, region: R('서울', '강서구'), grade: 7, ck10: true,
    religion: '무교', edu: '대졸', school: '인천대학교', showSchool: false, schoolState: GRAD, job: '중견기업', income: '4천만~5천만 원',
    open: { A05: 174, A09: '비흡연', A11: '군필' },
    marriage: { E01: '1년~2년', E07: '한 통장으로 합쳐서 같이 관리해요' },
    stories: { Q20: '한 달에 한 번은 둘이 가계부를 같이 보기로 해요.', Q23: '산책을 나가서 걸으며 천천히 이야기해요.' },
    intro: '물류 회사에서 일정을 맞추는 일을 해요. 주말에는 친구들과 풋살을 해요.',
    reasons: ['F03', 'E06'], moreReasons: [], legacyPhotos: [P, N, N],
  },
  {
    n: 6, key: 'p20', gender: 'M', name: '오OO', age: 29, region: R('경기', '수원시'), grade: 3, ck10: false,
    religion: '불교', edu: '대졸', school: '아주대학교', showSchool: false, schoolState: GRAD, job: '간호사', income: '4천만~5천만 원',
    open: { A05: 177, A09: '비흡연', A11: '군필', B03: '간호학' },
    marriage: { E02: '꼭 갖고 싶어요' },
    stories: { Q22: '쉬는 날 아침에는 자전거를 타고 호수 한 바퀴를 돌고 싶어요.', Q17: '근무가 겹치면 앞뒤 날에 나눠서 인사드리고 싶어요.' },
    intro: '병동에서 일해요. 쉬는 날에는 자전거로 광교 호수를 한 바퀴 돌아요.',
    reasons: ['F07', 'E03'], moreReasons: [], legacyPhotos: [A, A, N],
  },
  {
    n: 7, key: 'p17', gender: 'M', name: '이OO', age: 31, region: R('서울', '서초구'), grade: 3, ck10: true,
    religion: '무교', edu: '석사', school: '중앙대학교', showSchool: true, schoolState: '수료했어요', job: '의료직', income: '5천만~6천만 원',
    open: { A05: 180, A09: '비흡연', A11: '군필', B03: '물리치료학' },
    marriage: { E01: '1년~2년', E03: 4 },
    stories: { Q19: '햇빛이 잘 드는지, 가까이에 걷기 좋은 길이 있는지 봐요.', Q24: '부모님 생신은 한 주 전에 둘이 같이 계획을 세워요.' },
    intro: '재활 치료 일을 해요. 몸을 쓰는 운동을 좋아하고 꾸준한 편이에요.',
    reasons: ['F06', 'E01'], moreReasons: [], legacyPhotos: [A, P, N],
  },
  {
    n: 8, key: 'p19', gender: 'M', name: '장OO', age: 37, region: R('부산', '해운대구'), grade: 5, ck10: false,
    religion: '무교', edu: '대졸', school: '부산대학교', showSchool: false, schoolState: GRAD, job: '대기업', income: '8천만~1억 원',
    open: { A05: 173, A11: '군필', C03: '차장·부장급' },
    marriage: { E01: '6개월~1년', E06: '부산·대구·울산·경상' },
    stories: { Q19: '바다까지 걸어서 갈 수 있는 동네면 좋겠어요.', Q18: '부산에 오시면 제가 아는 밥집으로 모시고 싶어요.' },
    intro: '선박 설계 일을 오래 했어요. 바다 가까이 사는 게 좋아요.',
    reasons: ['E02', 'E03'], moreReasons: [], legacyPhotos: [P, N, N],
  },
  {
    n: 9, key: 'p16', gender: 'M', name: '윤OO', age: 34, region: R('서울', '서초구'), grade: 8, ck10: true,
    religion: '기독교', edu: '대졸', school: '홍익대학교', showSchool: true, schoolState: GRAD, job: '디자이너', income: '4천만~5천만 원',
    open: { A05: 171, A11: '군필', B03: '시각디자인' },
    marriage: { E01: '3년 뒤' },
    stories: { Q22: '주말 오전에 전시를 보러 혼자 다녀오는 시간을 지키고 싶어요.', Q21: '주말 계획을 아이 눈높이로 같이 세우고 싶어요.' },
    intro: '작은 스튜디오에서 포장 디자인을 해요. 전시를 보러 다니는 걸 좋아해요.',
    reasons: ['F06', 'F07'], moreReasons: [], legacyPhotos: [A, A, N],
  },
  {
    n: 10, key: 'p13', gender: 'M', name: '박OO', age: 29, region: R('경기', '성남시'), grade: 1, ck10: true,
    religion: '천주교', edu: '석사', school: '연세대학교', showSchool: false, schoolState: GRAD, job: '전문직', income: '1억~1억 5천만 원',
    open: { A05: 179, A09: '비흡연', A11: '군필', C08: '회계사' },
    marriage: { E01: '1년~2년', E02: '꼭 갖고 싶어요', E05: 4 },
    stories: { Q24: '양가 행사는 공유 달력에 같이 적어 두고 챙겨요.', Q20: '매달 정한 만큼은 먼저 모으고 나머지로 생활하고 싶어요.' },
    intro: '회계 일을 해요. 바쁜 철이 지나면 산에 오르며 쉬어요.',
    reasons: ['F06', 'E07'], moreReasons: [], legacyPhotos: [A, N, N],
  },
  {
    n: 11, key: 'p15', gender: 'M', name: '신OO', age: 26, region: R('대전', '유성구'), grade: 5, ck10: false,
    religion: '불교', edu: '대졸', school: '충남대학교', showSchool: true, schoolState: GRAD, job: '공기업', income: '4천만~5천만 원',
    open: { A05: 175, A11: '군필' },
    marriage: { E01: '3년 뒤', E06: '대전·세종·충청' },
    stories: { Q23: '하루가 가기 전에 짧게라도 먼저 연락해요.', Q17: '양가가 가까우면 하루에 두 집을 같이 다녀오고 싶어요.' },
    intro: '입사 2년 차예요. 배우는 걸 좋아해서 퇴근 뒤에 영어 공부를 해요.',
    reasons: ['E01', 'E03'], moreReasons: [], legacyPhotos: [P, P, N],
  },
  {
    n: 12, key: 'p22', gender: 'M', name: '서OO', age: 30, region: R('경기', '고양시'), grade: 9, ck10: true,
    religion: '무교', edu: '전문대', school: '동서울대학교', showSchool: false, schoolState: GRAD, job: '중소기업', income: '3천만~4천만 원',
    open: { A05: 170, A11: '군필' },
    marriage: { E02: '만나는 분과 의논해서 정할래요' },
    stories: { Q19: '고장 난 곳을 직접 고칠 수 있는 오래된 집도 괜찮아요.', Q22: '베란다에서 공구를 만지는 시간을 조금 두고 싶어요.' },
    intro: '설비 점검 일을 해요. 손으로 고치는 걸 좋아해서 집에 공구가 많아요.',
    reasons: ['F03', 'E02'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  // ── 여성 12(n 13 = '나' · 이메일 asmale 이면 n 14~24 가 추천 · 호감에 나온다) ─────────
  {
    n: 13, key: 'p01', gender: 'F', name: '이OO', age: 29, region: R('서울', '마포구'), grade: 4, ck10: true,
    religion: '무교', edu: '대졸', school: '숙명여자대학교', showSchool: false, schoolState: GRAD, job: '중견기업', income: '4천만~6천만 원',
    open: { A05: 163, A09: '비흡연' },
    marriage: { E01: '1년~2년', E02: '갖고 싶은 편이에요' },
    stories: { Q22: '주말 아침 카페에서 책을 읽는 한두 시간은 지키고 싶어요.', Q19: '버스 한 번으로 출근할 수 있는지 먼저 봐요.' },
    intro: '출판사에서 책을 만들어요. 주말에는 동네 카페에서 책을 읽어요.',
    reasons: [], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 14, key: 'p11', gender: 'F', name: '강OO', age: 27, region: R('서울', '성동구'), grade: 5, ck10: true,
    religion: '무교', edu: '대졸', school: '건국대학교', showSchool: true, schoolState: GRAD, job: '대기업', income: '5천만~6천만 원',
    open: { A05: 163, A09: '비흡연' },
    marriage: { E01: '2년~3년', E03: 5 },
    stories: { Q21: '아침을 같이 차려 먹는 시간이 생기면 좋겠어요.', Q23: '좋아하는 빵을 사 들고 먼저 말을 걸어요.' },
    intro: '식품 회사에서 상품 기획을 해요. 새로 생긴 빵집을 찾아다니는 게 취미예요.',
    reasons: ['F06', 'E03', 'E01'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 15, key: 'p10', gender: 'F', name: '조OO', age: 31, region: R('경기', '성남시'), grade: 2, ck10: true,
    religion: '천주교', edu: '석사', school: '이화여자대학교', showSchool: false, schoolState: GRAD, job: '전문직', income: '7천만~8천만 원',
    open: { A05: 165, A09: '비흡연', C08: '약사' },
    marriage: { E01: '1년~2년', E02: '꼭 갖고 싶어요', E05: 4 },
    stories: { Q18: '부모님께 직접 만든 음식을 하나씩 들고 가고 싶어요.', Q24: '집안 행사는 한 달 전에 같이 날짜를 잡아요.', Q17: '성당 미사를 함께 드리고 가족들과 식사하고 싶어요.' },
    intro: '약사로 일해요. 저녁에는 필라테스를 해요.',
    reasons: ['F07', 'E02'], moreReasons: ['E05'], legacyPhotos: [A, A, A],
  },
  {
    n: 16, key: 'p07', gender: 'F', name: '송OO', age: 24, region: R('경기', '수원시'), grade: 7, ck10: false,
    religion: '무교', edu: '대졸', school: '수원대학교', showSchool: false, schoolState: GRAD, job: '중소기업', income: '3천만~4천만 원',
    open: { A05: 160 },
    marriage: { E01: '3년 뒤' },
    stories: { Q22: '퇴근 뒤 그림 그리는 시간은 계속 두고 싶어요.', Q19: '창이 넓어서 그림 그리기 좋은 방이 있는지 봐요.' },
    intro: '디자인 사무소 막내예요. 퇴근 뒤에는 그림을 그리며 쉬어요.',
    reasons: ['E01', 'E03'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 17, key: 'p06', gender: 'F', name: '권OO', age: 33, region: R('서울', '강남구'), grade: 1, ck10: true,
    religion: '무교', edu: '박사', school: '서울대학교', showSchool: false, schoolState: GRAD, job: '전문직', income: '1억~1억 5천만 원',
    open: { A05: 166, C08: '의사' },
    marriage: { E01: '6개월~1년', E03: 4 },
    stories: { Q22: '당직이 끝난 날은 조용히 혼자 쉬는 시간을 갖고 싶어요.', Q20: '서로 바쁠수록 생활비는 자동이체로 단순하게 하고 싶어요.' },
    intro: '대학 병원에서 일해요. 바쁜 만큼 쉬는 날은 조용히 보내는 걸 좋아해요.',
    reasons: ['F06', 'E03'], moreReasons: ['E07'], legacyPhotos: [A, A, A],
  },
  {
    n: 18, key: 'p04', gender: 'F', name: '황OO', age: 35, region: R('부산', '해운대구'), grade: 6, ck10: true,
    religion: '불교', edu: '대졸', school: '동아대학교', showSchool: true, schoolState: GRAD, job: '교사', income: '5천만~6천만 원',
    open: { A05: 162 },
    marriage: { E01: '6개월~1년', E02: '갖고 싶은 편이에요', E06: '부산·대구·울산·경상' },
    stories: { Q21: '아이와 함께 책을 읽는 저녁이 생기면 좋겠어요.', Q17: '바닷가를 같이 걷고 양가에 차례로 인사드리고 싶어요.' },
    intro: '초등학교 선생님이에요. 바닷가 산책길을 아침마다 걸어요.',
    reasons: ['F07', 'E02'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 19, key: 'p09', gender: 'F', name: '안OO', age: 28, region: R('대전', '유성구'), grade: 3, ck10: false,
    religion: '무교', edu: '대졸', school: '한남대학교', showSchool: false, schoolState: GRAD, job: '공기업', income: '4천만~5천만 원',
    open: { A05: 164 },
    marriage: { E01: '2년~3년', E02: '꼭 갖고 싶어요', E06: '대전·세종·충청' },
    stories: { Q23: '드라이브를 나가서 바람을 쐬며 이야기해요.', Q20: '여행 통장을 하나 만들어 같이 모으고 싶어요.' },
    intro: '에너지 공기업에서 일해요. 주말에는 대청호 근처로 드라이브를 가요.',
    reasons: ['F06', 'E01'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 20, key: 'p05', gender: 'F', name: '류OO', age: 30, region: R('인천', '연수구'), grade: 8, ck10: true,
    religion: '기독교', edu: '전문대', school: '부천대학교', showSchool: false, schoolState: GRAD, job: '자영업', income: null,
    open: { A05: 161 },
    marriage: { E01: '1년~2년', E07: '각자 관리하고 생활비만 나눠요' },
    stories: { Q19: '가게까지 오가는 길이 짧은지 먼저 봐요.', Q24: '가족 생일에는 꽃을 한 다발씩 직접 만들어 드려요.' },
    intro: '작은 꽃집을 해요. 아침 일찍 시장에 다녀오는 생활이 익숙해요.',
    reasons: ['E02', 'E05'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 21, key: 'p12', gender: 'F', name: '전OO', age: 36, region: R('대구', '수성구'), grade: 4, ck10: true,
    religion: '그 외', edu: '대졸', school: '경북대학교', showSchool: true, schoolState: GRAD, job: '공무원', income: '4천만~5천만 원',
    open: { A05: 163 },
    marriage: { E01: '6개월~1년', E02: '만나는 분과 의논해서 정할래요' },
    stories: { Q18: '긴장하지 않도록 짧고 편한 자리로 시작하고 싶어요.', Q19: '오래 살 수 있는 조용한 동네인지 봐요.' },
    intro: '구청에서 복지 업무를 해요. 사람 이야기를 끝까지 듣는 편이에요.',
    reasons: ['E03', 'E06'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 22, key: 'p03', gender: 'F', name: '홍OO', age: 26, region: R('서울', '관악구'), grade: 9, ck10: false,
    religion: '무교', edu: '대졸', school: '세종대학교', showSchool: false, schoolState: '수료했어요', job: '프리랜서', income: '3천만~4천만 원',
    open: { A05: 158 },
    marriage: { E01: '3년 뒤' },
    stories: { Q22: '작업에 집중하는 오후 몇 시간은 혼자 두고 싶어요.', Q23: '좋아하는 노래를 틀어 두고 먼저 웃으며 말을 걸어요.' },
    intro: '영상 편집 일을 혼자 해요. 일하는 시간은 들쑥날쑥해도 약속한 날짜는 꼭 지켜요.',
    reasons: ['E01', 'F01'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 23, key: 'p08', gender: 'F', name: '고OO', age: 39, region: R('경기', '고양시'), grade: 5, ck10: true,
    religion: '천주교', edu: '석사', school: '한국외국어대학교', showSchool: true, schoolState: GRAD, job: '외국계 기업', income: '8천만~1억 원',
    open: { A05: 167, B04: '어학연수' },
    marriage: { E01: '6개월~1년', E02: '만나는 분과 의논해서 정할래요', E07: '만나는 분과 의논해서 정할래요' },
    stories: { Q19: '작은 마당이나 화분 둘 자리가 있는지 봐요.', Q17: '조용히 가족끼리 모여 식사하는 명절이 좋아요.' },
    intro: '해외 영업 일을 오래 했어요. 요즘은 출장을 줄이고 정원 가꾸기를 배워요.',
    reasons: ['F07', 'E07'], moreReasons: [], legacyPhotos: [A, A, A],
  },
  {
    n: 24, key: 'p02', gender: 'F', name: '배OO', age: 32, region: R('광주', '서구'), grade: 6, ck10: true,
    religion: '그 외', edu: '대졸', school: '전남대학교', showSchool: false, schoolState: GRAD, job: '중견기업', income: '4천만~5천만 원',
    open: { A05: 162 },
    marriage: { E01: '1년~2년', E06: '광주·전라' },
    stories: { Q20: '한 해 목표를 둘이 정해 두고 같이 모아요.', Q21: '주말에 아이와 둘레길을 걷는 날이 생기면 좋겠어요.' },
    intro: '자동차 부품 회사에서 품질 관리를 해요. 주말에는 무등산 둘레길을 걸어요.',
    reasons: ['F06', 'E03'], moreReasons: [], legacyPhotos: [A, A, A],
  },
];

export const ME_PERSON_N = 13; // 데모 '나'(이하나)의 사진(p01) · 결혼관
// '나'의 사진 칸 → 사진 키(남성 '나' 장면은 사진 없음)
export const mePhotoKey = (slot: PhotoSlotName, email: string): string | null => (asMale(email) ? null : `${byN.get(ME_PERSON_N)?.key ?? 'p01'}_${slot}`);
const byN = new Map(DEMO_PEOPLE.map((p) => [p.n, p]));
export const demoPerson = (n: number): DemoPerson | null => byN.get(n) ?? null;
export const candIdOf = (n: number) => `demo-cand-${n}`;
export const personOfCandId = (id: string): DemoPerson | null => {
  const m = /^demo-cand-(\d+)$/.exec(id);
  return m ? demoPerson(Number(m[1])) : null;
};

// 09 카드에 오는 칸(서버 list_today_recommendations 의 profile): 이름 · 나이 · 지역 · 직업 · 학력 · 종교 · 혼인 이력
export function cardProfile(p: DemoPerson): Row {
  const all: Row = { A12: p.name, A01: p.age, A03: p.region, C01: p.job, B01: p.edu, A06: p.religion ?? undefined, A07: '초혼' };
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined));
}
// 10 상세에 오는 답(get_candidate_profile 의 answers): 공개 칸 + 공개로 켠 결혼관. 가린 칸 · 자기소개(T01) · 질문 카드(prompts 로 따로)는 없다
export function detailAnswers(p: DemoPerson): Row {
  const all: Row = {
    A12: p.name,
    A01: p.age,
    A03: p.region,
    A02: p.gender === 'M' ? '남성' : '여성',
    C01: p.job,
    B01: p.edu,
    A06: p.religion ?? undefined,
    A07: '초혼',
    B06: p.schoolState,
    B02: p.showSchool ? p.school : undefined,
    C05: p.income ?? undefined,
    ...p.open,
    ...p.marriage,
  };
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined));
}

// 10 상세의 질문 카드(get_candidate_profile 의 prompts — 서버 S14 모양: 칸 순서 · 질문 글 · 답). 없으면 빈 목록(서버는 키 자체를 뺀다)
export function promptsOf(p: DemoPerson): { code: string; question: string; answer: string }[] {
  return Object.entries(p.stories)
    .filter((e): e is [string, string] => typeof e[1] === 'string')
    .map(([code, answer]) => ({ code, question: QUESTION_COPY[code]?.q ?? '', answer }))
    .filter((x) => x.question !== '');
}

const localOf = (email: string) => (email.split('@')[0] ?? '').toLowerCase();
// '나'가 남성인 장면(이메일 앞부분에 asmale): 추천 · 호감에 여성이 나온다
export const asMale = (email: string) => localOf(email).includes('asmale');
// 예전 사진 상태(사진 확인 중 · 없음)를 보는 장면(이메일 앞부분에 photocheck) — F5 · F14 · F18 화면 점검
export const legacyPhotoScene = (email: string) => localOf(email).includes('photocheck');
// 끼리끼리 장면(이메일 앞부분에 kk1 ~ kk9): '나'의 등급이 그 값이고 오늘 추천이 S16 규칙(같은 등급 먼저 → 한 단계씩 넓힘)으로 바뀐다
export const kkFromEmail = (email: string): number | null => {
  const m = /kk([1-9])/.exec(localOf(email));
  return m ? Number(m[1]) : null;
};
// '나'의 종교: 처음은 무교(08 프로필). 이메일에 religionother 가 있으면 '그 외' — '그 외'끼리만 추천(S16 [1])
export const myReligionOf = (email: string): string => (localOf(email).includes('religionother') ? '그 외' : '무교');

// 호감 데모(likesDemo) id → 이 사람(별칭). '나'가 남성인 장면에서는 여성 다섯('그 외' 두 분은 무교인 '나'에게 추천되지 않아 빠짐)
const LIKE_ALIAS_FOR_WOMAN_ME: Readonly<Record<string, number>> = { 'demo-liker-1': 10, 'demo-liker-2': 9, 'demo-liker-3': 12, 'demo-sent-1': 4, 'demo-match-1': 5 };
const LIKE_ALIAS_FOR_MAN_ME: Readonly<Record<string, number>> = { 'demo-liker-1': 22, 'demo-liker-2': 18, 'demo-liker-3': 20, 'demo-sent-1': 14, 'demo-match-1': 19 };
export const LIKE_IDS: readonly string[] = Object.keys(LIKE_ALIAS_FOR_WOMAN_ME);
export const likePersonOf = (likeId: string, email = ''): DemoPerson | null => {
  const n = (asMale(email) ? LIKE_ALIAS_FOR_MAN_ME : LIKE_ALIAS_FOR_WOMAN_ME)[likeId];
  return n === undefined ? null : demoPerson(n);
};

// 사진 3칸(서버 photos 모양). 처음에는 모두 승인(기본 그림 0). photocheck 장면은 예전 상태
const SLOTS: readonly PhotoSlotName[] = ['face', 'full', 'free'];
export function photosOf(p: DemoPerson, legacy: boolean): { slot: PhotoSlotName; state: SlotState; photo_id: string | null }[] {
  return SLOTS.map((slot, i) => {
    const state: SlotState = legacy ? p.legacyPhotos[i] : 'approved';
    return { slot, state, photo_id: state === 'approved' ? `demo-ph-${p.n}-${slot}` : null };
  });
}
// 사진 id → 사진 파일 키(pNN_slot). 데모 인물 사진이 아니면 null
export function photoKeyOf(photoId: string): string | null {
  const m = /^demo-ph-(\d+)-(face|full|free)$/.exec(photoId);
  if (!m) return null;
  const p = demoPerson(Number(m[1]));
  return p ? `${p.key}_${m[2]}` : null;
}

// 추천 후보로 쓰는 사람들: '나'와 다른 성별, '나' 자신(n 13) 빼고. 종교 '그 외'는 '그 외'끼리만(S16 [1], 넓히기로 풀지 않음)
export function poolFor(email: string): DemoPerson[] {
  const other = myReligionOf(email) === '그 외';
  return DEMO_PEOPLE.filter((p) => p.n !== ME_PERSON_N && p.gender === (asMale(email) ? 'F' : 'M') && (p.religion === '그 외') === other);
}

// 끼리끼리 순서(서버 S16 S_kin 흉내): 등급 거리 몫 ΔG(0 · 6 · 15 · 그 뒤 한 단계마다 +8) + 종교 몫 ΔR(같음 0 · 다름 4 · 가림 2)이 작은 분부터, 같으면 처음 순서.
//  나이 몫 ΔA · 지역 넓히기는 데모에서 뺀다(모두 같은 권역으로 본다)
export const kinPenalty = (p: DemoPerson, mine: number, myReligion: string): number => {
  const d = Math.abs(p.grade - mine);
  const dg = d === 0 ? 0 : d === 1 ? 6 : d === 2 ? 15 : 15 + 8 * (d - 2);
  const dr = p.religion === null ? 2 : p.religion === myReligion ? 0 : 4;
  return dg + dr;
};
export function kinOrder(people: readonly DemoPerson[], mine: number, myReligion: string): DemoPerson[] {
  return people
    .map((p, i) => ({ p, i, k: kinPenalty(p, mine, myReligion) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.p);
}
