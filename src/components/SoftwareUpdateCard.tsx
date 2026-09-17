import React, { useState, useEffect } from "react";
import { 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  WifiOff, 
  Sparkles, 
  Info,
  ArrowUpCircle
} from "lucide-react";

export type UpdateStatus =
  | "IDLE"
  | "CHECKING"
  | "UP_TO_DATE"
  | "AVAILABLE"
  | "DOWNLOADING"
  | "DOWNLOADED"
  | "INSTALLING"
  | "ERROR"
  | "OFFLINE";

export interface ProgressState {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export default function SoftwareUpdateCard() {
  const [currentVersion, setCurrentVersion] = useState<string>("1.1.0");
  const [status, setStatus] = useState<UpdateStatus>("IDLE");
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
  });

  const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);
  const isMac = typeof window !== "undefined" && window.electronAPI?.platform === "darwin";

  // Fetch current version on mount & subscribe to updater events
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    // Get dynamic app version from Electron app.getVersion()
    window.electronAPI.getAppVersion()
      .then((ver) => {
        if (ver) setCurrentVersion(ver);
      })
      .catch((err) => {
        console.warn("[SoftwareUpdateCard] getAppVersion failed:", err);
      });

    // Listen to update state changes
    const unsubState = window.electronAPI.onUpdateStateChange((data) => {
      if (!data) return;
      
      const newStatus = (data.status as UpdateStatus) || "IDLE";
      setStatus(newStatus);

      if (data.version) {
        setAvailableVersion(data.version);
      }

      if (newStatus === "ERROR") {
        const errText = data.error || "Unable to check for updates.";
        setErrorMessage(errText);
        // Check if offline
        if (!navigator.onLine || errText.toLowerCase().includes("offline") || errText.toLowerCase().includes("net::err") || errText.toLowerCase().includes("enotfound")) {
          setStatus("OFFLINE");
        }
      } else {
        setErrorMessage(null);
      }
    });

    // Listen to download progress
    const unsubProgress = window.electronAPI.onUpdateProgress((prog) => {
      setStatus("DOWNLOADING");
      setProgress(prog);
    });

    return () => {
      unsubState();
      unsubProgress();
    };
  }, [isElectron]);

  const handleCheckForUpdates = async () => {
    if (!navigator.onLine) {
      setStatus("OFFLINE");
      return;
    }

    if (!isElectron || !window.electronAPI) return;

    setStatus("CHECKING");
    setErrorMessage(null);

    try {
      const res = await window.electronAPI.checkForUpdates();
      if (!res.success && res.error) {
        if (!navigator.onLine || res.error.toLowerCase().includes("offline") || res.error.toLowerCase().includes("net::err") || res.error.toLowerCase().includes("enotfound")) {
          setStatus("OFFLINE");
        } else {
          setStatus("ERROR");
          setErrorMessage(res.error);
        }
      }
    } catch (err: any) {
      if (!navigator.onLine) {
        setStatus("OFFLINE");
      } else {
        setStatus("ERROR");
        setErrorMessage(err.message || "Failed to trigger update check.");
      }
    }
  };

  const handleDownloadUpdate = async () => {
    if (!navigator.onLine) {
      setStatus("OFFLINE");
      return;
    }

    if (!isElectron || !window.electronAPI) return;

    setStatus("DOWNLOADING");
    setProgress({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 });

    try {
      const res = await window.electronAPI.downloadUpdate();
      if (!res.success && res.error) {
        setStatus("ERROR");
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMessage(err.message || "Failed to start download.");
    }
  };

  const handleRestartAndInstall = async () => {
    if (!isElectron || !window.electronAPI) return;

    setStatus("INSTALLING");
    try {
      await window.electronAPI.quitAndInstall();
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMessage(err.message || "Failed to restart and install update.");
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4 shadow-sm text-left">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-[#C67C4E]" />
          <h3 className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider">
            Software Update
          </h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-stone-100 text-stone-700 border border-stone-200">
          v{currentVersion}
        </span>
      </div>

      {!isElectron ? (
        /* Browser Development Mode Fallback */
        <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-serif font-bold text-stone-800">
                Browser Development Mode
              </p>
              <p className="text-xs text-stone-500 font-sans">
                Software updates are available only in the XINGS KITCHEN desktop application.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between">
            <div className="text-[11px] font-mono text-stone-500">
              Current App Version: <span className="font-bold text-stone-800">v{currentVersion}</span>
            </div>
            <button
              disabled
              className="px-4 py-2 bg-stone-200 text-stone-400 font-bold text-xs rounded-xl cursor-not-allowed uppercase tracking-wider font-sans"
            >
              Check for Updates
            </button>
          </div>
        </div>
      ) : (
        /* Native Electron Desktop Application Updater UI */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-50/70 p-4 border border-stone-200 rounded-xl">
            <div>
              <span className="text-[10px] font-sans font-bold text-stone-400 uppercase tracking-widest block">
                Current Version
              </span>
              <span className="text-sm font-mono font-extrabold text-stone-900">
                v{currentVersion}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-sans font-bold text-stone-400 uppercase tracking-widest block">
                Update Status
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {status === "IDLE" && (
                  <span className="text-xs font-sans font-semibold text-stone-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
                    Ready to check for updates
                  </span>
                )}

                {status === "CHECKING" && (
                  <span className="text-xs font-sans font-semibold text-[#C67C4E] flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Checking for updates...
                  </span>
                )}

                {status === "UP_TO_DATE" && (
                  <span className="text-xs font-sans font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ✓ You're running the latest version.
                  </span>
                )}

                {status === "AVAILABLE" && (
                  <span className="text-xs font-sans font-extrabold text-amber-700 flex items-center gap-1.5">
                    <ArrowUpCircle className="w-3.5 h-3.5 text-amber-600" />
                    Update available: v{availableVersion || "New Version"}
                  </span>
                )}

                {status === "DOWNLOADING" && (
                  <span className="text-xs font-sans font-semibold text-blue-700 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Downloading update... ({progress.percent}%)
                  </span>
                )}

                {status === "DOWNLOADED" && (
                  <span className="text-xs font-sans font-extrabold text-emerald-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Update v{availableVersion || ""} is ready to install.
                  </span>
                )}

                {status === "INSTALLING" && (
                  <span className="text-xs font-sans font-semibold text-purple-700 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
                    Restarting to install update...
                  </span>
                )}

                {status === "ERROR" && (
                  <span className="text-xs font-sans font-semibold text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Unable to check for updates.
                  </span>
                )}

                {status === "OFFLINE" && (
                  <span className="text-xs font-sans font-semibold text-amber-700 flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                    You're offline. Connect to the internet and try again.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Download Progress Bar */}
          {status === "DOWNLOADING" && (
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-semibold text-blue-900">
                <span>Downloading Update Package...</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="w-full bg-blue-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-blue-700 pt-0.5">
                <span>Transferred: {formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
                {progress.bytesPerSecond > 0 && (
                  <span>{formatBytes(progress.bytesPerSecond)}/s</span>
                )}
              </div>
            </div>
          )}

          {/* Error Message Details */}
          {status === "ERROR" && errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-sans text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                Update Notice
              </div>
              <p className="text-[11px] font-mono text-rose-700 break-words">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Action Buttons & macOS notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              {isMac && (
                <p className="text-[10px] text-stone-500 font-sans italic flex items-center gap-1">
                  <Info className="w-3 h-3 text-stone-400 shrink-0" />
                  macOS automatic updates require a signed and notarized production build.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {(status === "IDLE" || status === "UP_TO_DATE") && (
                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{status === "UP_TO_DATE" ? "Check Again" : "Check for Updates"}</span>
                </button>
              )}

              {status === "CHECKING" && (
                <button
                  disabled
                  className="px-5 py-2.5 bg-stone-200 text-stone-500 font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-2 cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C67C4E]" />
                  <span>Checking...</span>
                </button>
              )}

              {status === "AVAILABLE" && (
                <button
                  type="button"
                  onClick={handleDownloadUpdate}
                  className="px-5 py-2.5 bg-[#C67C4E] hover:bg-[#b06a3e] text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Update</span>
                </button>
              )}

              {status === "DOWNLOADING" && (
                <button
                  disabled
                  className="px-5 py-2.5 bg-blue-200 text-blue-700 font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-2 cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </button>
              )}

              {status === "DOWNLOADED" && (
                <button
                  type="button"
                  onClick={handleRestartAndInstall}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer animate-bounce"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Restart & Update</span>
                </button>
              )}

              {status === "INSTALLING" && (
                <button
                  disabled
                  className="px-5 py-2.5 bg-purple-200 text-purple-700 font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-2 cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Restarting...</span>
                </button>
              )}

              {(status === "ERROR" || status === "OFFLINE") && (
                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
