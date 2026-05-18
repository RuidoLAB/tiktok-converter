export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body;
  if (!url || typeof url !== "string") return res.status(400).json({ error: "Missing url" });

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    const finalUrl = response.url;

    if (!finalUrl.includes("tiktok.com") || finalUrl.includes("vt.tiktok.com") || finalUrl.includes("vm.tiktok.com")) {
      return res.status(422).json({ error: "Could not resolve to a TikTok URL" });
    }

    const clean = cleanUrl(finalUrl);
    return res.status(200).json({ result: clean });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
