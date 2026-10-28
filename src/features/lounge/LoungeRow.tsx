// T4 채팅 목록 맨 위 '라운지 줄'(LG-F · 정책 PL-02 · 화면 요구 T4 '라운지 줄' · 카피 19-2 · 디자인 1A 쪽지 미감).
//  · 스위치 lounge 가 켜졌고 서버가 '비행 중' 상태를 줄 때만(none · closed · left · 꺼짐 · 실패면 줄째 없음 — 오류 글 0)
//  · 글: 제목 '탑승객 라운지' + 상태 한 줄. 좌석 번호 · 인원 · 마지막 글 미리보기 · 새 글 점 · 숫자 0(PL-06 · PL-21)
//  · 실시간 구독 0(줄은 화면에 들어올 때 한 번 읽기만 — 화면 요구 T6 ⑥)
//  · 모양: 종이 줄(높이 88) · 왼쪽 좌석 아이콘(기장 안내만 = 기장 아이콘) · 오른쪽 절취선 너머 쪽지 칸 — 첫 입장 전엔 빈 좌석 칸, 들어간 뒤엔 ›
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Fade } from '@/motion';
import { loungeLook } from '@/theme/loungeLook';
import { colors, radius, size, space } from '@/theme/tokens';

import type { LoungeStateCode } from './loungeApi';
import { LOUNGE } from './loungeCopy';
import { LoungeIcon } from './LoungeIcon';
import { rowLineOf } from './loungeLogic';
import type { LoungeDeps } from './loungeService';

export type LoungeRowState = { code: LoungeStateCode } | null;

// 줄 상태 읽기: 스위치 → lounge_state 한 번. 꺼짐 · 실패 · 줄 없는 상태는 null
export function useLoungeRow(deps: LoungeDeps | undefined) {
  const [row, setRow] = useState<LoungeRowState>(null);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!deps) return;
    const my = (seq.current += 1);
    const on = await deps.switchOn().catch(() => false);
    if (my !== seq.current) return;
    if (!on) {
      setRow(null);
      return;
    }
    const r = await deps.api.state();
    if (my !== seq.current) return;
    setRow(r.ok && rowLineOf(r.data.code) !== null ? { code: r.data.code } : null);
  }, [deps]);
  return { row, load };
}

export function LoungeRow({ code, onPress, testID = 'lounge-row' }: { code: LoungeStateCode; onPress: () => void; testID?: string }) {
  const line = rowLineOf(code);
  if (!line) return null;
  const before = code === 'intro' || code === 'stub'; // 첫 입장 전: 쪽지 칸에 빈 좌석
  const captainOnly = code === 'captain_only';
  return (
    <Fade visible duration={loungeLook.fade}>
      <Pressable accessibilityRole="button" accessibilityLabel={LOUNGE.row.a11y(line)} onPress={onPress} effect="scale" style={styles.row} testID={testID}>
        <View style={styles.main}>
          <LoungeIcon name={captainOnly ? 'captain' : 'seat'} color={colors.accent} testID={`${testID}-icon`} />
          <View style={styles.text}>
            <AppText variant="bodyMedium" numberOfLines={1} testID={`${testID}-title`}>
              {LOUNGE.row.title}
            </AppText>
            <AppText variant="small" tone="sub" numberOfLines={2} testID={`${testID}-line`}>
              {line}
            </AppText>
          </View>
        </View>
        <View style={styles.perf} />
        <View style={styles.stub} testID={`${testID}-stub`}>
          {before ? <View style={styles.seatBox} testID={`${testID}-seat-box`} /> : <Icon name="chevron" size={20} color={colors.sub} />}
        </View>
      </Pressable>
    </Fade>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: loungeLook.rowHeight,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: size.screenPadding,
    marginTop: space.s12,
    marginBottom: space.s8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s12 },
  text: { flex: 1, gap: space.s4 },
  perf: { width: 0, borderLeftWidth: loungeLook.perforation, borderStyle: 'dashed', borderColor: colors.line, marginVertical: space.s8 },
  stub: { width: loungeLook.stubWidth, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  seatBox: { width: loungeLook.stubSeatBox, height: loungeLook.stubSeatBox, borderRadius: radius.sm, borderWidth: loungeLook.perforation, borderStyle: 'dashed', borderColor: colors.sub },
});
