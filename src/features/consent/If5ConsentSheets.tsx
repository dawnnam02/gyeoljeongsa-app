// 사주 마당 동의 시트(IF5-F2 ⑪ · 법무 동의문구 4-18 CK17D · 4-19 CK19 · 4-20 CK20 · 화면 요구 IF-MADANG · IF-SJ-TALK · IF-SJ-PARTNER). 글은 content/if5ConsentContent.ts(gen-if2-assets 생성 — 법무 원문 그대로)뿐.
//  · 체크는 미리 켜 두지 않는다. 동의하기 전에는 마일리지도 쓰이지 않고 서버도 부르지 않는다(동의 → 결제 → 사용 순서). [동의하고 이어 가기] / [동의하지 않고 이어 가기] 같은 크기 · 권유 말 0
//  · CK17D 는 AI 맞춤 풀이를 처음 고를 때, CK19 는 사주 이야기를 처음 열 때(CK17D 가 먼저), CK20 은 상대 생일 입력칸을 열기 전 한 번. 거부하면 그 기능만 못 쓴다(미리 쓴 글 · 다른 기능은 그대로)
//  · 법무가 '보안 시험 통과 전에는 앱에 쓰지 않는다'고 한 줄(요약 '우리 쪽' · 전문의 서버 저장 0 문장)은 config/laterConsent IF5_KEEP_NOTE_ON 이 켜질 때만 보인다
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextButton } from '@/components/TextButton';
import { IF5_KEEP_NOTE_ON } from '@/config/laterConsent';
import { CK17 } from '@/content/ck17Content';
import { CK17D, CK19, CK20 } from '@/content/if5ConsentContent';
import { CheckRow } from '@/features/inflight/If2Sheets';
import { if2Styles, SheetHead } from '@/features/inflight/If2Parts';
import { A11Y } from '@/content/copy';
import { size, space } from '@/theme/tokens';

/** 법무가 시험 통과 전에는 쓰지 말라고 한 '운영 서버에 저장하지 않는다' 줄을 거른다(IF5_KEEP_NOTE_ON 이 꺼져 있을 때) */
export function visibleSummary(lines: readonly string[], keepOn: boolean = IF5_KEEP_NOTE_ON): string[] {
  return lines.filter((l) => keepOn || !l.startsWith('우리 쪽:'));
}
export function visibleFull(lines: readonly string[], keepOn: boolean = IF5_KEEP_NOTE_ON): string[] {
  return lines.map((l) => (keepOn ? l : l.replace(/\s*운영자는 [^.]*서버에 저장하지 않[^.]*\.$/, '')));
}

function MoreBlock({ summary, fullTitle, full, testID }: { summary: readonly string[]; fullTitle: string; full: readonly string[]; testID: string }) {
  const [more, setMore] = useState<'none' | 'summary' | 'full'>('none');
  return (
    <>
      <TextButton label={more === 'full' ? CK17.fullOpen : CK17.summaryOpen} align="start" onPress={() => setMore(more === 'none' ? 'summary' : 'full')} testID={`${testID}-more`} />
      {more !== 'none' ? (
        <View style={if2Styles.gapSmall} testID={`${testID}-summary`}>
          {visibleSummary(summary).map((l) => (
            <AppText key={l} variant="caption" tone="text">
              {l}
            </AppText>
          ))}
          {more === 'summary' ? <TextButton label={CK17.fullOpen} align="start" onPress={() => setMore('full')} testID={`${testID}-full-open`} /> : null}
        </View>
      ) : null}
      {more === 'full' ? (
        <View style={if2Styles.gapSmall} testID={`${testID}-full`}>
          <AppText variant="bodyBold">{fullTitle}</AppText>
          {visibleFull(full).map((l) => (
            <AppText key={l} variant="caption" tone="text">
              {l}
            </AppText>
          ))}
        </View>
      ) : null}
    </>
  );
}

type SheetProps = { visible: boolean; onClose: () => void; testID?: string };

