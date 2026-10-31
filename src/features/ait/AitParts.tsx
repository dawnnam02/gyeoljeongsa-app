// AI 시험판(AIT-F) 공통 부품 — 시험판 알약 · 안내 · AI 표시 · 입력 안내 · 오류 칸 · 고정 카드 · 시험자 동의 시트.
//  · 글은 카피 23장 사본(aitText.ait)뿐 — 서버가 준 문장(오류 text · 카드 lines)은 보이지 않는다(보안 ATF-24). 카드는 카드 id 로 카피 23-5 줄을 고른다
//  · 숫자 · 남은 횟수 · 카운트다운 0 · 재촉 0 · 공유 · 복사 단추 0 · 평문(마크다운 · 링크 해석 0)
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CheckBox } from '@/components/CheckBox';
import { Chip } from '@/components/Chip';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { A11Y } from '@/content/copy';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { alpha, colors, radius, space } from '@/theme/tokens';

import { AIT_KEEP_NOTE_ON } from './aitConfig';
import { ait, type AitKey } from './aitText';
import type { AitCard, AitCode } from './aitTypes';
import { cardEndsSession, cardLinesOverride } from './safetyCard';

// ── 응답 코드 → 고정 글 (AIT.code.* · 서버 문장은 쓰지 않는다) ──────────────────────
export const ERROR_CODES = ['auth', 'rate', 'spend_limit', 'limit', 'unavailable', 'too_long', 'bad_request', 'upstream', 'timeout', 'blocked_output'] as const;
export type AitErrorCode = (typeof ERROR_CODES)[number];
export const isErrorCode = (c: AitCode): c is AitErrorCode => (ERROR_CODES as readonly string[]).includes(c);
export const codeLine = (c: AitErrorCode): string => ait(`AIT.code.${c}` as AitKey);
/** 미리 쓴 글이 있는 기능(궁합 카드 · 별자리 풀이)에서 이 글 아래에 '그동안은 미리 쓴 글로'를 더하는 코드. limit(대화 기록이 너무 큼)은 챗만 받는 코드라 뺐다(카피 23-13-1) */
export const FALLBACK_CODES: readonly AitErrorCode[] = ['spend_limit', 'unavailable', 'upstream'];

// ── 머리: 시험판 알약 + 안내 한 번 ──────────────────────────────────────────────
export function AitHead({ testID = 'ait-head' }: { testID?: string }) {
  return (
    <View style={styles.head} testID={testID}>
      <View style={styles.pill}>
        <Chip label={ait('AIT.badge')} variant="tag" accessibilityLabel={ait('AIT.badgeA11y')} testID={`${testID}-badge`} />
      </View>
      <AppText variant="caption" testID={`${testID}-note`}>
        {ait('AIT.testNote')}
      </AppText>
    </View>
  );
}

/** 결과 칸마다 붙는 작은 글(접힘 안 · 더 보기 안에 숨기지 않는다) */
export function AitAiLabel({ testID = 'ait-ai-label' }: { testID?: string }) {
  return (
    <AppText variant="caption" testID={testID}>
      {ait('AIT.aiLabel')}
    </AppText>
  );
}

/** 입력 칸 위: 미국의 AI 업체로 전달 + 운영 서버에는 저장하지 않아요(조건부) */
export function AitPrivacyLines({ testID = 'ait-privacy' }: { testID?: string }) {
  return (
    <View style={styles.gapSmall} testID={testID}>
      <AppText variant="caption" testID={`${testID}-send`}>
        {ait('AIT.privacy.send')}
      </AppText>
      {AIT_KEEP_NOTE_ON ? (
        <AppText variant="caption" testID={`${testID}-keep`}>
          {ait('AIT.privacy.keep')}
        </AppText>
      ) : null}
    </View>
  );
}

// ── 코드 없음 ────────────────────────────────────────────────────────────────
/** 미리 쓴 글이 있는 기능(궁합 카드 · 별자리 풀이): '미리 쓴 글을 보여 드려요. 설정의 … 넣으면' + 코드 넣기 */
export function AitDemoNote({ onSettings, testID = 'ait-demo' }: { onSettings: () => void; testID?: string }) {
  return (
    <View style={styles.gapSmall} testID={testID}>
      <AppText variant="caption" testID={`${testID}-note`}>
        {ait('AIT.demo.note')}
      </AppText>
      <TextButton label={ait('AIT.action.codeSettings')} align="start" onPress={onSettings} testID={`${testID}-settings`} />
    </View>
  );
}

/** 미리 쓴 글이 없는 기능(고민 정리 · 문장 다듬기): 무엇이 안 보이는지 기능별로 말하고(카피 23-13-2 AIT.noCode.*) + 코드 넣기 */
export function AitNoCode({ feature, onSettings, testID = 'ait-nocode' }: { feature: 'concern' | 'coach'; onSettings: () => void; testID?: string }) {
  return (
    <View style={styles.gapSmall} testID={testID}>
      <AppText variant="body" testID={`${testID}-line`}>
        {ait(feature === 'concern' ? 'AIT.noCode.concern' : 'AIT.noCode.coach')}
      </AppText>
      <Button label={ait('AIT.action.codeSettings')} variant="secondary" onPress={onSettings} testID={`${testID}-settings`} />
    </View>
  );
}

