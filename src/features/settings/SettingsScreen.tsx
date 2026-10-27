// 화면 ID 12 설정(K2 4장 12 · 카피.md 12 · Figma 12 3:473 · 12b 201:36 · 12c~12q).
//  목록: 알림 · 공개 범위 · 희망 조건 수정 · 인증 서류 제출(준비 중) · 차단 목록 · 신고 내역 · 보안 · 고객센터 · 동의 관리 · 이용약관 · 개인정보 처리방침 · 안전 안내
//        · 정보(오픈소스 라이선스 · 이미지 출처 고지) · [로그아웃] · [탈퇴하기]
//  하위 화면은 12 안의 쪽이다(화면 12개 · 라우트 15개 그대로, K2 머리말). 탭바는 그대로 보이고 ‹ · Android 뒤로가기는 목록으로 돌아온다. 탭을 떠나면 목록으로 돌아간다.
//  공개 범위 → 08 내 프로필 · 희망 조건 수정 → 04-25 '희망 조건 수정' 상태(12 로 돌아옴) · 이용약관 · 처리방침 → 03 과 같은 읽기 시트
//  로그아웃: 확인창 없이 이 기기의 로그인 정보와 임시 저장을 지우고 01. 탈퇴: WithdrawFlow(확인창 → 인증번호 재확인 → 확정 → 01)
//  표시하지 않는 것: 진행 단계 · 내부 평가값 · 매칭 숫자
//  v5(QP-A, 카피.md 12-Q): '크레딧 · 구매 내역' 줄(→ T5) · 등급 스위치는 '등급 계산 멈추기' 하나 · 정보 묶음 '사업자 정보'(값 6개가 모두 있을 때만)
//        · 목록 맨 아래 '국내결혼중개업 신고번호 …' 한 줄(값이 있을 때만). 값은 content/businessInfo.ts 한 곳(지금은 비어 있어 둘 다 안 보인다)
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { TOAST_MS, useCollapsingTitle } from '@/motion';
import { Screen } from '@/components/Screen';
import { TabHeader } from '@/components/TabHeader';
import { TextButton } from '@/components/TextButton';
import { Toast } from '@/components/Toast';
import { AppText } from '@/components/AppText';
import { BUSINESS_INFO, businessLinks, businessRows, reportNoLine, type BusinessInfo } from '@/content/businessInfo';
import { SETTINGS } from '@/content/settingsCopy';
import { LegalReader } from '@/features/consent/LegalReader';
import type { GradeApi } from '@/lib/gradeApi';
import type { SettingsApi } from '@/lib/settingsApi';
import { gradeApi, settingsApi } from '@/lib/services';
import { resetGradeSettings } from '@/store/gradeSettingsStore';
import { resolveDest } from '@/navigation/resolve';
import { useSignupStore } from '@/store';
import { forgetMyFace } from '@/store/myFaceStore';
import { size, space } from '@/theme/tokens';

import { BusinessInfoPage, ImageCreditPage, SafetyGuidePage, SecurityPage, SupportPage, type SupportDeps } from './InfoPages';
import { LicensesPage } from './LicensesPage';
import { BlockedListPage, ReportHistoryPage } from './ListPages';
import { copyToClipboard, readPushStatus, requestPushPermission, type PushStatus } from './deviceDeps';
import { NotificationsPage } from './NotificationsPage';
import { ConsentManagePage } from './ConsentManagePage';
import { GradeSwitches } from './GradeSwitches';
import { GroupLabel, NavRow, OutlineButton, RowGroup } from './SettingsParts';
import { SETTINGS_ROWS, type RowDef, type SettingsPage } from './settingsLogic';
import { WithdrawFlow } from './WithdrawFlow';

