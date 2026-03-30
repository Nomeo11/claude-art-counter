import { useCallback, useEffect, useRef, useState } from 'react';
import { useNFTSales, type NFTSale } from '@/hooks/useNFTSales';
import { Volume2, VolumeX, BarChart3 } from 'lucide-react';
import logoImg from '@/assets/cc-logo.png';
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

function SaleCard({ sale, isWhaleSale }: { sale: NFTSale; isWhaleSale?: boolean }) {
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
        border: isWhaleSale ? '2px solid rgba(255, 200, 50, 0.7)' : `1px solid ${config.color}33`,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 10,
        boxShadow: isWhaleSale
          ? '0 0 12px rgba(255, 200, 50, 0.4), 0 0 30px rgba(255, 180, 0, 0.2), inset 0 0 12px rgba(255, 200, 50, 0.05)'
          : 'none',
        animation: isWhaleSale ? 'whale-card-glow 2s ease-in-out infinite alternate' : undefined,
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
  const [whaleSwim, setWhaleSwim] = useState<false | 'left' | 'right'>(false);
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
      setWhaleIds(prev => new Set([...prev, sale.id]));
      playWhaleAlert();
      setWhaleFlash(true);
      setTimeout(() => setWhaleFlash(false), 2000);
      // Only trigger swim if not already swimming
      if (!whaleSwimRef.current) {
        whaleSwimRef.current = true;
        const dir = Math.random() > 0.5 ? 'right' : 'left';
        setWhaleSwim(dir);
        setTimeout(() => {
          setWhaleSwim(false);
          whaleSwimRef.current = false;
        }, 7000);
      }
    } else {
      playSalePing(chain);
    }

    requestAnimationFrame(() => {
      const el = colRefs.current[chain];
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [playWhaleAlert, playSalePing]);

  const { countdown, waitingForGo, startCountdown } = useNFTSales(handleSale);
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
              color: '#FF8C00',
              textShadow: '0 0 12px rgba(255,140,0,0.8), 0 0 24px rgba(255,140,0,0.4)',
              animation: 'whale-flash 0.4s ease-in-out 4',
            } : {
              color: 'rgba(255,255,255,0.2)',
            }),
          }}>
            🐋
          </span>
          {whaleFlash && (
            <span style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: 11,
              fontWeight: 700,
              color: '#FF8C00',
              textShadow: '0 0 10px rgba(255,140,0,0.6)',
              letterSpacing: 1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              animation: 'whale-typewriter 0.6s steps(12) forwards',
              borderRight: '2px solid #FF8C00',
            }}>
              WHALE MINT!!!
            </span>
          )}
          <style>{`
            @keyframes whale-flash {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(1.3); }
            }
            @keyframes whale-typewriter {
              0% { width: 0; }
              100% { width: 12ch; }
            }
          `}</style>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{ cursor: 'pointer', color: showChart ? '#FF8C00' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}
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
                {sales.map((sale, idx) => (
                  <SaleCard key={`${sale.id}-${sale.timestamp}-${idx}`} sale={sale} />
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
            key={whaleSwim}
            src="/whale-swim.webm"
            autoPlay
            muted
            playsInline
            style={{
              position: 'absolute',
              width: 320,
              height: 320,
              filter: 'brightness(1.3) drop-shadow(0 0 20px rgba(100,180,255,0.6)) drop-shadow(0 0 40px rgba(100,180,255,0.3))',
              objectFit: 'contain',
              background: 'transparent',
              ...(whaleSwim === 'left' ? {
                bottom: 0,
                left: -320,
                animation: 'whale-swim-left-to-right 7s ease-in-out forwards',
              } : {
                bottom: 0,
                right: -320,
                animation: 'whale-swim-right-to-left 7s ease-in-out forwards',
              }),
            }}
          />
          <style>{`
            @keyframes whale-swim-left-to-right {
              0% { transform: translate(0, 0) scaleX(-1); }
              100% { transform: translate(calc(100vw + 640px), calc(-100vh - 320px)) scaleX(-1); }
            }
            @keyframes whale-swim-right-to-left {
              0% { transform: translate(0, 0); }
              100% { transform: translate(calc(-100vw - 640px), calc(-100vh - 320px)); }
            }
            }
          `}</style>
        </div>
      )}

      {/* Chart overlay */}
      {showChart && <LiveSalesChart stats={stats} onClose={() => setShowChart(false)} />}

        {/* Splash / Countdown overlay — Curious Cadence themed */}
      {(waitingForGo || countdown !== null) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at center, rgba(20,20,30,0.95) 0%, rgba(8,8,12,0.98) 70%)',
          zIndex: 20,
          pointerEvents: waitingForGo ? 'auto' : 'none',
          gap: 28,
        }}>
          {/* Logo */}
          <img src={logoImg} alt="Curious Cadence" style={{ width: 72, height: 72, borderRadius: 12, marginBottom: 8, boxShadow: '0 0 30px rgba(255,140,0,0.3)' }} />

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: 3 }}>
              ON CHAIN TOKEN
            </div>
            <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 16, fontWeight: 700, color: '#FF8C00', letterSpacing: 5, marginTop: 4 }}>
              LIVE SALES
            </div>
          </div>

          {/* Chain boxes */}
          <div style={{ display: 'flex', gap: 24 }}>
            {CHAIN_ORDER.map(chain => {
              const cfg = CHAIN_CONFIG[chain];
              return (
                <div key={chain} style={{
                  border: '1px solid rgba(255,140,0,0.35)',
                  borderRadius: 10,
                  padding: '16px 28px',
                  textAlign: 'center',
                  background: 'rgba(255,140,0,0.04)',
                  minWidth: 120,
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginBottom: 6 }}>{cfg.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#FF8C00', letterSpacing: 1 }}>{cfg.label === 'ETHEREUM' ? 'ETH' : cfg.label === 'SOLANA' ? 'SOL' : 'XTZ'}</div>
                </div>
              );
            })}
          </div>

          {waitingForGo ? (
            /* GO button */
            <div
              onClick={startCountdown}
              style={{
                marginTop: 12,
                cursor: 'pointer',
                width: 100,
                height: 100,
                borderRadius: '50%',
                border: '2px solid #FF8C00',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Space Mono", monospace',
                fontSize: 24,
                fontWeight: 700,
                color: '#FF8C00',
                textShadow: '0 0 20px rgba(255,140,0,0.6)',
                boxShadow: '0 0 30px rgba(255,140,0,0.2), inset 0 0 20px rgba(255,140,0,0.1)',
                animation: 'go-pulse 1.5s ease-in-out infinite',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,140,0,0.15)';
                e.currentTarget.style.boxShadow = '0 0 40px rgba(255,140,0,0.4), inset 0 0 30px rgba(255,140,0,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(255,140,0,0.2), inset 0 0 20px rgba(255,140,0,0.1)';
              }}
            >
              GO
            </div>
          ) : (
            /* Countdown ring */
            <div style={{
              position: 'relative',
              width: 100,
              height: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid rgba(255,140,0,0.3)',
                animation: 'countdown-ring-pulse 1s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute',
                inset: 8,
                borderRadius: '50%',
                border: '1px solid rgba(255,140,0,0.15)',
                animation: 'countdown-ring-pulse 1s ease-in-out infinite 0.2s',
              }} />
              <div
                key={countdown}
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: 48,
                  fontWeight: 700,
                  color: '#FF8C00',
                  textShadow: '0 0 40px rgba(255,140,0,0.6), 0 0 80px rgba(255,140,0,0.3)',
                  lineHeight: 1,
                  animation: 'countdown-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              >
                {countdown}
              </div>
            </div>
          )}

          <div style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 10,
            color: '#FF8C00',
            letterSpacing: 4,
            textTransform: 'uppercase',
            opacity: 0.7,
          }}>
            {waitingForGo ? 'Scanning 10+ Marketplaces' : 'Real-time Data Replication'}
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
            @keyframes go-pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.08); }
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
