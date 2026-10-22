// 확인창(가운데 카드, Figma 07e~h 202:502~703 · 12g 201:281 · 11f 227:210 · 12j 230:120): 제목 20 Bold · (본문 15 text) · (보조 12 sub) · 주 버튼 위 · [취소] 아래.
// 뒤 화면은 text 40% 로 덮고, Android 뒤로가기는 [취소]와 같다.
// 07 [이대로 확정] 실패 4종, 차단 확인창(본문 없음), 탈퇴 확인창(보조 글 있음), 종교 동의 끄기가 같은 틀을 쓴다(D8 3차 M4 · M5, 팀장 결정 10-15 ⑤: F7 ActionDialog 를 합침).
// busy 이면 주 버튼이 불러오는 표시가 되고 두 버튼 모두 다시 눌리지 않는다(R9). error 는 버튼 위 accent 한 줄.
import { Modal, StyleSheet, View } from 'react-native';

import { alpha, colors, radius, size, space } from '@/theme/tokens';
import { withAlpha } from '@/theme/color';

import { AppText } from './AppText';
import { Button } from './Button';
import { TextButton } from './TextButton';

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  sub?: string;
  note?: { text: string; action?: { label: string; onPress: () => void } }; // 본문 아래 안내 줄(+ 글자 버튼 하나). 12 탈퇴 확인창의 구독 이용 중 안내(NV36)
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
};

export function ConfirmDialog({ visible, title, body, sub, note, confirmLabel, cancelLabel, busy = false, error, onConfirm, onCancel, testID }: Props) {
  const id = (part: string) => (testID ? `${testID}-${part}` : undefined);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} testID={testID}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          <AppText variant="title" accessibilityRole="header" testID={id('title')}>
            {title}
          </AppText>
          {body ? (
            <AppText variant="body" tone="text" testID={id('body')}>
              {body}
            </AppText>
          ) : null}
          {note ? (
            <View style={styles.note} testID={id('note')}>
              <AppText variant="body" tone="text" testID={id('note-text')}>
                {note.text}
              </AppText>
              {note.action ? <TextButton label={note.action.label} align="start" onPress={note.action.onPress} testID={id('note-action')} /> : null}
            </View>
          ) : null}
          {sub ? (
            <AppText variant="caption" testID={id('sub')}>
              {sub}
            </AppText>
          ) : null}
          {error ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={id('error')}>
              {error}
            </AppText>
          ) : null}
          <View style={styles.buttons}>
            <Button label={confirmLabel} loading={busy} onPress={onConfirm} testID={id('confirm')} />
            <Button label={cancelLabel} variant="secondary" disabled={busy} onPress={onCancel} testID={id('cancel')} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: withAlpha(colors.text, alpha.dim), justifyContent: 'center', paddingHorizontal: size.screenPadding },
  card: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.s20, gap: space.s12 },
  note: { gap: space.s4 },
  buttons: { gap: space.s12, paddingTop: space.s8 }, // 세로: 주 버튼 위 · 취소 아래(M5)
});
