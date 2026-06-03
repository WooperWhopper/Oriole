// expo-speech wrapper, ko-KR, graceful fallback when no Korean voice is installed.
import * as Speech from 'expo-speech';

let koAvailable: boolean | null = null;

export async function checkKoreanVoice(): Promise<boolean> {
  if (koAvailable !== null) return koAvailable;
  const voices = await Speech.getAvailableVoicesAsync();
  koAvailable = voices.some((v) => v.language.startsWith('ko'));
  return koAvailable;
}

export function speak(hangul: string): void {
  if (koAvailable === false) return;
  Speech.speak(hangul, { language: 'ko-KR', rate: 0.85 });
}
