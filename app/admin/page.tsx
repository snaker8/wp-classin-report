'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardCore from '@/components/dashboard/DashboardCore';
import { ALLOWED_ADMINS } from '@/lib/admins';
import { Icon } from '@/components/ui/Icon';

export default function AdminPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
                return;
            }

            // Check if user is in the ALLOWED_ADMINS list
            console.log("Current User Email:", user.email);
            console.log("Allowed Admins:", ALLOWED_ADMINS);

            if (user.email && ALLOWED_ADMINS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
                setAuthorized(true);
            } else {
                setAuthorized(false);
            }
            setChecking(false);
        }
    }, [user, loading, router]);

    if (loading || checking) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Icon name="Loader2" size={32} className="animate-spin text-slate-400" />
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 max-w-md w-full text-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                        <Icon name="ShieldAlert" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">접속 권한이 없습니다</h1>
                    <p className="text-slate-500">
                        관리자 페이지만 지정된 계정으로 접속할 수 있습니다.<br />
                        선생님 계정이라면 <b>[내 강의실]</b>로 이동해주세요.
                    </p>
                    <button
                        onClick={() => router.push('/teacher')}
                        className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors"
                    >
                        내 강의실(Teacher Dashboard)로 이동
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full bg-white text-slate-700 border border-slate-300 py-3 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                    >
                        메인으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return <DashboardCore viewMode="admin" />;
}
