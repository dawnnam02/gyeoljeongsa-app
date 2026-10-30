// IF-TYPE 내 여행 타입(F-19 · 정책 PF-31 ~ PF-33 · 카피 21-5 · 계산명세 10-1) — 짐 싸기 7문항(기기에만) → 엽서 앞(타입 소재 + 고른 짐 · 이름 · 앞면 한 줄) · [뒷면 보기] → 뒤(설명 세 줄 · 끝줄) · 노선도(내 역 + 대화가 편하게 이어지는 타입 두 역, 역마다 까닭).
//  · 타입은 성향 정리 결과(계산명세 10-1) · 등급 입력 0 · 짝 타입 0 · 우열 · 희귀 · 퍼센트 · 진행 숫자 0 · 공유 단추는 그리지 않음(type_card_share 꺼짐 · 신고번호 뒤)
//  · 이름 · 앞면 한 줄 · 설명 · 역 까닭 · 짐 문항 글은 라이브러리 원본(content/if2Library.json ← ai/IF2/문구_라이브러리.json), 그림은 디자인 타입소재 33개(if2art.json types · items) — 대화 팁은 1.1이라 그리지 않는다(TYPE_CARD.tip)
//  · 고른 짐은 엽서 앞면 소품 그림에만 들어간다: 기기에만(deviceNotes typeBag) · 서버 0 · 성향 · 타입 · 매칭 계산 0. 짐을 아직 안 쌌으면 짐 싸기부터(그때 처음 엽서가 나온다)
//  · 서버 타입 계산이 아직 없다(백엔드 11-5) → 실서버 = 타입 없음(이 화면에 오면 불러오지 못함 한 줄) · 데모는 fun_calc 와 같은 값
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import art from '../../../assets/illustrations/if2art.json';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { if2Look } from '@/theme/if2Look';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { deviceNotes, useDeviceNotes, type DeviceNotes } from './deviceNotes';
import { Art, artXml, Footnote, if2Styles } from './If2Parts';
import { isPacked, PACK_COUNT, PACK_QUIZ, packedItems, packItemLabel, travelTypeOf, type TravelTypeLib } from './if2Library';
import { tx, txSeq } from './if2Text';
import { inflightServices, type TypeSource } from './inflightService';

// 엽서 앞면 칸(320 × 200)에 소품을 놓는 자리 — 디자인 타입소재 목록 '엽서 앞면에 올려 본 모습': 가운데 타입 소재 하나 · 왼쪽 셋 · 오른쪽 셋 · 아래 가운데 하나(문항 차례)
const SLOTS: readonly { left: `${number}%`; top: `${number}%` }[] = [
  { left: '5.6%', top: '8%' },
  { left: '5.6%', top: '40%' },
  { left: '5.6%', top: '72%' },
  { left: '81.9%', top: '8%' },
  { left: '81.9%', top: '40%' },
  { left: '81.9%', top: '72%' },
  { left: '43.75%', top: '75%' },
];
const TYPES = art.types as Readonly<Record<string, string>>;
const ITEMS = art.items as Readonly<Record<string, string>>;

// 엽서 앞면 그림: 하늘 띠 바탕 + 타입 소재(가운데 38.75%) + 고른 짐(둘레 12.5% 한 칸씩) — 글자 0(이름은 앱 글)
export function Postcard({ type, items, testID = 'type-postcard' }: { type: TravelTypeLib; items: readonly (string | null)[]; testID?: string }) {
  return (
    <View style={styles.pcard} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <SvgXml xml={art.typeSky} width="100%" height="100%" style={styles.fill} />
      <View style={styles.ty} testID={`${testID}-type`}>
        <SvgXml xml={TYPES[type.code] ?? ''} width="100%" height="100%" />
      </View>
      {items.map((code, i) =>
        code && ITEMS[code] ? (
          <View key={`${i}-${code}`} style={[styles.it, SLOTS[i]]} testID={`${testID}-item-${code}`}>
            <SvgXml xml={ITEMS[code]} width="100%" height="100%" />
          </View>
        ) : null,
      )}
    </View>
  );
}

