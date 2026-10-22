// 설문 v2(F20)가 서버와 주고받는 일. 실서버와 데모(src/demo/surveyV2Backend.ts)가 같은 이 코드를 지난다 — 데모는 같은 이름 · 같은 응답 모양의 가짜 클라이언트를 넣는다.
//  서버 이름은 V2_SERVER 한 곳. '있음' = 지금 서버(migrations)에 있는 함수 · 표, '가정' = 백엔드 S16 이 만드는 중이라 이름을 가정한 것(작업중) → app/F20_변경기록.md '서버 이름 맞출 곳'
//  · 읽기: survey_answers(v2 키) · free_texts(T01~T09) · get_my_prompts(결혼 이야기 Q17~Q24 = K12 6 질문 소개와 같은 3칸) · visibility_settings(결혼관 6열) · get_progress(첫 빈 문항)
//  · 저장: save_answers(값 묶음, '말하고 싶지 않아요' = null) · clear_answers(숨은 문항 옛 값) · save_free_texts(3개씩) · save_my_prompt / delete_my_prompt · visibility_settings 열 단위 update
//  · 학교 검색: 앱 내장 목록(M14 7장 권고 '앱 내장')으로 찾는다. 데모는 서버 검색 함수(S16 search_schools: 배열 · way · 과정 이름) 모양으로 돌려준다
//  · 어필 카드를 저장하면 S16 Edge appeal-analyze 를 부른다(기다리지 않음 · 점수는 앱에 오지 않음)
//  · 증빙: 서류 인증 흐름(K12 7, 4번째 종류 appeal)이 아직 없어 실서버에서는 버튼을 숨긴다(proofUpload=false). 데모만 '확인 중'까지
//  로그에는 이벤트 이름과 코드만 남긴다(답 · 글 · 학교 이름 금지).
import type { SupabaseClient } from '@supabase/supabase-js';

import { schoolIndex, type SchoolCourse, type MatchVia } from '@/data/schools/schoolSearch';
import { safeLog } from '@/lib/log';
import { loadProgressStage } from '@/lib/progress';
import { readDbFailure } from '@/lib/serverError';

import { PUBLIC_TOGGLE_IDS, qOf, STORY, TEXT_IDS, FLOW } from './model';
import type { ProofState, V2Value } from './types';

export const V2_SERVER = {
  saveAnswers: 'save_answers', // 있음(0004). v2 키 · 코드 값은 S16 이 survey_items 시드를 v2 CSV 로 바꾼 뒤 통과(설문_v2 5-7 ①)
  clearAnswers: 'clear_answers', // 가정: { p_ids: text[] } 숨은 문항의 옛 값 지우기(설문_v2 2-6 마지막 줄)
  saveTexts: 'save_free_texts', // 있음(0004). 한 번에 3개까지라 3개씩 나눠 보낸다. T04~T09 허용은 S16(ID 검사 T0[1-9])
  getPrompts: 'get_my_prompts', // 있음(0018)
  savePrompt: 'save_my_prompt', // 있음(0018). Q17~Q24 는 prompt_catalog 새 8행(S16 · K12 6)
  deletePrompt: 'delete_my_prompt', // 있음(0018)
  progress: 'get_progress', // 있음(0007). facts.survey_first_missing 을 v2 조건부 필수 기준으로(S16 ⑬)
  searchSchools: 'search_schools', // S16(0023 작업중): (p_query, p_courses text[] 과정 이름, p_limit ≤20, p_include_closed) → [{school_key, name, now_name, matched, way, course}] · 수준 · 점수 없음
  schoolIndexInfo: 'get_school_index_info', // S16: {version, sha256, rows, search_ready} — 앱 내장 목록 판 비교(지금은 부르지 않음, 판 갱신 때)
  appealAnalyze: 'appeal-analyze', // S16 Edge: 어필 카드 저장 뒤 POST {} → {ok, status: done · unchanged · empty} | {ok:false, status: failed} | {off} (점수 0)
  proof: 'appeal-proof', // 가정: 증빙 올리기(K12 7 서류 인증 appeal 종류 — S16 에 앱 함수 없음, 운영 private.appeal_set_proof 만) → 실서버는 버튼 숨김
  visibility: 'visibility_settings', // 있음(표). 결혼관 6열(e01_wedding_time …)은 S16 이 더한다
} as const;

