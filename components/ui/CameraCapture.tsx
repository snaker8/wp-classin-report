'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const [capturedCount, setCapturedCount] = useState(0);
    const [isCapturing, setIsCapturing] = useState(false);

    const startCamera = useCallback(async () => {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: {
                    facingMode: facingMode,
                    // Try to get reasonable resolution for OCR
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            console.log("Requesting camera with constraints:", constraints);
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.play().catch(e => console.error("Video play error:", e));
            }
            setError(null);
        } catch (err) {
            console.error("Camera Error:", err);
            setError("카메라에 접근할 수 없습니다 (HTTPS 또는 localhost 환경 필요). 권한을 확인해주세요.");
        }
    }, [facingMode]);

    // Initial start
    useEffect(() => {
        startCamera();

        return () => {
            // Cleanup on unmount
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-start when facingMode changes, but only if we already started once to avoid double-init issues
    useEffect(() => {
        if (stream) {
            startCamera();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facingMode]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Flash effect
        setIsCapturing(true);
        setTimeout(() => setIsCapturing(false), 150);

        // Set dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw
        if (facingMode === 'user') {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to file
        canvas.toBlob((blob) => {
            if (blob) {
                const now = new Date();
                const timeString = now.toISOString().replace(/[:.]/g, '-');
                const fileName = `capture_${timeString}.jpg`;
                const file = new File([blob], fileName, { type: 'image/jpeg' });
                onCapture(file);
                setCapturedCount(prev => prev + 1);
            }
        }, 'image/jpeg', 0.9);
    };

    const handleClose = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        onClose();
    };

    const toggleFacingMode = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    return (
        <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
                <button
                    onClick={handleClose}
                    className="p-2 rounded-full bg-black/30 backdrop-blur-sm"
                >
                    <Icon name="X" size={24} className="text-white" />
                </button>
                <div className="bg-amber-600/90 px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                    {capturedCount}장 촬영
                </div>
                <button
                    onClick={toggleFacingMode}
                    className="p-2 rounded-full bg-black/30 backdrop-blur-sm"
                >
                    <Icon name="RefreshCw" size={24} className="text-white" />
                </button>
            </div>

            {/* Camera Viewport */}
            <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                {!stream && !error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Icon name="Loader2" size={48} className="animate-spin text-amber-500" />
                    </div>
                )}

                {error ? (
                    <div className="p-8 text-center max-w-sm">
                        <Icon name="AlertTriangle" size={48} className="mx-auto mb-4 text-red-500" />
                        <p className="text-lg font-bold mb-2">카메라 오류</p>
                        <p className="text-sm text-gray-400">{error}</p>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />
                )}

                {/* Flash Overlay */}
                <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 ${isCapturing ? 'opacity-70' : 'opacity-0'}`} />
            </div>

            {/* Bottom Controls */}
            <div className="bg-black/80 pb-10 pt-6 flex justify-center items-center relative">
                <button
                    onClick={handleCapture}
                    disabled={!!error || !stream}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative active:scale-95 transition-transform"
                >
                    <div className="w-16 h-16 rounded-full bg-white" />
                </button>

                <button
                    onClick={handleClose}
                    className="absolute right-8 text-sm font-bold text-amber-400"
                >
                    완료
                </button>
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
