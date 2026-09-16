/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from "react";
import { Maximize2, Minimize2, Tv, Smartphone, SlidersHorizontal, SkipForward } from "lucide-react";
import YouTubePlayer from "./components/YouTubePlayer";

export default function App() {
  const PLAYLIST_ID = "PLyRIlYM-0bjEwQpkw7OSPH86pDEWKTNDT";
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTrackTitle, setCurrentTrackTitle] = useState("Cargando lista...");
  const [isCurrentShort, setIsCurrentShort] = useState(false);
  const [zoomMode, setZoomMode] = useState<"fit" | "wide" | "fill">(() => {
    const saved = localStorage.getItem("tv_shorts_zoom");
    return (saved as "fit" | "wide" | "fill") || "fit";
  });
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const playerRef = useRef<any>(null);

  // Auto-hide controls after 3.5 seconds of inactivity
  const triggerActivity = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const cycleZoomMode = () => {
    setZoomMode((prev) => {
      const next = prev === "fit" ? "wide" : prev === "wide" ? "fill" : "fit";
      localStorage.setItem("tv_shorts_zoom", next);
      return next;
    });
    triggerActivity();
  };

  useEffect(() => {
    triggerActivity();
    const handleUserActivity = () => triggerActivity();

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("click", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Listen to native browser fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFull = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isDocFull);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Native Fullscreen Toggle for TV Browsers
  const toggleFullscreen = () => {
    const doc = document as any;
    const docEl = document.documentElement as any;

    if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const handleSkipNext = () => {
    if (!playerRef.current) return;
    try {
      const playlist = playerRef.current.getPlaylist?.() || [];
      const currentIndex = playerRef.current.getPlaylistIndex?.() ?? 0;
      const nextIndex = playlist.length > 0 ? (currentIndex + 1) % playlist.length : 0;
      if (typeof playerRef.current.playVideoAt === "function") {
        playerRef.current.playVideoAt(nextIndex);
      } else if (playerRef.current.nextVideo) {
        playerRef.current.nextVideo();
      }
    } catch (e) {
      playerRef.current.nextVideo?.();
    }
    triggerActivity();
  };

  // TV Remote controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === "KeyZ") {
        e.preventDefault();
        cycleZoomMode();
      } else if (e.code === "ArrowRight" || e.code === "KeyN") {
        e.preventDefault();
        handleSkipNext();
      } else if (e.code === "ArrowLeft" || e.code === "KeyP") {
        e.preventDefault();
        if (playerRef.current?.previousVideo) {
          playerRef.current.previousVideo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const zoomLabels = {
    fit: "Ajustar (Original)",
    wide: "Ampliar (1.35x)",
    fill: "Llenar Pantalla (Zoom)",
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black overflow-hidden select-none m-0 p-0"
      id="tv-viewport-container"
    >
      {/* 100% Full Viewport Video Stage */}
      <div className="w-full h-full absolute inset-0 bg-black">
        <YouTubePlayer
          playlistId={PLAYLIST_ID}
          volume={95}
          isPlaying={isPlaying}
          zoomMode={zoomMode}
          onReady={(p) => {
            playerRef.current = p;
          }}
          onPlayStateChange={setIsPlaying}
          onChangeTrack={(idx, title, isShort) => {
            setCurrentTrackTitle(title);
            setIsCurrentShort(isShort);
          }}
        />
      </div>

      {/* FLOATING TV CONTROLS (Discreet & auto-hiding after 3.5s) */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 z-30 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top Info Bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto gap-3">
          <div className="flex items-center gap-2.5 bg-black/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white shadow-2xl max-w-[60%]">
            <Tv className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-xs font-medium font-sans truncate text-slate-200">
              {currentTrackTitle}
            </span>
            {isCurrentShort && (
              <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex-shrink-0">
                <Smartphone className="w-3 h-3" /> SHORT
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* If playing a Short, offer the aspect fit/fill toggle */}
            {isCurrentShort && (
              <button
                onClick={cycleZoomMode}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-xl border border-white/10 active:scale-95 cursor-pointer"
                title="Cambiar ajuste de Shorts (Z)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Shorts:</span>
                <span className="text-amber-300 font-normal">{zoomLabels[zoomMode]}</span>
              </button>
            )}

            <button
              onClick={handleSkipNext}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white rounded-2xl text-xs font-bold transition-all shadow-xl border border-white/10 active:scale-95 cursor-pointer"
              title="Saltar al siguiente video (Flecha derecha o N)"
              id="btn-tv-skip"
            >
              <SkipForward className="w-4 h-4 text-blue-400" />
              <span>Saltar</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-2xl text-xs font-bold transition-all shadow-2xl hover:scale-105 active:scale-95 cursor-pointer border border-blue-400/30"
              id="btn-tv-fullscreen"
              title="Pantalla Completa (F)"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span>Salir TV</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span>Pantalla Completa</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
