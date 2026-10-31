// 마일리지 확인 시트 셋과 잔액 부족 칸(IF5-F2 ⑨ · 화면 요구 IF-MILE-OK ① ② ③ · 디자인 MI-3 ~ 7 · 카피 24-10 `MILEAGE.confirm|talkStart|big|low`).
//  ① 쓰기 확인(300 이상): "{N} 마일리지를 써요" + 쓰고 나면 돌려받을 수 없어요 + 지금 {잔액} · 쓰고 나면 {쓴 뒤} + 체크(미리 체크 0) + [쓰기] · [취소] 같은 크기
//  ② 대화 시작: 시작할 때 한 번만 · "한 번 말할 때마다 N 마일리지를 써요" + [시작하기] · [취소]. 이후 턴은 시트 0 · 대화 화면에 줄어드는 숫자 0
//  ③ 큰 충전: 한 줄 "33,000원을 충전해요 · …" + [충전하기] · [취소] (월 합계 상한 0)
//  · N 은 쓰기 전에 보이는 **가산까지 더한 최종 마일리지**(base + extra) — 서버 get_mileage_cost 응답. 낙관적 차감 0: 시트의 '쓴 뒤'는 서버 잔액 − 서버 cost 를 보여 줄 뿐 잔액을 바꾸지 않는다
//  · 연타 0: [쓰기]를 누르면 busy 로 비활성(요청 번호 하나)
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CheckBox } from '@/components/CheckBox';
import { Pressable } from '@/components/Pressable';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { colors, radius, space } from '@/theme/tokens';

import { fmt } from './mileageLogic';

type Common = { visible: boolean; onClose: () => void; testID?: string };

/** ① 쓰기 확인 — 기능 이름 · 최종 마일리지 · 잔액 */
export function ConfirmSpendSheet(p: Common & { featureName: string; cost: number; balance: number; busy?: boolean; onGo: () => void }) {
  const testID = p.testID ?? 'mileage-ok';
  return (
    <BottomSheet visible={p.visible} onClose={p.busy ? () => undefined : p.onClose} testID={testID}>
      {p.visible ? <SpendBody {...p} testID={testID} /> : null}
    </BottomSheet>
  );
}
function SpendBody({ featureName, cost, balance, busy, onGo, onClose, testID = 'mileage-ok' }: Common & { featureName: string; cost: number; balance: number; busy?: boolean; onGo: () => void }) {
  const [checked, setChecked] = useState(false); // 미리 체크 0
  return (
    <View style={styles.sheet} testID={`${testID}-body`}>
      <AppText variant="caption" testID={`${testID}-what`}>
        {t5('MILEAGE.confirm.what', { '기능 이름': featureName })}
      </AppText>
      <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
        {t5('MILEAGE.confirm.title', { N: fmt(cost) })}
      </AppText>
      <AppText variant="body" testID={`${testID}-norefund`}>
        {IF5_TEXT['MILEAGE.confirm.noRefund']}
      </AppText>
      <AppText variant="caption" testID={`${testID}-bal`}>
        {t5('MILEAGE.confirm.bal', { 잔액: fmt(balance), '쓴 뒤': fmt(Math.max(0, balance - cost)) })}
      </AppText>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} aria-checked={checked} accessibilityLabel={IF5_TEXT['MILEAGE.confirm.check']} onPress={() => setChecked((v) => !v)} effect="none" style={styles.checkRow} testID={`${testID}-check`}>
        <CheckBox checked={checked} />
        <AppText variant="body" style={styles.flex}>
          {IF5_TEXT['MILEAGE.confirm.check']}
        </AppText>
      </Pressable>
      <View style={styles.buttons}>
        <View style={styles.flex}>
          <Button label={IF5_TEXT['MILEAGE.confirm.cancel']} variant="secondary" disabled={busy} onPress={onClose} testID={`${testID}-cancel`} />
        </View>
        <View style={styles.flex}>
          <Button label={IF5_TEXT['MILEAGE.confirm.go']} disabled={!checked} loading={busy} onPress={onGo} testID={`${testID}-go`} />
        </View>
      </View>
    </View>
  );
}

