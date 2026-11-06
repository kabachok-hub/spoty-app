import { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { apiClient } from '../api/client';
import { configureListeningFeedback } from './listeningFeedback';
export function useListeningFeedback() {
  const userId=useUserStore(s=>s.user?.telegram_id);
  useEffect(()=>{
    if (!userId || userId===999999999) { configureListeningFeedback(null); return; }
    configureListeningFeedback(event=>{
      if (useUserStore.getState().user?.telegram_id!==userId) return;
      void apiClient.post('/me/history/feedback',event).catch(()=>{});
    });
    return ()=>configureListeningFeedback(null);
  },[userId]);
}
