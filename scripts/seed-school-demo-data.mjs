import { Timestamp } from 'firebase/firestore';
import { db, collection, doc, getDocs, query, where, setDoc, serverTimestamp } from '../src/firebase.js';

const SEED_BATCH = 'school-demo-v1';
const APPLY = process.argv.includes('--apply') || process.argv.includes('--yes');
const MOCK_USERS = process.argv.includes('--mock-users');
const now = new Date();

const groupIds = {
  leadership: 'school-demo-academic-leadership-council',
  boardExam: 'school-demo-grade-10-board-exam-cell',
  primaryOps: 'school-demo-primary-wing-daily-operations',
  events: 'school-demo-events-parent-communication',
};

const groupDefinitions = [
  {
    key: 'leadership',
    name: 'Academic Leadership Council',
    description: 'Principal, academic coordinators, HODs, and senior teachers coordinating teaching quality and approvals.',
    icon: 'fa-chalkboard-user',
  },
  {
    key: 'boardExam',
    name: 'Grade 10 Board Exam Cell',
    description: 'Board exam planning, syllabus closure, remedial timetable, seating plan, and proof collection.',
    icon: 'fa-file-circle-check',
  },
  {
    key: 'primaryOps',
    name: 'Primary Wing Daily Operations',
    description: 'Substitution duty, dispersal duty, classroom diary checks, and primary wing daily follow-up.',
    icon: 'fa-school',
  },
  {
    key: 'events',
    name: 'Events & Parent Communication',
    description: 'PTM circulars, annual day duties, parent notices, and scheduled communication approvals.',
    icon: 'fa-calendar-check',
  },
];

