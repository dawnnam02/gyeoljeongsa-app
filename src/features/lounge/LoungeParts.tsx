// 라운지 부품(LG-F · 디자인 LG-D 확정 1A ~ 5A). 색 · 글자 · 간격 · 둥글기는 tokens 와 theme/loungeLook 만, 누르는 것은 공통 Pressable · Button · TextButton.
//  · 말풍선(3A 쪽지 꼬리표): 이름 자리에 좌석 꼬리표 '13A'(누를 수 없음 — 프로필 · 1:1 · 좌석 지목 0) · 남의 글은 모두 bubbleAi 한 색 · 내 글만 accentAlt
//    말풍선 아래 [공감] · [⋯] 두 알약(보이는 32 · 누르는 48). 소등 · 착륙 준비 중엔 [공감] · '공감받았어요' 0(LGF-07)
//  · 기장 안내 = 점선 종이 쪽지 · '기장 안내' 꼬리표 · [나도 답하기] · 둘 중 하나 두 버튼(같은 크기, 숫자 0)
//  · 좌석표(2A 위에서 본 기체): 54자리 같은 옅은 선 · 내 자리만 와인 점(다른 자리 찼는지 비었는지 구분 0 — LGF-06) · 창가 · 통로 · 가운데 글 0
//  · 기장 안내만(5A 창 너머 날개): 빈자리 그림 0 · 등급 아이콘 모양 0
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { A11Y } from '@/content/copy';
import { clockText } from '@/features/chat/chatLogic';
import { CrisisCard } from '@/features/safety/CrisisCard';
import { ariaPressed } from '@/lib/webAria';
import { Rise } from '@/motion';
import { withAlpha } from '@/theme/color';
import { layout } from '@/theme/layout';
import { loungeLook } from '@/theme/loungeLook';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import type { CaptainKind, CaptainPost, MemberPost } from './loungeApi';
import { LOUNGE } from './loungeCopy';
import { LoungeIcon, type LoungeIconName } from './LoungeIcon';
import { captainKindLabel, captainText, memberA11y, quoteLine, SEAT_COLS, SEAT_ROWS, seatPosition } from './loungeLogic';

// ── 머리: ‹ · 제목 '탑승객 라운지' · 부제 '{여행지}행' · (좌석이 있으면) '내 좌석 13A' · ⋯ / 첫 입장 안내는 ✕(입장 안내 닫기)
export function LoungeHeader({ trip, seat, onBack, onClose, onMenu, onSeat, testID = 'lounge-header' }: { trip: string | null; seat?: string | null; onBack?: () => void; onClose?: () => void; onMenu?: () => void; onSeat?: () => void; testID?: string }) {
  return (
    <View style={styles.head} testID={testID}>
      {onBack ? <IconTouch icon="back" label={A11Y.back} onPress={onBack} testID={`${testID}-back`} /> : <View style={styles.headGap} />}
      <View style={styles.headTitle} accessible accessibilityRole="header" accessibilityLabel={trip ? LOUNGE.a11y.header(trip) : LOUNGE.header.title}>
        <AppText variant="title" numberOfLines={1} testID={`${testID}-title`}>
          {LOUNGE.header.title}
        </AppText>
        {trip ? (
          <AppText variant="caption" numberOfLines={1} testID={`${testID}-sub`}>
            {LOUNGE.header.subtitle(trip)}
          </AppText>
        ) : null}
      </View>
      {seat && onSeat ? (
        <Pressable accessibilityRole="button" accessibilityLabel={LOUNGE.a11y.mySeat(seat)} onPress={onSeat} effect="none" style={({ pressed }) => [styles.seatChip, pressed && styles.pressed]} testID={`${testID}-seat`}>
          <AppText variant="captionMedium" tone="accent" numberOfLines={1}>
            {LOUNGE.header.mySeat(seat)}
          </AppText>
        </Pressable>
      ) : null}
      {onMenu ? <IconTouch icon="more" label={LOUNGE.a11y.menu} onPress={onMenu} testID={`${testID}-menu`} /> : null}
      {onClose ? <IconTouch icon="close" label={LOUNGE.intro.closeA11y} onPress={onClose} testID={`${testID}-close`} /> : null}
    </View>
  );
}

