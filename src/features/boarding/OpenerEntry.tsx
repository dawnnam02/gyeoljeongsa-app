// T3 공개 순간 '첫마디 길' 입구(QF2 Q2-02 · 디자인 1-1): [대화 시작하기] 위 글자 단추 한 줄 → 이야깃거리 시트(읽기 + 칸을 누르면 대화방 입력창에 넣어 둠).
//  · 방이 열려 있고 이야깃거리가 있을 때만 보인다(방 없음 · 닫힘 · 스위치 opener_chips 꺼짐 · 불러오지 못함 · 비어 있음이면 입구 0 — 눌리지 않는 단추를 두지 않는다)
//  · 길만 준다: 칸을 눌러도 바로 보내지 않고 입력창만 채운다. 호감 표시 · 저장 · 상대 알림 · 고른 칸 기록 0
//  · 재료는 대화방 칩과 같은 서버 `opener_chips(방)`(같은 취미 · 두 분이 공개한 같은 값 · 없으면 가벼운 질문). 상대 정보는 칩 문장에 안 들어간다
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { COMMON } from '@/content/copy';
import { OPENER_PATH } from '@/content/qf2Copy';
import { chipText } from '@/features/inflight/if2Library';
import { tx } from '@/features/inflight/if2Text';
import { if2Styles, SheetHead } from '@/features/inflight/If2Parts';
import type { InflightApi } from '@/features/inflight/inflightApi';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

export type OpenerEntryDeps = { api: Pick<InflightApi, 'openerChips'>; isOn: (key: string) => boolean };
type State = { kind: 'loading' } | { kind: 'ok'; texts: string[] } | { kind: 'failed'; texts: string[] };

export function OpenerEntry({ roomId, deps, onPick, testID = 'reveal-opener' }: { roomId: string; deps: OpenerEntryDeps; onPick: (text: string) => void; testID?: string }) {
  const on = deps.isOn('opener_chips');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    void deps.api.openerChips(roomId).then((r) => {
      if (!r.ok) setState((cur) => ({ kind: 'failed', texts: cur.kind === 'loading' ? [] : cur.texts }));
      else setState({ kind: 'ok', texts: r.data.show ? [...new Set(r.data.chips.map((c) => chipText(c.id, c.hobby)).filter((t): t is string => !!t))].slice(0, 3) : [] });
    });
  }, [deps.api, roomId]);
  useEffect(() => {
    if (on) load();
  }, [on, load]);
  // 처음 불러오기가 실패했거나 비었으면 입구를 그리지 않는다. 한 번 보인 입구는 다시 읽다 실패해도 시트 안에서 안내한다
  const shown = on && (state.kind === 'ok' ? state.texts.length > 0 : state.kind === 'failed' && state.texts.length > 0);
  if (!shown) return null;
  const texts = state.kind === 'loading' ? [] : state.texts;
  return (
    <>
      <TextButton label={OPENER_PATH.entry} icon="chat" accessibilityLabel={tx('TOPICS.entryA11y')} onPress={() => (setOpen(true), load())} testID={`${testID}-entry`} />
      <BottomSheet visible={open} onClose={() => setOpen(false)} testID={`${testID}-sheet`}>
        {open ? (
          <>
            <SheetHead title={tx('TOPICS.title')} closeLabel={tx('TOPICS.close')} onClose={() => setOpen(false)} testID={`${testID}-sheet`} />
            <AppText variant="caption" testID={`${testID}-carry`}>
              {OPENER_PATH.carry}
            </AppText>
            {state.kind === 'failed' ? (
              <View style={if2Styles.gapSmall} testID={`${testID}-failed`}>
                <AppText variant="body" tone="sub" accessibilityRole="alert">
                  {tx('TOPICS.loadFailed')}
                </AppText>
                <TextButton label={COMMON.retry} onPress={load} testID={`${testID}-retry`} />
              </View>
            ) : null}
            <ScrollView style={styles.scroll} contentContainerStyle={if2Styles.gap}>
              {texts.map((t, i) => (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={tx('FIRST_HINT.chipA11y', { 질문: t })}
                  onPress={() => {
                    setOpen(false);
                    onPick(t);
                  }}
                  effect="none"
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  testID={`${testID}-pick-${i}`}>
                  <AppText variant="body">{t}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 360 },
  row: { minHeight: size.touchMin, justifyContent: 'center', backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.s16, paddingVertical: space.s12 },
  pressed: { opacity: alpha.pressed },
});
