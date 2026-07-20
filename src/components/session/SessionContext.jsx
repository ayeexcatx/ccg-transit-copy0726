import React, { createContext, useContext } from 'react';
import { useAccessSession } from './useAccessSession';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const sessionData = useAccessSession();
  return (
    <SessionContext.Provider value={sessionData}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}