'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { ReportData } from '@/components/report/ReportView';

interface ReportDoc {
    id: string;
    studentName: string;
    className: string;
    courseName: string;
    teacherName: string;
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
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCenter, setSelectedCenter] = useState('All');
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [onlyMyReports, setOnlyMyReports] = useState(viewMode === 'teacher'); // Default true for teacher? Or just option

    // Derived Data
    const [centers, setCenters] = useState<string[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
                return;
            }
        }
    }, [user, loading, userData, router]);

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
                q = query(
                    collection(db, 'reports'),
                    where('month', '==', monthFilter),
                    orderBy('createdAt', 'desc')
                );

                const querySnapshot = await getDocs(q);
                const docs: ReportDoc[] = [];
                const uniqueCenters = new Set<string>();
                const uniqueDepartments = new Set<string>();

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    docs.push({ id: doc.id, ...data } as ReportDoc);
                    if (data.centerName) uniqueCenters.add(data.centerName);
                    if (data.department) uniqueDepartments.add(data.department);
                });

                setReports(docs);
                setCenters(Array.from(uniqueCenters).sort());
                setDepartments(Array.from(uniqueDepartments).sort());

                // Set initial center filter based on role/mode
                if (viewMode === 'teacher' && userData?.centerName) {
                    setSelectedCenter(userData.centerName);
                } else if (viewMode === 'admin' && !selectedCenter) {
                    setSelectedCenter('All');
                }

            } catch (error) {
                console.error("Error fetching reports:", error);
                // Fallback attempt
                try {
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
    }, [user, monthFilter, userData, viewMode]);

    const getGradeFromClassName = (className: string) => {
        if (!className) return '기타';
        const match = className.match(/(초|중|고)(\d)/);
        if (match) {
            return `${match[1]}${match[2]}`;
        }
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

            if (!matchName && !matchClass && !matchCourse && !matchTopic && !matchTeacher) return false;
        }

        // 4. My Reports Filter
        if (onlyMyReports) { // Applied for both if checked, but ViewMode teacher defaults/forces?
            // Actually, if viewMode is teacher, we might want to allow seeing other teachers in SAME center if checkbox is off?
            // Previous logic: if role=teacher && onlyMyReports.

            // User Request: "Teachers can only manage/delete THEIR reports".
            // But can they VIEW others? 
            // "Teachers should not access Admin page"

            if (report.teacherName !== userData?.displayName) return false;
        }

        return true;
    });

    const groupedReports: Record<string, ReportDoc[]> = {};
    const gradeOrder = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '기타'];

    filteredReports.forEach(report => {
        const grade = getGradeFromClassName(report.className);
        if (!groupedReports[grade]) groupedReports[grade] = [];
        groupedReports[grade].push(report);
    });

    const getAnalytics = () => {
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
        const daysInMonth = new Date(parseInt(monthFilter.split('-')[0]), parseInt(monthFilter.split('-')[1]), 0).getDate();
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
    };

    const stats = getAnalytics();

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
        <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-slate-900">
                            {viewMode === 'teacher' ? `${userData?.centerName || '내'} 리포트 관리` : '통합 관리자 대시보드'}
                        </h1>
                        <p className="text-slate-500">
                            {viewMode === 'teacher'
                                ? '나의 리포트 및 학생 관리'
                                : '전체 센터 리포트 현황 및 통합 관리'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAnalytics(!showAnalytics)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm
                                ${showAnalytics ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            <Icon name={showAnalytics ? "FileText" : "BarChart"} size={16} />
                            {showAnalytics ? "리스트 보기" : "분석 현황 보기"}
                        </button>
                        <input
                            type="month"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="bg-white border border-slate-300 rounded px-3 py-2 text-sm shadow-sm"
                        />
                        <button onClick={() => router.push('/')} className="bg-slate-900 border border-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-md transition-all flex items-center gap-2">
                            <Icon name="PenTool" size={14} />
                            리포트 생성하기
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[240px]">
                        <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="이름, 클래스, 과정, 주제 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm transition-all"
                        />
                    </div>

                    {viewMode === 'admin' && (
                        <div className="relative min-w-[160px]">
                            <select
                                value={selectedCenter}
                                onChange={(e) => setSelectedCenter(e.target.value)}
                                className="w-full pl-4 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-amber-500 outline-none text-sm appearance-none cursor-pointer font-medium text-slate-700"
                            >
                                <option value="All">All Centers</option>
                                {centers.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <Icon name="ChevronDown" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>
                    )}

                    <div className="relative min-w-[160px]">
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="w-full pl-4 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-amber-500 outline-none text-sm appearance-none cursor-pointer font-medium text-slate-700"
                        >
                            <option value="All">All Departments</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <Icon name="ChevronDown" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>

                    {/* Simplified Teacher View - Only My Reports is IMPLICIT if viewMode is teacher */}
                    {viewMode === 'teacher' ? (
                        <div className="px-3 py-2 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-lg border border-indigo-100 flex items-center gap-2">
                            <Icon name="UserCheck" size={16} />
                            내 리포트만 보기 중
                        </div>
                    ) : (
                        // Admin can toggle
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors select-none">
                            <input
                                type="checkbox"
                                checked={onlyMyReports}
                                onChange={(e) => setOnlyMyReports(e.target.checked)}
                                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                            />
                            <span className="text-sm font-bold text-slate-600">내 리포트만 보기</span>
                        </label>
                    )}

                    <button onClick={downloadCSV} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
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
                                    {Object.entries(stats.byCenter).sort(([, a], [, b]) => b - a).map(([center, count]) => (
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
                                    {Object.entries(stats.byDepartment || {}).sort(([, a], [, b]) => b - a).map(([dept, count]) => (
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
                                    {Object.entries(stats.byClass).sort(([, a], [, b]) => b - a).slice(0, 10).map(([cls, count], idx) => (
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
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Reports</div>
                                <div className="text-2xl font-bold text-slate-900">{filteredReports.length}</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Students</div>
                                <div className="text-2xl font-bold text-slate-900">{new Set(filteredReports.map(r => r.studentName)).size}</div>
                            </div>
                        </div>

                        {filteredReports.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                                <Icon name="FileX" className="mx-auto text-slate-300 mb-4" size={48} />
                                <p className="text-slate-500 font-medium">검색 조건에 맞는 리포트가 없습니다.</p>
                            </div>
                        ) : (
                            gradeOrder.concat(Object.keys(groupedReports).filter(k => !gradeOrder.includes(k))).map(grade => {
                                const gradeReports = groupedReports[grade];
                                if (!gradeReports || gradeReports.length === 0) return null;

                                return (
                                    <div key={grade} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
                                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                                <span className="w-2 h-8 bg-amber-500 rounded-sm inline-block mr-1"></span>
                                                {grade}
                                                <span className="text-slate-400 text-sm font-normal ml-2">({gradeReports.length})</span>
                                            </h3>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {gradeReports.map(report => (
                                                <div key={report.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row items-center gap-4">
                                                    <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-12 gap-4 items-center w-full">
                                                        <div className="col-span-1 md:col-span-2">
                                                            <div className="text-sm text-slate-500 mb-0.5">{report.createdAt?.toDate().toLocaleDateString()}</div>
                                                            <div className="text-xs text-slate-400">{report.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        </div>
                                                        <div className="col-span-1 md:col-span-2">
                                                            <div className="font-bold text-slate-900 text-lg">{report.studentName}</div>
                                                        </div>
                                                        <div className="col-span-2 md:col-span-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-600">{report.className}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-400 mt-1 truncate">{report.courseName}</div>
                                                        </div>
                                                        <div className="col-span-2 md:col-span-2">
                                                            <div className="text-sm font-medium text-slate-900">{report.teacherName}</div>
                                                            <div className="flex gap-1 flex-wrap">
                                                                <div className="text-xs text-amber-600 font-bold uppercase">{report.centerName}</div>
                                                                {report.department && (
                                                                    <div className="text-xs text-indigo-600 font-bold uppercase">({report.department})</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 md:col-span-4">
                                                            <div className="text-sm text-slate-700 font-medium truncate">{report.reportData?.report_info?.topic}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0 w-full md:w-auto flex justify-end gap-2">
                                                        <button
                                                            onClick={() => window.open(`${window.location.origin}/report/${report.id}`, '_blank')}
                                                            className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2.5 rounded-lg hover:bg-amber-100 transition-colors font-bold text-sm"
                                                        >
                                                            <Icon name="Link" size={14} />
                                                            <span className="break-keep">View Report</span>
                                                        </button>
                                                        {(viewMode === 'admin' || report.teacherName === userData?.displayName) && (
                                                            <button
                                                                onClick={() => handleDeleteReport(report.id)}
                                                                className="flex items-center gap-2 bg-white text-red-500 px-3 py-2.5 rounded-lg hover:bg-red-50 border border-red-200 transition-colors font-bold text-sm shadow-sm"
                                                                title="리포트 삭제"
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
        </div>
    );
}
