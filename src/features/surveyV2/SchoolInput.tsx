// 검색 · 자동완성 선택(B02 · B05 · D08 · D09, 설문_v2 0장 '검색 · 자동완성 선택 화면' · M14 3장 · D35 학벌 줄).
//  · 입력 2자부터 목록(F20 세부청사진 2). 초성 · 줄임말 · 옛 이름 · 통합 전 이름 · 오타 1글자 · 학점은행 · 독학사 행도 찾는다(src/data/schools/schoolSearch)
//  · 결과 줄: 학교 이름(옛 이름 · 통합 전 학교는 '→ 지금 이름') + 둘째 줄 종류 · 옛 이름으로 찾았으면 '(옛 이름 ○○)'. 최대 8줄. 학교 수준은 보이지도 쓰지도 않는다
//  · 목록 밖 보기는 결과 아래에 늘 보인다(본인: 목록에 없는 국내 · 해외 학교 / B05 학부를 마치지 않았어요 / 부모님: 전문대학 · 대학교 · 대학원 · 해외 · 대학에 다니지 않으셨어요 · 잘 몰라요 · 말하고 싶지 않아요)
//  · 고른 뒤: 한 장으로 접히고 [바꾸기] · 상태: 기본 · 입력 중 · 결과 없음 · 고름 · 불러오는 중
//  · 검색어는 로그 · 서버로 보내지 않는다(데모는 같은 기기 안 모의 서버)
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Pressable } from '@/components/Pressable';
import { Ring } from '@/components/Ring';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { Icon } from '@/components/Icon';
import { schoolIndex, normalize, type SchoolCourse } from '@/data/schools/schoolSearch';
import { haptic } from '@/motion';
import { layout } from '@/theme/layout';
import { colors, radius, size, space } from '@/theme/tokens';

import type { SchoolResult, SearchOutcome } from './api';
import { SV2 } from './copy';
import { copyOf, optText, SCHOOL_MIN_CHARS, type Draft } from './model';
import { OptionRow } from './parts';
import type { QuestionDef } from './types';

type SchoolDraft = Extract<Draft, { kind: 'school' }>;
type Props = {
  q: QuestionDef;
  draft: SchoolDraft;
  onChange: (d: Draft) => void;
  search: (query: string, courses: readonly SchoolCourse[] | undefined) => Promise<SearchOutcome>;
};

const SEARCH_DELAY_MS = 120; // 치는 동안은 기다렸다가 멈추면 찾는다
const LIMIT = 8;

// 문항별 과정 거르기(M14 3장 '거르기'): B05 학부 = 대학교만, 본인 학교는 고졸 보기 행을 빼고, 부모님은 모두
export const coursesFor = (id: string): readonly SchoolCourse[] | undefined => (id === 'B05' ? ['U'] : id === 'B02' ? ['U', 'C', 'G'] : undefined);

export function schoolLabel(key: string): string | null {
  const row = schoolIndex().byKey(key);
  if (!row) return null;
  return row.now && row.now !== row.name ? `${row.name} → ${row.now}` : row.name;
}

