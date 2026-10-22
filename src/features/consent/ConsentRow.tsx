// 03 동의 화면의 체크 줄 하나(Figma 109:x). 왼쪽: 체크 칸 + 체크 문구(+ 덧붙이는 안내) — 누르면 체크가 바뀐다.
// 오른쪽: '보기 ›' — 누르면 요약이 열린다. 체크 칸과 '보기'는 터치 영역이 따로다(동의문구 3-2 규칙 3).
// [필수] · [선택]은 체크 문구 앞에 글자로 붙어 있다(색만으로 구분하지 않는다). 글은 법무 문서에서 그대로 온 것이다.
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckBox } from '@/components/CheckBox';
import { Pressable } from '@/components/Pressable';
import { CONSENT } from '@/content/copy';
import type { ConsentItemContent } from '@/content/types';
import { layout } from '@/theme/layout';
import { tintAccent } from '@/theme/color';
import { radius, size, space, type } from '@/theme/tokens';

type Props = {
  item: ConsentItemContent;
  checked: boolean;
  emphasized: boolean; // 필수인데 체크하지 않았고, [동의하고 계속]을 눌러 이유 문구가 보이는 중
  onToggle: () => void;
  onOpen: () => void;
};

const MORE_WORD = CONSENT.more.replace(/\s*›$/, '');

export function ConsentRow({ item, checked, emphasized, onToggle, onOpen }: Props) {
  return (
    <View style={[styles.row, emphasized ? styles.emphasized : null]} testID={`consent-row-${item.code}`}>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={checked}
        accessibilityLabel={item.label}
        accessibilityHint={item.note ?? undefined}
        onPress={onToggle}
        effect="none"
        testID={`consent-check-${item.code}`}
        style={styles.main}>
        <View style={styles.line}>
          <View style={styles.boxSlot}>
            <CheckBox checked={checked} emphasized={emphasized} />
          </View>
          <AppText variant="body" style={styles.label}>
            {item.label}
          </AppText>
        </View>
        {item.note ? (
          <AppText variant="caption" style={styles.note}>
            {item.note}
          </AppText>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityLabel={`${item.label} ${MORE_WORD}`}
        onPress={onOpen}
        effect="none"
        testID={`consent-more-${item.code}`}
        style={styles.more}>
        <AppText variant="captionMedium" tone="sub">
          {CONSENT.more}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: radius.sm },
  emphasized: { backgroundColor: tintAccent },
  // 한 줄 높이 = 터치 최소 44: 글자 줄(22)을 가운데에 놓으면 위 · 아래 안 여백이 11
  main: { flex: 1, minHeight: size.touchMin, paddingVertical: layout.rowPaddingY, paddingLeft: space.s4 },
  line: { flexDirection: 'row', alignItems: 'flex-start' },
  boxSlot: { height: type.body.lineHeight, justifyContent: 'center', marginRight: space.s12 }, // 체크 칸을 글자 첫 줄 가운데에
  label: { flex: 1 },
  note: { marginLeft: layout.checkBox + space.s12 }, // 덧붙이는 안내: 체크 문구와 왼쪽 맞춤
  more: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
});
