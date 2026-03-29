import { useEffect, useRef, useCallback } from 'react';
import { useNFTSales, type NFTSale } from '@/hooks/useNFTSales';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function proxyImageUrl(url: string): string {
  if (!url) return '';
  return `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
}

interface SaleCard {
  sale: NFTSale;
  x: number;
  y: number;
  targetY: number;
  opacity: number;
  scale: number;
  loaded: boolean;
  img: HTMLImageElement | null;
  born: number;
}

const CHAIN_COLORS: Record<string, string> = {
  ethereum: '#627EEA',
  solana: '#9945FF',
  tezos: '#2C7DF7',
};

const CHAIN_SYMBOLS: Record<string, string> = {
  ethereum: 'Ξ',
  solana: '◎',
  tezos: 'ꜩ',
};

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): HTMLImageElement | null {
  if (!url) return null;
  const proxied = proxyImageUrl(url);
  if (imageCache.has(proxied)) {
    const cached = imageCache.get(proxied)!;
    return cached.complete && cached.naturalWidth > 0 ? cached : null;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = proxied;
  imageCache.set(proxied, img);
  return null;
}

const NFTCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardsRef = useRef<SaleCard[]>([]);
  const statsRef = useRef<Record<string, number>>({ ethereum: 0, solana: 0, tezos: 0 });
  const totalRef = useRef(0);
  const frameRef = useRef(0);

  const handleSale = useCallback((sale: NFTSale) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = canvas.width;
    const H = canvas.height;

    // Pre-load image
    if (sale.image) loadImage(sale.image);

    const CARD_W = 140;
    const cols = Math.floor((W - 40) / (CARD_W + 16));
    const totalCards = cardsRef.current.length;
    const col = totalCards % Math.max(cols, 3);
    const xPos = 30 + col * (CARD_W + 16) + Math.random() * 10;

    cardsRef.current.push({
      sale,
      x: xPos,
      y: -200,
      targetY: 70 + Math.random() * (H - 280),
      opacity: 0,
      scale: 0.8,
      loaded: false,
      img: null,
      born: Date.now(),
    });

    statsRef.current[sale.chain] = (statsRef.current[sale.chain] || 0) + 1;
    totalRef.current++;

    // Remove old cards to keep things flowing
    if (cardsRef.current.length > 30) {
      cardsRef.current = cardsRef.current.slice(-24);
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

    function drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
      ctx!.beginPath();
      ctx!.moveTo(x + r, y);
      ctx!.lineTo(x + w - r, y);
      ctx!.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx!.lineTo(x + w, y + h - r);
      ctx!.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx!.lineTo(x + r, y + h);
      ctx!.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx!.lineTo(x, y + r);
      ctx!.quadraticCurveTo(x, y, x + r, y);
      ctx!.closePath();
    }

    function loop() {
      frameRef.current++;
      const W = canvas!.width;
      const H = canvas!.height;

      // Dark background with slight fade for trailing effect
      ctx!.fillStyle = 'rgba(8, 8, 12, 0.15)';
      ctx!.fillRect(0, 0, W, H);

      // Every 60 frames, do a full clear to prevent ghosting
      if (frameRef.current % 60 === 0) {
        ctx!.fillStyle = '#08080C';
        ctx!.fillRect(0, 0, W, H);
      }

      const cards = cardsRef.current;
      const now = Date.now();

      for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i];
        const age = (now - c.born) / 1000;

        // Animate in
        c.y += (c.targetY - c.y) * 0.06;
        c.opacity = Math.min(c.opacity + 0.04, age > 12 ? Math.max(0, c.opacity - 0.02) : 1);
        c.scale = Math.min(c.scale + 0.015, 1);

        // Remove faded cards
        if (c.opacity <= 0 && age > 12) {
          cards.splice(i, 1);
          continue;
        }

        // Try to get image
        if (!c.loaded && c.sale.image) {
          const proxied = proxyImageUrl(c.sale.image);
          const cached = imageCache.get(proxied);
          if (cached?.complete && cached.naturalWidth > 0) {
            c.img = cached;
            c.loaded = true;
          }
        }

        const chainColor = CHAIN_COLORS[c.sale.chain] || '#888';
        const symbol = CHAIN_SYMBOLS[c.sale.chain] || '';
        const CARD_W = 140;
        const IMG_H = 120;
        const CARD_H = IMG_H + 60;

        ctx!.save();
        ctx!.globalAlpha = c.opacity;
        ctx!.translate(c.x + CARD_W / 2, c.y + CARD_H / 2);
        ctx!.scale(c.scale, c.scale);
        ctx!.translate(-(c.x + CARD_W / 2), -(c.y + CARD_H / 2));

        // Card background
        drawRoundedRect(c.x, c.y, CARD_W, CARD_H, 8);
        ctx!.fillStyle = 'rgba(20, 20, 28, 0.9)';
        ctx!.fill();

        // Border glow
        ctx!.strokeStyle = chainColor;
        ctx!.lineWidth = 1.5;
        ctx!.shadowColor = chainColor;
        ctx!.shadowBlur = 8;
        drawRoundedRect(c.x, c.y, CARD_W, CARD_H, 8);
        ctx!.stroke();
        ctx!.shadowBlur = 0;

        // Image
        if (c.img) {
          ctx!.save();
          drawRoundedRect(c.x + 4, c.y + 4, CARD_W - 8, IMG_H - 4, 6);
          ctx!.clip();
          ctx!.drawImage(c.img, c.x + 4, c.y + 4, CARD_W - 8, IMG_H - 4);
          ctx!.restore();
        } else {
          // Placeholder
          ctx!.fillStyle = 'rgba(40, 40, 55, 0.8)';
          drawRoundedRect(c.x + 4, c.y + 4, CARD_W - 8, IMG_H - 4, 6);
          ctx!.fill();
          ctx!.fillStyle = 'rgba(255,255,255,0.15)';
          ctx!.font = '400 10px "Space Mono", monospace';
          ctx!.textAlign = 'center';
          ctx!.fillText('Loading...', c.x + CARD_W / 2, c.y + IMG_H / 2);
        }

        // Chain badge
        const badgeW = 46;
        const badgeH = 14;
        const badgeX = c.x + CARD_W - badgeW - 6;
        const badgeY = c.y + 8;
        ctx!.fillStyle = chainColor;
        ctx!.globalAlpha = c.opacity * 0.85;
        drawRoundedRect(badgeX, badgeY, badgeW, badgeH, 3);
        ctx!.fill();
        ctx!.globalAlpha = c.opacity;
        ctx!.fillStyle = '#fff';
        ctx!.font = '700 8px "Space Mono", monospace';
        ctx!.textAlign = 'center';
        ctx!.fillText(c.sale.chain.toUpperCase().slice(0, 5), badgeX + badgeW / 2, badgeY + 10);

        // Collection name
        ctx!.textAlign = 'left';
        ctx!.font = '400 9px "Space Mono", monospace';
        ctx!.fillStyle = 'rgba(255,255,255,0.75)';
        const colName = c.sale.collection.length > 18 ? c.sale.collection.slice(0, 16) + '…' : c.sale.collection;
        ctx!.fillText(colName, c.x + 8, c.y + IMG_H + 16);

        // Price
        ctx!.font = '700 13px "Space Mono", monospace';
        ctx!.fillStyle = chainColor;
        ctx!.shadowColor = chainColor;
        ctx!.shadowBlur = 6;
        const priceStr = c.sale.price < 0.01
          ? `${symbol} ${c.sale.price.toFixed(4)}`
          : c.sale.price >= 100
            ? `${symbol} ${c.sale.price.toFixed(0)}`
            : c.sale.price >= 1
              ? `${symbol} ${c.sale.price.toFixed(2)}`
              : `${symbol} ${c.sale.price.toFixed(3)}`;
        ctx!.fillText(priceStr, c.x + 8, c.y + IMG_H + 34);
        ctx!.shadowBlur = 0;

        // Marketplace
        ctx!.font = '400 7px "Space Mono", monospace';
        ctx!.fillStyle = 'rgba(255,255,255,0.35)';
        ctx!.fillText(c.sale.marketplace, c.x + 8, c.y + IMG_H + 48);

        ctx!.restore();
      }

      ctx!.globalAlpha = 1;

      // ─── HUD ───
      // Title
      ctx!.textAlign = 'left';
      ctx!.font = '700 16px "Space Mono", monospace';
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.9;
      ctx!.fillText('NFT LIVE SALES', 24, 36);

      ctx!.font = '400 9px "Space Mono", monospace';
      ctx!.globalAlpha = 0.4;
      ctx!.fillText('ETHEREUM  ·  SOLANA  ·  TEZOS', 24, 52);

      // Total
      ctx!.textAlign = 'right';
      ctx!.font = '700 28px "Space Mono", monospace';
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.8;
      ctx!.fillText(totalRef.current.toLocaleString(), W - 24, 40);

      ctx!.font = '400 9px "Space Mono", monospace';
      ctx!.globalAlpha = 0.35;
      ctx!.fillText('SALES TRACKED', W - 24, 54);

      // Chain stats
      const chains = [
        { key: 'ethereum', label: 'ETH', color: CHAIN_COLORS.ethereum },
        { key: 'solana', label: 'SOL', color: CHAIN_COLORS.solana },
        { key: 'tezos', label: 'XTZ', color: CHAIN_COLORS.tezos },
      ];
      ctx!.textAlign = 'right';
      let sx = W - 24;
      for (const ch of chains.reverse()) {
        const count = statsRef.current[ch.key] || 0;
        ctx!.globalAlpha = 0.7;
        ctx!.font = '400 9px "Space Mono", monospace';
        ctx!.fillStyle = '#fff';
        ctx!.fillText(`${count}`, sx, 70);
        sx -= 30;
        ctx!.fillStyle = ch.color;
        ctx!.font = '700 9px "Space Mono", monospace';
        ctx!.fillText(ch.label, sx, 70);
        sx -= 50;
      }

      // Footer
      ctx!.textAlign = 'center';
      ctx!.font = '400 9px "Space Mono", monospace';
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.2;
      ctx!.fillText('MULTI-CHAIN NFT SALES  ·  LIVE DATA', W / 2, H - 12);

      ctx!.globalAlpha = 1;
      animId = requestAnimationFrame(loop);
    }

    document.fonts.ready.then(() => loop());

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ background: '#08080C' }}
    />
  );
};

export default NFTCanvas;
