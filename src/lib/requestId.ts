// 서버에 같은 요청을 두 번 보내도 한 번만 처리되게 하는 요청 ID(uuid v4 모양, 서버 p_request_id uuid).
// 보안용 난수가 아니라 중복 방지용 이름표다. 버튼을 한 번 눌러 만든 ID 를 다시 시도할 때도 그대로 쓴다(부르는 쪽이 들고 있는다).
export function newRequestId(random: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('');
  const variant = (8 + Math.floor(random() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}
