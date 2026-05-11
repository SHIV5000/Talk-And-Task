import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db } from '../../firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function ModalManager(props) {
  const { activeModal, isUploading, uploadProgress } = props;

  if (!activeModal && !isUploading) return null;

  return (
    <>
      {activeModal === 'context' && <ContextMenuModal {...props} />}
      {activeModal === 'edit_profile' && <ProfileSettingsModal {...props} />}
      {activeModal === 'group_form_modal' && <GroupFormModal {...props} />}
      {activeModal === 'group_settings' && <GroupSettingsModal {...props} />}
      {activeModal === 'task_trail' && props.selectedMessage?.taskData && (
        <TaskTrailModal {...props} readOnly={props.readOnly} />
      )}
      {activeModal === 'task_convert' && <TaskConvertModal {...props} />}
      {activeModal === 'reminder' && <ReminderModal {...props} />}
      {activeModal === 'schedule_send' && <ScheduleSendModal {...props} />}
      {activeModal === 'admin_edit_user' && <AdminEditUserModal {...props} />}
      {activeModal === 'task_analytics' && <TaskAnalyticsModal {...props} />}
      
      {isUploading && <UploadOverlay uploadProgress={uploadProgress} fileName="" />}
    </>
  );
}
