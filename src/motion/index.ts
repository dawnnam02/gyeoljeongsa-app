// 움직임 한 곳(F17). 화면은 움직임 · 햅틱을 이 폴더에서만 가져다 쓴다 — 값은 theme/motion.ts(장면) · theme/tokens.ts motion · bgGrad(가이드 8 · 13장), 바탕 그라데이션 그리기는 components/Screen.
//  움직임 v2(D37 '흐르는 느낌', F21)는 이 폴더에 장면 부품을 더하고 theme/motion.ts 에 값을 더하면 화면 코드를 덜 고치고 이어 붙는다.
export { dist, dur, ease, press, reduced, scene, stagger, staggerDelay, TOAST_MS, SCRIM_ALPHA, logoTile } from '@/theme/motion';
export { useReduceMotion } from '@/lib/reduceMotion';
export { haptic, onHaptic, type HapticKind } from './haptics';
export { curve, fadeIn, Fade, Land, Rise, tween } from './primitives';
export { LogoTile, StampTile } from './LogoTile';
export { SkeletonCard, SkeletonLines, SkeletonPulse } from './Skeleton';
export { MailFly } from './MailFly';
// v2 '흐르는 결정사'(D25 10장 · F21)
export { springFollow, waitStage } from '@/theme/motion';
export { AnimatedRow, ProgressBar, releaseSpring, RollingNumber, useCollapsingTitle, useWaitStage, WaitState, type WaitStage } from './flow';
export { cancelHandoff, PhotoHandoffLayer, returnHandoff, setHandoffTarget, startHandoff, useCameByHandoff, useHandoffHidesPhoto, useHandoffStore, type Rect } from './PhotoHandoff';