export type V2Failure = 'network' | 'server';
export type V2Snapshot = {
  readonly userKey: string; // 로컬 저장 열쇠 · 섞기 씨앗(사용자 ID). 화면에 보이지 않는다
  readonly answers: Readonly<Record<string, V2Value>>; // 서버에 저장된 v2 답(글 T01~T03 포함)
  readonly appeal: Readonly<Record<string, string>>; // T04~T09
  readonly stories: Readonly<Record<string, string>>; // Q17~Q24
  readonly storySlotsFree: number; // 3 − 결혼 이야기가 아닌 질문 소개 수(08 에서 쓴 것)
  readonly publicOn: Readonly<Record<string, boolean>>; // 결혼관 공개 스위치(문항 ID → 켬)
  readonly proofs: Readonly<Record<string, ProofState>>;
  readonly firstMissing: string | null; // 서버가 알려 준 첫 빈 문항
};
export type SaveBatch = {
  readonly answers?: Readonly<Record<string, V2Value>>;
  readonly clear?: readonly string[];
  readonly texts?: Readonly<Record<string, string | null>>; // null = 지움(빈 글)
  readonly stories?: Readonly<Record<string, string | null>>;
  readonly publicOn?: Readonly<Record<string, boolean>>;
};
export type SchoolResult = {
  readonly school_key: string;
  readonly name: string;
  readonly now_name: string;
  readonly course: SchoolCourse;
  readonly kind: string;
  readonly matched: string;
  readonly via: MatchVia;
  readonly cho: boolean;
};
export type LoadOutcome = { ok: true; data: V2Snapshot } | { ok: false; reason: V2Failure };
export type SaveOutcome = { ok: true } | { ok: false; reason: V2Failure };
export type SearchOutcome = { ok: true; rows: readonly SchoolResult[] } | { ok: false; reason: V2Failure };
export type ProofOutcome = { ok: true; state: ProofState } | { ok: false; reason: V2Failure };

export type SurveyV2Api = {
  readonly demo: boolean;
  readonly proofUpload: boolean;
  load(): Promise<LoadOutcome>;
  save(batch: SaveBatch): Promise<SaveOutcome>;
  searchSchools(query: string, options: { courses?: readonly SchoolCourse[]; limit?: number }): Promise<SearchOutcome>;
  uploadProof(card: string): Promise<ProofOutcome>;
  submit(): Promise<SaveOutcome>;
};

export const V2_ANSWER_IDS: readonly string[] = FLOW.map((q) => q.id).filter((id) => !TEXT_IDS.includes(id));
const STORY_IDS = STORY.map((q) => q.id);
const APPEAL_IDS = TEXT_IDS.filter((id) => !['T01', 'T02', 'T03'].includes(id));
const PROOF_STATES: readonly ProofState[] = ['none', 'pending', 'ok', 'retry'];
export const toggleColumn = (id: string): string => qOf(id).toggle ?? id.toLowerCase();

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
type DbError = { code?: string | null; message?: string | null };
const reasonOf = (error: DbError): V2Failure => (readDbFailure(error).network ? 'network' : 'server');
const codeOf = (error: DbError) => String(error.code ?? error.message ?? 'unknown').split(':')[0].slice(0, 30);

