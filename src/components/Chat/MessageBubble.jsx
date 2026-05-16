import React, { useState } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { EMOJI_LIST, stripHtml } from '../../utils/helpers.js';

export default function MessageBubble({ 
    msg, userEmail, currentUserData, activeGroup, isVipAdmin,
    hasReplies, replyCount, isHighlighted, isUnreadHighlight,
    editingMessageId, editMessageText, setEditingMessageId,
    setEditMessageText, handleSaveEdit, scrollToMessageDirect,
    handleReaction, handleToggleBookmark, handleTogglePin,
    handleDeleteMessage, chatInputRef, toolPreferences,
    setReplyingTo, setSelectedMessage, setIsEditingTaskTitle,
    setActiveModal, dbUsers, jumpToPrivateSource, handleAddInlineComment,
    customTags, setActiveThread
}) {
    const [showReactionMenu, setShowReactionMenu] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const isMine = msg.senderEmail === userEmail;

    return (
        <div id={`msg-${msg.id}`} className={`flex flex-col mb-4 group relative ${isHighlighted ? 'bg-indigo-50 ring-2 ring-indigo-200 rounded-xl p-2' : ''} ${isUnreadHighlight ? 'bg-amber-50/50 rounded-xl p-2' : ''}`}>
            
            <div className={`flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className="shrink-0 pt-1">
                    <MemoizedAvatar uid={msg.senderUid} url={null} name={msg.sender?.split('@')[0]} sizeClass="w-9 h-9 shadow-sm" />
                </div>

                {/* Message Content Container */}
                <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                    
                    {/* Header Info */}
                    <div className={`flex items-baseline gap-2 mb-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-[13px] font-bold text-slate-800">{msg.sender?.split('@')[0]}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{msg.time}</span>
                    </div>

                    {/* The Bubble */}
                    <div className={`relative px-4 py-2.5 rounded-2xl shadow-sm text-[14.5px] leading-relaxed break-words font-medium ${
                        isMine 
                            ? 'bg-indigo-600 text-white rounded-tr-sm border border-indigo-700' 
                            : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200'
                    }`}>
                        <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                    </div>

                    {/* Reactions Display Area */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(msg.reactions).map(([reaction, users]) => {
                                // Check if it's a Custom Tag by searching the array
                                const matchedTag = customTags?.find(t => `${t.shortCode || ''} ${t.label}`.trim() === reaction);
                                
                                return (
                                    <div key={reaction} className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-sm border ${
                                        matchedTag ? `${matchedTag.bgClass} ${matchedTag.textClass} ${matchedTag.borderClass}` : 'bg-white border-slate-200 text-slate-600'
                                    }`}>
                                        {reaction} <span className="opacity-70 text-[9px]">{users.length}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Floating Action Menu (Hover) */}
                <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pt-6 ${isMine ? 'pr-2' : 'pl-2'}`}>
                    <div className="relative">
                        <button onClick={() => setShowReactionMenu(!showReactionMenu)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-amber-500 hover:bg-amber-50 shadow-sm flex items-center justify-center transition-colors">
                            <i className="fa-regular fa-face-smile"></i>
                        </button>

                        {/* 🆕 NEW: Custom Tag & Emoji Popover */}
                        {showReactionMenu && (
                            <div className="absolute bottom-[100%] right-0 mb-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 z-50 animate-in fade-in zoom-in-95 w-72 max-h-[300px] overflow-y-auto custom-sidebar-scroll">
                                
                                {/* WORKSPACE TAGS SECTION */}
                                {customTags && customTags.length > 0 && (
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1.5">
                                            <i className="fa-solid fa-tags text-indigo-400"></i> Workflow Tags
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {customTags.map(tag => {
                                                const fullTagStr = `${tag.shortCode || ''} ${tag.label}`.trim();
                                                const isApplied = msg.reactions?.[fullTagStr]?.includes(userEmail); 
                                                
                                                return (
                                                    <button 
                                                        key={tag.id} 
                                                        onClick={() => { handleReaction(msg.id, fullTagStr); setShowReactionMenu(false); }}
                                                        className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold border shadow-sm transition-transform hover:scale-105 flex items-center gap-1 ${tag.bgClass} ${tag.textClass} ${isApplied ? 'ring-2 ring-indigo-400 border-indigo-400' : tag.borderClass}`}
                                                    >
                                                        {fullTagStr}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* DEFAULT EMOJI SECTION */}
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1.5">
                                        <i className="fa-regular fa-face-smile text-amber-400"></i> Quick React
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {EMOJI_LIST.map(emoji => {
                                            const isApplied = msg.reactions?.[emoji]?.includes(userEmail);
                                            return (
                                                <button 
                                                    key={emoji} 
                                                    onClick={() => { handleReaction(msg.id, emoji); setShowReactionMenu(false); }} 
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-colors ${isApplied ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'hover:bg-slate-100'}`}
                                                >
                                                    {emoji}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <button onClick={() => setReplyingTo(msg)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 shadow-sm flex items-center justify-center transition-colors">
                        <i className="fa-solid fa-reply"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}
