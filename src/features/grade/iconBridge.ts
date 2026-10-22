// 임시 다리(W9 · D-154): 등급 ↔ 풍경 짝은 서버 짝 표가 원본이다(서버만 안다). 지금 서버(get_my_grade · list_grade_history · 09 · 10)는 grade_no 만 주므로
// 서버가 풍경 키(가정 이름 'grade_icon': sea · mountain · moon · cloud · island · bridge · forest · sun · field)를 주기 전까지만 이 표로 그림을 고른다.
// '서버 이름 맞출 곳': 백엔드가 키를 주면 gradeApi 가 그 키를 읽고 이 파일은 지운다. 이 표의 짝은 데모 가정이며 화면에 번호로 드러나지 않는다.
import { asGradeNo } from '@/lib/gradeApi';

import { isGradeIconKey, type GradeIconKey } from './GradeIcon';

// 시안 '아홉 칸'의 섞은 순서(order=[3,7,0,5,1,8,2,6,4])를 그대로 가정 짝으로 쓴다
const DEMO_PAIR: readonly GradeIconKey[] = ['cloud', 'sun', 'sea', 'bridge', 'mountain', 'field', 'moon', 'forest', 'island'];

export function iconOf(serverIcon: unknown, gradeNo: number | null | undefined): GradeIconKey | null {
  if (isGradeIconKey(serverIcon)) return serverIcon;
  const no = asGradeNo(gradeNo);
  return no === null ? null : DEMO_PAIR[no - 1];
}
