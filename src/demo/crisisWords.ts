// 데모 모의 서버의 위기 낱말 흉내(라운지 · 대화방 같은 목록 — 정책 P4-32 '한 벌'). 실서버 사전 17개(lounge_help_terms)는 운영이 고치고 앱에는 목록이 없다(P4-31).
//  공백을 뺀 글에서 부분 일치. 테스트 웹에서 '사라지고 싶' 같은 낱말로 카드를 볼 수 있게만 둔다
export const DEMO_HELP_WORDS = ['죽고 싶', '자살', '자해', '사라지고 싶', '살기 싫'] as const;
const flat = (t: string) => t.replace(/\s+/g, '');
export const demoHelpHit = (text: string): boolean => DEMO_HELP_WORDS.some((w) => flat(text).includes(flat(w)));
export const DEMO_HELP_PER_DAY = 3; // 서버가 그날 내 글을 다시 세어 3 미만일 때만 참(백엔드 0047 · 정책 P4-34) — 데모는 메모리 셈
