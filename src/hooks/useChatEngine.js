import { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../firebase.js';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageUtils.js';
import { getEffectiveStorageLimitMB, toNumberOrNull } from '../utils/storageLimits.js';
import { buildPrivateSupportReplyPayload, buildPublicMessagePayload } from '../utils/messagePayload.js';

const DEFAULT_MAX_FILE_SIZE_MB = 5;
const GLOBAL_SUPER_ADMIN_EMAIL = 'shivsuri1@gmail.com';

const sanitizeStoragePathSegment = (value, fallback = 'file') => {
    const sanitized = String(value || '')
        .trim()
        .replace(/[\\/]+/g, '-')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return sanitized || fallback;
};

const createUploadId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return Math.random().toString(36).slice(2);
};

export default function useChatEngine({ orgId, user, activeGroup, dbUsers, groups, toolPreferences, isWorkspaceLoading, addToast, maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB, currentUserData, shouldLoadChatData = true }) {
    const [messages, setMessages] = useState([]);
    const [typingStatus, setTypingStatus] = useState([]);
    const [offlineDrafts, setOfflineDrafts] = useState([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const prevMessagesCountRef = useRef(0);
    const [orgStorageDetails, setOrgStorageDetails] = useState(null);

    useEffect(() => {
        const orgId = currentUserData?.orgId || currentUserData?.organizationId || currentUserData?.tenantId;
        if (!orgId) {
            setOrgStorageDetails(currentUserData?.org_details || null);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, 'organizations', orgId), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setOrgStorageDetails(data.org_details || data.orgDetails || data);
            } else {
                setOrgStorageDetails(null);
            }
        }, () => setOrgStorageDetails(null));

        return () => unsubscribe();
    }, [currentUserData?.orgId, currentUserData?.organizationId, currentUserData?.tenantId, currentUserData?.org_details]);

    const orgCollection = useCallback((collectionName) => collection(db, "organizations", orgId, collectionName), [orgId]);
    const orgDoc = useCallback((collectionName, id) => doc(db, "organizations", orgId, collectionName, id), [orgId]);
    const isGlobalSupportAdmin = (user?.email || '').toLowerCase() === GLOBAL_SUPER_ADMIN_EMAIL;
    const isSupportGroup = activeGroup?.isSupport === true || activeGroup?.id === 'support' || activeGroup?.name === 'SUPPORT';

    const buildSupportRoutingPayload = (replyingMessage = null) => {
        if (!isSupportGroup) return {};
        if (!isGlobalSupportAdmin) {
            return replyingMessage?.id ? {
                isPrivateForward: true,
                allowedUsers: [...new Set([user.email, GLOBAL_SUPER_ADMIN_EMAIL].filter(Boolean))]
            } : { blockedTopLevelSupportPost: true };
        }
        const inheritedAllowedUsers = Array.isArray(replyingMessage?.allowedUsers) ? replyingMessage.allowedUsers : [];
        if (inheritedAllowedUsers.length > 0) {
            return {
                isPrivateForward: true,
                allowedUsers: [...new Set(inheritedAllowedUsers)]
            };
        }
        return { isPrivateForward: false, allowedUsers: [] };
    };

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
        if (!shouldLoadChatData || !orgId || !user?.uid) return;

        const normalizeMessage = (docSnapshot) => {
            const data = docSnapshot.data();
            return { id: docSnapshot.id, ...data, sender: data.senderEmail, isMine: data.senderUid === user.uid, time: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...', dateString: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toISOString().split('T')[0] : '', isTask: data.isTask === true, groupId: data.groupId || "demo", reactions: data.reactions || {}, seenBy: data.seenBy || [], bookmarkedBy: data.bookmarkedBy || [], isPinned: data.isPinned || false, deliveredTo: data.deliveredTo || [] };
        };
        const mergeAndPublish = (nonTaskDocs = [], taskDocs = []) => {
            const byId = new Map([...nonTaskDocs, ...taskDocs].map(docSnapshot => [docSnapshot.id, normalizeMessage(docSnapshot)]));
            const loadedMessages = Array.from(byId.values()).sort((a, b) => (a.timestamp?.toMillis?.() || Number.MAX_SAFE_INTEGER) - (b.timestamp?.toMillis?.() || Number.MAX_SAFE_INTEGER));
            setMessages(loadedMessages);

            if (prevMessagesCountRef.current > 0 && loadedMessages.length > prevMessagesCountRef.current && !isWorkspaceLoading) {
                const newMsg = loadedMessages[loadedMessages.length - 1];
                if (!newMsg.isMine && Date.now() - (newMsg.timestamp?.toMillis?.() || Date.now()) < 5000) {
                    playAlertSound(newMsg?.isTask ? 'task' : 'incoming');
                    addToast(`New message from ${(newMsg.sender || "").split('@')[0]}`, 'message');
                    if (document.hidden && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title: `New Message from ${(newMsg.sender || "").split('@')[0]}`, body: newMsg.text || 'Sent an attachment' });
                    }
                }
            }
            prevMessagesCountRef.current = loadedMessages.length;
        };

        let nonTaskDocs = [];
        let taskDocs = [];
        const unsubNonTasks = onSnapshot(query(orgCollection("messages"), where("isTask", "==", false)), (snapshot) => {
            nonTaskDocs = snapshot.docs;
            mergeAndPublish(nonTaskDocs, taskDocs);
        });
        const unsubTasks = onSnapshot(query(orgCollection("messages"), where("taskData.visibleTo", "array-contains", user.email)), (snapshot) => {
            taskDocs = snapshot.docs;
            mergeAndPublish(nonTaskDocs, taskDocs);
        });

        const unsubTyping = onSnapshot(orgCollection("typing"), (snapshot) => {
            const typingData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const currentTyping = typingData.filter(t => t.groupId === activeGroup?.id && t.name && Date.now() - t.timestamp < 3000);
            setTypingStatus(currentTyping);
        });

        return () => { unsubNonTasks(); unsubTasks(); unsubTyping(); };
    }, [shouldLoadChatData, orgId, user?.uid, user?.email, activeGroup?.id, playAlertSound, isWorkspaceLoading, addToast, orgCollection]);

    // ================== READ RECEIPTS ==================
    useEffect(() => {
        if (!orgId || !activeGroup?.id || !user.email) return;
        const unseenMsgs = messages.filter(m => m.groupId === activeGroup.id && !m.isMine && !(m.seenBy || []).includes(user.email));
        if (unseenMsgs.length === 0) return;
        const batchUpdate = async () => {
            for (const msg of unseenMsgs) {
                try {
                    const updatedSeenBy = [...(msg.seenBy || []), user.email];
                    await updateDoc(orgDoc("messages", msg.id), { seenBy: updatedSeenBy, deliveredTo: [...new Set([...(msg.deliveredTo || []), user.email])] });
                } catch (e) {}
            }
        };
        batchUpdate();
    }, [orgId, activeGroup?.id, messages, user.email, orgDoc]);

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
                        await addDoc(orgCollection("messages"), buildPublicMessagePayload({
                            text: `[Recovered Draft] ${draft.text}`,
                            user,
                            group: { id: draft.groupId, name: draft.groupName || activeGroup?.name || 'Recovered Draft' },
                            timestamp: serverTimestamp(),
                            deliveredTo: [user.email],
                            isPinned: false,
                            bookmarkedBy: [],
                            fileUrl: null,
                            fileName: null,
                            fileType: null,
                            hasReminder: false,
                            isPrivateMention: false,
                        }));
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
        try { await addDoc(orgCollection("audit_logs"), { type: actionType, user: user.email, content, target, groupId: activeGroup.id, groupName: activeGroup.name, timestamp: serverTimestamp() }); } catch(e) {}
    };

    const triggerTypingEvent = (userName) => {
        if(!activeGroup) return;
        try { setDoc(orgDoc("typing", `${activeGroup.id}_${user.uid}`), { groupId: activeGroup.id, name: userName || user.email.split('@')[0], timestamp: Date.now() }, { merge: true }); } catch (e) {}
    };

    const sendMessageToDB = async (messageText, replyingTo, attachments = [], uploadProgressCb = null) => {
        try { deleteDoc(orgDoc("typing", `${activeGroup.id}_${user.uid}`)); } catch(e) {}

        const mentions = [];
        dbUsers.forEach(u => { if (messageText.toLowerCase().includes(`@${(u.name || "").toLowerCase()}`)) mentions.push(u.email); });
        groups.forEach(g => {
            const groupTag = `@${(g.name || "").replace(/\s+/g, '').toLowerCase()}`;
            if (messageText.toLowerCase().includes(groupTag) && !g.isArchived) { (g.members || []).forEach(m => mentions.push(m)); }
        });
        const uniqueMentions = [...new Set(mentions)];

        let replyData = null;
        if (replyingTo) replyData = { replyToId: replyingTo.id, originalText: replyingTo.text || replyingTo.fileName || 'Attachment', originalSender: (replyingTo.sender||"").split('@')[0] };
        const supportRouting = buildSupportRoutingPayload(replyingTo);
        if (supportRouting.blockedTopLevelSupportPost) {
            addToast?.('Reply to a SUPPORT broadcast to open a private support thread.', 'warning');
            return;
        }

        const hasTextMessage = !!(messageText || '').replace(/<br\s*\/?>/gi, '').trim();
        let groupMsgRef = null;
        if (hasTextMessage) {
            const buildPayload = supportRouting.isPrivateForward ? buildPrivateSupportReplyPayload : buildPublicMessagePayload;
            groupMsgRef = await addDoc(orgCollection("messages"), buildPayload({
                text: messageText,
                user,
                group: activeGroup,
                timestamp: serverTimestamp(),
                isPrivateMention: false,
                mentionEmails: uniqueMentions,
                ...(replyData || {}),
                ...(supportRouting.isPrivateForward ? { allowedUsers: supportRouting.allowedUsers || [] } : {}),
            }));
            logImmutableAction("MESSAGE_CREATE", `Sent message: "${messageText}"`, supportRouting.isPrivateForward ? `Private SUPPORT: ${(supportRouting.allowedUsers || []).join(', ')}` : (uniqueMentions.length ? `Mentions: ${uniqueMentions.join(', ')}` : "Public"));
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
                if (recipient) await addDoc(orgCollection("notifications"), { userId: recipient.uid, type: "mention", text: `You have been mentioned by ${user.email.split('@')[0]} in ${activeGroup.name}.`, messageId: groupMsgRef.id, groupId: activeGroup.id, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
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
            await updateDoc(orgDoc("messages", msgId), { reactions: updatedReactions });
            if (isAdding && msg.senderUid !== user.uid) await addDoc(orgCollection("notifications"), { userId: msg.senderUid, type: "reaction", text: `${(user.email||"").split('@')[0]} reacted ${emoji}.`, messageId: msgId, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false });
        } catch (err) {}
    };

    const uploadAndSendFileDB = async (pf, onProgress, replyingTo = null) => {
    const { file, customName, caption } = pf;
    const safeCaption = caption || ""; // Prevents .trim() crashes

    if (!orgId) throw new Error('Organization context is required before uploading files.');
    if (!activeGroup?.id) throw new Error('Select a group before uploading files.');

    const supportRouting = buildSupportRoutingPayload(replyingTo);
    if (supportRouting.blockedTopLevelSupportPost) {
        addToast?.('Reply to a SUPPORT broadcast to upload privately to support.', 'warning');
        return;
    }

    if (file.size > maxFileSizeMb * 1024 * 1024) throw new Error(`File too large. Max ${maxFileSizeMb} MB.`);

    if (orgStorageDetails) {
        const storageUsedMB = toNumberOrNull(orgStorageDetails.storageUsedMB) || 0;
        const effectiveStorageLimitMB = getEffectiveStorageLimitMB(orgStorageDetails);
        if (storageUsedMB >= effectiveStorageLimitMB) {
            throw new Error(`Storage Limit for Organization reached. Used ${storageUsedMB.toFixed(2)} MB of ${effectiveStorageLimitMB.toFixed(2)} MB.`);
        }
    }

    let processedFile = file;
    try { 
        if (file.type.startsWith('image/')) { 
            const compressedBlob = await compressImage(file); 
            const outName = customName.replace(/\.[^/.]+$/, "") + ".webp";
            processedFile = new File([compressedBlob], outName, { type: "image/webp" }); 
        } 
    } catch (e) {}

    const groupPathSegment = sanitizeStoragePathSegment(activeGroup.id, 'group');
    const storedFileName = sanitizeStoragePathSegment(processedFile.name || customName, 'attachment');
    const storagePath = `organizations/${orgId}/uploads/chat/${groupPathSegment}/${Date.now()}_${createUploadId()}_${storedFileName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, processedFile);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
            (snapshot) => {
                if (onProgress) onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            },
            reject,
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const replyData = replyingTo ? { replyToId: replyingTo.id, originalText: replyingTo.text || replyingTo.fileName || 'Attachment', originalSender: (replyingTo.sender||'').split('@')[0] } : {};
                const buildPayload = supportRouting.isPrivateForward ? buildPrivateSupportReplyPayload : buildPublicMessagePayload;
                await addDoc(orgCollection("messages"), buildPayload({
                    text: safeCaption.trim(),
                    user,
                    group: activeGroup,
                    timestamp: serverTimestamp(),
                    fileUrl: downloadURL,
                    storagePath: uploadTask.snapshot.ref.fullPath,
                    fileName: customName,
                    storedFileName,
                    fileType: processedFile.type,
                    fileSize: processedFile.size,
                    originalFileSize: file.size,
                    uploadedBy: user.uid,
                    uploadedAt: serverTimestamp(),
                    ...replyData,
                    ...(supportRouting.isPrivateForward ? { allowedUsers: supportRouting.allowedUsers || [] } : {}),
                }));
                resolve();
            }
        );
    });
};
    const scheduleMessageDB = async (text, dt, isTask, taskData) => {
        const scheduledDate = new Date(dt);
        const payload = { text, senderEmail: user.email, senderUid: user.uid, groupId: activeGroup.id, groupName: activeGroup.name, scheduledFor: scheduledDate.toISOString(), scheduledAt: scheduledDate, status: "pending", retryCount: 0, isTask, createdAt: serverTimestamp(), allowedUsers: [], isPrivateForward: false };
        if (isTask && taskData) { payload.taskData = taskData; payload.taskDeadline = taskData.deadline; payload.taskAssignees = taskData.assignees; }
        await addDoc(orgCollection("scheduled_messages"), payload);
    };

    const editMessageDB = async (msgId, originalText, newText) => {
        await updateDoc(orgDoc("messages", msgId), { text: newText, isEdited: true });
        logImmutableAction("MESSAGE_EDIT", `Original: "${originalText}" | Edited: "${newText}"`, `Message ID: ${msgId}`);
    };

    const deleteMessageDB = async (msg) => {
        await deleteDoc(orgDoc("messages", msg.id));
        logImmutableAction("MESSAGE_DELETE", `Deleted content: "${msg.text || msg.fileName}"`, `Message ID: ${msg.id}`);
    };

    const togglePinDB = async (msgId, isPinned) => {
        const userEmail = (user?.email || '').toLowerCase();
        const canManagePins =
            userEmail === GLOBAL_SUPER_ADMIN_EMAIL ||
            (activeGroup?.admins || []).map((email) => (email || '').toLowerCase()).includes(userEmail);
        if (!canManagePins) {
            addToast?.('Only admins can unpin', 'error');
            return;
        }
        await updateDoc(orgDoc("messages", msgId), { isPinned: !isPinned });
    };
    
    const toggleBookmarkDB = async (msgId, bookmarkedBy) => {
        let bookmarks = bookmarkedBy || [];
        if (bookmarks.includes(user.email)) bookmarks = bookmarks.filter(e => e !== user.email); else bookmarks.push(user.email);
        await updateDoc(orgDoc("messages", msgId), { bookmarkedBy: bookmarks });
    };

    return {
        messages, typingStatus, isOnline, offlineDrafts,
        logImmutableAction, triggerTypingEvent, sendMessageToDB, reactToMessageDB,
        deleteMessageDB, editMessageDB, togglePinDB, toggleBookmarkDB,
        uploadAndSendFileDB, scheduleMessageDB, saveOfflineDraft, deleteOfflineDraft
    };
}
