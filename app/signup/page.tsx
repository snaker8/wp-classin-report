'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [centerName, setCenterName] = useState('');
    const [department, setDepartment] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Update Profile (DisplayName)
            await updateProfile(user, { displayName: name });

            // 3. Save to Firestore (Teachers Collection)
            await setDoc(doc(db, 'teachers', user.uid), {
                email: email,
                displayName: name,
                centerName: centerName,
                department: department,
                role: 'teacher', // Default role
                createdAt: new Date().toISOString()
            });

            // 4. Redirect
            router.push('/');
        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto text-white mb-4">
                        <Icon name="GraduationCap" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 font-serif">선생님 회원가입</h1>
                    <p className="text-slate-500 text-sm">리포트 관리를 위한 계정을 생성하세요</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">이름</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded focus:border-amber-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                            placeholder="성함 (예: 김선생)"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">지점명 (센터)</label>
                            <input
                                type="text"
                                required
                                value={centerName}
                                onChange={(e) => setCenterName(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded focus:border-amber-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                                placeholder="예: 대치 본원"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">소속 (관)</label>
                            <input
                                type="text"
                                required
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded focus:border-amber-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                                placeholder="예: 의대관"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">이메일</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded focus:border-amber-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                            placeholder="teacher@example.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">비밀번호</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded focus:border-amber-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                            placeholder="6자리 이상 입력"
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading && <Icon name="Loader2" size={16} className="animate-spin" />}
                        계정 생성
                    </button>
                </form>

                <div className="text-center text-sm text-slate-500">
                    이미 계정이 있으신가요? <a href="/login" className="text-amber-600 hover:underline">로그인</a>
                </div>
            </div>
        </div>
    );
}
