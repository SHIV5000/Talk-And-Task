import React from 'react';

export default function ContextMenuModal({
  selectedMessage,
  setActiveModal,
  setReplyingTo,
  chatInputRef
}) {
  if (!selectedMessage) return null;

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-in zoom-in-95 transform-gpu overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-[#f0f2f5] flex items-center justify-center min-h-[100px]">
          <p className="text-[15px] text-[#111b21] line-clamp-3 italic text-center font-medium break-words">
            "{selectedMessage.text || selectedMessage.fileName}"
          </p>
        </div>
        <div className="p-3 space-y-1">
          {/* Reply */}
          <button
            onClick={() => {
              setActiveModal(null);
              setReplyingTo(selectedMessage);
              setTimeout(() => chatInputRef.current?.focus(), 100);
            }}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-teal-50 hover:text-[#008069] rounded-xl transition-all text-left text-[16px] font-semibold text-[#3b4a54] group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-teal-100 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-reply text-lg"></i>
            </div>
            Reply to Message
          </button>

          {/* Reminder */}
          <button
            onClick={() => setActiveModal('reminder')}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-yellow-50 hover:text-yellow-600 rounded-xl transition-all text-left text-[16px] font-semibold text-[#3b4a54] group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-yellow-100 flex items-center justify-center transition-colors">
              <i className="fa-regular fa-clock text-lg"></i>
            </div>
            Set Reminder Alert
          </button>

          {/* Convert to Task */}
          <button
            onClick={() => setActiveModal('task_convert')}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all text-left text-[16px] font-semibold text-[#3b4a54] group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <i className="fa-regular fa-square-check text-lg"></i>
            </div>
            Convert to Official Task
          </button>
        </div>
      </div>
    </div>
  );
}
