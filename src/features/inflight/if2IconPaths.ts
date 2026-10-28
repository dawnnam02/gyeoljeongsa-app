// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-if2-assets.mjs (IF2-F)
// 원본: 디자인/IF2_기내서비스/원본/paths.json(IF2-D 새 아이콘 15 · D42 1안 규격 24 격자 · 선 1.5 · role shape · line · dot)
import type { IconPart } from '@/components/iconPaths';

export const IF2_ICON_PATHS = {
  pocket: { name: "좌석 앞 주머니", parts: [{ role: "line", d: "M4 10c2.6-1.2 5.3-1.8 8-1.8s5.4.6 8 1.8v8.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z" }, { role: "line", d: "M7.5 8.6V4.5h4v3.8" }, { role: "line", d: "M14 8.3l1.2-4.1 3.4 1-1.1 3.6" }] },
  magazine: { name: "기내지", parts: [{ role: "line", d: "M12 6.8C10.2 5.4 7.8 4.8 4 4.8v12.8c3.8 0 6.2.6 8 2 1.8-1.4 4.2-2 8-2V4.8c-3.8 0-6.2.6-8 2z" }, { role: "line", d: "M12 6.8v12.8" }] },
  tcard: { name: "이번 주 카드", parts: [{ role: "line", d: "M8 3.5h8A1.5 1.5 0 0 1 17.5 5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5z" }, { role: "line", d: "M12 8.5l2.2 3.5-2.2 3.5-2.2-3.5z" }] },
  postcard: { name: "엽서", parts: [{ role: "line", d: "M4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6z" }, { role: "line", d: "M15 9h3v3.5h-3z" }, { role: "line", d: "M6 11h5M6 14.5h6.5" }] },
  slip: { name: "쪽지", parts: [{ role: "line", d: "M6 4h12a1 1 0 0 1 1 1v9.5L14.5 19H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" }, { role: "line", d: "M14.5 19v-3.5a1 1 0 0 1 1-1H19" }, { role: "line", d: "M8 8.5h8M8 11.5h5" }] },
  tag: { name: "짐표", parts: [{ role: "line", d: "M8.5 3.5h7L18 6v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6z" }, { role: "line", d: "M11 7.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0z" }, { role: "line", d: "M9 12h6M9 15.5h4" }] },
  memo: { name: "메모", parts: [{ role: "line", d: "M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" }, { role: "line", d: "M8.5 8h7M8.5 11.5h7M8.5 15h4" }] },
  story: { name: "이야기 카드", parts: [{ role: "line", d: "M8.5 4.5h10A1.5 1.5 0 0 1 20 6v10" }, { role: "line", d: "M5.5 7.5h10A1.5 1.5 0 0 1 17 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5V9a1.5 1.5 0 0 1 1.5-1.5z" }, { role: "line", d: "M10.5 11.5l1.8 2-1.8 2-1.8-2z" }] },
  listcard: { name: "나눌 이야기", parts: [{ role: "line", d: "M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" }, { role: "line", d: "M8 8.5l1 1 1.8-2M8 13.5l1 1 1.8-2" }, { role: "line", d: "M13 8.5h3.5M13 13.5h3.5M8.5 17.5h7" }] },
  topics: { name: "이야깃거리", parts: [{ role: "line", d: "M4 5h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 14 14H8.5L5 17v-3H4a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 4 5z" }, { role: "line", d: "M18 9h1.5A1.5 1.5 0 0 1 21 10.5v6a1.5 1.5 0 0 1-1.5 1.5H19v3l-3.5-3H11" }] },
  together: { name: "같이 여는 질문", parts: [{ role: "line", d: "M4.5 5.5h6v13h-6a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z" }, { role: "line", d: "M13.5 5.5h6a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-6z" }, { role: "line", d: "M6 10h2.5M6 13.5h2.5M16 10h2M16 13.5h2" }] },
  vows: { name: "결혼관 이야기", parts: [{ role: "line", d: "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17z" }, { role: "line", d: "M15 9l-1.8 4.2L9 15l1.8-4.2z" }] },
  goodbye: { name: "작별 인사", parts: [{ role: "line", d: "M5 5.5h8.5v13H5A1.5 1.5 0 0 1 3.5 17v-3a2 2 0 0 0 0-4V7A1.5 1.5 0 0 1 5 5.5z" }, { role: "line", d: "M13.5 5.5V7M13.5 9.5V11M13.5 13.5V15M13.5 17.5v1" }, { role: "line", d: "M17 9l3 3-3 3M20 12h-3.5" }] },
  suitcase: { name: "짐 싸기", parts: [{ role: "line", d: "M5 8h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 8z" }, { role: "line", d: "M9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2" }, { role: "line", d: "M8 8v11M16 8v11" }] },
  postmark: { name: "소인", parts: [{ role: "line", d: "M9 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14z" }, { role: "line", d: "M16.5 9c1.2-.8 2.3-.8 3.5 0M16.5 12c1.2-.8 2.3-.8 3.5 0M16.5 15c1.2-.8 2.3-.8 3.5 0" }, { role: "line", d: "M9 9.5l1.8 2.5L9 14.5 7.2 12z" }] },
} as const satisfies Record<string, { name: string; parts: readonly IconPart[] }>;
