// 위기 도움 카드 하루 상한(정책 P4-34 · 팀장 판단 점검일지 442 #63): 한 계정이 하루(한국 시각 00:00 ~ 24:00)에 3번까지, 라운지와 대화방을 합쳐서.
//  · 셈은 이 모듈 변수(화면 메모리)뿐이다 — 기기 저장 0 · 서버로 보내는 것 0. 앱을 닫았다 열면 0부터라 '하루'는 근사이고, 실서버 칸은 서버가
//    그날 내 글을 그 자리에서 다시 세어 3 미만일 때만 참을 준다(백엔드 0047) — 이 셈은 그 앞의 마지막 막이다
//  · 4번째부터는 글만 보내고 화면 변화 0 · 안내 글 0(정책 P4-34)
//  · 로그아웃 · 탈퇴(12 설정 leaveToStart)에서 비운다 — 같은 기기를 다른 계정이 쓸 때 앞 사람의 셈이 넘어가지 않게
export const CRISIS_CARDS_PER_DAY = 3;

const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;

let day = -1;
let shown = 0;

/** 카드를 지금 띄워도 되나. 되면 한 번 센다(true) · 오늘 3번을 다 썼으면 세지 않고 false. */
export function takeCrisisCard(now: number = Date.now()): boolean {
  const today = Math.floor((now + KST_MS) / DAY_MS);
  if (today !== day) {
    day = today;
    shown = 0;
  }
  if (shown >= CRISIS_CARDS_PER_DAY) return false;
  shown += 1;
  return true;
}

/** 로그아웃 · 탈퇴 · 시험 사이에 셈을 비운다. */
export function resetCrisisCards(): void {
  day = -1;
  shown = 0;
}
