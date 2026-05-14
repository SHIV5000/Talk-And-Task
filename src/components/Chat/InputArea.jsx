import React, { useState } from 'react';
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
  
  const [textSelection, setTextSelection] = useState(null);

  const lastWord = inputText.trim() ? inputText.split(/\s/).pop() : '';
  const mentionQuery = lastWord.startsWith('@') ? lastWord.substring(1).toLowerCase() : null;

  const handleSelectMention = (name, isGroup = false) => {
    const words = inputText.split(/\s/);
    const mentionName = isGroup ? name.replace(/\s+/g, '') : name;
    words[words.length - 1] = `@${mentionName} `;
    setInputText(words.join(' '));
    chatInputRef.current?.focus();
  };

  const checkSelection = () => {
    const el = chatInputRef.current;
    if (el && el.selectionStart !== el.selectionEnd) {
      setTextSelection({ start: el.selectionStart, end: el.selectionEnd });
    } else {
      setTextSelection(null);
    }
  };

  const handleFormat = (startTag, endTag) => {
    if (!textSelection) return;
    const before = inputText.substring(0, textSelection.start);
    const selected = inputText.substring(textSelection.start, textSelection.end);
    const after = inputText.substring(textSelection.end);
    
    setInputText(before + startTag + selected + endTag + after);
    setTextSelection(null);
    
    setTimeout(() => {
        if (chatInputRef.current) {
            chatInputRef.current.focus();
        }
    }, 0);
  };

  return (
    <div className="bg-white border-t border-gray-200 px-3 md:px-4 py-3 shrink-0 z-40 flex flex-col gap-2 safe-bottom w-full relative">
      
      {replyingTo && (
        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between rounded-lg border border-gray-100 animate-in slide-in-from-bottom-1">
          <div className="flex flex-col overflow-hidden">
            <div className="text-sm font-semibold text-primary">{(replyingTo.sender||"").split('@')[0]}</div>
            <div className="text-xs text-text-secondary truncate">"{replyingTo.text || replyingTo.fileName}"</div>
          </div>
          <button onClick={()=>setReplyingTo(null)} className="text-primary hover:text-primary-hover"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      {textSelection && (
        <div className="absolute bottom-full left-4 mb-2 z-50 bg-slate-800 text-white rounded-lg shadow-xl px-2 py-1.5 flex items-center gap-1 animate-in fade-in zoom-in-95">
           <button onClick={(e) => { e.preventDefault(); handleFormat('<b>', '</b>'); }} className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded font-bold text-sm transition-colors" title="Bold">B</button>
           <button onClick={(e) => { e.preventDefault(); handleFormat('<i>', '</i>'); }} className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded italic font-serif text-sm transition-colors" title="Italic">I</button>
           <button onClick={(e) => { e.preventDefault(); handleFormat('<u>', '</u>'); }} className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded underline text-sm transition-colors" title="Underline">U</button>
           <div className="w-px h-5 bg-slate-600 mx-1"></div>
           <button onClick={(e) => { e.preventDefault(); handleFormat('<sup>', '</sup>'); }} className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded text-xs transition-colors" title="Superscript">x²</button>
           <button onClick={(e) => { e.preventDefault(); handleFormat('<sub>', '</sub>'); }} className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded text-xs transition-colors" title="Subscript">x₂</button>
           <div className="w-px h-5 bg-slate-600 mx-1"></div>
           <button onClick={(e) => { e.preventDefault(); handleFormat('<span style="color: maroon;">', '</span>'); }} className="w-5 h-5 rounded-full bg-[#800000] hover:scale-110 ml-1 transition-transform border border-white/20 shadow-inner" title="Maroon"></button>
           <button onClick={(e) => { e.preventDefault(); handleFormat('<span style="color: darkgreen;">', '</span>'); }} className="w-5 h-5 rounded-full bg-[#006400] hover:scale-110 ml-1.5 transition-transform border border-white/20 shadow-inner" title="Dark Green"></button>
           <button onClick={(e) => { e.preventDefault(); handleFormat('<span style="color: blue;">', '</span>'); }} className="w-5 h-5 rounded-full bg-[#0000FF] hover:scale-110 ml-1.5 transition-transform border border-white/20 shadow-inner" title="Blue"></button>
           <button onClick={(e) => { e.preventDefault(); handleFormat('<span style="color: darkorange;">', '</span>'); }} className="w-5 h-5 rounded-full bg-[#FF8C00] hover:scale-110 mx-1.5 transition-transform border border-white/20 shadow-inner" title="Dark Orange"></button>
        </div>
      )}

      {mentionQuery !== null && (
        <div className="absolute bottom-[100%] left-4 bg-white shadow-2xl rounded-xl w-72 max-h-64 overflow-y-auto z-50 py-2 mb-2 border border-slate-200 animate-in fade-in zoom-in-95">
          <div className="px-4 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Peers</div>
          {dbUsers.filter(u => (u.name||"").toLowerCase().includes(mentionQuery)).length > 0 ? (
            dbUsers.filter(u => (u.name||"").toLowerCase().includes(mentionQuery)).map(u => (
              <div 
                key={u.uid} 
                onMouseDown={(e) => e.preventDefault()} 
                onClick={() => handleSelectMention(u.name)} 
                className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 text-sm transition-colors"
              >
                <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" />
                <span className="font-medium text-slate-700">{u.name}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-xs text-slate-400 italic">No users found</div>
          )}

          <div className="px-4 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-t mt-1 pt-2">Departments</div>
          {groups.filter(g => (g.name||"").toLowerCase().includes(mentionQuery) && !g.isArchived).length > 0 ? (
             groups.filter(g => (g.name||"").toLowerCase().includes(mentionQuery) && !g.isArchived).map(g => (
              <div 
                key={g.id} 
                onMouseDown={(e) => e.preventDefault()} 
                onClick={() => handleSelectMention(g.name, true)} 
                className="px-4 py-2.5 hover:bg-teal-50 cursor-pointer flex items-center gap-3 text-sm transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <i className="fa-solid fa-users text-xs"></i>
                </div>
                <span className="font-medium text-slate-700">{g.name}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-xs text-slate-400 italic">No departments found</div>
          )}
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
            <button onClick={handleSendPendingFiles} className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-hover flex items-center gap-2">
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
            <div className="emoji-picker-popup shadow-2xl border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
              {EMOJI_LIST.map(emoji => (
                <button key={emoji} onClick={() => { setInputText(prev => prev + emoji); chatInputRef.current?.focus(); }} className="hover:bg-slate-100 p-1.5 rounded-lg transition-colors">{emoji}</button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-gray-50 rounded-xl flex items-end shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all border border-transparent focus-within:border-transparent">
          <textarea 
            ref={chatInputRef} 
            rows={1} 
            placeholder={isOnline ? "Type or Paste a message..." : "Offline - message will be queued"} 
            className="bg-transparent flex-1 outline-none text-[15px] text-text-primary resize-none py-3 px-4 w-full" 
            style={{ minHeight: '42px', maxHeight: '120px' }} 
            value={inputText} 
            onPaste={handlePaste} 
            onMouseUp={checkSelection}
            onKeyUp={checkSelection}
            onChange={(e) => { 
              setInputText(e.target.value); 
              handleTypingEvent(); 
              e.target.style.height = 'auto'; 
              e.target.style.height = (e.target.scrollHeight < 120 ? e.target.scrollHeight : 120) + 'px'; 
              checkSelection();
            }} 
            onKeyDown={(e) => { 
              if (e.key === 'Enter') {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  const cursorPosition = e.target.selectionStart;
                  const textBefore = inputText.substring(0, cursorPosition);
                  const textAfter = inputText.substring(cursorPosition, inputText.length);
                  setInputText(textBefore + '\n' + textAfter);
                  setTimeout(() => {
                    if (chatInputRef.current) {
                      chatInputRef.current.selectionStart = cursorPosition + 1;
                      chatInputRef.current.selectionEnd = cursorPosition + 1;
                    }
                  }, 0);
                } else {
                  e.preventDefault(); 
                  handleSendOfflineAware(); 
                }
              }
            }} 
          />
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

        <button 
          onClick={handleSendOfflineAware} 
          disabled={!inputText.trim()}
          className={`shrink-0 w-[42px] h-[42px] flex justify-center items-center transition-colors ${inputText.trim() ? 'text-primary hover:text-primary-hover' : 'text-gray-300 cursor-not-allowed'}`}
        >
          <i className="fa-solid fa-paper-plane text-xl"></i>
        </button>
      </div>
    </div>
  );
}
