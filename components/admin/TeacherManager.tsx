'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { Icon } from '@/components/ui/Icon';

interface Teacher {
    id: string;
    email: string;
    displayName: string;
    centerName: string;
    department?: string;
    role?: 'super_admin' | 'center_admin' | 'dept_admin' | 'teacher' | 'admin';
    createdAt?: string;
}

export default function TeacherManager() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

    // Edit Form State
    const [editCenter, setEditCenter] = useState('');
    const [editDept, setEditDept] = useState('');
    const [editRole, setEditRole] = useState<Teacher['role']>('teacher');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'teachers'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const teacherList: Teacher[] = [];
            snapshot.forEach(doc => {
                teacherList.push({ id: doc.id, ...doc.data() } as Teacher);
            });
            setTeachers(teacherList);
        } catch (error) {
            console.error("Error fetching teachers:", error);
            // Fallback if index missing or error
            try {
                const snapshot = await getDocs(collection(db, 'teachers'));
                const teacherList: Teacher[] = [];
                snapshot.forEach(doc => {
                    teacherList.push({ id: doc.id, ...doc.data() } as Teacher);
                });
                setTeachers(teacherList);
            } catch (e) {
                console.error("Fallback error:", e);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (teacher: Teacher) => {
        setEditingTeacher(teacher);
        setEditCenter(teacher.centerName || '');
        setEditDept(teacher.department || '');
        setEditRole(teacher.role || 'teacher');
    };

    const handleSave = async () => {
        if (!editingTeacher) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'teachers', editingTeacher.id), {
                centerName: editCenter,
                department: editDept,
                role: editRole
            });

            // Update local state
            setTeachers(prev => prev.map(t =>
                t.id === editingTeacher.id
                    ? { ...t, centerName: editCenter, department: editDept, role: editRole }
                    : t
            ));

            setEditingTeacher(null);
            alert('정보가 수정되었습니다.');
        } catch (error) {
            console.error("Error updating teacher:", error);
            alert('수정 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    // Filter logic
    const filteredTeachers = teachers.filter(t =>
        (t.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (t.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (t.centerName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const getRoleBadge = (role?: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-700';
            case 'super_admin': return 'bg-purple-100 text-purple-700 font-black';
            case 'center_admin': return 'bg-blue-100 text-blue-700';
            case 'dept_admin': return 'bg-green-100 text-green-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const getRoleLabel = (role?: string) => {
        switch (role) {
            case 'admin': return 'ADMIN (Legacy)';
            case 'super_admin': return 'SUPER ADMIN';
            case 'center_admin': return 'CENTER ADMIN';
            case 'dept_admin': return 'DEPT ADMIN';
            default: return 'TEACHER';
        }
    };

    if (loading) return <div className="p-8 text-center"><Icon name="Loader2" className="animate-spin mx-auto" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Icon name="Users" className="text-indigo-600" />
                    선생님 & 센터 관리
                </h2>
                <div className="relative w-full md:w-64">
                    <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="이름, 이메일, 센터 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-3">이름 / 이메일</th>
                                <th className="px-6 py-3">센터 / 부서</th>
                                <th className="px-6 py-3">권한 (Role)</th>
                                <th className="px-6 py-3 text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTeachers.map(teacher => (
                                <tr key={teacher.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{teacher.displayName || 'No Name'}</div>
                                        <div className="text-slate-500 text-xs">{teacher.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-800">{teacher.centerName || '-'}</div>
                                        {teacher.department && <div className="text-indigo-600 text-xs font-bold">{teacher.department}</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getRoleBadge(teacher.role)}`}>
                                            {getRoleLabel(teacher.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleEditClick(teacher)}
                                            className="text-slate-600 hover:text-indigo-600 transition-colors p-2 bg-slate-100 rounded-full hover:bg-indigo-50"
                                            title="수정"
                                        >
                                            <Icon name="Edit" size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredTeachers.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingTeacher && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold text-slate-900">정보 수정: {editingTeacher.displayName}</h3>
                            <button onClick={() => setEditingTeacher(null)}><Icon name="X" className="text-slate-400" /></button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">센터명 (Center)</label>
                                <input
                                    type="text"
                                    value={editCenter}
                                    onChange={(e) => setEditCenter(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">부서 (Department)</label>
                                <input
                                    type="text"
                                    value={editDept}
                                    onChange={(e) => setEditDept(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">권한 (Role)</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                                        <input
                                            type="radio"
                                            name="role"
                                            checked={editRole === 'teacher'}
                                            onChange={() => setEditRole('teacher')}
                                            className="text-slate-600"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">Teacher</span>
                                            <span className="text-[10px] text-slate-400">일반 선생님 (본인 리포트만 관리)</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-green-50 rounded border border-transparent hover:border-green-100">
                                        <input
                                            type="radio"
                                            name="role"
                                            checked={editRole === 'dept_admin'}
                                            onChange={() => setEditRole('dept_admin')}
                                            className="text-green-600"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-green-700">Department Admin (관/부서 관리자)</span>
                                            <span className="text-[10px] text-slate-400">해당 센터의 특정 부서(관) 선생님/리포트 관리</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-blue-50 rounded border border-transparent hover:border-blue-100">
                                        <input
                                            type="radio"
                                            name="role"
                                            checked={editRole === 'center_admin'}
                                            onChange={() => setEditRole('center_admin')}
                                            className="text-blue-600"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-blue-700">Center Admin (센터 관리자)</span>
                                            <span className="text-[10px] text-slate-400">해당 센터 전체의 선생님/리포트 관리</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-purple-50 rounded border border-transparent hover:border-purple-100">
                                        <input
                                            type="radio"
                                            name="role"
                                            checked={editRole === 'super_admin' || editRole === 'admin'}
                                            onChange={() => setEditRole('super_admin')}
                                            className="text-purple-600"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-purple-700">Super Admin (전체 관리자)</span>
                                            <span className="text-[10px] text-slate-400">모든 센터 및 시스템 전체 관리</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
                            <button onClick={() => setEditingTeacher(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded">취소</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? '저장 중...' : '저장하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
