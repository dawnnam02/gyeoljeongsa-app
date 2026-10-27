// 16-G 내 등급 — v5 들어오는 곳(D-200 ② · 정책 P3-10 · 화면_요구사항 12-1 · 16-G): 12 설정 '내 등급' 줄로 연다(QP-12 해결 자리).
//  본문은 상점 안 쪽과 같은 GradePages(아이콘 하나 · 같은 무리 설명 · 계산 방법 · 설명 요청 · 멈추기 안내, 숫자 · 막대 · 순서 0)를 그대로 쓴다.
//  상점(v4_shop)이 꺼져 있어도 열린다 — 탭 위 화면(탭바 없음), 안의 쪽(변화 기록 · 도움이 되는 일 · 어떻게 정해지나요)은 이 화면 안에서 오간다.
//  3부-사: 서버 0039 get_my_grade v5 — 모든 회원이 자기 풍경 키(grade_icon) 하나를 받는다(P3-04 · 검수 Q9-N2 해결). 숫자 0
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Toast } from '@/components/Toast';
import { GRADE16 } from '@/content/shopCopy';
import { TOAST_MS } from '@/motion';
import { SubPage } from '@/features/settings/SettingsParts';
import type { ShopDeps, ShopNav, ShopPage } from '@/features/shop/shopTypes';
import { goBackOr } from '@/navigation/go';

import { AccessSheet } from './AccessSheet';
import { GoalBody, GradeBody, HistoryBody, HowBody } from './GradePages';

type GradePageName = 'grade' | 'grade-history' | 'grade-goal' | 'grade-how';
const TITLES: Record<GradePageName, string> = { grade: GRADE16.title, 'grade-history': GRADE16.historyTitle, 'grade-goal': GRADE16.goalTitle, 'grade-how': GRADE16.howTitle };
const isGradePage = (p: ShopPage): p is { name: GradePageName } => p.name === 'grade' || p.name === 'grade-history' || p.name === 'grade-goal' || p.name === 'grade-how';

export type MyGradeDeps = Pick<ShopDeps, 'grade' | 'now'>;

export function MyGradeScreen({ deps }: { deps: MyGradeDeps }) {
  const router = useRouter();
  const [stack, setStack] = useState<GradePageName[]>(['grade']);
  const [accessOpen, setAccessOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const page = stack[stack.length - 1];

  const leave = () => goBackOr(router, '/settings');
  const back = () => (stack.length > 1 ? setStack((s) => s.slice(0, -1)) : leave());
  const nav: ShopNav = {
    push: (p) => {
      if (isGradePage(p)) setStack((s) => [...s, p.name]); // 상품 · 구독 쪽으로 가는 길은 v5에 없다
    },
    back,
    toList: () => setStack(['grade']),
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  });

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), TOAST_MS);
  };

  const body =
    page === 'grade' ? (
      <GradeBody shop={null} deps={deps} nav={nav} onAccess={() => setAccessOpen(true)} />
    ) : page === 'grade-history' ? (
      <HistoryBody deps={deps} />
    ) : page === 'grade-goal' ? (
      <GoalBody deps={deps} />
    ) : (
      <HowBody />
    );

  return (
    <Screen edges={['top']} testID={`my-grade-${page}`}>
      {/* 3부-사(검수 Q9-N3): 쪽이 오른쪽에서 들어오는 움직임(SubPage Rise x)이 이 화면에서는 탭 틀 밖이라 잠깐 화면 폭을 넘어,
          웹(모바일 폭)에서 문서가 16px 넓어진 채 남았다 — 설정 안 쪽처럼 틀 안에서만 움직이게 가로를 자른다 */}
      <View style={styles.clip} testID="my-grade-clip">
        <SubPage title={TITLES[page]} onBack={back} testID="my-grade">
          {body}
        </SubPage>
      </View>
      <AccessSheet visible={accessOpen} deps={deps} onClose={() => setAccessOpen(false)} onToast={showToast} />
      <Toast text={toast} testID="my-grade-toast" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
});
