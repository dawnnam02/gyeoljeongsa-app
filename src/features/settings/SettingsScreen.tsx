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
import { forgetMeetScenes } from '@/features/chat/meetSeen';
import { LegalReader } from '@/features/consent/LegalReader';
import { resetCrisisCards } from '@/features/safety/crisisBudget';
import { contactPorts, type ContactPorts } from '@/lib/contactsServices';
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
import { AvoidPage } from './AvoidPage';
import { ConsentManagePage } from './ConsentManagePage';
import { forgetInflightNotes } from '@/features/inflight/deviceNotes';
import { forgetSajuDevice } from '@/features/saju/deviceInput';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { AitCodePage } from './AitCodePage';
import { aitStore } from '@/features/ait/aitStore';
import { aitEnabled } from '@/features/ait/aitEnabled';
import { GradeSwitches } from './GradeSwitches';
import { GroupLabel, NavRow, OutlineButton, RowGroup } from './SettingsParts';
import { AIT_ROW, SETTINGS_ROWS, type RowDef, type SettingsPage } from './settingsLogic';

import { takeSettingsPage } from './settingsIntent';
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
  contact?: () => ContactPorts; // 12-5 지인 차단 기기 연결(주소록 · 해시, 3부-바). 없으면 지인 차단 줄은 '준비 중'
  boarded?: () => Promise<boolean>; // 3부-아: 판매 마감 전 · 이번 회차 탑승권이 있나(동의 관리 CK4 · CK15 끄기 확인창 한 줄). 없으면 그 줄 없음
  mileage?: () => boolean; // IF5-F2: 12-1 '마일리지' 줄(스위치 mileage 가 켜졌을 때만). 없으면 줄 없음
  sajuYard?: () => boolean; // IF5-F1: 12-1 '사주 마당' 줄(스위치 saju_yard 가 켜졌을 때만). 없으면 줄 없음
  skyBook?: () => boolean; // IF3-F: 정보 묶음 '하늘 도감' 줄(스위치 sky_book 이 켜졌을 때만). 없으면 줄 없음
  ait?: () => boolean; // AIT-F ⑤: 시험용 AI 코드 줄(데모 판에서만 참 — 실서버 판엔 줄 0). 없으면 줄 없음
  ck17?: () => Ck17Api | null; // IF2-F: 동의 관리 '재미 정보' 줄(기내지 · 궁합 카드 스위치가 켜졌을 때만). 없거나 null 이면 줄 없음
};


