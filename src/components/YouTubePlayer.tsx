import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, AlertTriangle, Info, RefreshCw } from "lucide-react";

interface YouTubePlayerProps {
  playlistId: string;
  volume: number; // 0 to 100
  isPlaying: boolean;
  zoomMode?: "fit" | "wide" | "fill";
  onReady: (player: any) => void;
  onChangeTrack: (index: number, title: string, isShort: boolean) => void;
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
  zoomMode = "fit",
  onReady,
  onChangeTrack,
  onPlayStateChange,
}: YouTubePlayerProps) {
  const containerId = "youtube-playlist-player-iframe";
  const playerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCurrentShort, setIsCurrentShort] = useState(false);
  
  const lastTimeRef = useRef<number>(0);
  const lastSkipRef = useRef<number>(0);
  const trackStartTimeRef = useRef<number>(Date.now());
  const currentTrackIndexRef = useRef<number>(0);
  const playbackStartedRef = useRef<boolean>(false);

  useEffect(() => {
    loadYouTubeIframeAPI(() => {
      setApiReady(true);
    });
  }, []);

  const advanceVideo = (target: any) => {
    if (!target) return;
    try {
      const playlist = target.getPlaylist?.() || [];
      const currentIndex = target.getPlaylistIndex?.() ?? 0;
      const nextIndex = playlist.length > 0 ? (currentIndex + 1) % playlist.length : 0;
      
      trackStartTimeRef.current = Date.now();
      playbackStartedRef.current = false;
      lastTimeRef.current = 0;

      // Explicitly call playVideoAt with next index so YouTube's engine doesn't stall
      if (typeof target.playVideoAt === "function") {
        target.playVideoAt(nextIndex);
      } else if (typeof target.nextVideo === "function") {
        target.nextVideo();
      }
    } catch (e) {
      try {
        target.nextVideo?.();
      } catch (_) {}
    }
  };

  const updateCurrentlyPlayingInfo = (target: any) => {
    if (!target) return;
    try {
      const index = target.getPlaylistIndex?.() ?? 0;
      const videoData = target.getVideoData?.();
      const title = videoData?.title || "Video de la lista";
      const duration = target.getDuration?.() ?? 0;
      
      // Determine if video is a Short: duration <= 65s or title has #shorts
      const isShort = (duration > 0 && duration <= 65) || /#?shorts?/i.test(title);
      setIsCurrentShort(isShort);
      onChangeTrack(index, title, isShort);
    } catch (e) {
      // Ignored
    }
  };

  const initializePlayer = () => {
    if (!apiReady || !playlistId || playerRef.current) return;

    try {
      playerRef.current = new (window as any).YT.Player(containerId, {
        height: "100%",
        width: "100%",
        playerVars: {
          listType: "playlist",
          list: playlistId,
          autoplay: 1,
          controls: 1,
          loop: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 1,
          disablekb: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            try {
              event.target.setVolume(volume);
              event.target.setLoop(true);
              trackStartTimeRef.current = Date.now();
              playbackStartedRef.current = false;
              if (isPlaying) {
                event.target.playVideo();
              }
            } catch (e) {
              console.error(e);
            }
            onReady(event.target);
            updateCurrentlyPlayingInfo(event.target);
          },
          onStateChange: (event: any) => {
            const state = event.data;
            const PLAYER_STATES = (window as any).YT.PlayerState;

            if (state === PLAYER_STATES.PLAYING) {
              playbackStartedRef.current = true;
              onPlayStateChange(true);
              setError(null);
              updateCurrentlyPlayingInfo(event.target);
            } else if (state === PLAYER_STATES.PAUSED) {
              onPlayStateChange(false);
            } else if (state === PLAYER_STATES.ENDED) {
              advanceVideo(event.target);
            }
          },
          onError: (event: any) => {
            setError("Video no disponible o con audio protegido para TV.");

            // Immediately skip unplayable video/short in 600ms so TV doesn't hang on black screen
            setTimeout(() => {
              if (playerRef.current) {
                advanceVideo(playerRef.current);
                setError(null);
              }
            }, 600);
          },
        },
      });
    } catch (e) {
      console.error("No se pudo iniciar el reproductor de YouTube: ", e);
      setError("Error cargando la lista de reproducción. Revisa la conexión.");
    }
  };

  // Black screen & stuck Short watchdog
  useEffect(() => {
    if (!apiReady || !isPlaying) return;

    const interval = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const player = playerRef.current;
        const now = Date.now();
        const state = typeof player.getPlayerState === "function" ? player.getPlayerState() : -1;
        const currentIndex = typeof player.getPlaylistIndex === "function" ? player.getPlaylistIndex() : 0;
        const currentTime = typeof player.getCurrentTime === "function" ? player.getCurrentTime() : 0;
        const duration = typeof player.getDuration === "function" ? player.getDuration() : 0;

        // Detect track index change
        if (currentIndex !== currentTrackIndexRef.current) {
          currentTrackIndexRef.current = currentIndex;
          trackStartTimeRef.current = now;
          playbackStartedRef.current = false;
          lastTimeRef.current = 0;
          updateCurrentlyPlayingInfo(player);
        }

        // Detect playback confirmed
        if (state === 1 && currentTime > 0.1) {
          playbackStartedRef.current = true;
        }

        const timeSinceTrackStart = now - trackStartTimeRef.current;
        const timeSinceLastSkip = now - lastSkipRef.current;

        // ANTI-BLACK-SCREEN AUTO-RECOVERY:
        if (isPlaying && timeSinceLastSkip > 2500) {
          // Case 1: The video/short never started playing after 3.2 seconds
          // (YouTube blocked the embed or displayed black "Video unavailable" screen)
          if (!playbackStartedRef.current && timeSinceTrackStart > 3200) {
            lastSkipRef.current = now;
            trackStartTimeRef.current = now;
            setError("Short/Video no reproducible en TV externa. Saltando al siguiente...");
            advanceVideo(player);
            setTimeout(() => setError(null), 2200);
            return;
          }

          // Case 2: Short finished or looped internally
          if (duration > 0 && currentTime > 0) {
            const isShortVideo = duration <= 65;
            if (isShortVideo && !isCurrentShort) {
              setIsCurrentShort(true);
            }

            const isNearEnd = currentTime >= duration - 0.7;
            const hasLooped = lastTimeRef.current > Math.max(duration - 2.5, 2) && currentTime < 1.2;

            if (isNearEnd || (isShortVideo && hasLooped)) {
              lastSkipRef.current = now;
              trackStartTimeRef.current = now;
              advanceVideo(player);
              return;
            }
          }
        }

        lastTimeRef.current = currentTime;
      } catch (e) {
        // Ignored
      }
    }, 350);

    return () => clearInterval(interval);
  }, [apiReady, isPlaying, isCurrentShort]);

  // Run initialization
  useEffect(() => {
    if (apiReady && playlistId) {
      initializePlayer();
    }
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
        setTimeout(() => playerRef.current.playVideo?.(), 800);
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

  // Calculate scale transform for Shorts
  let scaleTransform = "scale(1)";
  if (isCurrentShort) {
    if (zoomMode === "wide") {
      scaleTransform = "scale(1.35)";
    } else if (zoomMode === "fill") {
      scaleTransform = "scale(1.78)";
    }
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      {/* Ambient background glow for vertical Shorts to look broadcast-grade on TV */}
      {isCurrentShort && zoomMode === "fit" && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          <div className="w-[50vw] h-[50vh] bg-blue-600/15 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/60 to-black pointer-events-none" />
        </div>
      )}

      {!apiReady ? (
        <div className="text-center p-8 z-20">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300 font-semibold text-sm tracking-wide">
            Cargando lista de reproducción...
          </p>
        </div>
      ) : (
        <div 
          className="w-full h-full relative overflow-hidden bg-black transition-transform duration-300 ease-out origin-center flex items-center justify-center"
          style={{ transform: scaleTransform }}
        >
          <div id={containerId} className="w-full h-full absolute inset-0" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mb-3 animate-pulse" />
          <h3 className="text-lg font-bold text-white mb-2">Aviso de reproducción</h3>
          <p className="text-slate-300 text-xs max-w-sm bg-slate-900 p-2.5 rounded-lg border border-slate-800">
            {error}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-blue-400 font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pasando automáticamente al siguiente...
          </div>
          <button
            onClick={() => {
              if (playerRef.current) {
                advanceVideo(playerRef.current);
                setError(null);
              }
            }}
            className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Saltar ahora
          </button>
        </div>
      )}
    </div>
  );
}
