import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const GLOBAL_SUPER_ADMIN_EMAIL = 'shivsuri1@gmail.com';
const isGlobalSuperAdminEmail = (email) => (email || '').toLowerCase() === GLOBAL_SUPER_ADMIN_EMAIL;

const buildFallbackUserData = (user) => ({
    uid: user?.uid || '',
    email: user?.email || '',
    name: user?.displayName || (user?.email || '').split('@')[0] || 'User',
    isApproved: true,
    isAdmin: isGlobalSuperAdminEmail(user?.email),
    canCreateGroups: false,
    toolPreferences: {},
});

export default function useWorkspaceData(user, profileForm, setProfileForm, orgId) {
    const [allUsers, setAllUsers] = useState([]); // Add this new state
    const [isVipAdmin, setIsVipAdmin] = useState(false);
    const [currentUserData, setCurrentUserData] = useState(() => buildFallbackUserData(user));
    const [dbUsers, setDbUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeReminders, setActiveReminders] = useState([]);
    const [genericNotifications, setGenericNotifications] = useState([]);
    const [allAdminReminders, setAllAdminReminders] = useState([]);
    const [immutableAuditLogs, setImmutableAuditLogs] = useState([]);
    const [customTags, setCustomTags] = useState([]); 
    const [globalAnnouncement, setGlobalAnnouncement] = useState(null); 
    const [toolPreferences, setToolPreferences] = useState({
        reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic'
    });

    const orgCollection = useCallback((collectionName) => collection(db, "organizations", orgId, collectionName), [orgId]);
    const orgDoc = useCallback((collectionName, id) => doc(db, "organizations", orgId, collectionName, id), [orgId]);

    const verifyAdminStatus = useCallback(async () => {
        if (!auth.currentUser) return false;
        if (isGlobalSuperAdminEmail(auth.currentUser.email)) return true;
        try {
            const idTokenResult = await auth.currentUser.getIdTokenResult();
            return !!idTokenResult.claims.admin;
        } catch (e) { return false; }
    }, []);

    useEffect(() => { 
        verifyAdminStatus().then(res => setIsVipAdmin(res)); 
    }, [verifyAdminStatus]);

    useEffect(() => {
        if (!orgId || !user?.uid) return;

        const qPersonal = query(orgCollection("reminders"), where("userId", "==", user.uid), where("isTriggered", "==", false));
        const unsubPersonal = onSnapshot(qPersonal, (snapshot) => setActiveReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qAlerts = query(orgCollection("notifications"), where("userId", "==", user.uid), where("isRead", "==", false));
        const unsubAlerts = onSnapshot(qAlerts, (snapshot) => {
            const now = Date.now();
            const sorted = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(n => !n.snoozeUntil || (n.snoozeUntil?.toMillis?.() || new Date(n.snoozeUntil).getTime() || 0) <= now).sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
            setGenericNotifications(sorted);
        });

        const unsubTags = onSnapshot(orgCollection("workspace_tags"), (snapshot) => {
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

        // 👇 UPDATED: Now fetches the ID for Broadcast Acknowledgements 👇
        const unsubAnnouncement = onSnapshot(orgDoc("workspace", "announcement"), (docSnap) => {
            if (docSnap.exists()) {
                setGlobalAnnouncement({ id: docSnap.id, ...docSnap.data() });
            } else {
                setGlobalAnnouncement(null);
            }
        });

        let unsubAdmin = () => {}; let unsubAudit = () => {};
        if (currentUserData?.isAdmin || isVipAdmin) {
            const qAdmin = query(orgCollection("reminders"), orderBy("remindAt", "desc"));
            unsubAdmin = onSnapshot(qAdmin, (snapshot) => setAllAdminReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
            const qAudit = query(orgCollection("audit_logs"), orderBy("timestamp", "desc"));
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
    }, [orgId, user?.uid, currentUserData?.isAdmin, isVipAdmin, orgCollection, orgDoc]);

    useEffect(() => {
        if (!orgId || !user?.uid) return;

        const heartbeatInterval = setInterval(() => { 
            updateDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() }).catch(() => {}); 
        }, 60000);

        const unsubCurrent = onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = { uid: user.uid, email: user.email, ...docSnapshot.data() };
                if (isGlobalSuperAdminEmail(user.email)) {
                    data.isAdmin = true;
                    data.isApproved = true;
                    data.roles = Array.from(new Set([...(data.roles || []), 'Super Admin']));
                }
                setCurrentUserData(data);
                if (!profileForm.name && data.name) {
                    setProfileForm({
                        name: (data.name || "").split('@')[0],
                        fontSize: data.fontSize || "text-[14.2px]",
                        fontFamily: data.fontFamily || "font-sans",
                        themeFont: data.themeFont || "Inter",
                        accentColor: data.accentColor || "indigo",
                        displayMode: data.displayMode || "light",
                        fontScale: data.fontScale || "normal",
                    });
                }
                if (data.toolPreferences) setToolPreferences(prev => ({ ...prev, ...data.toolPreferences }));
            } else {
                setCurrentUserData(buildFallbackUserData(user));
            }
        });

        const unsubUsers = onSnapshot(query(collection(db, "users"), where("orgId", "==", orgId)), (snapshot) => {
            const fetchedUsers = snapshot.docs.map(document => document.data());
            fetchedUsers.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
            // Set all users for the Admin panel to view/unarchive
            setAllUsers(fetchedUsers);
            
            // Hide archived users from the rest of the application
            setDbUsers(fetchedUsers.filter(u => !u.isArchived));
        });
        
        const unsubGroups = onSnapshot(orgCollection("groups"), (snapshot) => {
            setGroups(snapshot.docs.map(document => ({ id: document.id, ...document.data() })));
        });

        return () => { clearInterval(heartbeatInterval); unsubCurrent(); unsubUsers(); unsubGroups(); };
    }, [orgId, user, currentUserData?.isAdmin, isVipAdmin, profileForm.name, setProfileForm, orgCollection]);

    return {
        isVipAdmin, currentUserData, dbUsers, allUsers,groups,
        activeReminders, genericNotifications, allAdminReminders,
        immutableAuditLogs, toolPreferences, setToolPreferences, customTags,
        globalAnnouncement 
    };
}
