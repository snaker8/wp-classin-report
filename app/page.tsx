'use client';

import { useAuth } from "@/contexts/AuthContext";
import ReportGenerator from "@/components/report/ReportGenerator";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

export default function Home() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) return null; // Will redirect

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-slate-800 font-sans selection:bg-amber-100">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20 print:hidden">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-sm flex items-center justify-center shadow-lg">
              <Icon name="GraduationCap" className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-serif font-bold tracking-wide text-amber-50 leading-tight">
                {userData?.centerName || '과사람 의대관'}
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">
                {userData?.centerName ? `${userData.centerName} Mathematics Education` : 'Premium Mathematics Education'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs tracking-wide text-slate-300">
            <a href={userData?.role === 'teacher' ? "/teacher" : "/admin"} className="hover:text-amber-500 transition-colors">
              {userData?.role === 'teacher' ? '내 리포트 관리' : '관리자'}
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <ReportGenerator />
      </main>
    </div>
  );
}
