import React, { useState } from 'react';
import { db } from '../firebase.js'; // Adjust path if your firebase file is elsewhere
import { collection, getDocs, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';

export default function SeedDatabase() {
    const [status, setStatus] = useState('Idle');
    const [progress, setProgress] = useState(0);

    const adminEmail = 'shivsuri1@gmail.com';

    const coordinators = [
        { uid: 'seed_cs', email: 'csahani@mpgs.edu', name: 'Ms. Chandini Sahani', isApproved: true, isAdmin: false, canCreateGroups: true, profilePicUrl: '' },
        { uid: 'seed_mk', email: 'mkhare@mpgs.edu', name: 'Ms. Monika Khare', isApproved: true, isAdmin: false, canCreateGroups: true, profilePicUrl: '' },
        { uid: 'seed_ar', email: 'arana@mpgs.edu', name: 'Ms. Archana Rana', isApproved: true, isAdmin: false, canCreateGroups: true, profilePicUrl: '' },
        { uid: 'seed_ya', email: 'yarora@mpgs.edu', name: 'Ms. Yamini Arora', isApproved: true, isAdmin: false, canCreateGroups: true, profilePicUrl: '' },
        { uid: 'seed_yg', email: 'ygahlot@mpgs.edu', name: 'Ms. Yukti Gahlot', isApproved: true, isAdmin: false, canCreateGroups: true, profilePicUrl: '' }
    ];

    const generateTimestamp = (daysAgo, hoursAgo = 0) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        d.setHours(d.getHours() - hoursAgo);
        return d;
    };

    const runSeeder = async () => {
        if (!window.confirm("🚨 This will wipe the entire database (except Admin) and inject the MPGS ecosystem. Proceed?")) return;
        setStatus('Wiping old data...');
        setProgress(10);

        try {
            // 1. WIPE COLLECTIONS
            const collectionsToWipe = ['groups', 'messages', 'tasks', 'notifications', 'scheduled_messages', 'reminders', 'audit_logs', 'workspace_tags'];
            for (const colName of collectionsToWipe) {
                const snap = await getDocs(collection(db, colName));
                await Promise.all(snap.docs.map(d => deleteDoc(doc(db, colName, d.id))));
            }

            // Wipe Users EXCEPT Admin
            const usersSnap = await getDocs(collection(db, 'users'));
            let adminUid = null;
            for (const userDoc of usersSnap.docs) {
                if (userDoc.data().email === adminEmail) {
                    adminUid = userDoc.data().uid || userDoc.id;
                } else {
                    await deleteDoc(doc(db, 'users', userDoc.id));
                }
            }

            if (!adminUid) {
                setStatus('Error: Admin user (shivsuri1@gmail.com) not found in DB. Please log in first.');
                return;
            }

            setStatus('Injecting Coordinators...');
            setProgress(30);

            // 2. INJECT USERS
            for (const coord of coordinators) {
                await setDoc(doc(db, 'users', coord.uid), { ...coord, lastActive: new Date() });
            }

            // 3. INJECT TAGS
            const tags = [
                { label: '#Approved', bgClass: 'bg-teal-50', textClass: 'text-teal-700', createdAt: new Date() },
                { label: '#Reviewing', bgClass: 'bg-indigo-50', textClass: 'text-indigo-700', createdAt: new Date() },
                { label: '#ActionRequired', bgClass: 'bg-rose-50', textClass: 'text-rose-700', createdAt: new Date() },
                { label: '#Noted', bgClass: 'bg-slate-100', textClass: 'text-slate-600', createdAt: new Date() }
            ];
            for (const t of tags) await addDoc(collection(db, 'workspace_tags'), t);

            setStatus('Building Departments & DMs...');
            setProgress(50);

            // 4. INJECT GROUPS
            const adminData = { email: adminEmail, name: 'Shiv Suri', uid: adminUid };
            const groupDefinitions = [
                { id: 'g_core', name: 'MPGS Core Leadership', members: [adminEmail, ...coordinators.map(c=>c.email)], isDM: false },
                { id: 'g_senior', name: 'Senior Academics Hub', members: [adminEmail, 'csahani@mpgs.edu', 'mkhare@mpgs.edu'], isDM: false },
                { id: 'g_middle', name: 'Middle Stage Focus', members: [adminEmail, 'arana@mpgs.edu'], isDM: false },
                { id: 'g_prep', name: 'Foundation & Prep TLP', members: [adminEmail, 'yarora@mpgs.edu', 'ygahlot@mpgs.edu'], isDM: false },
                { id: 'g_exams', name: 'Exams & Assessments Sync', members: [adminEmail, ...coordinators.map(c=>c.email)], isDM: false },
                { id: [adminUid, 'seed_yg'].sort().join('_'), name: 'Yukti Gahlot', members: [adminEmail, 'ygahlot@mpgs.edu'], isDM: true },
                { id: [adminUid, 'seed_mk'].sort().join('_'), name: 'Monika Khare', members: [adminEmail, 'mkhare@mpgs.edu'], isDM: true }
            ];

            for (const grp of groupDefinitions) {
                await setDoc(doc(db, 'groups', grp.id), {
                    name: grp.name, members: grp.members, admins: [adminEmail], isArchived: false, isDM: grp.isDM || false, createdAt: new Date()
                });
            }

            setStatus('Injecting 100+ Messages, Tasks & Threads...');
            setProgress(70);

            // 5. INJECT HEAVY MESSAGES (20 per group)
            const insertMsg = async (payload) => {
                const docRef = await addDoc(collection(db, 'messages'), payload);
                return docRef.id;
            };

            const formatT = (date) => ({
                timestamp: date,
                dateString: date.toISOString().split('T')[0],
                time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            // Group 1: Core Leadership (20 Messages)
            let currentDay = 4;
            for (let i = 1; i <= 15; i++) {
                await insertMsg({ groupId: 'g_core', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Morning briefing item #${i}: Please ensure all advisory duties are logged.`, ...formatT(generateTimestamp(currentDay, i)) });
            }
            // Add a Thread
            const coreParent = await insertMsg({ groupId: 'g_core', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `<b>Important:</b> Performance Counseling schedules must be finalized this week.`, ...formatT(generateTimestamp(2, 5)) });
            await insertMsg({ groupId: 'g_core', replyToId: coreParent, sender: 'Ms. Chandini Sahani', senderEmail: 'csahani@mpgs.edu', senderUid: 'seed_cs', text: `My schedules are uploaded to the drive.`, ...formatT(generateTimestamp(2, 4)) });
            await insertMsg({ groupId: 'g_core', replyToId: coreParent, sender: 'Ms. Yamini Arora', senderEmail: 'yarora@mpgs.edu', senderUid: 'seed_ya', text: `Working on the Preparatory stage counseling slots now.`, ...formatT(generateTimestamp(2, 3)) });
            // Add a Task
            await insertMsg({
                groupId: 'g_core', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Consolidate school-wide infrastructure coordination report.`, isTask: true,
                taskData: { status: 'In Progress', priority: 'High', assignees: ['csahani@mpgs.edu', 'mkhare@mpgs.edu'], deadline: generateTimestamp(-2).toISOString().split('T')[0], trail: [{ action: 'Task Created', by: adminEmail, time: '10:00 AM', comment: 'Please collaborate with HODs.' }] },
                ...formatT(generateTimestamp(1, 2))
            });

            // Group 2: Senior Academics (20 Messages)
            for (let i = 1; i <= 14; i++) {
                await insertMsg({ groupId: 'g_senior', sender: 'Ms. Monika Khare', senderEmail: 'mkhare@mpgs.edu', senderUid: 'seed_mk', text: `Secondary Stage Update: Class 9 and 10 modules aligned for week ${i}.`, ...formatT(generateTimestamp(3, i)) });
            }
            // Thread: NCERT
            const ncertParent = await insertMsg({ groupId: 'g_senior', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `<i>Requesting confirmation</i> on the NCERT 60/40 competency-based integration for board classes.`, ...formatT(generateTimestamp(2, 6)) });
            await insertMsg({ groupId: 'g_senior', replyToId: ncertParent, sender: 'Ms. Chandini Sahani', senderEmail: 'csahani@mpgs.edu', senderUid: 'seed_cs', text: `Class 12 blueprint is confirmed and aligned.`, ...formatT(generateTimestamp(2, 5)) });
            await insertMsg({ groupId: 'g_senior', replyToId: ncertParent, sender: 'Ms. Monika Khare', senderEmail: 'mkhare@mpgs.edu', senderUid: 'seed_mk', text: `Class 10 is 100% compliant.`, reactions: { '#Approved': [adminEmail] }, ...formatT(generateTimestamp(2, 4)) });
            // Tasks
            await insertMsg({ groupId: 'g_senior', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Finalize Class 12 blueprints.`, isTask: true, taskData: { status: 'Completed', priority: 'High', assignees: ['csahani@mpgs.edu'], deadline: generateTimestamp(1).toISOString().split('T')[0], trail: [{ action: 'Marked Completed', by: 'csahani@mpgs.edu', time: '11:00 AM' }] }, ...formatT(generateTimestamp(2, 1)) });
            await insertMsg({ groupId: 'g_senior', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Map Subject Domain Facilitation guidelines for Science HODs.`, isTask: true, taskData: { status: 'Pending', priority: 'Medium', assignees: ['mkhare@mpgs.edu'], deadline: generateTimestamp(-5).toISOString().split('T')[0], trail: [] }, ...formatT(generateTimestamp(1, 1)) });

            // Group 3: Middle Stage (20 Messages)
            for (let i = 1; i <= 17; i++) {
                await insertMsg({ groupId: 'g_middle', sender: 'Ms. Archana Rana', senderEmail: 'arana@mpgs.edu', senderUid: 'seed_ar', text: `Class 6-8 notebook checking schedule rotation ${i} completed.`, ...formatT(generateTimestamp(4, i)) });
            }
            await insertMsg({ groupId: 'g_middle', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Submit Teacher Observation Review Notes for Middle Stage.`, isTask: true, taskData: { status: 'Pending', priority: 'Medium', assignees: ['arana@mpgs.edu'], deadline: generateTimestamp(-3).toISOString().split('T')[0], trail: [] }, ...formatT(generateTimestamp(1)) });
            await insertMsg({ groupId: 'g_middle', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Please review the experiential learning framework attached.`, fileUrl: 'https://example.com/framework.pdf', fileName: '__SECURE__Experiential_Framework.pdf', fileType: 'application/pdf', ...formatT(generateTimestamp(0, 5)) });

            // Group 4: Foundation & Prep (20 Messages)
            for (let i = 1; i <= 12; i++) {
                await insertMsg({ groupId: 'g_prep', sender: 'Ms. Yamini Arora', senderEmail: 'yarora@mpgs.edu', senderUid: 'seed_ya', text: `TLP Focus: Smartboard engagement metrics for Prep stage logged.`, ...formatT(generateTimestamp(3, i)) });
            }
            const matrixParent = await insertMsg({ groupId: 'g_prep', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `<span style="color: darkorange; font-weight: bold;">Priority:</span> Extract existing Balvatika GC topics to the master Sheet matrix.`, ...formatT(generateTimestamp(2, 6)) });
            await insertMsg({ groupId: 'g_prep', replyToId: matrixParent, sender: 'Ms. Yukti Gahlot', senderEmail: 'ygahlot@mpgs.edu', senderUid: 'seed_yg', text: `Extracting the 36-column matrix now.`, ...formatT(generateTimestamp(2, 5)) });
            await insertMsg({ groupId: 'g_prep', replyToId: matrixParent, sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Add the "BV" prefix to your specific stages.`, ...formatT(generateTimestamp(2, 4)) });
            await insertMsg({ groupId: 'g_prep', replyToId: matrixParent, sender: 'Ms. Yukti Gahlot', senderEmail: 'ygahlot@mpgs.edu', senderUid: 'seed_yg', text: `Prefix added and uploaded.`, reactions: { '👍': [adminEmail] }, ...formatT(generateTimestamp(2, 3)) });
            await insertMsg({ groupId: 'g_prep', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Verify TLP Infrastructure requirements for Class 3 to 5.`, isTask: true, taskData: { status: 'Completed', priority: 'Medium', assignees: ['yarora@mpgs.edu'], deadline: generateTimestamp(0).toISOString().split('T')[0], trail: [{ action: 'Marked Completed', by: 'yarora@mpgs.edu', time: '1:00 PM' }] }, ...formatT(generateTimestamp(1)) });

            // Group 5: Exams & Assessments (20 Messages)
            for (let i = 1; i <= 18; i++) {
                await insertMsg({ groupId: 'g_exams', sender: 'Ms. Chandini Sahani', senderEmail: 'csahani@mpgs.edu', senderUid: 'seed_cs', text: `Assessment paper draft v${i} uploaded for review.`, ...formatT(generateTimestamp(4, i)) });
            }
            await insertMsg({ groupId: 'g_exams', sender: adminData.name, senderEmail: adminEmail, senderUid: adminUid, text: `Cross-verify that all term papers include the watermark text 'SHIV SURI' to prevent copying.`, reactions: { '#Noted': ['csahani@mpgs.edu', 'mkhare@mpgs.edu', 'arana@mpgs.edu'] }, ...formatT(generateTimestamp(1, 2)) });

            // 6. SCHEDULED MESSAGES & REMINDERS
            setStatus('Setting Reminders & Schedules...');
            setProgress(90);

            await addDoc(collection(db, 'scheduled_messages'), {
                groupId: 'g_core', status: 'pending', text: `<b>Team Directive:</b> Please ensure all joint work with HODs on the subject domain facilitation is looped in by 2 PM.`, senderUid: adminUid, senderEmail: adminEmail, scheduledFor: generateTimestamp(-2).toISOString()
            });

            await addDoc(collection(db, 'reminders'), {
                userId: adminUid, userEmail: adminEmail, messageId: 'dummy_id_1', messageText: 'Grievance Counseling Session Preparation', remindAt: generateTimestamp(-1).toISOString(), isTriggered: false
            });

            setStatus('Seeding Complete! Refreshing app...');
            setProgress(100);
            
            setTimeout(() => { window.location.reload(); }, 2000);

        } catch (error) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        }
    };

    if (progress === 100) return null; // Hide when done to allow reload

    return (
        <div className="fixed top-0 left-0 w-full z-[99999] bg-rose-600 shadow-2xl flex flex-col items-center justify-center p-4 border-b-4 border-rose-800">
            <div className="max-w-4xl w-full flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-white text-left">
                    <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation animate-pulse"></i> MPGS Database Seeder
                    </h2>
                    <p className="text-rose-100 text-xs font-medium mt-1">This will wipe your old data and instantly inject the 100+ MPGS Ecosystem records.</p>
                </div>

                {progress === 0 ? (
                    <button 
                        onClick={runSeeder} 
                        className="bg-white text-rose-700 font-black px-8 py-3 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:bg-rose-50 hover:scale-105 transition-all uppercase tracking-widest whitespace-nowrap"
                    >
                        🚀 Click Here to Generate
                    </button>
                ) : (
                    <div className="flex-1 max-w-sm w-full bg-rose-900 rounded-full h-8 overflow-hidden relative border-2 border-rose-500 shadow-inner">
                        <div className="h-full bg-emerald-400 transition-all duration-300 flex items-center justify-end pr-2" style={{ width: `${progress}%` }}>
                            <span className="text-[10px] font-black text-emerald-900">{progress}%</span>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <span className="text-white text-xs font-bold drop-shadow-md">{status}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
