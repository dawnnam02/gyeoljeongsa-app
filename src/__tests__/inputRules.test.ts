// 02 가입 입력 규칙: 이메일 형식 · 인증번호 시계 · 생년월일 입력 모양 · 가입 나이(만 24세, F22) 판정 경계(F1 통과 조건 2 · 3-1).
import { adultCutoff, birthDigitsToIso, checkBirthShape, isAdult, kstToday, SIGNUP_MIN_AGE } from '@/lib/birthDate';
import { isValidEmail, normalizeEmail } from '@/lib/emailRules';
import { formatMmSs, OTP_VALID_SECONDS, secondsLeft } from '@/lib/otpClock';

describe('이메일 (K2 02 입력 검증)', () => {
  test.each(['a@b.co', 'name@example.com', 'first.last+tag@sub.example.co.kr', ' hello@email.com ', 'HELLO@EMAIL.COM'])('%j 는 형식이 맞다', (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  test.each(['', ' ', 'abc', 'a@b', '@b.co', 'a@.co', 'a@b.', 'a b@c.com', 'a@b c.com', 'a@@b.co', '가나다@라마.com 바'])(
    '%j 는 형식이 아니다',
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );

  test('앞뒤 공백은 지우고 영문 대소문자는 같은 이메일로 본다(서버 정규화와 같다)', () => {
    expect(normalizeEmail('  Hello@Email.COM ')).toBe('hello@email.com');
  });

  test('254자를 넘는 주소는 거절한다', () => {
    const local = 'a'.repeat(250);
    expect(isValidEmail(`${local}@b.co`)).toBe(false);
    expect(isValidEmail(`${'a'.repeat(240)}@b.co`)).toBe(true);
  });
});

describe('인증번호 시계 (K2 02 · 정책 P3-03)', () => {
  test('mm:ss 로 보인다: 03:00 → 02:59 → 00:00', () => {
    expect(formatMmSs(180)).toBe('03:00');
    expect(formatMmSs(179)).toBe('02:59');
    expect(formatMmSs(61)).toBe('01:01');
    expect(formatMmSs(0)).toBe('00:00');
    expect(formatMmSs(-5)).toBe('00:00');
  });

  test('보낸 뒤 3분 동안 남은 초가 줄고, 3분이 지나면 0 이다', () => {
    expect(OTP_VALID_SECONDS).toBe(180);
    const sentAt = 1_000_000;
    expect(secondsLeft(sentAt, sentAt)).toBe(180);
    expect(secondsLeft(sentAt, sentAt + 1000)).toBe(179);
    expect(secondsLeft(sentAt, sentAt + 179_001)).toBe(1);
    expect(secondsLeft(sentAt, sentAt + 180_000)).toBe(0);
    expect(secondsLeft(sentAt, sentAt + 999_999)).toBe(0);
    expect(secondsLeft(null, sentAt)).toBe(0); // 보낸 적이 없다
  });
});

describe('생년월일 입력 모양 (K2 02: 숫자 8자리 · 실제 있는 날짜 · 1950-01-01 이후 · 오늘 이전)', () => {
  const TODAY = '2026-10-14';

  test('YYYYMMDD → YYYY-MM-DD', () => {
    expect(birthDigitsToIso('19950312')).toBe('1995-03-12');
  });

  test.each(['', '1995031', '199503123', '1995-03-1', '19951301', '19950230', '19950431', '19950000', '19950100', 'abcdefgh'])('%j 는 날짜가 아니다', (digits) => {
    expect(birthDigitsToIso(digits)).toBeNull();
    expect(checkBirthShape(digits, TODAY).result).toBe('format');
  });

  test('윤년의 2월 29일은 있는 날짜이고 평년은 아니다', () => {
    expect(birthDigitsToIso('20000229')).toBe('2000-02-29');
    expect(birthDigitsToIso('19000229')).toBeNull(); // 1900 은 평년
    expect(birthDigitsToIso('19950229')).toBeNull();
  });

  test('1950-01-01 이전 · 오늘 이후는 범위 밖이다', () => {
    expect(checkBirthShape('19491231', TODAY).result).toBe('range');
    expect(checkBirthShape('19500101', TODAY).result).toBe('ok');
    expect(checkBirthShape('20261014', TODAY).result).toBe('ok'); // 오늘
    expect(checkBirthShape('20261015', TODAY).result).toBe('range'); // 내일
    expect(checkBirthShape('20300101', TODAY).result).toBe('range');
  });
});

// F22(D-100 · K20 5장 7번): 가입 나이가 만 19세 → 만 24세로 바뀌어 경계 날짜를 24년으로 옮겼다. 식(없는 날은 그 달 마지막 날)은 그대로
describe('가입 나이 만 24세 생일 경과 판정 (F1 3-1 · K20 5장: 경계 날짜) — 서버 underage-reject 와 같은 식', () => {
  const TODAY = '2026-10-14';

  test('가입 나이는 24 · 오늘 − 24년 = 2002-10-14', () => {
    expect(SIGNUP_MIN_AGE).toBe(24);
    expect(adultCutoff(TODAY)).toBe('2002-10-14');
  });

  test('경계 ① 만 24세 생일 당일은 통과한다', () => {
    expect(isAdult('2002-10-14', TODAY)).toBe(true);
  });

  test('경계 ② 생일 하루 전(내일이 만 24세 생일)은 거절한다', () => {
    expect(isAdult('2002-10-15', TODAY)).toBe(false);
  });

  test('생일이 하루 지난 날은 통과한다', () => {
    expect(isAdult('2002-10-13', TODAY)).toBe(true);
  });

  test('만 19~23세(예전 기준이면 통과)는 거절한다', () => {
    expect(isAdult('2007-10-14', TODAY)).toBe(false); // 오늘 만 19세
    expect(isAdult('2003-10-14', TODAY)).toBe(false); // 오늘 만 23세
  });

  test('한참 어린 날짜는 거절하고, 한참 위인 날짜는 통과한다', () => {
    expect(isAdult('2020-01-01', TODAY)).toBe(false);
    expect(isAdult('1950-01-01', TODAY)).toBe(true);
  });

  test('연말 · 연초 경계: 2026-01-01 기준 → 2002-01-01 까지 통과, 2002-01-02 는 거절', () => {
    expect(isAdult('2002-01-01', '2026-01-01')).toBe(true);
    expect(isAdult('2002-01-02', '2026-01-01')).toBe(false);
    expect(isAdult('2001-12-31', '2026-01-01')).toBe(true);
  });

  test('윤일 경계: 2000-02-29 생은 2024-02-28 에 아직 거절, 2024-02-29(만 24세 생일)부터 통과', () => {
    expect(adultCutoff('2024-02-28')).toBe('2000-02-28');
    expect(isAdult('2000-02-29', '2024-02-28')).toBe(false);
    expect(isAdult('2000-02-29', '2024-02-29')).toBe(true);
    expect(isAdult('2000-02-28', '2024-02-28')).toBe(true);
  });

  test('평년 2월 28일 · 3월 1일 경계: 2027-02-28 기준 → 2003-02-28 통과 · 2003-03-01 거절', () => {
    expect(adultCutoff('2027-02-28')).toBe('2003-02-28');
    expect(isAdult('2003-02-28', '2027-02-28')).toBe(true);
    expect(isAdult('2003-03-01', '2027-02-28')).toBe(false);
  });

  test('24년 전 같은 날이 없으면(2124-02-29 → 2100 은 평년) 2월 28일로 줄인다 · 줄이는 식은 해 수와 상관없다(19년 예)', () => {
    expect(adultCutoff('2124-02-29')).toBe('2100-02-28');
    expect(adultCutoff('2024-02-29', 19)).toBe('2005-02-28');
    expect(isAdult('2100-02-28', '2124-02-29')).toBe(true);
    expect(isAdult('2100-03-01', '2124-02-29')).toBe(false);
  });
});

describe('한국 날짜(KST) 기준 오늘', () => {
  test('UTC 15:00 부터는 한국이 다음 날이다', () => {
    expect(kstToday(Date.UTC(2026, 9, 13, 14, 59, 59))).toBe('2026-10-13');
    expect(kstToday(Date.UTC(2026, 9, 13, 15, 0, 0))).toBe('2026-10-14');
  });

  test('가입 시각이 한국 기준 만 24세 생일 전날 밤이면 거절, 자정을 넘기면 통과한다', () => {
    const birth = '2002-10-14'; // F22: 가입 나이 만 24세
    expect(isAdult(birth, kstToday(Date.UTC(2026, 9, 13, 14, 59, 59)))).toBe(false); // 한국 10월 13일 23:59:59
    expect(isAdult(birth, kstToday(Date.UTC(2026, 9, 13, 15, 0, 0)))).toBe(true); // 한국 10월 14일 00:00:00
  });
});
