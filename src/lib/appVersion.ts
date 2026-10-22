// 동의 기록에 함께 남기는 앱 버전(consents.app_version, 32자 이하). app.json 의 version 이다.
import Constants from 'expo-constants';

export const APP_VERSION: string = (Constants.expoConfig?.version ?? 'dev').slice(0, 32);
