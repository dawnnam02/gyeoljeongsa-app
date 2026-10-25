// T3 앞 도착 화면(D42-M · D-178): 수요일 18:00 공개 시각이 지난 회차를 처음 볼 때 한 번. [지금 열어 보기] → 공개 순간(표지 넘김 700).
//  위에서 아래: 그림 '공개 순간'(앱3 Illustration) · 날짜 알약 '12월 23일(수) 18:00' · 제목 "여행지에 도착했어요" · 부제 · [지금 열어 보기]
//  움직임(2안 '지면' 핵심 ②, 명세 4-3 arrive): 알약 왼쪽에서 걷힘 480(0) · 그림 위에서 걷힘 560(90) · 제목 줄 가림 560(180, 이 화면의 줄 가림 1곳) ·
//   부제 걷힘 600(270) · 버튼 투명도 300(360). 바탕이 그라데이션이라 걷힘은 역이동. 동작 줄이기면 모두 투명도 150. 재촉 · 카운트다운 0(알약은 정해진 시각 한 줄)
//  탑승권 탭(BoardingScreen)과 /reveal(푸시로 바로 온 때, RevealScreen)이 같이 쓴다
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Illustration } from '@/components/Illustration';
import { Fade, MaskLine, scene2, Wipe } from '@/motion';
import { colors, radius, size, space } from '@/theme/tokens';

import { ARRIVE } from './boardingCopy';

const A = scene2.arrive;

export function ArriveView({ when, onOpen, testID = 'arrive' }: { when: string; onOpen: () => void; testID?: string }) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Wipe delay={A.artDelay} duration={A.art} style={styles.stretch}>
        <Illustration scene="reveal" testID={`${testID}-art`} />
      </Wipe>
      <Wipe from="left" duration={A.pill}>
        <View style={styles.pill}>
          <AppText variant="captionMedium" tone="accent" testID={`${testID}-when`}>
            {when}
          </AppText>
        </View>
      </Wipe>
      <MaskLine variant="title" accessibilityRole="header" style={styles.center} wrapStyle={styles.stretch} delay={A.titleDelay} duration={A.title} testID={`${testID}-title`}>
        {ARRIVE.title}
      </MaskLine>
      <Wipe delay={A.subDelay} duration={A.sub} style={styles.stretch}>
        <AppText variant="body" tone="sub" style={styles.center} testID={`${testID}-body`}>
          {ARRIVE.body}
        </AppText>
      </Wipe>
      <Fade visible delay={A.ctaDelay} duration={A.cta} name="edOut" style={styles.stretch}>
        <Button label={ARRIVE.open} onPress={onOpen} testID={`${testID}-open`} />
      </Fade>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.s16 },
  stretch: { alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  pill: { minHeight: size.badge, justifyContent: 'center', paddingHorizontal: space.s12, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
});