/** ② 대화 시작 — 시작할 때 한 번. 카피 줄에 박힌 숫자가 서버 차감표와 같을 때만 그 줄을 쓴다(다르면 '{N} 마일리지를 써요' 꼴로 대신) */
export function TalkStartSheet(p: Common & { kind: 'saju' | 'concern'; cost: number; balance: number; onGo: () => void }) {
  const testID = p.testID ?? 'mileage-talk';
  const lineKey = p.kind === 'saju' ? 'MILEAGE.talkStart.saju.line' : 'MILEAGE.talkStart.concern.line';
  const nameKey = p.kind === 'saju' ? 'MILEAGE.talkStart.saju.name' : 'MILEAGE.talkStart.concern.name';
  const line = IF5_TEXT[lineKey].replace(/,/g, '').includes(String(p.cost)) ? IF5_TEXT[lineKey] : t5('MILEAGE.confirm.title', { N: fmt(p.cost) });
  return (
    <BottomSheet visible={p.visible} onClose={p.onClose} testID={testID}>
      {p.visible ? (
        <View style={styles.sheet} testID={`${testID}-body`}>
          <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-name`}>
            {IF5_TEXT[nameKey]}
          </AppText>
          <AppText variant="body" testID={`${testID}-line`}>
            {line}
          </AppText>
          <AppText variant="caption" testID={`${testID}-once`}>
            {IF5_TEXT['MILEAGE.talkStart.once']}
          </AppText>
          <AppText variant="caption" testID={`${testID}-bal`}>
            {t5('MILEAGE.talkStart.bal', { 잔액: fmt(p.balance) })}
          </AppText>
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button label={IF5_TEXT['MILEAGE.talkStart.cancel']} variant="secondary" onPress={p.onClose} testID={`${testID}-cancel`} />
            </View>
            <View style={styles.flex}>
              <Button label={IF5_TEXT['MILEAGE.talkStart.go']} onPress={p.onGo} testID={`${testID}-go`} />
            </View>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

/** ③ 큰 충전 확인 — 한 줄만 */
export function BigChargeSheet(p: Common & { onGo: () => void }) {
  const testID = p.testID ?? 'mileage-big';
  return (
    <BottomSheet visible={p.visible} onClose={p.onClose} testID={testID}>
      {p.visible ? (
        <View style={styles.sheet} testID={`${testID}-body`}>
          <AppText variant="bodyBold" testID={`${testID}-line`}>
            {IF5_TEXT['MILEAGE.big.line']}
          </AppText>
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button label={IF5_TEXT['MILEAGE.big.cancel']} variant="secondary" onPress={p.onClose} testID={`${testID}-cancel`} />
            </View>
            <View style={styles.flex}>
              <Button label={IF5_TEXT['MILEAGE.big.go']} onPress={p.onGo} testID={`${testID}-go`} />
            </View>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

/** 잔액 부족 — 사실 한 줄 + [충전하러 가기]. 재촉 · 매진 말 0. chat 이면 쓰던 글이 그대로 있다는 한 줄을 더한다 */
export function LowBalance({ need, have, chat, onCharge, testID = 'mileage-low' }: { need: number; have: number; chat?: boolean; onCharge: () => void; testID?: string }) {
  return (
    <View style={styles.card} testID={testID}>
      <AppText variant="bodyBold" accessibilityRole="alert" testID={`${testID}-title`}>
        {IF5_TEXT['MILEAGE.low.title']}
      </AppText>
      <AppText variant="body" testID={`${testID}-need`}>
        {t5('MILEAGE.low.need', { N: fmt(need), 잔액: fmt(have) })}
      </AppText>
      {chat ? (
        <AppText variant="caption" testID={`${testID}-chat`}>
          {IF5_TEXT['MILEAGE.low.chat']}
        </AppText>
      ) : null}
      <Button label={IF5_TEXT['MILEAGE.low.go']} variant="secondary" onPress={onCharge} testID={`${testID}-go`} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: space.s20, gap: space.s12 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s16, gap: space.s8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: 48 },
  buttons: { flexDirection: 'row', gap: space.s8 },
  flex: { flex: 1 },
});
