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
  column: number; // which chain column: 0=eth, 1=sol, 2=tez
}

const CHAIN_ORDER = ['ethereum', 'solana', 'tezos'];
const CHAIN_LABELS = ['ETHEREUM', 'SOLANA', 'TEZOS'];

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

  // Track per-column card count for stacking
  const colCountRef = useRef<Record<number, number>>({ 0: 0, 1: 0, 2: 0 });

  const handleSale = useCallback((sale: NFTSale) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const H = canvas.height;

    // Pre-load image
    if (sale.image) loadImage(sale.image);

    const colIdx = CHAIN_ORDER.indexOf(sale.chain);
    const column = colIdx >= 0 ? colIdx : 0;

    // Stack cards within column
    const HEADER_Y = 80;
    const CARD_H_TOTAL = 190;
    const maxVisible = Math.floor((H - HEADER_Y - 40) / (CARD_H_TOTAL + 10));

    // Count existing cards in this column
    const colCards = cardsRef.current.filter(c => c.column === column);
    const slot = colCards.length % Math.max(maxVisible, 2);
    const targetY = HEADER_Y + slot * (CARD_H_TOTAL + 10);

    cardsRef.current.push({
      sale,
      x: 0, // will be computed in render based on column
      y: -200,
      targetY,
      opacity: 0,
      scale: 0.8,
      loaded: false,
      img: null,
      born: Date.now(),
      column,
    });

    statsRef.current[sale.chain] = (statsRef.current[sale.chain] || 0) + 1;
    totalRef.current++;

    // Remove oldest cards per column to keep flowing
    const perCol = [
      cardsRef.current.filter(c => c.column === 0),
      cardsRef.current.filter(c => c.column === 1),
      cardsRef.current.filter(c => c.column === 2),
    ];
    for (let ci = 0; ci < 3; ci++) {
      if (perCol[ci].length > Math.max(maxVisible, 3)) {
        const oldest = perCol[ci][0];
        const idx = cardsRef.current.indexOf(oldest);
        if (idx >= 0) cardsRef.current.splice(idx, 1);
      }
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

      // Full clear every frame for clean columns
      ctx!.fillStyle = '#08080C';
      ctx!.fillRect(0, 0, W, H);

      // Column layout
      const COL_GAP = 12;
      const SIDE_PAD = 16;
      const colW = (W - SIDE_PAD * 2 - COL_GAP * 2) / 3;
      const HEADER_Y = 70;

      // Draw column headers + dividers
      for (let ci = 0; ci < 3; ci++) {
        const colX = SIDE_PAD + ci * (colW + COL_GAP);
        const chainColor = CHAIN_COLORS[CHAIN_ORDER[ci]];
        const count = statsRef.current[CHAIN_ORDER[ci]] || 0;

        // Column header background
        ctx!.fillStyle = 'rgba(255,255,255,0.03)';
        drawRoundedRect(colX, 8, colW, 52, 6);
        ctx!.fill();

        // Chain name
        ctx!.textAlign = 'left';
        ctx!.font = '700 13px "Space Mono", monospace';
        ctx!.fillStyle = chainColor;
        ctx!.globalAlpha = 0.9;
        ctx!.fillText(CHAIN_LABELS[ci], colX + 12, 32);

        // Count
        ctx!.textAlign = 'right';
        ctx!.font = '700 18px "Space Mono", monospace';
        ctx!.fillStyle = chainColor;
        ctx!.globalAlpha = 0.7;
        ctx!.fillText(count.toLocaleString(), colX + colW - 12, 35);

        // Subtitle
        ctx!.textAlign = 'left';
        ctx!.font = '400 8px "Space Mono", monospace';
        ctx!.fillStyle = 'rgba(255,255,255,0.35)';
        ctx!.globalAlpha = 1;
        ctx!.fillText(`${CHAIN_SYMBOLS[CHAIN_ORDER[ci]]} LIVE SALES`, colX + 12, 48);

        // Divider line
        if (ci < 2) {
          const divX = colX + colW + COL_GAP / 2;
          ctx!.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(divX, 8);
          ctx!.lineTo(divX, H - 30);
          ctx!.stroke();
        }
      }

      // Draw cards
      const cards = cardsRef.current;
      const now = Date.now();
      const CARD_PAD = 8;
      const CARD_W = colW - CARD_PAD * 2;
      const IMG_H = Math.min(CARD_W * 0.85, 110);
      const CARD_H = IMG_H + 56;

      for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i];
        const age = (now - c.born) / 1000;

        // Compute x from column
        const colX = SIDE_PAD + c.column * (colW + COL_GAP) + CARD_PAD;
        c.x = colX;

        // Animate
        c.y += (c.targetY - c.y) * 0.08;
        c.opacity = Math.min(c.opacity + 0.05, age > 15 ? Math.max(0, c.opacity - 0.03) : 1);
        c.scale = Math.min(c.scale + 0.02, 1);

        if (c.opacity <= 0 && age > 15) {
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

        ctx!.save();
        ctx!.globalAlpha = c.opacity;
        ctx!.translate(c.x + CARD_W / 2, c.y + CARD_H / 2);
        ctx!.scale(c.scale, c.scale);
        ctx!.translate(-(c.x + CARD_W / 2), -(c.y + CARD_H / 2));

        // Card bg
        drawRoundedRect(c.x, c.y, CARD_W, CARD_H, 8);
        ctx!.fillStyle = 'rgba(18, 18, 26, 0.95)';
        ctx!.fill();

        // Border
        ctx!.strokeStyle = chainColor;
        ctx!.lineWidth = 1;
        ctx!.globalAlpha = c.opacity * 0.5;
        drawRoundedRect(c.x, c.y, CARD_W, CARD_H, 8);
        ctx!.stroke();
        ctx!.globalAlpha = c.opacity;

        // Image
        if (c.img) {
          ctx!.save();
          drawRoundedRect(c.x + 4, c.y + 4, CARD_W - 8, IMG_H - 4, 6);
          ctx!.clip();
          ctx!.drawImage(c.img, c.x + 4, c.y + 4, CARD_W - 8, IMG_H - 4);
          ctx!.restore();
        } else {
          ctx!.fillStyle = 'rgba(35, 35, 50, 0.8)';
          drawRoundedRect(c.x + 4, c.y + 4, CARD_W - 8, IMG_H - 4, 6);
          ctx!.fill();
          ctx!.fillStyle = 'rgba(255,255,255,0.12)';
          ctx!.font = '400 9px "Space Mono", monospace';
          ctx!.textAlign = 'center';
          ctx!.fillText('Loading...', c.x + CARD_W / 2, c.y + IMG_H / 2);
        }

        // Collection
        ctx!.textAlign = 'left';
        ctx!.font = '400 9px "Space Mono", monospace';
        ctx!.fillStyle = 'rgba(255,255,255,0.7)';
        const maxChars = Math.floor(CARD_W / 7);
        const colName = c.sale.collection.length > maxChars ? c.sale.collection.slice(0, maxChars - 1) + '…' : c.sale.collection;
        ctx!.fillText(colName, c.x + 8, c.y + IMG_H + 14);

        // Price
        ctx!.font = '700 12px "Space Mono", monospace';
        ctx!.fillStyle = chainColor;
        const priceStr = c.sale.price < 0.01
          ? `${symbol} ${c.sale.price.toFixed(4)}`
          : c.sale.price >= 100
            ? `${symbol} ${c.sale.price.toFixed(0)}`
            : c.sale.price >= 1
              ? `${symbol} ${c.sale.price.toFixed(2)}`
              : `${symbol} ${c.sale.price.toFixed(3)}`;
        ctx!.fillText(priceStr, c.x + 8, c.y + IMG_H + 30);

        // Marketplace
        ctx!.font = '400 7px "Space Mono", monospace';
        ctx!.fillStyle = 'rgba(255,255,255,0.3)';
        ctx!.fillText(c.sale.marketplace, c.x + 8, c.y + IMG_H + 44);

        ctx!.restore();
      }

      // Footer
      ctx!.globalAlpha = 1;
      ctx!.textAlign = 'center';
      ctx!.font = '400 8px "Space Mono", monospace';
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.2;
      ctx!.fillText(`${totalRef.current} SALES TRACKED  ·  MULTI-CHAIN LIVE DATA`, W / 2, H - 10);

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
