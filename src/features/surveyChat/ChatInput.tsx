// 1부 입력 부품 자리(V6-F · 시안 확정 2 'A — 질문은 말풍선, 부품은 그 바로 아래'). 부품은 설문 v2 것을 그대로 쓴다(재사용만, 고치지 않음):
//  · 하나 고르기 = 설문 v2 OptionChip 알약(누르면 바로 보냄) · '말하고 싶지 않아요'는 선 아래 따로
//  · 구간 · 5단계 · 키 · 여러 개 · 양끝 · 순위 · 글 = 설문 v2 QuestionInput, 학교 = SchoolInput — 흰 카드 안 + [이렇게 할게요](구간은 [이 구간으로 할게요])
//  · 카드 위 작은 줄: 공개 범위(CHAT.{문항}.vis 가 있으면 그 글, 없으면 설문 v2 줄) · 자물쇠(민감) · AI 미전송 · 도움말 · 결혼관 '내 프로필에 보이기'
//  · 고치는 중이면 [그대로 둘게요] [바꾸기](하나 고르기도 바로 보내지 않는다 — 시안 08)
// 저장 키 · 값은 설문 v2 check() 가 정한다(같은 함수).
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CheckBox } from '@/components/CheckBox';
import { InfoBox } from '@/components/InfoBox';
import { Pressable } from '@/components/Pressable';
import { CtaPair } from '@/components/Screen';
import { TextButton } from '@/components/TextButton';
import { SV2 } from '@/features/surveyV2/copy';
import { QuestionInput } from '@/features/surveyV2/inputs';
import { copyOf, maxPick, NO_AI_IDS, optText, SENSITIVE_IDS, type Draft } from '@/features/surveyV2/model';
import { OptionChip, PublicToggle } from '@/features/surveyV2/parts';
import { POL } from '@/features/surveyV2/politicsCopy';
import { PoliticsSlider } from '@/features/surveyV2/PoliticsSlider';
import { polConsentOn, type PolDraft } from '@/features/surveyV2/PoliticsStage';
import { coursesFor, SchoolInput } from '@/features/surveyV2/SchoolInput';
import type { SearchOutcome } from '@/features/surveyV2/api';
import type { QuestionDef, V2Answers } from '@/features/surveyV2/types';
import type { SchoolCourse } from '@/data/schools/schoolSearch';
import { colors, radius, size, space } from '@/theme/tokens';

import { fill, t } from './copy';
import { sendsAtOnce } from './model';
import { Appear } from './parts';

type Props = {
  q: QuestionDef;
  draft: Draft;
  answers: V2Answers;
  publicOn: boolean;
  reason: string | null; // 막힌 이유(빈 칸 · 글자 수)
  editing: boolean;
  busy: boolean;
  play: boolean;
  onDraft: (d: Draft) => void;
  onSend: (d: Draft) => void;
  onSkip: () => void;
  onKeep: () => void;
  onPublic: () => void;
  search: (query: string, courses: readonly SchoolCourse[] | undefined) => Promise<SearchOutcome>;
};

export function visLine(q: QuestionDef): string {
  const mine = t(`CHAT.${q.id}.vis`);
  if (mine) return mine;
  if (q.vis === 'public') return `${SV2.common.vis.public}${q.toggle && !q.toggle.startsWith('e0') ? ` ${SV2.common.vis.toggle}` : ''}`;
  return q.vis === 'bucket' ? SV2.common.vis.bucket : SV2.common.vis.private;
}

