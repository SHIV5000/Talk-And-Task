import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function useWorkspaceData(user, profileForm, setProfileForm) {
    const [isVipAdmin, setIsVipAdmin] = useState(false);
    const [currentUserData, setCurrentUserData] = useState(null);
    const [dbUsers, setDbUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeReminders, setActiveReminders] = useState([]);
    const [genericNotifications, setGenericNotifications] = useState([]);
    const [allAdminReminders, setAllAdminReminders] = useState([]);
    const [immutableAuditLogs, setImmutableAuditLogs] = useState([]);
    const [customTags, setCustomTags] = useState([]); 
    const [globalAnnouncement, setGlobalAnnouncement] = useState(null); // 👈 NEW STATE
    const [toolPreferences, setToolPreferences] = useState({
        reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic'
    });

    const verifyAdminStatus = useCallback(async () => {
        if (!auth.currentUser) return false;
        try {
            const idTokenResult = await auth.currentUser.getIdTokenResult();
            return !!idTokenResult.claims.admin;
        } catch (e) { return false; }
    }, []);

    useEffect(() => { 
        verifyAdminStatus().then(res => setIsVipAdmin(res)); 
    }, [verifyAdminStatus]);

    useEffect(() => {
        if (!user?.uid) return;

        const qPersonal = query(collection(db, "reminders"), where("userId", "==", user.uid), where("isTriggered", "==", false));
        const unsubPersonal = onSnapshot(qPersonal, (snapshot) => setActiveReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qAlerts = query(collection(db, "notifications"), where("userId", "==", user.uid), where("isRead", "==", false));
        const unsubAlerts = onSnapshot(qAlerts, (snapshot) => {
            const sorted = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
            setGenericNotifications(sorted);
        });

        const unsubTags = onSnapshot(collection(db, "workspace_tags"), (snapshot) => {
            if (snapshot.empty) {
                setCustomTags([
                    { id: '1', label: '#Approved', shortCode: 'APP', bgClass: 'bg-teal-50', textClass: 'text-teal-700' },
                    { id: '2', label: '#Reviewing', shortCode: 'REV', bgClass: 'bg-indigo-50', textClass: 'text-indigo-700' },
                    { id: '3', label: '#ActionRequired', shortCode: 'ACT', bgClass: 'bg-rose-50', textClass: 'text-rose-700' },
                    { id: '4', label: '#Noted', shortCode: 'NOTE', bgClass: 'bg-slate-100', textClass: 'text-slate-600' }
                ]);
            } else {
                setCustomTags(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
            }
        });

        // 👇 NEW: Listen for Global Admin Announcements 👇
        const unsubAnnouncement = onSnapshot(doc(db, "workspace", "announcement"), (docSnap) => {
            if (docSnap.exists()) {
                setGlobalAnnouncement(docSnap.data());
            } else {
                setGlobalAnnouncement(null);
            }
        });

        let unsubAdmin = () => {}; let unsubAudit = () => {};
        if (currentUserData?.isAdmin || isVipAdmin) {
            const qAdmin = query(collection(db, "reminders"), orderBy("remindAt", "desc"));
            unsubAdmin = onSnapshot(qAdmin, (snapshot) => setAllAdminReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
            const qAudit = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
            unsubAudit = onSnapshot(qAudit, (snapshot) => {
                setImmutableAuditLogs(snapshot.docs.map(d => {
                    const data = d.data();
                    return { 
                        id: d.id, 
                        ...data, 
                        time: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '', 
                        dateString: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toISOString().split('T')[0] : '' 
                    };
                }));
            });
        }
        return () => { unsubPersonal(); unsubAlerts(); unsubAdmin(); unsubAudit(); unsubTags(); unsubAnnouncement(); };
    }, [user?.uid, currentUserData?.isAdmin, isVipAdmin]);

    useEffect(() => {
        if (!user?.uid) return;

        const heartbeatInterval = setInterval(() => { 
            updateDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() }).catch(() => {}); 
        }, 60000);

        const unsubCurrent = onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data(); 
                setCurrentUserData(data);
                if (!profileForm.name && data.name) {
                    setProfileForm({ name: (data.name || "").split('@')[0], fontSize: data.fontSize || "text-[14.2px]", fontFamily: data.fontFamily || "font-sans" });
                }
                if (data.toolPreferences) setToolPreferences(prev => ({ ...prev, ...data.toolPreferences }));
            }
        });

        const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("email", "asc")), (snapshot) => setDbUsers(snapshot.docs.map(document => document.data())));
        
        const unsubGroups = onSnapshot(collection(db, "groups"), (snapshot) => {
            setGroups(snapshot.docs.map(document => ({ id: document.id, ...document.data() })));
        });

        return () => { clearInterval(heartbeatInterval); unsubCurrent(); unsubUsers(); unsubGroups(); };
    }, [user, currentUserData?.isAdmin, isVipAdmin, profileForm.name, setProfileForm]);

    return {
        isVipAdmin, currentUserData, dbUsers, groups,
        activeReminders, genericNotifications, allAdminReminders,
        immutableAuditLogs, toolPreferences, setToolPreferences, customTags,
        globalAnnouncement // 👈 EXPORT NEW STATE
    };
}
