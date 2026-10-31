// G-01 읽는 법(IF5-F1b ⓓ · 카피 22-3 `READ_GUIDE` 5키) — 기내지 ① 쪽 접힘 칸 · 하늘 도감 맨 위. 별자리 · 오행 · 카드에 나오는 낱말을 쉬운 말로 푼다.
//  · 늘 접힌 채 시작하고 펼침을 기기에도 기억하지 않는다(화면 메모리뿐). 데이터 0 · 동의와 상관없음 · 판정 말 0
//  · 풀이 본문은 라이브러리 `howto`(hw-01 ~ 32 · 22-11): 낱말 = 제목 · 풀이 = 글. hw-01 은 `READ_GUIDE.lead` 가 대신해 빼고,
//    hw-23('시주 칸 … 태어난 시각은 받지 않아서 비워 둬요')은 사주 마당이 시각을 받게 되어 사실과 어긋나 이 칸에서 뺀다(AI · 마케팅 확인 넘김)
//  · 접힘 움직임(260ms · 동작 줄이기 150ms 투명도, 카피 22-13 앱 IF3-F 메모)은 아직 안 넣었다 — 지금은 바로 펼친다(넘김)
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import lib from '@/content/if3Library.json';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { IF3_TEXT, t3 } from '@/content/if3Copy';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { if2Styles } from './If2Parts';

const SKIP = ['hw-01', 'hw-23'];
export const readGuideEntries = (): { id: string; word: string; text: string }[] => lib.howto.filter((h) => !SKIP.includes(h.id)).map((h) => ({ id: h.id, word: h.title, text: h.text }));

export function ReadGuide({ testID = 'read-guide' }: { testID?: string }) {
  const [open, setOpen] = useState(false);
  const label = open ? IF3_TEXT['READ_GUIDE.a11y.close'] : IF3_TEXT['READ_GUIDE.a11y.open'];
  return (
    <View style={styles.box} testID={testID}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(!open)} effect="none" style={({ pressed }) => [styles.head, pressed && styles.pressed]} testID={`${testID}-toggle`}>
        <AppText variant="bodyMedium" style={if2Styles.flex}>
          {IF3_TEXT['READ_GUIDE.title']}
        </AppText>
        <Icon name="chevron" size={20} color={colors.sub} rotate={open ? -90 : 90} />
      </Pressable>
      {open ? (
        <View style={if2Styles.gapSmall} testID={`${testID}-body`}>
          <AppText variant="caption" testID={`${testID}-lead`}>
            {IF3_TEXT['READ_GUIDE.lead']}
          </AppText>
          {readGuideEntries().map((e) => (
            <View key={e.id} style={if2Styles.gapSmall} accessible accessibilityLabel={t3('READ_GUIDE.a11y.entry', { 낱말: e.word, 풀이: e.text })} testID={`${testID}-${e.id}`}>
              <AppText variant="bodyMedium">{e.word}</AppText>
              <AppText variant="body">{e.text}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.s12, gap: space.s8 },
  head: { minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  pressed: { opacity: alpha.pressed },
});
