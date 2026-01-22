'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push('/');
        } catch (err: unknown) {
            console.error(err);
            setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
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
                    <h1 className="text-2xl font-bold text-slate-900 font-serif">선생님 로그인</h1>
                    <p className="text-slate-500 text-sm">프리미엄 리포트 시스템 접속</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
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
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded focus:border-amber-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                            placeholder="******"
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading && <Icon name="Loader2" size={16} className="animate-spin" />}
                        로그인
                    </button>
                </form>

                <div className="text-center text-sm text-slate-500">
                    계정이 필요하신가요? <a href="/signup" className="text-amber-600 hover:underline">회원가입</a>
                </div>
            </div>
        </div>
    );
}
