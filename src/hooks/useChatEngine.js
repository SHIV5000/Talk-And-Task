import { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, limitToLast, serverTimestamp, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageUtils.js';

const DEFAULT_MAX_FILE_SIZE_MB = 5;

export default function useChatEngine({ user, activeGroup, dbUsers, groups, toolPreferences, isWorkspaceLoading, addToast, maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB }) {
    const [messages, setMessages] = useState([]);
    const [typingStatus, setTypingStatus] = useState([]);
    const [offlineDrafts, setOfflineDrafts] = useState([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const prevMessagesCountRef = useRef(0);

    const playAlertSound = useCallback((type = 'incoming') => {
        try {
            const incoming = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FINCOMING-MESSAGE-TASK-CREATE-UPDATE.mp3?alt=media&token=a3ac611f-1dc1-4973-83fe-c122b02396d2';
            const task = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FBANNER.mp3?alt=media&token=b3463c11-1f70-4450-8efc-049e04f33a0a';
            const audio = new Audio(type === 'task' ? task : incoming);
            audio.volume = 1;
            audio.play().catch(() => {});
        } catch (e) {}
    }, []);

    // ================== MESSAGE LISTENER ==================
    useEffect(() => {
        const q = query(collection(db, "messages"), orderBy("timestamp", "asc"), limitToLast(300));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let loadedMessages = snapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                return { id: docSnapshot.id, ...data, sender: data.senderEmail, isMine: data.senderUid === user.uid, time: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...', dateString: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toISOString().split('T')[0] : '', isTask: data.isTask === true, groupId: data.groupId || "demo", reactions: data.reactions || {}, seenBy: data.seenBy || [], bookmarkedBy: data.bookmarkedBy || [], isPinned: data.isPinned || false, deliveredTo: data.deliveredTo || [] };
            });

            loadedMessages.sort((a, b) => (a.timestamp?.toMillis?.() || Number.MAX_SAFE_INTEGER) - (b.timestamp?.toMillis?.() || Number.MAX_SAFE_INTEGER));
            setMessages(loadedMessages);

            if (prevMessagesCountRef.current > 0 && loadedMessages.length > prevMessagesCountRef.current && !isWorkspaceLoading) {
                const newMsg = loadedMessages[loadedMessages.length - 1];
                if (!newMsg.isMine && Date.now() - (newMsg.timestamp?.toMillis?.() || Date.now()) < 5000) {
                    playAlertSound(loadedMessages[loadedMessages.length - 1]?.isTask ? 'task' : 'incoming');
                    addToast(`New message from ${(newMsg.sender || "").split('@')[0]}`, 'message');
                    if (document.hidden && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title: `New Message from ${(newMsg.sender || "").split('@')[0]}`, body: newMsg.text || 'Sent an attachment' });
                    }
                }
            }
            prevMessagesCountRef.current = loadedMessages.length;
        });

        const unsubTyping = onSnapshot(collection(db, "typing"), (snapshot) => {
            const typingData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const currentTyping = typingData.filter(t => t.groupId === activeGroup?.id && t.name && Date.now() - t.timestamp < 3000);
            setTypingStatus(currentTyping);
        });

        return () => { unsubscribe(); unsubTyping(); };
    }, [user.uid, activeGroup?.id, playAlertSound, isWorkspaceLoading, addToast]);

    // ================== READ RECEIPTS ==================
    useEffect(() => {
        if (!activeGroup?.id || !user.email) return;
        const unseenMsgs = messages.filter(m => m.groupId === activeGroup.id && !m.isMine && !(m.seenBy || []).includes(user.email));
        if (unseenMsgs.length === 0) return;
        const batchUpdate = async () => {
            for (const msg of unseenMsgs) {
                try {
                    const updatedSeenBy = [...(msg.seenBy || []), user.email];
                    await updateDoc(doc(db, "messages", msg.id), { seenBy: updatedSeenBy, deliveredTo: [...new Set([...(msg.deliveredTo || []), user.email])] });
                } catch (e) {}
            }
        };
        batchUpdate();
    }, [activeGroup?.id, messages, user.email]);

    // ================== OFFLINE DB ENGINE ==================
    const openDraftDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open("TalkTaskDrafts", 1);
        req.onupgradeneeded = e => { e.target.result.createObjectStore("drafts", { keyPath: "id", autoIncrement: true }); };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject();
    });

    const loadOfflineDrafts = useCallback(async () => {
        try { const db2 = await openDraftDB(); const tx = db2.transaction("drafts", "readonly"); const req = tx.objectStore("drafts").getAll(); req.onsuccess = () => setOfflineDrafts(req.result || []); } catch(e) {}
    }, []);

    const saveOfflineDraft = async (text, groupId, groupName) => {
        try { const db2 = await openDraftDB(); const tx = db2.transaction("drafts", "readwrite"); tx.objectStore("drafts").add({ text, groupId, groupName, savedAt: new Date().toISOString() }); loadOfflineDrafts(); } catch(e) {}
    };

    const deleteOfflineDraft = async (id) => {
        try { const db2 = await openDraftDB(); const tx = db2.transaction("drafts", "readwrite"); tx.objectStore("drafts").delete(id); loadOfflineDrafts(); } catch(e) {}
    };

    const flushOfflineDrafts = async () => {
        try {
            const db2 = await openDraftDB(); const tx = db2.transaction("drafts", "readonly"); const req = tx.objectStore("drafts").getAll();
            req.onsuccess = async () => {
                for (const draft of req.result || []) {
                    try {
                        await addDoc(collection(db, "messages"), { text: `[Recovered Draft] ${draft.text}`, senderUid: user.uid, senderEmail: user.email, timestamp: serverTimestamp(), isTask: false, hasReminder: false, isPrivateMention: false, allowedUsers: [], seenBy: [user.email], deliveredTo: [user.email], isPinned: false, bookmarkedBy: [], fileUrl: null, fileName: null, fileType: null, groupId: draft.groupId, reactions: {} });
                        await deleteOfflineDraft(draft.id);
                    } catch(e) {}
                }
            };
        } catch(e) {}
    };

    useEffect(() => {
        const goOnline = () => { setIsOnline(true); flushOfflineDrafts(); };
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        loadOfflineDrafts();
        return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    }, [loadOfflineDrafts]);

    // ================== FIREBASE API ACTIONS ==================
    const logImmutableAction = async (actionType, content, target = "") => {
        if(!activeGroup) return;
        try { await addDoc(collection(db, "audit_logs"), { type: actionType, user: user.email, content, target, groupId: activeGroup.id, groupName: activeGroup.name, timestamp: serverTimestamp() }); } catch(e) {}
    };

    const triggerTypingEvent = (userName) => {
        if(!activeGroup) return;
        try { setDoc(doc(db, "typing", `${activeGroup.id}_${user.uid}`), { groupId: activeGroup.id, name: userName || user.email.split('@')[0], timestamp: Date.now() }, { merge: true }); } catch (e) {}
    };

    const sendMessageToDB = async (messageText, replyingTo, attachments = [], uploadProgressCb = null) => {
        try { deleteDoc(doc(db, "typing", `${activeGroup.id}_${user.uid}`)); } catch(e) {}

        const mentions = [];
        dbUsers.forEach(u => { if (messageText.toLowerCase().includes(`@${(u.name || "").toLowerCase()}`)) mentions.push(u.email); });
        groups.forEach(g => {
            const groupTag = `@${(g.name || "").replace(/\s+/g, '').toLowerCase()}`;
            if (messageText.toLowerCase().includes(groupTag) && !g.isArchived) { (g.members || []).forEach(m => mentions.push(m)); }
        });
        const uniqueMentions = [...new Set(mentions)];

        let replyData = null;
        if (replyingTo) replyData = { replyToId: replyingTo.id, originalText: replyingTo.text || replyingTo.fileName || 'Attachment', originalSender: (replyingTo.sender||"").split('@')[0] };

        const hasTextMessage = !!(messageText || '').replace(/<br\s*\/?>/gi, '').trim();
        let groupMsgRef = null;
        if (hasTextMessage) {
            groupMsgRef = await addDoc(collection(db, "messages"), { text: messageText, senderUid: user.uid, senderEmail: user.email, timestamp: serverTimestamp(), isTask: false, isPrivateMention: false, allowedUsers: [], mentionEmails: uniqueMentions, seenBy: [user.email], groupId: activeGroup.id, reactions: {}, ...(replyData || {}) });
            logImmutableAction("MESSAGE_CREATE", `Sent message: "${messageText}"`, uniqueMentions.length ? `Mentions: ${uniqueMentions.join(', ')}` : "Public");
        }


        if (attachments.length > 0) {
            for (let i = 0; i < attachments.length; i++) {
                const file = attachments[i];
                await uploadAndSendFileDB({ file, customName: file.name, caption: '' }, (pct) => {
                    if (uploadProgressCb) uploadProgressCb((i / attachments.length) * 100 + (pct / attachments.length));
                }, replyingTo);
            }
        }
        if (uniqueMentions.length > 0 && groupMsgRef) {
            uniqueMentions.forEach(async (mentionEmail) => {
                if (mentionEmail === user.email) return;
                const recipient = dbUsers.find(u => u.email === mentionEmail);
                if (recipient) await addDoc(collection(db, "notifications"), { userId: recipient.uid, type: "mention", text: `Mentioned you in ${activeGroup.name}`, messageId: groupMsgRef.id, groupId: activeGroup.id, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
            });
        }
    };

    const reactToMessageDB = async (msgId, emoji) => {
        const msg = messages.find(m => m.id === msgId);
        if(!msg) return;
        let updatedReactions = { ...msg.reactions };
        let usersForEmoji = updatedReactions[emoji] || [];
        const isAdding = !usersForEmoji.includes(user.email);
        if (isAdding) usersForEmoji = [...usersForEmoji, user.email]; else usersForEmoji = usersForEmoji.filter(e => e !== user.email);
        if (usersForEmoji.length === 0) delete updatedReactions[emoji]; else updatedReactions[emoji] = usersForEmoji;
        try {
            await updateDoc(doc(db, "messages", msgId), { reactions: updatedReactions });
            if (isAdding && msg.senderUid !== user.uid) await addDoc(collection(db, "notifications"), { userId: msg.senderUid, type: "reaction", text: `${(user.email||"").split('@')[0]} reacted ${emoji}.`, messageId: msgId, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false });
        } catch (err) {}
    };

    const uploadAndSendFileDB = async (pf, onProgress, replyingTo = null) => {
    const { file, customName, caption } = pf;
    const safeCaption = caption || ""; // Prevents .trim() crashes

    if (file.size > maxFileSizeMb * 1024 * 1024) throw new Error(`File too large. Max ${maxFileSizeMb} MB.`);

    let processedFile = file;
    try { 
        if (file.type.startsWith('image/')) { 
            const compressedBlob = await compressImage(file); 
            const outName = customName.replace(/\.[^/.]+$/, "") + ".webp";
            processedFile = new File([compressedBlob], outName, { type: "image/webp" }); 
        } 
    } catch (e) {}

    const storageRef = ref(storage, `chat_uploads/${Date.now()}_${customName}`);
    const uploadTask = uploadBytesResumable(storageRef, processedFile);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
            (snapshot) => onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            reject,
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const replyData = replyingTo ? { replyToId: replyingTo.id, originalText: replyingTo.text || replyingTo.fileName || 'Attachment', originalSender: (replyingTo.sender||'').split('@')[0] } : {};
                await addDoc(collection(db, "messages"), {
                    text: safeCaption.trim(),
                    senderUid: user.uid,
                    senderEmail: user.email,
                    groupId: activeGroup.id,
                    fileUrl: downloadURL,
                    fileName: customName,
                    fileType: processedFile.type,
                    timestamp: serverTimestamp(),
                    isTask: false,
                    seenBy: [user.email],
                    ...replyData
                });
                resolve();
            }
        );
    });
};
    const scheduleMessageDB = async (text, dt, isTask, taskData) => {
        const scheduledDate = new Date(dt);
        const payload = { text, senderEmail: user.email, senderUid: user.uid, groupId: activeGroup.id, groupName: activeGroup.name, scheduledFor: scheduledDate.toISOString(), scheduledAt: scheduledDate, status: "pending", retryCount: 0, isTask, createdAt: serverTimestamp() };
        if (isTask && taskData) { payload.taskDeadline = taskData.deadline; payload.taskAssignees = taskData.assignees; }
        await addDoc(collection(db, "scheduled_messages"), payload);
    };

    const editMessageDB = async (msgId, originalText, newText) => {
        await updateDoc(doc(db, "messages", msgId), { text: newText, isEdited: true });
        logImmutableAction("MESSAGE_EDIT", `Original: "${originalText}" | Edited: "${newText}"`, `Message ID: ${msgId}`);
    };

    const deleteMessageDB = async (msg) => {
        await deleteDoc(doc(db, "messages", msg.id));
        logImmutableAction("MESSAGE_DELETE", `Deleted content: "${msg.text || msg.fileName}"`, `Message ID: ${msg.id}`);
    };

    const togglePinDB = async (msgId, isPinned) => updateDoc(doc(db, "messages", msgId), { isPinned: !isPinned });
    
    const toggleBookmarkDB = async (msgId, bookmarkedBy) => {
        let bookmarks = bookmarkedBy || [];
        if (bookmarks.includes(user.email)) bookmarks = bookmarks.filter(e => e !== user.email); else bookmarks.push(user.email);
        await updateDoc(doc(db, "messages", msgId), { bookmarkedBy: bookmarks });
    };

    return {
        messages, typingStatus, isOnline, offlineDrafts,
        logImmutableAction, triggerTypingEvent, sendMessageToDB, reactToMessageDB,
        deleteMessageDB, editMessageDB, togglePinDB, toggleBookmarkDB,
        uploadAndSendFileDB, scheduleMessageDB, saveOfflineDraft, deleteOfflineDraft
    };
}
