import { useCallback, useEffect, useRef, useState } from 'react';
import { useNFTSales, type NFTSale } from '@/hooks/useNFTSales';
import { Volume2, VolumeX } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function proxyImageUrl(url: string): string {
  if (!url) return '';
  return `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
}

const CHAIN_ORDER = ['ethereum', 'solana', 'tezos'] as const;

const CHAIN_CONFIG: Record<string, { label: string; color: string; symbol: string; glow: string }> = {
  ethereum: { label: 'ETHEREUM', color: '#627EEA', symbol: 'Ξ', glow: 'rgba(98,126,234,0.3)' },
  solana:   { label: 'SOLANA',   color: '#9945FF', symbol: '◎', glow: 'rgba(153,69,255,0.3)' },
  tezos:    { label: 'TEZOS',    color: '#2C7DF7', symbol: 'ꜩ', glow: 'rgba(44,125,247,0.3)' },
};

function formatPrice(price: number, symbol: string): string {
  if (price < 0.01) return `${symbol} ${price.toFixed(4)}`;
  if (price >= 100) return `${symbol} ${price.toFixed(0)}`;
  if (price >= 1) return `${symbol} ${price.toFixed(2)}`;
  return `${symbol} ${price.toFixed(3)}`;
}

function SaleCard({ sale }: { sale: NFTSale }) {
  const config = CHAIN_CONFIG[sale.chain] || CHAIN_CONFIG.ethereum;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="animate-in fade-in slide-in-from-top-4 duration-500"
      style={{
        background: 'rgba(18, 18, 26, 0.95)',
        border: `1px solid ${config.color}33`,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      {/* Image */}
      <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'rgba(35,35,50,0.8)', position: 'relative', overflow: 'hidden' }}>
        {sale.image && !imgError ? (
          <img
            src={proxyImageUrl(sale.image)}
            alt={sale.collection}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              background: '#15151f',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.15)',
            fontFamily: '"Space Mono", monospace',
            fontSize: 10,
          }}>
            No image
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        {/* Marketplace badge */}
        <div style={{
          display: 'inline-block',
          padding: '3px 8px',
          borderRadius: 4,
          background: `${config.color}22`,
          border: `1px solid ${config.color}44`,
          fontFamily: '"Space Mono", monospace',
          fontSize: 11,
          fontWeight: 700,
          color: config.color,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 6,
        }}>
          {sale.marketplace}
        </div>

        <div style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: 11,
          color: 'rgba(255,255,255,0.65)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: 4,
        }}>
          {sale.collection}
        </div>
        <div style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: 15,
          fontWeight: 700,
          color: config.color,
          textShadow: `0 0 8px ${config.glow}`,
          marginBottom: 4,
        }}>
          {formatPrice(sale.price, config.symbol)}
        </div>
        <div style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: 9,
          color: 'rgba(255,255,255,0.35)',
        }}>
          {new Date(sale.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

const CHAIN_SOUNDS: Record<string, string> = {
  ethereum: '/sounds/eth-sale.wav',
  solana: '/sounds/sol-sale.wav',
  tezos: '/sounds/tez-sale.wav',
};

const NFTLiveView = () => {
  const [columns, setColumns] = useState<Record<string, NFTSale[]>>({
    ethereum: [],
    solana: [],
    tezos: [],
  });
  const statsRef = useRef<Record<string, number>>({ ethereum: 0, solana: 0, tezos: 0 });
  const [stats, setStats] = useState<Record<string, number>>({ ethereum: 0, solana: 0, tezos: 0 });
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({ ethereum: null, solana: null, tezos: null });
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    for (const [chain, src] of Object.entries(CHAIN_SOUNDS)) {
      const audio = new Audio(src);
      audio.volume = 0.5;
      audioRefs.current[chain] = audio;
    }
  }, []);

  const playSound = useCallback((chain: string) => {
    if (mutedRef.current) return;
    const audio = audioRefs.current[chain];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }, []);

  const handleSale = useCallback((sale: NFTSale) => {
    const chain = CHAIN_ORDER.includes(sale.chain as any) ? sale.chain : 'ethereum';
    statsRef.current[chain] = (statsRef.current[chain] || 0) + 1;

    setColumns(prev => {
      const col = [sale, ...prev[chain]].slice(0, 50);
      return { ...prev, [chain]: col };
    });
    setStats({ ...statsRef.current });

    playSound(chain);

    requestAnimationFrame(() => {
      const el = colRefs.current[chain];
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [playSound]);

  useNFTSales(handleSale);

  const total = stats.ethereum + stats.solana + stats.tezos;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#08080C',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Space Mono", monospace',
      overflow: 'hidden',
    }}>
      {/* Mute toggle */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 14,
        zIndex: 10,
        cursor: 'pointer',
        color: muted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)',
        transition: 'color 0.2s',
      }} onClick={() => setMuted(m => !m)}>
        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </div>

      {/* 3-column grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 1,
        minHeight: 0,
      }}>
        {CHAIN_ORDER.map((chain) => {
          const config = CHAIN_CONFIG[chain];
          const count = stats[chain] || 0;
          const sales = columns[chain] || [];

          return (
            <div key={chain} style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: chain !== 'tezos' ? '1px solid rgba(255,255,255,0.06)' : 'none',
              minHeight: 0,
            }}>
              {/* Column header */}
              <div style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: config.color, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
                    {config.label}
                  </span>
                  <span style={{ color: config.color, fontWeight: 700, fontSize: 20, opacity: 0.8 }}>
                    {count}
                  </span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, marginTop: 2 }}>
                  {config.symbol} LIVE SALES
                </div>
              </div>

              {/* Scrollable card list */}
              <div
                ref={(el) => { colRefs.current[chain] = el; }}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '8px 8px',
                  minHeight: 0,
                }}
              >
                {sales.length === 0 && (
                  <div style={{
                    color: 'rgba(255,255,255,0.12)',
                    textAlign: 'center',
                    fontSize: 10,
                    marginTop: 40,
                  }}>
                    Waiting for sales…
                  </div>
                )}
                {sales.map((sale) => (
                  <SaleCard key={sale.id} sale={sale} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '6px 0',
        fontSize: 8,
        color: 'rgba(255,255,255,0.2)',
        flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        {total} SALES TRACKED · MULTI-CHAIN LIVE DATA
      </div>
    </div>
  );
};

export default NFTLiveView;
