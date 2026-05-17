import React, { useState, useCallback } from 'react';
import { useEscalationAlerts } from '../hooks/useEscalationAlerts';

export default function NotificationToast({ currentUser }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((alert) => {
    const id = Date.now();
    setToasts((prev) => [
      ...prev,
      { id, message: `Escalation on Task ${alert.taskId}: ${alert.action}`, alert },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  useEscalationAlerts(currentUser, addToast);

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            backgroundColor: '#1f2937',
            color: '#fff',
            padding: '12px 20px',
            marginBottom: 10,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: 250,
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
