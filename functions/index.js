const functions = require('firebase-functions/v2');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();

const { runEscalationEngine } = require('./escalationEngine');

exports.escalationCron = onSchedule('every 15 minutes', async (event) => {
  await runEscalationEngine(admin);
  // Thin wrapper that catches synchronous errors and passes them to the fallback
});