// ── 기다림 · 오류 ────────────────────────────────────────────────────────────
export function AitLoading({ testID = 'ait-loading' }: { testID?: string }) {
  return (
    <AppText variant="caption" accessibilityRole="progressbar" accessibilityLabel={ait('AIT.loadingA11y')} testID={testID}>
      {ait('AIT.loading')}
    </AppText>
  );
}

/**
 * 오류 칸: 코드마다 고정 글 하나(숫자 · 초 · 금액 0). 코드가 틀린 것인지 없는 것인지는 밝히지 않는다.
 *  · auth → [시험용 AI 코드 넣기]만(다시 시도 0)  · spend_limit → 다시 시도 0(미리 쓴 글이 있는 기능은 아래 줄)  · limit → [새 고민 시작하기](CONCERN.end.again · onRestart)만(대화 기록이 너무 길어짐 — 같은 묶음으로 다시 보내지 않는다)
 *  · rate → [다시 시도]는 잠깐 잠김(남은 시간 글 0)  · 그 밖 → [다시 시도]
 */
export function AitError({ code, fallback = false, locked = false, onRetry, onRestart, onSettings, testID = 'ait-error' }: { code: AitErrorCode; fallback?: boolean; locked?: boolean; onRetry?: () => void; onRestart?: () => void; onSettings: () => void; testID?: string }) {
  const noRetry = code === 'auth' || code === 'spend_limit' || code === 'limit';
  return (
    <View style={styles.gapSmall} testID={testID}>
      <AppText variant="body" accessibilityRole="alert" testID={`${testID}-text`}>
        {codeLine(code)}
      </AppText>
      {fallback && FALLBACK_CODES.includes(code) ? (
        <AppText variant="caption" testID={`${testID}-fallback`}>
          {ait('AIT.code.fallback')}
        </AppText>
      ) : null}
      {code === 'auth' ? <Button label={ait('AIT.action.codeSettings')} variant="secondary" onPress={onSettings} testID={`${testID}-settings`} /> : null}
      {code === 'limit' && onRestart ? <Button label={ait('CONCERN.end.again')} variant="secondary" onPress={onRestart} testID={`${testID}-restart`} /> : null}
      {!noRetry && onRetry ? <Button label={BOARDING.retry} variant="secondary" disabled={locked} onPress={onRetry} testID={`${testID}-retry`} /> : null}
    </View>
  );
}

// ── 고정 카드 (위기 · 가해 의도 · 폭력 · 거절 · 미성년 · 마침) — 한 갈래 카드는 카피 23-5 줄을 카드 id 로 고르고, 가해 의도 카드 · 겹침 카드는 고정 카드의 줄을 그대로 그린다(safetyCard.ts · IF5-QF2) ─────────────
const CARD_LINES: Readonly<Record<string, readonly AitKey[]>> = {
  crisis: ['CONCERN_CARD.crisis.l1', 'CONCERN_CARD.crisis.l2', 'CONCERN_CARD.crisis.l3', 'CONCERN_CARD.crisis.l4'],
  violence: ['CONCERN_CARD.violence.l1', 'CONCERN_CARD.violence.l2', 'CONCERN_CARD.violence.l3', 'CONCERN_CARD.violence.l4'],
  harm_intent: [], // 줄은 고정 카드에서(카피 23-13-4 — 생성기가 읽는 23-5 표로 옮겨지면 키로 바꾼다)
  misuse: ['CONCERN_CARD.misuse.l1', 'CONCERN_CARD.misuse.l2'],
  minor: ['CONCERN_CARD.minor.l1', 'CONCERN_CARD.minor.l2'],
  session_end: ['CONCERN.end.body'],
};
/** 마음 힘듦 칩(state_4)을 골랐을 때 앞에 붙는 위로 한 줄 + 번호 줄(crisis.l2 그대로) */
export const SOFT_CARD_LINES: readonly AitKey[] = ['CONCERN_CARD.soft.l1', 'CONCERN_CARD.crisis.l2'];

export type CardKind = 'crisis' | 'harm_intent' | 'violence' | 'misuse' | 'minor' | 'session_end' | 'soft';
export const cardKind = (card: AitCard): CardKind | null => (Object.prototype.hasOwnProperty.call(CARD_LINES, card.id) ? (card.id as CardKind) : null);

/** 카드 응답 → 그리는 값(종류 · 줄을 그대로 그릴지 · 세션을 마칠지). 알 수 없는 카드면 null */
export function cardView(card: AitCard): { kind: CardKind; lines: readonly string[] | null; ends: boolean } | null {
  const kind = cardKind(card);
  return kind ? { kind, lines: cardLinesOverride(card), ends: cardEndsSession(card) } : null;
}

/**
 * 카드 한 장. lines 가 있으면(가해 의도 카드 · 겹침 카드) 그 줄을 그대로 그린다 — 첫 줄이 가해 의도 카드의 제목(harm.title)이라 굵게.
 * ends 면 미성년이 끼어 세션을 마치는 카드: [이어서 이야기하기] 0 · [닫기](CONCERN_CARD.minor.end)만.
 */
