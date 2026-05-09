import React from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function RightSidebar({
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

  // Helper to render a single task card in Jira style
  const renderTaskCard = (task) => {
    const groupObj = groups.find(g => g.id === task.groupId);
    const isTaskDM = !groupObj;
    const groupNameStr = isTaskDM ? 'Direct Message' : groupObj?.name || 'Unknown';

    const handleClick = () => {
      if (groupObj) setActiveGroup(groupObj);
      else {
        const otherUid = task.groupId.replace(user.uid, '').replace('_', '');
        const otherUser = dbUsers.find(u => u.uid === otherUid);
        if (otherUser)
          setActiveGroup({
            id: task.groupId,
            name: otherUser.name,
            isDM: true,
            members: [user.email, otherUser.email],
          });
      }
      setSelectedMessage(task);
      setIsEditingTaskTitle(false);
      setActiveModal('task_trail');
    };

    return (
      <div
        key={task.id}
        onClick={handleClick}
        className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-3"
      >
        {/* Priority & Status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                task.taskData.priority === 'High'
                  ? 'bg-red-100 text-red-700'
                  : task.taskData.priority === 'Medium'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {task.taskData.priority === 'High'
                ? '🔴'
                : task.taskData.priority === 'Medium'
                ? '🟡'
                : '🟢'}{' '}
              {task.taskData.priority || 'Medium'}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                task.taskData.status === 'Completed'
                  ? 'bg-teal-100 text-teal-700'
                  : task.taskData.status === 'In Progress'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {task.taskData.status}
            </span>
          </div>
          {/* Group name */}
          <span
            className={`text-[11px] font-semibold truncate max-w-[100px] ${
              isTaskDM ? 'text-text-secondary' : 'text-primary'
            }`}
          >
            {groupNameStr}
          </span>
        </div>

        {/* Task text */}
        <p className="text-sm font-medium text-text-primary mb-2 line-clamp-2">
          {task.text || 'File Task'}
        </p>

        {/* Footer: assignee avatars + progress bar */}
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
          <div className="flex items-center gap-2">
            {/* Progress bar */}
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  task.taskData.status === 'Completed'
                    ? 'bg-teal-500 w-full'
                    : task.taskData.status === 'In Progress'
                    ? 'bg-indigo-500 w-1/2'
                    : 'bg-amber-500 w-1/4'
                }`}
              ></div>
            </div>
            {/* Deadline */}
            <span className="text-[10px] font-semibold text-warning whitespace-nowrap">
              <i className="fa-regular fa-calendar mr-0.5"></i>
              Due {new Date(task.taskData.deadline).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute right-0 md:relative w-80 h-full bg-surface border-l border-gray-200 flex flex-col shrink-0 z-40 animate-in slide-in-from-right shadow-lg">
      {/* Header */}
      <div className="h-[59px] bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-10 safe-top">
        <div className="font-medium text-[16px] text-text-primary flex items-center gap-2">
          <i className="fa-solid fa-list-check text-primary"></i> Task Hub
        </div>
        <button
          onClick={() => setShowRightSidebar(false)}
          className="w-10 h-10 rounded-full hover:bg-gray-100 text-text-secondary transition-colors flex items-center justify-center text-[19px]"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
        {/* Assigned To Me */}
        <div>
          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
            <i className="fa-solid fa-inbox mr-2 text-primary"></i> Assigned To Me
          </h4>
          {tasksAssignedToMe.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">Inbox zero!</p>
          ) : (
            tasksAssignedToMe.map(task => renderTaskCard(task))
          )}
        </div>

        {/* Assigned By Me */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
            <i className="fa-solid fa-paper-plane mr-2 text-primary"></i> Assigned By Me
          </h4>
          {tasksAssignedByMe.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">No active delegations</p>
          ) : (
            tasksAssignedByMe.map(task => renderTaskCard(task))
          )}
        </div>
      </div>
    </div>
  );
}
