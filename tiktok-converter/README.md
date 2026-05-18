# TikTok Link Converter

Convierte links cortos de TikTok móvil (`vt.tiktok.com`, `vm.tiktok.com`) a URLs de escritorio limpias.

## Stack
- **Frontend**: HTML/CSS/JS estático (`/public/index.html`)
- **Backend**: Vercel Serverless Function (`/api/expand.js`)

## Deploy en Vercel (5 minutos)

1. **Sube el proyecto a GitHub**
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/TU_USUARIO/tiktok-converter.git
   git push -u origin main
   ```

2. **Conecta en Vercel**
   - Ve a [vercel.com](https://vercel.com) → New Project
   - Importa el repo de GitHub
   - **No necesitas configurar nada** — Vercel detecta todo automáticamente
   - Click en Deploy ✅

3. **Listo** — Vercel te da una URL pública tipo `tiktok-converter.vercel.app`

## Estructura
```
tiktok-converter/
├── api/
│   └── expand.js       ← Serverless function (sigue el redirect real)
├── public/
│   └── index.html      ← Frontend
├── vercel.json
├── package.json
└── README.md
```

## Cómo funciona
El navegador no puede seguir redirects de TikTok directamente (CORS).
La función `/api/expand` actúa como proxy: recibe el link corto,
hace el request desde el servidor con un User-Agent de Chrome,
y devuelve la URL final limpia.