export function ChatInput({ q, draft, answers, publicOn, reason, editing, busy, play, onDraft, onSend, onSkip, onKeep, onPublic, search }: Props) {
  const c = copyOf(q.id);
  const lines = [visLine(q), ...(SENSITIVE_IDS.includes(q.id) ? [q.id === 'F07' ? SV2.common.sensitivePrivate : SV2.common.sensitive] : []), ...(NO_AI_IDS.includes(q.id) ? [SV2.common.noAi] : [])];
  const pub = c?.publicToggle;
  const atOnce = sendsAtOnce(q) && !editing && draft.kind === 'choice';
  const full = draft.kind === 'multi' && maxPick(q.id) !== null && draft.picks.length >= (maxPick(q.id) ?? 0);
  const sendLabel = q.format === 'bucket' ? t('CHAT.UI.sendBucket') : t('CHAT.UI.send');

  const head = (
    <View style={styles.lines}>
      {lines.map((text, i) => (
        <AppText key={text} variant="caption" tone="sub" testID={i === 0 ? 'chat-vis' : undefined}>
          {text}
        </AppText>
      ))}
      {c?.help ? (
        <AppText variant="caption" tone="text" testID="chat-help">
          {c.help}
        </AppText>
      ) : null}
      {pub ? <PublicToggle label={pub} on={publicOn} onPress={onPublic} testID="chat-public" /> : null}
    </View>
  );

  const body = (() => {
    if (draft.kind === 'choice' && q.format === 'choice') {
      const main = q.codes.filter((code) => code !== 'decline');
      return (
        <View style={styles.block} accessibilityRole="radiogroup">
          <View style={styles.chips}>
            {main.map((code) => (
              <OptionChip
                key={code}
                label={optText(q.id, code)}
                selected={draft.code === code}
                onPress={() => {
                  const d: Draft = { kind: 'choice', code };
                  onDraft(d);
                  if (atOnce) onSend(d);
                }}
                testID={`v2-${q.id}-opt-${code}`}
              />
            ))}
          </View>
          {q.decline ? (
            <View style={[styles.chips, styles.apart]}>
              <OptionChip
                label={SV2.common.decline}
                selected={draft.code === 'decline'}
                onPress={() => {
                  const d: Draft = { kind: 'choice', code: 'decline' };
                  onDraft(d);
                  if (atOnce) onSend(d);
                }}
                testID={`v2-${q.id}-opt-decline`}
              />
            </View>
          ) : null}
        </View>
      );
    }
    if (q.format === 'school' && draft.kind === 'school') {
      return <SchoolInput q={q} draft={draft} onChange={onDraft} search={(query, courses) => search(query, courses ?? coursesFor(q.id))} />;
    }
    return <QuestionInput q={q} draft={draft} answers={answers} onChange={onDraft} invalid={reason !== null} />;
  })();

  return (
    <Appear play={play} delay={play ? 120 : 0} testID={`chat-card-${q.id}`}>
      <View style={styles.wrap}>
        {head}
        {atOnce ? body : <View style={styles.card}>{body}</View>}
        {full ? (
          <AppText variant="caption" tone="sub" testID="chat-multi-full">
            {fill(t('CHAT.UI.multiFull'), { n: String(maxPick(q.id)) })}
          </AppText>
        ) : null}
        {reason ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="chat-error">
            {reason}
          </AppText>
        ) : null}
        {editing ? (
          <CtaPair
            secondary={<Button label={t('CHAT.UI.keep')} variant="secondary" onPress={onKeep} disabled={busy} testID="chat-edit-keep" />}
            primary={<Button label={t('CHAT.UI.change')} onPress={() => onSend(draft)} loading={busy} testID="chat-edit-change" />}
          />
        ) : atOnce ? null : (
          <Button label={sendLabel} onPress={() => onSend(draft)} loading={busy} testID="chat-send" />
        )}
        {!q.required && !editing ? <TextButton label={SV2.common.skip} align="start" onPress={onSkip} testID="chat-skip" /> : null}
      </View>
    </Appear>
  );
}

// 정치 막대(W8 · CK15 별도 동의) — 설문 v2 PoliticsSlider · 동의 안내 그대로. 질문은 위 AI 말풍선이 한다
type PolProps = { pol: PolDraft; reason: string | null; busy: boolean; play: boolean; onCheck: () => void; onChange: (v: number) => void; onSend: () => void; onLater: () => void };

export function PolCard({ pol, reason, busy, play, onCheck, onChange, onSend, onLater }: PolProps) {
  return (
    <Appear play={play} delay={play ? 120 : 0} testID="chat-card-POL">
      <View style={styles.wrap}>
        <AppText variant="caption" tone="sub" testID="chat-vis">
          {t('CHAT.POL.vis')}
        </AppText>
        <InfoBox title={POL.consentTitle} body={POL.consentBody} testID="chat-pol-consent" />
        <AppText variant="caption" tone="text">
          {POL.consentNote}
        </AppText>
        <View style={styles.card}>
          {pol.serverConsent ? (
            <AppText variant="captionMedium" tone="accent" testID="chat-pol-consent-done">
              {POL.consentDone}
            </AppText>
          ) : (
            <Pressable accessibilityRole="checkbox" aria-checked={pol.checked} accessibilityLabel={POL.consentCheck} onPress={onCheck} effect="none" testID="v2-pol-check" style={styles.check}>
              <CheckBox checked={pol.checked} emphasized={reason === POL.needConsent} />
              <AppText variant="body" style={styles.flex}>
                {POL.consentCheck}
              </AppText>
            </Pressable>
          )}
          <PoliticsSlider value={pol.value} onChange={onChange} disabled={!polConsentOn(pol)} testID="v2-pol-slider" />
        </View>
        {reason ? (
          <AppText variant="captionMedium" tone="accent" accessibilityLiveRegion="polite" testID="chat-error">
            {reason}
          </AppText>
        ) : null}
        <CtaPair
          secondary={<Button label={POL.later} variant="secondary" onPress={onLater} disabled={busy} testID="chat-pol-later" />}
          primary={<Button label={t('CHAT.UI.send')} onPress={onSend} loading={busy} testID="chat-send" />}
        />
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touchMin },
  flex: { flex: 1, flexShrink: 1 },
  wrap: { gap: space.s8, alignSelf: 'stretch' },
  lines: { gap: space.s4 },
  block: { gap: space.s4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  apart: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: space.s4 },
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.s12, gap: space.s8 },
});
