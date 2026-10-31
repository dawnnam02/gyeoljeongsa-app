import { useMemo } from 'react';

import { boardingServices } from '@/features/boarding/boardingServices';
import { MagazineScreen } from '@/features/inflight/MagazineScreen';
import { inflightServices } from '@/features/inflight/inflightService';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID IF-MAG 기내지(IF2-F · F-08 · F-02 · 이번 주 카드 F-09 는 ② 쪽). 탭 밖 · 새 탭 0 — 들어오는 길은 홈 B3 좌석 앞 주머니(기내지 · 이번 주 카드 칸).
//  스위치 inflight_mag 꺼짐 · 탑승 아님 · 기간 지남으로 바로 오면 '닫혔어요' 한 줄 + [탑승권으로](화면 C4 · PF-93). 본문은 features/inflight/MagazineScreen.tsx
export default function MagazineRoute() {
  const { isOn } = useFeatureFlags();
  const preOn = isOn('pre_answer');
  // 3부-카 하늘 읽기 스위치 셋(창밖 하늘 · 사랑하는 방식 · 생일 주간 엽서) + 하늘 도감 길 — 꺼진 칸은 그리지 않는다(실서버 처음값 모두 꺼짐)
  const skyWeekOn = isOn('sky_week');
  const waysOn = isOn('my_ways');
  const birthOn = isOn('birth_card');
  const bookOn = isOn('sky_book');
  // 서버는 '안 탄 분'과 '탄 뒤 닫힌 분'을 가르지 않아 탑승권 상태를 함께 넘긴다(3부-자 QP-43 — none 일 때만 읽음)
  const deps = useMemo(
    () => ({
      ...inflightServices(),
      preOn,
      isOn: (k: string) => (k === 'sky_week' ? skyWeekOn : k === 'my_ways' ? waysOn : k === 'birth_card' ? birthOn : k === 'sky_book' ? bookOn : false),
      boarding: async () => {
        const r = await boardingServices().api.load();
        return r.ok ? r.state : null;
      },
    }),
    [preOn, skyWeekOn, waysOn, birthOn, bookOn],
  );
  return <MagazineScreen deps={deps} />;
}
