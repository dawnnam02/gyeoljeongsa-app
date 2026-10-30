// T6 탑승객 라운지(LG-F · D-220). 라우트 /lounge(탭 밖 · 새 탭 0). 들어오는 길은 T4 목록 맨 위 '라운지 줄' 하나(정책 PL-02).
//  · 상태 = 서버 lounge_state(0042): none · closed · left · kicked · landing · captain_only · intro · stub · lights_out · paused · empty_room · open + 불러오는 중 · 오류
//  · 첫 입장(회차 한 번): 짝 안내 · 라운지 약속 + 동의 버튼 하나 '약속을 지키고 들어갈게요' + [나중에](PL-03a — 체크 칸 0) → 입장권 쪽지 [입장권 뜯기] 400ms → 좌석 '13A' → 좌석표(내 자리만 점)
//  · 객실: 최근 200개(더 불러오기 0) · 기장 점선 쪽지 · [나도 답하기] · 공감 하나(글쓴이에게만 '공감받았어요' · 개수 0) · 인용 답장 · 이 좌석 숨기기(나에게만) · 신고(사유 5) · 내 글 지우기
//  · 소등 · 착륙 준비: 쓰기 · 공감 · 인용 · 고르기 0, 읽기 · 신고 · 숨김은 됨(PL-13 · PL-30). 닫힘 · 강퇴 · 나감: 글 0 · 실시간 끊음 · 화면 비움(LGF-10)
//  · 실시간: T6 를 보고 있을 때만 객실 채널 하나 구독(화면을 떠나거나 앱이 뒤로 가면 끊음) · 받은 이벤트는 id · seat · body · at 넷만 읽고 그 글 하나만 다시 읽기(lounge_get_post)
//  · 기기 저장 0(글 · 좌석 · 위기 안내 닫음은 이 화면 메모리에만 · 숨긴 좌석은 서버 get_lounge_my_hidden 이 채움 — 0044) · 로그는 이벤트 이름 · 코드만
//  · 3부-자: 수 18:00 공개 뒤 실시간 closed 가 오면 화면을 닫고 글을 비우고 구독을 끊는다 · 강퇴 · 나감은 [돌아가기] → T4 목록
//  · 스위치 lounge 꺼짐 · 탑승 아님으로 이 주소에 오면 T4 목록으로(PL-35)
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { useCommitThenPress } from '@/components/commitThenPress';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { KeyboardAvoid } from '@/components/KeyboardAvoid';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { COMMON, REPORT_SHEET } from '@/content/copy';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { TermsArticleSheet, termsArticle } from '@/features/consent/TermsArticleSheet';
import { takeCrisisCard } from '@/features/safety/crisisBudget';
import { Radio } from '@/features/safety/Radio';
import { curve, haptic, SkeletonLines, TOAST_MS, useReduceMotion, WaitState } from '@/motion';
import { layout } from '@/theme/layout';
import { loungeLook } from '@/theme/loungeLook';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { LOUNGE_OFF, LOUNGE_REASONS, type CaptainPost, type LoungeEvent, type LoungePost, type LoungeReason, type LoungeState, type MemberPost } from './loungeApi';
import { LOUNGE } from './loungeCopy';
import { LoungeIcon } from './LoungeIcon';
import {
  balanceHasResult,
  balanceResultText,
  canAnswer,
  canEmpathize,
  canHideReport,
  canPick,
  canWrite,
  deleteErrorText,
  empathyErrorText,
  hasRoom,
  hideErrorText,
  hideSeatPosts,
  mergePost,
  pickErrorText,
  removePost,
  reportErrorText,
  sendErrorText,
  STATE_CHANGED,
  tripName,
} from './loungeLogic';
import { CaptainNoteCard, ComposerLine, DemoLine, EndView, LoungeHeader, LoungeToast, MemberBubble, MenuRow, SeatMap, StateBand, WindowArt } from './LoungeParts';
import { LOUNGE_BOARDING_HREF, LOUNGE_CHAT_HREF, type LoungeDeps } from './loungeService';

type View_ = { kind: 'loading' } | { kind: 'error'; network: boolean } | { kind: 'ready'; st: LoungeState };
type Sheet = 'none' | 'menu' | 'info' | 'promise' | 'hidden' | 'seatMap' | 'msg' | 'report' | 'rulesAll';
type Confirm = 'none' | 'hide' | 'delete' | 'reportHide';
type Mode = { kind: 'none' } | { kind: 'quote'; post: MemberPost } | { kind: 'answer'; post: CaptainPost };
type Toast = { text: string; note?: string; action?: { label: string; onPress: () => void } } | null;
const REASON_TEXT: Readonly<Record<LoungeReason, string>> = { RP4: LOUNGE.report.reason.abuse, RP5: LOUNGE.report.reason.contact, RP6: LOUNGE.report.reason.minor, RP7: LOUNGE.report.reason.money, RP8: LOUNGE.report.reason.other };
const RULES_ARTICLE = '제9조의4'; // 약관 라운지 조항(법무 LG-L 안). 게시본에 생기면 '약속 전체 보기'가 그 조를 연다 — 없으면 약속 세 줄
const BOTTOM_GAP = 80; // 아래에서 이만큼 안이면 '맨 아래를 보는 중'(새 글이 오면 따라 내려감)

