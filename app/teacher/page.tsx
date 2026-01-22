'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardCore from '@/components/dashboard/DashboardCore';
import { Icon } from '@/components/ui/Icon';

export default function TeacherPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            }
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Icon name="Loader2" size={32} className="animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user) return null;

    return <DashboardCore viewMode="teacher" />;
}
