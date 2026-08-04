import { useState, useEffect } from 'react';

const STORAGE_KEY = 'trackwyze_download_reminder';
const REMINDER_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

interface ReminderState {
  lastShown: number;
  dismissed: boolean;
  shownThisSession: boolean;
}

export const useDownloadReminder = () => {
  const [showModal, setShowModal] = useState(false);
  
  useEffect(() => {
    // Check if we should show the modal on initial load
    const checkInitialState = () => {
      const savedState = localStorage.getItem(STORAGE_KEY);
      
      if (!savedState) {
        // First visit, don't show the modal yet but save state
        saveState({ lastShown: Date.now(), dismissed: false, shownThisSession: false });
        return;
      }
      
      const state = JSON.parse(savedState) as ReminderState;
      const timeSinceLastShown = Date.now() - state.lastShown;
      
      // If it's been more than the reminder interval (30 days) and not shown this session, show the modal
      if (timeSinceLastShown >= REMINDER_INTERVAL && !state.shownThisSession) {
        setShowModal(true);
        saveState({ lastShown: Date.now(), dismissed: false, shownThisSession: true });
      }
    };
    
    checkInitialState();
  }, []);
  
  const handleCloseModal = () => {
    setShowModal(false);
    saveState({ lastShown: Date.now(), dismissed: true, shownThisSession: true });
  };
  
  const saveState = (state: ReminderState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };
  
  return { showModal, handleCloseModal };
};