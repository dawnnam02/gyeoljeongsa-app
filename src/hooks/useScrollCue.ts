// 스크롤 단서(R1 A⑦ · T12 · K13 51 · K15 3장 14번): 긴 화면에서 아래에 더 있는지 알려 주는 판단. 그림은 components/ScrollCue.
//  · 근거: "하단의 추가 콘텐츠가 잘 드러나지 않으면 스크롤을 시도하지 않았어요"(토스 시니어 연구, K13 51)
//  · 쓰는 법: const cue = useScrollCue(); <ScrollView {...cue.handlers}> … </ScrollView><ScrollCue visible={cue.more} />
//  · 붙일 화면(2단계, 각 화면 주인): 03 동의 · 16-G1 내 등급 · 그 밖 긴 화면. '다음 영역이 조금 보이게' 하는 배치 규칙은 디자인 D22 한 줄이 정한다(D① 몫)
import { useCallback, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { space } from '@/theme/tokens';

export const SCROLL_CUE_SLACK = space.s8; // 끝에서 이만큼 안쪽이면 '다 봤다'로 본다

// 아래에 가려진 내용이 남았나
export function hasMoreBelow(viewport: number, content: number, offset: number, slack: number = SCROLL_CUE_SLACK): boolean {
  if (!(viewport > 0) || !(content > 0)) return false;
  return content - (offset + viewport) > slack;
}

export function useScrollCue() {
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.height), []);
  const onContentSizeChange = useCallback((_w: number, h: number) => setContent(h), []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setOffset(e.nativeEvent.contentOffset.y), []);
  return { more: hasMoreBelow(viewport, content, offset), handlers: { onLayout, onContentSizeChange, onScroll, scrollEventThrottle: 64 } };
}
