// Versions change only for explicitly refreshed recordings; ordinary stream URLs stay stable.
const versions = new Map<string, number>();
const refreshing = new Set<string>();
export const recordingVersion = (id: string) => versions.get(id) || 0;
export const isRecordingRefreshing = (id: string) => refreshing.has(id);
export const beginRecordingRefresh = (id: string) => { refreshing.add(id); };
export const endRecordingRefresh = (id: string) => { refreshing.delete(id); };
export function bumpRecordingVersion(id: string) {
  const version = Math.max(Date.now(), recordingVersion(id) + 1);
  versions.delete(id);
  versions.set(id, version);
  if (versions.size > 256) versions.delete(versions.keys().next().value!);
}
