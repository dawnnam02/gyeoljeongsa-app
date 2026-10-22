// [3] 안심 공유 — 만남 계획 시트(K12 2-3 · 3-D1 · 3-D3). 만남 계획을 문장으로 만들어 사용자가 직접 폰 공유창으로 지인에게 보낸다.
//  · 서버 저장 0 · 서버 호출 0 · 기록 0(3-01 · 3-08): 이 파일은 서버 연결(supabase · fetch)을 가져오지 않고 로그도 남기지 않는다
//  · 공유는 React Native 내장 Share 하나(새 패키지 없음). 웹은 navigator.share 가 없으면 [공유하기] 없이 [문장 복사]만
//  · 위치 권한 · 위치 · 지도 링크 없음(3-02). 장소는 사용자가 쓴 글자
//  · 칸: 날짜와 시간(선택) · 장소(선택, 60자) · 메모(선택, 40자) · '상대 정보 넣기'(처음값 꺼짐, D-74 ⑩ · 상대가 있을 때만) · 미리보기 · [공유하기] · [문장 복사]
//  · 칸이 비어 있어도 [공유하기]는 눌린다. 시트를 닫으면 입력은 사라지고 기기에 임시 저장도 하지 않는다
//  · 공유창을 못 열면 안내 글(NF3-06) — [문장 복사]는 늘 보인다. 예약 알림 · 도착 확인 없음(3-06)
//  · 진입 줄(11 ⋯ · 10 하단 · 12 안전 안내)과 스위치(safe_share) 확인은 2단계에 부모 화면이 한다
//  · 글은 키 자리(content/v4Wave01Copy.ts, 1단계 임시)
import { useState, type ReactNode } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { V4W01 } from '@/content/v4Wave01Copy';
import { colors, radius, size, space } from '@/theme/tokens';

import { buildShareText, SHARE_MEMO_MAX, SHARE_PLACE_MAX, SHARE_WHEN_MAX, type SharePartner } from './safeShareText';

export type ShareOutcome = 'shared' | 'dismissed' | 'failed';

// 운영체제 공유창(RN 내장 Share). 사용자가 닫아도 아무 일도 없다
export async function shareWithOs(text: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ message: text });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}

// 문장 복사(앱에 이미 있는 expo-clipboard). 모듈은 부를 때 불러 시험 환경에 네이티브 모듈이 없어도 화면 파일을 읽을 수 있게 한다
export async function copyText(text: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

// 공유창을 열 수 있나: 앱은 늘, 웹은 navigator.share 가 있을 때만(값은 시험에서 바꿔 넣는다)
export function osShareAvailable(os: string = Platform.OS, nav: { share?: unknown } | undefined = (globalThis as { navigator?: { share?: unknown } }).navigator): boolean {
  if (os !== 'web') return true;
  return typeof nav?.share === 'function';
}

type Props = {
  visible: boolean;
  partner: SharePartner | null; // 연결된 상대의 '성OO' · 나이(11 행과 같은 값). 12 안전 안내에서 열면 null(상대 정보 줄 없음)
  onClose: () => void;
  share?: (text: string) => Promise<ShareOutcome>; // 시험에서 바꿔 넣는다
  copy?: (text: string) => Promise<boolean>;
  canShare?: boolean;
  testID?: string;
};

export function SafeShareSheet({ visible, partner, onClose, share = shareWithOs, copy = copyText, canShare = osShareAvailable(), testID = 'share-sheet' }: Props) {
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState('');
  const [memo, setMemo] = useState('');
  const [includePartner, setIncludePartner] = useState(false); // 처음값 꺼짐(D-74 ⑩)
  const [status, setStatus] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);

  const clear = () => {
    setWhen('');
    setPlace('');
    setMemo('');
    setIncludePartner(false);
    setStatus(null);
  };
  // 열릴 때마다 빈 칸 · 꺼짐에서 시작한다(렌더 중 비교, effect 없이)
  const [shown, setShown] = useState(visible);
  if (visible !== shown) {
    setShown(visible);
    if (visible) clear();
  }
  const close = () => {
    clear();
    onClose();
  };

  const text = buildShareText({ when, place, memo, includePartner, partner });
  const id = (part: string) => `${testID}-${part}`;

  const onShare = async () => {
    setStatus(null);
    const outcome = await share(text);
    if (outcome === 'failed') setStatus(V4W01.share.shareFailed);
  };
  const onCopy = async () => {
    setStatus((await copy(text)) ? V4W01.share.copied : V4W01.share.shareFailed);
  };

  return (
    <BottomSheet visible={visible} onClose={close} testID={testID}>
      <View style={styles.head}>
        <AppText variant="bodyBold" accessibilityRole="header" testID={id('title')}>
          {V4W01.share.title}
        </AppText>
        <AppText variant="caption" testID={id('notice')}>
          {V4W01.share.notice}
        </AppText>
      </View>

      <Field label={V4W01.share.whenLabel}>
        <TextField label={V4W01.share.whenLabel} value={when} onChangeText={setWhen} placeholder={V4W01.share.whenPlaceholder} maxLength={SHARE_WHEN_MAX} testID={id('when')} />
      </Field>
      <Field label={V4W01.share.placeLabel}>
        <TextField label={V4W01.share.placeLabel} value={place} onChangeText={setPlace} placeholder={V4W01.share.placePlaceholder} maxLength={SHARE_PLACE_MAX} testID={id('place')} />
      </Field>
      <Field label={V4W01.share.memoLabel}>
        <TextField label={V4W01.share.memoLabel} value={memo} onChangeText={setMemo} placeholder={V4W01.share.memoPlaceholder} maxLength={SHARE_MEMO_MAX} testID={id('memo')} />
      </Field>

      {partner ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`${V4W01.share.partnerLabel}, ${V4W01.share.partnerNote}`}
          accessibilityState={{ checked: includePartner }}
          aria-checked={includePartner}
          onPress={() => setIncludePartner((v) => !v)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          effect="none"
          style={styles.switchRow}
          testID={id('partner')}>
          <View style={styles.flex}>
            <AppText variant="body">{V4W01.share.partnerLabel}</AppText>
            <AppText variant="caption">{V4W01.share.partnerNote}</AppText>
          </View>
          <Toggle on={includePartner} pressed={pressed} testID={id('partner-toggle')} />
        </Pressable>
      ) : null}

      <View style={styles.preview} accessible accessibilityLabel={`${V4W01.share.previewLabel}, ${text}`} testID={id('preview-box')}>
        <AppText variant="captionMedium" tone="sub">
          {V4W01.share.previewLabel}
        </AppText>
        <AppText variant="body" testID={id('preview')}>
          {text}
        </AppText>
      </View>

      {status ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={id('status')}>
          {status}
        </AppText>
      ) : null}
      {canShare ? <Button label={V4W01.share.shareButton} onPress={() => void onShare()} testID={id('share')} /> : null}
      <Button label={V4W01.share.copyButton} variant={canShare ? 'secondary' : 'primary'} onPress={() => void onCopy()} testID={id('copy')} />
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText variant="captionMedium" tone="sub" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {label}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.s4 },
  field: { gap: space.s4 },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.listRow, paddingVertical: space.s8 },
  preview: { gap: space.s4, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s16 },
});
