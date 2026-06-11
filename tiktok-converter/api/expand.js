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
  // Si ya es una URL de escritorio válida (con @usuario), devolverla limpia
  if (url.includes("tiktok.com/@") && url.includes("/video/")) {
    const m = url.match(/tiktok\.com\/@[^/]+\/video\/\d+/);
    if (m) return "https://www." + m[0];
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  };

  // Primer intento: seguir redirect con fetch
  let finalUrl = null;
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers,
    });
    finalUrl = resp.url;
  } catch (e) {
    throw new Error("Fetch failed: " + e.message);
  }

  // Si la URL tiene @usuario válido, limpiar y devolver
  if (finalUrl && isValidTikTokUrl(finalUrl)) {
    return cleanUrl(finalUrl);
  }

  // Segundo intento: HEAD request para ver si el redirect va a una URL diferente
  try {
    const resp2 = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers,
    });
    if (isValidTikTokUrl(resp2.url)) {
      return cleanUrl(resp2.url);
    }
  } catch (_) {}

  // Tercer intento: leer el HTML y extraer la URL canónica o og:url
  try {
    const resp3 = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        ...headers,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    const html = await resp3.text();

    // Buscar og:url
    const ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i)?.[1]
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i)?.[1];
    if (ogUrl && isValidTikTokUrl(ogUrl)) return cleanUrl(ogUrl);

    // Buscar canonical
    const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
    if (canonical && isValidTikTokUrl(canonical)) return cleanUrl(canonical);

    // Buscar cualquier URL de video en el HTML
    const videoUrl = html.match(/https:\/\/www\.tiktok\.com\/@[^/"]+\/video\/\d+/)?.[0];
    if (videoUrl) return cleanUrl(videoUrl);

  } catch (_) {}

  // Si solo tenemos el video ID pero sin usuario, devolver igual (mejor que nada)
  if (finalUrl && finalUrl.includes("tiktok.com") && finalUrl.includes("/video/")) {
    return cleanUrl(finalUrl);
  }

  return null;
}

function isValidTikTokUrl(url) {
  return (
    url &&
    url.includes("tiktok.com") &&
    url.includes("/video/") &&
    url.includes("/@") &&
    !url.match(/\/@\/video\//) // excluir @vacío
  );
}

function cleanUrl(url) {
  try {
    const u = new URL(url);
    const keepParams = ["_r", "_t"];
    const params = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (keepParams.includes(k)) params.set(k, v);
    }
    const base = "https://www.tiktok.com" + u.pathname;
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  } catch {
    return url;
  }
}
