// 자리 표시 화면(F0). 화면 이름 · K2 ID · 다음 화면으로 가는 버튼만 보인다.
// 버튼은 navigation/flow.ts 의 화살표에서 읽는다. F1~F7이 화면 본문을 채우면 이 컴포넌트는 그 화면에서 빠진다.
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { arrowsFrom } from '@/navigation/flow';
import { destName, resolveDest, type NavTarget } from '@/navigation/resolve';
import { screenById, type ScreenId } from '@/navigation/screens';
import { chipProgress, nextStep, type SurveyStep } from '@/navigation/surveySteps';
import { size, space } from '@/theme/tokens';

import { Screen } from './Screen';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';

type Props = {
  id: ScreenId;
  surveyStep?: SurveyStep; // 04 설문일 때만: 지금 쪽
};

function Tag({ label }: { label: string }) {
  return <Chip label={label} variant="tag" />;
}

export function ScreenPlaceholder({ id, surveyStep }: Props) {
  const router = useRouter();
  const def = screenById(id);
  const ctx = { surveyStep, origin: id } as const;

  const rows = arrowsFrom(id)
    .filter((arrow) => !arrow.tab) // 탭 이동은 탭바가 한다
    .filter((arrow) => !(id === '04' && arrow.to === '05' && surveyStep && nextStep(surveyStep) !== null)) // 05는 마지막 쪽에서만
    .map((arrow, index) => ({ arrow, key: `${arrow.to}-${index}`, target: resolveDest(arrow.to, ctx) }));

  const go = (target: NavTarget) => {
    if (target.kind === 'href') router.push(target.href);
    else if (target.kind === 'back') {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  };

  const buttons = rows.filter((row) => row.target.kind !== 'none');
  const notes = rows.filter((row) => row.target.kind === 'none' && row.target.reason !== 'edge');

  const title = id === '04' && surveyStep ? `04-${surveyStep} ${def.name}` : `${def.id} ${def.name}`;
  const progress = id === '04' && surveyStep ? chipProgress(surveyStep) : null;

  return (
    <Screen edges={def.tabBar ? ['top'] : ['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} testID={`screen-${def.id}`}>
        <View style={styles.tags}>
          <Tag label={`K2 ${def.id}`} />
          {def.stateOf ? <Tag label={`${def.stateOf}의 상태`} /> : null}
        </View>

        <View style={styles.block}>
          <AppText variant="title">{title}</AppText>
          {progress ? (
            <AppText variant="caption">{`${progress.chip} · ${progress.index} / ${progress.total}`}</AppText>
          ) : null}
          <AppText variant="caption">{`K2 ${def.k2}`}</AppText>
          <AppText variant="caption">{`자리 표시 화면 · ${def.filledBy}에서 본문을 채워요`}</AppText>
        </View>

        {buttons.length > 0 ? (
          <View style={styles.block}>
            <AppText variant="bodyBold">다음 화면</AppText>
            {buttons.map((row, index) => (
              <View key={row.key} style={styles.item}>
                <Button
                  label={`→ ${destName(row.arrow.to, ctx)}`}
                  variant={index === 0 ? 'primary' : 'secondary'}
                  onPress={() => go(row.target)}
                  testID={`go-${row.arrow.to}`}
                />
                <AppText variant="caption">
                  {row.arrow.branch ? `분기 ${row.arrow.branch} · ${row.arrow.label}` : row.arrow.label}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {notes.length > 0 ? (
          <View style={styles.block}>
            <AppText variant="bodyBold">화면 안 동작과 분기(본문을 채울 때 붙여요)</AppText>
            {notes.map((row) => (
              <AppText key={row.key} variant="caption">
                {`· ${row.arrow.branch ? `분기 ${row.arrow.branch} · ` : ''}${row.arrow.label}`}
              </AppText>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: size.screenPadding,
    paddingTop: space.s24,
    paddingBottom: space.s32,
    gap: space.s24,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  block: { gap: space.s8 },
  item: { gap: space.s4 },
});
