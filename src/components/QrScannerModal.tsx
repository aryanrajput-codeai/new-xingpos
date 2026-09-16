import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  X,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle,
  Flashlight,
  Sparkles,
  QrCode,
  Utensils
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsQR from "jsqr";
import { parseTableNumberFromScannedData, saveActiveTable } from "../lib/qrHelper";
import { LocalDB } from "../lib/db";
import { RestaurantTable } from "../types";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (tableNumber: string) => void;
  title?: string;
  subtitle?: string;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan Table QR Code",
  subtitle = "Point your camera at the QR code stand on your dining table"
}: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [availableTables, setAvailableTables] = useState<RestaurantTable[]>([]);
  const [manualTableSelect, setManualTableSelect] = useState("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string>("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Load available restaurant tables for manual fallback
  useEffect(() => {
    if (isOpen) {
      try {
        const tables = LocalDB.getTables();
        setAvailableTables(tables);
      } catch (err) {
        console.warn("[QR Scanner] Failed to load tables:", err);
      }
    }
  }, [isOpen]);

  // Enumerate cameras
  const getCameras = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0 && !currentCameraId) {
        // Prefer environment / back camera
        const backCam = videoDevices.find((d) =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment")
        );
        setCurrentCameraId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
      }
    } catch (e) {
      console.warn("[QR Scanner] Enumerate devices failed:", e);
    }
  };

  // Play pleasant short confirmation beep using Web Audio API
  const playSuccessBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio optional
    }
  };

  // Start Camera Stream
  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setErrorMessage(null);
    setScannedResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraAccess(false);
      setErrorMessage("Camera access is not supported on this browser. You can select your table manually below or upload an image.");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setHasTorch(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setHasCameraAccess(true);
        startScanningLoop();
      }

      await getCameras();
    } catch (err: any) {
      console.warn("[QR Scanner] Camera start error:", err);
      setHasCameraAccess(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMessage("Camera permission was denied. Please allow camera permissions in your browser or select your table below.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMessage("No camera was found on your device. You can choose your table below.");
      } else {
        setErrorMessage(`Camera unavailable: ${err.message || "Unknown error"}. Use manual table selection.`);
      }
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchEnabled(false);
  };

  // Toggle Flashlight / Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchEnabled;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchEnabled(nextState);
    } catch (e) {
      console.warn("[QR Scanner] Torch toggle failed:", e);
    }
  };

  // Switch between cameras
  const handleSwitchCamera = () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.deviceId === currentCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCam = availableCameras[nextIndex];
    setCurrentCameraId(nextCam.deviceId);
    startCamera(nextCam.deviceId);
  };

  // Main QR Detection Loop
  const startScanningLoop = () => {
    let lastScanTime = 0;

    const tick = (currentTime: number) => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // Throttle scanning to every 100ms (~10 fps) to avoid CPU battery drain
      if (currentTime - lastScanTime > 100) {
        lastScanTime = currentTime;
        const video = videoRef.current;
        const canvas = canvasRef.current || document.createElement("canvas");
        if (!canvasRef.current) canvasRef.current = canvas;

        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);

            // Fast decode with jsQR
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert"
            });

            if (code && code.data) {
              const detectedTable = parseTableNumberFromScannedData(code.data);
              if (detectedTable) {
                handleVerifiedTableFound(detectedTable);
                return;
              }
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  // Process uploaded QR code image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setIsProcessingImage(false);
          setErrorMessage("Failed to process uploaded image.");
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        setIsProcessingImage(false);

        if (code && code.data) {
          const detectedTable = parseTableNumberFromScannedData(code.data);
          if (detectedTable) {
            handleVerifiedTableFound(detectedTable);
          } else {
            setErrorMessage(`Scanned QR contained "${code.data.slice(0, 40)}", but could not find a table number.`);
          }
        } else {
          setErrorMessage("No valid QR code was detected in this image. Please try another photo or choose a table manually.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle successful detection
  const handleVerifiedTableFound = (tableNumber: string) => {
    stopCamera();
    setScannedResult(tableNumber);
    playSuccessBeep();
    saveActiveTable(tableNumber, true);

    setTimeout(() => {
      onScanSuccess(tableNumber);
      onClose();
    }, 450);
  };

  // Manual table selection confirmation
  const handleManualConfirm = (tableNum: string) => {
    if (!tableNum) return;
    saveActiveTable(tableNum, false);
    playSuccessBeep();
    onScanSuccess(tableNum);
    onClose();
  };

  // Lifecycle control
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setScannedResult(null);
      setErrorMessage(null);
      setHasCameraAccess(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-stone-900 border border-[#d4af37]/30 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]"
        >
          {/* Header Bar */}
          <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-serif font-bold text-white tracking-wide">
                  {title}
                </h3>
                <p className="text-[10.5px] text-stone-400 font-sans">
                  {subtitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title="Close Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scanner Viewport Box */}
          <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
            {/* Live Camera Video Feed */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />

            {/* Hidden canvas for image decoding */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning Reticle / Target Overlay */}
            {hasCameraAccess && !scannedResult && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="relative w-56 h-56 max-w-[80%] max-h-[80%] border-2 border-dashed border-[#d4af37]/60 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.15)]">
                  {/* Corner Target Accents */}
                  <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#d4af37] rounded-tl-xl" />
                  <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#d4af37] rounded-tr-xl" />
                  <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#d4af37] rounded-bl-xl" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#d4af37] rounded-br-xl" />

                  {/* Animated Scanning Laser Line */}
                  <motion.div
                    className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent shadow-[0_0_12px_#d4af37]"
                    animate={{ top: ["8%", "90%", "8%"] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  />

                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]/80 bg-black/60 px-3 py-1 rounded-full border border-[#d4af37]/30 backdrop-blur-xs">
                    Align QR Code Stand
                  </div>
                </div>
              </div>
            )}

            {/* Success State Overlay */}
            {scannedResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300">
                  <CheckCircle className="w-9 h-9" />
                </div>
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold block">
                    QR Verified!
                  </span>
                  <h4 className="text-2xl font-serif font-black text-white mt-0.5">
                    Table #{scannedResult}
                  </h4>
                  <p className="text-xs text-emerald-200/80 font-sans mt-1">
                    Dine-in menu locked. Enjoy your culinary experience!
                  </p>
                </div>
              </motion.div>
            )}

            {/* Error or Camera Denied Overlay */}
            {errorMessage && !scannedResult && (
              <div className="absolute inset-0 bg-stone-950/95 p-6 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-stone-200">Camera Notice</h5>
                  <p className="text-xs text-stone-400 max-w-xs leading-relaxed font-sans">
                    {errorMessage}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => startCamera(currentCameraId)}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Again</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#d4af37] hover:bg-[#c5a028] text-stone-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </button>
                </div>
              </div>
            )}

            {/* Viewport Control Bar (Torch, Camera Switch) */}
            {hasCameraAccess && !scannedResult && (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer ${
                      torchEnabled
                        ? "bg-[#d4af37] text-stone-950 border-[#d4af37]"
                        : "bg-black/60 text-white border-white/20 hover:bg-black/80"
                    }`}
                    title={torchEnabled ? "Turn Torch Off" : "Turn Torch On"}
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}

                {availableCameras.length > 1 && (
                  <button
                    onClick={handleSwitchCamera}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer"
                    title="Switch Camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action Tools & Fallback Panel */}
          <div className="p-4 sm:p-5 bg-stone-950 border-t border-stone-800 space-y-4">
            {/* Gallery Upload Hidden Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Quick Actions Row */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="flex-1 py-2 px-3 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-300 hover:text-white rounded-xl text-xs font-sans font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>{isProcessingImage ? "Decoding..." : "Scan from Photo"}</span>
              </button>

              <button
                type="button"
                onClick={() => startCamera()}
                className="py-2 px-3 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-300 hover:text-white rounded-xl text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Restart Camera"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Manual Table Selector Fallback */}
            <div className="pt-2 border-t border-stone-850">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-mono text-stone-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Utensils className="w-3 h-3 text-[#d4af37]" />
                  <span>Or Select Table Number Manually</span>
                </label>
                <span className="text-[9px] text-stone-500 font-mono">
                  {availableTables.length} Tables Registered
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={manualTableSelect}
                  onChange={(e) => setManualTableSelect(e.target.value)}
                  className="flex-1 bg-stone-900 border border-stone-700 text-stone-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#d4af37] font-sans"
                >
                  <option value="">Select your table number...</option>
                  {availableTables.map((t) => (
                    <option key={t.id} value={t.tableNumber}>
                      Table #{t.tableNumber} — {t.seatingArea} ({t.capacity} seats)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!manualTableSelect}
                  onClick={() => handleManualConfirm(manualTableSelect)}
                  className="py-2 px-4 bg-[#d4af37] hover:bg-[#c5a028] disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 text-xs font-bold rounded-xl transition-all font-sans cursor-pointer shrink-0"
                >
                  Confirm Table
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
