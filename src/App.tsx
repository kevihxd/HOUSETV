/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from "react";
import { Maximize2, Minimize2, Tv, Smartphone, SlidersHorizontal, SkipForward, Volume2, VolumeX } from "lucide-react";
import YouTubePlayer from "./components/YouTubePlayer";

export default function App() {
  const PLAYLIST_ID = "PLyRIlYM-0bjEwQpkw7OSPH86pDEWKTNDT";
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
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

  // Auto-hide controls after 4 seconds of inactivity
  const triggerActivity = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  const cycleZoomMode = () => {
    setZoomMode((prev) => {
      const next = prev === "fit" ? "wide" : prev === "wide" ? "fill" : "fit";
      localStorage.setItem("tv_shorts_zoom", next);
      return next;
    });
    triggerActivity();
  };

  const handleUnmute = () => {
    setIsMuted(false);
    if (playerRef.current) {
      try {
        playerRef.current.unMute?.();
        playerRef.current.setVolume?.(95);
      } catch (_) {}
    }
    triggerActivity();
  };

  useEffect(() => {
    triggerActivity();
    const handleUserActivity = () => {
      triggerActivity();
      // First user interaction automatically enables sound on TV
      if (isMuted && playerRef.current) {
        handleUnmute();
      }
    };

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("click", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isMuted]);

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
    triggerActivity();
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
      // Any keypress on TV remote un-mutes if currently muted
      if (isMuted) {
        handleUnmute();
      }

      if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        if (isMuted) {
          handleUnmute();
        } else {
          setIsPlaying((prev) => !prev);
        }
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
      } else if (e.code === "KeyM") {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMuted]);

  const zoomLabels = {
    fit: "Ajustar",
    wide: "1.35x",
    fill: "Llenar",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000000",
        overflow: "hidden",
        margin: 0,
        padding: 0,
        userSelect: "none",
      }}
      id="tv-viewport-container"
    >
      {/* Full Viewport Video Stage */}
      <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%", backgroundColor: "#000000" }}>
        <YouTubePlayer
          playlistId={PLAYLIST_ID}
          volume={95}
          isPlaying={isPlaying}
          isMuted={isMuted}
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

      {/* FLOATING TV CONTROLS (Discreet & auto-hiding after 4s) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          transition: "opacity 0.4s ease",
          zIndex: 30,
          opacity: showControls ? 1 : 0,
        }}
      >
        {/* Top Info Bar */}
        <div className="tv-top-bar">
          <div className="tv-info-pill">
            <Tv style={{ width: "16px", height: "16px", color: "#60a5fa", flexShrink: 0 }} />
            <span className="tv-title-text">{currentTrackTitle}</span>
            {isCurrentShort && (
              <span className="tv-short-badge">
                <Smartphone style={{ width: "12px", height: "12px" }} /> SHORT
              </span>
            )}
          </div>

          <div className="tv-actions">
            {/* If playing a Short, offer aspect ratio cycle */}
            {isCurrentShort && (
              <button
                onClick={cycleZoomMode}
                className="tv-btn tv-btn-secondary"
                title="Cambiar encuadre de Short (Z)"
              >
                <SlidersHorizontal style={{ width: "14px", height: "14px", color: "#fbbf24" }} />
                <span>Shorts: <strong style={{ color: "#fcd34d" }}>{zoomLabels[zoomMode]}</strong></span>
              </button>
            )}

            {/* Mute / Unmute Button */}
            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className="tv-btn tv-btn-secondary"
              title={isMuted ? "Activar Sonido (M)" : "Silenciar (M)"}
            >
              {isMuted ? (
                <>
                  <VolumeX style={{ width: "16px", height: "16px", color: "#f87171" }} />
                  <span>Sin Sonido</span>
                </>
              ) : (
                <>
                  <Volume2 style={{ width: "16px", height: "16px", color: "#4ade80" }} />
                  <span>Sonido ON</span>
                </>
              )}
            </button>

            {/* Skip video */}
            <button
              onClick={handleSkipNext}
              className="tv-btn tv-btn-secondary"
              title="Saltar al siguiente video (Flecha derecha o N)"
              id="btn-tv-skip"
            >
              <SkipForward style={{ width: "16px", height: "16px", color: "#60a5fa" }} />
              <span>Saltar</span>
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="tv-btn tv-btn-primary"
              id="btn-tv-fullscreen"
              title="Pantalla Completa (F)"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 style={{ width: "16px", height: "16px" }} />
                  <span>Salir TV</span>
                </>
              ) : (
                <>
                  <Maximize2 style={{ width: "16px", height: "16px" }} />
                  <span>Pantalla Completa</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Prominent TV Audio Banner when muted on initial startup */}
      {isMuted && (
        <div
          className="tv-sound-banner"
          onClick={handleUnmute}
          id="btn-unmute-sound"
          title="Toca o presiona OK en el control para activar sonido"
        >
          <Volume2 style={{ width: "22px", height: "22px", color: "#60a5fa", flexShrink: 0 }} />
          <div>
            <div className="tv-sound-text">Toca la pantalla o presiona OK para activar el sonido</div>
            <div className="tv-sound-sub">El televisor inició en silencio por seguridad del navegador</div>
          </div>
        </div>
      )}
    </div>
  );
}
