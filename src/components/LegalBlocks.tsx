// 법무 문서(이용약관 · 개인정보 처리방침 · 동의 전문)를 그리는 조각들. 글은 그대로 두고 모양만 입힌다.
//  제목(장 · 조) · 문단 · 목록(• · 1.) · 표. 표는 폭 360 에서 넘치지 않게 줄마다 카드로 쌓아 '항목명: 값' 으로 보인다.
// 문서가 길어서(처리방침 200여 조각) FlatList 로 보여 줄 수 있게 조각 하나를 그리는 LegalBlockView 와 목록 LegalBlockList 를 따로 둔다.
import { memo, useMemo, type ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { visibleLegalBlocks, type FillValues } from '@/content/fillLegal';
import type { LegalBlock } from '@/content/types';
import { colors, radius, size, space } from '@/theme/tokens';

import { AppText } from './AppText';

const LIST_INDENT = space.s16;
const MARKER_WIDTH = space.s24;

function TableBlock({ block }: { block: Extract<LegalBlock, { type: 'table' }> }) {
  return (
    <View style={styles.table}>
      {block.rows.map((row, rowIndex) => {
        const first = row.findIndex((cell) => cell.length > 0);
        return (
          <View key={rowIndex} style={styles.tableRow}>
            {first >= 0 ? <AppText variant="bodyBold">{row[first]}</AppText> : null}
            {row.map((cell, i) =>
              i === first || cell.length === 0 ? null : (
                <AppText key={i} variant="body">
                  {block.header[i] ? `${block.header[i]}: ${cell}` : cell}
                </AppText>
              ),
            )}
          </View>
        );
      })}
    </View>
  );
}

export const LegalBlockView = memo(function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'h':
      return (
        <AppText variant={block.level === 2 ? 'title' : 'bodyBold'} accessibilityRole="header" style={block.level === 2 ? styles.h2 : block.level === 3 ? styles.h3 : styles.h4}>
          {block.text}
        </AppText>
      );
    case 'p':
      return <AppText style={styles.p}>{block.text}</AppText>;
    case 'li':
      return (
        <View style={[styles.li, { paddingLeft: block.depth * LIST_INDENT }]}>
          <AppText style={styles.marker}>{block.marker}</AppText>
          <AppText style={styles.liText}>{block.text}</AppText>
        </View>
      );
    case 'table':
      return <TableBlock block={block} />;
  }
});

type ListProps = {
  blocks: readonly LegalBlock[];
  header?: ReactElement | null;
  footer?: ReactElement | null;
  testID?: string;
  values?: FillValues; // 자리 글 값(없으면 content/fillIns.ts — 한 곳). 시험에서 값을 넣어 본다
};

// 읽는 화면: 위에 header(요약 등), 가운데 문서, 아래 footer. 화면에 보이는 만큼만 그린다.
// QP-04: 자리 글({대표자} 등)은 값이 있으면 넣고, 값이 빈 줄(표 행 · 문단 · 목록 줄)은 그리지 않는다(content/fillLegal.ts)
export function LegalBlockList({ blocks, header, footer, testID, values }: ListProps) {
  const shown = useMemo(() => visibleLegalBlocks(blocks, values), [blocks, values]);
  return (
    <FlatList
      testID={testID}
      data={shown}
      keyExtractor={(_, index) => String(index)}
      renderItem={({ item }) => <LegalBlockView block={item} />}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentContainerStyle={styles.content}
      initialNumToRender={20}
      windowSize={7}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s16, paddingBottom: space.s32 },
  h2: { marginTop: space.s24 },
  h3: { marginTop: space.s16 },
  h4: { marginTop: space.s16 },
  p: { marginTop: space.s8 },
  li: { flexDirection: 'row', marginTop: space.s4 },
  marker: { width: MARKER_WIDTH },
  liText: { flex: 1 },
  table: { marginTop: space.s12, gap: space.s8 },
  tableRow: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.s12, gap: space.s4 },
});
