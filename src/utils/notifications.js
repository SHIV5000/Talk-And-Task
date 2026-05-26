import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db, messaging } from './firebase';

export async function enablePushNotifications(userId, workspaceId) {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_KEY,
    });
    if (token) {
      const ref = doc(db, 'users', userId, 'fcmTokens', token);
      await setDoc(ref, {
        token,
        workspaceId,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.error('Push notification error:', err);
  }
}

export function listenToForegroundMessages() {
  onMessage(messaging, (payload) => {
    // Show a simple toast – you can replace with a proper notification system
    const { title, body } = payload.notification;
    if (window.Notification && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else {
      alert(`${title}: ${body}`);
    }
  });
}
