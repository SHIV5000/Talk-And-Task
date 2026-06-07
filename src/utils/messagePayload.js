const MESSAGE_PAYLOAD_REQUIRED_FIELDS = [
  'groupId',
  'groupName',
  'isTask',
  'allowedUsers',
  'isPrivateForward',
  'seenBy',
  'reactions',
];

const isDevMode = () => Boolean(import.meta.env?.DEV);

const uniqueStrings = (values = []) => Array.from(new Set((Array.isArray(values) ? values : [])
  .map((value) => String(value || '').trim())
  .filter(Boolean)));

const normalizeGroup = (group = {}) => ({
  groupId: group.groupId || group.id || '',
  groupName: group.groupName || group.name || '',
  groupAvatar: group.groupAvatar || group.profilePicUrl || group.avatarUrl || undefined,
});

const normalizeUser = (user = {}) => ({
  senderUid: user.senderUid || user.uid || '',
  senderEmail: user.senderEmail || user.email || '',
  senderName: user.senderName || user.name || user.displayName || (user.email ? String(user.email).split('@')[0] : undefined),
  senderAvatar: user.senderAvatar || user.profilePicUrl || user.photoURL || user.avatarUrl || undefined,
});

const normalizeReactions = (reactions = {}) => (
  reactions && typeof reactions === 'object' && !Array.isArray(reactions) ? reactions : {}
);

const normalizeTaskDisplayFields = (taskData = {}, text = '') => ({
  taskTitle: taskData.title || taskData.taskTitle || text || undefined,
  taskStatus: taskData.status || undefined,
  taskPriority: taskData.priority || undefined,
  taskDeadline: taskData.deadline || undefined,
  taskAssigneeEmails: uniqueStrings(taskData.assignees || []),
  taskAssigneeNames: Array.isArray(taskData.assigneeNames) ? uniqueStrings(taskData.assigneeNames) : undefined,
  taskAssigneeCount: Array.isArray(taskData.assignees) ? taskData.assignees.length : 0,
  taskMasterReviewerEmail: taskData.masterReviewerEmail || undefined,
});

const withoutUndefined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const normalizeCommonMessageFields = ({
  group,
  user,
  timestamp,
  isTask = false,
  allowedUsers = [],
  isPrivateForward = false,
  seenBy,
  reactions = {},
  ...extra
} = {}) => {
  const groupFields = normalizeGroup(group);
  const userFields = normalizeUser(user);
  const senderEmail = userFields.senderEmail;

  const isTaskMessage = isTask === true;
  const taskDisplayFields = isTaskMessage ? normalizeTaskDisplayFields(extra.taskData, extra.text) : {};

  return withoutUndefined({
    ...extra,
    ...userFields,
    ...groupFields,
    ...taskDisplayFields,
    timestamp,
    isTask: isTaskMessage,
    allowedUsers: uniqueStrings(allowedUsers),
    isPrivateForward: isPrivateForward === true,
    seenBy: uniqueStrings(seenBy || (senderEmail ? [senderEmail] : [])),
    reactions: normalizeReactions(reactions),
  });
};

export const validateMessagePayload = (payload, context = 'message payload') => {
  if (!isDevMode()) return payload;

  const errors = [];
  MESSAGE_PAYLOAD_REQUIRED_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload || {}, field)) errors.push(`missing ${field}`);
  });

  if (!payload?.groupId) errors.push('groupId must be present');
  if (!payload?.groupName) errors.push('groupName must be present');
  if (typeof payload?.isTask !== 'boolean') errors.push('isTask must be boolean');
  if (!Array.isArray(payload?.allowedUsers)) errors.push('allowedUsers must be an array');
  if (typeof payload?.isPrivateForward !== 'boolean') errors.push('isPrivateForward must be boolean');
  if (!Array.isArray(payload?.seenBy)) errors.push('seenBy must be an array');
  if (!payload?.reactions || typeof payload.reactions !== 'object' || Array.isArray(payload.reactions)) errors.push('reactions must be an object');
  if (payload?.isTask === true && (!payload.taskData || typeof payload.taskData !== 'object' || Array.isArray(payload.taskData))) errors.push('taskData must be an object for task messages');

  if (errors.length > 0) {
    throw new Error(`Malformed ${context}: ${errors.join(', ')}`);
  }

  return payload;
};

export const buildPublicMessagePayload = ({ text = '', group, user, timestamp, ...overrides } = {}) => validateMessagePayload(
  normalizeCommonMessageFields({
    text,
    group,
    user,
    timestamp,
    ...overrides,
    isTask: false,
    allowedUsers: [],
    isPrivateForward: false,
  }),
  'public message payload',
);

export const buildPrivateSupportReplyPayload = ({ text = '', group, user, timestamp, allowedUsers = [], ...overrides } = {}) => validateMessagePayload(
  normalizeCommonMessageFields({
    text,
    group,
    user,
    timestamp,
    ...overrides,
    isTask: false,
    allowedUsers,
    isPrivateForward: true,
  }),
  'private support reply payload',
);

export const buildTaskMessagePayload = ({ text = '', group, user, timestamp, taskData = {}, allowedUsers = [], isPrivateForward = false, ...overrides } = {}) => validateMessagePayload(
  normalizeCommonMessageFields({
    text,
    group,
    user,
    timestamp,
    ...overrides,
    isTask: true,
    taskData,
    allowedUsers,
    isPrivateForward,
  }),
  'task message payload',
);
