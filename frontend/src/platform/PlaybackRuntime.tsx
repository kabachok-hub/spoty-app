import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useListeningFeedback } from '../hooks/useListeningFeedback';
import { useRadioMode } from '../hooks/useRadioMode';
import { isNativeAndroid } from './nativeBridge';
import { NativeAudioRuntime } from './NativeAudioRuntime';
import { DesktopWarmup } from './DesktopWarmup';
import { NativeLayoutMetrics } from './NativeLayoutMetrics';
function WebPlaybackRuntime() { useListeningFeedback(); useAudioPlayer(); useRadioMode(); return null; }
export function PlaybackRuntime() { return <><NativeLayoutMetrics />{isNativeAndroid() ? <NativeAudioRuntime /> : <><WebPlaybackRuntime /><DesktopWarmup /></>}</>; }
