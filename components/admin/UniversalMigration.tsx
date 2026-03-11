'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Icon } from '@/components/ui/Icon';

export default function UniversalMigration() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [sourceCenter, setSourceCenter] = useState('');
    const [targetCenter, setTargetCenter] = useState('');
    const [, setUpdated] = useState(0);

    const runMigration = async () => {
        if (!sourceCenter.trim() || !targetCenter.trim()) {
            alert('기존 센터 이름과 변경할 센터 이름을 모두 입력해주세요.');
            return;
        }

        if (sourceCenter === targetCenter) {
            alert('기존 이름과 변경할 이름이 동일합니다.');
            return;
        }

        if (!confirm(`정말로 "${sourceCenter}" 데이터를 "${targetCenter}"로 통합하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

        setLoading(true);
        setStatus('데이터 스캔 중...');
        setUpdated(0);

        try {
            const batchLimit = 450; // Firestore batch limit is 500
            let totalUpdated = 0;

            // 1. Migrate Reports
            setStatus(`${sourceCenter} 리포트 데이터 검색 중...`);
            const reportsRef = collection(db, 'reports');
            const qReports = query(reportsRef, where('centerName', '==', sourceCenter.trim()));
            const reportSnaps = await getDocs(qReports);

            setStatus(`리포트 ${reportSnaps.size}개 발견. 업데이트 준비 중...`);

            const reportChunks = chunkArray(reportSnaps.docs, batchLimit);
            for (const chunk of reportChunks) {
                const batch = writeBatch(db);
                chunk.forEach(snap => {
                    batch.update(snap.ref, { centerName: targetCenter.trim() });
                });
                await batch.commit();
                totalUpdated += chunk.length;
                setUpdated(totalUpdated);
                setStatus(`리포트 ${totalUpdated}개 업데이트 완료...`);
            }

            // 2. Migrate Users (Teachers)
            setStatus(`${sourceCenter} 사용자 데이터 검색 중...`);
            const usersRef = collection(db, 'teachers');
            const qUsers = query(usersRef, where('centerName', '==', sourceCenter.trim()));
            const userSnaps = await getDocs(qUsers);

            setStatus(`사용자 ${userSnaps.size}명 발견. 업데이트 준비 중...`);

            const userChunks = chunkArray(userSnaps.docs, batchLimit);
            for (const chunk of userChunks) {
                const batch = writeBatch(db);
                chunk.forEach(snap => {
                    batch.update(snap.ref, { centerName: targetCenter.trim() });
                });
                await batch.commit();
                totalUpdated += chunk.length;
                setUpdated(totalUpdated);
                setStatus(`총 ${totalUpdated}개 문서 업데이트 완료...`);
            }

            setStatus(`모든 작업 완료! 총 ${totalUpdated}개의 데이터가 "${targetCenter}"로 통합되었습니다.`);
            alert('데이터 통합이 완료되었습니다.');

        } catch (error) {
            console.error(error);
            setStatus(`오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
        }
    };

    function chunkArray<T>(array: T[], size: number): T[][] {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    }

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 mb-2">
                <Icon name="Database" size={20} className="text-amber-500" />
                <h3 className="font-bold text-lg">데이터 통합 도구 (Center Migration)</h3>
            </div>

            <p className="text-sm text-slate-500 bg-white p-3 rounded-lg border border-slate-100">
                특정 센터 이름을 다른 이름으로 일괄 변경합니다.
                <br />
                <span className="text-red-500 font-bold font-serif">* 주의:</span> 이 작업은 리포트(reports)와 사용자(teachers) 컬렉션의 모든 해당 데이터를 즉시 수정하며 복구할 수 없습니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        Source Center (기존 이름)
                        <Icon name="Search" size={12} />
                    </label>
                    <input
                        type="text"
                        value={sourceCenter}
                        onChange={(e) => setSourceCenter(e.target.value)}
                        placeholder="예: 동래센터"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-amber-500 outline-none text-sm transition-all shadow-sm"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        Target Center (변경할 이름)
                        <Icon name="ArrowRight" size={12} />
                    </label>
                    <input
                        type="text"
                        value={targetCenter}
                        onChange={(e) => setTargetCenter(e.target.value)}
                        placeholder="예: 동래"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-amber-500 outline-none text-sm transition-all shadow-sm"
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <button
                    onClick={runMigration}
                    disabled={loading || !sourceCenter || !targetCenter}
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all shadow-md active:scale-95 ${loading || !sourceCenter || !targetCenter
                            ? 'bg-slate-300 cursor-not-allowed shadow-none'
                            : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Icon name="Loader2" size={16} className="animate-spin" />
                            업데이트 진행 중...
                        </span>
                    ) : (
                        '데이터 통합 실행'
                    )}
                </button>
                {status && (
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full animate-pulse">
                        <Icon name="Info" size={14} />
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
