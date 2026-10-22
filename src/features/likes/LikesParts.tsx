// 11 호감의 부품(Figma 11 3:410 · 14 38:275 · 11b 195:12). 색 · 글자 · 간격은 tokens 만, 누르는 것은 모두 공통 Pressable.
//  탭 칩 3개(보낸 호감 · 받은 호감 · 연결됨): 칩 28(선택 = bg + accent 선 + accent 글자, 나머지 = card 면 + text 글자), 누르는 면 높이 44
//  행: 위 줄 [사진 원 44][이름 줄 · 둘째 줄][⋯ 44] / 받은 호감만 아래 줄 [수락][거절](높이 44) + 만료 표시. 버튼과 ⋯ 이 겹치지 않는다(K2 11 ⋯ 행)
//  빈 상태 3종(카피.md 11): 받은 0(= 14, 제목 · 본문 · [오늘의 추천 보기]) · 보낸 0(한 줄) · 연결 0(제목 · 본문)
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Pressable } from '@/components/Pressable';
import { RECS } from '@/content/copy';
import { LIKES, type LikesTab } from '@/content/likesCopy';
import { PhotoBox } from '@/features/recs/PhotoBox';
import { MoreButton } from '@/features/safety/MoreButton';
import { buttonFace, shadowStyle } from '@/theme/buttonLook';
import { layout } from '@/theme/layout';
import { alpha, button, colors, radius, size, space } from '@/theme/tokens';
import { StateArt } from '@/components/StateArt';
import { H2_EMPTY_ART, UI_ICONS } from '@/theme/uiAssets';

export const TAB_ORDER: readonly LikesTab[] = ['sent', 'received', 'connected'];
const ROW_PHOTO = layout.rowPhoto; // Figma 11 행 사진 원 44 × 44

export function LikesTabs({ value, onChange }: { value: LikesTab; onChange: (tab: LikesTab) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs} testID="likes-tabs">
      {TAB_ORDER.map((tab) => {
        const on = tab === value;
        return <Chip key={tab} variant="tab" selected={on} label={LIKES.tabs[tab]} onPress={() => onChange(tab)} testID={`likes-tab-${tab}`} />; // 공용 Chip 'tab'(2단계 통합)
      })}
    </View>
  );
}

type RowButtonProps = { label: string; a11y: string; tone: 'accept' | 'decline'; busy: boolean; locked: boolean; dimmed: boolean; onPress: () => void; testID: string };

