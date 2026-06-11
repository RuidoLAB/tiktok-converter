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
  // Si ya es URL válida con @usuario
  if (isValidTikTokUrl(url)) return cleanUrl(url);

  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "identity",
    "Connection": "keep-alive",
  };

  // Paso 1: seguir redirect y obtener HTML
  const resp = await fetch(url, { method: "GET", redirect: "follow", headers });
  const finalUrl = resp.url;
  const html = await resp.text();

  // Paso 2: si la URL ya tiene @usuario, limpiar y devolver
  if (isValidTikTokUrl(finalUrl)) return cleanUrl(finalUrl);

  // Paso 3: buscar el username en __NEXT_DATA__ (JSON embebido en el HTML)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      // El username puede estar en varias rutas del JSON
      const author =
        data?.props?.pageProps?.itemInfo?.itemStruct?.author?.uniqueId ||
        data?.props?.pageProps?.videoData?.itemInfos?.authorName ||
        data?.props?.pageProps?.itemInfo?.itemStruct?.author?.id;
      const videoIdVal =
        data?.props?.pageProps?.itemInfo?.itemStruct?.id ||
        data?.props?.pageProps?.videoData?.itemInfos?.id;

      if (author && videoIdVal) {
        return `https://www.tiktok.com/@${author}/video/${videoIdVal}`;
      }
    } catch (_) {}
  }

  // Paso 4: buscar "uniqueId" en cualquier JSON del HTML
  const uniqueIdMatch = html.match(/"uniqueId"\s*:\s*"([^"]+)"/);
  const videoIdMatch = html.match(/"id"\s*:\s*"(\d{15,20})"/);
  if (uniqueIdMatch && videoIdMatch) {
    return `https://www.tiktok.com/@${uniqueIdMatch[1]}/video/${videoIdMatch[1]}`;
  }

  // Paso 5: buscar og:url o canonical
  const ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i)?.[1]
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i)?.[1];
  if (ogUrl && isValidTikTokUrl(ogUrl)) return cleanUrl(ogUrl);

  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
  if (canonical && isValidTikTokUrl(canonical)) return cleanUrl(canonical);

  // Paso 6: buscar cualquier URL de video en el HTML
  const videoUrl = html.match(/https:\/\/www\.tiktok\.com\/@[^/"\\]+\/video\/\d+/)?.[0];
  if (videoUrl) return cleanUrl(videoUrl);

  // Si todo falla, devolver lo que tenemos
  return finalUrl.includes("tiktok.com") ? cleanUrl(finalUrl) : null;
}

function isValidTikTokUrl(url) {
  return url && url.includes("tiktok.com/@") && url.includes("/video/") && !url.match(/\/@\/video\//);
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
