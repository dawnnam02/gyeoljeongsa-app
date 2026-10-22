// 머리 오른쪽 위 원형 프로필 버튼(F11, 가이드 11-1 · 화면_요구사항 R15 · 2-5 T2). 누르면 08 내 프로필.
//  · 원 지름 32(size.avatar) · 터치 44 × 44(size.avatarTouch), 원이 터치 영역 가운데. 접근성 이름 "내 프로필" · 역할 버튼
//  · 눌림: 요소 전체 × 85%(alpha.pressed). scale · ripple 없음(가이드 10-3)
//  · 사진 있음 = 내 얼굴 정면 사진을 원으로 자름 / 없음 = 기본 프로필 그림(components/ProfileAvatar). 사진 주소는 store/myFaceStore 에서 한 번만 읽는다
//  · 나오는 화면: 09 · 11 · 12 · 13 · 14 · 16. 08 · 10 · ‹ 머리 하위 화면에는 두지 않는다
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { A11Y } from '@/content/copy';
import { profileApi } from '@/lib/services';
import { resolveDest } from '@/navigation/resolve';
import { refreshMyFace, useMyFaceStore } from '@/store/myFaceStore';
import { alpha, size } from '@/theme/tokens';

import { Pressable } from './Pressable';
import { ProfileAvatar } from './ProfileAvatar';

export function ProfileButton({ testID = 'profile-button' }: { testID?: string }) {
  const router = useRouter();
  const uri = useMyFaceStore((s) => s.uri);
  const checkedAt = useMyFaceStore((s) => s.checkedAt);

  // 처음 그릴 때와 저장된 주소가 비워졌을 때(08 을 떠남 · 로그아웃) 다시 읽는다. 4분 안이면 읽지 않는다
  useEffect(() => {
    void refreshMyFace(profileApi);
  }, [checkedAt]);

  const open = () => {
    const next = resolveDest('08');
    if (next.kind === 'href') router.push(next.href);
  };

  return (
    <Pressable
      accessibilityLabel={A11Y.myProfile}
      accessibilityRole="button"
      onPress={open}
      effect="none"
      testID={testID}
      style={({ pressed }) => [styles.touch, pressed ? styles.pressed : null]}>
      <ProfileAvatar uri={uri} width={size.avatar} testID={`${testID}-avatar`} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { width: size.avatarTouch, height: size.avatarTouch, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: alpha.pressed },
});
