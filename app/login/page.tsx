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
        <div className="min-h-screen bg-slate-900 flex overflow-hidden font-sans">
            {/* Left Side: Background / Brand Vibe (Visible on large screens) */}
            <div className="hidden lg:flex w-1/2 relative bg-slate-800 items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/30"></div>
                {/* Abstract Decoration */}
                <div className="absolute w-[800px] h-[800px] bg-slate-700/20 rounded-full blur-3xl -top-20 -left-20"></div>
                <div className="absolute w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-3xl bottom-0 right-0"></div>

                <div className="relative z-10 p-12 text-center">
                    <div className="mb-12 text-center select-none flex flex-col items-center">
                        <div className="flex items-center justify-center mb-6 relative">
                            {/* Text 'WP 과사람' - Enhanced Premium Style */}
                            <div className="flex items-baseline gap-3 relative z-10 p-2">
                                <span className="font-black text-7xl italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-white drop-shadow-[0_0_15px_rgba(56,189,248,0.5)] transform -skew-x-6 pr-4" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                    WP
                                </span>
                                <span className="font-black text-6xl tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-sky-100 via-cyan-200 to-white drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                                    과사람
                                </span>
                            </div>

                            {/* Subtle Glow Behind Text */}
                            <div className="absolute inset-0 bg-cyan-500/20 blur-3xl -z-10 rounded-full scale-150 opacity-30"></div>
                        </div>

                        <p className="text-slate-300 font-bold text-sm tracking-wide mt-2 opacity-80 leading-relaxed pt-6 border-t border-slate-700/30 w-full max-w-xs mx-auto">
                            의학·이공계 최상위 입시를 위한<br />
                            프리미엄 학습 분석 시스템
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative bg-slate-50">
                {/* Subtle pattern background for right side */}
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

                <div className="w-full max-w-md relative z-10">
                    {/* Graduation Cap Section - Swapped to Right */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-amber-500/20 transition-transform duration-500">
                            <Icon name="GraduationCap" size={40} className="text-white" />
                        </div>
                    </div>

                    {/* Card */}
                    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-200/50">
                        <div className="mb-6">
                            <h1 className="text-xl font-bold text-slate-800 mb-1">Teacher Login</h1>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-300 text-sm"
                                    placeholder="teacher@example.com"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-300 text-sm"
                                    placeholder="******"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-xs animate-pulse">
                                    <Icon name="AlertCircle" size={14} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-lg shadow-slate-900/10 transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 text-sm"
                            >
                                {loading && <Icon name="Loader2" size={16} className="animate-spin" />}
                                로그인
                            </button>
                        </form>

                        <div className="flex items-center justify-between text-[10px] mt-6 pt-6 border-t border-slate-100">
                            <span className="text-slate-400">계정이 없으신가요?</span>
                            <a href="/signup" className="text-amber-600 font-bold hover:text-amber-700 hover:underline">회원가입 하기</a>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-[10px] text-slate-400 font-medium opacity-60">
                        © 2024 Nano Banana. All rights reserved.
                    </div>
                </div>
            </div>
        </div>
    );
}