// 짐 싸기: 질문마다 가방에 소품 하나 · 진행 숫자 0 · 안내에 '고른 짐은 엽서 그림에만 들어가요' 한 줄 · [나중에 하기] 같은 크기
function PackQuiz({ notes, onLater }: { notes: DeviceNotes; onLater: () => void }) {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const q = PACK_QUIZ[step];
  const chosen = picks.map((p) => packItemLabel(p) ?? '').filter(Boolean);
  const choose = (item: string) => {
    const next = [...picks.slice(0, step), item];
    setError(false);
    if (step < PACK_COUNT - 1) {
      setPicks(next);
      setStep(step + 1);
      return;
    }
    try {
      notes.set('typeBag', next); // 기기에만 — 서버 0
      AccessibilityInfo.announceForAccessibility?.(tx('TYPE_CARD.quiz.done'));
    } catch {
      setError(true);
    }
  };
  if (!q) return null;
  return (
    <View style={if2Styles.gap} testID="type-quiz">
      <Art xml={artXml('suitcase')} width="100%" height={styles.bag.height} />
      {step === 0 ? (
        <AppText variant="body" testID="type-quiz-intro">
          {tx('TYPE_CARD.quiz.intro')}
        </AppText>
      ) : null}
      <AppText variant="caption" testID="type-quiz-note">
        {tx('TYPE_CARD.quiz.picksNote')}
      </AppText>
      {chosen.length > 0 ? (
        <View style={styles.bagRow} accessible accessibilityLabel={tx('TYPE_CARD.a11y.bag', { '짐 이름 차례': chosen.join(', ') })} testID="type-quiz-bag">
          {picks.map((code) => (
            <View key={code} style={styles.bagItem} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <SvgXml xml={ITEMS[code] ?? ''} width="100%" height="100%" />
            </View>
          ))}
        </View>
      ) : null}
      <AppText variant="title" accessibilityRole="header" testID="type-quiz-question">
        {q.q}
      </AppText>
      <View style={if2Styles.gapSmall}>
        {q.options.map((o) => (
          <Pressable
            key={o.item}
            accessibilityRole="radio"
            accessibilityState={{ checked: picks[step] === o.item }}
            aria-checked={picks[step] === o.item}
            accessibilityLabel={tx('TYPE_CARD.a11y.choice', { 답: o.label })}
            onPress={() => choose(o.item)}
            effect="scale"
            style={({ pressed }) => [styles.pick, pressed && styles.pressed]}
            testID={`type-quiz-${step}-${o.item}`}>
            <AppText variant="body">{o.label}</AppText>
          </Pressable>
        ))}
      </View>
      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="type-quiz-error">
          {tx('TYPE_CARD.quiz.saveFailed')}
        </AppText>
      ) : null}
      <Button label={tx('TYPE_CARD.quiz.later')} variant="secondary" onPress={onLater} testID="type-quiz-later" />
    </View>
  );
}

