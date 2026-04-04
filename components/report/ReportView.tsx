'use client';

import { Icon } from '@/components/ui/Icon';
import { useState, useEffect, useCallback } from 'react';
import { MathText } from '@/components/ui/MathText';

export interface ReportData {
    report_info: {
        report_title: string;
        sub_title: string;
        topic: string;
    };
    analysis_data: {
        learning_progress: string;
        growth_points: Array<{ evidence: string; praise_comment: string }>;
        improvement_suggestions: string;
    };
    parent_guide: {
        opening_ment: string;
        encouragement_tips: string[];
    };
}

interface ReportViewProps {
    studentName: string;
    className: string;
    courseName: string;
    reportData: ReportData;
    images: string[];
    isEnhancedMode: boolean;
    setIsEnhancedMode: (v: boolean) => void;
    onReset?: () => void;
    reportId?: string | null;
    saving?: boolean;
    saveError?: string | null;
    readOnly?: boolean;
}

export const ReportView = ({
    studentName, className, courseName, reportData, images,
    isEnhancedMode, setIsEnhancedMode, onReset, reportId,
    saving, saveError, readOnly = false
}: ReportViewProps) => {
    const [copied, setCopied] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // Keyboard navigation for lightbox
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (lightboxIndex === null) return;
        if (e.key === 'ArrowRight' && lightboxIndex < images.length - 1) setLightboxIndex(lightboxIndex + 1);
        if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
        if (e.key === 'Escape') setLightboxIndex(null);
    }, [lightboxIndex, images.length]);

    useEffect(() => {
        if (lightboxIndex !== null) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [lightboxIndex, handleKeyDown]);

    const handleCopyLink = () => {
        if (!reportId) return;
        const url = `${window.location.origin}/report/${reportId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadHtmlReport = async () => {
        if (!reportData) return;

        // Helper to convert image URL to Base64
        const imageUrlToBase64 = async (url: string): Promise<string> => {
            try {
                const response = await fetch(url, { mode: 'cors' });
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.warn('Failed to convert image to base64:', url, error);
                return url; // Fallback to original URL if fetch fails
            }
        };

        // Convert all images to Base64
        const base64Images = await Promise.all(images.map(img => imageUrlToBase64(img)));

        const tailwindScriptTag = '<script src="https://cdn.tailwindcss.com"><' + '/script>';

        const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>학습 리포트 - ${studentName}</title>
    ${tailwindScriptTag}
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Pretendard:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" integrity="sha384-XjKyQNRlToSoW462lSSzOu3vozwEurozAfagCO4vwjW+5BzQAj9B/UZglWB5XibG" crossorigin="anonymous"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous" onload="renderMathInElement(document.body);"></script>
    <style>
        body { font-family: 'Pretendard', sans-serif; }
        .font-serif { font-family: 'Noto Serif KR', serif; }
        @media print { .no-print { display: none !important; } }
    </style>
</head>
<body class="bg-[#F4F3F0] text-[#2C2C2A] p-8 md:p-16 max-w-4xl mx-auto">
    <!-- Content similar to the preview -->
    <div class="border-b border-[#2C2C2A]/20 pb-6 mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
             <div class="flex flex-wrap gap-2 mb-2 text-xs font-bold tracking-wider text-[#A68B5C] uppercase">
                ${className ? `<span class="bg-[#2C2C2A]/5 border border-[#2C2C2A]/10 px-2 py-1 rounded">${className}</span>` : ''}
                ${courseName ? `<span class="bg-[#A68B5C]/10 text-[#A68B5C] px-2 py-1 rounded">${courseName}</span>` : ''}
            </div>
            <h2 class="text-3xl md:text-4xl font-serif font-light tracking-wide text-[#2C2C2A] mb-1">${studentName}</h2>
            <p class="text-[#2C2C2A]/60 font-medium tracking-wide uppercase text-xs">${reportData.report_info?.sub_title || ''}</p>
        </div>
        <div class="text-left md:text-right">
             <div class="flex items-center gap-2 mb-1 justify-start md:justify-end">
                <div class="w-1.5 h-1.5 bg-[#A68B5C] rounded-full"></div>
                <span class="text-xs font-bold text-[#2C2C2A] uppercase tracking-widest">과사람 의대관</span>
            </div>
            <div class="text-[#A68B5C] font-serif italic text-lg">${reportData.report_info?.topic || ''}</div>
        </div>
    </div>

    <div class="grid gap-10 mb-10">
        <section>
            <h3 class="text-lg font-serif font-light tracking-wide text-[#2C2C2A] mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-[#A68B5C] rounded-full"></span> Learning Progress
            </h3>
            <p class="text-[#2C2C2A]/80 leading-relaxed font-light text-justify">${reportData.analysis_data?.learning_progress || ''}</p>
        </section>
        <section>
            <h3 class="text-lg font-serif font-light tracking-wide text-[#2C2C2A] mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-[#A68B5C] rounded-full"></span> Key Strengths
            </h3>
            <div class="grid md:grid-cols-2 gap-4">
                ${(reportData.analysis_data?.growth_points || []).map(point => `
                    <div class="bg-white/40 border border-[#2C2C2A]/10 backdrop-blur-sm p-5 rounded-lg shadow-sm">
                        <div class="text-xs font-bold text-[#A68B5C] uppercase tracking-wider mb-2">Evidence</div>
                        <p class="text-[#2C2C2A]/70 mb-3 font-mono text-xs break-keep">${point.evidence || ''}</p>
                        <div class="text-sm text-[#2C2C2A] font-light font-serif break-keep">"${point.praise_comment || ''}"</div>
                    </div>
                `).join('')}
            </div>
        </section>
        <section class="bg-[#A68B5C]/5 p-6 rounded-lg border border-[#A68B5C]/20 backdrop-blur-sm shadow-sm">
            <h3 class="text-lg font-serif font-light tracking-wide text-[#2C2C2A] mb-3 flex items-center gap-2">Professional Advice</h3>
            <p class="text-[#2C2C2A]/90 leading-relaxed font-light text-sm font-medium">${reportData.analysis_data?.improvement_suggestions || ''}</p>
        </section>
    </div>

    <div class="pt-8 border-t border-[#2C2C2A]/10 mb-10">
        <h4 class="text-base font-serif font-light tracking-wide text-[#2C2C2A] mb-2">Message for Parents</h4>
        <p class="text-[#2C2C2A]/70 text-sm mb-4 italic">"${reportData.parent_guide?.opening_ment || ''}"</p>
        <div class="bg-white/40 border border-[#2C2C2A]/5 backdrop-blur-sm p-4 rounded-lg inline-block w-full">
            <span class="text-xs font-bold text-[#A68B5C] uppercase tracking-wider block mb-2">Home Coaching Tips</span>
            <ul class="space-y-2">
                ${(reportData.parent_guide?.encouragement_tips || []).map(tip => `
                    <li class="text-sm text-[#2C2C2A]/80 flex items-start gap-2">
                        <span class="w-1 h-1 bg-[#A68B5C] rounded-full mt-2 flex-shrink-0"></span>
                        <span class="break-keep">${tip}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    </div>

    <!-- Board Analytics Section -->
    <section class="mt-12 pt-8 border-t border-[#2C2C2A]/10 mb-12">
        <h3 class="text-lg font-serif font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span class="w-1.5 h-1.5 bg-[#A68B5C] rounded-full"></span> Board Analytics
        </h3>
        <div class="bg-white/30 border border-[#2C2C2A]/10 backdrop-blur-sm p-2 rounded-xl">
            <div class="rounded-lg overflow-hidden border border-[#2C2C2A]/10 bg-white shadow-sm space-y-4 p-4">
                ${base64Images.map(img => `
                    <div style="margin-bottom: 20px;">
                        <img src="${img}" alt="Board" style="width: 100%; height: auto; display: block; border-radius: 8px;" />
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    <div class="mt-12 text-center border-t border-slate-100 pt-6">
        <p class="text-xs text-[#A68B5C] tracking-widest uppercase">과사람 의대관 | Premium Mathematics Education</p>
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report_${studentName}_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="animate-slide-up pb-12 w-full max-w-4xl mx-auto">
            {!readOnly && (
                <div className="flex justify-between items-center mb-6 print:hidden gap-2">
                    <div className="flex gap-2">
                        {onReset && (
                            <button onClick={onReset} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors px-4 py-2 rounded-full hover:bg-white text-xs md:text-sm font-medium border border-transparent hover:border-[#2C2C2A]/10">
                                <Icon name="RefreshCw" size={14} />
                                <span className="hidden sm:inline">다시 분석하기</span>
                                <span className="sm:hidden">Reset</span>
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        {saving && (
                            <div className="flex items-center gap-2 text-slate-500 bg-[#A68B5C]/10 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse">
                                <Icon name="Loader2" size={12} className="animate-spin" />
                                <span>자동 저장 중...</span>
                            </div>
                        )}
                        {saveError && !reportId && (
                            <div className="flex items-center gap-2 text-[#A68B5C] bg-[#A68B5C]/10 px-3 py-1.5 rounded-full text-xs font-medium border border-[#A68B5C]/20">
                                <Icon name="AlertCircle" size={12} />
                                <span>{saveError}</span>
                            </div>
                        )}
                        {reportId && (
                            <button
                                onClick={handleCopyLink}
                                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm font-medium shadow-md transition-all ${copied
                                    ? 'bg-[#A68B5C] text-[#F4F3F0] hover:bg-[#A68B5C]/90'
                                    : 'bg-white/70 text-[#2C2C2A] border border-[#2C2C2A]/10 hover:bg-white backdrop-blur-sm'
                                    }`}
                            >
                                <Icon name={copied ? "Check" : "Link"} size={14} />
                                {copied ? "복사됨" : "학부모 전송 링크"}
                            </button>
                        )}
                        <button onClick={downloadHtmlReport} className="flex items-center gap-2 bg-white/70 text-[#2C2C2A] border border-[#2C2C2A]/10 px-5 py-2 rounded-full text-xs md:text-sm font-medium hover:bg-white shadow-sm transition-all backdrop-blur-sm transition-all">
                            <Icon name="Download" size={14} />
                            HTML 저장
                        </button>
                        <button onClick={() => window.print()} className="flex items-center gap-2 bg-[#2C2C2A] text-[#F4F3F0] border border-[#2C2C2A]/10 px-5 py-2 rounded-full text-xs md:text-sm font-medium hover:bg-[#2C2C2A]/90 shadow-md transition-all">
                            <Icon name="Printer" size={14} />
                            PDF / Print
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-[#F4F3F0] text-[#2C2C2A] w-full max-w-4xl mx-auto min-h-screen md:min-h-[297mm] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative print:shadow-none print:w-full print:max-w-none print:bg-white">
                <div className="absolute top-0 left-0 w-1 md:w-2 h-full bg-[#A68B5C]/10 hidden sm:block"></div>

                <div className="p-5 sm:p-12 md:p-16">
                    {/* Header */}
                    <div className="border-b border-[#2C2C2A]/20 pb-6 mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
                        <div>
                            <div className="flex flex-wrap gap-2 mb-2 text-xs font-bold tracking-wider text-[#A68B5C] uppercase">
                                {className && <span className="bg-[#2C2C2A]/5 border border-[#2C2C2A]/10 px-2 py-1 rounded">{className}</span>}
                                {courseName && <span className="bg-[#A68B5C]/10 text-[#A68B5C] px-2 py-1 rounded">{courseName}</span>}
                            </div>
                            <h2 className="text-3xl md:text-4xl font-serif font-light tracking-wide text-[#2C2C2A] mb-1">{studentName}</h2>
                            <p className="text-[#2C2C2A]/60 font-medium tracking-wide uppercase text-[10px] md:text-xs">
                                {reportData.report_info?.sub_title || ''}
                            </p>
                        </div>
                        <div className="text-left md:text-right">
                            <div className="flex items-center gap-2 mb-1 justify-start md:justify-end">
                                <div className="w-1.5 h-1.5 bg-[#A68B5C] rounded-full"></div>
                                <span className="text-[10px] md:text-xs font-bold text-[#2C2C2A] uppercase tracking-widest">과사람 의대관</span>
                            </div>
                            <div className="text-[#A68B5C] font-serif italic text-base md:text-lg">{reportData.report_info?.topic || ''}</div>
                        </div>
                    </div>

                    {/* Analysis Data */}
                    <div className="grid gap-8 md:gap-10">
                        <section>
                            <h3 className="text-base md:text-lg font-serif font-light tracking-wide text-[#2C2C2A] mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#A68B5C] rounded-full"></span> Learning Progress
                            </h3>
                            <div className="text-[#2C2C2A]/80 leading-relaxed font-light text-justify text-sm md:text-base">
                                <MathText text={reportData.analysis_data?.learning_progress || ''} />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-base md:text-lg font-serif font-light tracking-wide text-[#2C2C2A] mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#A68B5C] rounded-full"></span> Key Strengths
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {(reportData.analysis_data?.growth_points || []).map((point, idx) => (
                                    <div key={idx} className="bg-white/40 p-5 rounded-lg border border-[#2C2C2A]/10 backdrop-blur-sm shadow-sm transition-all hover:bg-white/60">
                                        <div className="text-xs font-bold text-[#A68B5C] uppercase tracking-wider mb-2">Evidence</div>
                                        <div className="text-[#2C2C2A]/70 mb-3 font-mono text-xs break-keep">
                                            <MathText text={point.evidence || ''} />
                                        </div>
                                        <div className="text-sm text-[#2C2C2A] font-light font-serif break-keep">
                                            &quot;<MathText text={point.praise_comment || ''} />&quot;
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="bg-[#A68B5C]/5 p-6 rounded-lg border border-[#A68B5C]/20 backdrop-blur-sm shadow-sm">
                            <h3 className="text-base md:text-lg font-serif font-light tracking-wide text-[#2C2C2A] mb-3 flex items-center gap-2">
                                <Icon name="Award" size={18} className="text-[#A68B5C]" /> Professional Advice
                            </h3>
                            <div className="text-[#2C2C2A]/90 leading-relaxed font-light text-sm font-medium">
                                <MathText text={reportData.analysis_data?.improvement_suggestions || ''} />
                            </div>
                        </section>
                    </div>

                    {/* Footer / Parent Guide */}
                    <div className="mt-12 md:mt-16 pt-8 border-t border-[#2C2C2A]/10">
                        <div className="flex flex-col md:flex-row items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/60 border border-[#2C2C2A]/5 flex items-center justify-center flex-shrink-0 hidden md:flex">
                                <Icon name="MessageCircle" size={20} className="text-[#A68B5C]" />
                            </div>
                            <div>
                                <h4 className="text-base font-serif font-light tracking-wide text-[#2C2C2A] mb-2">Message for Parents</h4>
                                <div className="text-[#2C2C2A]/70 text-sm mb-4 italic">
                                    &quot;<MathText text={reportData.parent_guide?.opening_ment || ''} />&quot;
                                </div>
                                <div className="bg-white/40 border border-[#2C2C2A]/5 backdrop-blur-sm p-4 rounded-lg inline-block w-full">
                                    <span className="text-xs font-bold text-[#A68B5C] uppercase tracking-wider block mb-2">Home Coaching Tips</span>
                                    <ul className="space-y-2">
                                        {(reportData.parent_guide?.encouragement_tips || []).map((tip, idx) => (
                                            <li key={idx} className="text-sm text-[#2C2C2A]/80 flex items-start gap-2">
                                                <span className="w-1 h-1 bg-[#A68B5C] rounded-full mt-2 flex-shrink-0"></span>
                                                <div className="break-keep">
                                                    <MathText text={tip} />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Image Section */}
                    <section className="mt-12 md:mt-16 pt-8 border-t border-[#2C2C2A]/10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base md:text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#A68B5C] rounded-full"></span> Board Analytics
                                {images.length > 5 && <span className="text-xs font-normal text-[#2C2C2A]/50 ml-1">({images.length})</span>}
                            </h3>
                            <button
                                onClick={() => setIsEnhancedMode(!isEnhancedMode)}
                                className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium text-slate-500 hover:text-slate-900 bg-[#A68B5C]/10 px-3 py-1.5 rounded-full transition-colors print:hidden"
                            >
                                {isEnhancedMode ? <Icon name="EyeOff" size={12} /> : <Icon name="Eye" size={12} />}
                                <span className="hidden sm:inline">{isEnhancedMode ? '원본 색상' : '가독성 모드'}</span>
                            </button>
                        </div>
                        <div className="bg-white/30 p-2 md:p-4 rounded-xl border border-[#2C2C2A]/5 backdrop-blur-sm">
                            {images.length <= 5 ? (
                                /* 기존 판서 업로드: 이미지 크게 세로 배치 */
                                <div className="space-y-4">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="rounded-lg overflow-hidden border border-[#2C2C2A]/10 bg-white shadow-sm">
                                            <img
                                                src={img}
                                                alt={`Board ${idx + 1}`}
                                                className={`w-full h-auto object-contain transition-all duration-500 ${isEnhancedMode ? 'grayscale contrast-[1.2] brightness-105 saturate-0' : ''}`}
                                                loading="lazy"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* URL 캡처: 썸네일 그리드 + 라이트박스 */
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
                                    {images.map((img, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setLightboxIndex(idx)}
                                            className="relative rounded-lg overflow-hidden border border-[#2C2C2A]/10 bg-white shadow-sm cursor-pointer group hover:border-[#A68B5C]/40 hover:shadow-md transition-all aspect-[3/4]"
                                        >
                                            <img
                                                src={img}
                                                alt={`문제 ${idx + 1}`}
                                                className={`w-full h-full object-cover object-top transition-all duration-300 group-hover:scale-105 ${isEnhancedMode ? 'grayscale contrast-[1.2] brightness-105 saturate-0' : ''}`}
                                                loading="lazy"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1.5 md:p-2">
                                                <span className="text-white text-[10px] md:text-xs font-medium">{idx + 1}</span>
                                            </div>
                                            <div className="absolute inset-0 bg-[#A68B5C]/0 group-hover:bg-[#A68B5C]/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <Icon name="ZoomIn" size={20} className="text-white drop-shadow-lg" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Lightbox Modal */}
                    {lightboxIndex !== null && (
                        <div
                            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center print:hidden"
                            onClick={() => setLightboxIndex(null)}
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setLightboxIndex(null)}
                                className="absolute top-4 right-4 z-10 text-white/70 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                            >
                                <Icon name="X" size={24} />
                            </button>

                            {/* Page indicator */}
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-sm">
                                {lightboxIndex + 1} / {images.length}
                            </div>

                            {/* Previous button */}
                            {lightboxIndex > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                                    className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                                >
                                    <Icon name="ChevronLeft" size={28} />
                                </button>
                            )}

                            {/* Next button */}
                            {lightboxIndex < images.length - 1 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                                    className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                                >
                                    <Icon name="ChevronRight" size={28} />
                                </button>
                            )}

                            {/* Image */}
                            <div
                                className="max-w-[90vw] max-h-[85vh] overflow-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img
                                    src={images[lightboxIndex]}
                                    alt={`문제 ${lightboxIndex + 1}`}
                                    className={`max-w-full h-auto object-contain ${isEnhancedMode ? 'grayscale contrast-[1.2] brightness-105 saturate-0' : ''}`}
                                    style={{ maxHeight: '85vh' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
