// 임시 다리(W9 · D-154): 등급 ↔ 풍경 짝은 서버 짝 표가 원본이다(서버만 안다).
//  3부-사: 16-G1 '내 등급'은 0039 get_my_grade 의 grade_icon 을 그대로 쓴다(이 다리를 지나지 않는다).
//  남은 곳은 16-G2 변화 기록 하나 — list_grade_history(0012)는 아직 from_no · to_no 숫자만 주고, v5 에서는 구독자가 없어 늘 { locked:true }(그릴 줄 0).
//  서버가 기록에도 풍경 키를 주면 이 파일을 지운다(팀장 넘김). 이 표의 짝은 0039 grade_icon_of 와 같고, 화면에 번호로 드러나지 않는다.
import { asGradeNo } from '@/lib/gradeApi';

import { isGradeIconKey, type GradeIconKey } from './GradeIcon';

// 시안 '아홉 칸'의 섞은 순서(order=[3,7,0,5,1,8,2,6,4])를 그대로 가정 짝으로 쓴다
const DEMO_PAIR: readonly GradeIconKey[] = ['cloud', 'sun', 'sea', 'bridge', 'mountain', 'field', 'moon', 'forest', 'island'];

export function iconOf(serverIcon: unknown, gradeNo: number | null | undefined): GradeIconKey | null {
  if (isGradeIconKey(serverIcon)) return serverIcon;
  const no = asGradeNo(gradeNo);
  return no === null ? null : DEMO_PAIR[no - 1];
}
