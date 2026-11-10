// RS2-01 [마]3 · 점검 스크립트가 강제로 끝나도(시간 초과로 프로세스째 종료 · 작업 관리자) 헤드리스 브라우저가 남지 않게 하는 감시 프로세스.
//  Edge 는 node 가 만든 작업 묶음(job)에서 빠져나와 살기 때문에, 점검을 띄운 node 가 'exit' 알림 없이 죽으면 브라우저 나무가 그대로 남는다(점검마다 쌓임).
//  사용: node browser-reaper.mjs <점검 node pid> <프로필 폴더> <브라우저 첫 pid> [이름 거름]
//  점검 node 가 사라지면 프로필 폴더로 찾은 브라우저 나무를 모두 끝내고 스스로 끝난다. 점검이 정상으로 끝나면 점검 쪽이 이 감시를 먼저 끝낸다(close).
import { killBrowserTree } from './browser.mjs';

const [mainPid, profile, browserPid, nameSource] = process.argv.slice(2);
const alive = (pid) => {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM'; // 있지만 권한이 없는 것도 살아 있는 것
  }
};

if (mainPid && profile) {
  const tick = setInterval(() => {
    if (alive(mainPid)) return;
    clearInterval(tick);
    killBrowserTree({ pid: Number(browserPid) || 0 }, profile, nameSource ? new RegExp(nameSource, 'i') : undefined);
    process.exit(0);
  }, 1000);
}