export function AitCardView({ kind, options, onContinue, onEnd, lines, ends = false, testID = 'ait-card' }: { kind: CardKind; options: readonly ('continue' | 'end')[]; onContinue?: () => void; onEnd?: () => void; lines?: readonly string[] | null; ends?: boolean; testID?: string }) {
  const texts: readonly string[] = lines && lines.length > 0 ? lines : (kind === 'soft' ? SOFT_CARD_LINES : CARD_LINES[kind]).map((k) => ait(k));
  const shown = ends ? options.filter((o) => o === 'end') : options;
  return (
    <View style={styles.card} accessibilityLabel={ait('CONCERN.a11y.card', { 본문: texts.join(' ') })} testID={`${testID}-${kind}`}>
      {texts.map((t, i) => (
        <AppText key={`${i}-${t}`} variant={kind === 'harm_intent' && i === 0 ? 'bodyBold' : 'body'} testID={`${testID}-${kind}-l${i + 1}`}>
          {t}
        </AppText>
      ))}
      {shown.length > 0 ? (
        <View style={styles.cardButtons}>
          {shown.includes('continue') && onContinue ? (
            <View style={styles.flex}>
              <Button label={ait('CONCERN_CARD.option.continue')} variant="secondary" onPress={onContinue} testID={`${testID}-${kind}-continue`} />
            </View>
          ) : null}
          {shown.includes('end') && onEnd ? (
            <View style={styles.flex}>
              <Button label={kind === 'minor' || ends ? ait('CONCERN_CARD.minor.end') : ait('CONCERN_CARD.option.end')} variant="secondary" onPress={onEnd} testID={`${testID}-${kind}-end`} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── 시험자 동의 시트(법무 16-4 #2 · 16-2 국외 이전 · 13-3 문안 · 카피 23-13-2) ───────────────────────────
//  줄 순서(카피 23-13-2): 제목 → send(받는 업체 이름) → privacy.keep(재사용 · 조건부) → keepMore → name → noSend → 체크 check → refuse → 단추 confirm → 닫기.
//  체크는 미리 켜 두지 않는다. 시험판 알약 · 안내(AitHead)와 privacy.send 는 시트에서 뺀다(기능 화면 머리에 계속 있음). 동의한 판 · 시각은 aitStore 가 기기에 기록한다(웹은 메모리).
export function AitConsentSheet({ visible, onConfirm, onClose, testID = 'ait-consent' }: { visible: boolean; onConfirm: () => void; onClose: () => void; testID?: string }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      {visible ? <ConsentBody onConfirm={onConfirm} onClose={onClose} testID={testID} /> : null}
    </BottomSheet>
  );
}
function ConsentBody({ onConfirm, onClose, testID }: { onConfirm: () => void; onClose: () => void; testID: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <View style={styles.sheet} testID={`${testID}-body`}>
      <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
        {ait('AIT.consent.title')}
      </AppText>
      <AppText variant="caption" testID={`${testID}-send`}>
        {ait('AIT.consent.send')}
      </AppText>
      {AIT_KEEP_NOTE_ON ? (
        <>
          <AppText variant="caption" testID={`${testID}-privacy-keep`}>
            {ait('AIT.privacy.keep')}
          </AppText>
          <AppText variant="caption" testID={`${testID}-keepmore`}>
            {ait('AIT.consent.keepMore')}
          </AppText>
        </>
      ) : null}
      <AppText variant="caption" testID={`${testID}-name`}>
        {ait('AIT.consent.name')}
      </AppText>
      <AppText variant="caption" testID={`${testID}-nosend`}>
        {ait('AIT.consent.noSend')}
      </AppText>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} aria-checked={checked} accessibilityLabel={ait('AIT.consent.check')} onPress={() => setChecked((v) => !v)} effect="none" style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]} testID={`${testID}-check`}>
        <CheckBox checked={checked} />
        <AppText variant="body" style={styles.flex}>
          {ait('AIT.consent.check')}
        </AppText>
      </Pressable>
      <AppText variant="caption" testID={`${testID}-refuse`}>
        {ait('AIT.consent.refuse')}
      </AppText>
      <Button label={ait('AIT.consent.confirm')} disabled={!checked} onPress={onConfirm} testID={`${testID}-confirm`} />
      <TextButton label={A11Y.close} onPress={onClose} testID={`${testID}-cancel`} />
    </View>
  );
}

// 접힘 없는 한 칸(결과 칸 · 안내 칸)
export function AitPaper({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View style={styles.paper} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.s8 },
  pill: { flexDirection: 'row' },
  gapSmall: { gap: space.s8 },
  flex: { flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s16, gap: space.s8 },
  cardButtons: { flexDirection: 'row', gap: space.s8, paddingTop: space.s4 },
  sheet: { padding: space.s20, gap: space.s12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: 48 },
  pressed: { opacity: alpha.pressed },
  paper: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s16, gap: space.s8 },
});