function IconTouch({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} effect="none" style={({ pressed }) => [styles.iconTouch, pressed && styles.pressed]} testID={testID}>
      <Icon name={icon} size={layout.headerIcon} color={colors.text} />
    </Pressable>
  );
}

// ── 좌석 꼬리표(이름 자리) — 누를 수 없다(LGF-12). 읽기 이름 '13A 좌석'(LGF-13)
export function SeatTag({ seat, mine = false, testID }: { seat: string; mine?: boolean; testID?: string }) {
  return (
    <View style={[styles.tag, mine && styles.tagMine]} accessible accessibilityLabel={LOUNGE.a11y.seat(seat)} testID={testID}>
      <AppText variant="captionMedium" tone={mine ? 'accent' : 'text'}>
        {seat}
      </AppText>
    </View>
  );
}

// ── 회원 글 말풍선
type BubbleProps = {
  post: MemberPost;
  fresh: boolean;
  showEmpathy: boolean; // [공감] 단추(소등 · 착륙 준비 · 남의 글 아님이면 0)
  showReceived: boolean; // '공감받았어요'(내 글 · 소등 · 착륙 준비 중 0)
  showHelp: boolean; // 위기 도움 카드(방금 보낸 내 글 한 장 · 닫기 전 — 화면이 정한다. 목록에서 불러온 글 아래에는 0)
  hiddenSeatOf: (quoteId: string) => boolean;
  onEmpathy: () => void;
  onMenu: () => void;
  onCloseHelp: () => void;
  testID: string;
};
export function MemberBubble({ post: p, fresh, showEmpathy, showReceived, showHelp, hiddenSeatOf, onEmpathy, onMenu, onCloseHelp, testID }: BubbleProps) {
  const mine = p.mine;
  const q = p.quote ? quoteLine(p.quote, hiddenSeatOf) : null;
  const body = (
    <View style={[styles.line, mine ? styles.lineMine : styles.lineTheirs]} testID={testID}>
      <View style={[styles.stack, mine && styles.stackMine]}>
        <View style={[styles.tagRow, mine && styles.tagRowMine]}>
          <SeatTag seat={p.seat} mine={mine} testID={`${testID}-seat`} />
          {mine ? (
            <AppText variant="captionMedium" tone="accent" testID={`${testID}-me`}>
              {LOUNGE.msg.me}
            </AppText>
          ) : null}
          {p.tag === 'answer' ? (
            <AppText variant="caption" testID={`${testID}-answer-tag`}>
              {LOUNGE.answer.tag}
            </AppText>
          ) : null}
        </View>
        <Pressable accessibilityRole="text" accessibilityLabel={memberA11y(p)} onLongPress={onMenu} effect="none" style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]} testID={`${testID}-bubble`}>
          {q ? <QuoteBox seat={q.seat} text={q.text} onMine={mine} testID={`${testID}-quote`} /> : null}
          <AppText variant="body" tone={mine ? 'inverse' : 'text'} testID={`${testID}-body`}>
            {p.body}
          </AppText>
        </Pressable>
        <View style={[styles.meta, mine && styles.metaMine]}>
          <AppText variant="caption" testID={`${testID}-time`}>
            {clockText(p.at)}
          </AppText>
          {showEmpathy ? (
            <Pill label={LOUNGE.empathy.button} a11y={LOUNGE.a11y.empathy} selected={p.empathized} icon={<LoungeIcon name="empathy" size={20} on={p.empathized} color={p.empathized ? colors.accent : colors.sub} />} onPress={onEmpathy} testID={`${testID}-empathy`} />
          ) : null}
          <Pill a11y={LOUNGE.a11y.msgMenu} icon={<Icon name="more" size={20} color={colors.sub} />} onPress={onMenu} testID={`${testID}-more`} />
        </View>
        {mine && p.received && showReceived ? (
          <AppText variant="captionMedium" tone="accent" testID={`${testID}-received`}>
            {LOUNGE.empathy.received}
          </AppText>
        ) : null}
        {mine && showHelp ? <CrisisCard onClose={onCloseHelp} testID={`${testID}-crisis`} /> : null}
      </View>
    </View>
  );
  return fresh ? (
    <Rise distance={loungeLook.bubbleRise} duration={loungeLook.bubbleIn}>
      {body}
    </Rise>
  ) : (
    body
  );
}

