const API_BASES = [
  "https://studio-api.prod.suno.com",
  "https://studio-api-prod.suno.com"
];

const PLAYLIST_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeClip(entry) {
  const clip = entry && (entry.clip || entry);
  if (!clip || !clip.id) return null;

  return {
    id: clip.id,
    title: clip.title || "Sem título",
    image_url: clip.image_url || clip.image_large_url || "",
    artist: clip.display_name || clip.handle || clip.artist || ""
  };
}

exports.handler = async (event) => {
  const id = (event.queryStringParameters && event.queryStringParameters.id) || "";

  if (!PLAYLIST_RE.test(id)) {
    return {
      statusCode: 400,
      headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"},
      body: JSON.stringify({error:"ID de playlist inválido."})
    };
  }

  let lastError = null;

  for (const base of API_BASES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${base}/api/playlist/${id}/`, {
        signal: controller.signal,
        headers: {"Accept":"application/json","User-Agent":"Mozilla/5.0 Suno-Playlist-PWA/2.0"}
      });

      clearTimeout(timer);
      if (!response.ok) throw new Error(`${base}: HTTP ${response.status}`);

      const data = await response.json();
      const rows = Array.isArray(data.playlist_clips) ? data.playlist_clips : [];
      const seen = new Set();
      const tracks = rows
        .map(normalizeClip)
        .filter(Boolean)
        .filter(track => !seen.has(track.id) && seen.add(track.id));

      if (!tracks.length) throw new Error(`${base}: playlist sem faixas disponíveis`);

      return {
        statusCode: 200,
        headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60, s-maxage=300"},
        body: JSON.stringify({
          playlist_id:id,
          title:data.name || data.title || "Playlist Suno",
          tracks
        })
      };
    } catch (err) {
      lastError = err;
    }
  }

  return {
    statusCode: 502,
    headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"},
    body: JSON.stringify({
      error:"Não foi possível carregar a playlist do Suno.",
      detail:String((lastError && lastError.message) || lastError || "Erro desconhecido")
    })
  };
};
