// 채팅 아이콘 다섯(사진 · 마이크 · 재생 · 멈춤 · 녹음 멈춤) — D42-C 1안 실선 1.5(20 이하 1.75). 그림은 공용 아이콘(components/Icon)이 그린다.
//  옛 그림(선 2 · 재생 · 멈춤 채움)은 1안 경로로 바뀌었다. 색은 토큰만(부르는 쪽이 colors.* 를 넘긴다). 꾸밈 그림이라 스크린리더는 건너뛰고, 이름은 누르는 부품이 가진다
import { Icon, type IconName } from '@/components/Icon';

export type ChatIconName = 'photo' | 'mic' | 'play' | 'pause' | 'stop';

const NAME: Record<ChatIconName, IconName> = { photo: 'photo', mic: 'mic', play: 'play', pause: 'pause', stop: 'stop' };

export function ChatIcon({ name, color, size = 24 }: { name: ChatIconName; color: string; size?: number }) {
  return <Icon name={NAME[name]} color={color} size={size} />;
}