function QuoteBox({ seat, text, onMine, testID }: { seat: string | null; text: string; onMine: boolean; testID: string }) {
  return (
    <View style={[styles.quote, onMine && styles.quoteMine]} testID={testID}>
      {seat ? (
        <AppText variant="captionMedium" testID={`${testID}-seat`}>
          {seat}
        </AppText>
      ) : null}
      <AppText variant="caption" tone={seat ? 'text' : 'sub'} numberOfLines={2} testID={`${testID}-text`}>
        {text}
      </AppText>
    </View>
  );
}

function Pill({ label, a11y, icon, selected = false, onPress, testID }: { label?: string; a11y: string; icon: ReactNode; selected?: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={label ? { selected } : undefined} {...(label ? ariaPressed(selected) : {})} onPress={onPress} effect="none" style={({ pressed }) => [styles.pillTouch, pressed && styles.pressed]} testID={testID}>
      <View style={[styles.pill, selected && styles.pillOn]}>
        {icon}
        {label ? (
          <AppText variant="captionMedium" tone={selected ? 'accent' : 'sub'}>
            {label}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── 기장 안내 쪽지(점선 종이 · 가운데)
type CaptainProps = {
  kind: CaptainKind;
  captainKey: string;
  trip: string | null;
  post?: CaptainPost; // 객실 글(고르기 · 결과). 기장 안내만 상태는 없음
  fresh?: boolean;
  canAnswer?: boolean;
  canPick?: boolean;
  result?: { question: string; text: string } | null;
  waiting?: boolean;
  onAnswer?: () => void;
  onPick?: (side: 'a' | 'b') => void;
  testID: string;
};
export function CaptainNoteCard({ kind, captainKey, trip, post, fresh = false, canAnswer = false, canPick = false, result, waiting = false, onAnswer, onPick, testID }: CaptainProps) {
  const t = captainText(captainKey);
  if (!t) return null;
  const kindLabel = captainKindLabel({ captainKind: kind });
  const lead = kind === 'first' && trip ? LOUNGE.captain.firstLead(trip) : null;
  const text = lead ? `${lead} ${t.question}` : t.question;
  const picked = post?.pick ?? null;
  const note = (
    <View style={styles.captainWrap} testID={testID}>
      <View style={styles.captain}>
        <View accessible accessibilityLabel={LOUNGE.a11y.captain(kindLabel, text)} style={styles.captainText} testID={`${testID}-text`}>
          <View style={styles.captainHead}>
            <LoungeIcon name="captain" size={20} color={colors.accent} />
            <AppText variant="captionBold" tone="accent">
              {LOUNGE.captain.label}
            </AppText>
            {kindLabel ? <AppText variant="caption">{`· ${kindLabel}`}</AppText> : null}
          </View>
          {lead ? <AppText variant="small">{lead}</AppText> : null}
          <AppText variant="bodyMedium">{t.question}</AppText>
        </View>
        {t.a && t.b ? (
          <View style={styles.options} testID={`${testID}-options`}>
            {(['a', 'b'] as const).map((side) => {
              const label = side === 'a' ? (t.a as string) : (t.b as string);
              const mine = picked === side;
              return canPick ? (
                <Pressable key={side} accessibilityRole="button" accessibilityLabel={LOUNGE.a11y.balanceOption(label)} onPress={() => onPick?.(side)} effect="scale" style={styles.option} testID={`${testID}-pick-${side}`}>
                  <AppText variant="bodyMedium" style={styles.center}>
                    {label}
                  </AppText>
                </Pressable>
              ) : (
                <View key={side} style={[styles.option, mine && styles.optionMine]} accessible accessibilityLabel={LOUNGE.a11y.balanceOption(label)} accessibilityState={{ selected: mine }} aria-selected={mine} testID={`${testID}-opt-${side}`}>
                  <AppText variant="bodyMedium" tone={mine ? 'accent' : 'text'} style={styles.center}>
                    {label}
                  </AppText>
                  {mine ? (
                    <AppText variant="caption" tone="accent" style={styles.center} testID={`${testID}-mine`}>
                      {LOUNGE.balance.mine}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        {waiting ? (
          <AppText variant="caption" testID={`${testID}-waiting`}>
            {LOUNGE.balance.waiting}
          </AppText>
        ) : null}
        {result ? (
          <View style={styles.result} accessible accessibilityLabel={LOUNGE.a11y.balanceResult(result.question, result.text)} testID={`${testID}-result`}>
            <AppText variant="caption">{LOUNGE.balance.resultTitle}</AppText>
            <AppText variant="smallMedium">{result.text}</AppText>
          </View>
        ) : null}
        {canAnswer && onAnswer ? (
          <Pressable accessibilityRole="button" accessibilityLabel={LOUNGE.answer.button} onPress={onAnswer} effect="none" style={({ pressed }) => [styles.answer, pressed && styles.pressed]} testID={`${testID}-answer`}>
            <LoungeIcon name="quote_reply" size={20} color={colors.accent} />
            <AppText variant="captionMedium" tone="accent">
              {LOUNGE.answer.button}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
  return fresh ? (
    <Rise distance={loungeLook.bubbleRise} duration={loungeLook.bubbleIn}>
      {note}
    </Rise>
  ) : (
    note
  );
}

// ── 좌석표(2A): 11 ~ 19열 × A ~ F — 내 자리만 점. 그림은 화면 읽기에서 건너뛰고 '좌석표, 내 자리는 13A 좌석' 한 줄
const MAP_W = SEAT_COLS.length * loungeLook.seatW + (SEAT_COLS.length - 2) * loungeLook.seatGap + loungeLook.aisle;
const MAP_H = SEAT_ROWS.length * (loungeLook.seatH + loungeLook.seatGap) - loungeLook.seatGap;
const colX = (c: number) => c * (loungeLook.seatW + loungeLook.seatGap) + (c >= 3 ? loungeLook.aisle - loungeLook.seatGap : 0);
export function SeatMap({ seat, testID = 'lounge-seatmap' }: { seat: string; testID?: string }) {
  const mine = seatPosition(seat);
  const pad = loungeLook.fuselagePad;
  const W = MAP_W + pad * 2;
  const H = MAP_H + pad * 2;
  const other = withAlpha(colors.sub, loungeLook.otherSeatOpacity);
  return (
    <View style={styles.map} accessible accessibilityLabel={LOUNGE.a11y.seatMap(seat)} testID={testID}>
      <View style={[styles.mapCols, { width: MAP_W }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {SEAT_COLS.map((c, i) => (
          <AppText key={c} variant="caption" style={[styles.mapCol, { left: colX(i), width: loungeLook.seatW }]}>
            {c}
          </AppText>
        ))}
      </View>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Rect x={1} y={1} width={W - 2} height={H - 2} rx={W / 3} fill={colors.bg} stroke={other} strokeWidth={1} />
        {SEAT_ROWS.flatMap((_, r) =>
          SEAT_COLS.map((__, c) => {
            const on = mine !== null && mine.row === r && mine.col === c;
            return <Rect key={`${r}-${c}`} x={pad + colX(c)} y={pad + r * (loungeLook.seatH + loungeLook.seatGap)} width={loungeLook.seatW} height={loungeLook.seatH} rx={radius.sm / 2} fill="none" stroke={on ? colors.accent : other} strokeWidth={on ? 1.5 : 1} />;
          }),
        )}
        {mine ? <Circle cx={pad + colX(mine.col) + loungeLook.seatW / 2} cy={pad + mine.row * (loungeLook.seatH + loungeLook.seatGap) + loungeLook.seatH / 2} r={loungeLook.myDot / 2} fill={colors.accent} testID={`${testID}-dot`} /> : null}
      </Svg>
      <View style={styles.mapMine} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.mapDot} />
        <AppText variant="smallMedium" tone="accent" testID={`${testID}-mine`}>{`${seat} · ${LOUNGE.seatMap.mine}`}</AppText>
      </View>
    </View>
  );
}

// ── 기장 안내만(5A 창 너머 날개) — 정지 그림 · 화면 읽기 건너뜀
export function WindowArt({ testID = 'lounge-window-art' }: { testID?: string }) {
  const w = loungeLook.windowW;
  const h = loungeLook.windowH;
  const f = loungeLook.windowFrame;
  return (
    <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Rect x={f / 2} y={f / 2} width={w - f} height={h - f} rx={w / 2.6} fill={colors.card} stroke={colors.line} strokeWidth={f} />
        <Rect x={f * 1.6} y={f * 1.6} width={w - f * 3.2} height={h - f * 3.2} rx={w / 3.4} fill={colors.bg} />
        <Rect x={f * 1.6} y={f * 1.6} width={w - f * 3.2} height={(h - f * 3.2) * 0.42} rx={w / 3.4} fill={colors.line} />
        <Path d={`M${f * 1.8} ${h * 0.82} L${w * 0.62} ${h * 0.64} L${w * 0.66} ${h * 0.7} L${f * 2.2} ${h * 0.9} Z`} fill={colors.accent} />
      </Svg>
    </View>
  );
}

// ── 상태 띠(소등 · 착륙 준비 · 쓰기 멈춤) — 숫자 · 남은 시간 0
export function StateBand({ icon, title, note, testID }: { icon: LoungeIconName | null; title: string; note: string | null; testID: string }) {
  return (
    <View style={styles.band} accessibilityLiveRegion="polite" testID={testID}>
      {icon ? <LoungeIcon name={icon} size={20} color={colors.sub} /> : null}
      <View style={styles.flex}>
        <AppText variant="small" testID={`${testID}-title`}>
          {title}
        </AppText>
        {note ? (
          <AppText variant="caption" testID={`${testID}-note`}>
            {note}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

// ── 입력 줄 한 줄(4A): 쓸 수 없을 때 입력칸 · 보내기 자리에 아이콘 + 글 한 줄
export function ComposerLine({ icon, text, testID }: { icon: LoungeIconName | null; text: string; testID: string }) {
  return (
    <View style={styles.composerLine} testID={testID}>
      {icon ? <LoungeIcon name={icon} size={20} color={colors.sub} /> : null}
      <AppText variant="small" tone="sub" style={styles.flex} testID={`${testID}-text`}>
        {text}
      </AppText>
    </View>
  );
}

// ── 메뉴 줄(시트 안)
export function MenuRow({ label, icon, danger = false, onPress, testID }: { label: string; icon?: ReactNode; danger?: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} effect="none" style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]} testID={testID}>
      {icon}
      <AppText variant="bodyMedium" tone={danger ? 'accent' : 'text'} style={styles.flex}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ── 토스트 + 글자 버튼 하나(숨김 뒤 [다시 보기] — PL-24 되돌리기)
export function LoungeToast({ text, note, action, testID = 'lounge-toast' }: { text: string | null; note?: string | null; action?: { label: string; onPress: () => void } | null; testID?: string }) {
  if (!text) return null;
  return (
    <View style={styles.toastWrap} pointerEvents="box-none">
      <Rise key={text} distance={loungeLook.bubbleRise} duration={loungeLook.bubbleIn}>
        <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite" testID={testID}>
          <View style={styles.toastText}>
            <AppText variant="captionMedium" tone="inverse" testID={`${testID}-text`}>
              {text}
            </AppText>
            {note ? (
              <AppText variant="caption" tone="inverse" testID={`${testID}-note`}>
                {note}
              </AppText>
            ) : null}
          </View>
          {action ? (
            <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} effect="none" style={({ pressed }) => [styles.toastAction, pressed && styles.pressed]} testID={`${testID}-action`}>
              <AppText variant="captionBold" tone="inverse">
                {action.label}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </Rise>
    </View>
  );
}

// ── 데모 줄(데모 모드만 — 장면 바꾸기)
export function DemoLine({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} effect="none" style={({ pressed }) => [styles.demo, pressed && styles.pressed]} testID="lounge-demo-scene">
      <AppText variant="caption" tone="text">
        {text}
      </AppText>
    </Pressable>
  );
}

// ── 끝 화면(닫힘 · 나감 · 강퇴 · 들어갈 수 없음): 아이콘 · 제목 · 본문 · (버튼)
export function EndView({ icon, title, body, button, testID }: { icon: LoungeIconName; title: string | null; body: string; button?: { label: string; onPress: () => void } | null; testID: string }) {
  return (
    <View style={styles.end} testID={testID}>
      <LoungeIcon name={icon} size={40} color={colors.sub} />
      {title ? (
        <AppText variant="title" style={styles.center} accessibilityRole="header" testID={`${testID}-title`}>
          {title}
        </AppText>
      ) : null}
      <AppText variant="body" style={styles.center} testID={`${testID}-body`}>
        {body}
      </AppText>
      {button ? <Button label={button.label} variant="secondary" inline onPress={button.onPress} testID={`${testID}-button`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: alpha.pressed },
  head: { minHeight: size.header, flexDirection: 'row', alignItems: 'center', paddingLeft: space.s4, paddingRight: space.s4, gap: space.s4 },
  headGap: { width: space.s16 },
  headTitle: { flex: 1, justifyContent: 'center' },
  iconTouch: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  seatChip: { minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s8 },
  tag: { minHeight: loungeLook.tagHeight, justifyContent: 'center', paddingHorizontal: space.s8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  tagMine: { borderColor: colors.accent },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexWrap: 'wrap' },
  tagRowMine: { justifyContent: 'flex-end' },
  line: { flexDirection: 'row', paddingHorizontal: size.screenPadding },
  lineMine: { justifyContent: 'flex-end' },
  lineTheirs: { justifyContent: 'flex-start' },
  stack: { maxWidth: layout.bubbleMaxWidth + space.s32, gap: space.s4 },
  stackMine: { alignItems: 'flex-end' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: space.s16, paddingVertical: space.s12, gap: space.s8 },
  bubbleTheirs: { backgroundColor: colors.bubbleAi },
  bubbleMine: { backgroundColor: colors.accentAlt },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.accent, backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: space.s8, paddingVertical: space.s4, gap: space.s4 },
  quoteMine: { borderLeftColor: colors.accentSoft },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  metaMine: { justifyContent: 'flex-end' },
  pillTouch: { minHeight: loungeLook.touch, minWidth: loungeLook.touch, alignItems: 'center', justifyContent: 'center' },
  pill: { minHeight: loungeLook.pillHeight, flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  pillOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  captainWrap: { alignItems: 'center', paddingHorizontal: size.screenPadding },
  captain: { width: '100%', maxWidth: loungeLook.captainMaxWidth, backgroundColor: colors.bg, borderWidth: loungeLook.dash, borderStyle: 'dashed', borderColor: colors.sub, borderRadius: radius.md, padding: space.s16, gap: space.s12 },
  captainText: { gap: space.s4 },
  captainHead: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  options: { flexDirection: 'row', gap: space.s8 },
  option: { flex: 1, minHeight: loungeLook.touch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: space.s8, paddingVertical: space.s8 },
  optionMine: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  result: { gap: space.s4, backgroundColor: colors.card, borderRadius: radius.sm, padding: space.s8 },
  answer: { alignSelf: 'flex-start', minHeight: loungeLook.touch, flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  map: { alignItems: 'center', gap: space.s8, paddingVertical: space.s8 },
  mapCols: { height: loungeLook.tagHeight },
  mapCol: { position: 'absolute', textAlign: 'center' },
  mapMine: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  mapDot: { width: loungeLook.myDot + space.s4, height: loungeLook.myDot + space.s4, borderRadius: radius.pill, backgroundColor: colors.accent },
  art: { alignItems: 'center', paddingVertical: space.s16 },
  band: { flexDirection: 'row', alignItems: 'center', gap: space.s8, backgroundColor: colors.card, borderRadius: radius.md, marginHorizontal: size.screenPadding, marginBottom: space.s8, padding: space.s12 },
  composerLine: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.input + space.s16, paddingHorizontal: size.screenPadding, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  menuRow: { minHeight: size.listRow, flexDirection: 'row', alignItems: 'center', gap: space.s12, borderBottomWidth: 1, borderBottomColor: colors.line },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: size.input + space.s32, alignItems: 'center', paddingHorizontal: space.s20 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.s8, backgroundColor: colors.text, borderRadius: radius.pill, paddingLeft: space.s16, paddingRight: space.s8, minHeight: size.touchMin },
  toastAction: { minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s8 },
  toastText: { flexShrink: 1, paddingVertical: space.s8, gap: space.s4 },
  demo: { marginTop: space.s24, marginHorizontal: size.screenPadding, minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  end: { alignItems: 'center', gap: space.s12, paddingHorizontal: size.screenPadding, paddingTop: space.s48 },
});
