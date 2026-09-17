export function getYouTubeId(url: string): string | null {
  // If it's already an 11-char ID, return it directly
  const trimmed = url.trim();
  if (trimmed.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

interface NoembedResult {
  title?: string;
  author_name?: string;
}

export async function fetchVideoInfo(urlOrId: string): Promise<{ videoId: string; title: string; author: string; thumbnail: string }> {
  const videoId = getYouTubeId(urlOrId);
  if (!videoId) {
    throw new Error("URL o ID de YouTube inválido");
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  try {
    // We use a timeout to prevent hanging forever
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("No se pudo obtener información del video");
    
    const data: NoembedResult = await res.json();
    
    return {
      videoId,
      title: data.title || `Video de YouTube (${videoId})`,
      author: data.author_name || "Canal de YouTube",
      thumbnail
    };
  } catch (error) {
    return {
      videoId,
      title: `Video de YouTube (${videoId})`,
      author: `Vídeo: ${videoId}`,
      thumbnail
    };
  }
}
