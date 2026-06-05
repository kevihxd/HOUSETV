import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, AlertTriangle, Info, RefreshCw } from "lucide-react";

interface YouTubePlayerProps {
  playlistId: string;
  volume: number; // 0 to 100
  isPlaying: boolean;
  onReady: (player: any) => void;
  onChangeTrack: (index: number, title: string) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
}

// Global state to load YouTube Iframe API once
let isApiLoading = false;
let apiLoaded = false;
let pendingCallbacks: (() => void)[] = [];

function loadYouTubeIframeAPI(callback: () => void) {
  if (apiLoaded) {
    callback();
    return;
  }
  
  pendingCallbacks.push(callback);
  
  if (isApiLoading) return;
  isApiLoading = true;

  if ((window as any).YT && (window as any).YT.Player) {
    apiLoaded = true;
    isApiLoading = false;
    pendingCallbacks.forEach(cb => cb());
    pendingCallbacks = [];
    return;
  }

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  if (firstScriptTag && firstScriptTag.parentNode) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
    document.head.appendChild(tag);
  }

  (window as any).onYouTubeIframeAPIReady = () => {
    apiLoaded = true;
    isApiLoading = false;
    pendingCallbacks.forEach(cb => cb());
    pendingCallbacks = [];
  };
}

export default function YouTubePlayer({
  playlistId,
  volume,
  isPlaying,
  onReady,
  onChangeTrack,
  onPlayStateChange,
}: YouTubePlayerProps) {
  const containerId = "youtube-playlist-player-iframe";
  const playerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadYouTubeIframeAPI(() => {
      setApiReady(true);
    });
  }, []);

  const initializePlayer = () => {
    if (!apiReady || !playlistId || playerRef.current) return;

    try {
      playerRef.current = new (window as any).YT.Player(containerId, {
        height: "100%",
        width: "105%", // Subtle negative margins to cut default branding border
        playerVars: {
          listType: "playlist",
          list: playlistId,
          autoplay: isPlaying ? 1 : 0,
          controls: 1, // TV friendly manual bar
          loop: 1,     // Loop entire playlist
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 1,
          disablekb: 1, // We implement custom tv keys mapping in App
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            event.target.setVolume(volume);
            event.target.setLoop(true); // Native loop playlist parameter
            if (isPlaying) {
              event.target.playVideo();
            }
            onReady(event.target);
            
            // Extract current title
            updateCurrentlyPlayingInfo(event.target);
          },
          onStateChange: (event: any) => {
            const state = event.data;
            const PLAYER_STATES = (window as any).YT.PlayerState;

            if (state === PLAYER_STATES.PLAYING) {
              onPlayStateChange(true);
              setError(null);
              updateCurrentlyPlayingInfo(event.target);
            } else if (state === PLAYER_STATES.PAUSED) {
              onPlayStateChange(false);
            } else if (state === PLAYER_STATES.ENDED) {
              // Safe fallback native loop trigger
              event.target.playVideoAt(0);
            }
          },
          onError: (event: any) => {
            const code = event.data;
            let errorText = "Ocurrió una interrupción de derechos o restricciones de la canción.";
            if (code === 2) errorText = "ID de lista o video inválido.";
            else if (code === 101 || code === 150) errorText = "El creador deshabilito reproducción externa para este video.";
            setError(errorText);

            // Auto-skip broken videos quickly for remote television
            setTimeout(() => {
              if (playerRef.current && playerRef.current.nextVideo) {
                playerRef.current.nextVideo();
                setError(null);
              }
            }, 4000);
          },
        },
      });
    } catch (e) {
      console.error("No se pudo iniciar el reproductor de YouTube: ", e);
      setError("Error cargando la lista de reproducción. Revisa tu conexión de Internet.");
    }
  };

  const updateCurrentlyPlayingInfo = (target: any) => {
    if (!target) return;
    try {
      const index = target.getPlaylistIndex?.() ?? 0;
      const videoData = target.getVideoData?.();
      const title = videoData?.title || "Canción de la lista";
      onChangeTrack(index, title);
    } catch (e) {
      // Ignored
    }
  };

  // Run initialization
  useEffect(() => {
    if (apiReady && playlistId) {
      initializePlayer();
    }
    return () => {
      // Keep state alive for seamless TV
    };
  }, [apiReady, playlistId]);

  // Handle outside playlist changes
  useEffect(() => {
    if (playerRef.current && playerRef.current.cuePlaylist && playlistId) {
      setError(null);
      playerRef.current.cuePlaylist({
        listType: "playlist",
        list: playlistId
      });
      if (isPlaying) {
        setTimeout(() => playerRef.current.playVideo(), 800);
      }
    }
  }, [playlistId]);

  // Handle Play/Pause commands
  useEffect(() => {
    if (playerRef.current && playerRef.current.playVideo && playerRef.current.pauseVideo) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying]);

  // Handle Volume
  useEffect(() => {
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  return (
    <div className="relative w-full aspect-video bg-black/95 rounded-3xl overflow-hidden border border-slate-900 shadow-2xl flex items-center justify-center">
      {!apiReady ? (
        <div className="text-center p-8">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-5"></div>
          <p className="text-slate-350 font-semibold font-display tracking-wide antialiased">
            Cargando la lista de reproducción de TV...
          </p>
        </div>
      ) : (
        <div className="w-full h-full overflow-hidden scale-[1.01]">
          <div id={containerId} className="w-full h-full" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-30">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4 animate-bounce" />
          <h3 className="text-xl font-bold text-white mb-2 font-display">Canción omitida automáticamente</h3>
          <p className="text-slate-300 text-sm max-w-md bg-slate-900 p-3 rounded-lg border border-slate-800">
            {error}
          </p>
          <div className="flex items-center gap-2 mt-4 text-xs text-blue-400 font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saltando al siguiente tema en 4 segundos...
          </div>
          <button
            onClick={() => {
              if (playerRef.current && playerRef.current.nextVideo) {
                playerRef.current.nextVideo();
                setError(null);
              }
            }}
            className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
          >
            Saltar ahora
          </button>
        </div>
      )}
    </div>
  );
}
