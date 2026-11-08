import { isNativeClient, nativeCall } from './nativeBridge';
const KEY = 'spotify_auth_token';
const offlineAccount = (token: string | null) => { try { return token ? JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).tg_id : null; } catch { return null; } };
export async function readAuthToken(): Promise<string | null> {
  return isNativeClient() ? (await nativeCall<{ token: string | null }>('vaultGet')).token : localStorage.getItem(KEY);
}
export async function writeAuthToken(token: string) {
  if (isNativeClient()) {
    const result = await nativeCall('vaultSet', { token }); localStorage.removeItem(KEY);
    if (result.accountChanged) { localStorage.removeItem('spotify_player_state_v1'); window.dispatchEvent(new Event('spoty-account-changed')); }
  }
  else {
    const previous = localStorage.getItem(KEY);
    localStorage.setItem(KEY, token);
    if (offlineAccount(previous) !== offlineAccount(token)) window.dispatchEvent(new Event('spoty-offline-account-changed'));
  }
}
export async function clearAuthToken() {
  if (isNativeClient()) {
    await nativeCall('vaultClear');
    localStorage.removeItem('spotify_player_state_v1');
  }
  localStorage.removeItem(KEY);
}
