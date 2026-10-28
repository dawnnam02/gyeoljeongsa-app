// IF-TYPE 내 여행 타입(F-19 · 정책 PF-31 ~ PF-33 · 카피 21-5) — 엽서 앞(타입 이름 · 소품) · [뒷면 보기] → 뒤(설명 · 끝줄) · 노선도(내 역 + 대화가 편하게 이어지는 타입).
//  · 타입은 성향 정리 결과(15장 계산) · 등급 입력 0 · 짝 타입 0 · 우열 · 희귀 · 퍼센트 · 진행 숫자 0 · 공유 단추는 그리지 않음(type_card_share 꺼짐 · 신고번호 뒤)
//  · 서버 타입 코드 · 열두 타입 이름 · 설명 · 짐 싸기 질문 원문이 아직 없다(미확인 — 앱 IF2-F 변경기록 0-3). 실서버 = 타입 없음(이 화면에 오면 불러오지 못함 한 줄) · 데모만 표본 한 타입
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { if2Look } from '@/theme/if2Look';
import { colors, radius, size, space } from '@/theme/tokens';

import { inflightServices, type TravelType, type TypeSource } from './inflightService';
import { Art, artXml, Footnote, if2Styles } from './If2Parts';
import { tx } from './if2Text';

export function TypeCardScreen({ source }: { source?: TypeSource }) {
  const router = useRouter();
  const src = source ?? inflightServices().type;
  const [type, setType] = useState<TravelType | null | 'loading'>('loading');
  const [side, setSide] = useState<'front' | 'back'>('front');
  useEffect(() => {
    void src.mine().then(setType);
  }, [src]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));
  return (
    <Screen edges={['top']} testID="screen-type">
      <ScreenHeader title={tx('TYPE_CARD.result.kicker')} onBack={back} testID="type-header" />
      <ScrollView contentContainerStyle={styles.body}>
        {type === null ? (
          <AppText variant="body" tone="sub" testID="type-none">
            {tx('TYPE_CARD.loadFailed')}
          </AppText>
        ) : type === 'loading' ? null : side === 'front' ? (
          <View style={if2Styles.gap} testID="type-front" accessible accessibilityLabel={tx('TYPE_CARD.a11y.front', { '타입 이름': type.name, '소품 이름': '' }).replace(/, $/, '')}>
            <View style={styles.card}>
              <Art xml={artXml('typeFront')} width="100%" height={styles.art.height} />
            </View>
            <AppText variant="caption">{tx('TYPE_CARD.result.kicker')}</AppText>
            <AppText variant="heading" testID="type-name">
              {tx('TYPE_CARD.result.name', { '타입 이름': type.name })}
            </AppText>
          </View>
        ) : (
          <View style={if2Styles.gap} testID="type-back">
            <View style={styles.card} accessible accessibilityLabel={tx('TYPE_CARD.a11y.back', { 설명: type.lines.join(' ') })}>
              {type.lines.map((l) => (
                <AppText key={l} variant="body">
                  {l}
                </AppText>
              ))}
              <Art xml={artXml('postmark')} width={if2Look.stampW} height={if2Look.stampW} />
            </View>
            <View style={if2Styles.section} testID="type-route" accessible accessibilityLabel={[tx('TYPE_CARD.route.title'), ...type.route].join(', ')}>
              <AppText variant="bodyBold">{tx('TYPE_CARD.route.title')}</AppText>
              <Art xml={artXml('metro')} width="100%" height={styles.metro.height} />
              <AppText variant="captionMedium" tone="accent">
                {tx('TYPE_CARD.route.mine')}
              </AppText>
              {type.route.map((r) => (
                <AppText key={r} variant="body">
                  {r}
                </AppText>
              ))}
            </View>
            <Footnote text={tx('TYPE_CARD.footer')} testID="type-footer" />
          </View>
        )}
        {type && type !== 'loading' ? <Button label={side === 'front' ? tx('TYPE_CARD.result.flip') : tx('TYPE_CARD.result.flipBack')} variant="secondary" onPress={() => setSide(side === 'front' ? 'back' : 'front')} testID="type-flip" /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, gap: space.s16 },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8, overflow: 'hidden' },
  art: { height: 200 },
  metro: { height: 28 },
});
