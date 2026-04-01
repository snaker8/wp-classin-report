'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { ReportView, ReportData } from './ReportView';
import { generateReport } from '@/app/actions/generateReport';
import { startCapture, checkCapture } from '@/app/actions/capturePages';
import CameraCapture from '@/components/ui/CameraCapture';

interface Attachment {
    id: string;
    file: File;
    type: 'image' | 'pdf';
    preview: string; // DataURL for preview
    objectUrl?: string; // Object URL for efficient display
    optimized?: string;
}

export default function ReportGenerator() {
    const { user, userData } = useAuth();

    // Form States
    const [teacherName, setTeacherName] = useState('');
    const [studentName, setStudentName] = useState('');
    const [className, setClassName] = useState('');
    const [courseName, setCourseName] = useState('');

    // File States
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Refs for split inputs
    const imageInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // Process States
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isEnhancedMode, setIsEnhancedMode] = useState(false);

    // Save States
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [reportId, setReportId] = useState<string | null>(null);

    // AI Personalization States
    const [aiStyle, setAiStyle] = useState('다정함'); // '기본', '다정함', '직설적'
    const [customInstructions, setCustomInstructions] = useState('');
    const [studentMemo, setStudentMemo] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // URL Capture States
    const [captureUrl, setCaptureUrl] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureProgress, setCaptureProgress] = useState('');
    const [captureId, setCaptureId] = useState<string>('');

    // Set Teacher Name from User Data
    useEffect(() => {
        if (userData?.displayName) {
            setTeacherName(userData.displayName);
        } else if (user?.displayName) {
            setTeacherName(user.displayName);
        } else {
            setTeacherName('');
        }
    }, [userData, user]);

    const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await processFiles(Array.from(e.target.files));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const processFiles = async (newFiles: File[]) => {
        const newAttachments: Attachment[] = [];

        for (const file of newFiles) {
            const id = Math.random().toString(36).substring(7);
            const isPdf = file.type === 'application/pdf';

            // Read preview
            const preview = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });

            newAttachments.push({
                id,
                file,
                type: isPdf ? 'pdf' : 'image',
                preview,
                objectUrl: isPdf ? undefined : URL.createObjectURL(file),
                optimized: undefined
            });
        }

        setAttachments(prev => [...prev, ...newAttachments]);
        setReportData(null);
    };

    const handleCameraCapture = async (file: File) => {
        await processFiles([file]);
    };

    // URL Capture Handler - fire-and-forget + polling via server actions
    const handleUrlCapture = async () => {
        if (!captureUrl.trim()) return;

        setIsCapturing(true);
        setCaptureProgress('캡처 시작 중...');
        setError(null);

        try {
            // Step 1: Start capture - fire and forget (don't await completion)
            const { captureId: newCaptureId, error: startError } = await startCapture(captureUrl.trim());

            if (startError || !newCaptureId) {
                setError(`캡처 실패: ${startError || '알 수 없는 오류'}`);
                setIsCapturing(false);
                return;
            }

            setCaptureProgress('캡처 진행 중...');

            // Step 2: Poll for completion every 3 seconds
            const maxPolls = 80; // max ~4 minutes
            for (let poll = 0; poll < maxPolls; poll++) {
                await new Promise(r => setTimeout(r, 3000));

                try {
                    const status = await checkCapture(newCaptureId);

                    if (status.status === 'capturing') {
                        setCaptureProgress(status.progress || '캡처 진행 중...');
                        continue;
                    }

                    if (status.status === 'error') {
                        setError(`캡처 실패: ${status.error || '알 수 없는 오류'}`);
                        setIsCapturing(false);
                        return;
                    }

                    if (status.status === 'done' && status.result) {
                        const result = status.result;

                        if (result.studentName && !studentName) setStudentName(result.studentName);
                        if (result.className && !className) setClassName(result.className);
                        if (result.materialName && !courseName) setCourseName(result.materialName);

                        setCaptureId(result.captureId);

                        const placeholders: Attachment[] = [];
                        for (let i = 0; i < result.filteredCount; i++) {
                            const blob = new Blob([''], { type: 'image/jpeg' });
                            const file = new File([blob], `capture_page_${i + 1}.jpg`, { type: 'image/jpeg' });
                            placeholders.push({
                                id: Math.random().toString(36).substring(7),
                                file,
                                type: 'image' as const,
                                preview: '',
                                objectUrl: '',
                            });
                        }

                        setAttachments(prev => [...prev, ...placeholders]);
                        setReportData(null);
                        setCaptureProgress(`캡처 완료! ${result.totalPages}페이지 중 풀이 ${result.filteredCount}페이지 추출`);
                        setCaptureUrl('');
                        setIsCapturing(false);
                        return;
                    }
                } catch {
                    // Poll failed, keep trying
                    continue;
                }
            }

            setError('캡처 시간이 초과되었습니다. 다시 시도해주세요.');
        } catch (err) {
            console.error('URL capture error:', err);
            setError(err instanceof Error ? err.message : 'URL 캡처 중 오류가 발생했습니다.');
        } finally {
            setIsCapturing(false);
        }
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    // Compress image for AI analysis
    const compressImageForAI = async (file: File): Promise<Blob> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Reduced from 4096 to 3072 to ensure payload fits within server limits
                    // Gemini 1.5 Flash supports high res, but we need to stay under the body size limit
                    const MAX_DIMENSION = 3072;
                    let width = img.width;
                    let height = img.height;

                    // Only resize if significantly larger than MAX_DIMENSION
                    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high'; // improved quality
                        ctx.drawImage(img, 0, 0, width, height);
                    }

                    // Use slightly higher quality JPEG
                    canvas.toBlob(
                        (blob) => resolve(blob || file),
                        'image/jpeg',
                        0.8
                    );
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };



    const handleGenerateReport = async () => {
        if (!studentName || (attachments.length === 0 && !captureId)) {
            setError('학생 이름과 최소 하나의 자료(이미지/PDF)가 필요합니다.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // If we have captureId, images are on server - only process manual uploads as base64
            const hasCaptureImages = !!captureId;

            const manualAttachments = hasCaptureImages
                ? attachments.filter(a => !a.file.name.startsWith('capture_page_'))
                : attachments;

            const processedAttachments = await Promise.all(manualAttachments.map(async (attachment) => {
                let base64Data: string;

                if (attachment.type === 'pdf') {
                    base64Data = attachment.preview.split(',')[1];
                } else {
                    const compressedBlob = await compressImageForAI(attachment.file);
                    base64Data = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            resolve(result.split(',')[1]);
                        };
                        reader.readAsDataURL(compressedBlob);
                    });
                }

                return {
                    type: attachment.type,
                    base64: base64Data
                };
            }));

            // Force Flash model
            const aiPromise = generateReport({
                teacherName,
                studentName,
                className,
                courseName,
                attachments: processedAttachments,
                captureId: hasCaptureImages ? captureId : undefined,
                model: 'flash',
                aiStyle,
                customInstructions,
                studentMemo
            });

            const parsedData = await aiPromise;
            if (!parsedData) {
                throw new Error('AI 분석 결과가 비어있습니다. 다시 시도해주세요.');
            }
            setReportData(parsedData);

            if (user) {
                setSaving(true);
                try {
                    const base64Images = await Promise.all(attachments.map(async (attachment) => {
                        // Use original file for maximum fidelity (no canvas re-compression)
                        // This ensures the HTML report has the exact same quality as the uploaded file
                        return await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(attachment.file);
                        });
                    }));

                    const { generateReportHtml } = await import('@/lib/reportHtmlGenerator');
                    const htmlContent = generateReportHtml(
                        studentName,
                        className,
                        courseName,
                        parsedData,
                        base64Images
                    );

                    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

                    // Construct Hierarchical Path: Center / Dept / Grade / StudentName
                    const sanitize = (s: string) => s.replace(/[\/\\]/g, '_').trim();
                    const center = sanitize(userData?.centerName || '기타센터');
                    const dept = sanitize(userData?.department || '기타부서');

                    // Extract Grade from ClassName (e.g., "중3A" -> "중3", "고1" -> "고1")
                    // If no match, use '기타학년'
                    // Extract Grade from ClassName or CourseName
                    const gradeRegex = /(초|중|고)\s*\d+/;
                    let gradeMatch = className.match(gradeRegex);
                    if (!gradeMatch && courseName) {
                        gradeMatch = courseName.match(gradeRegex);
                    }

                    let grade = '기타학년';

                    if (gradeMatch) {
                        grade = sanitize(gradeMatch[0]);
                    } else {
                        // Check for Middle/High school indicators (M/H)
                        const upperClass = className.toUpperCase();
                        const upperCourse = courseName.toUpperCase();

                        if (upperClass.includes('M') || upperCourse.includes('M')) {
                            grade = '중등';
                        } else if (upperClass.includes('H') || upperCourse.includes('H')) {
                            grade = '고등';
                        }
                    }
                    const student = sanitize(studentName);

                    const fileName = `reports/${center}/${dept}/${grade}/${student}/${Date.now()}_${student}.html`;

                    // Dynamic import for storage functions
                    const { uploadBytes } = await import('firebase/storage');
                    const storageRef = ref(storage, fileName);

                    await uploadBytes(storageRef, htmlBlob);
                    const htmlUrl = await getDownloadURL(storageRef);
                    console.log("HTML Report uploaded:", htmlUrl);

                    const rawCenterName = userData?.centerName || 'Unknown';
                    const centerName = rawCenterName === '동래센터' ? '동래' : rawCenterName;

                    const docRef = await addDoc(collection(db, 'reports'), {
                        studentName,
                        className,
                        courseName,
                        reportData: parsedData,
                        htmlReportUrl: htmlUrl,
                        imageUrl: '',
                        teacherId: user.uid,
                        teacherName: teacherName || userData?.displayName || user.displayName || 'Unknown',
                        centerName: centerName,
                        department: userData?.department || 'Unknown',
                        createdAt: serverTimestamp(),
                        month: new Date().toISOString().slice(0, 7)
                    });
                    setReportId(docRef.id);
                    console.log("Report saved successfully with ID:", docRef.id);

                } catch (saveError) {
                    console.error("Failed to save report:", saveError);
                    setSaveError(saveError instanceof Error
                        ? `⚠️ 저장 실패: ${saveError.message}`
                        : "⚠️ 자동 저장 실패 (네트워크/권한 확인)");
                }
            }
        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
        } finally {
            setSaving(false);
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setStudentName('');
        setClassName('');
        setCourseName('');
        setAttachments([]);
        setCaptureId('');
        setCaptureProgress('');
        setReportData(null);
        setError(null);
        setIsEnhancedMode(false);
        setReportId(null);
        // Do not reset AI personalization settings to allow quick successive generations with the same settings
    };

    const viewImages = attachments
        .filter(a => a.type === 'image')
        .map(a => a.objectUrl || a.preview);

    if (reportData) {
        return (
            <ReportView
                studentName={studentName}
                className={className}
                courseName={courseName}
                reportData={reportData}
                images={viewImages}
                isEnhancedMode={isEnhancedMode}
                setIsEnhancedMode={setIsEnhancedMode}
                reportId={reportId}
                onReset={resetForm}
                saving={saving}
                saveError={saveError}
            />
        );
    }

    return (
        <div 
            className="max-w-[480px] w-full mx-auto space-y-6 md:space-y-8 animate-fade-in relative z-10 py-8"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="bg-[#f0ece5]/30 backdrop-blur-2xl p-10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white/60 relative overflow-hidden">
                {isDragging && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md border-2 border-dashed border-[#2a2a2a]/20 rounded-[32px] animate-in fade-in zoom-in duration-200">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-[#2a2a2a]/10 rounded-full flex items-center justify-center mx-auto">
                                <Icon name="Upload" size={32} className="text-[#2a2a2a]" />
                            </div>
                            <p className="text-lg font-serif tracking-widest text-[#2a2a2a]">DROP FILES HERE</p>
                        </div>
                    </div>
                )}
                <div className="text-center space-y-3 mb-12">
                    <h2 className="text-[28px] font-serif font-light tracking-widest text-[#2a2a2a]">START ANALYSIS</h2>
                    <p className="text-[#3a3a3a]/85 font-light text-[12.5px] tracking-wide leading-relaxed">
                        <span className="font-medium text-[#2a2a2a]">과사람 동래센터</span>의 전문적인 분석 시스템입니다.<br />
                        학생의 판서 이미지 또는 PDF 자료를 업로드해 주세요.
                    </p>
                </div>

                <div className="space-y-8">
                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-7">
                        <div className="space-y-2 col-span-1 md:col-span-2 relative group">
                            <input
                                type="text"
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                                placeholder="Teacher Name (작성자)"
                                className="w-full pb-2.5 bg-transparent border-b border-[#2a2a2a]/20 text-[#2a2a2a] font-light focus:outline-none focus:border-[#2a2a2a]/40 transition-all placeholder:text-[#2a2a2a]/40 text-sm"
                            />
                        </div>

                        <div className="space-y-2 col-span-1 md:col-span-2 relative group">
                            <input
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="Student Name (이름) *"
                                className="w-full pb-3 bg-transparent border-b border-[#2a2a2a]/20 text-[#2a2a2a] font-serif focus:outline-none focus:border-[#2a2a2a]/40 transition-all placeholder:text-[#2a2a2a]/40 text-lg"
                            />
                        </div>
                        <div className="space-y-2 relative group">
                            <input
                                type="text"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                placeholder="Class Name (클래스명)"
                                className="w-full pb-2.5 bg-transparent border-b border-[#2a2a2a]/20 text-[#2a2a2a] font-light focus:outline-none focus:border-[#2a2a2a]/40 transition-all placeholder:text-[#2a2a2a]/40 text-sm"
                            />
                        </div>
                        <div className="space-y-2 relative group">
                            <input
                                type="text"
                                value={courseName}
                                onChange={(e) => setCourseName(e.target.value)}
                                placeholder="Course / Subject (과정명)"
                                className="w-full pb-2.5 bg-transparent border-b border-[#2a2a2a]/20 text-[#2a2a2a] font-light focus:outline-none focus:border-[#2a2a2a]/40 transition-all placeholder:text-[#2a2a2a]/40 text-sm"
                            />
                        </div>
                    </div>

                    {/* URL Capture Section */}
                    <div className="space-y-3 pt-4">
                        <label className="block text-[11px] font-medium text-[#2a2a2a]/75 uppercase tracking-[0.2em]">
                            URL Auto Capture
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={captureUrl}
                                onChange={(e) => setCaptureUrl(e.target.value)}
                                placeholder="https://class.orzo.kr/public-reports/..."
                                disabled={isCapturing}
                                className="flex-1 pb-2.5 bg-transparent border-b border-[#2a2a2a]/20 text-[#2a2a2a] font-light focus:outline-none focus:border-[#2a2a2a]/40 transition-all placeholder:text-[#2a2a2a]/30 text-sm"
                            />
                            <button
                                onClick={handleUrlCapture}
                                disabled={isCapturing || !captureUrl.trim()}
                                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                                    isCapturing || !captureUrl.trim()
                                        ? 'bg-white/30 text-[#2a2a2a]/30 cursor-not-allowed'
                                        : 'bg-[#2a2a2a] text-white hover:bg-[#1a1a1a] active:scale-[0.98]'
                                }`}
                            >
                                {isCapturing ? (
                                    <>
                                        <Icon name="Loader2" size={12} className="animate-spin" />
                                        <span>캡처 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <Icon name="Globe" size={12} />
                                        <span>자동 캡처</span>
                                    </>
                                )}
                            </button>
                        </div>
                        {captureProgress && (
                            <p className={`text-[11px] ${captureProgress.includes('완료') ? 'text-emerald-600' : 'text-[#2a2a2a]/60'}`}>
                                {captureProgress}
                            </p>
                        )}
                    </div>

                    <div className="space-y-4 pt-4">
                        <label className="block text-[11px] font-medium text-[#2a2a2a]/75 uppercase tracking-[0.2em]">Board Images & PDF <span className="text-red-400 font-normal">*</span></label>
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4`}>
                            {/* PDF Upload Button */}
                            <div
                                onClick={() => pdfInputRef.current?.click()}
                                className="border border-foreground/10 bg-white/30 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 hover:border-foreground/20 transition-all text-center gap-3 aspect-[3/2] shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                            >
                                <div className="w-12 h-12 bg-white/60 border border-white text-foreground/60 rounded-xl flex items-center justify-center shadow-sm">
                                    <Icon name="FileText" size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-[13px] text-foreground/85 tracking-wide">Add PDF</p>
                                    <p className="text-[11px] text-foreground/60 mt-1 uppercase tracking-widest">Upload Documents</p>
                                </div>
                                <input
                                    ref={pdfInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    multiple
                                    onChange={handleFilesChange}
                                    className="hidden"
                                />
                            </div>

                            {/* Camera Button - Continuous Shot */}
                            <div
                                onClick={() => setIsCameraOpen(true)}
                                className="border border-foreground/10 bg-white/30 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 hover:border-foreground/20 transition-all text-center gap-3 aspect-[3/2] shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                            >
                                <div className="w-12 h-12 bg-white/60 border border-white text-foreground/60 rounded-xl flex items-center justify-center shadow-sm">
                                    <Icon name="Camera" size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-[13px] text-foreground/80 tracking-wide">Take Photos</p>
                                    <p className="text-[10px] text-foreground/40 mt-1 uppercase tracking-widest">Continuous Shot</p>
                                </div>
                            </div>

                            {/* Image Upload Button */}
                            <div
                                onClick={() => imageInputRef.current?.click()}
                                className="border border-foreground/10 bg-white/30 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 hover:border-foreground/20 transition-all text-center gap-3 aspect-[3/2] md:col-span-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                            >
                                <div className="w-12 h-12 bg-white/60 border border-white text-foreground/60 rounded-xl flex items-center justify-center shadow-sm">
                                    <Icon name="Image" size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-[13px] text-foreground/85 tracking-wide">Add Photos</p>
                                    <p className="text-[11px] text-foreground/60 mt-1 uppercase tracking-widest">Select from Gallery</p>
                                </div>
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFilesChange}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* Camera Modal */}
                        {isCameraOpen && (
                            <CameraCapture
                                onCapture={handleCameraCapture}
                                onClose={() => setIsCameraOpen(false)}
                            />
                        )}

                        {/* File Previews */}
                        {attachments.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                {attachments.map((file) => (
                                    <div key={file.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm aspect-square flex items-center justify-center">
                                        {file.type === 'pdf' ? (
                                            <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                                                <Icon name="FileText" size={32} className="mb-2 text-amber-600" />
                                                <span className="text-xs truncate w-full px-2">{file.file.name}</span>
                                            </div>
                                        ) : (
                                            <img
                                                src={file.preview}
                                                alt="Preview"
                                                className="w-full h-full object-contain bg-slate-50"
                                            />
                                        )}

                                        <button
                                            onClick={() => removeAttachment(file.id)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Icon name="X" size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-800 text-sm rounded border border-red-100 flex items-center gap-3">
                            <Icon name="X" size={16} /> {error}
                        </div>
                    )}

                    {/* Personalization Settings Button */}
                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex items-center gap-1.5 text-xs text-[#2a2a2a]/80 hover:text-[#2a2a2a] transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-white/60 shadow-sm"
                        >
                            <Icon name="Settings" size={12} />
                            <span>AI 코멘트 설정</span>
                            {(aiStyle !== '기본' || customInstructions || studentMemo) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1"></span>
                            )}
                        </button>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleGenerateReport}
                            disabled={isLoading || !studentName || attachments.length === 0}
                            className={`w-full py-3.5 rounded-lg font-medium text-[13px] tracking-wide transition-all flex items-center justify-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_4px_rgba(0,0,0,0.05)] border ${isLoading || !studentName || attachments.length === 0
                                ? 'bg-white/50 text-[#2a2a2a]/30 border-white/60 cursor-not-allowed'
                                : 'bg-gradient-to-b from-[#e5e5e5] to-[#d4d4d4] hover:from-[#d4d4d4] hover:to-[#c4c4c4] text-[#2a2a2a]/80 border-white/40 active:scale-[0.98]'
                                }`}
                        >
                            {isLoading ? (
                                <>
                                    <Icon name="Loader2" size={14} className="animate-spin" />
                                    <span>Generating... {saving && "(Saving...)"}</span>
                                </>
                            ) : (
                                <>
                                    <span>GENERATE REPORT &gt;</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Settings Modal - Glassmorphism */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/40 backdrop-blur-sm">
                    <div className="bg-[#f0ece5]/95 backdrop-blur-3xl w-full max-w-lg rounded-2xl shadow-2xl border border-white/40 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-[#2a2a2a]/10 flex justify-between items-center bg-white/20">
                            <h3 className="font-serif text-lg tracking-wide text-[#2a2a2a] flex items-center gap-2">
                                <Icon name="Settings" size={18} className="text-[#2a2a2a]/70" />
                                AI 코멘트 개인화 설정
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-[#2a2a2a]/50 hover:text-[#2a2a2a] transition-colors p-1">
                                <Icon name="X" size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6 text-[#2a2a2a] font-light text-sm">
                            {/* AI Style Select */}
                            <div className="space-y-2">
                                <label className="block text-xs uppercase tracking-widest text-[#2a2a2a]/80 font-medium font-sans">AI 스타일</label>
                                <div className="relative">
                                    <select 
                                        value={aiStyle} 
                                        onChange={(e) => setAiStyle(e.target.value)}
                                        className="w-full appearance-none bg-white/50 border border-white/60 text-[#2a2a2a] py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#2a2a2a]/30 transition-all font-medium"
                                    >
                                        <option value="기본">기본 (차분하고 객관적인 강사 톤)</option>
                                        <option value="다정함">다정함 (격려와 칭찬을 아끼지 않는 친절한 톤)</option>
                                        <option value="직설적">직설적 (팩트 기반의 단호하고 분석적인 톤)</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#2a2a2a]/50">
                                        <Icon name="ChevronDown" size={16} />
                                    </div>
                                </div>
                            </div>

                            {/* Custom Instructions */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className="block text-xs uppercase tracking-widest text-[#2a2a2a]/80 font-medium font-sans">맞춤형 지침</label>
                                    <span className="text-[11px] text-[#2a2a2a]/55">{customInstructions.length}/100</span>
                                </div>
                                <p className="text-[12px] text-[#3a3a3a]/75 leading-relaxed pb-1">AI 코멘트 작성 시 최우선으로 반영할 특별 지시사항을 작성하세요. (예: 칭찬 위주로 써주세요, 분량을 짧게 해주세요 등)</p>
                                <textarea 
                                    value={customInstructions}
                                    onChange={(e) => setCustomInstructions(e.target.value)}
                                    maxLength={100}
                                    placeholder="사용 안 함"
                                    className="w-full bg-white/50 border border-white/60 text-[#2a2a2a] py-3 px-4 rounded-lg focus:outline-none focus:border-[#2a2a2a]/30 transition-all resize-none h-20 placeholder:text-[#2a2a2a]/30 font-medium"
                                />
                            </div>

                            {/* Student Memo */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className="block text-xs uppercase tracking-widest text-[#2a2a2a]/80 font-medium font-sans">학생별 메모 (참고사항)</label>
                                    <span className="text-[11px] text-[#2a2a2a]/55">{studentMemo.length}/300</span>
                                </div>
                                <p className="text-[12px] text-[#3a3a3a]/75 leading-relaxed pb-1">해당 학생의 수업 태도, 습관, 특징 등을 적어주시면 AI가 분석 내용에 자연스럽게 녹여냅니다.</p>
                                <textarea 
                                    value={studentMemo}
                                    onChange={(e) => setStudentMemo(e.target.value)}
                                    maxLength={300}
                                    placeholder="예) 수업 태도가 좋고 질문이 많음. 단순 계산 실수가 잦은 편이나 응용력은 뛰어남. 과제 제출률이 좋음."
                                    className="w-full bg-white/50 border border-white/60 text-[#2a2a2a] py-3 px-4 rounded-lg focus:outline-none focus:border-[#2a2a2a]/30 transition-all resize-none h-28 placeholder:text-[#2a2a2a]/30 font-medium"
                                />
                            </div>
                        </div>

                        <div className="p-5 border-t border-[#2a2a2a]/10 bg-white/20 flex gap-3 justify-end">
                            <button 
                                onClick={() => {
                                    setAiStyle('다정함');
                                    setCustomInstructions('');
                                    setStudentMemo('');
                                }}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#2a2a2a]/60 hover:text-[#2a2a2a] hover:bg-black/5 transition-all"
                            >
                                초기화
                            </button>
                            <button 
                                onClick={() => setIsSettingsOpen(false)}
                                className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[#2a2a2a] text-white hover:bg-[#1a1a1a] shadow-md transition-all active:scale-[0.98]"
                            >
                                저장 및 닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
