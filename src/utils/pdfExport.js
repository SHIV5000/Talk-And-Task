import jsPDF from 'jspdf';
import 'jspdf-autotable';

const buildHeader = (doc, title, adminEmail, reportPeriod = 'All Time') => {
  const now = new Date();
  const generated = `${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
  doc.setFontSize(16);
  doc.text(`TALK & TASK — ${title}`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Generated: ${generated}`, 14, 26);
  doc.text(`Downloaded by: ${adminEmail || 'admin'}`, 14, 32);
  doc.text(`Report Period: ${reportPeriod}`, 14, 38);
};

export const exportPerformanceReport = (performanceRows, adminEmail) => {
  const doc = new jsPDF();
  buildHeader(doc, 'Performance Report', adminEmail);

  const body = performanceRows.map((row) => [
    row.name || row.email,
    row.totalAssigned ?? 0,
    row.completedOnTime ?? 0,
    row.totalBreaches ?? 0,
    `${row.complianceScore ?? 0}%`
  ]);

  doc.autoTable({
    startY: 46,
    head: [['User', 'Assigned', 'On Time', 'Breaches', 'Score']],
    body
  });
  doc.save(`performance_report_${Date.now()}.pdf`);
};

export const exportAuditLog = (logs, filters, adminEmail) => {
  const period = filters?.dateFrom || filters?.dateTo ? `${filters?.dateFrom || '...'} to ${filters?.dateTo || '...'}` : 'All Time';
  const doc = new jsPDF();
  buildHeader(doc, 'Audit Log Report', adminEmail, period);

  const body = logs.map((l) => [
    l.timestamp?.toDate ? new Date(l.timestamp.toDate()).toLocaleString() : 'N/A',
    l.userEmail || l.user || 'N/A',
    l.action || l.type || 'N/A',
    l.details || l.content || ''
  ]);

  doc.autoTable({
    startY: 46,
    head: [['Time', 'Actor', 'Action', 'Details']],
    body
  });
  doc.save(`audit_report_${Date.now()}.pdf`);
};

export const exportTaskMaster = (tasks, adminEmail) => {
  const doc = new jsPDF();
  buildHeader(doc, 'Task Master Report', adminEmail);

  const body = tasks.map((t) => [
    (t.text || '').replace(/<[^>]+>/g, '').slice(0, 70),
    t.sender || '',
    t.taskData?.status || '',
    t.taskData?.priority || '',
    t.taskData?.deadline ? new Date(t.taskData.deadline).toLocaleDateString() : 'N/A'
  ]);

  doc.autoTable({
    startY: 46,
    head: [['Task', 'Owner', 'Status', 'Priority', 'Deadline']],
    body
  });
  doc.save(`task_master_report_${Date.now()}.pdf`);
};
