// 화면 ID 15 인증 실패 = 02 의 '인증번호 틀림' 모양(점검용). 본문은 features/auth(F1).
import { SignInScreen } from '@/features/auth/SignInScreen';

export default function SignInCodeErrorRoute() {
  return <SignInScreen preview="code-error" />;
}
