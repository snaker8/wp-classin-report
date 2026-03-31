'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
        <div className="min-h-screen bg-background flex overflow-hidden font-sans text-foreground">
            {/* Left Side: Brand Vibe */}
            <div className="hidden lg:flex w-1/2 relative items-center justify-center p-12">
                <div className="relative z-10 text-center w-full max-w-lg">
                    <div className="mb-4 text-left select-none flex flex-col items-start pl-8">
                        {/* Text 'WP 과사람' - Refined Luxury Style */}
                        <div className="flex items-baseline gap-4 mb-3">
                            <span className="font-serif text-6xl tracking-widest text-[#2a2a2a]">
                                WP
                            </span>
                            <span className="font-serif text-[42px] tracking-[0.1em] text-[#2a2a2a] ml-1">
                                과사람
                            </span>
                        </div>

                        <p className="text-[#3a3a3a]/90 font-medium text-[13.5px] tracking-wide leading-relaxed pl-1">
                            의학·이공계 최상위 입시를 위한 프리미엄 학습 분석 시스템
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative bg-background">
                <div className="w-full max-w-[380px] relative z-10">
                    {/* Card - Frosted Glass Luxury */}
                    <div className="bg-[#f0ece5]/30 backdrop-blur-2xl border border-white/60 rounded-[28px] p-10 pt-12 pb-14 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
                        <div className="mb-12 text-center">
                            <h1 className="text-[32px] font-serif font-light text-[#2a2a2a] tracking-wide">Sign In</h1>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-6">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pb-2.5 bg-transparent border-b border-[#2a2a2a]/20 text-[#2a2a2a] font-light focus:outline-none focus:border-[#2a2a2a]/40 transition-all placeholder:text-[#2a2a2a]/40 text-sm"
                                    placeholder="Email"
                                />
                                <div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pb-2.5 bg-transparent border-b border-[#2a2a2a]/20 text-[#2a2a2a] font-light focus:outline-none focus:border-[#2a2a2a]/40 transition-all placeholder:text-[#2a2a2a]/40 text-sm"
                                        placeholder="Password"
                                    />
                                    <div className="text-right pt-2.5">
                                        <a href="#" className="text-[12.5px] text-[#2a2a2a]/60 hover:text-[#2a2a2a] transition-colors">Forgot Password?</a>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50/50 backdrop-blur-sm rounded-lg flex items-center gap-2 text-red-800 text-xs font-medium mt-4">
                                    <Icon name="AlertCircle" size={14} className="text-red-500" />
                                    {error}
                                </div>
                            )}

                            <div className="pt-6">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-b from-[#e5e5e5] to-[#d4d4d4] hover:from-[#d4d4d4] hover:to-[#c4c4c4] text-[#2a2a2a]/80 font-medium py-3 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_4px_rgba(0,0,0,0.05)] border border-white/40 transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm tracking-wide"
                                >
                                    {loading && <Icon name="Loader2" size={14} className="animate-spin" />}
                                    로그인
                                </button>
                            </div>

                            <div className="pt-6 text-center">
                                <p className="text-[14px] text-[#2a2a2a]/75 tracking-wide">
                                    계정이 없으신가요?{' '}
                                    <Link 
                                        href="/signup" 
                                        className="text-[#2a2a2a]/80 hover:text-[#2a2a2a] font-medium transition-colors border-b border-[#2a2a2a]/20 hover:border-[#2a2a2a]/60 pb-0.5"
                                    >
                                        회원가입
                                    </Link>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

