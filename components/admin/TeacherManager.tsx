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
        <div className="space-y-8 animate-fade-in py-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-foreground/5 pb-6">
                <h2 className="text-xl md:text-2xl font-serif font-light tracking-[0.1em] uppercase text-foreground flex items-center gap-3">
                    <Icon name="Users" className="text-foreground/40" size={20} />
                    Teacher Management
                </h2>
                <div className="relative w-full md:w-72">
                    <Icon name="Search" className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" size={16} />
                    <input
                        type="text"
                        placeholder="Search names, emails..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white/50 border-b border-foreground/10 focus:bg-white/80 focus:border-foreground/30 outline-none text-sm transition-all text-foreground rounded-t-xl"
                    />
                </div>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.02)] border border-white/60 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white/30 text-foreground/40 uppercase font-medium tracking-[0.2em] text-[10px] border-b border-foreground/5">
                            <tr>
                                <th className="px-8 py-4 font-medium">Name / Email</th>
                                <th className="px-8 py-4 font-medium">Center / Dept</th>
                                <th className="px-8 py-4 font-medium">Role</th>
                                <th className="px-8 py-4 text-right font-medium">Manage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            {filteredTeachers.map(teacher => (
                                <tr key={teacher.id} className="hover:bg-white/60 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="font-serif text-lg text-foreground mb-1">{teacher.displayName || 'No Name'}</div>
                                        <div className="text-foreground/40 text-xs font-mono">{teacher.email}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="font-medium text-foreground/80 tracking-wide text-sm">{teacher.centerName || '-'}</div>
                                        {teacher.department && <div className="text-foreground/50 text-[10px] uppercase tracking-widest mt-1">{teacher.department}</div>}
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-widest font-medium border border-current ${getRoleBadge(teacher.role)}`}>
                                            {getRoleLabel(teacher.role)}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button
                                            onClick={() => handleEditClick(teacher)}
                                            className="text-foreground/40 hover:text-foreground transition-all p-2 bg-white/50 rounded-xl hover:bg-white border border-transparent hover:border-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-sm"
                                            title="Edit"
                                        >
                                            <Icon name="Edit" size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredTeachers.length === 0 && (
                    <div className="p-16 text-center text-foreground/40 font-light tracking-wide text-sm">
                        No teachers found.
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingTeacher && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_16px_64px_rgba(0,0,0,0.1)] border border-white max-w-lg w-full p-8 space-y-8 animate-scale-in">
                        <div className="flex justify-between items-center border-b border-foreground/10 pb-4">
                            <h3 className="text-lg font-serif font-light text-foreground flex items-center gap-2">
                                <span className="opacity-50">Edit User:</span> {editingTeacher.displayName}
                            </h3>
                            <button onClick={() => setEditingTeacher(null)} className="text-foreground/40 hover:text-foreground transition-all p-2 rounded-full hover:bg-white/50">
                                <Icon name="X" size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2 relative group">
                                <label className="block text-[10px] font-medium text-foreground/50 uppercase tracking-[0.2em] transition-colors group-focus-within:text-foreground">센터명 (Center Name)</label>
                                <input
                                    type="text"
                                    value={editCenter}
                                    onChange={(e) => setEditCenter(e.target.value)}
                                    className="w-full px-2 py-2 bg-transparent border-b border-foreground/20 text-foreground font-light focus:outline-none focus:border-foreground transition-all text-sm"
                                    placeholder="Enter center name"
                                />
                            </div>
                            <div className="space-y-2 relative group">
                                <label className="block text-[10px] font-medium text-foreground/50 uppercase tracking-[0.2em] transition-colors group-focus-within:text-foreground">부서명 (Department)</label>
                                <input
                                    type="text"
                                    value={editDept}
                                    onChange={(e) => setEditDept(e.target.value)}
                                    className="w-full px-2 py-2 bg-transparent border-b border-foreground/20 text-foreground font-light focus:outline-none focus:border-foreground transition-all text-sm"
                                    placeholder="Enter department name"
                                />
                            </div>
                            <div className="pt-4">
                                <label className="block text-[10px] font-medium text-foreground/50 uppercase tracking-[0.2em] mb-4">권한 (System Role)</label>
                                <div className="space-y-3">
                                    {[
                                        { id: 'teacher', label: 'Teacher', desc: 'Manage own reports only', colorClass: 'text-foreground' },
                                        { id: 'dept_admin', label: 'Department Admin', desc: 'Manage dept teachers & reports', colorClass: 'text-green-600' },
                                        { id: 'center_admin', label: 'Center Admin', desc: 'Manage center teachers & reports', colorClass: 'text-blue-600' },
                                        { id: 'super_admin', label: 'Super Admin', desc: 'System-wide full access', colorClass: 'text-purple-600' }
                                    ].map(role => (
                                        <label key={role.id} className={`flex items-start gap-3 cursor-pointer p-3 rounded-2xl border transition-all ${editRole === role.id || (role.id === 'super_admin' && editRole === 'admin') ? 'bg-white/60 border-foreground/20 shadow-sm' : 'border-transparent hover:bg-white/30'}`}>
                                            <input
                                                type="radio"
                                                name="role"
                                                checked={editRole === role.id || (role.id === 'super_admin' && editRole === 'admin')}
                                                onChange={() => setEditRole(role.id as Teacher['role'])}
                                                className="mt-1 accent-foreground"
                                            />
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-medium tracking-wide ${role.colorClass}`}>{role.label}</span>
                                                <span className="text-[11px] text-foreground/40 font-light mt-0.5">{role.desc}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-foreground/5 mt-8">
                            <button onClick={() => setEditingTeacher(null)} className="px-6 py-2.5 text-xs tracking-widest uppercase text-foreground/60 border border-transparent hover:border-foreground/10 hover:bg-white/50 rounded-xl transition-all font-medium">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2.5 bg-foreground text-background/90 text-xs tracking-widest uppercase font-medium rounded-xl hover:bg-foreground/90 transition-all disabled:opacity-50 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
