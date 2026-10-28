// 데모 모드의 내 여행 타입(IF2-F · F-19) — 서버 타입 코드 · 열두 타입 이름 · 설명 · 잘 맞는 타입 표가 아직 없다(청사진 15장 원문 지워짐 · 카피 21-21 'AI IF2-A 몫' · 미확인).
//  화면 틀을 보이려고 디자인 시안(디자인/IF2_기내서비스/index.html '타입 엽서')의 표본 한 타입만 둔다 — 데모 표시용이고 실서버에는 없다(실서버 = 타입 없음 → 칸 0).
//  노선도 이웃 타입은 원문이 없어 비워 둔다(내 역만). 이름 · 설명은 {타입 이름} · {설명} 자리에 들어가는 라이브러리 값 자리(카피 키 아님)
import type { TypeSource } from '@/features/inflight/inflightService';

export const demoTypeSource: TypeSource = {
  mine: async () => ({ name: '느린 기차 여행자', lines: ['창밖을 오래 보는 사람처럼, 천천히 알아 가는 대화를 좋아해요.'], route: [] }),
};
