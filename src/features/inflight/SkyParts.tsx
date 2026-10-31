// 기내지 안 하늘 읽기 칸 셋(IF3-F 축소판 3부-카): G-02 창밖 하늘(① 쪽) · G-04 사랑하는 방식 · 말하는 방식(① 쪽 '나의 결' 아래 접힘) · G-07 생일 주간 엽서(④ 쪽).
//  · 전부 나만 보는 칸 — 상대 · 짝 낱말 0 · 푸시 · 숫자 배지 · 새 표시 · 본 표시 · 모으기 0 · 공유 · 복사 · 저장 단추 0(정책 PG-03 · PG-04 · PG-06)
//  · 글은 카피 22장(content/if3Copy) + 라이브러리 완결 문장(if3Logic). 앱 안 천문 · 생년월일 계산 0 — 별자리 코드 · 참/거짓은 서버(get_my_ways · get_my_birth_week)가 준다
//  · G-04 · G-07 은 12 보안 설정과 상관없이 캡처 막기 처음부터 켬(정책 PG-03a · 보안 IC3-16). 접힘은 늘 닫힌 채 시작 · 펼침을 기기에도 기억하지 않는다
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import art3 from '../../../assets/illustrations/if3art.json';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { IF3_TEXT, t3 } from '@/content/if3Copy';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { COMMON } from '@/content/copy';
import { useAlwaysCaptureBlock } from '@/lib/captureBlock';
import { Rise } from '@/motion';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { Footnote, if2Styles } from './If2Parts';
import { tx } from './if2Text';
import type { BirthWeek, InflightApi, MyWays } from './inflightApi';
import { birthdayQuestions, mercuryText, signNameOf, skyLine, skyMoonArt, skyWeekOf, venusText } from './if3Logic';

const MOON_SIZE = 40;

