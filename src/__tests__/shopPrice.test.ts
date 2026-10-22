import { ptsText } from '@/features/grade/gradeLogic';
import { priceOf, subViewOf } from '@/features/shop/shopLogic';
import { subStatusText } from '@/features/shop/SubPages';
import type { ShopProduct } from '@/lib/shopApi';

const p = (catalogId: string, priceKrw: number | null) => ({ catalogId, priceKrw, name: '이름' }) as unknown as ShopProduct;

describe('Q5A-05 가격은 서버 price_krw 우선', () => {
  it('서버 금액이 카피와 다르면 서버 금액으로, 앞뒤 말은 그대로', () => {
    expect(priceOf(p('N01', 15900))).toBe('월 15,900원');
    expect(priceOf(p('N02', 5500))).toBe('5,500원 · 3명');
  });
  it('같으면 그대로 · 서버 금액이 없거나 0이면 카피 그대로', () => {
    expect(priceOf(p('N01', 14900))).toBe('월 14,900원');
    expect(priceOf(p('N01', null))).toBe('월 14,900원');
    expect(priceOf(p('G7', 0))).toBe('무료');
  });
  it('카피에 금액이 없는 글은 그대로, 카피 없는 상품은 서버 금액', () => {
    expect(priceOf(p('G8', 3000))).toBe('구독에 포함');
    expect(priceOf(p('ZZ', 1234))).toBe('1,234원');
  });
});

describe('Q5A-12 · 13 · 18', () => {
  it('13: 0.95 이상은 정수, 그 밑은 소수 한 자리', () => {
    expect([ptsText(0.96), ptsText(0.94), ptsText(1), ptsText(41.3)]).toEqual(['1', '0.9', '1', '41']);
  });
  const shop = (sub: object) => ({ subscription: { status: 'active', active: true, autoRenew: true, priceIncreasePending: false, periodEnd: null, ...sub } }) as never;
  it('12: 끝나는 날이 없으면 "에 갱신돼요" 같은 깨진 글이 없다', () => {
    expect(subStatusText(shop({}))).toBe('이용 중');
    expect(subStatusText(shop({ autoRenew: false }))).toBe('이용 중');
  });
  it('18: billing_retry 는 active=false 여도 결제 문제 안내', () => {
    expect(subViewOf(shop({ status: 'billing_retry', active: false }))).toBe('problem');
  });
});
