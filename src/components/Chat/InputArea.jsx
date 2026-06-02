import React, { useState, useEffect } from 'react';
import { db } from '../../firebase.js';
import { doc, deleteDoc } from 'firebase/firestore';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { EMOJI_LIST, lockExtension } from '../../utils/helpers.js';

export default function InputArea({
  inputText, setInputText, isOnline, isUploading, activeGroup, replyingTo, setReplyingTo,
  handleSendOfflineAware, handleTypingEvent, handlePaste, chatInputRef, fileInputRef,
  handleFileUpload, emojiPickerOpen, setEmojiPickerOpen, emojiPickerRef,
  pendingFiles, setPendingFiles, showFileRename, setShowFileRename,
  uploadFileDirectly, setActiveModal, setPendingScheduledText,
  offlineDrafts, user, dbUsers, groups, currentUserData, MAX_FILE_SIZE_MB, uploadProgress = 0,
  handleSendPendingFiles,
  composerVariant = 'chat',
  containerClassName = '',
  placeholder,
  showScheduleButton = true,
  showOfflineDrafts = true
}) {

  const [hasSelection, setHasSelection] = useState(false);

  const rawText = chatInputRef.current?.innerText || '';
  const lastWord = rawText.trim() ? rawText.split(/\s/).pop() : '';
  const mentionQuery = lastWord.startsWith('@') ? lastWord.substring(1).toLowerCase() : null;

  const handleInput = () => {
      if (chatInputRef.current) {
          let html = chatInputRef.current.innerHTML
            .replace(/&lt;(\/?(?:b|strong|i|em|u))&gt;/gi, '<$1>')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          if (html !== chatInputRef.current.innerHTML) chatInputRef.current.innerHTML = html;
          setInputText(html);
          handleTypingEvent?.();
      }
  };

  useEffect(() => {
      if (inputText === '' && chatInputRef.current && chatInputRef.current.innerHTML !== '') {
          chatInputRef.current.innerHTML = '';
      }
  }, [inputText]);

  const handleSelectMention = (name, isGroup = false) => {
    const mentionName = isGroup ? name.replace(/\s+/g, '') : name;
    const mentionHtml = `<span contenteditable="false" class="mention-chip" data-mention="${mentionName}">@${mentionName}</span>&nbsp;`;
    chatInputRef.current.focus();
    const html = chatInputRef.current.innerHTML;
    const newHtml = html.replace(/@[^@\s<]*$/, mentionHtml);
    chatInputRef.current.innerHTML = newHtml;
    setInputText(newHtml);

    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(chatInputRef.current);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const checkSelection = () => {
    const sel = window.getSelection();
    setHasSelection(sel && sel.toString().length > 0 && chatInputRef.current?.contains(sel.anchorNode));
  };

  const insertEmoji = (emoji) => {
    chatInputRef.current.focus();
    document.execCommand('insertText', false, emoji);
    handleInput();
    setEmojiPickerOpen(false);
  };

  return (
    <div className={`${composerVariant === 'reply' ? 'bg-white border-t border-slate-200 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]' : 'bg-white border-t border-gray-200 px-3 md:px-4 py-3 safe-bottom'} shrink-0 z-40 flex flex-col gap-2 w-full relative ${containerClassName}`}>
      <style>{`.custom-wysiwyg:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; display: block; }.mention-chip{display:inline-block;background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe;border-radius:999px;padding:0 6px;font-weight:800;}`}</style>

      {replyingTo && (
        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between rounded-lg border border-gray-100 animate-in slide-in-from-bottom-1">
          <div className="flex flex-col overflow-hidden">
            <div className="text-sm font-semibold text-primary">{(replyingTo.sender||"").split('@')[0]}</div>
            <div className="text-xs text-text-secondary truncate">"{replyingTo.text || replyingTo.fileName}"</div>
          </div>
          <button onClick={()=>setReplyingTo(null)} className="text-primary hover:text-primary-hover"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      {/* Permanent compact rich-text toolbar */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/90 px-2 py-1 shadow-sm input-toolbar">
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false, null); handleInput(); }} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg font-bold text-sm transition-colors" title="Bold">B</button>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false, null); handleInput(); }} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg italic font-serif text-sm transition-colors" title="Italic">I</button>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline', false, null); handleInput(); }} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg underline text-sm transition-colors" title="Underline">U</button>
        <div className="w-px h-5 bg-slate-200 mx-1"></div>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('superscript', false, null); handleInput(); }} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg text-xs transition-colors" title="Superscript">x²</button>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('subscript', false, null); handleInput(); }} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg text-xs transition-colors" title="Subscript">x₂</button>
        <div className="w-px h-5 bg-slate-200 mx-1"></div>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#800000'); handleInput(); }} className="w-5 h-5 rounded-full hover:scale-110 transition-transform border border-white shadow" style={{ backgroundColor: '#800000' }} title="Maroon"></button>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#006400'); handleInput(); }} className="w-5 h-5 rounded-full hover:scale-110 transition-transform border border-white shadow" style={{ backgroundColor: '#006400' }} title="Dark Green"></button>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#1d4ed8'); handleInput(); }} className="w-5 h-5 rounded-full hover:scale-110 transition-transform border border-white shadow" style={{ backgroundColor: '#1d4ed8' }} title="Dark Blue"></button>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#cc5500'); handleInput(); }} className="w-5 h-5 rounded-full hover:scale-110 transition-transform border border-white shadow" style={{ backgroundColor: '#cc5500' }} title="Dark Orange"></button>
        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('removeFormat', false, null); handleInput(); }} className="ml-auto px-2 h-7 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-white transition-colors" title="Clear formatting"><i className="fa-solid fa-eraser mr-1"></i>Clear</button>
      </div>

      {mentionQuery !== null && (
        <div className="absolute bottom-[100%] left-4 bg-white shadow-2xl rounded-xl w-72 max-h-64 overflow-y-auto z-[130] py-2 mb-2 border border-slate-200 animate-in fade-in zoom-in-95">
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

          <div className="px-4 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-t mt-1 pt-2">Groups</div>
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
            <div className="px-4 py-2 text-xs text-slate-400 italic">No groups found</div>
          )}
        </div>
      )}

      {isUploading && uploadProgress > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
          <div className="h-2 bg-white rounded-full overflow-hidden"><div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.round(uploadProgress)}%` }} /></div>
          <div className="text-[10px] font-bold text-indigo-600 mt-1">Uploading {Math.round(uploadProgress)}%</div>
        </div>
      )}

      {showFileRename && pendingFiles.length > 0 && (
        <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 animate-in slide-in-from-bottom-2 z-20 space-y-3">
          {pendingFiles.map((pf) => (
            <div key={pf.id} className="flex items-start gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <div className="mt-1 w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 text-indigo-600"><i className="fa-solid fa-file-lines text-xl"></i></div>
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input type="text" value={pf.customName.replace(/\.[^/.]+$/, '').replace('__SECURE__', '')} onChange={(e) => { const newName = lockExtension(pf.file.name, e.target.value); setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, customName: newName } : f)); }} className="flex-1 text-sm font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-500 bg-transparent py-0.5" placeholder="File name" />
                  <span className="text-sm font-bold text-slate-500">.{pf.file.name.split('.').pop()}</span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{(pf.file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <textarea rows={1} value={pf.caption} onChange={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight < 120 ? e.target.scrollHeight : 120) + 'px'; setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, caption: e.target.value } : f)); }} placeholder="Add a caption..." className="w-full text-sm text-slate-800 outline-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"></textarea>

              </div>
              <button onClick={() => { setPendingFiles(prev => prev.filter(f => f.id !== pf.id)); if (pendingFiles.length === 1) setShowFileRename(false); }} className="text-slate-400 hover:text-rose-500 p-2"><i className="fa-solid fa-trash-can text-lg"></i></button>
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setPendingFiles([]); setShowFileRename(false); }} className="text-slate-500 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            <button onClick={handleSendPendingFiles} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm shadow-indigo-600/30 transition-all">
              <i className="fa-solid fa-paper-plane"></i> Send {pendingFiles.length > 1 ? `All (${pendingFiles.length})` : ''}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"/>
        <button className="w-[42px] h-[42px] flex items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors shrink-0" onClick={() => fileInputRef.current.click()} disabled={isUploading}>
          <i className="fa-solid fa-plus text-xl"></i>
        </button>

        <div className="relative shrink-0" ref={emojiPickerRef}>
          <button onClick={() => setEmojiPickerOpen(!emojiPickerOpen)} className="w-[42px] h-[42px] flex items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors">
            <i className="fa-regular fa-face-smile text-xl"></i>
          </button>
          {emojiPickerOpen && (
            <div className="emoji-picker-popup shadow-2xl border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
              {EMOJI_LIST.map(emoji => (
                <button key={emoji} onClick={() => insertEmoji(emoji)} className="hover:bg-slate-100 p-1.5 rounded-lg transition-colors">{emoji}</button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-slate-50 rounded-xl flex items-end shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white resize-y min-h-[46px] max-h-[34vh]">
          <div
            contentEditable
            ref={chatInputRef}
            onInput={handleInput}
            onMouseUp={checkSelection}
            onKeyUp={checkSelection}
            onPaste={handlePaste}
            onBlur={() => { if (activeGroup?.id && user?.uid) deleteDoc(doc(db, 'typing', `${activeGroup.id}_${user.uid}`)).catch(()=>{}); }}
            suppressContentEditableWarning={true}
            data-placeholder={placeholder || (isOnline ? "Type or Paste a message..." : "Offline - message will be queued")}
            className="custom-wysiwyg bg-transparent flex-1 outline-none text-[15px] text-slate-800 py-3 px-4 w-full overflow-y-auto font-medium min-h-[46px] whitespace-pre-wrap break-words"
            style={{ minHeight: '46px', maxHeight: 'clamp(120px, 24vh, 260px)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (inputText.trim() && inputText !== '<br>') handleSendOfflineAware();
              }
            }}
          />
        </div>

        {showScheduleButton && (
          <button onClick={() => { if (!inputText.trim() || inputText === '<br>') return alert("Type a message first, then schedule it."); setPendingScheduledText(inputText.trim()); setActiveModal('schedule_send'); }} className="shrink-0 w-[42px] h-[42px] flex justify-center items-center text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors">
            <i className="fa-regular fa-clock text-xl"></i>
          </button>
        )}

        {showOfflineDrafts && offlineDrafts.length > 0 && (
          <button onClick={() => setActiveModal('offline_drafts')} className="shrink-0 relative w-[42px] h-[42px] flex justify-center items-center text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors">
            <i className="fa-solid fa-inbox text-xl"></i>
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{offlineDrafts.length}</span>
          </button>
        )}

        <button
          onClick={handleSendOfflineAware}
          disabled={!inputText.trim() || inputText === '<br>'}
          className={`shrink-0 min-w-[42px] w-[42px] h-[42px] flex justify-center items-center rounded-full transition-colors ${inputText.trim() && inputText !== '<br>' ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
        >
          <i className="fa-solid fa-paper-plane text-[15px] ml-[-2px]"></i>
        </button>
      </div>
    </div>
  );
}
