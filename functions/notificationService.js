const { logger } = require('firebase-functions');

async function sendEscalationNotification(admin, { taskId, assigneeId, managerId, level, type }) {
  const db = admin.firestore();
  const messaging = admin.messaging();

  const title = `Task ${taskId} Escalation`;
  let body = '';
  let targetUsers = [];

  if (level === 1) {
    body = 'You have not acknowledged the task. Please accept it now.';
    targetUsers = [assigneeId];
  } else if (level === 2) {
    body = 'Task deadline missed. Task is now overdue.';
    targetUsers = [assigneeId, managerId].filter(Boolean);
  } else if (level === 3) {
    body = 'Task critically overdue. Formal warning issued.';
    targetUsers = [assigneeId, managerId, 'admin'].filter(Boolean);
  }

  for (const uid of targetUsers) {
    if (!uid) continue;
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      const tokens = userDoc.exists ? (userDoc.data().fcmTokens || []) : [];
      if (tokens.length > 0) {
        const message = {
          notification: { title, body },
          tokens: tokens,
          data: { taskId, escalationLevel: level.toString(), type }
        };
        await messaging.sendMulticast(message);
        logger.log(`Sent escalation notification to ${uid}`);
      }
    } catch (error) {
      logger.error(`Failed to send notification to ${uid}:`, error);
    }
  }
}

module.exports = { sendEscalationNotification };
