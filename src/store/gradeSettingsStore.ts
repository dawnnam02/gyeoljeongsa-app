// 12 설정 '등급 계산 멈추기' 스위치가 기억하는 값(F13). 서버에 멈춤 여부를 읽는 함수가 따로 없다(스키마 11-2: get_my_grade 의 reason 'stopped' 는 구독자에게만 온다).
// 그래서 구독자는 get_my_grade 로 서버 값을 읽어 이 값을 맞추고, 비구독자는 이 기기에서 바꾼 값을 메모리에 들고 있는다(앱을 다시 켜면 '계산 중'으로 돌아간다 — 서버 어긋남 목록).
import { create } from 'zustand';

type State = { stopped: boolean; subscribed: boolean };
export const useGradeSettingsStore = create<State>(() => ({ stopped: false, subscribed: false }));
export const resetGradeSettings = () => useGradeSettingsStore.setState({ stopped: false, subscribed: false });
