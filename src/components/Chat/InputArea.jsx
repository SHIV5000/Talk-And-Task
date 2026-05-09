import React from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { EMOJI_LIST, lockExtension } from '../../utils/helpers.js';

export default function InputArea({
  inputText, setInputText, isOnline, isUploading, activeGroup, replyingTo, setReplyingTo,
  handleSendOfflineAware, handleTypingEvent, handlePaste, chatInputRef, fileInputRef,
  handleFileUpload, emojiPickerOpen, setEmojiPickerOpen, emojiPickerRef,
  pendingFiles, setPendingFiles, showFileRename, setShowFileRename,
  uploadFileDirectly, setActiveModal, setPendingScheduledText,
  offlineDrafts, user, dbUsers, groups, currentUserData, MAX_FILE_SIZE_MB,
  handleSendPendingFiles
}) {
  const mentionQuery = inputText.split(/\s+/).pop().startsWith('@') ? inputText.split(/\s+/).pop().substring(1).toLowerCase() : null;

  return (
    <div className="bg-white border-t border-gray-200 px-3 md:px-4 py-3 shrink-0 z-10 flex flex-col gap-2 safe-bottom w-full">
      {replyingTo && (
        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between rounded-lg border border-gray-100">
          <div className="flex flex-col overflow-hidden">
            <div className="text-sm font-semibold text-primary">{(replyingTo.sender||"").split('@')[0]}</div>
            <div className="text-xs text-text-secondary truncate">"{replyingTo.text || replyingTo.fileName}"</div>
          </div>
          <button onClick={()=>setReplyingTo(null)} className="text-primary hover:text-primary-hover"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}
      {mentionQuery && (
        <div className="absolute bottom-full left-4 bg-white shadow-lg rounded-lg w-72 max-h-56 overflow-y-auto z-20 py-2 mb-2 border">
          <div className="px-4 py-1 text-xs font-bold text-primary">Users</div>
          {dbUsers.filter(u => (u.name||"").toLowerCase().includes(mentionQuery)).map(u => (
            <div key={u.uid} onMouseDown={(e) => e.preventDefault()} onClick={() => { const words = inputText.split(/\s+/); words[words.length - 1] = `@${u.name} `; setInputText(words.join(' ')); chatInputRef.current?.focus(); }} className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-3 text-sm">
              <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" />
              {u.name}
            </div>
          ))}
          <div className="px-4 py-1 text-xs font-bold text-primary border-t mt-1 pt-2">Teams</div>
          {groups.filter(g => (g.name||"").toLowerCase().includes(mentionQuery) && !g.isArchived).map(g => (
            <div key={g.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { const words = inputText.split(/\s+/); words[words.length - 1] = `@${g.name.replace(/\s+/g, '')} `; setInputText(words.join(' ')); }} className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-3 text-sm">
              <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-8 h-8" isGroup={true} />
              {g.name}
            </div>
          ))}
        </div>
      )}
      {showFileRename && pendingFiles.length > 0 && (
        <div className="bg-white border border-primary shadow-xl rounded-2xl p-4 animate-in slide-in-from-bottom-2 z-20 space-y-3">
          {pendingFiles.map((pf) => (
            <div key={pf.id} className="flex items-start gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary"><i className="fa-solid fa-file-lines text-xl"></i></div>
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input type="text" value={pf.customName.replace(/\.[^/.]+$/, '')} onChange={(e) => { const newName = lockExtension(pf.file.name, e.target.value); setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, customName: newName } : f)); }} className="flex-1 text-sm font-bold text-text-primary outline-none border-b border-transparent focus:border-primary bg-transparent py-0.5" placeholder="File name" />
                  <span className="text-sm font-bold text-text-secondary">.{pf.file.name.split('.').pop()}</span>
                  <span className="text-[11px] font-semibold text-text-secondary bg-gray-100 px-2 py-0.5 rounded-full">{(pf.file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <textarea rows={1} value={pf.caption} onChange={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight < 120 ? e.target.scrollHeight : 120) + 'px'; setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, caption: e.target.value } : f)); }} placeholder="Add a message..." className="w-full text-sm text-text-primary outline-none bg-gray-50 border rounded-xl px-3.5 py-2.5 resize-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"></textarea>
              </div>
              <button onClick={() => { setPendingFiles(prev => prev.filter(f => f.id !== pf.id)); if (pendingFiles.length === 1) setShowFileRename(false); }} className="text-text-secondary hover:text-danger p-2"><i className="fa-solid fa-trash-can text-lg"></i></button>
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setPendingFiles([]); setShowFileRename(false); }} className="text-text-secondary font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-100">Cancel</button>
            <button onClick={() => { if (pendingFiles.length === 0) { setShowFileRename(false); return; } pendingFiles.forEach(pf => uploadFileDirectly(pf)); setShowFileRename(false); }} className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-hover flex items-center gap-2">
              <i className="fa-solid fa-paper-plane"></i> Send {pendingFiles.length > 1 ? `All (${pendingFiles.length})` : ''}
            </button>
          </div>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"/>
        <button className="w-[42px] h-[42px] flex items-center justify-center text-primary hover:text-primary-hover transition-colors shrink-0" onClick={() => fileInputRef.current.click()} disabled={isUploading}>
          <i className="fa-solid fa-plus text-xl"></i>
        </button>
        <div className="relative shrink-0" ref={emojiPickerRef}>
          <button onClick={() => setEmojiPickerOpen(!emojiPickerOpen)} className="w-[42px] h-[42px] flex items-center justify-center text-primary hover:text-primary-hover transition-colors">
            <i className="fa-regular fa-face-smile text-xl"></i>
          </button>
          {emojiPickerOpen && (
            <div className="emoji-picker-popup">
              {EMOJI_LIST.map(emoji => (
                <button key={emoji} onClick={() => { setInputText(prev => prev + emoji); chatInputRef.current?.focus(); }}>{emoji}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl flex items-end shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all">
          <textarea ref={chatInputRef} rows={1} placeholder={isOnline ? "Type or Paste a message..." : "Offline - message will be queued"} className="bg-transparent flex-1 outline-none text-[15px] text-text-primary resize-none py-3 px-4 w-full" style={{ minHeight: '42px', maxHeight: '120px' }} value={inputText} onPaste={handlePaste} onChange={(e) => { setInputText(e.target.value); handleTypingEvent(); e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight < 120 ? e.target.scrollHeight : 120) + 'px'; }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendOfflineAware(); } }} />
        </div>
        <button onClick={() => { if (!inputText.trim()) return alert("Type a message first, then schedule it."); setPendingScheduledText(inputText.trim()); setActiveModal('schedule_send'); }} className="shrink-0 w-[42px] h-[42px] flex justify-center items-center text-primary hover:text-primary-hover transition-colors">
          <i className="fa-regular fa-clock text-xl"></i>
        </button>
        {offlineDrafts.length > 0 && (
          <button onClick={() => setActiveModal('offline_drafts')} className="shrink-0 relative w-[42px] h-[42px] flex justify-center items-center text-primary">
            <i className="fa-solid fa-inbox text-xl"></i>
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">{offlineDrafts.length}</span>
          </button>
        )}
        {inputText.trim() ? (
          <button onClick={handleSendOfflineAware} className="shrink-0 w-[42px] h-[42px] flex justify-center items-center text-primary hover:text-primary-hover transition-colors">
            <i className="fa-solid fa-paper-plane text-xl"></i>
          </button>
        ) : (
          <button className="shrink-0 w-[42px] h-[42px] flex justify-center items-center text-gray-400 cursor-not-allowed">
            <i className="fa-solid fa-paper-plane text-xl"></i>
          </button>
        )}
      </div>
    </div>
  );
}
