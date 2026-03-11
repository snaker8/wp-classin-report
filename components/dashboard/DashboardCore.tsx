'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import UniversalMigration from '../admin/UniversalMigration';
import { collection, query, orderBy, limit, getDocs, where, Timestamp, deleteDoc, doc, setDoc, QueryConstraint } from 'firebase/firestore';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { ReportData } from '@/components/report/ReportView';
import TeacherManager from '@/components/admin/TeacherManager';

interface ReportDoc {
    id: string;
    studentName: string;
    className: string;
    courseName: string;
    teacherName: string;
    teacherId: string;
    centerName: string;
    department?: string;
    createdAt: Timestamp;
    reportData: ReportData;
}

interface DashboardCoreProps {
    viewMode: 'admin' | 'teacher';
}

export default function DashboardCore({ viewMode }: DashboardCoreProps) {
    const { user, userData, loading } = useAuth();
    const router = useRouter();
    const [reports, setReports] = useState<ReportDoc[]>([]);
    const [fetching, setFetching] = useState(true);
    // View Control
    const [filterMode, setFilterMode] = useState<'recent' | 'month'>('recent'); // 'recent' (last 3 months) or 'month' (specific month)
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCenter, setSelectedCenter] = useState('All');
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [onlyMyReports, setOnlyMyReports] = useState(viewMode === 'teacher');

    // Derived Data
    const [centers, setCenters] = useState<string[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [fetchedCenters, setFetchedCenters] = useState<string[]>([]); // Centers from teachers DB
    const [fetchedDepartments, setFetchedDepartments] = useState<string[]>([]); // Departments from teachers DB

    // Admin Settings Modal
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [adminCenterInput, setAdminCenterInput] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);

    // Admin Tabs
    const [activeTab, setActiveTab] = useState<'reports' | 'teachers'>('reports');

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
                return;
            }
        }
    }, [user, loading, userData, router]);

    // Fetch all centers for Admin
    useEffect(() => {
        if (viewMode === 'admin' && user) {
            const fetchAllCenters = async () => {
                try {
                    const q = query(collection(db, 'teachers'));
                    const snapshot = await getDocs(q);
                    const centerSet = new Set<string>();
                    const deptSet = new Set<string>();
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.centerName) centerSet.add(data.centerName);
                        if (data.department) deptSet.add(data.department);
                    });
                    setFetchedCenters(Array.from(centerSet));
                    setFetchedDepartments(Array.from(deptSet));
                } catch (e) {
                    console.error("Error fetching all centers:", e);
                }
            };
            fetchAllCenters();
        }
    }, [viewMode, user]);

    useEffect(() => {
        if (viewMode === 'teacher') {
            setOnlyMyReports(true);
        }
    }, [viewMode]);

    useEffect(() => {
        if (!user) return;

        const fetchReports = async () => {
            setFetching(true);
            try {
                let q;
                const baseRef = collection(db, 'reports');

                if (filterMode === 'month') {
                    // Specific Month Query (Strict)
                    // Uses 'month' equality + 'createdAt' sort. Requires Index if fields differ.
                    // Assuming 'month' and 'createdAt' composite index (or single) works/exists as before.

                    const constraints: QueryConstraint[] = [
                        where('month', '==', monthFilter)
                    ];

                    // Note: We removed orderBy('createdAt', 'desc') to avoid index requirements.
                    // We also removed server-side center/dept filtering for the same reason.
                    // The volume of reports per month is expected to be manageable for client-side sorting/filtering.

                    q = query(baseRef, ...constraints);

                } else {
                    // Recent Mode (Last 3 Months) - "Safe Query"
                    // To avoid missing composite indexes (e.g. centerName + createdAt),
                    // We query ONLY by time range and sort, then filter in memory.
                    // This guarantees we get the data without needing new indexes immediately.

                    const threeMonthsAgo = new Date();
                    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 6); // Extended to 6 months per plan
                    const minTimestamp = Timestamp.fromDate(threeMonthsAgo);

                    q = query(baseRef,
                        where('createdAt', '>=', minTimestamp),
                        orderBy('createdAt', 'desc')
                        // No other 'where' clauses to prevent index errors
                    );
                }

                const querySnapshot = await getDocs(q);
                const docs: ReportDoc[] = [];
                const uniqueCenters = new Set<string>();
                const uniqueDepartments = new Set<string>();

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Additional Client-side filtering
                    if (viewMode !== 'teacher') {
                        const role = userData?.role;
                        if (role === 'center_admin' && userData?.centerName) {
                            if (data.centerName !== userData.centerName) return;
                        } else if (role === 'dept_admin' && userData?.centerName) {
                            if (data.centerName !== userData.centerName) return;
                            if (userData.department && data.department !== userData.department) return;
                        }
                    }

                    docs.push({ id: doc.id, ...data } as ReportDoc);
                    if (data.centerName) uniqueCenters.add(data.centerName);
                    if (data.department) uniqueDepartments.add(data.department);
                });

                // Sort docs by createdAt desc (since we removed server-side sort for 'month' mode)
                docs.sort((a, b) => {
                    const tA = a.createdAt?.toMillis() || 0;
                    const tB = b.createdAt?.toMillis() || 0;
                    return tB - tA;
                });

                setReports(docs);
                setCenters(Array.from(uniqueCenters).sort());
                setDepartments(Array.from(uniqueDepartments).sort());

                if (viewMode === 'teacher' && userData?.centerName) {
                    setSelectedCenter(userData.centerName);
                } else if (viewMode === 'admin') {
                    const userRole = userData?.role;
                    if (userRole === 'center_admin' || userRole === 'dept_admin') {
                        if (userData?.centerName) setSelectedCenter(userData.centerName);
                    } else if (!selectedCenter) {
                        setSelectedCenter('All');
                    }
                    if (userRole === 'dept_admin' && userData?.department) {
                        setSelectedDepartment(userData.department);
                    }
                }

            } catch (error) {
                console.error("Error fetching reports:", error);
                try {
                    // Fallback
                    const q2 = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
                    const s2 = await getDocs(q2);
                    const docs2: ReportDoc[] = [];
                    s2.forEach((doc) => docs2.push({ id: doc.id, ...doc.data() } as ReportDoc));
                    setReports(docs2);
                } catch (e) { console.error(e); }
            } finally {
                setFetching(false);
            }
        };

        fetchReports();
    }, [user, monthFilter, userData, viewMode, filterMode]);

    const getGradeFromReport = (className: string, courseName: string) => {
        const text = (className || '') + ' ' + (courseName || '');

        // 1. Try Korean patterns (초1, 중2, 고3) - PRIORITIZED
        // This ensures '중3H1' is matched as '중3' first, ignoring the 'H1' part.
        const koMatch = text.match(/(초|중|고)(\d)/);
        if (koMatch) return `${koMatch[1]}${koMatch[2]}`;

        // 2. Try English prefixes with digits (M1, H2, etc.)
        const mMatch = text.match(/M(\d)/i);
        if (mMatch) return `중${mMatch[1]}`;

        const hMatch = text.match(/H(\d)/i);
        if (hMatch) return `고${hMatch[1]}`;

        // 3. General fallbacks for H/M (without numbers)
        // Also check for Korean "중등"/"고등" explicitly if needed, but regex above handles numbers.
        if (text.includes('중등')) return '중등';
        if (text.includes('고등')) return '고등';

        if (/M/i.test(text)) return '중등';
        if (/H/i.test(text)) return '고등';

        return '기타';
    };

    // Filter Logic
    const filteredReports = reports.filter(report => {
        // 1. Center Filter
        if (viewMode === 'teacher') {
            if (userData?.centerName && report.centerName !== userData.centerName) return false;
        } else {
            if (selectedCenter !== 'All' && report.centerName !== selectedCenter) return false;
        }

        // 2. Department Filter
        if (selectedDepartment !== 'All' && report.department !== selectedDepartment) return false;

        // 3. Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            const matchName = report.studentName?.toLowerCase().includes(lowerTerm);
            const matchClass = report.className?.toLowerCase().includes(lowerTerm);
            const matchCourse = report.courseName?.toLowerCase().includes(lowerTerm);
            const matchTopic = report.reportData?.report_info?.topic?.toLowerCase().includes(lowerTerm);
            const matchTeacher = report.teacherName?.toLowerCase().includes(lowerTerm);
            const matchCenter = report.centerName?.toLowerCase().includes(lowerTerm);
            const matchDept = report.department?.toLowerCase().includes(lowerTerm);

            if (!matchName && !matchClass && !matchCourse && !matchTopic && !matchTeacher && !matchCenter && !matchDept) return false;
        }

        // 4. My Reports Filter
        if (onlyMyReports) {
            // Use UID for robust filtering instead of name
            if (report.teacherId !== user?.uid) return false;
        }

        return true;
    });

    const groupedReports: Record<string, ReportDoc[]> = {};
    const gradeOrder = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '중등', '고등', '기타'];

    filteredReports.forEach(report => {
        const grade = getGradeFromReport(report.className, report.courseName);
        if (!groupedReports[grade]) groupedReports[grade] = [];
        groupedReports[grade].push(report);
    });

    const stats = useMemo(() => {
        const byCenter: Record<string, number> = {};
        const byClass: Record<string, number> = {};
        const byStudent: Record<string, number> = {};
        const byTeacher: Record<string, number> = {};
        const byDepartment: Record<string, number> = {};

        filteredReports.forEach(r => {
            const cName = r.centerName || 'Unknown';
            byCenter[cName] = (byCenter[cName] || 0) + 1;

            const dept = r.department || 'Unknown';
            byDepartment[dept] = (byDepartment[dept] || 0) + 1;

            const clName = r.className || 'Unknown';
            byClass[clName] = (byClass[clName] || 0) + 1;

            const sName = r.studentName || 'Unknown';
            byStudent[sName] = (byStudent[sName] || 0) + 1;

            const tName = r.teacherName || 'Unknown';
            byTeacher[tName] = (byTeacher[tName] || 0) + 1;
        });

        const byDay: Record<string, number> = {};
        const [year, month] = monthFilter.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            byDay[i] = 0;
        }
        filteredReports.forEach(r => {
            if (r.createdAt) {
                const day = r.createdAt.toDate().getDate();
                byDay[day] = (byDay[day] || 0) + 1;
            }
        });

        return { byCenter, byClass, byStudent, byTeacher, byDay, daysInMonth, byDepartment };
    }, [filteredReports, monthFilter]);

    const handleDeleteReport = async (reportId: string) => {
        if (!confirm('정말로 이 리포트를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'reports', reportId));
            setReports(reports.filter(r => r.id !== reportId));
            alert('리포트가 삭제되었습니다.');
        } catch (error) {
            console.error('Error deleting report:', error);
            alert('리포트 삭제 중 오류가 발생했습니다.');
        }
    };

    const handleSaveAdminCenter = async () => {
        if (!user) return;
        setSavingSettings(true);
        try {
            await setDoc(doc(db, 'teachers', user.uid), {
                centerName: adminCenterInput
            }, { merge: true });
            alert('소속 센터가 저장되었습니다. 변경 사항을 적용하려면 새로고침하세요.');
            setShowSettingsModal(false);
            window.location.reload(); // Simple reload to reflect auth context changes if needed
        } catch (error) {
            console.error("Error saving center:", error);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            setSavingSettings(false);
        }
    };

    const downloadCSV = () => {
        const headers = ['Date', 'Student', 'Class', 'Course', 'Teacher', 'Center', 'Topic', 'Link'];
        const rows = filteredReports.map(r => [
            r.createdAt?.toDate().toLocaleString() || '',
            r.studentName,
            r.className,
            r.courseName,
            r.teacherName,
            r.centerName,
            r.reportData?.report_info?.topic || '',
            `${window.location.origin}/report/${r.id}`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reports_${monthFilter}_${selectedCenter}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-foreground/5 pb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-serif font-light tracking-[0.1em] uppercase text-foreground mb-2">
                            {viewMode === 'teacher' ? `${userData?.centerName || 'My'} Reports` : 'Admin Dashboard'}
                        </h1>
                        <p className="text-foreground/50 text-[11px] uppercase tracking-[0.2em] font-medium">
                            {viewMode === 'teacher'
                                ? 'Report Management System'
                                : 'Centralized Management & Insights'}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => setShowAnalytics(!showAnalytics)}
                            className={`col-span-1 px-4 py-2.5 rounded-xl text-xs tracking-wider uppercase font-medium flex items-center justify-center gap-2 transition-all shadow-sm border
                                ${showAnalytics ? 'bg-foreground text-background border-foreground' : 'bg-white/50 text-foreground/70 hover:bg-white/80 border-white/60 backdrop-blur-sm'}`}
                        >
                            <Icon name={showAnalytics ? "FileText" : "BarChart"} size={14} />
                            <span className="truncate">{showAnalytics ? "List View" : "Analytics"}</span>
                        </button>
                        <div className="flex bg-white/40 p-1 rounded-xl border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)] backdrop-blur-sm">
                            <button
                                onClick={() => setFilterMode('recent')}
                                className={`px-4 py-1.5 text-xs font-medium uppercase tracking-wider rounded-lg transition-all ${filterMode === 'recent' ? 'bg-white text-foreground shadow-sm' : 'text-foreground/50 hover:text-foreground/80'}`}
                            >
                                6 Months
                            </button>
                            <button
                                onClick={() => setFilterMode('month')}
                                className={`px-4 py-1.5 text-xs font-medium uppercase tracking-wider rounded-lg transition-all ${filterMode === 'month' ? 'bg-white text-foreground shadow-sm' : 'text-foreground/50 hover:text-foreground/80'}`}
                            >
                                By Month
                            </button>
                        </div>

                        {filterMode === 'month' && (
                            <div className="col-span-1 relative h-[38px] animate-fade-in-left">
                                <Icon name="Calendar" className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" size={14} />
                                <input
                                    type="month"
                                    value={monthFilter}
                                    onChange={(e) => setMonthFilter(e.target.value)}
                                    className="w-full h-full bg-white/50 border border-white/60 rounded-xl pl-9 pr-3 py-2 text-xs shadow-sm font-medium text-foreground outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20 transition-all cursor-pointer backdrop-blur-sm"
                                />
                            </div>
                        )}
                        <button onClick={() => router.push('/')} className="col-span-2 sm:col-span-1 bg-white/70 hover:bg-white/90 text-foreground/80 border border-white px-5 py-2.5 rounded-xl text-xs tracking-[0.2em] font-medium uppercase shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all flex items-center justify-center gap-2 h-[38px] backdrop-blur-md">
                            <Icon name="PenTool" size={14} />
                            Compose
                        </button>

                        {viewMode === 'admin' && (
                            <button
                                onClick={() => {
                                    setAdminCenterInput(userData?.centerName || '');
                                    setShowSettingsModal(true);
                                }}
                                className="col-span-2 sm:col-span-1 bg-white/40 border border-white/60 text-foreground/60 px-4 py-2.5 rounded-xl text-xs tracking-wider uppercase font-medium hover:bg-white/70 hover:text-foreground transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] backdrop-blur-sm flex items-center justify-center gap-2 h-[38px]"
                            >
                                <Icon name="Settings" size={14} />
                                <span>Settings</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}

                {/* Admin Tabs Navigation */}
                {viewMode === 'admin' && (
                    <div className="flex w-full overflow-x-auto gap-4 mb-4">
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`pb-2 px-2 text-[13px] font-medium tracking-[0.1em] uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap border-b border-transparent ${activeTab === 'reports' ? 'text-foreground border-foreground' : 'text-foreground/40 hover:text-foreground/70'}`}
                        >
                            <Icon name="FileText" size={14} />
                            리포트 관리
                        </button>
                        <button
                            onClick={() => setActiveTab('teachers')}
                            className={`pb-2 px-2 text-[13px] font-medium tracking-[0.1em] uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap border-b border-transparent ${activeTab === 'teachers' ? 'text-foreground border-foreground' : 'text-foreground/40 hover:text-foreground/70'}`}
                        >
                            <Icon name="Users" size={14} />
                            선생님 & 센터 관리
                        </button>
                    </div>
                )}

                {/* Content Area */}
                {activeTab === 'teachers' && viewMode === 'admin' ? (
                    <TeacherManager />
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white/40 p-5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.02)] border border-white/60 backdrop-blur-md grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-4 items-center">
                            <div className="relative col-span-1 sm:col-span-2 lg:flex-1 min-w-[200px]">
                                <Icon name="Search" className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search reports..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-11 pr-4 py-2.5 bg-white/50 border-b border-foreground/10 focus:bg-white/80 focus:border-foreground/30 outline-none text-sm transition-all text-foreground rounded-t-xl"
                                />
                            </div>

                            {viewMode === 'admin' && (
                                <div className="relative col-span-1 lg:min-w-[140px]">
                                    <select
                                        value={selectedCenter}
                                        onChange={(e) => setSelectedCenter(e.target.value)}
                                        disabled={userData?.role === 'center_admin' || userData?.role === 'dept_admin'}
                                        className={`w-full pl-4 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-amber-500 outline-none text-sm appearance-none cursor-pointer font-medium text-slate-700 ${userData?.role === 'center_admin' || userData?.role === 'dept_admin' ? 'bg-slate-100 text-slate-500 opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="All">All Centers</option>
                                        {Array.from(new Set([...centers, ...fetchedCenters])).sort().map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <Icon name="ChevronDown" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            )}

                            {viewMode === 'admin' && (
                                <div className="relative col-span-1 lg:min-w-[140px]">
                                    <select
                                        value={selectedDepartment}
                                        onChange={(e) => setSelectedDepartment(e.target.value)}
                                        disabled={userData?.role === 'dept_admin'}
                                        className={`w-full pl-4 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-amber-500 outline-none text-sm appearance-none cursor-pointer font-medium text-slate-700 ${userData?.role === 'dept_admin' ? 'bg-slate-100 text-slate-500 opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="All">All Depts</option>
                                        {Array.from(new Set([...departments, ...fetchedDepartments])).sort().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <Icon name="ChevronDown" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            )}

                            {/* Simplified Teacher View - Only My Reports is IMPLICIT if viewMode is teacher */}
                            {viewMode === 'teacher' ? (
                                <div className="hidden lg:flex col-span-1 lg:w-auto px-3 py-2 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-lg border border-indigo-100 items-center justify-center gap-2">
                                    <Icon name="UserCheck" size={16} />
                                    내 리포트
                                </div>
                            ) : (
                                // Admin can toggle
                                <label className="col-span-1 lg:w-auto flex items-center justify-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors select-none">
                                    <input
                                        type="checkbox"
                                        checked={onlyMyReports}
                                        onChange={(e) => setOnlyMyReports(e.target.checked)}
                                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-bold text-slate-600 whitespace-nowrap">내 리포트</span>
                                </label>
                            )}

                            <button onClick={downloadCSV} className="col-span-1 lg:w-auto bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                                <Icon name="Download" size={16} /> CSV
                            </button>
                        </div>

                        {fetching ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                                <Icon name="Loader2" className="animate-spin mx-auto text-amber-500 mb-2" size={32} />
                                <p className="text-slate-500">데이터를 불러오는 중입니다...</p>
                            </div>
                        ) : showAnalytics ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-2"><Icon name="FileText" size={14} /> Total Reports</div>
                                        <div className="text-3xl font-bold text-slate-900">{filteredReports.length}</div>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-2"><Icon name="Users" size={14} /> Active Students</div>
                                        <div className="text-3xl font-bold text-slate-900">{Object.keys(stats.byStudent).length}</div>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-2"><Icon name="Building" size={14} /> Active Classes</div>
                                        <div className="text-3xl font-bold text-slate-900">{Object.keys(stats.byClass).length}</div>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-2"><Icon name="Award" size={14} /> Teachers</div>
                                        <div className="text-3xl font-bold text-slate-900">{Object.keys(stats.byTeacher).length}</div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <Icon name="PieChart" size={20} className="text-amber-500" />
                                            Center Distribution
                                        </h3>
                                        <div className="space-y-3">
                                            {Object.entries(stats.byCenter).sort(([, a], [, b]) => (b as number) - (a as number)).map(([center, count]) => (
                                                <div key={center}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium text-slate-700">{center}</span>
                                                        <span className="text-slate-500 font-mono">{count} ({Math.round(count / filteredReports.length * 100)}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                        <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${(count / filteredReports.length) * 100}%` }}></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <Icon name="PieChart" size={20} className="text-indigo-500" />
                                            Department Distribution
                                        </h3>
                                        <div className="space-y-3">
                                            {Object.entries(stats.byDepartment || {}).sort(([, a], [, b]) => (b as number) - (a as number)).map(([dept, count]) => (
                                                <div key={dept}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium text-slate-700">{dept}</span>
                                                        <span className="text-slate-500 font-mono">{count} ({Math.round(count / filteredReports.length * 100)}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                        <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${(count / filteredReports.length) * 100}%` }}></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:col-span-2">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <Icon name="TrendingUp" size={20} className="text-blue-500" />
                                            Top Active Classes
                                        </h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            {Object.entries(stats.byClass).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10).map(([cls, count], idx) => (
                                                <div key={cls} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded bg-white border border-slate-100">
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-slate-800">{cls}</div>
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-900">{count}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                        <Icon name="LineChart" size={20} className="text-emerald-500" />
                                        Daily Activity ({monthFilter})
                                    </h3>
                                    <div className="flex items-end justify-between gap-1 h-32 pl-4 border-l border-b border-slate-200">
                                        {Array.from({ length: stats.daysInMonth }, (_, i) => i + 1).map(day => {
                                            const count = stats.byDay[day];
                                            const date = new Date(parseInt(monthFilter.split('-')[0]), parseInt(monthFilter.split('-')[1]) - 1, day);
                                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                            const max = Math.max(10, ...Object.values(stats.byDay));
                                            const height = (count / max) * 100;

                                            return (
                                                <div key={day} className="flex-1 flex flex-col justify-end items-center group relative cursor-default">
                                                    {count > 0 && (
                                                        <div className="absolute -top-8 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                                                            {day}일: {count}건
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`w-full mx-[1px] rounded-t-sm transition-all ${count > 0 ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-transparent'}`}
                                                        style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                                                    ></div>
                                                    <span className={`text-[9px] mt-1 ${isWeekend ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                                                        {day % 5 === 0 || day === 1 ? day : ''}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {/* Stats simplified for luxury feel */}
                                    <div className="bg-white/40 p-6 rounded-2xl border border-white/60 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
                                        <div className="text-[10px] text-foreground/40 uppercase font-medium tracking-[0.2em] mb-2">Total Reports</div>
                                        <div className="text-3xl font-light text-foreground">{filteredReports.length}</div>
                                    </div>
                                    <div className="bg-white/40 p-6 rounded-2xl border border-white/60 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
                                        <div className="text-[10px] text-foreground/40 uppercase font-medium tracking-[0.2em] mb-2">Students</div>
                                        <div className="text-3xl font-light text-foreground">{new Set(filteredReports.map(r => r.studentName)).size}</div>
                                    </div>
                                </div>

                                {filteredReports.length === 0 ? (
                                    <div className="text-center py-24 bg-white/30 rounded-3xl border border-white/50 backdrop-blur-md">
                                        <Icon name="FileX" className="mx-auto text-foreground/20 mb-4" size={40} />
                                        <p className="text-foreground/50 font-light tracking-wide text-sm">No reports match your search criteria.</p>
                                    </div>
                                ) : (
                                    gradeOrder.concat(Object.keys(groupedReports).filter(k => !gradeOrder.includes(k))).map(grade => {
                                        const gradeReports = groupedReports[grade];
                                        if (!gradeReports || gradeReports.length === 0) return null;

                                        return (
                                            <div key={grade} className="bg-white/50 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.03)] border border-white/60 overflow-hidden mb-6">
                                                <div className="bg-white/30 backdrop-blur-sm px-8 py-4 flex items-center justify-between border-b border-foreground/5">
                                                    <h3 className="text-sm font-medium text-foreground tracking-[0.2em] uppercase flex items-center gap-3">
                                                        {grade}
                                                        <span className="text-foreground/30 text-xs font-light">({gradeReports.length})</span>
                                                    </h3>
                                                </div>
                                                <div className="divide-y divide-foreground/5 px-4 pb-2">
                                                    {gradeReports.map(report => (
                                                        <div key={report.id} className="p-4 mx-2 my-2 rounded-2xl hover:bg-white/60 border border-transparent hover:border-white transition-all flex flex-col md:flex-row items-center gap-6">
                                                            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center w-full">
                                                                <div className="col-span-1 md:col-span-2 flex md:block items-center justify-between">
                                                                    <div className="text-xs text-foreground/40 font-mono tracking-wider mb-0.5">{report.createdAt?.toDate().toLocaleDateString()}</div>
                                                                    <div className="text-[10px] text-foreground/30 font-mono hidden md:block">{report.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                                </div>
                                                                <div className="col-span-1 md:col-span-3">
                                                                    <div className="font-serif text-foreground text-lg">{report.studentName}</div>
                                                                </div>
                                                                <div className="col-span-1 md:col-span-3">
                                                                    <div className="flex gap-2 flex-col">
                                                                        <span className="text-sm text-foreground/80 font-medium">{report.className}</span>
                                                                        <span className="text-xs text-foreground/40 truncate">{report.courseName}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="col-span-1 md:col-span-4 mt-2 md:mt-0">
                                                                    <div className="text-xs text-foreground/60 leading-relaxed truncate">{report.reportData?.report_info?.topic || "No Topic"}</div>
                                                                    <div className="flex gap-2 items-center mt-2.5">
                                                                        <div className="flex items-center gap-1.5 text-foreground/60 bg-foreground/[0.03] border border-foreground/[0.05] px-2.5 py-1 rounded-md">
                                                                            <Icon name="Users" size={10} className="opacity-70" />
                                                                            <span className="text-[10.5px] font-medium tracking-wider">{report.teacherName}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-foreground/60 bg-foreground/[0.03] border border-foreground/[0.05] px-2.5 py-1 rounded-md">
                                                                            <Icon name="MapPin" size={10} className="opacity-70" />
                                                                            <span className="text-[10.5px] font-medium tracking-wider">{report.centerName}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex-shrink-0 w-full md:w-auto flex justify-end gap-3 border-t border-foreground/5 md:border-0 pt-4 md:pt-0">
                                                                <button
                                                                    onClick={() => window.open(`${window.location.origin}/report/${report.id}`, '_blank')}
                                                                    className="flex items-center justify-center gap-2 bg-white/70 hover:bg-white text-foreground/80 border border-white px-5 py-2.5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all text-[11px] font-medium uppercase tracking-[0.1em]"
                                                                >
                                                                    <Icon name="Link" size={12} />
                                                                    <span>Open</span>
                                                                </button>
                                                                {(viewMode === 'admin' || report.teacherName === userData?.displayName) && (
                                                                    <button
                                                                        onClick={() => handleDeleteReport(report.id)}
                                                                        className="flex items-center justify-center gap-2 bg-red-50/50 hover:bg-red-50 text-red-500 border border-red-100/50 px-3 py-2.5 rounded-xl transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                                                                        title="삭제"
                                                                    >
                                                                        <Icon name="Trash2" size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Admin Settings Modal */}
                {showSettingsModal && (
                    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_16px_64px_rgba(0,0,0,0.1)] border border-white max-w-2xl w-full p-8 space-y-8 relative max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center border-b border-foreground/10 pb-6">
                                <h3 className="text-xl font-serif font-light tracking-[0.1em] text-foreground uppercase flex items-center gap-3">
                                    <Icon name="Settings" size={20} className="text-foreground/60" />
                                    관리자 설정
                                </h3>
                                <button onClick={() => setShowSettingsModal(false)} className="text-foreground/40 hover:text-foreground p-2 rounded-full transition-colors active:scale-95">
                                    <Icon name="X" size={20} />
                                </button>
                            </div>

                            <section className="space-y-6">
                                <h4 className="text-[11px] font-medium text-foreground/50 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Icon name="User" size={14} />
                                    개인 설정
                                </h4>
                                <div className="bg-white/50 p-6 rounded-2xl border border-white/60 space-y-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                                    <div className="space-y-3 relative group">
                                        <label className="block text-[10px] font-medium text-foreground/50 uppercase tracking-[0.2em] transition-colors group-focus-within:text-foreground">소속 센터 (Center Name)</label>
                                        <input
                                            type="text"
                                            value={adminCenterInput}
                                            onChange={(e) => setAdminCenterInput(e.target.value)}
                                            className="w-full px-2 py-3 bg-transparent border-b border-foreground/20 text-foreground font-light focus:outline-none focus:border-foreground transition-all placeholder:text-foreground/30 text-base"
                                            placeholder="예: 과사람 의대관"
                                        />
                                        <p className="text-[11px] text-foreground/40 font-light tracking-wide pt-1">
                                            리포트 생성 및 대시보드 표시용 소속 정보입니다.
                                        </p>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <button
                                            onClick={handleSaveAdminCenter}
                                            disabled={savingSettings}
                                            className="px-6 py-2.5 bg-foreground text-background/90 text-xs font-medium tracking-[0.2em] uppercase rounded-xl hover:bg-foreground/90 transition-all disabled:opacity-50 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center gap-2"
                                        >
                                            <Icon name="Save" size={14} />
                                            {savingSettings ? '저장 중...' : '변경사항 저장'}
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* Super Admin Section */}
                            {(userData?.role === 'super_admin' || userData?.role === 'admin') && (
                                <section className="space-y-6 pt-8 border-t border-foreground/10">
                                    <h4 className="text-[11px] font-medium text-amber-600/80 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Icon name="Shield" size={14} />
                                        Super Admin 전용 도구
                                    </h4>
                                    <div className="bg-amber-50/50 backdrop-blur-sm p-6 rounded-2xl border border-amber-200/50 shadow-sm">
                                        <UniversalMigration />
                                    </div>
                                </section>
                            )}

                            <div className="flex justify-end pt-6">
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="px-6 py-2.5 bg-white/60 text-foreground/60 hover:text-foreground border border-transparent hover:border-foreground/10 text-xs font-medium tracking-[0.2em] uppercase rounded-xl transition-all active:scale-95"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
