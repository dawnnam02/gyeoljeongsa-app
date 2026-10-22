import * as shopCopy from '@/content/shopCopy';
import { REFUND_GUIDE, SHOP16 } from '@/content/shopCopy';
import { sellerText } from '@/features/shop/parts';

describe('Q5A-03 판매자 줄', () => {
  it('값이 모두 비어 있으면 변수 글을 보이지 않고 null(준비 중 한 줄)', () => {
    const t = sellerText(REFUND_GUIDE.seller);
    expect(t).toBeNull();
    expect(SHOP16.sellerSoon).toBe('판매자 정보는 준비 중이에요.'); // F16: 가안(_DRAFT)에서 정식(카피 16-O)으로, 글자는 그대로
    expect('SELLER_SOON_DRAFT' in shopCopy).toBe(false);
  });
  it('변수 글자({…})가 결과에 남지 않는다', () => {
    expect(sellerText('판매자: {없는 값} · 대표 {대표자}') ?? '').not.toMatch(/[{}]/);
  });
});