export function SchoolInput({ q, draft, onChange, search }: Props) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<readonly SchoolResult[]>([]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = (part: string) => `v2-${q.id}-${part}`;
  const ready = normalize(query).length >= SCHOOL_MIN_CHARS;

  useEffect(
    () => () => {
      seq.current += 1; // 화면을 떠나면 늦게 온 결과를 버린다
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // 칠 때마다: 2자 전이면 목록을 닫고, 아니면 잠깐 기다렸다가 찾는다(더 친 글이 있으면 앞 결과는 버린다)
  const type = (text: string) => {
    setQuery(text);
    const mine = ++seq.current;
    if (timer.current) clearTimeout(timer.current);
    if (normalize(text).length < SCHOOL_MIN_CHARS) {
      setRows([]);
      setPhase('idle');
      return;
    }
    setPhase('loading');
    timer.current = setTimeout(() => {
      void search(text, coursesFor(q.id)).then((r) => {
        if (mine !== seq.current) return;
        setRows(r.ok ? r.rows.slice(0, LIMIT) : []);
        setPhase(r.ok ? 'done' : 'error');
      });
    }, SEARCH_DELAY_MS);
  };

  const pick = draft.pick;
  if (pick) {
    const label = 'key' in pick ? schoolLabel(pick.key) ?? pick.key : optText(q.id, pick.code);
    return (
      <View style={styles.picked} testID={id('picked')}>
        <Icon name="check" size={layout.headerIcon} color={colors.accent} />
        <AppText variant="bodyMedium" style={styles.grow} testID={id('picked-name')}>
          {label}
        </AppText>
        <TextButton
          label={SV2.search.change}
          variant="captionMedium"
          onPress={() => {
            type('');
            onChange({ kind: 'school', pick: null });
          }}
          testID={id('change')}
        />
      </View>
    );
  }

  const choose = (r: SchoolResult) => {
    haptic.selection();
    if (r.school_key === 'no_college' && q.codes.includes('no_college')) onChange({ kind: 'school', pick: { code: 'no_college' } });
    else onChange({ kind: 'school', pick: { key: r.school_key } });
  };

  return (
    <View style={styles.wrap}>
      <TextField label={copyLabel(q)} placeholder={SV2.search.placeholder} value={query} onChangeText={type} autoCorrect={false} autoCapitalize="none" returnKeyType="search" testID={id('search')} />
      {phase === 'loading' ? (
        <View style={styles.loading} testID={id('loading')}>
          <Ring size={layout.splashRing} stroke={layout.splashRingStroke} testID={id('loading-ring')} />
          <AppText variant="caption">{SV2.loading}</AppText>
        </View>
      ) : null}
      {ready && phase !== 'loading' && rows.length > 0 ? (
        <View style={styles.results} accessibilityRole="list" testID={id('results')}>
          {rows.map((r, i) => (
            <Pressable key={r.school_key} accessibilityLabel={r.now_name !== r.name ? `${r.name} → ${r.now_name}` : r.name} effect="scale" onPress={() => choose(r)} testID={id(`hit-${i}`)} style={[styles.hit, i > 0 ? styles.hitLine : null]}>
              <AppText variant="bodyMedium" tone="text" testID={id(`hit-${i}-name`)}>
                {r.now_name !== r.name ? `${r.name} → ${r.now_name}` : r.name}
              </AppText>
              <AppText variant="caption" testID={id(`hit-${i}-sub`)}>
                {r.via === 'old' ? `${r.kind} ${SV2.search.oldName(r.matched)}` : r.kind}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {ready && (phase === 'done' || phase === 'error') && rows.length === 0 ? (
        <AppText variant="caption" tone="text" testID={id('empty')}>
          {SV2.search.empty}
        </AppText>
      ) : null}
      <View style={styles.outside} testID={id('outside')}>
        {q.codes.map((code) => (
          <OptionRow key={code} label={optText(q.id, code)} selected={false} dense onPress={() => onChange({ kind: 'school', pick: { code } })} testID={id(`opt-${code}`)} />
        ))}
      </View>
    </View>
  );
}

const copyLabel = (q: QuestionDef) => copyOf(q.id)?.q ?? SV2.search.placeholder; // 스크린리더 칸 이름 = 질문

const styles = StyleSheet.create({
  wrap: { gap: space.s8, alignSelf: 'stretch' },
  grow: { flex: 1, minWidth: 0 },
  picked: {
    minHeight: size.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s8,
    paddingLeft: space.s16,
    paddingRight: space.s4,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: layout.inputBorderActive,
    borderColor: colors.accent,
  },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touchMin },
  results: { borderRadius: radius.md, backgroundColor: colors.card, overflow: 'hidden' },
  hit: { minHeight: size.listRow, justifyContent: 'center', paddingHorizontal: space.s16, paddingVertical: space.s8, gap: space.s4 },
  hitLine: { borderTopWidth: 1, borderTopColor: colors.line },
  outside: { gap: space.s8, marginTop: space.s8 },
});
