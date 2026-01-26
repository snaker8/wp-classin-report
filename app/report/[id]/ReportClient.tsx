'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ReportView, ReportData } from '@/components/report/ReportView';
import { Icon } from '@/components/ui/Icon';

export default function ReportClient({ id }: { id: string }) {
    // const params = useParams(); // id is passed from server component
    // const id = params?.id as string;
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [metaData, setMetaData] = useState<{
        studentName: string;
        className: string;
        courseName: string;
        images: string[];
        htmlReportUrl?: string; // New field
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
                    console.log('Fetched report data:', {
                        imageUrls: data.imageUrls,
                        imageUrl: data.imageUrl,
                        hasImageUrls: Array.isArray(data.imageUrls) && data.imageUrls.length > 0
                    });
                    setReportData(data.reportData as ReportData);

                    // Handle empty arrays properly - use imageUrls only if it has items
                    let images: string[] = [];
                    if (Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
                        images = data.imageUrls;
                    } else if (data.imageUrl) {
                        images = [data.imageUrl];
                    }

                    setMetaData({
                        studentName: data.studentName,
                        className: data.className,
                        courseName: data.courseName,
                        images,
                        htmlReportUrl: data.htmlReportUrl // Extract new field
                    });
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

    // NEW: Redirect directly to the static HTML file for perfect fidelity
    useEffect(() => {
        if (metaData?.htmlReportUrl) {
            window.location.replace(metaData.htmlReportUrl);
        }
    }, [metaData?.htmlReportUrl]);

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

    // Show loading spinner while redirecting if htmlUrl exists
    if (metaData?.htmlReportUrl) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <Icon name="Loader2" size={32} className="animate-spin mb-2 mx-auto text-slate-400" />
                    <p className="text-slate-500 text-sm">리포트 원본을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
                <div className="text-center text-slate-500">
                    <Icon name="AlertCircle" size={48} className="mx-auto text-amber-500 mb-4" />
                    <p className="text-lg font-bold text-slate-800">{error || '유효하지 않은 리포트입니다.'}</p>
                    <p className="text-sm mt-2">존재하지 않거나 삭제된 리포트일 수 있습니다.</p>
                </div>
            </div>
        );
    }

    // Fallback: Legacy Rendering (for old reports)
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
