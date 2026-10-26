// 이용약관의 한 조만 읽는 시트(L17A · D-190 ⑤). 글은 법무/약관.md 게시본(LEGAL_TERMS, gen:legal) 그대로 — 조 제목(h) 줄부터 다음 제목 줄 앞까지.
//  · 탑승권 구매 시트의 '결혼중개 계약 설명 보기' → 제14조의2(탑승권과 크레딧, ③ 결혼중개 계약의 주요 내용 · 다시 보기 — 변호사 확인 BR09)
//  · 시트 제목은 조 제목 글 그대로. 조를 못 찾으면(법무 글이 바뀐 경우) 약관 전체를 보인다 — 글을 지어내지 않는다
import { FullSheet } from '@/components/FullSheet';
import { LegalBlockList } from '@/components/LegalBlocks';
import { CONSENT } from '@/content/copy';
import { LEGAL_TERMS } from '@/content/legalTerms';
import type { LegalBlock } from '@/content/types';

export function termsArticle(prefix: string, blocks: readonly LegalBlock[] = LEGAL_TERMS): { title: string; blocks: readonly LegalBlock[] } | null {
  const at = blocks.findIndex((b) => b.type === 'h' && b.text.startsWith(`${prefix} `));
  if (at < 0) return null;
  const head = blocks[at] as Extract<LegalBlock, { type: 'h' }>;
  let end = at + 1;
  while (end < blocks.length && blocks[end].type !== 'h') end += 1;
  return { title: head.text, blocks: blocks.slice(at + 1, end) };
}

export function TermsArticleSheet({ visible, prefix, onClose, testID }: { visible: boolean; prefix: string; onClose: () => void; testID?: string }) {
  const article = termsArticle(prefix);
  return (
    <FullSheet visible={visible} title={article?.title ?? CONSENT.documents.terms} onClose={onClose} testID={testID}>
      <LegalBlockList blocks={article?.blocks ?? LEGAL_TERMS} testID={testID ? `${testID}-list` : undefined} />
    </FullSheet>
  );
}
