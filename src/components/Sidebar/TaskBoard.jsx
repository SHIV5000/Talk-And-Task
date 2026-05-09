import React, { useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

// Re-using the same Jira-style card renderer
function TaskCard({ task, groups, dbUsers, user, onClick }) {
  const groupObj = groups.find(g => g.id === task.groupId);
  const isTaskDM = !groupObj;
  const groupNameStr = isTaskDM ? 'Direct Message' : groupObj?.name || 'Unknown';

  const priorityColors = {
    High:   'bg-red-100 text-red-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low:    'bg-green-100 text-green-700',
  };
  const statusColors = {
    'To Do':       'bg-amber-100 text-amber-700',
    'In Progress': 'bg-indigo-100 text-indigo-700',
    'Completed':   'bg-teal-100 text-teal-700',
    'Overdue':     'bg-red-100 text-red-700',
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-3"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityColors[task.taskData.priority] || priorityColors.Medium}`}>
            {task.taskData.priority === 'High' ? '🔴' : task.taskData.priority === 'Medium' ? '🟡' : '🟢'} {task.taskData.priority || 'Medium'}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[task.taskData.status] || statusColors['To Do']}`}>
            {task.taskData.status}
          </span>
        </div>
        <span className={`text-[11px] font-semibold truncate max-w-[100px] ${isTaskDM ? 'text-text-secondary' : 'text-primary'}`}>
          {groupNameStr}
        </span>
      </div>

      <p className="text-sm font-medium text-text-primary mb-2 line-clamp-2">{task.text || 'File Task'}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center -space-x-2">
          {(task.taskData.assignees || []).slice(0, 3).map(email => {
            const assignee = dbUsers?.find(u => u.email === email);
            return (
              <MemoizedAvatar
                key={email}
                uid={assignee?.uid || email}
                url={assignee?.profilePicUrl}
                name={assignee?.name || email.split('@')[0]}
                sizeClass="w-6 h-6"
                extraClasses="border-2 border-white"
              />
            );
          })}
          {(task.taskData.assignees || []).length > 3 && (
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-text-secondary border-2 border-white">
              +{task.taskData.assignees.length - 3}
            </div>
          )}
        </div>
        <span className="text-[10px] font-semibold text-warning whitespace-nowrap">
          <i className="fa-regular fa-calendar mr-0.5"></i>
          Due {new Date(task.taskData.deadline).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export default function TaskBoard({
  showRightSidebar,
  setShowRightSidebar,
  tasksAssignedToMe,
  tasksAssignedByMe,
  groups,
  dbUsers,
  user,
  setActiveGroup,
  setSelectedMessage,
  setIsEditingTaskTitle,
  setActiveModal,
}) {
  if (!showRightSidebar) return null;

  // Merge and deduplicate tasks visible to this user
  const allMyTasks = useMemo(() => {
    const unique = new Map();
    [...tasksAssignedToMe, ...tasksAssignedByMe].forEach(task => {
      if (!unique.has(task.id)) unique.set(task.id, task);
    });
    return Array.from(unique.values());
  }, [tasksAssignedToMe, tasksAssignedByMe]);

  // Split into columns
  const columns = useMemo(() => {
    const now = new Date();
    const todo = [];
    const inProgress = [];
    const completed = [];
    const overdue = [];

    allMyTasks.forEach(task => {
      if (task.taskData?.isArchived) return;
      const isOverdue = task.taskData?.deadline && new Date(task.taskData.deadline) < now && task.taskData.status !== 'Completed';
      if (task.taskData.status === 'Completed') completed.push(task);
      else if (isOverdue) overdue.push(task);
      else if (task.taskData.status === 'In Progress') inProgress.push(task);
      else todo.push(task);
    });

    return { todo, inProgress, completed, overdue };
  }, [allMyTasks]);

  const handleTaskClick = (task) => {
    const groupObj = groups.find(g => g.id === task.groupId);
    if (groupObj) setActiveGroup(groupObj);
    else {
      const otherUid = task.groupId.replace(user.uid, '').replace('_', '');
      const otherUser = dbUsers.find(u => u.uid === otherUid);
      if (otherUser)
        setActiveGroup({ id: task.groupId, name: otherUser.name, isDM: true, members: [user.email, otherUser.email] });
    }
    setSelectedMessage(task);
    setIsEditingTaskTitle(false);
    setActiveModal('task_trail');
  };

  const renderColumn = (title, tasks, icon, colorClass) => (
    <div className="flex-1 min-w-[220px] max-w-[300px] flex flex-col bg-gray-50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>
          <i className={`${icon} mr-2`}></i> {title}
        </h4>
        <span className="text-[11px] font-semibold text-text-secondary bg-white px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-6">No tasks</p>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              groups={groups}
              dbUsers={dbUsers}
              user={user}
              onClick={() => handleTaskClick(task)}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="absolute right-0 md:relative w-[85vw] md:w-[600px] lg:w-[700px] h-full bg-surface border-l border-gray-200 flex flex-col shrink-0 z-40 animate-in slide-in-from-right shadow-2xl">
      {/* Header */}
      <div className="h-[59px] bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-10 safe-top">
        <div className="font-medium text-[16px] text-text-primary flex items-center gap-2">
          <i className="fa-solid fa-chart-kanban text-primary"></i> Task Board
        </div>
        <button
          onClick={() => setShowRightSidebar(false)}
          className="w-10 h-10 rounded-full hover:bg-gray-100 text-text-secondary transition-colors flex items-center justify-center"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-4">
        {renderColumn('To Do', columns.todo, 'fa-regular fa-circle', 'text-amber-600')}
        {renderColumn('In Progress', columns.inProgress, 'fa-solid fa-spinner', 'text-indigo-600')}
        {renderColumn('Completed', columns.completed, 'fa-solid fa-check-circle', 'text-teal-600')}
        {renderColumn('Overdue', columns.overdue, 'fa-solid fa-exclamation-circle', 'text-red-600')}
      </div>
    </div>
  );
}
