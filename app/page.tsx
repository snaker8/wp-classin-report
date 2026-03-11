'use client';

import { useAuth } from "@/contexts/AuthContext";
import ReportGenerator from "@/components/report/ReportGenerator";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Allow up to 5 minutes for Pro mode analysis (Server Action timeout)
export const maxDuration = 300;

export default function Home() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-amber-100/50">
      {/* Header - Navy Blue Luxury */}
      <header className="sticky top-0 z-20 print:hidden bg-[#0A1128] text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-lg font-serif tracking-[0.1em] leading-tight uppercase text-white/90">
                {userData?.centerName || '동래'} MATHEMATICS EDUCATION
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.1em] text-white/80 font-medium">
            {userData?.role === 'admin' ? (
              <Link href="/admin" className="hover:text-white transition-colors opacity-70 hover:opacity-100 tracking-widest">
                ADMIN
              </Link>
            ) : (
              <span className="opacity-70 tracking-widest">TEACHER</span>
            )}
            <span className="text-white/20">|</span>
            <button
              onClick={handleLogout}
              className="hover:text-white transition-colors opacity-70 hover:opacity-100"
              title="로그아웃"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <ReportGenerator />
      </main>
    </div>
  );
}
