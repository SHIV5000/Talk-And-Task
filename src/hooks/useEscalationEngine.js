import { useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

const TASKS_COLLECTION = 'messages';
const ASSIGNMENTS_SUB = 'assignments';
const ESCALATION_LOGS = 'escalationLogs';

export default function useEscalationEngine(activeGroup, messages) {
  const intervalRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      const now = new Date();
      try {
        const tasksSnap = await getDocs(
          query(
            collection(db, TASKS_COLLECTION),
            where('isTask', '==', true),
            where('taskData.status', 'not-in', ['Completed', 'Cancelled'])
          )
        );

        for (const taskDoc of tasksSnap.docs) {
          const taskData = taskDoc.data();
          const taskId = taskDoc.id;
          const { ackDeadline, deadlineTime } = taskData;

          if (!ackDeadline || !deadlineTime) continue;

          const ackDeadlineDate = ackDeadline.toDate();
          const deadlineDate = deadlineTime.toDate();

          const assignmentsSnap = await getDocs(
            collection(db, TASKS_COLLECTION, taskId, ASSIGNMENTS_SUB)
          );

          for (const assignDoc of assignmentsSnap.docs) {
            const assignment = assignDoc.data();
            const assigneeId = assignDoc.id;
            const currentLevel = assignment.escalationLevel || 0;

            const lastEscalatedAt = assignment.lastEscalatedAt?.toDate();
            if (lastEscalatedAt && (now - lastEscalatedAt) < 24 * 60 * 60 * 1000) continue;

            // Stage 1 – Missed Ack
            if (
              assignment.isAcknowledged === false &&
              now > ackDeadlineDate &&
              currentLevel < 1
            ) {
              await updateDoc(
                doc(db, TASKS_COLLECTION, taskId, ASSIGNMENTS_SUB, assigneeId),
                {
                  escalationLevel: 1,
                  lastEscalatedAt: Timestamp.fromDate(now)
                }
              );
              await addDoc(collection(db, ESCALATION_LOGS), {
                taskId,
                assigneeId,
                previousLevel: currentLevel,
                newLevel: 1,
                action: 'missed_ack',
                timestamp: serverTimestamp()
              });
            }

            // Stage 2 – Overdue
            if (now > deadlineDate && currentLevel < 2) {
              await updateDoc(
                doc(db, TASKS_COLLECTION, taskId, ASSIGNMENTS_SUB, assigneeId),
                {
                  escalationLevel: 2,
                  lastEscalatedAt: Timestamp.fromDate(now)
                }
              );
              await addDoc(collection(db, ESCALATION_LOGS), {
                taskId,
                assigneeId,
                previousLevel: currentLevel,
                newLevel: 2,
                action: 'overdue',
                timestamp: serverTimestamp()
              });
            }

            // Stage 3 – Critical (deadline + 24h)
            const criticalTime = new Date(deadlineDate.getTime() + 24 * 60 * 60 * 1000);
            if (now > criticalTime && currentLevel < 3) {
              await updateDoc(
                doc(db, TASKS_COLLECTION, taskId, ASSIGNMENTS_SUB, assigneeId),
                {
                  escalationLevel: 3,
                  lastEscalatedAt: Timestamp.fromDate(now)
                }
              );
              await addDoc(collection(db, ESCALATION_LOGS), {
                taskId,
                assigneeId,
                previousLevel: currentLevel,
                newLevel: 3,
                action: 'critical',
                timestamp: serverTimestamp()
              });
            }
          }
        }
      } catch (err) {
        console.error('[EscalationEngine] error:', err);
      }
    };

    const initialTimer = setTimeout(run, 10000);
    intervalRef.current = setInterval(run, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
