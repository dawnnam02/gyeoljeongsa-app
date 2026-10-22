// 한 줄 안전 안내(N34, 카피.md 10 · 11 확정): 01 · 10 · 11 이 같은 글을 같은 모양으로 둔다(Figma 11 201:2: 보조 12 · sub). F5 · F6 · 01 이 가져다 쓴다.
import { AppText } from '@/components/AppText';
import { SAFETY } from '@/content/copy';

export function SafetyLine({ testID = 'safety-line' }: { testID?: string }) {
  return (
    <AppText variant="caption" testID={testID}>
      {SAFETY.line}
    </AppText>
  );
}
