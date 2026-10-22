// 16-M 1회 매칭 사용 확인 시트(수익/상점_화면.md 7-8, Figma 315:97 · 318:485 · 318:611). 남은 명분이 있을 때 [지금 받기] → "지금 {k}명을 받을까요?"(NV61) → [받기] → 서버 use_match_once.
//  · k 는 서버가 알려 준 값만으로 정한다: 남은 명분 · 오늘 나올 수 있는 인원 · 3 중 가장 작은 수(앱이 후보를 고르지 않는다)
//  · 받음: 09 의 '추가로 받은 추천' 구역으로 가고 토스트 NV62. 실제로 나온 수가 k 보다 적으면(못 채움) 시트에서 NV62 + NV50b 를 보여 준 뒤 09 로 간다. 차감은 서버가 한 수만큼만 한다
//  · 같은 버튼을 두 번 눌러도 요청 ID 가 같아 서버가 한 번만 처리한다. 하루 2번을 다 썼거나 명분이 없으면 오류 글(NV59 · NV21)
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { COMMON } from '@/content/copy';
import { SHOP16 } from '@/content/shopCopy';
import type { MatchOnceStatus, UseMatchFailure } from '@/lib/shopApi';
import { space } from '@/theme/tokens';

import type { ShopDeps } from './shopTypes';

export const matchCount = (m: MatchOnceStatus): number => Math.max(0, Math.min(3, m.slotsLeft, m.availableToday));

type Props = {
  visible: boolean;
  status: MatchOnceStatus;
  deps: ShopDeps;
  onClose: () => void;
  onReload: () => Promise<unknown>;
  onGo: (added: number) => void; // 09 로 이동(토스트는 부르는 쪽이 남긴다)
};

export function MatchOnceSheet({ visible, status, deps, onClose, onReload, onGo }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<{ added: number; left: number } | null>(null);
  const requestId = useRef<string | null>(null);
  const alive = useRef(true);
  // 받는 동안 · 받은 뒤 목록을 다시 읽어 status 가 바뀌어도 시트의 k 는 [받기]를 누른 값으로 둔다(Q5A-11: '지금 0명을 받을까요?'가 번쩍이지 않게)
  const [frozenK, setFrozenK] = useState<number | null>(null); // 시트는 열 때마다 새로 세워져(key) 닫으면 자연히 비워진다
  const k = frozenK ?? matchCount(status);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const take = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFrozenK(k);
    if (requestId.current === null) requestId.current = deps.newId();
    const result = await deps.api.useMatchOnce(requestId.current);
    if (!alive.current) return;
    setBusy(false);
    if (!result.ok) {
      const text: Record<UseMatchFailure, string> = {
        network: COMMON.offline,
        server: COMMON.server,
        daily_max: SHOP16.matchDailyMax,
        no_slot: SHOP16.matchNone,
        unavailable: SHOP16.matchNone,
      };
      setFrozenK(null);
      setError(text[result.reason]);
      return;
    }
    await onReload();
    if (!alive.current) return;
    if (result.data.added < k) {
      setPartial({ added: result.data.added, left: result.data.slotsLeft });
      return;
    }
    onGo(result.data.added);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} dismissable={!busy} testID="match-sheet">
      {partial ? (
        <View style={styles.body} testID="match-partial">
          <AppText variant="bodyBold" testID="match-partial-done">
            {SHOP16.matchDone(partial.added)}
          </AppText>
          <AppText variant="body" tone="text" testID="match-partial-note">
            {SHOP16.matchPartial(partial.added, partial.left)}
          </AppText>
          <Button label={SHOP16.ok} onPress={() => onGo(partial.added)} testID="match-partial-ok" />
        </View>
      ) : (
        <View style={styles.body}>
          <AppText variant="title" accessibilityRole="header" testID="match-confirm-text">
            {SHOP16.matchConfirm(k)}
          </AppText>
          {error ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="match-error">
              {error}
            </AppText>
          ) : null}
          <Button label={SHOP16.matchConfirmButtons.take} loading={busy} disabled={k <= 0} onPress={take} testID="match-take" />
          <Button label={SHOP16.matchConfirmButtons.cancel} variant="secondary" disabled={busy} onPress={onClose} testID="match-cancel" />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.s12, paddingVertical: space.s8 },
});
