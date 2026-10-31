// IF-PREVIEW 짝에게 보이는 내 모습(F-56 · 정책 PF-34 · 카피 21-6) — 서버 미리보기 함수(preview_my_profile · 짝이 get_candidate_profile 로 받는 값 그대로)가 준 값을
//  10 상대 상세와 같은 부품 · 같은 읽기 함수(features/recs parseCandidate · recsLogic · PromptCards · MarriageViews · PhotoBox)로 그린다(앱 공개 범위 필터 0 · 흉내 0 — IFF-13)
//  · 보기 전용 · 신고 · 차단 · '나도' 칩 · 등급 아이콘 · 저장 0 · [공개 범위 바꾸기] → 08
//  · CK17B 를 켠 분에게만 ck17Note · '같은 취미'를 켠 분에게만 hobbyNote
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GlanceRow } from '@/components/Badges';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CANDIDATE, SAFETY } from '@/content/copy';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { aitEnabled } from '@/features/ait/aitEnabled';
import { ait } from '@/features/ait/aitText';
import { CoachSheet } from '@/features/ait/CoachSheet';
import { openSettingsPage } from '@/features/settings/settingsIntent';
import { MarriageViews } from '@/features/recs/MarriageViews';
import { PhotoBox } from '@/features/recs/PhotoBox';
import { PromptCards } from '@/features/recs/PromptCards';
import { detailInfoLine, galleryPhotos, headLineDetail, heightText, openItems, plain, REASON_NAMES, regionText, tableRows } from '@/features/recs/recsLogic';
import { parseCandidate, type CandidateData } from '@/lib/recsApi';
import { colors, radius, size, space } from '@/theme/tokens';

import type { InflightApi } from './inflightApi';
import { inflightServices } from './inflightService';
import { if2Styles } from './If2Parts';
import { tx } from './if2Text';

export function PreviewScreen({ api: given }: { api?: Pick<InflightApi, 'preview'> }) {
  const router = useRouter();
  const api = given ?? inflightServices().api;
  const [coach, setCoach] = useState(false); // AIT-F: 문장 다듬기 시트(데모 판에서만 입구)
  const [data, setData] = useState<{ profile: CandidateData; ck17b: boolean; sameHobby: boolean } | 'loading' | 'failed'>('loading');
  const fetchPreview = useCallback(() => {
    void api.preview().then((r) => {
      const p = r.ok ? parseCandidate(r.data.profile) : null;
      setData(r.ok && p ? { profile: p, ck17b: r.data.ck17b, sameHobby: r.data.sameHobby } : 'failed');
    });
  }, [api]);
  useEffect(fetchPreview, [fetchPreview]);
  const load = () => {
    setData('loading');
    fetchPreview();
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));
  return (
    <Screen edges={['top']} testID="screen-preview">
      <ScreenHeader title={tx('PREVIEW_ME.title')} onBack={back} testID="preview-header" />
      <ScrollView contentContainerStyle={styles.body} accessibilityLabel={tx('PREVIEW_ME.a11y')}>
        <View style={styles.banner} testID="preview-banner">
          <AppText variant="small">{tx('PREVIEW_ME.banner')}</AppText>
          <AppText variant="caption">{tx('PREVIEW_ME.hiddenNote')}</AppText>
        </View>
        {data === 'failed' ? (
          <View style={if2Styles.gapSmall} testID="preview-failed">
            <AppText variant="body" tone="sub" accessibilityRole="alert">
              {tx('PREVIEW_ME.loadFailed')}
            </AppText>
            <Button label={BOARDING.retry} variant="secondary" onPress={load} testID="preview-retry" />
          </View>
        ) : null}
        {typeof data === 'object' ? <ProfileView data={data.profile} /> : null}
        {typeof data === 'object' && data.ck17b ? (
          <AppText variant="caption" testID="preview-ck17">
            {tx('PREVIEW_ME.ck17Note')}
          </AppText>
        ) : null}
        {typeof data === 'object' && data.sameHobby ? (
          <AppText variant="caption" testID="preview-hobby">
            {tx('PREVIEW_ME.hobbyNote')}
          </AppText>
        ) : null}
        <Button label={tx('PREVIEW_ME.edit')} onPress={() => router.push('/profile' as Href)} testID="preview-edit" />
        {aitEnabled() ? <Button label={ait('COACH.name')} variant="secondary" onPress={() => setCoach(true)} testID="preview-coach" /> : null}
        {aitEnabled() ? <CoachSheet visible={coach} onClose={() => setCoach(false)} onSettings={() => (setCoach(false), openSettingsPage(router, 'ait-code'))} /> : null}
      </ScrollView>
    </Screen>
  );
}

// 10 상대 상세의 보기 부분과 같은 부품 · 같은 차례(사진 칸 · 머리 · 한눈에 · 질문 카드 · 결혼관 · 표 · 공개 항목 · 안내 두 줄). 누르는 단추 0
function ProfileView({ data }: { data: CandidateData }) {
  const rows = tableRows(data.answers);
  const open = openItems(data.answers);
  const photos = galleryPhotos(data.photos);
  return (
    <View style={if2Styles.gap} testID="preview-profile">
      <View style={styles.photos}>
        {photos.slice(0, 1).map((p) => (
          <PhotoBox key={p.slot} state={p.state} uri={null} style={styles.photo} testID="preview-photo" />
        ))}
      </View>
      <AppText variant="title" testID="preview-head">
        {headLineDetail(data.answers)}
      </AppText>
      {detailInfoLine(data.answers) ? (
        <AppText variant="body" tone="sub">
          {detailInfoLine(data.answers)}
        </AppText>
      ) : null}
      <GlanceRow
        cells={[
          { label: REASON_NAMES.F01, value: plain(data.answers.A01) },
          { label: REASON_NAMES.F02, value: heightText(data.answers.A05) },
          { label: REASON_NAMES.F06, value: regionText(data.answers.A03) },
          { label: REASON_NAMES.E01, value: plain(data.answers.E01) },
        ]}
        testID="preview-glance"
      />
      <PromptCards prompts={data.prompts} noteHidden />
      <MarriageViews answers={data.answers} testID="preview-marriage" />
      <Card style={styles.table} testID="preview-table">
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.row, i > 0 ? styles.rowLine : null]}>
            <AppText variant="body">{r.label}</AppText>
            <AppText variant="body" tone={r.value === CANDIDATE.hidden ? 'sub' : 'text'} style={styles.rowValue}>
              {r.value}
            </AppText>
          </View>
        ))}
      </Card>
      {open.length > 0 ? (
        <Card style={styles.table}>
          <AppText variant="bodyBold">{CANDIDATE.openTitle}</AppText>
          {open.map((r) => (
            <View key={r.id} style={[styles.row, styles.rowLine]}>
              <AppText variant="body">{r.label}</AppText>
              <AppText variant="body" style={styles.rowValue}>
                {r.value}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}
      <AppText variant="caption">{CANDIDATE.disclaimer}</AppText>
      <AppText variant="caption">{SAFETY.line}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, gap: space.s16 },
  banner: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.s16, gap: space.s4 },
  photos: { flexDirection: 'row' },
  photo: { width: '100%', aspectRatio: 4 / 5 },
  table: { gap: space.s4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12, paddingVertical: space.s8 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  rowValue: { flexShrink: 1, textAlign: 'right' },
});
