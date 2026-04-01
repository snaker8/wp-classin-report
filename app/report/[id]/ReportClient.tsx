'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ReportView, ReportData } from '@/components/report/ReportView';
import { Icon } from '@/components/ui/Icon';

export default function ReportClient({ id }: { id: string }) {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [metaData, setMetaData] = useState<{
        studentName: string;
        className: string;
        courseName: string;
        images: string[];
        captureId?: string;
        htmlReportUrl?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEnhancedMode, setIsEnhancedMode] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                if (!id) return;
                const docRef = doc(db, 'reports', id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setReportData(data.reportData as ReportData);

                    let images: string[] = [];

                    // Try imageUrls / imageUrl first (fast, small data)
                    if (Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
                        images = data.imageUrls;
                    } else if (data.imageUrl && data.imageUrl !== '') {
                        images = [data.imageUrl];
                    }

                    setMetaData({
                        studentName: data.studentName,
                        className: data.className,
                        courseName: data.courseName,
                        images,
                        captureId: data.captureId || '',
                        htmlReportUrl: data.htmlReportUrl || '',
                    });

                    // If captureId exists and no images yet, load from captures sub-collection (lazy)
                    if (data.captureId && images.length === 0) {
                        try {
                            const imagesRef = collection(db, 'captures', data.captureId, 'images');
                            const q = query(imagesRef, orderBy('page'));
                            const snap = await getDocs(q);
                            const captureImages = snap.docs.map(d => `data:image/jpeg;base64,${d.data().base64}`);
                            if (captureImages.length > 0) {
                                setMetaData(prev => prev ? { ...prev, images: captureImages } : prev);
                            }
                        } catch (e) {
                            console.warn('Failed to load capture images:', e);
                        }
                    }
                } else {
                    setError('리포트를 찾을 수 없습니다.');
                }
            } catch (err) {
                console.error(err);
                setError('리포트를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchReport();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
                <div className="text-center text-slate-400">
                    <Icon name="Loader2" size={32} className="animate-spin mb-2 mx-auto" />
                    <p>리포트를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
                <div className="text-center text-slate-500">
                    <Icon name="AlertCircle" size={48} className="mx-auto text-amber-500 mb-4" />
                    <p className="text-lg font-bold text-slate-800">{error}</p>
                    <p className="text-sm mt-2">존재하지 않거나 삭제된 리포트일 수 있습니다.</p>
                </div>
            </div>
        );
    }

    // If no report data and no images, redirect to HTML as last resort
    if (!reportData && metaData?.htmlReportUrl) {
        window.location.replace(metaData.htmlReportUrl);
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Icon name="Loader2" size={32} className="animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F5F0] py-8 px-4 font-sans print:bg-white print:p-0">
            <ReportView
                studentName={metaData?.studentName || ''}
                className={metaData?.className || ''}
                courseName={metaData?.courseName || ''}
                reportData={reportData!}
                images={metaData?.images || []}
                isEnhancedMode={isEnhancedMode}
                setIsEnhancedMode={setIsEnhancedMode}
                reportId={id}
                readOnly={true}
            />
        </div>
    );
}
