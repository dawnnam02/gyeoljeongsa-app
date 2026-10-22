// 10 상대 상세 '결혼관' 칸(F24 후속 · D-142 · v4 R2 H04 · 카피.md 9장 S01 결혼관 공개 6개 · NFH04-06).
//  · 상대가 공개 스위치를 켠 칸만 그린다 — 서버는 켠 항목만 상대 answers 에 E01 · E02 · E03 · E05 · E06 · E07 로 준다(S16-u, 처음 꺼짐). 끈 칸은 키가 없으니 그리지 않는다
//  · 줄 = 칸 이름(survey.E0x.publicLabel) + 완성 글(survey.E0x.publicText.{값}, 설문 v2 questionCopy 그대로). 순서는 문항 순서. E04(집안일)는 공개 문항이 아니다
//  · 숫자 · 점수 · 등급 · 비교 말 0: 맞벌이(E03) · 양가 부모님(E05)의 1~5 값도 말로만(publicText). 읽을 수 없는 값은 그 줄을 빼고, 줄이 하나도 없으면 칸 전체를 그리지 않는다
//  · 값은 서버 코드(y2 · yes …) · 데모의 보기 이름('1년~2년') · 1~5 숫자 모두 받는다
//  · 놓는 곳(F21 이 넣음): features/recs/CandidateScreen 의 사진 · 한눈에 줄(candidate-glance) 다음, 질문 카드 칸(PromptCards) 바로 뒤 — <MarriageViews answers={data.answers} />
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';
import { space } from '@/theme/tokens';

// 글(카피.md 9장 '결혼관 공개 6개 · 10 결혼관 구역 이름 / 줄 이름 6' — C① 제안 글 그대로)
export const MARRIAGE_VIEW = {
  title: '결혼관', // survey.section.marriage.publicTitle = marriage_card.section
  labels: {
    E01: '결혼 시기', // survey.E01.publicLabel
    E02: '자녀', // survey.E02.publicLabel
    E03: '맞벌이', // survey.E03.publicLabel
    E05: '양가 부모님', // survey.E05.publicLabel
    E06: '사는 곳', // survey.E06.publicLabel
    E07: '돈 관리', // survey.E07.publicLabel
  },
} as const;

export const MARRIAGE_IDS = ['E01', 'E02', 'E03', 'E05', 'E06', 'E07'] as const;
export type MarriageId = (typeof MARRIAGE_IDS)[number];
export type MarriageRow = { id: MarriageId; label: string; text: string };

// 값 → 완성 글. 코드면 그대로, 1~5 면 숫자 글자, 보기 이름이면 그 코드로 찾는다. 모르면 null(줄을 그리지 않는다)
export function marriageText(id: MarriageId, value: unknown): string | null {
  const copy = QUESTION_COPY[id];
  const texts = copy?.publicText;
  if (!texts || value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isInteger(value) ? (texts[String(value)] ?? null) : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const v = value.trim();
  if (texts[v]) return texts[v];
  const code = Object.entries(copy.opt ?? {}).find(([, label]) => label === v)?.[0];
  if (code && texts[code]) return texts[code];
  return Object.values(texts).includes(v) ? v : null;
}

export function marriageRows(answers: Readonly<Record<string, unknown>>): MarriageRow[] {
  const rows: MarriageRow[] = [];
  for (const id of MARRIAGE_IDS) {
    const text = marriageText(id, answers[id]);
    if (text) rows.push({ id, label: MARRIAGE_VIEW.labels[id], text });
  }
  return rows;
}

export function MarriageViews({ answers, testID = 'candidate-marriage' }: { answers: Readonly<Record<string, unknown>>; testID?: string }) {
  const rows = marriageRows(answers);
  if (rows.length === 0) return null;
  return (
    <Card variant="paper" style={styles.card} testID={testID}>
      <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
        {MARRIAGE_VIEW.title}
      </AppText>
      {rows.map((r) => (
        <View key={r.id} style={styles.row} accessible accessibilityLabel={`${r.label}, ${r.text}`} testID={`${testID}-${r.id}`}>
          <AppText variant="captionMedium" testID={`${testID}-${r.id}-label`}>
            {r.label}
          </AppText>
          <AppText variant="body" testID={`${testID}-${r.id}-text`}>
            {r.text}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.s16 },
  row: { gap: space.s4 },
});