const asArray = (value) => Array.isArray(value) ? value : [];
const unique = (items) => [...new Set(items.filter(Boolean))];
const clean = (value) => String(value || '').trim();
const displayName = (user) => clean(user?.name) || clean(user?.displayName) || clean(user?.email).split('@')[0] || 'User';
const localInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const addHours = (hours) => new Date(now.getTime() + hours * 60 * 60 * 1000);
const addDays = (days, hour = 9, minute = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const timestampAt = (minutesAgo) => Timestamp.fromDate(new Date(now.getTime() - minutesAgo * 60 * 1000));
const trailTime = (minutesAgo) => {
  const d = new Date(now.getTime() - minutesAgo * 60 * 1000);
  return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${d.toLocaleDateString()}`;
};

function rolePicker(users) {
  const approved = users.filter((u) => u?.isApproved !== false);
  const pool = (approved.length ? approved : users)
    .filter((u) => u?.email && u?.uid)
    .sort((a, b) => clean(a.email).localeCompare(clean(b.email)));

  if (pool.length === 0) {
    throw new Error('No existing users were found in Firestore, or this environment could not reach Firestore. Add/approve app users and run from a network that can access Firestore, then seed again.');
  }

  const used = new Set();
  const matches = (user, words) => {
    const haystack = `${user.email || ''} ${user.name || ''} ${user.displayName || ''}`.toLowerCase();
    return words.some((word) => haystack.includes(word));
  };
  const reserve = (user) => { if (user?.email) used.add(user.email); return user; };
  const pick = (words = [], fallback = null) => {
    const semantic = pool.find((u) => !used.has(u.email) && matches(u, words));
    if (semantic) return reserve(semantic);
    const unused = pool.find((u) => !used.has(u.email));
    if (unused) return reserve(unused);
    return fallback || pool[used.size % pool.length] || pool[0];
  };

  const principal = reserve(pool.find((u) => !used.has(u.email) && matches(u, ['principal', 'director', 'head'])) || pool.find((u) => u.isAdmin) || pool[0]);
  return {
    all: pool,
    principal,
    academicCoordinator: pick(['academic', 'coordinator']),
    examCoordinator: pick(['exam', 'board']),
    seniorTeacher: pick(['senior', 'hod']),
    seniorTeacher2: pick(['senior', 'teacher']),
    primaryCoordinator: pick(['primary']),
    eventCoordinator: pick(['event', 'communication', 'parent']),
    classTeacher1: pick(['class', 'teacher']),
    classTeacher2: pick(['class', 'teacher']),
    classTeacher3: pick(['class', 'teacher']),
    classTeacher4: pick(['class', 'teacher']),
    classTeacher5: pick(['class', 'teacher']),
  };
}


const userEmails = (...users) => unique(users.map((u) => u?.email));

function baseMessage(id, groupKey, sender, text, minutesAgo, extra = {}) {
  return {
    id,
    collection: 'messages',
    data: {
      text,
      senderUid: sender.uid,
      senderEmail: sender.email,
      timestamp: timestampAt(minutesAgo),
      dateString: new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString().split('T')[0],
      isTask: false,
      isPrivateMention: false,
      allowedUsers: [],
      seenBy: [sender.email],
      deliveredTo: [sender.email],
      groupId: groupIds[groupKey],
      reactions: {},
      seedBatch: SEED_BATCH,
      scenarioLabel: 'school-demo-chat',
      ...extra,
    },
  };
}

function taskMessage({ id, groupKey, reviewer, title, assignees, status = 'Pending', priority = 'Medium', deadline, requireAck = false, requireProof = false, ackBy = {}, assigneeStates, trail, minutesAgo = 30, scenarioLabel }) {
  const finalAssignees = unique(assignees.map((u) => u.email));
  return {
    id,
    collection: 'messages',
    data: {
      text: title,
      senderUid: reviewer.uid,
      senderEmail: reviewer.email,
      timestamp: timestampAt(minutesAgo),
      dateString: new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString().split('T')[0],
      isTask: true,
      isPrivateMention: false,
      allowedUsers: [],
      seenBy: [reviewer.email],
      deliveredTo: [reviewer.email],
      groupId: groupIds[groupKey],
      reactions: {},
      seedBatch: SEED_BATCH,
      scenarioLabel,
      taskData: {
        deadline: localInput(deadline),
        assignees: finalAssignees,
        priority,
        status,
        isArchived: false,
        dismissedBy: [],
        trail,
        requireAck,
        ackDeadline: requireAck ? localInput(addHours(3)) : null,
        ackBy,
        requireProof,
        escalated: false,
        assigneeStates,
        masterReviewerEmail: reviewer.email,
        isDeleted: false,
        deletedAt: null,
        seedBatch: SEED_BATCH,
      },
    },
  };
}

function createdTrail(reviewer, assignees, minutesAgo, comment = 'Task created and assigned for school operations follow-up.') {
  return [{
    action: `${displayName(reviewer)} created the task`,
    by: reviewer.email,
    time: trailTime(minutesAgo),
    to: assignees.map(displayName).join(', '),
    comment,
  }];
}

function notification(id, user, type, text, messageId, groupKey, hoursAgo = 0) {
  return {
    id,
    collection: 'notifications',
    data: {
      userId: user.uid,
      userEmail: user.email,
      type,
      text,
      messageId,
      groupId: groupIds[groupKey],
      timestamp: Timestamp.fromDate(new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)),
      isRead: false,
      seedBatch: SEED_BATCH,
    },
  };
}

function audit(id, actor, type, content, groupKey, target = '') {
  return {
    id,
    collection: 'audit_logs',
    data: {
      type,
      user: actor.email,
      content,
      target,
      groupId: groupIds[groupKey],
      groupName: groupDefinitions.find((g) => g.key === groupKey)?.name || groupKey,
      timestamp: serverTimestamp(),
      seedBatch: SEED_BATCH,
    },
  };
}

async function readUsers() {
  if (MOCK_USERS) {
    return [
      ['u-principal', 'principal.demo@school.test', 'Dr. Meera Principal', true],
      ['u-academic', 'academic.coordinator@school.test', 'Anita Academic Coordinator', true],
      ['u-exam', 'exam.coordinator@school.test', 'Rohit Exam Coordinator', false],
      ['u-senior-1', 'senior.teacher1@school.test', 'Kavita Senior Teacher', false],
      ['u-senior-2', 'senior.teacher2@school.test', 'Naveen Senior Teacher', false],
      ['u-primary', 'primary.coordinator@school.test', 'Farah Primary Coordinator', false],
      ['u-event', 'event.coordinator@school.test', 'Joseph Event Coordinator', false],
      ['u-class-1', 'class.teacher1@school.test', 'Rina Class Teacher', false],
      ['u-class-2', 'class.teacher2@school.test', 'Sanjay Class Teacher', false],
      ['u-class-3', 'class.teacher3@school.test', 'Leena Class Teacher', false],
      ['u-class-4', 'class.teacher4@school.test', 'Amit Class Teacher', false],
      ['u-class-5', 'class.teacher5@school.test', 'Pooja Class Teacher', false],
    ].map(([uid, email, name, isAdmin]) => ({ id: uid, uid, email, name, isApproved: true, isAdmin }));
  }

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timed out while reading existing users from Firestore. Check network/proxy access and Firestore rules.')), 15000);
  });
  const snap = await Promise.race([getDocs(collection(db, 'users')), timeout]);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function writeDocument(item) {
  await setDoc(doc(db, item.collection, item.id), item.data, { merge: true });
}

async function main() {
  console.log(`School demo seed batch: ${SEED_BATCH}`);
  console.log(APPLY ? 'Mode: APPLY (Firestore writes enabled)' : 'Mode: DRY RUN (no writes). Re-run with --apply to seed Firestore.');
  if (MOCK_USERS) console.log('Using mock users for local script validation only. Omit --mock-users to use existing Firestore users.');

  const users = await readUsers();
  const r = rolePicker(users);
  const groupMembers = {
    leadership: userEmails(r.principal, r.academicCoordinator, r.examCoordinator, r.seniorTeacher, r.seniorTeacher2, r.primaryCoordinator, r.eventCoordinator),
    boardExam: userEmails(r.principal, r.academicCoordinator, r.examCoordinator, r.seniorTeacher, r.seniorTeacher2, r.classTeacher1, r.classTeacher2),
    primaryOps: userEmails(r.principal, r.primaryCoordinator, r.classTeacher1, r.classTeacher2, r.classTeacher3, r.classTeacher4),
    events: userEmails(r.principal, r.eventCoordinator, r.academicCoordinator, r.seniorTeacher, r.classTeacher2, r.classTeacher5),
  };

  const groups = groupDefinitions.map((g) => ({
    id: groupIds[g.key],
    collection: 'groups',
    data: {
      name: g.name,
      description: g.description,
      members: groupMembers[g.key],
      admins: userEmails(r.principal, g.key === 'boardExam' ? r.examCoordinator : g.key === 'primaryOps' ? r.primaryCoordinator : g.key === 'events' ? r.eventCoordinator : r.academicCoordinator),
      createdBy: r.principal.email,
      createdAt: serverTimestamp(),
      isArchived: false,
      profilePicUrl: null,
      seedBatch: SEED_BATCH,
      scenarioIcon: g.icon,
    },
  }));

  const messages = [
    baseMessage('school-demo-chat-001', 'leadership', r.principal, 'Good morning team. Please update priority academic items by 11:00 AM so we can close today\'s review cycle.', 180),
    baseMessage('school-demo-chat-002', 'leadership', r.academicCoordinator, 'Syllabus closure and weekly lesson plan compliance will be reviewed department-wise today.', 174),
    baseMessage('school-demo-chat-003', 'leadership', r.principal, 'Please keep all approval trails updated inside task cards so follow-up is transparent.', 168, { isPinned: true }),
    baseMessage('school-demo-chat-004', 'boardExam', r.examCoordinator, 'Grade 10 board seating plan needs to be ready for verification before the exam committee meeting.', 160),
    baseMessage('school-demo-chat-005', 'boardExam', r.academicCoordinator, 'Subject teachers should confirm syllabus completion status with evidence wherever proof is requested.', 154),
    baseMessage('school-demo-chat-006', 'boardExam', r.principal, 'Remedial timetable must be finalized before Friday and shared with class teachers.', 148),
    baseMessage('school-demo-chat-007', 'primaryOps', r.primaryCoordinator, 'Class 3B substitution duty needs immediate confirmation for periods 2 and 3.', 142),
    baseMessage('school-demo-chat-008', 'primaryOps', r.classTeacher1, 'Dispersal duty positions should be confirmed before lunch to avoid confusion at the gate.', 136),
    baseMessage('school-demo-chat-009', 'events', r.eventCoordinator, 'PTM circular draft is ready for review. Please use task comments for all changes.', 130),
    baseMessage('school-demo-chat-010', 'events', r.principal, 'Parent communication should be scheduled only after final approval.', 124, { bookmarkedBy: [r.principal.email] }),
  ];

  const t1Assignees = [r.seniorTeacher, r.seniorTeacher2];
  const t2Assignees = [r.academicCoordinator];
  const t3Assignees = [r.classTeacher1];
  const t4Assignees = [r.seniorTeacher, r.seniorTeacher2];
  const t5Assignees = [r.seniorTeacher, r.classTeacher2];
  const t6Assignees = [r.classTeacher3];
  const t7Assignees = [r.classTeacher1, r.classTeacher4];
  const t8Old = r.classTeacher2;
  const t8New = r.classTeacher5;
  const t9Assignees = [r.seniorTeacher];
  const t10Assignees = [r.classTeacher2, r.classTeacher5];
  const t11Assignees = [r.academicCoordinator];
  const t12Assignees = [r.classTeacher4, r.classTeacher5];

  const tasks = [
    taskMessage({
      id: 'school-demo-task-001', groupKey: 'leadership', reviewer: r.academicCoordinator, title: 'Submit department-wise syllabus completion report', assignees: t1Assignees, status: 'Pending', priority: 'High', deadline: addDays(2, 16, 0), requireAck: true, requireProof: false,
      ackBy: {}, assigneeStates: Object.fromEntries(t1Assignees.map((u) => [u.email, 'assigned'])), minutesAgo: 118, scenarioLabel: 'assigned-mandatory-ack',
      trail: createdTrail(r.academicCoordinator, t1Assignees, 118, 'Each HOD should submit a concise report with pending chapters and remedial support required.'),
    }),
    taskMessage({
      id: 'school-demo-task-002', groupKey: 'leadership', reviewer: r.principal, title: 'Review weekly lesson plan compliance', assignees: t2Assignees, status: 'In Progress', priority: 'Medium', deadline: addDays(1, 13, 30), requireAck: true, requireProof: false,
      ackBy: { [r.academicCoordinator.email]: true }, assigneeStates: { [r.academicCoordinator.email]: 'assigned' }, minutesAgo: 112, scenarioLabel: 'acknowledged-in-progress',
      trail: [
        ...createdTrail(r.principal, t2Assignees, 112, 'Please review department submissions and add exceptions in the comments.'),
        { action: `${displayName(r.academicCoordinator)} acknowledged the task`, by: r.academicCoordinator.email, time: trailTime(106), comment: 'Acknowledged. I will consolidate the compliance notes after the second period.' },
        { action: `${displayName(r.academicCoordinator)} posted an update`, by: r.academicCoordinator.email, time: trailTime(98), comment: 'Science and language lesson plans are checked. Mathematics review is in progress.' },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-003', groupKey: 'boardExam', reviewer: r.examCoordinator, title: 'Upload Grade 10 board exam seating plan', assignees: t3Assignees, status: 'Pending', priority: 'High', deadline: addDays(1, 15, 0), requireAck: true, requireProof: true,
      ackBy: {}, assigneeStates: { [r.classTeacher1.email]: 'assigned' }, minutesAgo: 100, scenarioLabel: 'proof-required-assigned',
      trail: createdTrail(r.examCoordinator, t3Assignees, 100, 'Upload the seating plan as proof after cross-checking roll numbers.'),
    }),
    taskMessage({
      id: 'school-demo-task-004', groupKey: 'boardExam', reviewer: r.academicCoordinator, title: 'Confirm remedial class timetable', assignees: t4Assignees, status: 'In Progress', priority: 'High', deadline: addDays(3, 14, 0), requireAck: false, requireProof: false,
      ackBy: {}, assigneeStates: { [r.seniorTeacher.email]: 'submitted_completed', [r.seniorTeacher2.email]: 'assigned' }, minutesAgo: 94, scenarioLabel: 'partial-submitted',
      trail: [
        ...createdTrail(r.academicCoordinator, t4Assignees, 94, 'Finalize the remedial timetable subject-wise and submit for review.'),
        { action: `${displayName(r.seniorTeacher)} submitted the task for review`, by: r.seniorTeacher.email, time: trailTime(74), comment: 'Mathematics remedial batches are finalized for Monday, Wednesday, and Friday.' },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-005', groupKey: 'boardExam', reviewer: r.principal, title: 'Verify math and science syllabus closure', assignees: t5Assignees, status: 'In Progress', priority: 'High', deadline: addDays(1, 12, 0), requireAck: false, requireProof: true,
      ackBy: {}, assigneeStates: { [r.seniorTeacher.email]: 'submitted_completed', [r.classTeacher2.email]: 'submitted_completed' }, minutesAgo: 88, scenarioLabel: 'reviewer-actions-active',
      trail: [
        ...createdTrail(r.principal, t5Assignees, 88, 'Submit closure evidence for Mathematics and Science chapters.'),
        { action: `${displayName(r.seniorTeacher)} uploaded file: Math_Syllabus_Closure.pdf.`, by: r.seniorTeacher.email, time: trailTime(70), comment: 'Attached syllabus closure proof.', fileUrl: 'https://example.com/demo/Math_Syllabus_Closure.pdf', fileName: 'Math_Syllabus_Closure.pdf' },
        { action: `${displayName(r.seniorTeacher)} submitted the task for review`, by: r.seniorTeacher.email, time: trailTime(68), comment: 'Math closure evidence is ready for approval.' },
        { action: `${displayName(r.classTeacher2)} submitted the task for review`, by: r.classTeacher2.email, time: trailTime(64), comment: 'Science closure checklist has been verified.' },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-006', groupKey: 'primaryOps', reviewer: r.primaryCoordinator, title: 'Prepare substitution duty chart', assignees: t6Assignees, status: 'In Progress', priority: 'Medium', deadline: addDays(1, 10, 30), requireAck: false, requireProof: false,
      ackBy: {}, assigneeStates: { [r.classTeacher3.email]: 'needs_review' }, minutesAgo: 82, scenarioLabel: 'review-again-controls-enabled',
      trail: [
        ...createdTrail(r.primaryCoordinator, t6Assignees, 82, 'Prepare the substitution duty chart for Class 3B.'),
        { action: `${displayName(r.classTeacher3)} submitted the task for review`, by: r.classTeacher3.email, time: trailTime(58), comment: 'Draft substitution chart submitted.' },
        { action: `${displayName(r.primaryCoordinator)} requested review again`, by: r.primaryCoordinator.email, time: trailTime(50), comment: 'Please add period 3 coverage and resubmit.' },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-007', groupKey: 'primaryOps', reviewer: r.primaryCoordinator, title: 'Confirm dispersal duty allocation', assignees: t7Assignees, status: 'In Progress', priority: 'Medium', deadline: addDays(2, 12, 30), requireAck: false, requireProof: false,
      ackBy: {}, assigneeStates: { [r.classTeacher1.email]: 'accepted_completed', [r.classTeacher4.email]: 'assigned' }, minutesAgo: 76, scenarioLabel: 'partial-accepted',
      trail: [
        ...createdTrail(r.primaryCoordinator, t7Assignees, 76, 'Confirm dispersal points and staff positioning.'),
        { action: `${displayName(r.classTeacher1)} submitted the task for review`, by: r.classTeacher1.email, time: trailTime(54), comment: 'Class 1 and 2 dispersal positions are confirmed.' },
        { action: `${displayName(r.primaryCoordinator)} marked the task Completed`, by: r.primaryCoordinator.email, time: trailTime(46), comment: 'Accepted for Class 1 and 2. Waiting for remaining allocation.' },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-008', groupKey: 'primaryOps', reviewer: r.primaryCoordinator, title: 'Transfer Class 3B diary-check duty', assignees: [t8Old, t8New], status: 'In Progress', priority: 'High', deadline: addDays(1, 14, 30), requireAck: false, requireProof: false,
      ackBy: {}, assigneeStates: { [t8Old.email]: 'revoked', [t8New.email]: 'assigned' }, minutesAgo: 70, scenarioLabel: 'transferred-task',
      trail: [
        ...createdTrail(r.primaryCoordinator, [t8Old], 70, 'Initial diary-check duty assigned for Class 3B.'),
        { action: `${displayName(r.primaryCoordinator)} transferred the task`, by: r.primaryCoordinator.email, time: trailTime(42), to: displayName(t8New), comment: `Transferred from ${displayName(t8Old)} to ${displayName(t8New)} because of substitution duty overlap.` },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-009', groupKey: 'events', reviewer: r.eventCoordinator, title: 'Draft PTM circular for approval', assignees: t9Assignees, status: 'In Progress', priority: 'High', deadline: addDays(1, 11, 0), requireAck: false, requireProof: false,
      ackBy: {}, assigneeStates: { [r.seniorTeacher.email]: 'submitted_completed' }, minutesAgo: 64, scenarioLabel: 'ptm-submitted-for-review',
      trail: [
        ...createdTrail(r.eventCoordinator, t9Assignees, 64, 'Draft the PTM circular and submit it for approval before scheduling.'),
        { action: `${displayName(r.seniorTeacher)} submitted the task for review`, by: r.seniorTeacher.email, time: trailTime(32), comment: 'PTM circular draft is ready for final approval.' },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-010', groupKey: 'events', reviewer: r.eventCoordinator, title: 'Upload Annual Day duty chart', assignees: t10Assignees, status: 'Pending', priority: 'Medium', deadline: addDays(4, 15, 30), requireAck: true, requireProof: true,
      ackBy: { [r.classTeacher2.email]: true }, assigneeStates: { [r.classTeacher2.email]: 'assigned', [r.classTeacher5.email]: 'assigned' }, minutesAgo: 58, scenarioLabel: 'multi-assignee-ack-isolation',
      trail: [
        ...createdTrail(r.eventCoordinator, t10Assignees, 58, 'Upload the Annual Day duty chart after both assignees verify their sections.'),
        { action: `${displayName(r.classTeacher2)} acknowledged the task`, by: r.classTeacher2.email, time: trailTime(24), comment: 'I will update the backstage duty section.' },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-011', groupKey: 'events', reviewer: r.principal, title: 'Schedule parent reminder message', assignees: t11Assignees, status: 'Completed', priority: 'Low', deadline: addDays(1, 8, 30), requireAck: false, requireProof: false,
      ackBy: {}, assigneeStates: { [r.academicCoordinator.email]: 'accepted_completed' }, minutesAgo: 52, scenarioLabel: 'completed-right-sidebar-no-strike',
      trail: [
        ...createdTrail(r.principal, t11Assignees, 52, 'Schedule the approved parent reminder message for tomorrow morning.'),
        { action: `${displayName(r.academicCoordinator)} submitted the task for review`, by: r.academicCoordinator.email, time: trailTime(28), comment: 'Parent reminder is scheduled and ready.' },
        { action: `${displayName(r.principal)} marked the task Completed`, by: r.principal.email, time: trailTime(20), comment: 'Approved. The scheduled reminder is correct.' },
      ],
    }),
    taskMessage({
      id: 'school-demo-task-012', groupKey: 'leadership', reviewer: r.seniorTeacher, title: 'Delegate library period monitoring', assignees: t12Assignees, status: 'In Progress', priority: 'Medium', deadline: addDays(3, 12, 0), requireAck: false, requireProof: false,
      ackBy: {}, assigneeStates: { [r.classTeacher4.email]: 'revoked', [r.classTeacher5.email]: 'assigned' }, minutesAgo: 46, scenarioLabel: 'assignee-delegation',
      trail: [
        ...createdTrail(r.seniorTeacher, [r.classTeacher4], 46, 'Monitor library period rotation and report gaps.'),
        { action: `${displayName(r.classTeacher4)} delegated the task`, by: r.classTeacher4.email, time: trailTime(18), to: displayName(r.classTeacher5), comment: 'Delegated because I am assigned to exam invigilation during the library period.' },
      ],
    }),
  ];

  const scheduledMessages = [
    { id: 'school-demo-scheduled-001', groupKey: 'boardExam', sender: r.examCoordinator, text: 'Reminder: Please submit final remedial attendance by 4:00 PM today.', scheduledFor: localInput(addDays(1, 9, 0)) },
    { id: 'school-demo-scheduled-002', groupKey: 'events', sender: r.eventCoordinator, text: 'PTM circular will be shared with parents after final approval.', scheduledFor: localInput(addDays(1, 8, 30)) },
    { id: 'school-demo-scheduled-003', groupKey: 'primaryOps', sender: r.primaryCoordinator, text: 'Morning duty teachers, please report at the gate by 7:35 AM.', scheduledFor: localInput(addDays(1, 7, 0)) },
    { id: 'school-demo-scheduled-004', groupKey: 'leadership', sender: r.principal, text: 'Please review today\'s pending academic task cards before 11:30 AM.', scheduledFor: localInput(addDays(1, 10, 45)) },
  ].map((s) => ({
    id: s.id,
    collection: 'scheduled_messages',
    data: {
      text: s.text,
      senderEmail: s.sender.email,
      senderUid: s.sender.uid,
      groupId: groupIds[s.groupKey],
      groupName: groupDefinitions.find((g) => g.key === s.groupKey)?.name,
      scheduledFor: s.scheduledFor,
      status: 'pending',
      isTask: false,
      createdAt: serverTimestamp(),
      seedBatch: SEED_BATCH,
    },
  }));

  const reminders = [
    { id: 'school-demo-reminder-001', user: r.examCoordinator, messageId: 'school-demo-task-003', text: 'Review submitted Grade 10 seating plan.', remindAt: localInput(addHours(0.5)) },
    { id: 'school-demo-reminder-002', user: r.eventCoordinator, messageId: 'school-demo-task-009', text: 'Follow up on PTM circular approval.', remindAt: localInput(addHours(0.75)) },
    { id: 'school-demo-reminder-003', user: r.academicCoordinator, messageId: 'school-demo-task-010', text: 'Check pending acknowledgements for Annual Day duty chart.', remindAt: localInput(addHours(1)) },
    { id: 'school-demo-reminder-004', user: r.primaryCoordinator, messageId: 'school-demo-task-006', text: 'Review primary wing substitution duty status.', remindAt: localInput(addHours(2)) },
  ].map((rem) => ({
    id: rem.id,
    collection: 'reminders',
    data: {
      userId: rem.user.uid,
      userEmail: rem.user.email,
      messageId: rem.messageId,
      messageText: rem.text,
      remindAt: rem.remindAt,
      isTriggered: false,
      seedBatch: SEED_BATCH,
    },
  }));

  const notifications = [
    notification('school-demo-notif-001', r.seniorTeacher, 'task', 'New task assigned: Submit department-wise syllabus completion report.', 'school-demo-task-001', 'leadership'),
    notification('school-demo-notif-002', r.seniorTeacher2, 'task', 'New task assigned: Submit department-wise syllabus completion report.', 'school-demo-task-001', 'leadership'),
    notification('school-demo-notif-003', r.classTeacher1, 'task', 'New task assigned: Upload Grade 10 board exam seating plan. Acknowledgement and proof are required.', 'school-demo-task-003', 'boardExam'),
    notification('school-demo-notif-004', r.principal, 'task', `${displayName(r.seniorTeacher)} submitted syllabus closure for review.`, 'school-demo-task-005', 'boardExam'),
    notification('school-demo-notif-005', r.principal, 'task', `${displayName(r.classTeacher2)} submitted science closure for review.`, 'school-demo-task-005', 'boardExam'),
    notification('school-demo-notif-006', r.classTeacher3, 'task', `${displayName(r.primaryCoordinator)} requested review again on substitution duty chart.`, 'school-demo-task-006', 'primaryOps'),
    notification('school-demo-notif-007', t8Old, 'task', `Task transferred from you to ${displayName(t8New)}: Class 3B diary-check duty.`, 'school-demo-task-008', 'primaryOps'),
    notification('school-demo-notif-008', t8New, 'task', `Transferred task assigned to you: Class 3B diary-check duty.`, 'school-demo-task-008', 'primaryOps'),
    notification('school-demo-notif-009', r.eventCoordinator, 'task', `${displayName(r.seniorTeacher)} submitted PTM circular for review.`, 'school-demo-task-009', 'events'),
    notification('school-demo-notif-010', r.classTeacher2, 'task', 'Annual Day duty chart is pending your section update.', 'school-demo-task-010', 'events'),
    notification('school-demo-notif-011', r.classTeacher5, 'task', 'Annual Day duty chart requires your acknowledgement.', 'school-demo-task-010', 'events'),
    notification('school-demo-notif-012', r.academicCoordinator, 'task', 'Task completed: Schedule parent reminder message.', 'school-demo-task-011', 'events'),
  ];

  const audits = [
    audit('school-demo-audit-001', r.principal, 'SEED_GROUPS', 'Created four school demo groups for validation.', 'leadership'),
    audit('school-demo-audit-002', r.academicCoordinator, 'SEED_TASKS', 'Seeded academic leadership task scenarios.', 'leadership'),
    audit('school-demo-audit-003', r.examCoordinator, 'SEED_TASKS', 'Seeded board exam task scenarios.', 'boardExam'),
    audit('school-demo-audit-004', r.primaryCoordinator, 'SEED_TASKS', 'Seeded primary wing task transfer/review scenarios.', 'primaryOps'),
    audit('school-demo-audit-005', r.eventCoordinator, 'SEED_TASKS', 'Seeded event and parent communication scenarios.', 'events'),
    audit('school-demo-audit-006', r.principal, 'SEED_SCHEDULED_MESSAGES', 'Seeded scheduled school communications.', 'events'),
    audit('school-demo-audit-007', r.principal, 'SEED_REMINDERS', 'Seeded active reminders for school demo validation.', 'leadership'),
  ];

  const allWrites = [...groups, ...messages, ...tasks, ...scheduledMessages, ...reminders, ...notifications, ...audits];

  console.table({
    usersFound: users.length,
    groups: groups.length,
    chatMessages: messages.length,
    tasks: tasks.length,
    scheduledMessages: scheduledMessages.length,
    reminders: reminders.length,
    notifications: notifications.length,
    auditLogs: audits.length,
    totalWrites: allWrites.length,
  });

  console.log('Role mapping:');
  console.table(Object.fromEntries(Object.entries(r).filter(([key]) => key !== 'all').map(([key, user]) => [key, `${displayName(user)} <${user.email}>`])));

  if (!APPLY) {
    console.log('Dry run complete. Run `npm run seed:school-demo` to write the demo dataset.');
    return;
  }

  for (const item of allWrites) {
    await writeDocument(item);
    console.log(`✓ ${item.collection}/${item.id}`);
  }

  console.log(`Done. Seeded ${allWrites.length} Firestore documents for ${SEED_BATCH}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed school demo data.');
    console.error(error?.message || error);
    process.exit(1);
  });