export function defaultSettingsDeps(): SettingsDeps {
  return {
    api: settingsApi,
    grade: gradeApi,
    now: Date.now,
    resetLocal: () => useSignupStore.getState().resetAll(),
    pushStatus: readPushStatus,
    requestPush: requestPushPermission,
    contact: contactPorts, // 누를 때 처음 만든다(기기 모듈을 미리 읽지 않음)
    boarded: boardedNow,
    ck17: ck17Now,
    skyBook: skyBookNow,
    sajuYard: sajuYardNow,
    mileage: mileageNow,
    ait: aitEnabled,
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

// 이번 회차 탑승권 · 판매 마감 전(T2 [탑승 취소]가 보이는 조건 canCancel 과 같음). 탑승권 화면과 같은 서버 연결을 쓰고, 누를 때 처음 만든다
async function boardedNow(): Promise<boolean> {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { boardingServices } = require('@/features/boarding/boardingServices') as typeof import('@/features/boarding/boardingServices');
  const { canCancel } = require('@/features/boarding/boardingLogic') as typeof import('@/features/boarding/boardingLogic');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const r = await boardingServices().api.load();
  return r.ok && canCancel(r.state);
}

// IF5-F1: 사주 마당 줄은 스위치 saju_yard 가 켜졌을 때만(처음값 꺼짐 — 실서버엔 줄 0)
function sajuYardNow(): boolean {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { appFlagsStore } = require('@/hooks/useFeatureFlags') as typeof import('@/hooks/useFeatureFlags');
  const { isOn } = require('@/lib/featureFlagsApi') as typeof import('@/lib/featureFlagsApi');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return isOn(appFlagsStore().get(), 'saju_yard');
}

// IF5-F2: 마일리지 줄은 스위치 mileage 가 켜졌을 때만(처음값 꺼짐 — 실서버엔 줄 0)
function mileageNow(): boolean {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { appFlagsStore } = require('@/hooks/useFeatureFlags') as typeof import('@/hooks/useFeatureFlags');
  const { isOn } = require('@/lib/featureFlagsApi') as typeof import('@/lib/featureFlagsApi');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return isOn(appFlagsStore().get(), 'mileage');
}

// IF3-F: 하늘 도감 줄은 스위치 sky_book 이 켜졌을 때만(스위치 처음값 꺼짐 — 실서버엔 줄 0)
function skyBookNow(): boolean {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { appFlagsStore } = require('@/hooks/useFeatureFlags') as typeof import('@/hooks/useFeatureFlags');
  const { isOn } = require('@/lib/featureFlagsApi') as typeof import('@/lib/featureFlagsApi');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return isOn(appFlagsStore().get(), 'sky_book');
}

// IF2-F: 재미 정보 동의(CK17A · CK17B) 줄은 기내지 · 궁합 카드 스위치가 켜졌을 때만(스위치 처음값 꺼짐 — 실서버엔 줄 0)
function ck17Now(): Ck17Api | null {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { appFlagsStore } = require('@/hooks/useFeatureFlags') as typeof import('@/hooks/useFeatureFlags');
  const { isOn } = require('@/lib/featureFlagsApi') as typeof import('@/lib/featureFlagsApi');
  const { inflightServices } = require('@/features/inflight/inflightService') as typeof import('@/features/inflight/inflightService');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const f = appFlagsStore().get();
  return isOn(f, 'inflight_mag') || isOn(f, 'pair_card') ? inflightServices().ck17 : null;
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
  // IF5-F2: 탈퇴 확인창 마일리지 줄 — 스위치 mileage 가 켜졌을 때만 열 때 한 번 읽는다(저장 0)
  const [withdrawMileage, setWithdrawMileage] = useState<{ total: number; paid: number; free: number } | null>(null);
  useEffect(() => {
    if (!withdrawOpen || deps.mileage?.() !== true) return undefined;
    let live = true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mileageServices } = require('@/features/mileage/mileageService') as typeof import('@/features/mileage/mileageService');
    void mileageServices().api.state().then((r) => live && setWithdrawMileage(r.ok ? { total: r.data.total, paid: r.data.paid, free: r.data.free } : null));
    return () => {
      live = false;
    };
  }, [withdrawOpen, deps]);
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

  // 탭을 떠나면 목록으로(다시 들어오면 목록부터). 다른 화면이 쪽을 열어 달라고 남겼으면(settingsIntent — T2 · 사전 오픈 할 일 '아는 분 피하기') 그 쪽부터
  useFocusEffect(
    useCallback(() => {
      const want = takeSettingsPage();
      if (want) setPage(want);
      return () => {
        setPage('list');
        setLegalOpen(false);
      };
    }, []),
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
      case 'skyBook':
        go('/sky-book' as Href, false);
        return;
      case 'saju':
        go('/saju' as Href, false);
        return;
      case 'mileage':
        go('/mileage' as Href, false);
        return;
      case 'credits':
        router.push('/credits' as unknown as Href); // T5(탭 위에 열리는 화면)
        return;
      case 'grade':
        router.push('/grade' as unknown as Href); // 16-G 내 등급(D-200 ②, 탭 위에 열리는 화면)
        return;
    }
  };

  const leaveToStart = async () => {
    await deps.api.signOut();
    deps.resetLocal();
    resetGradeSettings(); // 다음 사람에게 이 사람의 구독 · 멈춤 표시가 남지 않게(F13)
    forgetMyFace(); // 다음에 로그인하는 사람에게 이 사람의 원형 사진이 남지 않게(F11)
    forgetMeetScenes(); // D46: 만남 장면을 본 방 기록(기기)도 지운다 — 같은 기기를 다른 계정이 쓸 때(K27 상황 21)
    resetCrisisCards(); // 3부-차: 위기 도움 카드 하루 3번 셈(화면 메모리)도 비운다 — 다음 계정에 넘어가지 않게
    await aitStore.forget(); // AIT-F: 시험용 AI 코드 · 시험자 동의 기록도 지운다(다음 사람에게 넘어가지 않게)
    await forgetInflightNotes(); // IF2-F: 나만 쓰는 글 9종(엽서 · 미리 답 · 표시 · 메모 · 고른 짐 · 본 기록 · 띠 · 접힘)도 지운다(정책 PF-10 · IFF-03)
    await forgetSajuDevice(); // IF5-F1: 내 시각 · 곳(이 휴대폰에만 둔 값)도 지운다(IFF5-31)
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
        return <ConsentManagePage api={deps.api} boarded={deps.boarded} onBack={toList} onToast={showToast} ck17={deps.ck17?.() ?? undefined} />;
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
      case 'ait-code':
        return <AitCodePage onBack={toList} onToast={showToast} />;
      case 'avoid':
        return <AvoidPage api={deps.api} onBack={toList} onToast={showToast} contact={deps.contact} />;
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

  const main = [...SETTINGS_ROWS.filter((r) => r.group === 'main' && (r.key !== 'saju-yard' || deps.sajuYard?.() === true) && (r.key !== 'mileage' || deps.mileage?.() === true)), ...(deps.ait?.() === true ? [AIT_ROW] : [])];
  const info = SETTINGS_ROWS.filter((r) => r.group === 'info' && (r.key !== 'business-info' || bizRows !== null) && (r.key !== 'sky-book' || deps.skyBook?.() === true));

  return (
    <Screen edges={['top']} enter="tab" testID="settings-screen">
      {page === 'list' ? (
        <>
          <TabHeader title={SETTINGS.headerTitle} collapse={collapse} testID="settings-header" />
          <Animated.ScrollView contentContainerStyle={styles.list} onScroll={collapse.onScroll} scrollEventThrottle={16} testID="settings-list">
            <RowGroup testID="settings-rows">
              {main.map((row) => (
                <NavRow key={row.key} label={row.label} right={row.right} icon={row.icon} onPress={() => onRow(row)} testID={`settings-row-${row.key}`} />
              ))}
              <View style={styles.infoHead}>
                <GroupLabel text={SETTINGS.rows.infoGroup} testID="settings-info-label" />
              </View>
              {info.map((row, i) => (
                <NavRow key={row.key} label={row.label} icon={row.icon} last={i === info.length - 1} onPress={() => onRow(row)} testID={`settings-row-${row.key}`} />
              ))}
            </RowGroup>
            {deps.grade ? <GradeSwitches grade={deps.grade} onToast={showToast} /> : null}
            <OutlineButton label={SETTINGS.logout} icon="logout" busy={loggingOut} onPress={() => void logout()} testID="settings-logout" />
            <TextButton label={SETTINGS.withdraw} icon="withdraw" onPress={() => setWithdrawOpen(true)} testID="settings-withdraw" />
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
        mileage={withdrawOpen ? withdrawMileage : null}
        onRefund={() => {
          setWithdrawOpen(false);
          setPage('support'); // [환불 요청] — 고객센터 안내로(P0: 결제 · 환불 호출 0)
        }}
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