// 과정 코드 ↔ 서버 과정 이름(S16 school_tiers.course)
const COURSE_NAME: Readonly<Record<SchoolCourse, string>> = { U: '대학교', C: '전문대학', G: '대학원', H: '고등학교', X: '목록밖' };
const COURSE_CODE: Readonly<Record<string, SchoolCourse>> = Object.fromEntries(Object.entries(COURSE_NAME).map(([k, v]) => [v, k as SchoolCourse]));
// 서버 way(맞은 방식, M14 3장 글자) → 앱 표시 구분
const VIA_OF: Readonly<Record<string, MatchVia>> = { '옛 이름': 'old', 별칭: 'alias', '다른 이름': 'alias', 영문: 'en' };
const WAY_OF: Readonly<Record<MatchVia, string>> = { name: '이름', old: '옛 이름', alias: '별칭', en: '영문' };

// 내장 목록 검색 결과 → 서버 검색 함수(search_schools)와 같은 줄 모양(S16 2장)
export function serverSchoolRows(query: string, options: { courses?: readonly SchoolCourse[]; limit?: number }): Record<string, unknown>[] {
  return schoolIndex()
    .search(query, { limit: Math.min(options.limit ?? 10, 20), courses: options.courses })
    .map((h) => ({
      school_key: h.row.key,
      name: h.row.name,
      now_name: h.row.now || h.row.name,
      matched: h.matched,
      way: h.step >= 6 ? '오타 1글자' : h.cho ? '초성' : h.step % 2 === 1 ? WAY_OF[h.via] : (['이름', '', '이름 앞부분', '', '이름 중간'][h.step] ?? '이름'),
      course: COURSE_NAME[h.row.course],
    }));
}

// 화면이 쓰는 검색 결과(내장 목록)
export function localSchoolSearch(query: string, options: { courses?: readonly SchoolCourse[]; limit?: number }): SchoolResult[] {
  return schoolIndex()
    .search(query, { limit: options.limit ?? 8, courses: options.courses })
    .map((h) => ({ school_key: h.row.key, name: h.row.name, now_name: h.row.now || h.row.name, course: h.row.course, kind: h.row.kind, matched: h.matched, via: h.via, cho: h.cho }));
}

// 서버 응답(S16: 배열, 예전 가정: {rows}) → 화면 줄. 종류(kind)는 서버가 주지 않아 내장 목록에서 채운다
export function readSchoolRows(data: unknown): SchoolResult[] | null {
  const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.rows) ? data.rows : null;
  if (!list) return null;
  const out: SchoolResult[] = [];
  for (const r of list) {
    if (!isRecord(r) || typeof r.school_key !== 'string' || typeof r.name !== 'string') continue;
    out.push({
      school_key: r.school_key,
      name: r.name,
      now_name: typeof r.now_name === 'string' ? r.now_name : r.name,
      course: COURSE_CODE[String(r.course)] ?? ((['U', 'C', 'G', 'H', 'X'].includes(String(r.course)) ? r.course : 'X') as SchoolCourse),
      kind: typeof r.kind === 'string' ? r.kind : (schoolIndex().byKey(r.school_key)?.kind ?? ''),
      matched: typeof r.matched === 'string' ? r.matched : r.name,
      via: VIA_OF[String(r.way)] ?? ((['name', 'old', 'alias', 'en'].includes(String(r.via)) ? r.via : 'name') as MatchVia),
      cho: r.way === '초성' || r.cho === true,
    });
  }
  return out;
}

export type V2ApiOptions = { demo: boolean; proofUpload: boolean; schoolSearch: 'local' | 'server' };

