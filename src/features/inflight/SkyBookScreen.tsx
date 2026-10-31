// IF-BOOK 하늘 도감(G-03 · 정책 PG-31 ~ PG-33 · 카피 22-5) — 별자리 열두 칸(달력 차례 · 번호 0) + 카드 이름 · 뜻(예부터 전해 오는 차례 · 번호 0).
//  · 자기 값이 없는 참고 화면: 동의(CK17A) · 서버 호출 0 · 내 별자리 표시 0 · 전부 처음부터 열림 — 열람 기록 · 본 표시 · 모으기 · 잠금 · 순위 · 정렬 · 검색 · 새 표시 0
//  · 별자리 칸은 누르면 펼침(펼침을 기억하지 않음 · 읽었는지 표시 0). 끝이 있다: 맨 아래 '도감은 여기까지예요.' + [닫기] · 더 불러오기 0
//  · 맨 아래 끝줄 FUN.footer + 생성형 AI 알림 FUN.aiNote(기내지 밖 새 글 화면). G-01 읽는 법 머리 칸(IF5-F1b · 스위치 read_guide)
//  · 글은 카피 22-5 + 라이브러리(별자리 글 · 카드 뜻 · 원소 · 성질 이름). 캡처 막기 · 공유 · 복사 0(공유 단추를 그리지 않는다)
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import art3 from '../../../assets/illustrations/if3art.json';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { IF3_TEXT, t3 } from '@/content/if3Copy';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { Footnote, if2Styles } from './If2Parts';
import { tx } from './if2Text';
import { ReadGuide } from './ReadGuide';
import { bookCards, bookSigns, type BookSign } from './if3Logic';

export const SKY_BOOK_HREF = '/sky-book';

function SignCell({ sign, open, onToggle, id }: { sign: BookSign; open: boolean; onToggle: () => void; id: string }) {
  const testID = id;
  const period = t3('SKY_BOOK.sign.period', { '시작 날짜': sign.start, '끝 날짜': sign.end });
  const zodiac = (art3.signs as Readonly<Record<string, string>>)[sign.code] ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      aria-expanded={open}
      accessibilityLabel={t3('SKY_BOOK.a11y.sign', { '별자리 이름': sign.name, 시기: period, 뜻: sign.text })}
      onPress={onToggle}
      effect="none"
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
      testID={testID}>
      <View style={if2Styles.row}>
        <View style={styles.zodiac} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SvgXml xml={zodiac} width="100%" height="100%" />
        </View>
        <View style={if2Styles.flex}>
          <AppText variant="bodyMedium" testID={`${testID}-name`}>
            {sign.name}
          </AppText>
          <AppText variant="caption" testID={`${testID}-period`}>
            {period}
          </AppText>
        </View>
      </View>
      {open ? (
        <View style={if2Styles.gapSmall} testID={`${testID}-body`}>
          <AppText variant="captionMedium" tone="accent" testID={`${testID}-kind`}>
            {`${sign.element} · ${sign.quality}`}
          </AppText>
          <AppText variant="body">{sign.text}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function SkyBookScreen({ guide = false }: { guide?: boolean }) { // guide = 스위치 read_guide(G-01 읽는 법 머리 칸 · IF5-F1b) — 라우트가 정해 넘긴다
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null); // 화면 메모리뿐(기억 0)
  const back = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));
  const signs = bookSigns();
  const cards = bookCards();
  return (
    <Screen edges={['top']} testID="screen-book">
      <ScreenHeader title={IF3_TEXT['SKY_BOOK.title']} onBack={back} testID="book-header" />
      <ScrollView contentContainerStyle={styles.body} testID="book-scroll">
        <AppText variant="body" testID="book-lead">
          {IF3_TEXT['SKY_BOOK.lead']}
        </AppText>
        {guide ? <ReadGuide testID="book-read-guide" /> : null}
        <View style={if2Styles.gap} accessible={false} testID="book-signs" accessibilityLabel={t3('SKY_BOOK.a11y.sheet', { '갈래 이름': IF3_TEXT['SKY_BOOK.section.sign'] })}>
          <AppText variant="title" accessibilityRole="header">
            {IF3_TEXT['SKY_BOOK.section.sign']}
          </AppText>
          <AppText variant="caption" testID="book-sign-note">
            {IF3_TEXT['SKY_BOOK.signNote']}
          </AppText>
          {signs.map((s, i) => (
            <SignCell key={s.code} sign={s} open={open === s.code} onToggle={() => setOpen(open === s.code ? null : s.code)} id={`book-sign-${i}`} />
          ))}
        </View>
        <View style={if2Styles.gap} testID="book-cards">
          <AppText variant="title" accessibilityRole="header">
            {IF3_TEXT['SKY_BOOK.section.card']}
          </AppText>
          <AppText variant="caption" testID="book-card-note">
            {IF3_TEXT['SKY_BOOK.cardNote']}
          </AppText>
          {cards.map((c, i) => (
            <View key={c.name} style={styles.cell} accessible accessibilityLabel={t3('SKY_BOOK.a11y.card', { '카드 이름': c.name, 뜻: c.meaning })} testID={`book-card-${i}`}>
              <AppText variant="bodyMedium" testID={`book-card-${i}-name`}>
                {c.name}
              </AppText>
              <AppText variant="body" testID={`book-card-${i}-meaning`}>
                {c.meaning}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="bodyMedium" testID="book-end">
          {IF3_TEXT['SKY_BOOK.end']}
        </AppText>
        <Button label={tx('MAGAZINE.close')} variant="secondary" onPress={back} testID="book-close" />
        <Footnote text={tx('FUN.footer')} testID="book-footer" />
        <Footnote text={IF3_TEXT['FUN.aiNote']} testID="book-ai-note" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, paddingBottom: space.s40, gap: space.s16 },
  cell: { backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.s12, gap: space.s8, minHeight: size.touchMin },
  pressed: { opacity: alpha.pressed },
  zodiac: { width: 40, height: 40 },
});
