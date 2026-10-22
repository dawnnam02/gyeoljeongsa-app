// 07 '나를 나타내는 말' 칩 영역. 세 가지 모양:
//  보기(TagList)     : 태그 칩(#글)을 그냥 보인다
//  수정(TagEditor)   : 칩마다 ×로 지우고, [말 더하기]로 직접 쓴 말을 더한다(최대 5개 · 2~8자 · 중복 불가 · 전화번호 · 링크 불가, N14)
//  직접 입력(TagPicker): 후보 목록에서 1~5개를 고른다
// 칩 글은 AI가 만들고 '#'은 화면이 붙인다.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { TRAITS } from '@/content/copy';
import { space } from '@/theme/tokens';

import { checkNewTag, removeTag, TAG_MAX_COUNT, TAG_MAX_LEN, toggleCandidate } from './traitsLogic';

export function TagList({ tags }: { tags: readonly string[] }) {
  return (
    <View style={styles.wrap} testID="traits-tags">
      {tags.map((tag) => (
        <Chip key={tag} label={`#${tag}`} variant="tag" />
      ))}
    </View>
  );
}

type EditorProps = { tags: readonly string[]; onChange: (tags: string[]) => void };

export function TagEditor({ tags, onChange }: EditorProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = checkNewTag(text, tags);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onChange([...tags, result.tag]);
    setText('');
    setError(null);
    setAdding(tags.length + 1 < TAG_MAX_COUNT);
  };

  return (
    <View style={styles.block}>
      <View style={styles.wrap} testID="traits-tags-edit">
        {tags.map((tag) => (
          <Chip
            key={tag}
            label={`#${tag} ×`}
            variant="selected"
            accessibilityLabel={TRAITS.removeTag(tag)}
            onPress={() => onChange(removeTag(tags, tag))}
            testID={`tag-remove-${tag}`}
          />
        ))}
      </View>
      <AppText variant="caption" testID="traits-tag-count">
        {TRAITS.tagCount(tags.length, TAG_MAX_COUNT)}
      </AppText>
      {tags.length < TAG_MAX_COUNT ? (
        adding ? (
          <View style={styles.addRow}>
            <View style={styles.addField}>
              <TextField
                label={TRAITS.addTagLabel}
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  setError(null);
                }}
                placeholder={TRAITS.addTagPlaceholder}
                maxLength={TAG_MAX_LEN + 1}
                returnKeyType="done"
                onSubmitEditing={submit}
                error={error}
                testID="tag-input"
              />
            </View>
            <TextButton label={TRAITS.addTagDone} onPress={submit} testID="tag-add-done" />
          </View>
        ) : (
          <TextButton label={TRAITS.addTag} align="start" onPress={() => setAdding(true)} testID="tag-add" />
        )
      ) : null}
    </View>
  );
}

type PickerProps = { candidates: readonly string[]; selected: readonly string[]; onChange: (tags: string[]) => void };

export function TagPicker({ candidates, selected, onChange }: PickerProps) {
  return (
    <View style={styles.block}>
      <AppText variant="caption">{`${TRAITS.manualTagsHint} ${TRAITS.tagCount(selected.length, TAG_MAX_COUNT)}`}</AppText>
      <View style={styles.wrap} testID="traits-tag-picker">
        {candidates.map((tag) => (
          <Chip key={tag} label={`#${tag}`} variant={selected.includes(tag) ? 'selected' : 'inactive'} onPress={() => onChange(toggleCandidate(selected, tag))} testID={`tag-pick-${tag}`} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.s8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
  addField: { flex: 1 },
});