export function createSurveyV2Api(client: SupabaseClient, options: V2ApiOptions = { demo: false, proofUpload: false, schoolSearch: 'local' }): SurveyV2Api {
  // 질문 소개 칸: 결혼 이야기 코드 → 칸 번호(바꾸기 · 지우기), 다른 질문 소개가 쓰는 칸
  let slotOf: Record<string, number> = {};
  let otherSlots: number[] = [];

  async function readPrompts(): Promise<{ stories: Record<string, string>; free: number }> {
    const { data, error } = await client.rpc(V2_SERVER.getPrompts);
    slotOf = {};
    otherSlots = [];
    if (error || !isRecord(data) || !Array.isArray(data.prompts)) return { stories: {}, free: 3 }; // 스위치 꺼짐(off) · 오류면 결혼 이야기만 3칸
    const stories: Record<string, string> = {};
    for (const p of data.prompts) {
      if (!isRecord(p) || typeof p.slot !== 'number' || typeof p.code !== 'string') continue;
      if (STORY_IDS.includes(p.code) && typeof p.answer === 'string') {
        stories[p.code] = p.answer;
        slotOf[p.code] = p.slot;
      } else otherSlots.push(p.slot);
    }
    return { stories, free: Math.max(0, 3 - otherSlots.length) };
  }

  const freeSlot = () => [1, 2, 3].find((s) => !otherSlots.includes(s) && !Object.values(slotOf).includes(s)) ?? null;

  return {
    demo: options.demo,
    proofUpload: options.proofUpload,

    async load() {
      const session = await client.auth.getSession();
      const userKey = session.data.session?.user?.id ?? 'guest';
      const answersQ = await client.from('survey_answers').select('question_id,value').in('question_id', [...V2_ANSWER_IDS]);
      if (answersQ.error) return { ok: false, reason: reasonOf(answersQ.error) };
      const textsQ = await client.from('free_texts').select('question_id,body').in('question_id', [...TEXT_IDS]);
      if (textsQ.error) return { ok: false, reason: reasonOf(textsQ.error) };
      const answers: Record<string, V2Value> = {};
      for (const row of (answersQ.data ?? []) as unknown[]) {
        if (isRecord(row) && typeof row.question_id === 'string' && V2_ANSWER_IDS.includes(row.question_id)) answers[row.question_id] = (row.value ?? null) as V2Value;
      }
      const appeal: Record<string, string> = {};
      for (const row of (textsQ.data ?? []) as unknown[]) {
        if (!isRecord(row) || typeof row.question_id !== 'string' || typeof row.body !== 'string') continue;
        if (row.question_id.startsWith('T0') && Number(row.question_id.slice(2)) <= 3) answers[row.question_id] = row.body;
        else appeal[row.question_id] = row.body;
      }
      const { stories, free } = await readPrompts();
      const publicOn: Record<string, boolean> = {};
      const vis = await client.from(V2_SERVER.visibility).select('*').maybeSingle();
      if (!vis.error && isRecord(vis.data)) for (const id of PUBLIC_TOGGLE_IDS) if (vis.data[toggleColumn(id)] === true) publicOn[id] = true;
      const progress = await loadProgressStage(client);
      const proofs: Record<string, ProofState> = {};
      if (options.proofUpload) {
        const st = await client.functions.invoke(V2_SERVER.proof, { body: { action: 'status' } });
        if (!st.error && isRecord(st.data) && isRecord(st.data.proofs)) {
          for (const [card, s] of Object.entries(st.data.proofs)) if (PROOF_STATES.includes(s as ProofState)) proofs[card] = s as ProofState;
        }
      }
      return {
        ok: true,
        data: { userKey, answers, appeal, stories, storySlotsFree: free, publicOn, proofs, firstMissing: progress.ok ? progress.facts?.surveyFirstMissing ?? null : null },
      };
    },

    async save(batch) {
      const answers = batch.answers ?? {};
      if (Object.keys(answers).length > 0) {
        const { error } = await client.rpc(V2_SERVER.saveAnswers, { p_answers: answers });
        if (error) {
          safeLog({ event: 'v2.save.fail', code: codeOf(error) });
          return { ok: false, reason: reasonOf(error) };
        }
      }
      if (batch.clear && batch.clear.length > 0) {
        const { error } = await client.rpc(V2_SERVER.clearAnswers, { p_ids: [...batch.clear] });
        if (error) safeLog({ event: 'v2.clear.fail', code: codeOf(error) }); // 막지 않는다: 서버도 숨은 문항을 계산에서 뺀다(S16)
      }
      const texts = Object.entries(batch.texts ?? {});
      for (let i = 0; i < texts.length; i += 3) {
        const part = Object.fromEntries(texts.slice(i, i + 3).map(([id, body]) => [id, body ?? '']));
        const { error } = await client.rpc(V2_SERVER.saveTexts, { p_texts: part });
        if (error) {
          safeLog({ event: 'v2.save_text.fail', code: codeOf(error) });
          return { ok: false, reason: reasonOf(error) };
        }
      }
      // 어필 카드(T04~T09)를 저장했으면 분석을 부른다(S16 Edge appeal-analyze). 기다리지 않고 막지 않는다 — 같은 글이면 서버가 다시 부르지 않는다(unchanged)
      if (texts.some(([id]) => APPEAL_IDS.includes(id))) {
        void client.functions
          .invoke(V2_SERVER.appealAnalyze, { body: {} })
          .then(({ error }) => {
            if (error) safeLog({ event: 'v2.appeal_analyze.fail', code: 'invoke' });
          })
          .catch(() => safeLog({ event: 'v2.appeal_analyze.fail', code: 'throw' }));
      }
      for (const [code, answer] of Object.entries(batch.stories ?? {})) {
        if (answer === null) {
          const slot = slotOf[code];
          if (slot === undefined) continue;
          const { error } = await client.rpc(V2_SERVER.deletePrompt, { p_slot: slot });
          if (error) return { ok: false, reason: reasonOf(error) };
          delete slotOf[code];
          continue;
        }
        const slot = slotOf[code] ?? freeSlot();
        if (slot === null) return { ok: false, reason: 'server' };
        const { data, error } = await client.rpc(V2_SERVER.savePrompt, { p_slot: slot, p_code: code, p_answer: answer });
        if (error || !isRecord(data) || data.ok !== true) {
          safeLog({ event: 'v2.story.fail', code: error ? codeOf(error) : isRecord(data) ? String(data.error ?? (data.off ? 'off' : 'unknown')) : 'unknown' });
          return { ok: false, reason: error ? reasonOf(error) : 'server' };
        }
        slotOf[code] = slot;
      }
      const vis = Object.entries(batch.publicOn ?? {});
      if (vis.length > 0) {
        const { error } = await client.from(V2_SERVER.visibility).update(Object.fromEntries(vis.map(([id, on]) => [toggleColumn(id), on])));
        if (error) safeLog({ event: 'v2.visibility.fail', code: codeOf(error) }); // 막지 않는다: 08 에서 다시 켤 수 있다
      }
      return { ok: true };
    },

    async searchSchools(query, opts) {
      if (options.schoolSearch === 'local') return { ok: true, rows: localSchoolSearch(query, opts) };
      const courses = opts.courses ? opts.courses.map((c) => COURSE_NAME[c]) : null;
      const { data, error } = await client.rpc(V2_SERVER.searchSchools, { p_query: query, p_courses: courses, p_limit: Math.min(opts.limit ?? 8, 20), p_include_closed: true });
      if (error) return { ok: false, reason: reasonOf(error) };
      const rows = readSchoolRows(data);
      return rows ? { ok: true, rows } : { ok: false, reason: 'server' };
    },

    async uploadProof(card) {
      if (!options.proofUpload) return { ok: false, reason: 'server' };
      const { data, error } = await client.functions.invoke(V2_SERVER.proof, { body: { action: 'upload', card } });
      if (error) return { ok: false, reason: 'network' };
      return isRecord(data) && data.ok === true && PROOF_STATES.includes(data.state as ProofState) ? { ok: true, state: data.state as ProofState } : { ok: false, reason: 'server' };
    },

    // 실서버에는 '제출' 표가 따로 없다: 문항마다 저장한 답이 곧 제출이고, 완료 판정은 get_progress 가 한다(임시 설문과 같은 규칙)
    async submit() {
      return { ok: true };
    },
  };
}
