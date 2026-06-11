"use client";

import { CustomAlert } from './custom-alert';
import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';

type Severity = 'success' | 'error' | 'warning' | 'info';

interface AlertContextType {
  showAlert: (message: string, severity?: Severity) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);
/**
 * AlertProvider is a provider for the alert context.
 * It provides a function to show an alert.
 * It is used to show alerts in the application.
 */
export function AlertProvider({ children }: PropsWithChildren) {
  const [alertState, setAlertState] = useState<{
    open: boolean;
    message: string;
    severity: Severity;
  }>({
    open: false,
    message: '',
    severity: 'info',
  });


  const showAlert = useCallback((message: string, severity: Severity = 'info') => {
    setAlertState({ open: true, message, severity });
  }, []);

  const handleClose = useCallback(() => {
    setAlertState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <CustomAlert
        open={alertState.open}
        message={alertState.message}
        severity={alertState.severity}
        onClose={handleClose}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return context;
} 