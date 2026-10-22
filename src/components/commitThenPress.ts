// 누르기 전에 한글 입력 조합을 먼저 끝낸다(F23 lib/imeText · 팀장 결정 D-143). 공통 Button · TextButton(상단 바 오른쪽 글자 포함)이 쓴다.
//  웹(아이폰 사파리 등)은 버튼을 눌러도 글 칸의 조합이 끝나지 않을 수 있다. 그때 버튼이 조합 중인 글(예: '김민ㅈ')을 읽으면 검사 · 저장이 틀린다.
//  그래서 조합 중인 칸이 있으면 칸을 내려 조합을 끝내고(commitTyping), 끝난 글이 상태에 들어와 다시 그려진 뒤의 **최신** onPress 를 부른다.
//  조합 중인 칸이 없으면(대부분 · iOS · Android 앱) 바로 onPress — 동작이 바뀌지 않는다.
import { useLayoutEffect, useRef } from 'react';

import { commitTyping, imeBusy } from '@/lib/imeText';

export function useCommitThenPress(onPress: (() => void) | undefined): (() => void) | undefined {
  const latest = useRef(onPress);
  useLayoutEffect(() => {
    latest.current = onPress; // 다시 그려질 때마다 최신 일로
  });
  if (!onPress) return undefined;
  return () => {
    if (imeBusy()) void commitTyping().then(() => latest.current?.());
    else onPress();
  };
}
