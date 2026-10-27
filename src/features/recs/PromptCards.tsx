// 10 상대 상세 '질문 카드' 칸(F24 후속 · D-142 · v4 R1 [6] 질문 소개 · R2 H04 결혼 이야기 · 카피.md NF6-08).
//  · Hinge 처럼 질문 하나 + 그 사람의 답 글을 종이 카드 한 장에. 카드 2~3장(서버 칸 순서, 3장까지)
//  · 서버 계약(S14 · 0018): get_candidate_profile 의 prompts: [{ code, question, answer }] — 질문 소개 Q01~Q16 · 결혼 이야기 Q17~Q24 가 같은 3칸.
//    스위치 꺼짐 · 공개 토글 끔 · 운영 숨김 · 쓴 것 없음이면 키 자체가 없다 → 칸 전체를 그리지 않는다. hint · 판정 키는 상대 쪽에 없다(읽지도 않는다)
//  · 글: 구역 제목 '저를 소개해요'(profile_prompts.candidateTitle) · 질문은 작은 글씨, 답은 본문 · 아래 받는 쪽 고정 한 줄(NF10-04 CONTACT_HINT.receiverNote)
//  · 점수 · 등급 · 비교 숫자 0. 자기소개(T01)는 '나만 보기'라 여기 오지 않는다
//  · 데이터 길: readPrompts(raw.prompts) — lib/recsApi 의 parseCandidate 가 이 함수로 prompts 를 읽어 detail.prompts 로 넘겨야 화면에 나온다(F24 변경기록 '넣는 줄')
//  · 놓는 곳(F21 이 넣음): features/recs/CandidateScreen 의 사진 · 한눈에 줄(candidate-glance) 바로 다음(질문 카드가 상대를 알게 하는 중심), 그 뒤 결혼관 칸 — <PromptCards prompts={data.prompts} />
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ContactReceiverNote } from '@/components/ContactHint';
import { space } from '@/theme/tokens';

export const PROMPT_CARDS = {
  title: '저를 소개해요', // profile_prompts.candidateTitle
} as const;

export const PROMPT_CARD_MAX = 3;
export type PromptCard = { code: string; question: string; answer: string };

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

// 서버 prompts 읽기: 아는 키(code · question · answer)만, 빈 글 · 모양이 틀린 줄은 빼고, 3장까지. 배열이 아니면 빈 목록
export function readPrompts(raw: unknown): PromptCard[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptCard[] = [];
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    const code = text(r.code);
    const question = text(r.question);
    const answer = text(r.answer);
    if (code && question && answer && !out.some((x) => x.code === code)) out.push({ code, question, answer });
    if (out.length === PROMPT_CARD_MAX) break;
  }
  return out;
}

// noteHidden: v5 공개 뒤 10(QP-01) — 짝과는 이미 대화방이 열려 있어 '서로 수락한 뒤의 연락 방법' 한 줄(NF10-04)을 그리지 않는다
export function PromptCards({ prompts, testID = 'candidate-prompts', noteHidden = false }: { prompts: readonly PromptCard[] | null | undefined; testID?: string; noteHidden?: boolean }) {
  const cards = (prompts ?? []).slice(0, PROMPT_CARD_MAX);
  if (cards.length === 0) return null;
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
        {PROMPT_CARDS.title}
      </AppText>
      {cards.map((c, i) => (
        <Card key={c.code} variant="paper" style={styles.card} accessible accessibilityLabel={`${c.question} ${c.answer}`} testID={`${testID}-${i}`}>
          <AppText variant="caption" testID={`${testID}-${i}-q`}>
            {c.question}
          </AppText>
          <AppText variant="body" testID={`${testID}-${i}-a`}>
            {c.answer}
          </AppText>
        </Card>
      ))}
      {noteHidden ? null : <ContactReceiverNote testID={`${testID}-note`} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.s12 },
  card: { gap: space.s8 },
});
