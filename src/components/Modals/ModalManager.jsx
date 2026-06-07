import React from 'react';
import ContextMenuModal from './ContextMenuModal.jsx';
import ProfileSettingsModal from './ProfileSettingsModal.jsx';
import GroupFormModal from './GroupFormModal.jsx';
import GroupSettingsModal from './GroupSettingsModal.jsx';
import TaskTrailModal from './TaskTrailModal.jsx';
import TaskConvertModal from './TaskConvertModal.jsx';
import ReminderModal from './ReminderModal.jsx';
import ScheduleSendModal from './ScheduleSendModal.jsx';
import AdminEditUserModal from './AdminEditUserModal.jsx';
import TaskAnalyticsModal from './TaskAnalyticsModal.jsx';
import ActiveSchedulesModal from './ActiveSchedulesModal.jsx'; // 👈 IMPORTED HERE
import SupportTicketsModal from './SupportTicketsModal.jsx';
import UploadOverlay from '../Common/UploadOverlay.jsx';

export default function ModalManager(props) {
  const { activeModal, isUploading, uploadProgress, featureFlags = {} } = props;
  const hasFeature = (flag) => featureFlags?.[flag] !== false;

  if (!activeModal && !isUploading) return null;

  return (
    <>
      {activeModal === 'context' && <ContextMenuModal {...props} />}
      {activeModal === 'edit_profile' && <ProfileSettingsModal {...props} />}
      {activeModal === 'group_form_modal' && <GroupFormModal {...props} />}
      {activeModal === 'group_settings' && <GroupSettingsModal {...props} />}
      {activeModal === 'task_trail' && hasFeature('taskCards') && props.selectedMessage?.taskData && (
        <TaskTrailModal {...props} readOnly={props.readOnly} />
      )}
      {activeModal === 'task_convert' && hasFeature('taskCards') && <TaskConvertModal {...props} />}
      {activeModal === 'reminder' && <ReminderModal {...props} />}
      {activeModal === 'schedule_send' && <ScheduleSendModal {...props} />}
      {activeModal === 'admin_edit_user' && <AdminEditUserModal {...props} />}
      {activeModal === 'task_analytics' && hasFeature('taskCards') && <TaskAnalyticsModal {...props} />}
      
      {/* 👈 REGISTERED HERE */}
      {activeModal === 'active_schedules' && <ActiveSchedulesModal {...props} />} 
      {activeModal === 'support_tickets' && <SupportTicketsModal {...props} />}
      
      {isUploading && <UploadOverlay uploadProgress={uploadProgress} fileName="" />}
    </>
  );
}
