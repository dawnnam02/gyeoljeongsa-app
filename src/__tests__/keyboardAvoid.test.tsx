import fs from 'fs';
import path from 'path';
import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { KeyboardAvoid } from '@/components/KeyboardAvoid';

describe('Q5A-06 키보드 가림', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });
  it('iOS 는 padding, Android 는 따로 하지 않는다', () => {
    for (const [os, expected] of [['ios', 'padding'], ['android', undefined]] as const) {
      Platform.OS = os;
      let r!: TestRenderer.ReactTestRenderer;
      act(() => {
        r = TestRenderer.create(<KeyboardAvoid>{null}</KeyboardAvoid>);
      });
      expect(r.root.findByType(KeyboardAvoidingView).props.behavior).toBe(expected);
    }
  });
  it('글자 입력 화면 4곳이 감싼다 (요약 고치기 · 설문 입력 · 신고 사유 · 탈퇴 인증번호)', () => {
    for (const f of ['ai/TraitsScreen.tsx', 'surveyLite/SurveyLiteScreen.tsx', 'safety/ReportBlockSheet.tsx', 'settings/WithdrawFlow.tsx']) {
      expect(fs.readFileSync(path.join(__dirname, '..', 'features', f), 'utf8')).toContain('<KeyboardAvoid>');
    }
  });
});
