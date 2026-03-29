import { useEffect, useRef, useCallback } from 'react';
import { useNFTSales, type NFTSale } from '@/hooks/useNFTSales';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function proxyImageUrl(url: string): string {
  return `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  bright: number;
  r: number;
  g: number;
  b: number;
}

interface SaleLabel {
  text: string;
  collection: string;
  marketplace: string;
  x: number;
  y: number;
  life: number;
  color: string;
  big: boolean;
  imageUrl?: string;
}

const MARKET_COLORS: Record<string, { color: string; r: number; g: number; b: number }> = {
  OPENSEA:    { color: '#3B8EEA', r: 59,  g: 142, b: 234 },
  BLUR:       { color: '#FF6B00', r: 255, g: 107, b: 0   },
  FOUNDATION: { color: '#F0ECD8', r: 240, g: 236, b: 216 },
  SUPERRARE:  { color: '#FF2D6B', r: 255, g: 45,  b: 107 },
  LOOKSRARE:  { color: '#0CE466', r: 12,  g: 228, b: 102 },
  X2Y2:       { color: '#9B59B6', r: 155, g: 89,  b: 182 },
  RARIBLE:    { color: '#FEDA03', r: 254, g: 218, b: 3   },
  UNKNOWN:    { color: '#888888', r: 136, g: 136, b: 136 },
};

function getColor(marketplace: string) {
  return MARKET_COLORS[marketplace] || MARKET_COLORS.UNKNOWN;
}

// Image cache to avoid re-loading
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): HTMLImageElement | null {
  const proxied = proxyImageUrl(url);
  if (imageCache.has(url)) {
    const cached = imageCache.get(url)!;
    if (cached.complete && cached.naturalWidth > 0) return cached;
    return null;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = proxied;
  img.onload = () => imageCache.set(url, img);
  img.onerror = () => {};
  imageCache.set(url, img); // store early so we don't re-request
  return null;
}

const NFTCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const labelsRef = useRef<SaleLabel[]>([]);
  const statsRef = useRef<Record<string, number>>({});
  const totalRef = useRef(0);
  const frameRef = useRef(0);
  const recentSalesRef = useRef<Array<{ text: string; color: string; time: number; image?: string }>>([]);

  const handleSale = useCallback((sale: NFTSale) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = canvas.width;
    const H = canvas.height;
    const mc = getColor(sale.marketplace);
    const big = sale.price > 5;

    const originX = 120 + Math.random() * (W - 240);
    const originY = 120 + Math.random() * (H - 240);

    const n = big ? 40 + Math.floor(Math.random() * 30) : 8 + Math.floor(Math.random() * 16);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = big ? 0.8 + Math.random() * 3.5 : 0.1 + Math.random() * 1.5;
      const spread = big ? 40 : 20;

      particlesRef.current.push({
        x: originX + (Math.random() - 0.5) * spread,
        y: originY + (Math.random() - 0.5) * spread,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.7 + Math.random() * 0.3,
        decay: big ? 0.002 + Math.random() * 0.003 : 0.001 + Math.random() * 0.002,
        size: big ? 1.5 + Math.random() * 3 : 0.6 + Math.random() * 1.8,
        bright: big ? 1 : 0.5 + Math.random() * 0.5,
        r: mc.r,
        g: mc.g,
        b: mc.b,
      });
    }

    const priceStr = sale.price < 0.01
      ? `Ξ ${sale.price.toFixed(4)}`
      : sale.price >= 1
        ? `Ξ ${sale.price.toFixed(2)}`
        : `Ξ ${sale.price.toFixed(3)}`;

    // Pre-load image
    if (sale.image) {
      loadImage(sale.image);
    }

    labelsRef.current.push({
      text: priceStr,
      collection: sale.collection.length > 22 ? sale.collection.slice(0, 20) + '…' : sale.collection,
      marketplace: sale.marketplace,
      x: originX,
      y: originY,
      life: 1,
      color: mc.color,
      big,
      imageUrl: sale.image,
    });

    statsRef.current[sale.marketplace] = (statsRef.current[sale.marketplace] || 0) + 1;
    totalRef.current++;

    recentSalesRef.current.unshift({
      text: `${sale.collection} — ${priceStr}`,
      color: mc.color,
      time: Date.now(),
      image: sale.image,
    });
    if (recentSalesRef.current.length > 8) recentSalesRef.current.pop();

    if (particlesRef.current.length > 3000) {
      particlesRef.current = particlesRef.current.slice(-2000);
    }
  }, []);

  useNFTSales(handleSale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    let animId: number;

    function loop() {
      frameRef.current++;
      const W = canvas!.width;
      const H = canvas!.height;

      ctx!.fillStyle = 'rgba(0,0,0,0.06)';
      ctx!.fillRect(0, 0, W, H);

      // Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.978;
        p.vy *= 0.978;
        p.vy += 0.005;
        p.life -= p.decay;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const a = p.life * p.bright;
        ctx!.globalAlpha = a;
        ctx!.shadowColor = `rgb(${p.r},${p.g},${p.b})`;
        ctx!.shadowBlur = 8;
        ctx!.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.shadowBlur = 0;

      // Labels with NFT images
      const labels = labelsRef.current;
      for (let i = labels.length - 1; i >= 0; i--) {
        const l = labels[i];
        l.y -= 0.3;
        l.life -= 0.004;

        if (l.life <= 0) {
          labels.splice(i, 1);
          continue;
        }

        const a = Math.min(l.life, 1);

        // Draw NFT thumbnail
        const imgSize = l.big ? 48 : 32;
        const imgY = l.y - imgSize - 20;

        // Look up image from cache
        const img = l.imageUrl ? imageCache.get(l.imageUrl) : undefined;
        const hasImg = img && img.complete && img.naturalWidth > 0;

        if (hasImg) {
          ctx!.globalAlpha = a * 0.85;
          ctx!.save();

          // Rounded rectangle clip for thumbnail
          const ix = l.x - imgSize / 2;
          const iy = imgY;
          const radius = l.big ? 6 : 4;

          ctx!.beginPath();
          ctx!.moveTo(ix + radius, iy);
          ctx!.lineTo(ix + imgSize - radius, iy);
          ctx!.quadraticCurveTo(ix + imgSize, iy, ix + imgSize, iy + radius);
          ctx!.lineTo(ix + imgSize, iy + imgSize - radius);
          ctx!.quadraticCurveTo(ix + imgSize, iy + imgSize, ix + imgSize - radius, iy + imgSize);
          ctx!.lineTo(ix + radius, iy + imgSize);
          ctx!.quadraticCurveTo(ix, iy + imgSize, ix, iy + imgSize - radius);
          ctx!.lineTo(ix, iy + radius);
          ctx!.quadraticCurveTo(ix, iy, ix + radius, iy);
          ctx!.closePath();
          ctx!.clip();

          ctx!.drawImage(img, ix, iy, imgSize, imgSize);
          ctx!.restore();

          // Glow border
          ctx!.globalAlpha = a * 0.4;
          ctx!.strokeStyle = l.color;
          ctx!.shadowColor = l.color;
          ctx!.shadowBlur = l.big ? 12 : 6;
          ctx!.lineWidth = 1.5;
          ctx!.beginPath();
          ctx!.moveTo(ix + radius, iy);
          ctx!.lineTo(ix + imgSize - radius, iy);
          ctx!.quadraticCurveTo(ix + imgSize, iy, ix + imgSize, iy + radius);
          ctx!.lineTo(ix + imgSize, iy + imgSize - radius);
          ctx!.quadraticCurveTo(ix + imgSize, iy + imgSize, ix + imgSize - radius, iy + imgSize);
          ctx!.lineTo(ix + radius, iy + imgSize);
          ctx!.quadraticCurveTo(ix, iy + imgSize, ix, iy + imgSize - radius);
          ctx!.lineTo(ix, iy + radius);
          ctx!.quadraticCurveTo(ix, iy, ix + radius, iy);
          ctx!.closePath();
          ctx!.stroke();
          ctx!.shadowBlur = 0;
        }

        // Collection name
        ctx!.globalAlpha = a * 0.9;
        ctx!.textAlign = 'center';
        ctx!.font = `400 ${l.big ? 10 : 8}px "Space Mono", monospace`;
        ctx!.fillStyle = 'rgba(255,255,255,0.7)';
        ctx!.fillText(l.collection, l.x, l.y - 14);

        // Price
        ctx!.font = `700 ${l.big ? 14 : 11}px "Space Mono", monospace`;
        ctx!.fillStyle = l.color;
        ctx!.shadowColor = l.color;
        ctx!.shadowBlur = l.big ? 16 : 6;
        ctx!.fillText(l.text, l.x, l.y);
        ctx!.shadowBlur = 0;

        // Marketplace
        ctx!.font = `400 7px "Space Mono", monospace`;
        ctx!.fillStyle = 'rgba(255,255,255,0.35)';
        ctx!.fillText(l.marketplace, l.x, l.y + 12);
      }

      ctx!.globalAlpha = 1;

      // Title
      ctx!.textAlign = 'left';
      ctx!.font = '700 16px "Space Mono", monospace';
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.9;
      ctx!.fillText('NFT LIVE TRANSACTIONS', 24, 36);

      ctx!.font = '400 9px "Space Mono", monospace';
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.35;
      ctx!.fillText('ETHEREUM  ·  SIMULATED LIVE DATA', 24, 52);

      // Total counter
      ctx!.textAlign = 'right';
      ctx!.font = '700 28px "Space Mono", monospace';
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.8;
      ctx!.fillText(totalRef.current.toLocaleString(), W - 24, 40);

      ctx!.font = '400 9px "Space Mono", monospace';
      ctx!.globalAlpha = 0.35;
      ctx!.fillText('SALES TRACKED', W - 24, 54);

      // Marketplace stats
      const stats = Object.entries(statsRef.current).sort((a, b) => b[1] - a[1]);
      ctx!.textAlign = 'left';
      let sy = 80;
      for (const [market, count] of stats.slice(0, 8)) {
        const mc = getColor(market);
        const pulse = 0.5 + 0.5 * Math.sin(frameRef.current * 0.06 + sy * 0.1);
        ctx!.globalAlpha = 0.6 + pulse * 0.4;
        ctx!.fillStyle = mc.color;
        ctx!.shadowColor = mc.color;
        ctx!.shadowBlur = 4 * pulse;
        ctx!.beginPath();
        ctx!.arc(30, sy - 4, 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;

        ctx!.globalAlpha = 0.7;
        ctx!.font = '700 10px "Space Mono", monospace';
        ctx!.fillStyle = mc.color;
        ctx!.fillText(market, 40, sy);

        ctx!.globalAlpha = 0.5;
        ctx!.font = '400 10px "Space Mono", monospace';
        ctx!.fillStyle = '#ffffff';
        ctx!.fillText(count.toLocaleString(), 140, sy);

        sy += 20;
      }

      // Recent sales feed
      const recent = recentSalesRef.current;
      ctx!.textAlign = 'left';
      let ry = H - 24;
      for (let i = 0; i < recent.length; i++) {
        const r = recent[i];
        const age = (Date.now() - r.time) / 1000;
        const alpha = Math.max(0, 1 - age / 30) * (1 - i * 0.1);
        if (alpha <= 0) continue;

        ctx!.globalAlpha = alpha * 0.6;
        ctx!.font = '400 8px "Space Mono", monospace';
        ctx!.fillStyle = r.color;
        ctx!.fillText('●', 24, ry);
        ctx!.fillStyle = '#ffffff';
        ctx!.globalAlpha = alpha * 0.45;
        ctx!.fillText(r.text.length > 50 ? r.text.slice(0, 48) + '…' : r.text, 36, ry);
        ry -= 16;
      }

      // Footer
      ctx!.textAlign = 'center';
      ctx!.font = '400 9px "Space Mono", monospace';
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.2;
      ctx!.fillText('NFT MARKETPLACE ACTIVITY  ·  SIMULATED LIVE DATA  ·  ETHEREUM', W / 2, H - 12);

      ctx!.globalAlpha = 1;

      animId = requestAnimationFrame(loop);
    }

    document.fonts.ready.then(() => {
      loop();
    });

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full bg-background"
    />
  );
};

export default NFTCanvas;
