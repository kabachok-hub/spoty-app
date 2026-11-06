import { isNativeClient, nativeCall } from './nativeBridge';
const KEY = 'spotify_auth_token';
export async function readAuthToken(): Promise<string | null> {
  return isNativeClient() ? (await nativeCall<{ token: string | null }>('vaultGet')).token : localStorage.getItem(KEY);
}
export async function writeAuthToken(token: string) {
  if (isNativeClient()) {
    const result = await nativeCall('vaultSet', { token }); localStorage.removeItem(KEY);
    if (result.accountChanged) { localStorage.removeItem('spotify_player_state_v1'); window.dispatchEvent(new Event('spoty-account-changed')); }
  }
  else localStorage.setItem(KEY, token);
}
export async function clearAuthToken() {
  if (isNativeClient()) {
    await nativeCall('vaultClear');
    localStorage.removeItem('spotify_player_state_v1');
  }
  localStorage.removeItem(KEY);
}
