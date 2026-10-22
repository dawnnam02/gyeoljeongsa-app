// 설문 v2 선택 단계 둘 · 검토(설문_v2 0장 '결혼 이야기 화면' · '세부사항 화면' · 2-1 검토 · D35 A5).
//  StoryStage  : 질문 카드 8장(접힘 → 누르면 펼쳐 10~100자 + 미리보기 '상대에게 이렇게 보여요'), 3개를 채우면 나머지는 흐려짐. 연락처 모양은 안내만(공개 칸)
//  AppealStage : 어필 카드 6장(이름 + 한 줄 예시 → 펼치면 도움말 · 10~200자 · [증빙 올리기] · 증빙 상태). B04 가 '없어요'가 아니면 T04 를 펼친 채 시작
//  ReviewStage : 주제별 답 · [고치기] · 확인 문구 W1~W5(막지 않음) · 건너뛴 단계 안내
// 등급 · 점수 숫자는 어디에도 없다. 글은 copy.ts · questionCopy.ts 만 쓴다.
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ContactHint } from '@/components/ContactHint';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { Rise, staggerDelay } from '@/motion';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { SECTION_COPY, SV2 } from './copy';
import type { Draft, Warning } from './model';
import { APPEAL, copyOf, STORY } from './model';
import type { ProofState } from './types';

type TextDraft = Extract<Draft, { kind: 'text' }>;
const textOf = (d: Draft | undefined): string => (d && d.kind === 'text' ? d.text : '');
const charCount = (s: string) => [...s.trim()].length;

type StoryProps = {
  drafts: Readonly<Record<string, Draft>>;
  open: readonly string[];
  max: number; // 남은 칸(3 − 08 에서 쓴 질문 소개)
  errors: Readonly<Record<string, string>>;
  onToggle: (id: string) => void;
  onChange: (id: string, d: TextDraft) => void;
};

