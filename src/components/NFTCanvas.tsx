import { useCallback, useEffect, useRef, useState } from 'react';
import { useNFTSales, type NFTSale } from '@/hooks/useNFTSales';
import { Volume2, VolumeX, BarChart3 } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import PriceTicker from './PriceTicker';
import LiveSalesChart from './LiveSalesChart';

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
  return price * usdRate >= USD_PRICES['ETH'];
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
  const [showChart, setShowChart] = useState(false);
  const [whaleFlash, setWhaleFlash] = useState(false);
  const [whaleSwim, setWhaleSwim] = useState(false);
  const whaleSwimRef = useRef(false);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
    if (bgAudioRef.current) {
      bgAudioRef.current.muted = muted;
    }
    if (ambientAudioRef.current) {
      ambientAudioRef.current.muted = muted;
    }
  }, [muted]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
        bgAudioRef.current = null;
      }
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current = null;
      }
      if (ambientTimerRef.current) {
        clearTimeout(ambientTimerRef.current);
      }
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
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, 3000);
  }, []);

  const playSalePing = useCallback((chain?: string) => {
    if (mutedRef.current) return;
    const srcMap: Record<string, string> = {
      tezos: '/sounds/tezos-sale.wav',
      solana: '/sounds/solana-sale.wav',
    };
    const src = srcMap[chain || ''] || '/sounds/sale-ping.wav';
    const audio = new Audio(src);
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
      setWhaleFlash(true);
      setTimeout(() => setWhaleFlash(false), 2000);
      // Only trigger swim if not already swimming
      if (!whaleSwimRef.current) {
        whaleSwimRef.current = true;
        setWhaleSwim(true);
        setTimeout(() => {
          setWhaleSwim(false);
          whaleSwimRef.current = false;
        }, 3000);
      }
    } else {
      playSalePing(chain);
    }

    requestAnimationFrame(() => {
      const el = colRefs.current[chain];
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [playWhaleAlert, playSalePing]);

  const { countdown } = useNFTSales(handleSale);
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      // Play countdown tick sound
      if (countdownAudioRef.current) {
        countdownAudioRef.current.pause();
        countdownAudioRef.current.currentTime = 0;
      }
      const audio = new Audio('/sounds/countdown.wav');
      audio.volume = 0.4;
      countdownAudioRef.current = audio;
      audio.play().catch(() => {});
    }
    if (countdown === 0 || countdown === null) {
      if (countdownAudioRef.current) {
        countdownAudioRef.current.pause();
        countdownAudioRef.current = null;
      }
    }
  }, [countdown]);

  // Start bg music only after countdown ends
  useEffect(() => {
    if (countdown === null && !bgAudioRef.current) {
      const bgAudio = new Audio('/sounds/bg-loop.wav');
      bgAudio.loop = true;
      bgAudio.volume = 0.28;
      bgAudioRef.current = bgAudio;
      if (!mutedRef.current) bgAudio.play().catch(() => {});

      // Start ambient texture ~15s after sales begin
      ambientTimerRef.current = setTimeout(() => {
        if (!ambientAudioRef.current) {
          const ambient = new Audio('/sounds/ambient-texture.wav');
          ambient.loop = true;
          ambient.volume = 0.12;
          ambient.muted = mutedRef.current;
          ambientAudioRef.current = ambient;
          ambient.play().catch(() => {});
        }
      }, 15000);
    }
  }, [countdown]);

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
          <span style={{
            fontSize: 18,
            transition: 'all 0.3s',
            ...(whaleFlash ? {
              color: '#00ff88',
              textShadow: '0 0 12px rgba(0,255,136,0.8), 0 0 24px rgba(0,255,136,0.4)',
              animation: 'whale-flash 0.4s ease-in-out 4',
            } : {
              color: 'rgba(255,255,255,0.2)',
            }),
          }}>
            🐋
          </span>
          <style>{`
            @keyframes whale-flash {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(1.3); }
            }
          `}</style>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{ cursor: 'pointer', color: showChart ? '#00ff88' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}
            onClick={() => setShowChart(v => !v)}
          >
            <BarChart3 size={18} />
          </div>
          <div
            style={{ cursor: 'pointer', color: muted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)', transition: 'color 0.2s' }}
            onClick={() => setMuted(m => !m)}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </div>
        </div>
      </div>

      <PriceTicker />

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
              minWidth: 0,
              overflow: 'hidden',
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

      {/* Whale swim overlay */}
      {whaleSwim && (
        <div style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 50,
          overflow: 'hidden',
        }}>
          <video
            src="/whale-swim.mp4"
            autoPlay
            muted
            playsInline
            style={{
              position: 'absolute',
              width: 320,
              height: 320,
              bottom: 0,
              left: -320,
              mixBlendMode: 'screen',
              filter: 'brightness(1.3) contrast(1.2)',
              animation: 'whale-swim-across 4.5s ease-in-out forwards',
              opacity: 1,
            }}
          />
          <style>{`
            @keyframes whale-swim-across {
              0% { transform: translate(0, 0) scaleX(-1); }
              100% { transform: translate(calc(100vw + 640px), calc(-100vh - 320px)) scaleX(-1); }
            }
          `}</style>
        </div>
      )}

      {/* Chart overlay */}
      {showChart && <LiveSalesChart stats={stats} onClose={() => setShowChart(false)} />}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(8,8,12,0.9)',
          zIndex: 20,
          pointerEvents: 'none',
        }}>
          {/* Pulsing ring */}
          <div style={{
            position: 'relative',
            width: 160,
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(0,255,136,0.3)',
              animation: 'countdown-ring-pulse 1s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              inset: 10,
              borderRadius: '50%',
              border: '1px solid rgba(0,255,136,0.15)',
              animation: 'countdown-ring-pulse 1s ease-in-out infinite 0.2s',
            }} />
            <div
              key={countdown}
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: 80,
                fontWeight: 700,
                color: '#00ff88',
                textShadow: '0 0 40px rgba(0,255,136,0.6), 0 0 80px rgba(0,255,136,0.3), 0 0 120px rgba(0,255,136,0.1)',
                lineHeight: 1,
                animation: 'countdown-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              {countdown}
            </div>
          </div>
          <div style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 4,
            marginTop: 24,
            textTransform: 'uppercase',
          }}>
            Going live
          </div>
          <style>{`
            @keyframes countdown-pop {
              0% { transform: scale(2); opacity: 0; }
              50% { opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes countdown-ring-pulse {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

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
