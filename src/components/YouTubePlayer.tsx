import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface YouTubePlayerProps {
  playlistId: string;
  volume: number; // 0 to 100
  isPlaying: boolean;
  isMuted: boolean;
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
  isMuted,
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

      // Explicitly call playVideoAt with next index so YouTube's engine advances reliably on TV
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
          mute: 1, // CRITICAL: Samsung Tizen & LG WebOS block unmuted autoplay. Starting muted guarantees instant playback
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
              event.target.setLoop(true);
              if (isMuted) {
                event.target.mute();
              } else {
                event.target.unMute();
                event.target.setVolume(volume);
              }
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
            setError("Video no disponible o con audio protegido. Saltando...");

            // Automatically skip unplayable video/short in 600ms so TV never hangs on black screen
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
          // If the video/short failed to start playing within 3.5 seconds
          if (!playbackStartedRef.current && timeSinceTrackStart > 3500) {
            lastSkipRef.current = now;
            trackStartTimeRef.current = now;
            setError("Video/Short no compatible. Saltando al siguiente...");
            advanceVideo(player);
            setTimeout(() => setError(null), 2000);
            return;
          }

          // Short completed or looped internally
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

  // Handle Mute/Unmute
  useEffect(() => {
    if (playerRef.current) {
      try {
        if (isMuted) {
          playerRef.current.mute?.();
        } else {
          playerRef.current.unMute?.();
          playerRef.current.setVolume?.(volume);
        }
      } catch (_) {}
    }
  }, [isMuted, volume]);

  // Handle Volume
  useEffect(() => {
    if (playerRef.current && playerRef.current.setVolume && !isMuted) {
      playerRef.current.setVolume(volume);
    }
  }, [volume, isMuted]);

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
    <div style={{ position: "relative", width: "100%", height: "100%", backgroundColor: "#000000", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Ambient background glow for vertical Shorts to look broadcast-grade on TV */}
      {isCurrentShort && zoomMode === "fit" && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ width: "50vw", height: "50vh", backgroundColor: "rgba(37, 99, 235, 0.15)", borderRadius: "9999px", filter: "blur(90px)" }} />
        </div>
      )}

      {!apiReady ? (
        <div style={{ textAlign: "center", padding: "32px", zIndex: 20 }}>
          <div style={{ width: "48px", height: "48px", border: "4px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px auto" }} />
          <p style={{ color: "#cbd5e1", fontWeight: 600, fontSize: "14px", letterSpacing: "0.5px" }}>
            Iniciando reproductor de TV...
          </p>
        </div>
      ) : (
        <div 
          style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", backgroundColor: "#000000", transform: scaleTransform, transformOrigin: "center", transition: "transform 0.3s ease-out", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div id={containerId} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
        </div>
      )}

      {error && (
        <div className="tv-toast">
          <AlertTriangle style={{ width: "16px", height: "16px", color: "#facc15", flexShrink: 0 }} />
          <span>{error}</span>
          <RefreshCw style={{ width: "14px", height: "14px", color: "#60a5fa", animation: "spin 1s linear infinite", marginLeft: "8px", flexShrink: 0 }} />
        </div>
      )}
    </div>
  );
}
