// 12 › 보안(Figma 12d 197:166) · 고객센터(12c 197:81) · 안전 안내(12f 201:177) · 이미지 출처 고지(12q 231:154).
//  보안: 스위치 1개 "상대 화면 캡처 차단", 처음값 꺼짐(D-23 BD-4). 확인창 없이 바로 바뀐다. 켜면 09 · 10 · 11 이 열려 있는 동안만 캡처 · 녹화가 막힌다(lib/captureBlock.ts)
//        끄면 아무 안내도 없다. 값은 이 기기 메모리에만 있다(계정 · 기기 저장은 U24 미정)
//  사업자 정보(QP-A, 카피.md 12-Q): 줄 6개(상호 · 대표자 · 신고번호 · 사업자등록번호 · 사무소 주소 · 전화번호). 값이 모두 있을 때만 이 쪽으로 들어오는 줄이 보인다
//  고객센터: 문의 이메일 · 운영 시간(N27, 값은 D-28 — 정해지기 전에는 원본 글의 {…} 자리 그대로, [복사] · [메일 앱 열기] 꺼짐) + 아동 안전 문의(N35)
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CHILD_SAFETY, SAFETY_GUIDE, SUPPORT } from '@/content/copy';
import type { BusinessRow } from '@/content/businessInfo';
import { BUSINESS, IMAGE_CREDIT, SECURITY, SUPPORT_ACTIONS } from '@/content/settingsCopy';
import { SUPPORT_CONTACT, type SupportContact } from '@/content/supportContact';
import { useSecurityStore } from '@/store/securityStore';
import { colors, space } from '@/theme/tokens';

import { fillContact } from './settingsLogic';
import { RowGroup, SubPage, SwitchRow } from './SettingsParts';

export function SecurityPage({ onBack }: { onBack: () => void }) {
  const on = useSecurityStore((s) => s.captureBlock);
  const setOn = useSecurityStore((s) => s.setCaptureBlock);
  return (
    <SubPage title={SECURITY.headerTitle} onBack={onBack} testID="settings-security">
      <RowGroup>
        <SwitchRow label={SECURITY.captureBlock} on={on} last onPress={() => setOn(!on)} testID="settings-capture-block" />
      </RowGroup>
      <AppText variant="caption" style={styles.pad} testID="settings-capture-note">
        {SECURITY.captureBlockNote}
      </AppText>
    </SubPage>
  );
}

export type SupportDeps = { copyText: (text: string) => Promise<boolean>; openMail: (email: string) => Promise<void> };

export function SupportPage({ deps, contact = SUPPORT_CONTACT, onBack, onToast }: { deps: SupportDeps; contact?: SupportContact; onBack: () => void; onToast: (text: string) => void }) {
  const email = contact.email;
  const copy = async () => {
    if (!email) return;
    if (await deps.copyText(email)) onToast(SUPPORT_ACTIONS.copied);
  };
  return (
    <SubPage title={SUPPORT.rowName} onBack={onBack} testID="settings-support">
      <Card style={styles.card} testID="settings-support-card">
        <AppText variant="body" testID="settings-support-email">
          {fillContact(SUPPORT.emailLabel, contact)}
        </AppText>
        <View style={styles.line} />
        <AppText variant="body" testID="settings-support-hours">
          {fillContact(SUPPORT.hoursLabel, contact)}
        </AppText>
      </Card>
      <View style={styles.buttons}>
        <View style={styles.half}>
          <Button label={SUPPORT_ACTIONS.copy} variant="secondary" disabled={!email} onPress={() => void copy()} testID="settings-support-copy" />
        </View>
        <View style={styles.half}>
          <Button label={SUPPORT_ACTIONS.openMail} disabled={!email} onPress={() => email && void deps.openMail(email)} testID="settings-support-mail" />
        </View>
      </View>
      <Card style={styles.card} testID="settings-child-safety">
        <AppText variant="bodyBold" accessibilityRole="header">
          {CHILD_SAFETY.row}
        </AppText>
        <AppText variant="body">{CHILD_SAFETY.body}</AppText>
        <AppText variant="bodyBold" testID="settings-child-contact">
          {fillContact(CHILD_SAFETY.contact, contact)}
        </AppText>
        <AppText variant="caption" tone="text">
          {CHILD_SAFETY.policy}
        </AppText>
      </Card>
    </SubPage>
  );
}

export function SafetyGuidePage({ onBack }: { onBack: () => void }) {
  const lines = [...SAFETY_GUIDE.lines, SAFETY_GUIDE.minorNote];
  return (
    <SubPage title={SAFETY_GUIDE.rowName} onBack={onBack} testID="settings-safety">
      <AppText variant="title" accessibilityRole="header" testID="settings-safety-title">
        {SAFETY_GUIDE.title}
      </AppText>
      <RowGroup testID="settings-safety-lines">
        {lines.map((line, i) => (
          <View key={line} style={[styles.guideLine, i < lines.length - 1 && styles.divider]}>
            <AppText variant="body" testID={`settings-safety-line-${i}`}>
              {line}
            </AppText>
          </View>
        ))}
      </RowGroup>
    </SubPage>
  );
}

export function ImageCreditPage({ onBack }: { onBack: () => void }) {
  return (
    <SubPage title={IMAGE_CREDIT.headerTitle} onBack={onBack} testID="settings-image-credit">
      <Card>
        <AppText variant="body" testID="settings-image-credit-body">
          {IMAGE_CREDIT.body}
        </AppText>
      </Card>
    </SubPage>
  );
}

export function BusinessInfoPage({ rows, onBack }: { rows: readonly BusinessRow[]; onBack: () => void }) {
  return (
    <SubPage title={BUSINESS.headerTitle} onBack={onBack} testID="settings-business">
      <RowGroup testID="settings-business-rows">
        {rows.map((row, i) => (
          <View key={row.key} style={[styles.guideLine, i < rows.length - 1 && styles.divider]} testID={`settings-business-${row.key}`}>
            <AppText variant="caption" tone="sub">
              {row.label}
            </AppText>
            <AppText variant="body">{row.value}</AppText>
          </View>
        ))}
      </RowGroup>
    </SubPage>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.s4 },
  card: { gap: space.s8 },
  line: { height: 1, backgroundColor: colors.line, marginVertical: space.s4 },
  buttons: { flexDirection: 'row', gap: space.s12 },
  half: { flex: 1 },
  guideLine: { paddingHorizontal: space.s16, paddingVertical: space.s16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
});
