// AI 시험판(AIT) 화면 글 꺼내기. 글은 content/aitCopy.ts(카피 23장 사본)에만 있다 — 화면은 이 함수로만 읽는다.
//  {이름} 자리는 값으로 채운다(받침 조사 자리 없음). 값이 없는 자리는 그대로 둔다.
import { AIT_TEXT, type AitKey } from '@/content/aitCopy';

export function ait(key: AitKey, vals: Readonly<Record<string, string>> = {}): string {
  let out: string = AIT_TEXT[key];
  for (const [name, v] of Object.entries(vals)) out = out.split(`{${name}}`).join(v);
  return out;
}

export type { AitKey };