export function LoungeScreen({ deps, toastMs = TOAST_MS }: { deps: LoungeDeps; toastMs?: number }) {
  const router = useRouter();
  const reduce = useReduceMotion();
  const [view, setView] = useState<View_>({ kind: 'loading' });
  const [sheet, setSheet] = useState<Sheet>('none');
  const [confirm, setConfirm] = useState<Confirm>('none');
  const [target, setTarget] = useState<MemberPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'none' });
  const [sendError, setSendError] = useState<{ text: string; retry: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [introError, setIntroError] = useState<string | null>(null);
  const [rulesChanged, setRulesChanged] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [hidden, setHidden] = useState<Map<string, string>>(new Map()); // 내가 숨긴 좌석 → 그 좌석 글 id 하나(되돌리기용 · 메모리만)
  const [crisisPost, setCrisisPost] = useState<string | null>(null); // 위기 도움 카드가 붙은 내 글 id — 방금 보낸 글 한 장만(화면 메모리 · 다시 열면 0 · 하루 3번, 3부-차 정책 P4-33 · 34)
  const [newBelow, setNewBelow] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [demoScene, setDemoScene] = useState<string | null>(null);
  const [reason, setReason] = useState<LoungeReason | null>(null);
  const [note, setNote] = useState('');
  const [pairNote, setPairNote] = useState(false); // 신고가 이번 회차 짝 제외 쌍이 됐나(0043 get_lounge_report_note — 신고자에게만)
  const alive = useRef(true);
  const hiddenLoaded = useRef(false); // 숨긴 좌석을 서버에서 한 번 읽었나(객실에 처음 닿을 때 · 시트를 열 때)
  const shown = useRef(false); // 한 번이라도 라운지를 그렸나(처음부터 none 이면 목록으로)
  const [initialIds, setInitialIds] = useState<Set<string> | null>(null); // 처음 불러온 글(움직이지 않음)
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(new Set()); // 숨긴 좌석의 글 id(인용 상자 '숨긴 좌석의 글이에요')
  const atBottom = useRef(true);
  const sendingRef = useRef(false);
  const scroll = useRef<ScrollView>(null);

  const st = view.kind === 'ready' ? view.st : null;
  const trip = st ? tripName(st.tripNo) : null;

  const toList = useCallback(() => router.replace(LOUNGE_CHAT_HREF as Href), [router]);
  const back = () => (router.canGoBack() ? router.back() : toList());

  // 끝 상태(닫힘 · 나감 · 강퇴 · 없음): 이 화면 메모리를 비운다(LGF-10)
  const clearLocal = useCallback(() => {
    setText('');
    setMode({ kind: 'none' });
    setSendError(null);
    setHidden(new Map());
    setCrisisPost(null);
    setHiddenPostIds(new Set());
    setSheet('none');
    setConfirm('none');
    setTarget(null);
    setNewBelow(false);
    hiddenLoaded.current = false;
  }, []);

  // 0044 get_lounge_my_hidden: 내가 숨긴 좌석(좌석 + 되돌리기용 글 id). 다시 들어와도 시트가 채워지고 [다시 보기]가 된다. 못 읽으면 이 화면에서 숨긴 것만
  const loadHidden = useCallback(async () => {
    const r = await deps.api.myHidden();
    if (!alive.current || !r.ok) return;
    hiddenLoaded.current = true;
    setHidden(new Map(r.data.seats.map((x) => [x.seat, x.post] as const)));
    setHiddenPostIds((cur) => new Set([...cur, ...r.data.seats.map((x) => x.post)]));
  }, [deps]);

  const reload = useCallback(async () => {
    const on = await deps.switchOn().catch(() => false);
    if (!alive.current) return;
    if (!on) {
      toList(); // 스위치 꺼짐(PL-35)
      return;
    }
    const r = await deps.api.state();
    if (!alive.current) return;
    if (deps.demo) setDemoScene(await deps.demo.scene().catch(() => null));
    if (!r.ok) {
      if (r.code === LOUNGE_OFF) {
        toList();
        return;
      }
      setView((cur) => (cur.kind === 'ready' ? cur : { kind: 'error', network: r.code === 'network' }));
      return;
    }
    if (r.data.code === 'none' && !shown.current) {
      toList(); // 탑승 아님 · 비행 중 아님으로 주소에 직접 옴(PL-35)
      return;
    }
    shown.current = true;
    if (!hasRoom(r.data.code, r.data.seat) && r.data.code !== 'intro' && r.data.code !== 'stub' && r.data.code !== 'captain_only') clearLocal();
    if (r.data.posts.length > 0) setInitialIds((cur) => cur ?? new Set(r.data.posts.map((p) => p.id)));
    setView({ kind: 'ready', st: r.data });
    if (hasRoom(r.data.code, r.data.seat) && !hiddenLoaded.current) void loadHidden();
  }, [deps, toList, clearLocal, loadHidden]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void reload();
      return () => setFocused(false);
    }, [reload]),
  );

  // 앱이 뒤로 가면 구독을 끊고, 돌아오면 다시 읽는다
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const on = s === 'active';
      setActive(on);
      if (on) void reload();
    });
    return () => sub.remove();
  }, [reload]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(t);
  }, [toast, toastMs]);

  const patchPosts = useCallback((fn: (list: LoungePost[]) => LoungePost[]) => {
    setView((cur) => (cur.kind === 'ready' ? { kind: 'ready', st: { ...cur.st, posts: fn(cur.st.posts) } } : cur));
  }, []);

  // ── 실시간(T6 를 보고 있을 때만 · 객실 채널 하나)
  const onPost = useRef<(e: LoungeEvent) => void>(() => undefined);
  const onGone = useRef<(e: LoungeEvent) => void>(() => undefined);
  const onClosed = useRef<() => void>(() => undefined);
  // 받은 이벤트 처리(그릴 때 바꾸지 않게 효과 안에서 최신 값으로 갈아 끼운다)
  useEffect(() => {
    onPost.current = (e) => {
      if (!st) return;
      if (e.seat === null && e.body && /^captain\.(lightsOut|morning|landing)$/.test(e.body)) {
        void reload(); // 불 끄기 · 아침 · 착륙 인사 = 상태가 바뀌는 때 → 한 번 다시 읽기
        return;
      }
      if (st.posts.some((p) => p.id === e.id)) return;
      if (sendingRef.current && e.seat !== null && e.seat === st.seat) return; // 내가 보낸 글은 보내기 응답이 넣는다
      void deps.api.getPost(e.id).then((r) => {
        if (!r.ok) return; // 숨긴 좌석 · 가려진 글은 서버가 not_found
        patchPosts((list) => mergePost(list, r.data));
        if (!atBottom.current && !(r.data.kind !== 'captain' && r.data.mine)) setNewBelow(true);
      });
    };
    onGone.current = (e) => patchPosts((list) => removePost(list, e.id));
    // 0044 closed(수 18:00 공개 뒤 한 번): 화면을 닫힘으로 · 글 · 메모리 비움 · 구독 끊김(객실 상태가 아니라 channel 이 null). 서버 상태는 한 번 다시 읽어 맞춘다
    onClosed.current = () => {
      clearLocal();
      setInitialIds(null);
      setView((cur) => (cur.kind === 'ready' ? { kind: 'ready', st: { ...cur.st, code: 'closed', posts: [], captain: [], channel: null } } : cur));
      void reload();
    };
  });

  const channel = st && hasRoom(st.code, st.seat) ? st.channel : null;
  useEffect(() => {
    if (!focused || !active || !channel) return undefined;
    return deps.api.subscribe(channel, { onPost: (e) => onPost.current(e), onGone: (e) => onGone.current(e), onClosed: () => onClosed.current() });
  }, [focused, active, channel, deps]);

  // 착륙 준비(17:30 ~ 18:00): 닫힘을 알려고 5분마다 한 번(카운트다운 · 남은 시간 글 0)
  const landing = st?.code === 'landing';
  useEffect(() => {
    if (!landing || !focused) return undefined;
    const t = setInterval(() => void reload(), loungeLook.landingPollMs);
    return () => clearInterval(t);
  }, [landing, focused, reload]);

  // ── 첫 입장: 약속 동의(버튼 하나) → 쪽지
  const agree = async () => {
    if (!st?.rulesVersion || busy) return;
    setBusy(true);
    setIntroError(null);
    const r = await deps.api.agree(st.rulesVersion);
    setBusy(false);
    if (r.ok) {
      setRulesChanged(false);
      await reload();
      return;
    }
    if (r.code === 'rules_changed') {
      setRulesChanged(true);
      if (r.rulesVersion) setView((cur) => (cur.kind === 'ready' ? { kind: 'ready', st: { ...cur.st, rulesVersion: r.rulesVersion ?? cur.st.rulesVersion } } : cur));
      return;
    }
    if (r.code === 'network' || r.code === 'server') setIntroError(LOUNGE.intro.failed); // 기록 실패면 들어가지 않고 한 줄
    else await reload();
  };

  // ── 입장권 쪽지 뜯기(400ms) = 좌석 배정(PL-04)
  const tearX = useSharedValue(0);
  const tearR = useSharedValue(0);
  const tearO = useSharedValue(1);
  const tearStyle = useAnimatedStyle(() => ({ opacity: tearO.get(), transform: [{ translateX: tearX.get() }, { rotate: `${tearR.get()}deg` }] }));
  const [tearing, setTearing] = useState(false);
  const tear = async () => {
    if (tearing) return;
    setTearing(true);
    setIntroError(null);
    haptic.light();
    const ms = reduce ? loungeLook.fade : loungeLook.tear.ms;
    if (reduce) tearO.set(withTiming(0, { duration: loungeLook.fade, easing: curve('std') }));
    else {
      tearX.set(withTiming(loungeLook.tear.dx, { duration: loungeLook.tear.ms, easing: curve('edOut') }));
      tearR.set(withTiming(loungeLook.tear.deg, { duration: loungeLook.tear.ms, easing: curve('edOut') }));
      tearO.set(withDelay(loungeLook.tear.ms - loungeLook.tear.fadeMs, withTiming(0, { duration: loungeLook.tear.fadeMs, easing: curve('std') })));
    }
    const [r] = await Promise.all([deps.api.takeSeat(), new Promise((res) => setTimeout(res, ms))]);
    setTearing(false);
    if (r.ok) {
      await reload();
      setAssigned(true);
      setSheet('seatMap');
      return;
    }
    tearX.set(0);
    tearR.set(0);
    tearO.set(1);
    if (r.code === 'network' || r.code === 'server') setIntroError(LOUNGE.intro.failed);
    else await reload();
  };

  // ── 글 보내기
  const send = async () => {
    if (!st || sending) return;
    const body = text.normalize('NFC').trim();
    if (body === '') {
      setSendError({ text: LOUNGE.error.empty, retry: false });
      return;
    }
    setSending(true);
    sendingRef.current = true;
    setSendError(null);
    const r = await deps.api.post(body, mode.kind === 'quote' ? mode.post.id : null, mode.kind === 'answer' ? mode.post.id : null);
    sendingRef.current = false;
    setSending(false);
    if (r.ok) {
      setText('');
      setMode({ kind: 'none' });
      const p = r.data.post;
      if (p) {
        patchPosts((list) => mergePost(list, p));
        atBottom.current = true;
        // 위기 도움 카드는 '보낸 직후 응답'에서만, 하루 3번까지(라운지 · 대화방 합쳐). 글 목록을 다시 불러올 때 오는 표시는 쓰지 않는다
        if (r.data.help && takeCrisisCard()) setCrisisPost(p.id);
      }
      return;
    }
    setSendError({ text: sendErrorText(r.code, r.codes), retry: r.code === 'network' || r.code === 'server' });
    if (STATE_CHANGED.includes(r.code)) void reload();
  };
  const press = useCommitThenPress(() => void send());

  // ── 공감 · 고르기 · 숨김 · 신고 · 지우기
  const empathize = async (p: MemberPost) => {
    const r = await deps.api.empathy(p.id, !p.empathized);
    if (r.ok) {
      patchPosts((list) => list.map((x) => (x.id === p.id && x.kind !== 'captain' ? { ...x, empathized: r.data.on } : x)));
      return;
    }
    setToast({ text: empathyErrorText(r.code) });
    if (STATE_CHANGED.includes(r.code)) void reload();
  };
  const pick = async (p: CaptainPost, side: 'a' | 'b') => {
    const r = await deps.api.pick(p.id, side);
    if (r.ok) {
      patchPosts((list) => list.map((x) => (x.id === p.id && x.kind === 'captain' ? { ...x, pick: r.data.side } : x)));
      return;
    }
    setToast({ text: pickErrorText(r.code) });
    if (STATE_CHANGED.includes(r.code)) void reload();
  };
  const unhide = async (seat: string) => {
    const postId = hidden.get(seat);
    if (!postId) return;
    const r = await deps.api.hide(postId, false);
    if (!r.ok) {
      setToast({ text: hideErrorText(r.code) });
      return;
    }
    setHidden((cur) => {
      const next = new Map(cur);
      next.delete(seat);
      return next;
    });
    setToast({ text: LOUNGE.hidden.unhidden });
    await reload(); // 그 좌석 글을 다시 보이려면 목록을 한 번 다시 읽는다(숨김을 거둘 때만)
  };
  const hideSeat = async (p: MemberPost) => {
    setBusy(true);
    const r = await deps.api.hide(p.id, true);
    setBusy(false);
    if (!r.ok) {
      setDialogError(hideErrorText(r.code));
      return;
    }
    setConfirm('none');
    setDialogError(null);
    setHidden((cur) => new Map(cur).set(p.seat, p.id));
    setHiddenPostIds((cur) => {
      const next = new Set(cur);
      for (const x of st?.posts ?? []) if (x.kind !== 'captain' && x.seat === p.seat) next.add(x.id);
      return next;
    });
    patchPosts((list) => hideSeatPosts(list, p.seat));
    if (mode.kind === 'quote' && mode.post.seat === p.seat) setMode({ kind: 'none' });
    setToast({ text: LOUNGE.hide.done, action: { label: LOUNGE.hidden.unhide, onPress: () => void unhide(p.seat) } });
  };
  const report = async () => {
    if (!target || !reason || busy) return;
    setBusy(true);
    const r = await deps.api.report(target.id, reason, note);
    setBusy(false);
    if (!r.ok) {
      setDialogError(reportErrorText(r.code));
      return;
    }
    setDialogError(null);
    setSheet('none');
    // 짝 제외 쌍이 걸렸을 때만 '이번 회차에는 이 좌석의 분과 이어지지 않아요.'(카피 19-7 report.pairNote) — 상대가 받은 조치 · 처리 결과 · 신고 수 0. 못 읽으면 줄째 없음
    const n = await deps.api.reportNote(target.id);
    const noPair = n.ok && n.data.noPair;
    setPairNote(noPair);
    const ask = !hidden.has(target.seat);
    setToast({ text: LOUNGE.report.done, note: noPair && !ask ? LOUNGE.report.pairNote : undefined }); // 처리 결과 · 상대 · 신고 수 0(LGF-15). 12 신고 내역에는 나오지 않음(PL-25)
    if (ask) setConfirm('reportHide');
  };
  const remove = async () => {
    if (!target || busy) return;
    setBusy(true);
    const r = await deps.api.remove(target.id);
    setBusy(false);
    if (!r.ok) {
      setDialogError(deleteErrorText(r.code));
      return;
    }
    setDialogError(null);
    setConfirm('none');
    patchPosts((list) => removePost(list, target.id));
    setToast({ text: LOUNGE.delete.done });
  };

  const openMenuFor = (p: MemberPost) => {
    setTarget(p);
    setSheet('msg');
  };
  const hiddenSeatOf = (quoteId: string) => hiddenPostIds.has(quoteId);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - BOTTOM_GAP;
    if (atBottom.current && newBelow) setNewBelow(false);
  };
  const toBottom = () => {
    scroll.current?.scrollToEnd({ animated: !reduce });
    atBottom.current = true;
    setNewBelow(false);
  };

  const demoLine = deps.demo ? (
    <DemoLine
      text={deps.demo.line(demoScene)}
      onPress={async () => {
        await deps.demo?.next();
        clearLocal();
        setInitialIds(null);
        setAssigned(false);
        setRulesChanged(false);
        setIntroError(null);
        tearX.set(0);
        tearR.set(0);
        tearO.set(1);
        await reload();
      }}
    />
  ) : null;

  // ════ 그리기
  let body: ReactNode;
  let header: ReactNode = <LoungeHeader trip={trip} onBack={back} />;
  if (view.kind === 'loading') {
    body = <WaitState waiting skeleton={<SkeletonLines count={3} />} note={<AppText variant="caption">{COMMON.loading}</AppText>} testID="lounge-wait" />;
  } else if (view.kind === 'error') {
    body = (
      <View style={styles.center} testID="lounge-error">
        <LoungeIcon name="retry" size={32} color={colors.sub} />
        <AppText variant="body" style={styles.centerText}>
          {view.network ? COMMON.offline : LOUNGE.error.loadFailed}
        </AppText>
        <Button label={BOARDING.retry} variant="secondary" inline onPress={() => void reload()} testID="lounge-retry" />
      </View>
    );
  } else {
    const s = view.st;
    if (s.code === 'intro') {
      header = <LoungeHeader trip={trip} onClose={toList} testID="lounge-header" />;
      body = (
        <View style={styles.flex} testID="lounge-intro">
          <ScrollView contentContainerStyle={styles.introBody}>
            <AppText variant="heading" accessibilityRole="header" testID="lounge-intro-title">
              {LOUNGE.intro.title}
            </AppText>
            {rulesChanged || s.hasSeat ? (
              <AppText variant="smallMedium" tone="accent" accessibilityLiveRegion="polite" testID="lounge-intro-rules-changed">
                {LOUNGE.intro.rulesChanged}
              </AppText>
            ) : null}
            <AppText variant="body" testID="lounge-intro-body">
              {LOUNGE.intro.body}
            </AppText>
            <View style={styles.pairNote}>
              <AppText variant="small" testID="lounge-intro-pair">
                {LOUNGE.intro.pairNote}
              </AppText>
            </View>
            <AppText variant="bodyBold" testID="lounge-intro-promise-title">
              {LOUNGE.intro.promiseTitle}
            </AppText>
            {LOUNGE.intro.promise.map((line, i) => (
              <View key={line} style={styles.promise}>
                <View style={styles.dot} />
                <AppText variant="body" style={styles.flex} testID={`lounge-intro-promise-${i}`}>
                  {line}
                </AppText>
              </View>
            ))}
            <TextButton label={`${LOUNGE.intro.rulesAll} ›`} accessibilityLabel={LOUNGE.intro.rulesAll} align="start" onPress={() => setSheet(termsArticle(RULES_ARTICLE) ? 'rulesAll' : 'promise')} testID="lounge-intro-rules-all" />
            {demoLine}
          </ScrollView>
          <View style={styles.introButtons}>
            {introError ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="lounge-intro-error">
                {introError}
              </AppText>
            ) : null}
            <Button label={LOUNGE.intro.agreeEnter} loading={busy} onPress={() => void agree()} testID="lounge-intro-agree" />
            <Button label={LOUNGE.intro.close} variant="secondary" disabled={busy} onPress={toList} testID="lounge-intro-later" />
          </View>
        </View>
      );
    } else if (s.code === 'stub') {
      body = (
        <ScrollView contentContainerStyle={styles.stubBody} testID="lounge-stub">
          <View style={styles.ticket}>
            <View style={styles.ticketMain}>
              <AppText variant="caption" tone="accent">
                {LOUNGE.header.title}
              </AppText>
              {trip ? (
                <AppText variant="heading" testID="lounge-stub-trip">
                  {LOUNGE.header.subtitle(trip)}
                </AppText>
              ) : null}
              <AppText variant="small" testID="lounge-stub-body">
                {LOUNGE.stub.body}
              </AppText>
            </View>
            <View style={styles.perf} />
            <Animated.View style={[styles.ticketStub, styles.tearOrigin, tearStyle]} testID="lounge-stub-piece">
              <LoungeIcon name="seat" color={colors.accent} />
              <View style={styles.stubSeat} />
            </Animated.View>
          </View>
          {introError ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="lounge-stub-error">
              {introError}
            </AppText>
          ) : null}
          <Button label={LOUNGE.stub.tear} loading={tearing} onPress={() => void tear()} testID="lounge-stub-tear" />
          {demoLine}
        </ScrollView>
      );
    } else if (s.code === 'captain_only') {
      body = (
        <ScrollView contentContainerStyle={styles.list} testID="lounge-captain-only">
          <WindowArt />
          <View style={styles.centerBlock}>
            <AppText variant="title" style={styles.centerText} accessibilityRole="header" testID="lounge-captain-only-title">
              {LOUNGE.captainOnly.title}
            </AppText>
            <AppText variant="small" style={styles.centerText} testID="lounge-captain-only-body">
              {LOUNGE.captainOnly.body}
            </AppText>
          </View>
          {s.captain.map((c, i) => (
            <CaptainNoteCard key={`${c.captainKey}-${c.at}`} kind={c.captainKind} captainKey={c.captainKey} trip={trip} testID={`lounge-captain-${i}`} />
          ))}
          {demoLine}
        </ScrollView>
      );
    } else if (s.code === 'closed') {
      body = (
        <ScrollView contentContainerStyle={styles.endBody}>
          <EndView icon="door_closed" title={LOUNGE.closed.title} body={LOUNGE.closed.body} button={{ label: LOUNGE.closed.back, onPress: () => router.replace(LOUNGE_BOARDING_HREF as Href) }} testID="lounge-closed" />
          {demoLine}
        </ScrollView>
      );
    } else if (s.code === 'left' || s.code === 'none') {
      // 나감(탑승 취소 · 정지 · 탈퇴)은 [돌아가기] → T4 목록(기획 T6 이동표 · 검수 결정 10-28). 탑승 기록이 없는 none 은 지금처럼 [탑승권으로]
      const left = s.code === 'left';
      body = (
        <ScrollView contentContainerStyle={styles.endBody}>
          <EndView
            icon="seat"
            title={left ? LOUNGE.left.title : null}
            body={left ? LOUNGE.left.body : LOUNGE.none.body}
            button={left ? { label: LOUNGE.backToList, onPress: toList } : { label: LOUNGE.closed.back, onPress: () => router.replace(LOUNGE_BOARDING_HREF as Href) }}
            testID={left ? 'lounge-left' : 'lounge-none'}
          />
          {demoLine}
        </ScrollView>
      );
    } else if (s.code === 'kicked') {
      body = (
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.endBody}>
            <EndView icon="hide_seat" title={LOUNGE.kicked.title} body={LOUNGE.kicked.body} button={{ label: LOUNGE.backToList, onPress: toList }} testID="lounge-kicked" />
            {demoLine}
          </ScrollView>
          <ComposerLine icon={null} text={LOUNGE.composer.stopped} testID="lounge-composer-line" />
        </View>
      );
    } else if (s.code === 'landing' && !s.seat) {
      // 착륙 준비 뒤 처음 온 분(좌석 0 — 읽을 객실 없음, 백엔드 10-6 #6)
      body = (
        <ScrollView contentContainerStyle={styles.endBody}>
          <EndView icon="landing" title={null} body={LOUNGE.state.landing} testID="lounge-landing-noseat" />
          {demoLine}
        </ScrollView>
      );
    } else {
      // 객실: open · empty_room · paused · lights_out · landing
      header = <LoungeHeader trip={trip} seat={s.seat} onBack={back} onSeat={() => setSheet('seatMap')} onMenu={() => setSheet('menu')} />;
      const writable = canWrite(s.code);
      const empathyOn = canEmpathize(s.code);
      const members = s.posts.filter((p): p is MemberPost => p.kind !== 'captain');
      const fresh = (id: string) => initialIds !== null && !initialIds.has(id);
      body = (
        <KeyboardAvoid>
          {s.code === 'lights_out' ? <StateBand icon="window_shade" title={LOUNGE.state.lightsOut} note={LOUNGE.state.safetyNote} testID="lounge-band" /> : null}
          {s.code === 'landing' ? <StateBand icon="landing" title={LOUNGE.state.landing} note={LOUNGE.state.safetyNote} testID="lounge-band" /> : null}
          {s.code === 'paused' ? <StateBand icon={null} title={LOUNGE.stopped.title} note={LOUNGE.stopped.body} testID="lounge-band" /> : null}
          <ScrollView
            ref={scroll}
            style={styles.flex}
            contentContainerStyle={styles.list}
            onScroll={onScroll}
            scrollEventThrottle={64}
            onContentSizeChange={() => {
              if (atBottom.current) scroll.current?.scrollToEnd({ animated: false });
            }}
            testID="lounge-messages">
            <AppText variant="caption" style={styles.centerText} testID="lounge-top-note">
              {LOUNGE.room.topNote}
            </AppText>
            {s.posts.map((p, i) =>
              p.kind === 'captain' ? (
                <CaptainNoteCard
                  key={p.id}
                  kind={p.captainKind}
                  captainKey={p.captainKey}
                  trip={trip}
                  post={p}
                  fresh={fresh(p.id)}
                  canAnswer={writable && canAnswer(p)}
                  canPick={canPick(s.code, p)}
                  result={p.captainKind === 'morning' ? balanceResultText(s.posts, p) : null}
                  waiting={p.captainKind === 'balance' && p.pick !== null && !balanceHasResult(s.posts, p)}
                  onAnswer={() => setMode({ kind: 'answer', post: p })}
                  onPick={(side) => void pick(p, side)}
                  testID={`lounge-post-${i}`}
                />
              ) : (
                <MemberBubble
                  key={p.id}
                  post={p}
                  fresh={fresh(p.id)}
                  showEmpathy={empathyOn && !p.mine}
                  showReceived={empathyOn}
                  showHelp={crisisPost === p.id}
                  hiddenSeatOf={hiddenSeatOf}
                  onEmpathy={() => void empathize(p)}
                  onMenu={() => openMenuFor(p)}
                  onCloseHelp={() => setCrisisPost(null)}
                  testID={`lounge-post-${i}`}
                />
              ),
            )}
            {s.code === 'open' && members.length === 0 ? (
              <AppText variant="small" style={[styles.centerText, styles.pad]} testID="lounge-room-empty">
                {LOUNGE.room.empty}
              </AppText>
            ) : null}
            {s.code === 'empty_room' ? (
              <AppText variant="small" style={[styles.centerText, styles.pad]} testID="lounge-room-gathering">
                {LOUNGE.room.gathering}
              </AppText>
            ) : null}
            {demoLine}
          </ScrollView>
          {newBelow ? (
            <Pressable accessibilityRole="button" accessibilityLabel={LOUNGE.room.newBelow} onPress={toBottom} effect="scale" style={styles.newBelow} testID="lounge-new-below">
              <AppText variant="captionMedium" tone="accent">
                {LOUNGE.room.newBelow}
              </AppText>
            </Pressable>
          ) : null}
          {writable ? (
            <View style={styles.composer} testID="lounge-composer">
              {mode.kind !== 'none' ? (
                <View style={styles.modeBand} testID="lounge-composer-mode">
                  <LoungeIcon name="quote_reply" size={20} color={colors.accent} />
                  <AppText variant="small" style={styles.flex} numberOfLines={1} testID="lounge-composer-mode-text">
                    {mode.kind === 'quote' ? LOUNGE.quote.composing(mode.post.seat) : LOUNGE.answer.composing}
                  </AppText>
                  <TextButton label={mode.kind === 'quote' ? LOUNGE.quote.cancel : LOUNGE.answer.cancel} variant="captionMedium" onPress={() => setMode({ kind: 'none' })} testID="lounge-composer-mode-cancel" />
                </View>
              ) : null}
              <View style={styles.bar}>
                <View style={styles.flex}>
                  <TextField
                    label={LOUNGE.a11y.composer}
                    value={text}
                    onChangeText={(v) => {
                      setText(v);
                      if (sendError) setSendError(null);
                    }}
                    placeholder={mode.kind === 'answer' ? LOUNGE.answer.placeholder : LOUNGE.composer.placeholder}
                    maxLength={LOUNGE_INPUT_CAP}
                    returnKeyType="send"
                    onSubmitEditing={press}
                    testID="lounge-input"
                  />
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={sending ? LOUNGE.composer.sending : LOUNGE.composer.send} accessibilityState={{ disabled: text.trim() === '' || sending }} disabled={text.trim() === '' || sending} onPress={press} effect="scale" surface="accent" style={styles.sendTouch} testID="lounge-send">
                  <View style={[styles.sendCircle, (text.trim() === '' || sending) && styles.sendOff]}>
                    <Icon name="send" size={20} color={colors.onAccent} />
                  </View>
                </Pressable>
              </View>
              {sendError ? (
                <View style={styles.sendError}>
                  <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="lounge-send-error">
                    {sendError.text}
                  </AppText>
                  {sendError.retry ? (
                    <View style={styles.retryRow}>
                      <TextButton label={LOUNGE.composer.retry} variant="captionMedium" onPress={press} testID="lounge-send-retry" />
                      <TextButton
                        label={LOUNGE.composer.discard}
                        variant="captionMedium"
                        onPress={() => {
                          setText('');
                          setSendError(null);
                        }}
                        testID="lounge-send-discard"
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <ComposerLine
              icon={s.code === 'lights_out' ? 'window_shade' : s.code === 'landing' ? 'landing' : null}
              text={s.code === 'lights_out' ? LOUNGE.composer.lightsOut : s.code === 'landing' ? LOUNGE.composer.landing : s.code === 'empty_room' ? LOUNGE.composer.gathering : LOUNGE.composer.stopped}
              testID="lounge-composer-line"
            />
          )}
        </KeyboardAvoid>
      );
    }
  }

  const seat = st?.seat ?? null;
  const promiseLines = (
    <>
      {LOUNGE.intro.promise.map((line, i) => (
        <AppText key={line} variant="body" testID={`lounge-promise-${i}`}>
          {line}
        </AppText>
      ))}
    </>
  );
  return (
    <Screen enter="depth" testID="lounge">
      {header}
      {body}

      {/* 머리 메뉴: 라운지 안내 · 라운지 약속 · 숨긴 좌석 · 닫기 */}
      <BottomSheet visible={sheet === 'menu'} onClose={() => setSheet('none')} testID="lounge-menu">
        <MenuRow label={LOUNGE.menu.info} onPress={() => setSheet('info')} testID="lounge-menu-info" />
        <MenuRow label={LOUNGE.menu.promise} onPress={() => setSheet('promise')} testID="lounge-menu-promise" />
        <MenuRow
          label={LOUNGE.menu.hidden}
          icon={<LoungeIcon name="hide_seat" color={colors.text} />}
          onPress={() => {
            setSheet('hidden');
            void loadHidden(); // 0044: 다시 들어와도 숨긴 좌석이 채워진다
          }}
          testID="lounge-menu-hidden"
        />
        <Button label={LOUNGE.menu.close} variant="secondary" onPress={() => setSheet('none')} testID="lounge-menu-close" />
      </BottomSheet>
      <BottomSheet visible={sheet === 'info'} onClose={() => setSheet('none')} testID="lounge-info">
        <AppText variant="bodyBold" accessibilityRole="header">
          {LOUNGE.info.title}
        </AppText>
        {LOUNGE.info.lines.map((line, i) => (
          <AppText key={line} variant="small" testID={`lounge-info-${i}`}>
            {line}
          </AppText>
        ))}
        <Button label={LOUNGE.menu.close} variant="secondary" onPress={() => setSheet('none')} testID="lounge-info-close" />
      </BottomSheet>
      <BottomSheet visible={sheet === 'promise'} onClose={() => setSheet('none')} testID="lounge-promise">
        <AppText variant="bodyBold" accessibilityRole="header">
          {LOUNGE.intro.promiseTitle}
        </AppText>
        {promiseLines}
        <Button label={LOUNGE.menu.close} variant="secondary" onPress={() => setSheet('none')} testID="lounge-promise-close" />
      </BottomSheet>
      <TermsArticleSheet visible={sheet === 'rulesAll'} prefix={RULES_ARTICLE} onClose={() => setSheet('none')} testID="lounge-rules-all" />
      <BottomSheet visible={sheet === 'hidden'} onClose={() => setSheet('none')} testID="lounge-hidden">
        <AppText variant="bodyBold" accessibilityRole="header">
          {LOUNGE.hidden.title}
        </AppText>
        {hidden.size === 0 ? (
          <AppText variant="small" testID="lounge-hidden-empty">
            {LOUNGE.hidden.empty}
          </AppText>
        ) : (
          [...hidden.keys()].map((h) => <HiddenSeatRow key={h} seat={h} onUnhide={unhide} />)
        )}
        <Button label={LOUNGE.menu.close} variant="secondary" onPress={() => setSheet('none')} testID="lounge-hidden-close" />
      </BottomSheet>

      {/* 좌석표(배정 장면 · 머리 '내 좌석') */}
      <BottomSheet
        visible={sheet === 'seatMap' && seat !== null}
        onClose={() => {
          setSheet('none');
          setAssigned(false);
        }}
        testID="lounge-seat-sheet">
        <AppText variant="bodyBold" accessibilityRole="header">
          {LOUNGE.seatMap.title}
        </AppText>
        {assigned && seat ? (
          <AppText variant="bodyMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="lounge-seat-assigned">
            {LOUNGE.seat.assigned(seat)}
          </AppText>
        ) : null}
        {seat ? <SeatMap seat={seat} /> : null}
        <Button
          label={LOUNGE.menu.close}
          variant="secondary"
          onPress={() => {
            setSheet('none');
            setAssigned(false);
          }}
          testID="lounge-seat-close"
        />
      </BottomSheet>

      {/* 글 메뉴: 남의 글 = 인용 · 숨기기 · 신고 / 내 글 = 지우기. 프로필 · 1:1 · 첨부 0(LGF-12) */}
      <BottomSheet visible={sheet === 'msg' && target !== null} onClose={() => setSheet('none')} testID="lounge-msg-menu">
        {target ? (
          <>
            <AppText variant="bodyBold" accessibilityRole="header" testID="lounge-msg-menu-title">
              {LOUNGE.msgMenu.title(target.seat)}
            </AppText>
            {target.mine ? (
              <MenuRow
                label={LOUNGE.menu.delete}
                icon={<Icon name="photo_delete" color={colors.accent} />}
                danger
                onPress={() => {
                  setSheet('none');
                  setDialogError(null);
                  setConfirm('delete');
                }}
                testID="lounge-msg-delete"
              />
            ) : (
              <>
                {st && canWrite(st.code) ? (
                  <MenuRow
                    label={LOUNGE.menu.quote}
                    icon={<LoungeIcon name="quote_reply" color={colors.text} />}
                    onPress={() => {
                      setSheet('none');
                      setMode({ kind: 'quote', post: target });
                    }}
                    testID="lounge-msg-quote"
                  />
                ) : null}
                {st && canHideReport(st.code, st.seat) ? (
                  <>
                    <MenuRow
                      label={LOUNGE.menu.hide}
                      icon={<LoungeIcon name="hide_seat" color={colors.text} />}
                      onPress={() => {
                        setSheet('none');
                        setDialogError(null);
                        setConfirm('hide');
                      }}
                      testID="lounge-msg-hide"
                    />
                    <MenuRow
                      label={LOUNGE.menu.report}
                      icon={<Icon name="report" color={colors.accent} />}
                      danger
                      onPress={() => {
                        setReason(null);
                        setNote('');
                        setDialogError(null);
                        setSheet('report');
                      }}
                      testID="lounge-msg-report"
                    />
                  </>
                ) : null}
              </>
            )}
            <Button label={LOUNGE.menu.close} variant="secondary" onPress={() => setSheet('none')} testID="lounge-msg-close" />
          </>
        ) : null}
      </BottomSheet>

      {/* 라운지 신고(사유 5 — RP1 ~ RP3 0 · 설명 200자 · 결과 · 상대 · 신고 수 0) */}
      <BottomSheet visible={sheet === 'report' && target !== null} onClose={() => !busy && setSheet('none')} dismissable={!busy} testID="lounge-report">
        {target ? (
          <>
            <AppText variant="bodyBold" accessibilityRole="header" testID="lounge-report-title">
              {LOUNGE.report.title}
            </AppText>
            <AppText variant="small" testID="lounge-report-target">
              {LOUNGE.report.target(target.seat)}
            </AppText>
            {LOUNGE_REASONS.map((code) => (
              <View key={code}>
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: reason === code }} aria-checked={reason === code} accessibilityLabel={REASON_TEXT[code]} onPress={() => setReason(code)} effect="none" style={({ pressed }) => [styles.reason, pressed && styles.pressed]} testID={`lounge-report-${code}`}>
                  <Radio checked={reason === code} />
                  <AppText variant="body" style={styles.flex}>
                    {REASON_TEXT[code]}
                  </AppText>
                </Pressable>
                {code === 'RP6' && reason === 'RP6' ? (
                  <AppText variant="caption" testID="lounge-report-minor">
                    {REPORT_SHEET.reasonRP6Note}
                  </AppText>
                ) : null}
              </View>
            ))}
            <TextField label={REPORT_SHEET.descLabel} value={note} onChangeText={setNote} placeholder={REPORT_SHEET.descPlaceholder} maxLength={LOUNGE_NOTE_MAX} multiline testID="lounge-report-note" />
            <AppText variant="caption" testID="lounge-report-anon">
              {LOUNGE.report.note}
            </AppText>
            {dialogError ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="lounge-report-error">
                {dialogError}
              </AppText>
            ) : null}
            <Button label={LOUNGE.report.submit} variant="danger" disabled={!reason} loading={busy} onPress={() => void report()} testID="lounge-report-submit" />
            <Button label={REPORT_SHEET.cancel} variant="text" disabled={busy} onPress={() => setSheet('none')} testID="lounge-report-cancel" />
          </>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        visible={confirm === 'hide' && target !== null}
        title={target ? LOUNGE.hide.title(target.seat) : ''}
        body={LOUNGE.hide.body}
        confirmLabel={LOUNGE.hide.confirm}
        cancelLabel={LOUNGE.hide.cancel}
        busy={busy}
        error={dialogError}
        onConfirm={() => target && void hideSeat(target)}
        onCancel={() => !busy && setConfirm('none')}
        testID="lounge-hide"
      />
      <ConfirmDialog
        visible={confirm === 'reportHide' && target !== null}
        title={LOUNGE.report.hideAsk}
        sub={pairNote ? LOUNGE.report.pairNote : undefined}
        confirmLabel={LOUNGE.report.hideYes}
        cancelLabel={LOUNGE.report.hideNo}
        busy={busy}
        error={dialogError}
        onConfirm={() => target && void hideSeat(target)}
        onCancel={() => !busy && setConfirm('none')}
        testID="lounge-report-hide"
      />
      <ConfirmDialog
        visible={confirm === 'delete' && target !== null}
        title={LOUNGE.delete.title}
        body={LOUNGE.delete.body}
        confirmLabel={LOUNGE.delete.confirm}
        cancelLabel={LOUNGE.delete.cancel}
        busy={busy}
        danger
        error={dialogError}
        onConfirm={() => void remove()}
        onCancel={() => !busy && setConfirm('none')}
        testID="lounge-delete"
      />

      <LoungeToast text={toast?.text ?? null} note={toast?.note ?? null} action={toast?.action ?? null} />
    </Screen>
  );
}

// 숨긴 좌석 한 줄: '13A 좌석' · [다시 보기]
function HiddenSeatRow({ seat, onUnhide }: { seat: string; onUnhide: (seat: string) => Promise<void> }) {
  return (
    <View style={styles.hiddenRow}>
      <AppText variant="bodyMedium" style={styles.flex}>
        {LOUNGE.hidden.row(seat)}
      </AppText>
      <TextButton label={LOUNGE.hidden.unhide} onPress={() => void onUnhide(seat)} testID={`lounge-hidden-unhide-${seat}`} />
    </View>
  );
}

export const LOUNGE_INPUT_CAP = 500; // 입력칸 상한 = 보안 상한(PL-12 500자). 실제 한도(처음 200자)는 서버 조절 값이 정하고 앱은 글자 수 · 남은 수를 보이지 않는다
const LOUNGE_NOTE_MAX = 200; // 신고 설명(PL-25 · 0042)

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: alpha.pressed },
  center: { alignItems: 'center', gap: space.s12, paddingHorizontal: size.screenPadding, paddingTop: space.s48 },
  centerText: { textAlign: 'center' },
  centerBlock: { gap: space.s8, paddingHorizontal: size.screenPadding },
  pad: { paddingHorizontal: size.screenPadding },
  list: { gap: space.s16, paddingVertical: space.s16 },
  endBody: { paddingBottom: space.s32 },
  introBody: { gap: space.s16, paddingHorizontal: size.screenPadding, paddingVertical: space.s16 },
  pairNote: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.s16 },
  promise: { flexDirection: 'row', gap: space.s8, alignItems: 'flex-start' },
  dot: { width: space.s4 + space.s4 / 2, height: space.s4 + space.s4 / 2, borderRadius: radius.pill, backgroundColor: colors.accent, marginTop: space.s8 + space.s4 / 2 },
  introButtons: { gap: space.s12, paddingHorizontal: size.screenPadding, paddingVertical: space.s16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  stubBody: { gap: space.s16, padding: size.screenPadding },
  ticket: { flexDirection: 'row', minHeight: loungeLook.rowHeight * 1.5, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, overflow: 'visible' },
  ticketMain: { flex: 1, gap: space.s8, padding: space.s20, justifyContent: 'center' },
  perf: { width: 0, borderLeftWidth: loungeLook.perforation, borderStyle: 'dashed', borderColor: colors.sub, marginVertical: space.s12 },
  ticketStub: { width: loungeLook.stubWidth, alignItems: 'center', justifyContent: 'center', gap: space.s8, backgroundColor: colors.card, borderTopRightRadius: radius.xl, borderBottomRightRadius: radius.xl },
  tearOrigin: { transformOrigin: 'left bottom' },
  stubSeat: { width: loungeLook.stubSeatBox, height: loungeLook.stubSeatBox, borderRadius: radius.sm, borderWidth: loungeLook.perforation, borderStyle: 'dashed', borderColor: colors.sub },
  composer: { backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  modeBand: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingLeft: size.screenPadding, paddingRight: space.s8, backgroundColor: colors.accentSoft },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s12, paddingVertical: space.s8 },
  sendTouch: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  sendCircle: { width: layout.sendButton, height: layout.sendButton, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: alpha.disabled },
  sendError: { paddingHorizontal: size.screenPadding, paddingBottom: space.s8, gap: space.s4 },
  retryRow: { flexDirection: 'row', gap: space.s8 },
  newBelow: { position: 'absolute', alignSelf: 'center', bottom: size.input + space.s32, minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s16, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.listRow, borderBottomWidth: 1, borderBottomColor: colors.line },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touchMin },
});