export type SettingsDeps = SupportDeps & {
  api: SettingsApi;
  grade?: Pick<GradeApi, 'loadMine' | 'loadProcessing' | 'setProcessing'>; // 있으면 등급 스위치(등급 계산 멈추기)를 그린다(F13 · v5 12-Q)
  business?: BusinessInfo; // 사업자 정보 · 신고번호 값(없으면 content/businessInfo.ts 의 BUSINESS_INFO — 한 곳). 시험에서 값을 넣어 본다
  openUrl?: (url: string) => Promise<void>; // 사업자 정보 연결 줄(수수료표 · 보증보험 청구 절차 웹 주소). 없으면 Linking.openURL
  now: () => number;
  resetLocal: () => void; // 기기에 남은 가입 진행 · 설문 임시 저장 지우기(점검표 A-14)
  pushStatus: () => Promise<PushStatus>; // 지금 푸시 권한(묻지 않음)
  requestPush: () => Promise<PushStatus>; // 시스템 권한 창(서비스 알림을 켤 때, 안내 글을 먼저 보인 뒤)
};


export function defaultSettingsDeps(): SettingsDeps {
  return {
    api: settingsApi,
    grade: gradeApi,
    now: Date.now,
    resetLocal: () => useSignupStore.getState().resetAll(),
    pushStatus: readPushStatus,
    requestPush: requestPushPermission,
    copyText: copyToClipboard,
    openMail: async (email) => {
      try {
        await Linking.openURL(`mailto:${email}`);
      } catch {
        // 메일 앱이 없으면 아무 일도 없다(복사로 대신한다)
      }
    },
  };
}

const openExternal = async (url: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    // 열 수 없으면 아무 일도 없다
  }
};

