// D46 만남 장면 그림(디자인 D46-D 원본 · 본인 D-206 연출 ④ '예능 결' · 장소 10곳). 원본 디자인/D46_만남장면/원본/scene.js → scripts/gen-meet-scene.mjs → assets/illustrations/d46meet.json
//  · 그림 색은 에셋(원본 4안 색 · 인물 1안 색) 안에만 있고 이 파일과 부품에는 색이 없다(check:tokens B)
//  · 장면 좌표 360×480(3:4). 층(base · fore · light)은 장면 전체 칸, 사람 부품은 parts 의 칸(x · y · 폭 · 높이)에 잘라 담았다
//  · 그림 위 글자 · 숫자 · 상호 · 하트 0, 사람은 회원과 상관없는 고정 두 사람(K27 4-4 · 정책 P4-23)
import data from '../../assets/illustrations/d46meet.json';

// 장소 차례(K27 5-3 · 화면 T4S · 카피 16-1). 판 고정 1.0 — 늘리거나 바꾸면 '시작 주'를 정한 새 판으로(K27 5-2 #4)
export const MEET_PLACES = ['riverBench', 'hanokAlley', 'cafeTerrace', 'seasideSteps', 'localDiner', 'palaceWall', 'parkTrail', 'stationHall', 'bookWindow', 'busStop'] as const;
export type MeetPlaceKey = (typeof MEET_PLACES)[number];

export type MeetBox = readonly [number, number, number, number];
type Part = { box: MeetBox; pivot?: readonly [number, number] };
export type MeetArtData = {
  W: number;
  H: number;
  order: readonly string[];
  parts: {
    cam: { origin: readonly [number, number] };
    aFore: Part;
    aCup: Part & { elbow: readonly [number, number] };
    aFace: Part & { turn: number };
    bBody: Part;
    bLegL: Part & { swing: number };
    bLegR: Part & { swing: number };
    bSit: Part;
    bFace: Part & { turn: number };
  };
  light: string;
  people: Record<'aFore' | 'aCup_cup' | 'aCup_book' | 'aFace' | 'bBody' | 'bLegL' | 'bLegR' | 'bSit' | 'bFace', string>;
  places: Record<MeetPlaceKey, { prop: 'cup' | 'book'; base: string; fore: string | null }>;
};

export const MEET_ART = data as unknown as MeetArtData;
export const MEET_FULL: MeetBox = [0, 0, MEET_ART.W, MEET_ART.H];
