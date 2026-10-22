// 10 하단 호감 버튼 규칙(F6, 2단계 통합 10-16).
// 백엔드 0011(거절 숨김, backend/S9_변경기록.md)부터 보낸 사람에게는 거절이 드러나지 않는다: 만료 시각까지 get_pair_state 'sent' · 09 liked true ·
// 11 보낸 호감 행 그대로 · send_like already_sent. 그래서 앱이 거절을 추측하던 단서 ①(이 기기에서 보냈던 상대가 'none')과 그 기억
// (rememberSent · wasSent · forgetSent)을 지웠다(S9 4장 조건 2 · 3 · 4).
// 남는 규칙 ②(팀장 결정): 거절한 사람(B)이 같은 날 오늘 추천에서 보낸 사람(A)을 열면 'none' 이지만 [호감 보내기]는 forbidden 이다(B 본인이 거절했으니 비밀은 아니다).
// 그때는 오류 글 없이 [호감 보내기]만 숨긴다 — sendFailureMode('unavailable', 프로필이 아직 보임) = 'hidden'.
import type { ActionFailure, PairState } from '@/lib/recsApi';

// 10 하단의 호감 버튼 모양
//  send      [호감 보내기]
//  limit     흐린 [호감 보내기] + NK04(오늘 한도를 다 씀)
//  sent      "호감 보냄"(흐림) — 0011 뒤에는 상대가 거절했어도 만료 시각까지 이 모양이다
//  received  [거절] [수락] (11 받은 호감과 같은 동작, like_id 는 get_pair_state 가 준다)
//  connected 안내 "서로 수락했어요 · 연락 방법은 준비 중이에요"
//  hidden    [호감 보내기]를 그리지 않는다(규칙 ②). 거절을 알리는 글도 없다
export type LikeButtonMode = 'send' | 'limit' | 'sent' | 'received' | 'connected' | 'hidden';

export function likeButtonMode(pair: Pick<PairState, 'state' | 'likesLeft'> | null): LikeButtonMode {
  if (!pair) return 'send'; // 상태를 못 읽으면 지금처럼 보이고 서버가 보낼 때 최종으로 막는다
  if (pair.state === 'connected') return 'connected';
  if (pair.state === 'received') return 'received';
  if (pair.state === 'sent') return 'sent';
  if (pair.likesLeft === 0) return 'limit';
  return 'send';
}

// [호감 보내기]가 실패한 뒤. stillVisible = 실패 직후 get_candidate_profile 이 아직 프로필을 주는가
//  hidden      규칙 ②(거절한 사람이 같은 날 연 상대): 버튼만 숨기고 아무 글도 보이지 않는다
//  unavailable 프로필도 볼 수 없음: "이 프로필은 더 이상 볼 수 없어요."(F5 그대로)
//  limit · sent 한도 · 이미 보냄(F5 그대로)
//  error       "호감을 보내지 못했어요…" 또는 인터넷 문구(F5 그대로)
export type SendFailureMode = 'hidden' | 'unavailable' | 'limit' | 'sent' | 'error';

export function sendFailureMode(reason: ActionFailure, stillVisible: boolean): SendFailureMode {
  if (reason === 'unavailable') return stillVisible ? 'hidden' : 'unavailable';
  if (reason === 'limit') return 'limit';
  if (reason === 'already') return 'sent';
  return 'error';
}