export function SettingsScreen({ deps: given }: { deps?: SettingsDeps }) {
  const router = useRouter();
  const [deps] = useState<SettingsDeps>(() => given ?? defaultSettingsDeps());
  const [page, setPage] = useState<SettingsPage>('list');
  const [legalOpen, setLegalOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [push, setPush] = useState<PushStatus>('undetermined');
  const [loggingOut, setLoggingOut] = useState(false);
  const collapse = useCollapsingTitle(); // 큰 제목 줄어듦(F21)
  const busyRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // 탭을 떠나면 목록으로(다시 들어오면 목록부터)
  useFocusEffect(
    useCallback(
      () => () => {
        setPage('list');
        setLegalOpen(false);
      },
      [],
    ),
  );

  const toList = useCallback(() => setPage('list'), []);

  const go = (href: Href, tab: boolean) => {
    if (tab) router.navigate(href);
    else router.push(href);
  };

  const onRow = (row: RowDef) => {
    const action = row.action;
    switch (action.kind) {
      case 'page':
        if (action.page === 'notifications') void deps.pushStatus().then(setPush);
        setPage(action.page);
        return;
      case 'visibility': {
        const target = resolveDest('08');
        if (target.kind === 'href') go(target.href, true);
        return;
      }
      case 'preferences': {
        const target = resolveDest('04:25', { origin: '12' });
        if (target.kind === 'href') go(target.href, false);
        return;
      }
      case 'soon':
        showToast(SETTINGS.verificationToast);
        return;
      case 'legal':
        setLegalOpen(true);
        return;
      case 'credits':
        router.push('/credits' as unknown as Href); // T5(탭 위에 열리는 화면)
        return;
    }
  };

  const leaveToStart = async () => {
    await deps.api.signOut();
    deps.resetLocal();
    resetGradeSettings(); // 다음 사람에게 이 사람의 구독 · 멈춤 표시가 남지 않게(F13)
    forgetMyFace(); // 다음에 로그인하는 사람에게 이 사람의 원형 사진이 남지 않게(F11)
    const target = resolveDest('01');
    if (target.kind === 'href') {
      if (router.canDismiss()) router.dismissAll();
      router.replace(target.href);
    }
  };

  const logout = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoggingOut(true);
    try {
      await leaveToStart();
    } finally {
      busyRef.current = false;
      setLoggingOut(false);
    }
  };

  const business = deps.business ?? BUSINESS_INFO;
  const bizRows = businessRows(business); // 값이 하나라도 비면 null → 줄 · 쪽 모두 없음
  const reportLine = reportNoLine(business); // 신고번호가 비면 null → 줄 없음

  const body = (() => {
    switch (page) {
      case 'notifications':
        return (
          <NotificationsPage
            api={deps.api}
            pushStatus={push}
            onRequestPush={async () => {
              const next = await deps.requestPush();
              setPush(next);
              return next;
            }}
            onBack={toList}
            onToast={showToast}
          />
        );
      case 'security':
        return <SecurityPage onBack={toList} />;
      case 'consent-management':
        return <ConsentManagePage api={deps.api} onBack={toList} onToast={showToast} />;
      case 'blocked-list':
        return <BlockedListPage api={deps.api} onBack={toList} onToast={showToast} />;
      case 'report-history':
        return <ReportHistoryPage api={deps.api} now={deps.now} onBack={toList} />;
      case 'support':
        return <SupportPage deps={deps} onBack={toList} onToast={showToast} />;
      case 'safety':
        return <SafetyGuidePage onBack={toList} />;
      case 'licenses':
        return <LicensesPage onBack={toList} />;
      case 'image-credit':
        return <ImageCreditPage onBack={toList} />;
      case 'business-info':
        return bizRows ? (
          <BusinessInfoPage
            rows={bizRows}
            links={businessLinks(business)}
            onOpenLink={(link) => {
              if (link.url === null) setLegalOpen(true); // 이용약관: 앱 안 약관 화면
              else void (deps.openUrl ?? openExternal)(link.url);
            }}
            onBack={toList}
          />
        ) : null;
      default:
        return null;
    }
  })();

  const main = SETTINGS_ROWS.filter((r) => r.group === 'main');
  const info = SETTINGS_ROWS.filter((r) => r.group === 'info' && (r.key !== 'business-info' || bizRows !== null));

  return (
    <Screen edges={['top']} enter="tab" testID="settings-screen">
      {page === 'list' ? (
        <>
          <TabHeader title={SETTINGS.headerTitle} collapse={collapse} testID="settings-header" />
          <Animated.ScrollView contentContainerStyle={styles.list} onScroll={collapse.onScroll} scrollEventThrottle={16} testID="settings-list">
            <RowGroup testID="settings-rows">
              {main.map((row) => (
                <NavRow key={row.key} label={row.label} right={row.right} onPress={() => onRow(row)} testID={`settings-row-${row.key}`} />
              ))}
              <View style={styles.infoHead}>
                <GroupLabel text={SETTINGS.rows.infoGroup} testID="settings-info-label" />
              </View>
              {info.map((row, i) => (
                <NavRow key={row.key} label={row.label} last={i === info.length - 1} onPress={() => onRow(row)} testID={`settings-row-${row.key}`} />
              ))}
            </RowGroup>
            {deps.grade ? <GradeSwitches grade={deps.grade} onToast={showToast} /> : null}
            <OutlineButton label={SETTINGS.logout} busy={loggingOut} onPress={() => void logout()} testID="settings-logout" />
            <TextButton label={SETTINGS.withdraw} onPress={() => setWithdrawOpen(true)} testID="settings-withdraw" />
            {reportLine ? (
              <AppText variant="caption" tone="sub" style={styles.reportLine} testID="settings-report-no">
                {reportLine}
              </AppText>
            ) : null}
          </Animated.ScrollView>
        </>
      ) : (
        body
      )}
      <LegalReader visible={legalOpen} initial="terms" business={business} onClose={() => setLegalOpen(false)} />
      <WithdrawFlow
        visible={withdrawOpen}
        api={deps.api}
        now={deps.now}
        onCancel={() => setWithdrawOpen(false)}
        onDone={leaveToStart}
      />
      <Toast text={toast} testID="settings-toast" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: size.screenPadding, paddingTop: space.s8, paddingBottom: space.s32, gap: space.s16 },
  reportLine: { textAlign: 'center' },
  infoHead: { paddingHorizontal: space.s12, paddingTop: space.s12, paddingBottom: space.s4 },
});