export function StoryStage({ drafts, open, max, errors, onToggle, onChange }: StoryProps) {
  const filled = STORY.filter((q) => charCount(textOf(drafts[q.id])) > 0).map((q) => q.id);
  return (
    <View style={styles.stage} testID="v2-story">
      <AppText variant="title" accessibilityRole="header">
        {SV2.story.title}
      </AppText>
      <AppText variant="caption" tone="text">
        {SECTION_COPY.story.lead}
      </AppText>
      <AppText variant="captionMedium" tone="accent" testID="v2-story-count">
        {SV2.story.count(filled.length)}
      </AppText>
      {STORY.map((q, i) => {
        const text = textOf(drafts[q.id]);
        const isOpen = open.includes(q.id);
        const locked = !filled.includes(q.id) && filled.length >= max;
        const ok = charCount(text) >= (q.min ?? 0) && charCount(text) <= (q.max ?? 0);
        return (
          <Rise key={q.id} delay={staggerDelay(i)}>
            <View style={[styles.card, locked ? styles.dim : null]}>
              <Pressable accessibilityRole="button" accessibilityLabel={copyOf(q.id)?.q ?? q.id} accessibilityState={{ expanded: isOpen, disabled: locked }} aria-expanded={isOpen} disabled={locked} effect="scale" onPress={() => onToggle(q.id)} testID={`v2-${q.id}-head`} style={styles.cardHead}>
                <AppText variant="bodyMedium" style={styles.grow}>
                  {copyOf(q.id)?.q}
                </AppText>
              </Pressable>
              {isOpen ? (
                <View style={styles.cardBody}>
                  <TextField label={copyOf(q.id)?.q ?? q.id} value={text} onChangeText={(t) => onChange(q.id, { kind: 'text', text: t.replace(/\n{2,}/g, '\n') })} multiline maxLength={q.max} testID={`v2-${q.id}-input`} />
                  <AppText variant="caption" style={styles.counter}>
                    {SV2.common.chars(charCount(text), q.max ?? 0)}
                  </AppText>
                  <ContactHint text={text} field="public" testID={`v2-${q.id}-contact`} />
                  {errors[q.id] ? (
                    <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`v2-${q.id}-error`}>
                      {errors[q.id]}
                    </AppText>
                  ) : null}
                  {ok ? (
                    <View style={styles.preview} testID={`v2-${q.id}-preview`}>
                      <AppText variant="captionMedium" tone="accent">
                        {SV2.story.preview}
                      </AppText>
                      <AppText variant="caption" tone="text">
                        {copyOf(q.id)?.q}
                      </AppText>
                      <AppText variant="body">{text.trim()}</AppText>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Rise>
        );
      })}
    </View>
  );
}

type AppealProps = {
  drafts: Readonly<Record<string, Draft>>;
  open: readonly string[];
  proofs: Readonly<Record<string, ProofState>>;
  proofUpload: boolean;
  uploading: string | null;
  errors: Readonly<Record<string, string>>;
  onToggle: (id: string) => void;
  onChange: (id: string, d: TextDraft) => void;
  onUpload: (id: string) => void;
};

export function AppealStage({ drafts, open, proofs, proofUpload, uploading, errors, onToggle, onChange, onUpload }: AppealProps) {
  return (
    <View style={styles.stage} testID="v2-appeal">
      <AppText variant="title" accessibilityRole="header">
        {SV2.appeal.title}
      </AppText>
      <AppText variant="caption" tone="text">
        {SECTION_COPY.appeal.lead}
      </AppText>
      <Card testID="v2-appeal-aibox">
        <AppText variant="caption" tone="text">
          {SV2.common.aiBox}
        </AppText>
      </Card>
      {APPEAL.map((q, i) => {
        const text = textOf(drafts[q.id]);
        const isOpen = open.includes(q.id);
        const c = copyOf(q.id);
        const proof = proofs[q.id] ?? 'none';
        return (
          <Rise key={q.id} delay={staggerDelay(i)}>
            <View style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityLabel={c?.q ?? q.id} accessibilityState={{ expanded: isOpen }} aria-expanded={isOpen} effect="scale" onPress={() => onToggle(q.id)} testID={`v2-${q.id}-head`} style={styles.cardHead}>
                <View style={styles.grow}>
                  <AppText variant="bodyMedium">{c?.q}</AppText>
                  {!isOpen ? <AppText variant="caption">{c?.example}</AppText> : null}
                </View>
              </Pressable>
              {isOpen ? (
                <View style={styles.cardBody}>
                  {c?.help ? (
                    <AppText variant="caption" tone="text">
                      {c.help}
                    </AppText>
                  ) : null}
                  <TextField label={c?.q ?? q.id} placeholder={c?.example} value={text} onChangeText={(t) => onChange(q.id, { kind: 'text', text: t })} multiline maxLength={q.max} testID={`v2-${q.id}-input`} />
                  <AppText variant="caption" style={styles.counter}>
                    {SV2.common.chars(charCount(text), q.max ?? 0)}
                  </AppText>
                  <ContactHint text={text} field="private" testID={`v2-${q.id}-contact`} />
                  {errors[q.id] ? (
                    <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`v2-${q.id}-error`}>
                      {errors[q.id]}
                    </AppText>
                  ) : null}
                  <View style={styles.proofRow}>
                    <AppText variant="captionMedium" tone={proof === 'retry' ? 'accent' : proof === 'none' ? 'sub' : 'text'} style={styles.grow} testID={`v2-${q.id}-proof`}>
                      {SV2.appeal.proof[proof]}
                    </AppText>
                    {proofUpload && proof !== 'pending' && proof !== 'ok' ? (
                      <TextButton label={SV2.appeal.upload} variant="captionMedium" disabled={uploading !== null} onPress={() => onUpload(q.id)} testID={`v2-${q.id}-upload`} />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          </Rise>
        );
      })}
    </View>
  );
}

export type ReviewRow = { id: string; question: string; answer: string };
export type ReviewSection = { key: string; name: string; rows: ReviewRow[]; skipped: boolean; edit: string };
type ReviewProps = { sections: readonly ReviewSection[]; warnings: readonly Warning[]; onEdit: (id: string) => void };

export function ReviewStage({ sections, warnings, onEdit }: ReviewProps) {
  return (
    <View style={styles.stage} testID="v2-review">
      <AppText variant="title" accessibilityRole="header">
        {SV2.review.title}
      </AppText>
      <AppText variant="caption" tone="text">
        {SV2.review.lead}
      </AppText>
      {warnings.length > 0 ? (
        <View style={styles.warnBox} testID="v2-review-warn">
          <AppText variant="captionMedium" tone="text">
            {SV2.review.warnLead}
          </AppText>
          {warnings.map((w) => (
            <View key={w.code} style={styles.warnRow}>
              <AppText variant="caption" tone="accent" style={styles.grow} testID={`v2-warn-${w.code}`}>
                {SV2.warn[w.code]}
              </AppText>
              <TextButton label={SV2.review.edit} variant="captionMedium" onPress={() => onEdit(w.ids[0])} testID={`v2-warn-${w.code}-edit`} />
            </View>
          ))}
        </View>
      ) : null}
      {sections.map((s) => (
        <View key={s.key} style={styles.section} testID={`v2-review-${s.key}`}>
          <View style={styles.sectionHead}>
            <AppText variant="bodyBold" style={styles.grow}>
              {s.name}
            </AppText>
            {s.skipped || s.rows.length === 0 ? <TextButton label={SV2.review.edit} variant="captionMedium" onPress={() => onEdit(s.edit)} testID={`v2-review-${s.key}-edit`} /> : null}
          </View>
          {s.skipped ? (
            <AppText variant="caption" testID={`v2-review-${s.key}-skipped`}>
              {SV2.review.skipped}
            </AppText>
          ) : null}
          {s.rows.map((r) => (
            <View key={r.id} style={styles.reviewRow} testID={`v2-review-row-${r.id}`}>
              <View style={styles.grow}>
                <AppText variant="caption">{r.question}</AppText>
                <AppText variant="body" testID={`v2-review-answer-${r.id}`}>
                  {r.answer}
                </AppText>
              </View>
              <TextButton label={SV2.review.edit} variant="captionMedium" onPress={() => onEdit(r.id)} testID={`v2-review-edit-${r.id}`} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { gap: space.s12 },
  grow: { flex: 1, minWidth: 0 },
  card: { borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden' },
  dim: { opacity: alpha.disabled },
  cardHead: { minHeight: size.listRow, justifyContent: 'center', paddingHorizontal: space.s16, paddingVertical: space.s12, flexDirection: 'row', alignItems: 'center' },
  cardBody: { gap: space.s8, paddingHorizontal: space.s16, paddingBottom: space.s16 },
  counter: { alignSelf: 'flex-end' },
  preview: { gap: space.s4, borderRadius: radius.md, backgroundColor: colors.bg, padding: space.s12 },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touchMin },
  warnBox: { gap: space.s8, borderRadius: radius.md, backgroundColor: colors.accentSoft, padding: space.s12 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  section: { gap: space.s8, paddingTop: space.s8, borderTopWidth: 1, borderTopColor: colors.line },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touchMin },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
});
