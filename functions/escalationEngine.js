const { logger } = require('firebase-functions');
const { sendEscalationNotification } = require('./notificationService');
const { logEscalation } = require('./auditLogger');
const {
  TASKS_COLLECTION,
  ASSIGNMENTS_SUBCOLLECTION,
  STAGES,
  CRITICAL_HOURS_THRESHOLD,
  COOLDOWN_HOURS
} = require('./constants');

async function runEscalationEngine(admin) {
  const db = admin.firestore();
  const now = new Date();
  logger.log('Escalation engine started at', now.toISOString());

  const tasksSnap = await db.collection(TASKS_COLLECTION)
    .where('status', 'not-in', ['Completed', 'Cancelled'])
    .get();

  if (tasksSnap.empty) {
    logger.log('No active tasks found');
    return;
  }

  for (const taskDoc of tasksSnap.docs) {
    const taskData = taskDoc.data();
    const taskId = taskDoc.id;
    const { ackDeadline, deadlineTime } = taskData;

    if (!ackDeadline || !deadlineTime) continue;

    const ackDeadlineDate = ackDeadline.toDate ? ackDeadline.toDate() : new Date(ackDeadline);
    const deadlineDate = deadlineTime.toDate ? deadlineTime.toDate() : new Date(deadlineTime);

    const assignmentsSnap = await db
      .collection(TASKS_COLLECTION)
      .doc(taskId)
      .collection(ASSIGNMENTS_SUBCOLLECTION)
      .where('completed', '==', false)
      .get();

    for (const assignDoc of assignmentsSnap.docs) {
      const assignment = assignDoc.data();
      const assigneeId = assignDoc.id;
      const currentLevel = assignment.escalationLevel || 0;

      const lastEscalatedAt = assignment.lastEscalatedAt
        ? (assignment.lastEscalatedAt.toDate ? assignment.lastEscalatedAt.toDate() : new Date(assignment.lastEscalatedAt))
        : null;
      const inCooldown = lastEscalatedAt && (now - lastEscalatedAt) < COOLDOWN_HOURS * 60 * 60 * 1000;
      if (inCooldown) continue;

      if (assignment.isAcknowledged === false && now > ackDeadlineDate && currentLevel < STAGES.MISSED_ACK) {
        const newLevel = STAGES.MISSED_ACK;
        await applyEscalation(db, taskId, assigneeId, newLevel, now);
        await sendEscalationNotification(admin, { taskId, assigneeId, managerId: assignment.managerId, level: newLevel, type: 'missed_ack' });
        await logEscalation(db, { taskId, assigneeId, previousLevel: currentLevel, newLevel, timestamp: now, action: 'missed_ack' });
      }

      if (now > deadlineDate && currentLevel < STAGES.OVERDUE) {
        const newLevel = STAGES.OVERDUE;
        await applyEscalation(db, taskId, assigneeId, newLevel, now);
        await sendEscalationNotification(admin, { taskId, assigneeId, managerId: assignment.managerId, level: newLevel, type: 'overdue' });
        await logEscalation(db, { taskId, assigneeId, previousLevel: currentLevel, newLevel, timestamp: now, action: 'overdue' });
      }

      const criticalTime = new Date(deadlineDate.getTime() + CRITICAL_HOURS_THRESHOLD * 60 * 60 * 1000);
      if (now > criticalTime && currentLevel < STAGES.CRITICAL) {
        const newLevel = STAGES.CRITICAL;
        await applyEscalation(db, taskId, assigneeId, newLevel, now);
        await sendEscalationNotification(admin, { taskId, assigneeId, managerId: assignment.managerId, level: newLevel, type: 'critical' });
        await logEscalation(db, { taskId, assigneeId, previousLevel: currentLevel, newLevel, timestamp: now, action: 'critical' });
      }
    }
  }

  logger.log('Escalation engine completed');
}

async function applyEscalation(db, taskId, assigneeId, newLevel, now) {
  return db
    .collection(TASKS_COLLECTION)
    .doc(taskId)
    .collection(ASSIGNMENTS_SUBCOLLECTION)
    .doc(assigneeId)
    .update({
      escalationLevel: newLevel,
      lastEscalatedAt: admin.firestore.Timestamp.fromDate(now)
    });
}

module.exports = { runEscalationEngine };
