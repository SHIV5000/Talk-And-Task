import React, { useState, useEffect } from 'react'; 
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
  
  const [hasSelection, setHasSelection] = useState(false);

  const rawText = chatInputRef.current?.innerText || '';
  const lastWord = rawText.trim() ? rawText.split(/\s/).pop() : '';
  const mentionQuery = lastWord.startsWith('@') ? lastWord.substring(1).toLowerCase() : null;

  const handleInput = () => {
      if (chatInputRef.current) {
          setInputText(chatInputRef.current.innerHTML);
          handleTypingEvent();
      }
  };

  useEffect(() => {
      if (inputText === '' && chatInputRef.current && chatInputRef.current.innerHTML !== '') {
          chatInputRef.current.innerHTML = '';
      }
  }, [inputText]);

  const handleSelectMention = (name, isGroup = false) => {
      if (chatInputRef.current) {
          let html = chatInputRef.current.innerHTML;
          const words = html.split(' ');
          words.pop();
          const badgeHtml = isGroup 
              ? `<span class="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-md font-bold mx-1" contenteditable="false">@@${name}</span>&nbsp;`
              : `<span class="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-md font-bold mx-1" contenteditable="false">@${name}</span>&nbsp;`;
          
          chatInputRef.current.innerHTML = words.join(' ') + (words.length > 0 ? ' ' : '') + badgeHtml;
          setInputText(chatInputRef.current.innerHTML);
          
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStartAfter(chatInputRef.current.lastChild);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
      }
  };

  const applyFormat = (command) => {
      document.execCommand(command, false, null);
      if (chatInputRef.current) {
          setInputText(chatInputRef.current.innerHTML);
          chatInputRef.current.focus();
      }
  };

  return (
    <div className="relative bg-white border-t border-slate-200 p-3 sm:px-6 z-20 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.02)] pb-4 safe-bottom">
      
      {mentionQuery !== null && (
          <div className="absolute bottom-[100%] left-0 w-full bg-white border-t border-slate-200 shadow-xl max-h-48 overflow-y-auto z-50 p-2 animate-in slide-in-from-bottom-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 pt-2">Mention Someone</div>
              {dbUsers.filter(u => u.name?.toLowerCase().includes(mentionQuery)).map(u => (
                  <div key={u.uid} onClick={() => handleSelectMention(u.name.replace(/\s+/g, ''), false)} className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors">
                      <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" />
                      <div className="font-bold text-sm text-slate-700">{u.name}</div>
                  </div>
              ))}
              {!activeGroup?.isDM && groups.filter(g => !g.isDM && g.name?.toLowerCase().includes(mentionQuery)).map(g => (
                  <div key={`group-${g.id}`} onClick={() => handleSelectMention(g.name.replace(/\s+/g, ''), true)} className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600"><i className="fa-solid fa-users"></i></div>
                      <div className="font-bold text-sm text-teal-700">{g.name}</div>
                  </div>
              ))}
          </div>
      )}

      {replyingTo && (
        <div className="mb-2 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between relative shadow-sm animate-in slide-in-from-bottom-2 mx-2">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-l-xl"></div>
          <div className="pl-3 flex-1 min-w-0">
            <div className="font-bold text-[13px] text-indigo-600 mb-0.5"><i className="fa-solid fa-reply mr-1"></i> Replying to {replyingTo.sender?.split('@')[0]}</div>
            <div className="text-[12px] text-slate-600 truncate font-medium">{replyingTo.text || replyingTo.fileName}</div>
          </div>
          <button onClick={() => setReplyingTo(null)} className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 flex items-center justify-center transition-colors"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      {showFileRename && pendingFiles.length > 0 && (
        <div className="mb-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl animate-in slide-in-from-bottom-2 mx-2">
          <div className="flex justify-between items-center mb-3">
             <div className="font-bold text-sm text-slate-800"><i className="fa-solid fa-paperclip text-indigo-500 mr-2"></i> File Attachments ({pendingFiles.length})</div>
             <button onClick={() => { setPendingFiles([]); setShowFileRename(false); }} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2 custom-sidebar-scroll">
            {pendingFiles.map((file, index) => (
              <div key={file.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg shrink-0 shadow-sm"><i className="fa-solid fa-file"></i></div>
                  <input type="text" value={file.customName} onChange={(e) => { const newFiles = [...pendingFiles]; newFiles[index].customName = lockExtension(file.file.name, e.target.value); setPendingFiles(newFiles); }} className="flex-1 p-2 border border-slate-200 rounded-lg text-[13px] font-semibold outline-none focus:border-indigo-500 bg-white shadow-sm" placeholder="File Name..." />
                  <button onClick={() => { const newFiles = pendingFiles.filter((_, i) => i !== index); setPendingFiles(newFiles); if(newFiles.length===0) setShowFileRename(false); }} className="w-8 h-8 rounded-full hover:bg-rose-100 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0"><i className="fa-solid fa-trash-can"></i></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleSendPendingFiles} className="w-full mt-4 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md">
            Upload & Send All
          </button>
        </div>
      )}

      {hasSelection && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-3 py-1.5 rounded-xl shadow-xl flex gap-1 animate-in fade-in zoom-in-95 z-50">
          <button onClick={() => applyFormat('bold')} className="w-8 h-8 hover:bg-white/20 rounded-lg font-serif font-bold transition-colors">B</button>
          <button onClick={() => applyFormat('italic')} className="w-8 h-8 hover:bg-white/20 rounded-lg font-serif italic transition-colors">I</button>
          <button onClick={() => applyFormat('strikeThrough')} className="w-8 h-8 hover:bg-white/20 rounded-lg font-serif line-through transition-colors">S</button>
        </div>
      )}

      <div className="flex items-end gap-2 max-w-5xl mx-auto bg-slate-50 border border-slate-200 rounded-3xl p-1.5 focus-within:bg-white focus-within:border-indigo-400 focus-within:shadow-[0_4px_20px_rgba(79,70,229,0.08)] transition-all relative">
        <style>{`.custom-wysiwyg:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; display: block; }`}</style>
        
        <div className="relative shrink-0">
          <button onClick={() => setEmojiPickerOpen(!emojiPickerOpen)} className="w-[42px] h-[42px] flex justify-center items-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-full transition-colors">
            <i className="fa-regular fa-face-smile text-xl"></i>
          </button>
          {emojiPickerOpen && (
            <div ref={emojiPickerRef} className="emoji-picker-popup">
              {EMOJI_LIST.map(emoji => (
                <button key={emoji} onClick={() => { if(chatInputRef.current){ chatInputRef.current.innerHTML += emoji; setInputText(chatInputRef.current.innerHTML); } setEmojiPickerOpen(false); }}>{emoji}</button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => fileInputRef.current?.click()} className="shrink-0 w-[42px] h-[42px] flex justify-center items-center rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:scale-105 transition-all shadow-sm">
          <i className="fa-solid fa-paperclip text-xl"></i>
        </button>
        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />

        <div className="flex-1 bg-transparent py-2.5 px-3 max-h-[160px] overflow-y-auto custom-sidebar-scroll">
          <div 
             contentEditable 
             ref={chatInputRef}
             onInput={handleInput}
             onPaste={handlePaste}
             onSelect={() => {
                const sel = window.getSelection();
                setHasSelection(sel.toString().length > 0);
             }}
             onBlur={() => setTimeout(() => setHasSelection(false), 200)}
             suppressContentEditableWarning={true}
             data-placeholder="Type a message or paste an image..."
             className="custom-wysiwyg outline-none text-[15px] font-medium text-slate-800 leading-relaxed"
             style={{ minHeight: '24px' }}
          />
        </div>

        <button onClick={() => { if (!inputText.trim() || inputText === '<br>') return alert("Type a message first, then schedule it."); setPendingScheduledText(inputText.trim()); setActiveModal('schedule_send'); }} className="shrink-0 w-[42px] h-[42px] flex justify-center items-center text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors">
          <i className="fa-regular fa-clock text-xl"></i>
        </button>

        {offlineDrafts.length > 0 && (
          <button onClick={() => setActiveModal('offline_drafts')} className="shrink-0 relative w-[42px] h-[42px] flex justify-center items-center text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors">
            <i className="fa-solid fa-inbox text-xl"></i>
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{offlineDrafts.length}</span>
          </button>
        )}

        <button 
          onClick={handleSendOfflineAware} 
          disabled={!inputText.trim() || inputText === '<br>'}
          className={`shrink-0 w-[44px] h-[44px] flex justify-center items-center rounded-full transition-all mb-0.5 ${inputText.trim() && inputText !== '<br>' ? 'bg-[#00a884] text-white shadow-lg shadow-[#00a884]/40 hover:bg-[#008f6f] hover:scale-105' : 'bg-slate-100 text-slate-400'}`}
        >
          <i className={`fa-solid fa-paper-plane text-xl ml-[-2px] ${inputText.trim() && inputText !== '<br>' ? 'text-white drop-shadow-md' : 'text-slate-400'}`}></i>
        </button>
      </div>
    </div>
  );
}