// ── CK17D AI 풀이 받기(사주 글자 국외 이전) ───────────────────────────────────────
export function Ck17dSheet(p: SheetProps & { onYes: () => void | Promise<void>; onNo: () => void }) {
  const testID = p.testID ?? 'if5-ck17d';
  return (
    <BottomSheet visible={p.visible} onClose={p.onClose} testID={testID}>
      {p.visible ? <Ck17dBody {...p} testID={testID} /> : null}
    </BottomSheet>
  );
}
function Ck17dBody({ onYes, onNo, onClose, testID = 'if5-ck17d' }: SheetProps & { onYes: () => void | Promise<void>; onNo: () => void }) {
  const [on, setOn] = useState(false); // 미리 체크 0
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SheetHead title={CK17D.title} closeLabel={A11Y.close} onClose={onClose} testID={testID} />
      <ScrollView style={styles.scroll} contentContainerStyle={if2Styles.gap}>
        <AppText variant="body" testID={`${testID}-lead`}>
          {CK17D.lead}
        </AppText>
        <CheckRow on={on} label={CK17D.check} why={CK17D.why} note={CK17D.note} onPress={() => setOn(!on)} testID={`${testID}-check`} />
        <MoreBlock summary={CK17D.summary} fullTitle={CK17D.fullTitle} full={CK17D.full} testID={testID} />
        {declined ? (
          <AppText variant="body" accessibilityRole="alert" testID={`${testID}-declined`}>
            {CK17D.declined}
          </AppText>
        ) : null}
        <View style={styles.buttons}>
          <View style={styles.flex}>
            <Button
              label={CK17D.no}
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setDeclined(true);
                onNo();
              }}
              testID={`${testID}-no`}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label={CK17D.yes}
              disabled={!on}
              loading={busy}
              onPress={() => {
                if (busy) return;
                setBusy(true);
                void Promise.resolve(onYes()).finally(() => setBusy(false));
              }}
              testID={`${testID}-yes`}
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

// ── CK19 사주 이야기 나누기(자유 입력 국외 이전 · 건강 · 성생활은 따로) ─────────────────
export function Ck19Sheet(p: SheetProps & { onYes: (health: boolean) => void | Promise<void>; onNo: () => void }) {
  const testID = p.testID ?? 'if5-ck19';
  return (
    <BottomSheet visible={p.visible} onClose={p.onClose} testID={testID}>
      {p.visible ? <Ck19Body {...p} testID={testID} /> : null}
    </BottomSheet>
  );
}
function Ck19Body({ onYes, onNo, onClose, testID = 'if5-ck19' }: SheetProps & { onYes: (health: boolean) => void | Promise<void>; onNo: () => void }) {
  const [a, setA] = useState(false); // 미리 체크 0
  const [b, setB] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SheetHead title={CK19.title} closeLabel={A11Y.close} onClose={onClose} testID={testID} />
      <ScrollView style={styles.scroll} contentContainerStyle={if2Styles.gap}>
        <AppText variant="body" testID={`${testID}-lead`}>
          {CK19.lead}
        </AppText>
        <CheckRow
          on={a}
          label={CK19.checkA}
          why={CK19.whyA}
          onPress={() => {
            if (a) setB(false); // ①을 풀면 ②도 풀림
            setA(!a);
          }}
          testID={`${testID}-a`}
        />
        <CheckRow on={b} label={CK19.checkB} why={CK19.whyB} note={CK19.noteB} disabled={!a} onPress={() => setB(!b)} testID={`${testID}-b`} />
        <MoreBlock summary={CK19.summary} fullTitle={CK19.fullTitle} full={CK19.full} testID={testID} />
        {declined ? (
          <AppText variant="body" accessibilityRole="alert" testID={`${testID}-declined`}>
            {CK19.declined}
          </AppText>
        ) : null}
        <View style={styles.buttons}>
          <View style={styles.flex}>
            <Button
              label={CK19.no}
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setDeclined(true);
                onNo();
              }}
              testID={`${testID}-no`}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label={CK19.yes}
              disabled={!a}
              loading={busy}
              onPress={() => {
                if (busy) return;
                setBusy(true);
                void Promise.resolve(onYes(a && b)).finally(() => setBusy(false));
              }}
              testID={`${testID}-yes`}
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

// ── CK20 다른 분의 정보를 넣을 때 지킬 점(확인형) — 상대 생일 시트 안에서 입력칸을 열기 전에 ─────────
export function Ck20Block({ checked, onToggle, testID = 'if5-ck20' }: { checked: boolean; onToggle: () => void; testID?: string }) {
  return (
    <View style={if2Styles.gap} testID={testID}>
      <CheckRow on={checked} label={CK20.check} why={CK20.why} note={CK20.note} onPress={onToggle} testID={`${testID}-check`} />
      <MoreBlock summary={CK20.summary} fullTitle={CK20.fullTitle} full={CK20.full} testID={testID} />
      {!checked ? (
        <AppText variant="caption" testID={`${testID}-not`}>
          {CK20.notChecked}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: size.touchMin * 12 },
  buttons: { flexDirection: 'row', gap: space.s8 },
  flex: { flex: 1 },
});
