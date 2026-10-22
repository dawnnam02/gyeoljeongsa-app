// 12 › 정보 › 오픈소스 라이선스(Figma 12p 231:120, N29 · 법무 5-6 · 생성물_이용조건 5-4).
//  맨 위 안내 한 줄 → 줄 3개(Lucide · ISC · MIT / Pretendard · OFL / npm 패키지 · MIT). 줄을 누르면 전문(영어 원문 그대로)을 시트로 연다.
//  글은 licenses.json(생성물, npm run gen:licenses): Lucide 는 assets/licenses/lucide-LICENSE.txt(법무가 정한 원본 주소의 복사), Pretendard 는 assets/fonts/Pretendard-LICENSE.txt,
//  npm 은 package.json 의 직접 의존 패키지 LICENSE 파일. 의존 트리 전체는 스토어 빌드 전에 `npm run gen:licenses -- --all`(U22, R2). JSON 으로 둔 까닭: 원문에 http 주소가 있어 앱 코드 규칙(F-01 https 만)을 피하지 않고 그대로 싣기 위해서다
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { FullSheet } from '@/components/FullSheet';
import { LICENSES } from '@/content/settingsCopy';
import { colors, space } from '@/theme/tokens';

import licenseData from './licenses.json';
import { NavRow, RowGroup, SubPage } from './SettingsParts';

type Pkg = { name: string; version: string; license: string; textId: string | null };
type Doc = { title: string; blocks: { head?: string; text: string }[] };

const PACKAGES = licenseData.packages as Pkg[];
const TEXTS = licenseData.texts as Readonly<Record<string, string>>; // 같은 전문은 한 번만(scripts/gen-licenses.mjs)
const npmLicenses = [...new Set(PACKAGES.map((p) => p.license))].join(' · ');

const DOCS: readonly { key: string; label: string; doc: Doc }[] = [
  { key: 'lucide', label: LICENSES.item(licenseData.lucide.name, licenseData.lucide.license), doc: { title: licenseData.lucide.name, blocks: [{ text: licenseData.lucide.text }] } },
  { key: 'pretendard', label: LICENSES.item(licenseData.pretendard.name, licenseData.pretendard.license), doc: { title: licenseData.pretendard.name, blocks: [{ text: licenseData.pretendard.text }] } },
  {
    key: 'npm',
    label: LICENSES.item(LICENSES.npmGroup, npmLicenses),
    doc: { title: LICENSES.npmGroup, blocks: PACKAGES.map((p) => ({ head: `${p.name} ${p.version} · ${p.license}`, text: (p.textId ? TEXTS[p.textId] : null) ?? p.license })) },
  },
];

export const LICENSE_ROWS = DOCS.map((d) => d.label);

export function LicensesPage({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<Doc | null>(null);
  return (
    <SubPage title={LICENSES.headerTitle} onBack={onBack} testID="settings-licenses">
      <AppText variant="body" testID="settings-licenses-intro">
        {LICENSES.intro}
      </AppText>
      <RowGroup testID="settings-licenses-list">
        {DOCS.map((d, i) => (
          <NavRow key={d.key} label={d.label} last={i === DOCS.length - 1} onPress={() => setOpen(d.doc)} testID={`settings-license-${d.key}`} />
        ))}
      </RowGroup>
      <FullSheet visible={open !== null} title={open?.title ?? ''} onClose={() => setOpen(null)} testID="settings-license-sheet">
        <ScrollView contentContainerStyle={styles.body}>
          {open?.blocks.map((b, i) => (
            <View key={`${b.head ?? ''}${i}`} style={styles.block}>
              {b.head ? <AppText variant="bodyBold">{b.head}</AppText> : null}
              <AppText variant="caption" tone="text" selectable>
                {b.text}
              </AppText>
            </View>
          ))}
        </ScrollView>
      </FullSheet>
    </SubPage>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.s20, gap: space.s24 },
  block: { gap: space.s8, paddingBottom: space.s16, borderBottomWidth: 1, borderBottomColor: colors.line },
});
