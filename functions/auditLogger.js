const { ESCALATION_LOGS_COLLECTION } = require('./constants');

async function logEscalation(db, { taskId, assigneeId, previousLevel, newLevel, timestamp, action }) {
  return db.collection(ESCALATION_LOGS_COLLECTION).add({
    taskId,
    assigneeId,
    previousLevel,
    newLevel,
    timestamp: admin.firestore.Timestamp.fromDate(timestamp),
    action
  });
}

module.exports = { logEscalation };
