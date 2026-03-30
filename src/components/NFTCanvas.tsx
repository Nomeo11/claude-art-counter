import { useCallback, useEffect, useRef, useState } from 'react';
import { useNFTSales, type NFTSale } from '@/hooks/useNFTSales';
import { Volume2, VolumeX } from 'lucide-react';
import logoImg from '@/assets/logo.png';

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

// Approximate USD prices for whale detection ($1000+)
const USD_PRICES: Record<string, number> = {
  ETH: 2050,
  SOL: 145,
  XTZ: 0.85,
  MATIC: 0.55,
  USD: 1,
};

function isWhale(price: number, currency: string): boolean {
  const usdRate = USD_PRICES[currency] || 1;
  return price * usdRate >= 1000;
}

function formatPrice(price: number, symbol: string): string {
  if (price < 0.01) return `${symbol} ${price.toFixed(4)}`;
  if (price >= 100) return `${symbol} ${price.toFixed(0)}`;
  if (price >= 1) return `${symbol} ${price.toFixed(2)}`;
  return `${symbol} ${price.toFixed(3)}`;
}

function SaleCard({ sale }: { sale: NFTSale }) {
  const config = CHAIN_CONFIG[sale.chain] || CHAIN_CONFIG.ethereum;
  const [imgError, setImgError] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const imageCandidates = sale.imageCandidates?.length ? sale.imageCandidates : sale.image ? [sale.image] : [];
  const activeImage = imageCandidates[imgIndex] || '';
  const isVideo = imgIndex === 0 && sale.mediaType?.startsWith('video/');

  const handleImageError = () => {
    if (imgIndex < imageCandidates.length - 1) {
      setImgIndex((current) => current + 1);
      return;
    }

    setImgError(true);
  };

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
        {activeImage && !imgError ? (
          isVideo ? (
            <video
              src={proxyImageUrl(activeImage)}
              onError={handleImageError}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                background: '#15151f',
              }}
            />
          ) : (
            <img
              src={proxyImageUrl(activeImage)}
              alt={sale.collection}
              onError={handleImageError}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                background: '#15151f',
              }}
              loading="lazy"
            />
          )
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
            No media
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
          fontSize: 13,
          color: 'rgba(255,255,255,0.65)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: sale.artist ? 2 : 4,
        }}>
          {sale.collection}
        </div>
        {sale.artist && (
          <div style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 17,
            color: config.color,
            opacity: 0.7,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}>
            by {sale.artist}
          </div>
        )}
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
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
    if (bgAudioRef.current) {
      bgAudioRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    const bgAudio = new Audio('/sounds/bg-loop.wav');
    bgAudio.loop = true;
    bgAudio.volume = 0.35;
    bgAudioRef.current = bgAudio;
    bgAudio.play().catch(() => {});

    return () => {
      bgAudio.pause();
    };
  }, []);

  // Sound refs for sale effects
  const whaleAudioRef = useRef<HTMLAudioElement | null>(null);
  const salePingRef = useRef<HTMLAudioElement | null>(null);

  const playWhaleAlert = useCallback(() => {
    if (mutedRef.current) return;
    // Stop any existing whale audio
    if (whaleAudioRef.current) {
      whaleAudioRef.current.pause();
      whaleAudioRef.current.currentTime = 0;
    }
    const audio = new Audio('/sounds/whale-alert.wav');
    audio.volume = 0.4;
    whaleAudioRef.current = audio;
    audio.play().catch(() => {});
    // Stop after 5 seconds
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, 5000);
  }, []);

  const playSalePing = useCallback(() => {
    if (mutedRef.current) return;
    const audio = new Audio('/sounds/sale-ping.wav');
    audio.volume = 0.15;
    audio.play().catch(() => {});
  }, []);

  const handleSale = useCallback((sale: NFTSale) => {
    const chain = CHAIN_ORDER.includes(sale.chain as any) ? sale.chain : 'ethereum';
    statsRef.current[chain] = (statsRef.current[chain] || 0) + 1;

    setColumns(prev => {
      const col = [sale, ...prev[chain]].slice(0, 50);
      return { ...prev, [chain]: col };
    });
    setStats({ ...statsRef.current });

    // Play sound based on value
    if (isWhale(sale.price, sale.currency)) {
      playWhaleAlert();
    } else {
      playSalePing();
    }

    requestAnimationFrame(() => {
      const el = colRefs.current[chain];
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [playWhaleAlert, playSalePing]);

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
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logoImg} alt="CC" style={{ width: 28, height: 28, borderRadius: 4 }} />
          <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>
            LIVE SALES
          </span>
        </div>
        <div
          style={{ cursor: 'pointer', color: muted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)', transition: 'color 0.2s' }}
          onClick={() => setMuted(m => !m)}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </div>
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
