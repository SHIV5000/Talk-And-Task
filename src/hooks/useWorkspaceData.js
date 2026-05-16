import { useState, useEffect } from 'react';
import { db } from '../firebase.js';
import { collection, onSnapshot, doc } from 'firebase/firestore';

export default function useWorkspaceData(user, profileForm, setProfileForm) {
    const [isVipAdmin, setIsVipAdmin] = useState(false);
    const [currentUserData, setCurrentUserData] = useState(null);
    const [dbUsers, setDbUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeReminders, setActiveReminders] = useState([]);
    const [genericNotifications, setGenericNotifications] = useState([]);
    const [allAdminReminders, setAllAdminReminders] = useState([]);
    const [immutableAuditLogs, setImmutableAuditLogs] = useState([]);
    const [globalAnnouncement, setGlobalAnnouncement] = useState(null);
    const [toolPreferences, setToolPreferences] = useState({ 
        reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic' 
    });
    
    // 🆕 NEW: Custom Tags State
    const [customTags, setCustomTags] = useState([]);

    useEffect(() => {
        if (!user) return;

        // User Data Listener
        const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCurrentUserData(data);
                setIsVipAdmin(data.email === 'shivsuri1@gmail.com');
                setProfileForm({ 
                    name: data.name || "", 
                    fontSize: data.fontSize || "text-[14.2px]", 
                    fontFamily: data.fontFamily || "font-sans" 
                });
                if (data.toolPreferences) setToolPreferences(data.toolPreferences);
            }
        });

        // All Users Directory
        const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            setDbUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
        });

        // Departments / Groups
        const unsubGroups = onSnapshot(collection(db, "groups"), (snapshot) => {
            setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Personal Notifications
        const unsubNotifs = onSnapshot(collection(db, "notifications"), (snapshot) => {
            const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setGenericNotifications(notifs.filter(n => n.userId === user.uid && !n.isRead));
        });

        // Reminders
        const unsubReminders = onSnapshot(collection(db, "reminders"), (snapshot) => {
            const rems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setActiveReminders(rems.filter(r => r.userId === user.uid));
            setAllAdminReminders(rems);
        });

        // Immutable Audit Logs
        const unsubLogs = onSnapshot(collection(db, "audit_logs"), (snapshot) => {
            setImmutableAuditLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
        });

        // Global Announcement Broadcasts
        const unsubBroadcasts = onSnapshot(collection(db, "broadcasts"), (snapshot) => {
            const activeBroadcast = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).find(b => b.isActive);
            setGlobalAnnouncement(activeBroadcast || null);
        });

        // 🆕 NEW: Workspace Custom Tags Listener
        const unsubTags = onSnapshot(collection(db, "workspace_tags"), (snapshot) => {
            setCustomTags(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubUser(); unsubUsers(); unsubGroups(); unsubNotifs(); 
            unsubReminders(); unsubLogs(); unsubBroadcasts(); unsubTags();
        };
    }, [user, setProfileForm]);

    return { 
        isVipAdmin, currentUserData, dbUsers, groups, 
        activeReminders, genericNotifications, allAdminReminders, 
        immutableAuditLogs, toolPreferences, setToolPreferences,
        globalAnnouncement, customTags 
    };
}