// ── G-02 창밖 하늘 ──────────────────────────────────────────────────────────
// 그 호의 표 줄이 없으면 칸째 없음(빈 상태 · 오류 글 0). CK17A 와 상관없이 보인다(자기 값이 없는 천문 사실 — 정책 PG-22). 끝줄은 ① 쪽 FUN.footer 가 덮는다
export function SkyWeekCard({ issueDate, testID = 'sky-week' }: { issueDate: string | null; testID?: string }) {
  const week = skyWeekOf(issueDate);
  if (!week) return null;
  const s = skyLine(week);
  const moon = (art3.moons as readonly string[])[skyMoonArt(week)] ?? '';
  return (
    <View style={if2Styles.paper} accessible accessibilityLabel={t3('SKY_WEEK.a11y', { '한 줄': s.line })} testID={testID}>
      <View style={if2Styles.row}>
        <AppText variant="bodyBold" style={if2Styles.flex} testID={`${testID}-title`}>
          {IF3_TEXT['SKY_WEEK.title']}
        </AppText>
        <AppText variant="caption" testID={`${testID}-period`}>
          {t3('SKY_WEEK.period', { '시작 날짜': s.period.split(' ~ ')[0], '끝 날짜': s.period.split(' ~ ')[1] })}
        </AppText>
      </View>
      <AppText variant="caption" testID={`${testID}-lead`}>
        {IF3_TEXT['SKY_WEEK.lead']}
      </AppText>
      <View style={if2Styles.row}>
        <View style={styles.moon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`${testID}-moon`}>
          <SvgXml xml={moon} width="100%" height="100%" />
        </View>
        <View style={[if2Styles.flex, if2Styles.gapSmall]}>
          <AppText variant="body" testID={`${testID}-moon-line`}>
            {s.moon}
          </AppText>
          {s.term ? (
            <AppText variant="body" testID={`${testID}-term-line`}>
              {s.term}
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── G-04 사랑하는 방식 · 말하는 방식 ─────────────────────────────────────────
// 접힘 줄: 펼칠 때만 서버를 부른다(저장 0 · 응답은 이 칸 메모리에만 — 접으면 비움). 금성 · 수성 별자리는 한국 정오 기준 하나씩 · 경계 날 표시 0 · 모두에게 같은 안내 한 줄
type WaysState = { kind: 'closed' } | { kind: 'loading' } | { kind: 'ready'; ways: Extract<MyWays, { state: 'ready' }> } | { kind: 'consent' } | { kind: 'failed' } | { kind: 'gone' };

export function MyWaysFold({ api, onAgree, testID = 'ways' }: { api: Pick<InflightApi, 'myWays'>; onAgree: () => void; testID?: string }) {
  const [st, setSt] = useState<WaysState>({ kind: 'closed' });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const open = st.kind !== 'closed' && st.kind !== 'gone';
  useAlwaysCaptureBlock(st.kind === 'ready'); // 값이 화면에 있는 동안만
  const load = useCallback(() => {
    setSt({ kind: 'loading' });
    void api.myWays().then(
      (r) => {
        if (!alive.current) return;
        if (r.ok) setSt(r.data.state === 'ready' ? { kind: 'ready', ways: r.data } : { kind: 'gone' }); // 표 밖 · 생년월일 없음 = 줄째 없음(글 0)
        else setSt(r.code === 'consent_required' ? { kind: 'consent' } : { kind: 'failed' });
      },
      () => alive.current && setSt({ kind: 'failed' }),
    );
  }, [api]);
  const toggle = () => {
    if (open) setSt({ kind: 'closed' }); // 접으면 값을 비운다(메모리에도 남기지 않음)
    else load();
  };
  if (st.kind === 'gone') return null;
  const ways = st.kind === 'ready' ? st.ways : null;
  return (
    <View style={if2Styles.paper} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        accessibilityLabel={open ? IF3_TEXT['MY_WAYS.a11y.close'] : IF3_TEXT['MY_WAYS.a11y.open']}
        onPress={toggle}
        effect="none"
        style={({ pressed }) => [styles.foldHead, pressed && styles.pressed]}
        testID={`${testID}-toggle`}>
        <AppText variant="bodyBold" style={if2Styles.flex} testID={`${testID}-title`}>
          {IF3_TEXT['MY_WAYS.title']}
        </AppText>
        <View style={styles.pill} testID={`${testID}-pill`}>
          <AppText variant="captionMedium" tone="accent">
            {IF3_TEXT['MY_WAYS.pill']}
          </AppText>
        </View>
      </Pressable>
      {open ? (
        <Rise duration={260} distance={space.s8}>
          <View style={if2Styles.gap} testID={`${testID}-body`}>
            {st.kind === 'loading' ? <AppText variant="caption">{COMMON.loading}</AppText> : null}
            {st.kind === 'consent' ? (
              <View style={if2Styles.gapSmall} testID={`${testID}-consent`}>
                <AppText variant="body">{IF3_TEXT['MY_WAYS.off.body']}</AppText>
                <Button label={tx('FUN.ck17.agreeView')} variant="secondary" inline onPress={onAgree} testID={`${testID}-agree`} />
              </View>
            ) : null}
            {st.kind === 'failed' ? (
              <View style={if2Styles.gapSmall} testID={`${testID}-failed`}>
                <AppText variant="body" tone="sub" accessibilityRole="alert">
                  {tx('MAGAZINE.loadFailed')}
                </AppText>
                <Button label={BOARDING.retry} variant="secondary" inline onPress={load} testID={`${testID}-retry`} />
              </View>
            ) : null}
            {ways ? (
              <>
                <AppText variant="caption" testID={`${testID}-lead`}>
                  {IF3_TEXT['MY_WAYS.lead']}
                </AppText>
                <WayRow kind="love" code={ways.venus} id={`${testID}-love`} />
                <WayRow kind="talk" code={ways.mercury} id={`${testID}-talk`} />
                <AppText variant="caption" testID={`${testID}-note`}>
                  {IF3_TEXT['MY_WAYS.note']}
                </AppText>
                <AppText variant="caption" testID={`${testID}-mine`}>
                  {IF3_TEXT['MY_WAYS.mine']}
                </AppText>
              </>
            ) : null}
          </View>
        </Rise>
      ) : null}
    </View>
  );
}

// 사랑하는 방식(금성) · 말하는 방식(수성) 한 칸 — 두 칸은 같은 크기 · 같은 무게. 별자리 이름은 라이브러리 글이 맨 앞에서 말한다(이름을 따로 읽지 않음)
function WayRow({ kind, code, id }: { kind: 'love' | 'talk'; code: string; id: string }) {
  const testID = id;
  const text = (kind === 'love' ? venusText(code) : mercuryText(code)) ?? '';
  if (!text || !signNameOf(code)) return null;
  const zodiac = (art3.signs as Readonly<Record<string, string>>)[code] ?? '';
  return (
    <View style={if2Styles.gapSmall} accessible accessibilityLabel={t3(kind === 'love' ? 'MY_WAYS.a11y.love' : 'MY_WAYS.a11y.talk', { '한 줄': text })} testID={testID}>
      <View style={if2Styles.row}>
        <View style={styles.sign} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SvgXml xml={zodiac} width="100%" height="100%" />
        </View>
        <View style={if2Styles.flex}>
          <AppText variant="bodyMedium" testID={`${testID}-title`}>
            {IF3_TEXT[kind === 'love' ? 'MY_WAYS.love.title' : 'MY_WAYS.talk.title']}
          </AppText>
          <AppText variant="caption">{IF3_TEXT[kind === 'love' ? 'MY_WAYS.love.sub' : 'MY_WAYS.talk.sub']}</AppText>
        </View>
      </View>
      <AppText variant="body" testID={`${testID}-text`}>
        {text}
      </AppText>
    </View>
  );
}

// ── G-07 생일 주간 엽서 ─────────────────────────────────────────────────────
// 생일이 든 호의 ④ 쪽 질문 아래 카드 한 장 · 읽기만(답 적기 칸 0 · 기기 저장 0). 서버는 참/거짓만 준다 — 거짓 · 없음 · 오류는 칸째 없음(빈 상태 글 0 · 오류 글 0).
// 서버 응답(week)은 기내지 화면이 ④ 쪽에 닿았을 때 한 번 받아 쥐고 있다(쪽을 넘겨도 다시 부르지 않음 · 기내지를 닫으면 사라짐). 카드 끝줄은 법무 안 MAGAZINE.love.footer(질문용 · 상담 아님), 쪽 맨 아래 FUN.footer 는 그대로
export function BirthCard({ week, issueDate, active, testID = 'birth' }: { week: BirthWeek | null; issueDate: string | null; active: boolean; testID?: string }) {
  const questions = birthdayQuestions(issueDate);
  const show = week?.state === 'ready' && week.birthdayWeek && questions.length > 0;
  useAlwaysCaptureBlock(show && active);
  if (!show) return null;
  return (
    <View style={if2Styles.paper} accessible accessibilityLabel={t3('BIRTH_CARD.a11y.card', { '질문 차례': questions.join(' ') })} testID={testID}>
      <View style={styles.candle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SvgXml xml={art3.candle} width="100%" height="100%" />
      </View>
      <AppText variant="caption" testID={`${testID}-kicker`}>
        {IF3_TEXT['BIRTH_CARD.kicker']}
      </AppText>
      <AppText variant="bodyBold" testID={`${testID}-title`}>
        {IF3_TEXT['BIRTH_CARD.title']}
      </AppText>
      <AppText variant="heading" testID={`${testID}-heading`}>
        {IF3_TEXT['BIRTH_CARD.heading']}
      </AppText>
      <AppText variant="caption" testID={`${testID}-lead`}>
        {IF3_TEXT['BIRTH_CARD.lead']}
      </AppText>
      {questions.map((q, i) => (
        <AppText key={q} variant="bodyMedium" testID={`${testID}-q-${i}`}>
          {q}
        </AppText>
      ))}
      <AppText variant="caption" testID={`${testID}-end`}>
        {IF3_TEXT['BIRTH_CARD.end']}
      </AppText>
      <Footnote text={tx('MAGAZINE.love.footer')} testID={`${testID}-footer`} />
      <AppText variant="caption" testID={`${testID}-note`}>
        {IF3_TEXT['BIRTH_CARD.note']}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  moon: { width: MOON_SIZE, height: MOON_SIZE },
  sign: { width: MOON_SIZE, height: MOON_SIZE },
  candle: { width: MOON_SIZE, height: MOON_SIZE },
  foldHead: { minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  pressed: { opacity: alpha.pressed },
  pill: { paddingHorizontal: space.s12, paddingVertical: space.s4, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
});
