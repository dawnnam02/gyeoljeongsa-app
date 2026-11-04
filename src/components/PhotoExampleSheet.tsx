// 사진 칸 예시 시트(QF2 Q2-10f · 디자인 2-6): 칸 아래 글자 단추 [예시 보기] → 그 칸의 좋은 예 한 줄 + 피할 예 한 줄.
//  · 그림 자산(선 그림 6장)이 아직 없어 글로만 그린다 — 좋은 예 = 아이콘 check + 라벨, 피할 예 = 아이콘 decline + 라벨(색만으로 구분하지 않음). 그림이 생기면 줄 위에 얹는다
//  · 피할 예는 올리기 안내 5줄에 이미 있는 규칙(가림 · 다른 분 얼굴 · 연락처 · 광고)의 종류만 말한다 — 외모 우열 · 점수 인상 0
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PHOTOS } from '@/content/qf2Copy';
import { LITE_COMMON } from '@/content/surveyLiteCopy';
import type { PhotoSlot } from '@/lib/surveyLiteApi';
import { colors, space } from '@/theme/tokens';

export function PhotoExampleSheet({ slot, onClose, testID = 'photoslite-example' }: { slot: PhotoSlot | null; onClose: () => void; testID?: string }) {
  const ex = slot ? PHOTOS.example[slot] : null;
  return (
    <BottomSheet visible={slot !== null} onClose={onClose} testID={testID}>
      {ex ? (
        <>
          <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
            {ex.title}
          </AppText>
          <View style={styles.row} testID={`${testID}-good`}>
            <Icon name="check" size={24} color={colors.accent} />
            <View style={styles.text}>
              <AppText variant="bodyMedium">{PHOTOS.example.goodLabel}</AppText>
              <AppText variant="body">{ex.good}</AppText>
            </View>
          </View>
          <View style={styles.row} testID={`${testID}-avoid`}>
            <Icon name="decline" size={24} color={colors.sub} />
            <View style={styles.text}>
              <AppText variant="bodyMedium">{PHOTOS.example.avoidLabel}</AppText>
              <AppText variant="body">{ex.avoid}</AppText>
            </View>
          </View>
          <Button label={LITE_COMMON.confirm} variant="secondary" onPress={onClose} testID={`${testID}-close`} />
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12 },
  text: { flex: 1, gap: space.s4 },
});
