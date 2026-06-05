/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from "react";
import { Tv, Maximize2, X, Sparkles, AlertCircle } from "lucide-react";
import YouTubePlayer from "./components/YouTubePlayer";

export default function App() {
  const PLAYLIST_ID = "PLyRIlYM-0bjEwQpkw7OSPH86pDEWKTNDT";
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTrackTitle, setCurrentTrackTitle] = useState("Cargando lista de reproducción...");
  const [showAdHint, setShowAdHint] = useState(true);

  // Keyboard shortcut: Pressing 'F' or 'f' triggers native-style fullscreen simulation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyF") {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      } else if (e.code === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center font-sans overflow-hidden p-6 relative">
      
      {/* MINIMAL BACKGROUND AMBIENT */}
      <div className="absolute inset-0 bg-radial-gradient from-blue-950/20 via-black to-black pointer-events-none" />

      {/* MINIMAL HEADER - FLOATS GENTLY IF NOT IN FULLSCREEN */}
      {!isFullscreen && (
        <header className="w-full max-w-4xl flex items-center justify-between mb-6 z-10 animate-fade-in">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-blue-505 animate-pulse" />
            <h1 className="text-white font-bold text-sm tracking-wide font-display">
              Canal TV Bucle
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {showAdHint && (
              <div className="hidden md:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] px-3 py-1 rounded-full font-bold">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Usa el Navegador Brave en tu TV para evitar anuncios al 100%
              </div>
            )}
            <button
              onClick={() => setIsFullscreen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Pantalla Completa
            </button>
          </div>
        </header>
      )}

      {/* CENTRALIZED VIDEO CONTAINER */}
      <div 
        className={`relative z-10 transition-all duration-300 ${
          isFullscreen 
            ? "fixed inset-0 w-full h-full p-0 bg-black" 
            : "w-full max-w-4xl aspect-video rounded-3xl overflow-hidden border border-slate-900 shadow-[0_0_50px_rgba(30,58,138,0.3)] bg-black"
        }`}
      >
        <YouTubePlayer
          playlistId={PLAYLIST_ID}
          volume={95} // High volume by default for TVs
          isPlaying={isPlaying}
          onReady={() => {}}
          onPlayStateChange={setIsPlaying}
          onChangeTrack={(idx, title) => {
            setCurrentTrackTitle(title);
          }}
        />

        {/* FLOATING CONTROL HUD - ONLY VISIBLE AT THE CORNERS DURING FULLSCREEN */}
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-45 flex items-center gap-2 pointer-events-auto">
            <span className="bg-black/80 backdrop-blur-md text-[10px] text-slate-400 px-3 py-1.5 rounded-lg border border-slate-800 font-mono hidden sm:inline-block">
              {currentTrackTitle}
            </span>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2.5 bg-black/80 hover:bg-red-600 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              title="Salir de Pantalla Completa (Esc)"
            >
              <X className="w-4 h-4" />
              <span className="text-[10px] font-bold">Salir TV (Esc)</span>
            </button>
          </div>
        )}
      </div>

      {/* CLEAN STATUS AREA BELOW VIDEO */}
      {!isFullscreen && (
        <div className="w-full max-w-4xl mt-5 text-center z-10 animate-fade-in">
          <p className="text-xs text-slate-500 font-mono">
            Reproduciendo en bucle continuo: <span className="text-blue-400 font-semibold">{currentTrackTitle}</span>
          </p>
          <p className="text-[10px] text-slate-650 mt-1">
            Esta lista se repite indefinidamente. Si deseas reproducir sin cortes, recuerda activar un bloqueador de publicidad en la TV.
          </p>
        </div>
      )}
    </div>
  );
}
