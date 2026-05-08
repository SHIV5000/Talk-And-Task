import React from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { EMOJI_LIST, lockExtension } from '../../utils/helpers.js';

export default function InputArea({
  inputText,
  setInputText,
  isOnline,
  isUploading,
  activeGroup,
  replyingTo,
  setReplyingTo,
  handleSendOfflineAware,
  handleTypingEvent,
  handlePaste,
  chatInputRef,
  fileInputRef,
  handleFileUpload,
  emojiPickerOpen,
  setEmojiPickerOpen,
  emojiPickerRef,
  pendingFiles,
  setPendingFiles,
  showFileRename,
  setShowFileRename,
  uploadFileDirectly,
  setActiveModal,
  setPendingScheduledText,
  offlineDrafts,
  user,
  dbUsers,
  groups,
  currentUserData,
  MAX_FILE_SIZE_MB,
}) {
  const mentionQuery = inputText.split(/\s+/).pop().startsWith('@') ? inputText.split(/\s+/).pop().substring(1).toLowerCase() : null;

  return (
    <div className="bg-[#f0f2f5] px-3 md:px-4 py-3 shrink-0 z-10 flex flex-col gap-2 safe-bottom relative w-full">
      {replyingTo && (
        <div className="bg-[#f0f2f5] px-4 py-2 flex items-center justify-between shrink-0 animate-in slide-in-from-bottom-2 z-10 relative">
          <div className="flex-1 bg-[#e9edef] rounded-lg p-2 border-l-4 border-[#00a884] flex items-center justify-between">
            <div className="flex flex-col overflow-hidden pr-2">
              <div className="text-[13px] font-semibold text-[#00a884]">{(replyingTo.sender||"").split('@')[0]}</div>
              <div className="text-[13px] text-[#54656f] truncate">"{replyingTo.text || replyingTo.fileName}"</div>
            </div>
            <button onClick={()=>setReplyingTo(null)} className="w-8 h-8 rounded-full text-[#54656f] hover:bg-black/5 transition-colors flex items-center justify-center text-[20px]"><i className="fa-solid fa-xmark"></i></button>
          </div>
        </div>
      )}

      {/* Mention popup */}
      {mentionQuery && (
        <div className="absolute bottom-full left-4 bg-white shadow-[0_2px_5px_0_rgba(11,20,26,.26),0_2px_10px_0_rgba(11,20,26,.16)] rounded-lg w-72 max-h-56 overflow-y-auto z-20 py-2 mb-2 border border-slate-100">
          <div className="px-4 py-1 text-[12px] font-bold text-[#00a884] tracking-wide mb-1">Users</div>
          {dbUsers.filter(u => (u.name||"").toLowerCase().includes(mentionQuery)).map(u => (
            <div key={u.uid} onMouseDown={(e) => e.preventDefault()} onClick={() => { const words = inputText.split(/\s+/); words[words.length - 1] = `@${u.name} `; setInputText(words.join(' ')); chatInputRef.current?.focus(); }} className="px-4 py-2 hover:bg-[#f5f6f6] cursor-pointer text-[14px] flex items-center gap-3 text-[#111b21] transition-colors">
              <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" />
              {u.name}
            </div>
          ))}
          <div className="px-4 py-1 text-[12px] font-bold text-[#00a884] tracking-wide border-t border-slate-100 my-1 pt-2">Teams</div>
          {groups.filter(g => (g.name||"").toLowerCase().includes(mentionQuery) && !g.isArchived).map(g => (
            <div key={g.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { const words = inputText.split(/\s+/); words[words.length - 1] = `@${g.name.replace(/\s+/g, '')} `; setInputText(words.join(' ')); chatInputRef.current?.focus(); }} className="px-4 py-2 hover:bg-[#f5f6f6] cursor-pointer text-[14px] flex items-center gap-3 text-[#111b21] transition-colors">
              <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-8 h-8" isGroup={true} />
              {g.name}
            </div>
          ))}
        </div>
      )}

      {/* File rename card */}
      {showFileRename && pendingFiles.length > 0 && (
        <div className="bg-white border border-[#00a884] shadow-xl rounded-2xl p-4 animate-in slide-in-from-bottom-2 z-20 space-y-3">
          {pendingFiles.map((pf) => (
            <div key={pf.id} className="flex items-start gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
              <div className="mt-1 w-10 h-10 rounded-lg bg-[#e8fbf6] flex items-center justify-center shrink-0 border border-[#00a884]/20">
                <i className="fa-solid fa-file-lines text-[#00a884] text-xl"></i>
              </div>
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pf.customName.replace(/\.[^/.]+$/, '')}
                    onChange={(e) => {
                      const newName = lockExtension(pf.file.name, e.target.value);
                      setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, customName: newName } : f));
                    }}
                    className="flex-1 text-[15px] font-bold text-slate-800 outline-none border-b border-transparent focus:border-[#00a884] bg-transparent transition-colors py-0.5"
                    placeholder="File name"
                  />
                  <span className="text-[13px] font-bold text-slate-400">.{pf.file.name.split('.').pop()}</span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-auto shrink-0 border border-slate-200">{(pf.file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <textarea
                  rows={1}
                  value={pf.caption}
                  onChange={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = (e.target.scrollHeight < 120 ? e.target.scrollHeight : 120) + 'px';
                    setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, caption: e.target.value } : f));
                  }}
                  placeholder="Add a message..."
                  className="w-full text-[14.2px] text-[#111b21] outline-none bg-[#f0f2f5] border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:bg-white focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all placeholder-[#8696a0]"
                />
              </div>
              <button onClick={() => { setPendingFiles(prev => prev.filter(f => f.id !== pf.id)); if (pendingFiles.length === 1) setShowFileRename(false); }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl mt-1 transition-colors" title="Remove file"><i className="fa-solid fa-trash-can text-lg"></i></button>
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setPendingFiles([]); setShowFileRename(false); }} className="text-slate-600 font-bold text-[14.2px] px-5 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            <button
              onClick={() => {
                if (pendingFiles.length === 0) { setShowFileRename(false); return; }
                pendingFiles.forEach(pf => uploadFileDirectly(pf));
                setShowFileRename(false);
              }}
              className="bg-[#008069] text-white px-6 py-2.5 rounded-xl text-[14.2px] font-bold shadow-sm hover:bg-[#006e5a] transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-paper-plane"></i> Send {pendingFiles.length > 1 ? `All (${pendingFiles.length})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"/>
        <button className="w-[42px] h-[42px] flex items-center justify-center text-[#54656f] hover:text-[#111b21] transition-colors shrink-0 text-[22px]" onClick={() => fileInputRef.current.click()} disabled={isUploading}><i className="fa-solid fa-plus"></i></button>

        <div className="relative shrink-0" ref={emojiPickerRef}>
          <button onClick={() => setEmojiPickerOpen(!emojiPickerOpen)} className="w-[42px] h-[42px] flex items-center justify-center text-[#54656f] hover:text-[#111b21] transition-colors text-[22px]" title="Emoji"><i className="fa-regular fa-face-smile"></i></button>
          {emojiPickerOpen && (
            <div className="emoji-picker-popup">
              {EMOJI_LIST.map(emoji => (
                <button key={emoji} onClick={() => { setInputText(prev => prev + emoji); chatInputRef.current?.focus(); }}>{emoji}</button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-white rounded-lg flex flex-col shadow-sm overflow-hidden justify-end">
          <div className="flex gap-1 px-3 pt-1.5 pb-0.5 bg-slate-50 border-b border-slate-100">
            <button onClick={(e) => { e.preventDefault(); const cursor = chatInputRef.current?.selectionStart || 0; const text = inputText; setInputText(text.slice(0, cursor) + '**' + text.slice(cursor)); chatInputRef.current?.focus(); }} title="Bold" className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-100 transition-colors">B</button>
            <button onClick={(e) => { e.preventDefault(); const cursor = chatInputRef.current?.selectionStart || 0; const text = inputText; setInputText(text.slice(0, cursor) + '__' + text.slice(cursor)); chatInputRef.current?.focus(); }} title="Italic" className="text-[11px] italic font-bold text-slate-600 bg-white border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-100 transition-colors">I</button>
            <button onClick={(e) => { e.preventDefault(); const cursor = chatInputRef.current?.selectionStart || 0; const text = inputText; setInputText(text.slice(0, cursor) + '~~' + text.slice(cursor)); chatInputRef.current?.focus(); }} title="Strikethrough" className="text-[11px] line-through font-bold text-slate-600 bg-white border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-100 transition-colors">S</button>
          </div>
          <textarea ref={chatInputRef} rows={1} placeholder={isOnline ? "Type or Paste a message..." : "⚡ Offline — message will be queued"} className="bg-transparent flex-1 outline-none text-[15px] text-[#111b21] resize-none py-[10px] px-4 w-full" style={{ minHeight: '42px', maxHeight: '120px' }} value={inputText} onPaste={handlePaste} onChange={(e) => { setInputText(e.target.value); handleTypingEvent(); e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight < 120 ? e.target.scrollHeight : 120) + 'px'; }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendOfflineAware(); } }} />
        </div>

        <button onClick={() => { if (!inputText.trim()) return alert("Type a message first, then schedule it."); setPendingScheduledText(inputText.trim()); setActiveModal('schedule_send'); }} className="shrink-0 w-[42px] h-[42px] flex justify-center items-center text-[#54656f] hover:text-amber-500 transition-colors" title="Schedule this message"><i className="fa-regular fa-clock text-[20px]"></i></button>

        {offlineDrafts.length > 0 && (
          <button onClick={() => setActiveModal('offline_drafts')} className="shrink-0 relative w-[42px] h-[42px] flex justify-center items-center text-amber-500 hover:text-amber-600 transition-colors" title={`${offlineDrafts.length} offline draft(s)`}>
            <i className="fa-solid fa-inbox text-[20px]"></i>
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{offlineDrafts.length}</span>
          </button>
        )}

        {inputText.trim() ? (
          <button onClick={handleSendOfflineAware} className="shrink-0 w-[42px] h-[42px] flex justify-center items-center text-[#54656f] hover:text-[#00a884] transition-colors"><i className="fa-solid fa-paper-plane text-[22px]"></i></button>
        ) : (
          <button className="shrink-0 w-[42px] h-[42px] flex justify-center items-center text-[#54656f] opacity-50 cursor-not-allowed"><i className="fa-solid fa-paper-plane text-[22px]"></i></button>
        )}
      </div>
    </div>
  );
}
