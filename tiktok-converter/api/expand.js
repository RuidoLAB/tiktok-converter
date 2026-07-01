export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body;
  if (!url || typeof url !== "string") return res.status(400).json({ error: "Missing url" });

  try {
    const result = await expandTikTok(url.trim());
    if (!result) return res.status(422).json({ error: "Could not resolve URL" });
    return res.status(200).json({ result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function expandTikTok(url) {
  // Si ya es URL válida con @usuario (video o photo)
  if (isValidTikTokUrl(url)) return cleanUrl(url);

  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "identity",
    "Connection": "keep-alive",
  };

  const resp = await fetch(url, { method: "GET", redirect: "follow", headers });
  const finalUrl = resp.url;
  const html = await resp.text();

  // Si la URL final ya tiene @usuario, limpiar y devolver
  if (isValidTikTokUrl(finalUrl)) return cleanUrl(finalUrl);

  // Buscar og:url o canonical primero — TikTok pone el tipo correcto (video/photo) ahí
  const ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i)?.[1]
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i)?.[1];
  if (ogUrl && isValidTikTokUrl(ogUrl)) return cleanUrl(ogUrl);

  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
  if (canonical && isValidTikTokUrl(canonical)) return cleanUrl(canonical);

  // Buscar en __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const item = data?.props?.pageProps?.itemInfo?.itemStruct;
      if (item) {
        const author = item?.author?.uniqueId;
        const id = item?.id;
        // Detectar si es photo o video
        const isPhoto = item?.imagePost || item?.mediaType === 'image' || (item?.imageList && item.imageList.length > 0);
        const type = isPhoto ? "photo" : "video";
        if (author && id) return `https://www.tiktok.com/@${author}/${type}/${id}`;
      }
    } catch (_) {}
  }

  // Buscar cualquier URL video o photo en el HTML
  const contentUrl = html.match(/https:\/\/www\.tiktok\.com\/@[^/"\\]+\/(video|photo)\/\d+/)?.[0];
  if (contentUrl) return cleanUrl(contentUrl);

  return finalUrl.includes("tiktok.com") ? cleanUrl(finalUrl) : null;
}

function isValidTikTokUrl(url) {
  return (
    url &&
    (url.includes("tiktok.com/@")) &&
    (url.includes("/video/") || url.includes("/photo/")) &&
    !url.match(/\/@\/(video|photo)\//)
  );
}

function cleanUrl(url) {
  try {
    const u = new URL(url);
    const keep = ["_r", "_t"];
    const p = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (keep.includes(k)) p.set(k, v);
    }
    const base = "https://www.tiktok.com" + u.pathname;
    const qs = p.toString();
    return qs ? base + "?" + qs : base;
  } catch { return url; }
}