// 버튼 v3(D-141): 줄마다 있는 작은 버튼은 '한 화면 주 버튼 1' 규칙을 지키려고 채움을 쓰지 않는다.
//  [수락] = 작은 보조(아이보리 면 + line 1 선 + 아주 옅은 그림자 · text 글자, 눌리면 card 면 · 1px + 0.97) · [거절] = 작은 텍스트(accent 글자, 눌리면 accentSoft 상자)
//  높이 44 · 모서리 16. 요청 중이면 두 버튼 모두 다시 눌리지 않는다(R9)
export function RowButton({ label, a11y, tone, busy, locked, dimmed, onPress, testID }: RowButtonProps) {
  const accept = tone === 'accept';
  const moves = accept && !dimmed;
  return (
    <Pressable
      accessibilityLabel={a11y}
      aria-disabled={locked || dimmed}
      aria-busy={busy}
      disabled={locked}
      onPress={onPress}
      effect={moves ? 'scale' : 'none'}
      scaleTo="button"
      pressShift={moves ? button.pressY : 0}
      clip={false}
      testID={testID}
      style={({ pressed }) => [
        styles.rowButton,
        accept ? [styles.acceptButton, pressed ? styles.acceptDown : shadowStyle('secondary')] : pressed ? styles.declineDown : null,
        dimmed && styles.dim,
      ]}>
      {busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <AppText variant="captionMedium" tone={accept ? 'text' : 'accent'}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

type LikeRowProps = {
  id: string; // testID 뒤에 붙는 이름(예: received-0)
  head: string;
  sub: string;
  uri: string | null | undefined;
  hasPhoto: boolean;
  dim: boolean;
  first: boolean;
  note: string | null;
  onOpen: () => void;
  onMore: () => void;
  actions?: ReactNode; // 받은 호감의 아래 줄
};

export function LikeRowView({ id, head, sub, uri, hasPhoto, dim, first, note, onOpen, onMore, actions }: LikeRowProps) {
  return (
    <View style={[styles.row, !first && styles.rowLine]} testID={`like-row-${id}`}>
      <View style={styles.top}>
        <Pressable
          accessibilityLabel={`${LIKES.rowA11y(head)}, ${sub}`}
          onPress={onOpen}
          effect="none"
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
          testID={`like-open-${id}`}>
          <PhotoBox state={hasPhoto ? 'approved' : 'none'} uri={uri} label={RECS.photoA11y} style={[styles.photo, dim && styles.dim]} testID={`like-photo-${id}`} />
          <View style={[styles.info, dim && styles.dim]}>
            <AppText variant="bodyMedium" numberOfLines={1} testID={`like-head-${id}`}>
              {head}
            </AppText>
            <AppText variant="caption" numberOfLines={2} testID={`like-sub-${id}`}>
              {sub}
            </AppText>
          </View>
        </Pressable>
        <MoreButton onPress={onMore} testID={`like-more-${id}`} />
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
      {note ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.note} testID={`like-note-${id}`}>
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

export function ExpiredMark({ testID }: { testID: string }) {
  return <Chip label={LIKES.expired} variant="inactive" testID={testID} />;
}

export function LikesEmpty({ tab, onRecs }: { tab: LikesTab; onRecs: () => void }) {
  if (tab === 'sent') {
    return (
      <View style={styles.empty} testID="likes-empty-sent">
        <StateArt source={H2_EMPTY_ART.emptySentLikes} testID="likes-empty-sent-art" />
        <AppText variant="body" tone="sub" style={styles.centered}>
          {LIKES.emptySent}
        </AppText>
      </View>
    );
  }
  const received = tab === 'received';
  return (
    <View style={styles.empty} testID={`likes-empty-${tab}`}>
      {received ? (
        // 14 호감 없음 그림(디자인/아이콘/투명/21_빈상태_호감없음.png, Figma 88:30 칸 144 · 그림 140, 제목 위 24). 꾸밈 그림이라 스크린리더는 건너뛴다
        <View style={styles.artSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="likes-empty-art">
          <Image source={UI_ICONS.emptyLikes} style={styles.art} resizeMode="contain" />
        </View>
      ) : null}
      <AppText variant="title" accessibilityRole="header" style={styles.centered}>
        {received ? LIKES.emptyReceivedTitle : LIKES.emptyConnectedTitle}
      </AppText>
      <AppText variant="body" tone="sub" style={styles.centered}>
        {received ? LIKES.emptyReceivedBody : LIKES.emptyConnectedBody}
      </AppText>
      {received ? <Button label={LIKES.emptyReceivedButton} onPress={onRecs} testID="likes-empty-recs" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  artSlot: { alignSelf: 'center', width: layout.emptyArtSlot, height: layout.emptyArtSlot, alignItems: 'center', justifyContent: 'center', marginBottom: space.s24 - space.s12 },
  art: { width: layout.emptyArt, height: layout.emptyArt },
  row: { paddingHorizontal: space.s12, paddingVertical: space.s8, gap: space.s8 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  main: { flex: 1, minWidth: 0, minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  photo: { width: ROW_PHOTO, height: ROW_PHOTO, borderRadius: radius.pill },
  info: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.s8, paddingLeft: ROW_PHOTO + space.s12 },
  rowButton: { minHeight: size.touchMin, minWidth: size.touchMin, paddingHorizontal: space.s12, borderRadius: button.radius, alignItems: 'center', justifyContent: 'center' },
  acceptButton: { backgroundColor: buttonFace.secondary, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.s16 },
  acceptDown: { backgroundColor: buttonFace.secondaryPressed },
  declineDown: { backgroundColor: buttonFace.textPressed },
  note: { paddingLeft: ROW_PHOTO + space.s12 },
  pressed: { opacity: alpha.pressed },
  dim: { opacity: alpha.disabled },
  empty: { alignItems: 'stretch', justifyContent: 'center', gap: space.s12, paddingVertical: space.s40 },
  centered: { textAlign: 'center' },
});
