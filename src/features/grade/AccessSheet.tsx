// 16-G5 내 등급 알려 주세요(무료 열람 요청, 법상 필수 — 수익/상점_화면.md 7-6b, 카피 16-G, Figma 314:96 ~ 314:143).
//  모든 회원이 쓴다(비구독자 · 구독 끝난 회원 · 구독자). 구독 여부 · 횟수로 막지 않는다. 답에 구독 권유를 섞지 않는다.
//  시트: 제목 NV67 · 본문 NV68 · [요청하기] [취소] → 서버 request_grade_access → 토스트 NV69 '요청을 받았어요. {날짜}까지 알려 드릴게요.' (이미 받은 요청이면 NV70, 같은 요청을 합칠 뿐 막지 않는다)
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { COMMON } from '@/content/copy';
import { GRADE16 } from '@/content/shopCopy';
import { formatDay } from '@/features/shop/shopLogic';
import type { ShopDeps } from '@/features/shop/shopTypes';
import { space } from '@/theme/tokens';

type Props = { visible: boolean; deps: Pick<ShopDeps, 'grade' | 'now'>; onClose: () => void; onToast: (text: string) => void };

export function AccessSheet({ visible, deps, onClose, onToast }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await deps.grade.requestAccess();
    if (!alive.current) return;
    setBusy(false);
    if (!result.ok) {
      setError(result.reason === 'network' ? COMMON.offline : COMMON.server);
      return;
    }
    const due = result.data.dueAt ?? deps.now() + 10 * 24 * 60 * 60 * 1000;
    onToast(result.data.merged ? GRADE16.accessMerged(formatDay(due)) : GRADE16.accessDone(formatDay(due)));
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} dismissable={!busy} testID="access-sheet">
      <View style={styles.body}>
        <AppText variant="title" accessibilityRole="header" testID="access-title">
          {GRADE16.accessTitle}
        </AppText>
        <AppText variant="body" tone="text" testID="access-body">
          {GRADE16.accessBody}
        </AppText>
        {error ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="access-error">
            {error}
          </AppText>
        ) : null}
        <Button label={GRADE16.accessButtons.send} loading={busy} onPress={send} testID="access-send" />
        <Button label={GRADE16.accessButtons.cancel} variant="secondary" disabled={busy} onPress={onClose} testID="access-cancel" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.s12, paddingVertical: space.s8 },
});