export function TypeCardScreen({ source, notes }: { source?: TypeSource; notes?: DeviceNotes }) {
  const router = useRouter();
  const src = source ?? inflightServices().type;
  const store = notes ?? deviceNotes();
  const bag = useDeviceNotes(store).typeBag;
  const [loaded, setLoaded] = useState(store.ready());
  const [typeId, setTypeId] = useState<string | null | 'loading'>('loading');
  const [side, setSide] = useState<'front' | 'back'>('front');
  useEffect(() => {
    void src.mine().then(setTypeId);
  }, [src]);
  useEffect(() => {
    let alive = true;
    void store.load().then(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [store]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));
  const type = typeId === 'loading' ? null : travelTypeOf(typeId);
  const wait = typeId === 'loading' || !loaded;
  const packed = isPacked(bag);
  const items = packedItems(bag);
  const itemNames = items.map((c) => (c ? packItemLabel(c) : null)).filter((x): x is string => !!x);

  let body = null;
  if (!wait && !type) {
    body = (
      <AppText variant="body" tone="sub" testID="type-none">
        {tx('TYPE_CARD.loadFailed')}
      </AppText>
    );
  } else if (!wait && type && !packed) {
    body = <PackQuiz notes={store} onLater={back} />;
  } else if (!wait && type) {
    const routes = type.routes.map((r) => ({ type: travelTypeOf(r.to), why: r.why })).filter((r): r is { type: TravelTypeLib; why: string } => !!r.type);
    body =
      side === 'front' ? (
        <View style={if2Styles.gap} testID="type-front" accessible accessibilityLabel={tx('TYPE_CARD.a11y.front', { '타입 이름': type.name, '한 줄 소개': type.line, '소품 이름': itemNames.join(', ') })}>
          <Postcard type={type} items={items} />
          <AppText variant="caption">{tx('TYPE_CARD.result.kicker')}</AppText>
          <AppText variant="heading" testID="type-name">
            {tx('TYPE_CARD.result.name', { '타입 이름': type.name })}
          </AppText>
          <AppText variant="body" testID="type-line">
            {tx('TYPE_CARD.result.line', { '한 줄 소개': type.line })}
          </AppText>
        </View>
      ) : (
        <View style={if2Styles.gap} testID="type-back">
          <View style={styles.card} accessible accessibilityLabel={tx('TYPE_CARD.a11y.back', { 설명: type.desc.join(' ') })}>
            {type.desc.map((l) => (
              <AppText key={l} variant="body">
                {l}
              </AppText>
            ))}
            <Art xml={artXml('postmark')} width={if2Look.stampW} height={if2Look.stampW} />
          </View>
          <View
            style={if2Styles.section}
            testID="type-route"
            accessible
            accessibilityLabel={txSeq('TYPE_CARD.a11y.route', { '타입 이름': routes.map((r) => r.type.name), '역 까닭': routes.map((r) => r.why) })}>
            <AppText variant="bodyBold">{tx('TYPE_CARD.route.title')}</AppText>
            <Art xml={artXml('metro')} width="100%" height={styles.metro.height} />
            <View style={if2Styles.gapSmall} testID="type-route-mine">
              <AppText variant="captionMedium" tone="accent">
                {tx('TYPE_CARD.route.mine')}
              </AppText>
              <AppText variant="bodyMedium">{type.name}</AppText>
            </View>
            {routes.map((r, i) => (
              <View key={r.type.id} style={if2Styles.gapSmall} testID={`type-route-${i}`}>
                <AppText variant="bodyMedium" testID={`type-route-${i}-name`}>
                  {r.type.name}
                </AppText>
                <AppText variant="body" testID={`type-route-${i}-why`}>
                  {tx('TYPE_CARD.route.why', { '역 까닭': r.why })}
                </AppText>
              </View>
            ))}
          </View>
          <Footnote text={tx('TYPE_CARD.footer')} testID="type-footer" />
        </View>
      );
  }

  return (
    <Screen edges={['top']} testID="screen-type">
      <ScreenHeader title={wait || !type || packed ? tx('TYPE_CARD.result.kicker') : tx('TYPE_CARD.quiz.title')} onBack={back} testID="type-header" />
      <ScrollView contentContainerStyle={styles.body}>
        {body}
        {!wait && type && packed ? <Button label={side === 'front' ? tx('TYPE_CARD.result.flip') : tx('TYPE_CARD.result.flipBack')} variant="secondary" onPress={() => setSide(side === 'front' ? 'back' : 'front')} testID="type-flip" /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, gap: space.s16 },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8, overflow: 'hidden' },
  metro: { height: 28 },
  bag: { height: 120 },
  pcard: { width: '100%', aspectRatio: 320 / 200, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  ty: { position: 'absolute', left: '30.6%', top: '8%', width: '38.75%', aspectRatio: 1 }, // 타입 소재: 디자인 타입소재 목록 배치 그대로(칸 폭 320 의 38.75% = 124px · 위에서 8%)
  it: { position: 'absolute', width: '12.5%', aspectRatio: 1 }, // 짐 소품: 12.5% = 40px
  bagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  bagItem: { width: 40, height: 40 },
  pick: { minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s16, paddingVertical: space.s12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  pressed: { opacity: alpha.pressed },
});
