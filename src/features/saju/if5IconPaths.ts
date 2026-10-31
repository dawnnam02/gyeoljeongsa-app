// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-if5-assets.mjs (IF5-F1b ⓕ)
// 원본: 디자인/IF5/원본/icon_*.svg 22개(24 격자 · 선 1.5 · 둥근 끝). 색은 버리고 앱 Icon 부품이 토큰 색을 입힌다
import type { IconPart } from '@/components/iconPaths';

export const IF5_ICON_PATHS = {
  bag: { name: "가방", parts: [{ role: 'line', d: "M8 8H16A3 3 0 0 1 19 11V17A3 3 0 0 1 16 20H8A3 3 0 0 1 5 17V11A3 3 0 0 1 8 8z" }, { role: 'line', d: "M9 8 V6.5 A3 3 0 0 1 15 6.5 V8" }] },
  boarding: { name: "탑승권", parts: [{ role: 'line', d: "M6 5h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5V7a2 2 0 0 1 2-2z" }, { role: 'line', d: "M15 7.5v1.6M15 11.2v1.6M15 14.9v1.6" }] },
  calendar: { name: "달력", parts: [{ role: 'line', d: "M7 5.5H17A3 3 0 0 1 20 8.5V16.5A3 3 0 0 1 17 19.5H7A3 3 0 0 1 4 16.5V8.5A3 3 0 0 1 7 5.5z" }, { role: 'line', d: "M4 10 H20" }, { role: 'line', d: "M8.5 3.5 V7.5 M15.5 3.5 V7.5" }] },
  chat: { name: "대화", parts: [{ role: 'line', d: "M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" }, { role: 'line', d: "M7.5 9.5h9M7.5 12.5h5.5" }] },
  check: { name: "체크", parts: [{ role: 'line', d: "M5 12.5 L10 17 L19 7.5" }] },
  chev_down: { name: "아래로", parts: [{ role: 'line', d: "M6 9 L12 15 L18 9" }] },
  chev_left: { name: "왼쪽으로", parts: [{ role: 'line', d: "M15 6 L9 12 L15 18" }] },
  chev_right: { name: "오른쪽으로", parts: [{ role: 'line', d: "M9 6 L15 12 L9 18" }] },
  chev_up: { name: "위로", parts: [{ role: 'line', d: "M6 15 L12 9 L18 15" }] },
  close: { name: "닫기", parts: [{ role: 'line', d: "M6 6 L18 18 M18 6 L6 18" }] },
  coin: { name: "마일리지", parts: [{ role: 'line', d: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0z" }, { role: 'line', d: "M7.5 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0z" }] },
  diamond: { name: "마름모", parts: [{ role: 'line', d: "M12 5 L17 12 L12 19 L7 12 Z" }] },
  doc: { name: "문서", parts: [{ role: 'line', d: "M8 4H16A3 3 0 0 1 19 7V17A3 3 0 0 1 16 20H8A3 3 0 0 1 5 17V7A3 3 0 0 1 8 4z" }, { role: 'line', d: "M9 9 H15 M9 12.5 H15 M9 16 H12" }] },
  face: { name: "얼굴", parts: [{ role: 'line', d: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0z" }, { role: 'line', d: "M8.5 14.2 C9.5 15.7 10.7 16.4 12 16.4 C13.3 16.4 14.5 15.7 15.5 14.2" }, { role: 'line', d: "M9 10 H9.01 M15 10 H15.01" }] },
  help: { name: "도움말", parts: [{ role: 'line', d: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0z" }, { role: 'line', d: "M9.7 9.6 A2.4 2.4 0 1 1 13.1 11.8 C12.4 12.2 12 12.7 12 13.6" }, { role: 'line', d: "M12 16.6 H12.01" }] },
  info: { name: "안내", parts: [{ role: 'line', d: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0z" }, { role: 'line', d: "M12 11 V16" }, { role: 'line', d: "M12 7.8 H12.01" }] },
  lock: { name: "자물쇠", parts: [{ role: 'line', d: "M7.5 11H16.5A2.5 2.5 0 0 1 19 13.5V17.5A2.5 2.5 0 0 1 16.5 20H7.5A2.5 2.5 0 0 1 5 17.5V13.5A2.5 2.5 0 0 1 7.5 11z" }, { role: 'line', d: "M8.5 11 V8.5 A3.5 3.5 0 0 1 15.5 8.5 V11" }] },
  person: { name: "사람", parts: [{ role: 'line', d: "M8.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0z" }, { role: 'line', d: "M5 20 C5 16 8 13.5 12 13.5 C16 13.5 19 16 19 20" }] },
  pillars: { name: "기둥", parts: [{ role: 'line', d: "M4.7 11H5.3A1.2 1.2 0 0 1 6.5 12.2V18.8A1.2 1.2 0 0 1 5.3 20H4.7A1.2 1.2 0 0 1 3.5 18.8V12.2A1.2 1.2 0 0 1 4.7 11z" }, { role: 'line', d: "M9.7 5H10.3A1.2 1.2 0 0 1 11.5 6.2V18.8A1.2 1.2 0 0 1 10.3 20H9.7A1.2 1.2 0 0 1 8.5 18.8V6.2A1.2 1.2 0 0 1 9.7 5z" }, { role: 'line', d: "M14.7 8H15.3A1.2 1.2 0 0 1 16.5 9.2V18.8A1.2 1.2 0 0 1 15.3 20H14.7A1.2 1.2 0 0 1 13.5 18.8V9.2A1.2 1.2 0 0 1 14.7 8z" }, { role: 'line', d: "M19.7 13H20.3A1.2 1.2 0 0 1 21.5 14.2V18.8A1.2 1.2 0 0 1 20.3 20H19.7A1.2 1.2 0 0 1 18.5 18.8V14.2A1.2 1.2 0 0 1 19.7 13z" }] },
  send: { name: "보내기", parts: [{ role: 'line', d: "M4 12 H19 M13 6 L19 12 L13 18" }] },
  settings: { name: "설정", parts: [{ role: 'line', d: "M4 7h8.3M17.7 7H20M4 12h2.3M11.7 12H20M4 17h9.8M19.2 17H20" }, { role: 'line', d: "M12.3 7a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0 -5.4 0z" }, { role: 'line', d: "M6.3 12a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0 -5.4 0z" }, { role: 'line', d: "M13.8 17a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0 -5.4 0z" }] },
  sun: { name: "해", parts: [{ role: 'line', d: "M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0z" }, { role: 'line', d: "M12 3.5 V5.5 M12 18.5 V20.5 M3.5 12 H5.5 M18.5 12 H20.5 M6 6 L7.4 7.4 M16.6 16.6 L18 18 M18 6 L16.6 7.4 M7.4 16.6 L6 18" }] },
} as const satisfies Record<string, { name: string; parts: readonly IconPart[] }>;
