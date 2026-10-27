// 탑승권 한 장(T1 · T2 그래픽). 종이 카드(Card paper) + A안 로고 타일 + 점선 한 줄 — 새 색 · 새 크기 0(tokens 만).
//  칸: 회차 · 출발(내 지역) → 도착(여행지에서 만날 한 분) · 만나는 때(날짜 · 요일 · 시각) · 상태. 좌석 번호 · 순번 · 남은 좌석 0
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { LogoTile } from '@/motion';
import { colors, space } from '@/theme/tokens';

import { BOARDING } from './boardingCopy';

const TILE = space.s32;

type Props = { roundNo: number | null; regionName: string | null; when: string | null; status: string; testID?: string };

export function TicketCard({ roundNo, regionName, when, status, testID = 'ticket' }: Props) {
  const label = [BOARDING.ticketTitle, roundNo ? BOARDING.round(roundNo) : null, `${BOARDING.from} ${regionName ?? BOARDING.fromDefault}`, when ? `${BOARDING.when} ${when}` : null, status].filter(Boolean).join(', ');
  return (
    <Card variant="paper" style={styles.card} accessible accessibilityLabel={label} testID={testID}>
      <View style={styles.head}>
        <LogoTile size={TILE} />
        <AppText variant="bodyBold" style={styles.flex} testID={`${testID}-title`}>
          {BOARDING.ticketTitle}
        </AppText>
        {roundNo ? (
          <AppText variant="captionMedium" tone="accent" testID={`${testID}-round`}>
            {BOARDING.round(roundNo)}
          </AppText>
        ) : null}
      </View>
      <View style={styles.route}>
        <View style={styles.fromCol}>
          <AppText variant="caption">{BOARDING.from}</AppText>
          <AppText variant="bodyMedium" testID={`${testID}-from`}>
            {regionName ?? BOARDING.fromDefault}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="caption">{BOARDING.to}</AppText>
          <AppText variant="bodyMedium">{BOARDING.toValue}</AppText>
        </View>
      </View>
      <View style={styles.cut} />
      <View style={styles.row}>
        <AppText variant="caption">{BOARDING.when}</AppText>
        <AppText variant="bodyMedium" testID={`${testID}-when`}>
          {when ?? '—'}
        </AppText>
      </View>
      <View style={styles.row}>
        <AppText variant="caption">{BOARDING.state}</AppText>
        <AppText variant="bodyMedium" tone="accent" testID={`${testID}-status`}>
          {status}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.s16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  flex: { flex: 1 },
  route: { flexDirection: 'row', gap: space.s16 },
  fromCol: { flexShrink: 1, maxWidth: '40%' }, // QP-17: 출발(짧은 지역 이름)은 제 길이만, 남는 폭은 도착 글('여행지에서 만날 한 분')에 — 360 폭에서 '분' 한 글자만 내려가지 않게
  cut: { borderTopWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  row: { gap: space.s4 },
});
