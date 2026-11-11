import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useListeningFeedback } from '../hooks/useListeningFeedback';
import { useRadioMode } from '../hooks/useRadioMode';
import { isNativeAndroid } from './nativeBridge';
import { NativeAudioRuntime } from './NativeAudioRuntime';
import { DesktopWarmup } from './DesktopWarmup';
import { NativeLayoutMetrics } from './NativeLayoutMetrics';
import { SoundProfiles } from './SoundProfiles';
import { OfflineRuntime } from './OfflineRuntime';
import { OfflineTransfer } from '../components/player/OfflinePanel';
import { RecentActivityRuntime } from './RecentActivityRuntime';
function WebPlaybackRuntime() { useListeningFeedback(); useAudioPlayer(); useRadioMode(); return null; }
export function PlaybackRuntime() { return <><RecentActivityRuntime /><NativeLayoutMetrics /><OfflineRuntime /><OfflineTransfer /><SoundProfiles />{isNativeAndroid() ? <NativeAudioRuntime /> : <><WebPlaybackRuntime /><DesktopWarmup /></>}</>; }
