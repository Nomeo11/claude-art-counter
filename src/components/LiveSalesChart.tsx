import { useMemo } from 'react';
import { X } from 'lucide-react';

interface ChainStats {
  chain: string;
  label: string;
  color: string;
  count: number;
}

interface Props {
  stats: Record<string, number>;
  onClose: () => void;
}

const CHAINS: { key: string; label: string; color: string; symbol: string; emoji: string }[] = [
  { key: 'ethereum', label: 'ETH', color: '#627EEA', symbol: 'Ξ', emoji: '🔷' },
  { key: 'solana', label: 'SOL', color: '#9945FF', symbol: '◎', emoji: '🟣' },
  { key: 'tezos', label: 'XTZ', color: '#2C7DF7', symbol: 'ꜩ', emoji: '🔵' },
];

export default function LiveSalesChart({ stats, onClose }: Props) {
  const data = useMemo<ChainStats[]>(() => {
    return CHAINS.map(c => ({
      chain: c.key,
      label: c.label,
      color: c.color,
      count: stats[c.key] || 0,
    }));
  }, [stats]);

  // Dynamic scale: always leave headroom so leader is ~75% max
  const maxCount = Math.max(1, ...data.map(d => d.count));
  const ceiling = Math.max(10, Math.ceil(maxCount * 1.35));
  const total = data.reduce((s, d) => s + d.count, 0);

  // Star field dots
  const stars = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      left: `${(i * 37 + 13) % 100}%`,
      top: `${(i * 53 + 7) % 85}%`,
      size: (i % 3) + 1,
      opacity: 0.15 + (i % 5) * 0.08,
      delay: `${(i * 0.3) % 3}s`,
    }));
  }, []);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, #0a0a1a 0%, #0d0d2b 40%, #111133 100%)',
      backdropFilter: 'blur(8px)',
      zIndex: 15,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: '"Space Mono", monospace',
      padding: '16px 20px',
      overflow: 'hidden',
    }}>
      {/* Stars */}
      {stars.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: s.left,
          top: s.top,
          width: s.size,
          height: s.size,
          borderRadius: '50%',
          background: '#fff',
          opacity: s.opacity,
          animation: `twinkle 2s ease-in-out ${s.delay} infinite alternate`,
        }} />
      ))}

      {/* Close button */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)',
          transition: 'color 0.2s',
          zIndex: 20,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
      >
        <X size={18} />
      </div>

      {/* Title */}
      <div style={{
        fontSize: 9,
        letterSpacing: 4,
        color: 'rgba(255,255,255,0.3)',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        Race to the Moon
      </div>

      {/* Moon at top */}
      <div style={{
        fontSize: 28,
        marginBottom: 2,
        filter: 'drop-shadow(0 0 12px rgba(255,255,200,0.5))',
      }}>
        🌕
      </div>

      {/* Finish line */}
      <div style={{
        width: '70%',
        height: 1,
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 6px, transparent 6px, transparent 12px)',
        marginBottom: 6,
      }} />

      {/* Race tracks */}
      <div style={{
        display: 'flex',
        gap: 20,
        flex: 1,
        width: '80%',
        maxWidth: 320,
        justifyContent: 'center',
        position: 'relative',
      }}>
        {data.map((d, idx) => {
          const pct = Math.min((d.count / ceiling) * 100, 100);
          const chain = CHAINS[idx];
          return (
            <div key={d.chain} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              position: 'relative',
            }}>
              {/* Track background */}
              <div style={{
                flex: 1,
                width: 28,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 14,
                position: 'relative',
                overflow: 'visible',
                border: `1px solid ${d.color}15`,
              }}>
                {/* Trail glow */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 2,
                  right: 2,
                  height: `${Math.max(pct, 1)}%`,
                  background: `linear-gradient(180deg, ${d.color}05, ${d.color}30)`,
                  borderRadius: 12,
                  transition: 'height 1s cubic-bezier(0.34, 1.2, 0.64, 1)',
                }} />

                {/* Dotted trail */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 2,
                  height: `${Math.max(pct, 1)}%`,
                  background: `repeating-linear-gradient(180deg, ${d.color}60 0px, ${d.color}60 3px, transparent 3px, transparent 8px)`,
                  transition: 'height 1s cubic-bezier(0.34, 1.2, 0.64, 1)',
                }} />

                {/* Rocket head (positioned at top of progress) */}
                <div style={{
                  position: 'absolute',
                  bottom: `${Math.max(pct, 1)}%`,
                  left: '50%',
                  transform: 'translate(-50%, 50%)',
                  fontSize: 20,
                  filter: `drop-shadow(0 0 8px ${d.color})`,
                  transition: 'bottom 1s cubic-bezier(0.34, 1.2, 0.64, 1)',
                  zIndex: 2,
                }}>
                  🚀
                </div>

                {/* Count badge */}
                <div style={{
                  position: 'absolute',
                  bottom: `${Math.max(pct, 1)}%`,
                  left: '50%',
                  transform: 'translate(-50%, -22px)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: d.color,
                  textShadow: `0 0 10px ${d.color}88`,
                  transition: 'bottom 1s cubic-bezier(0.34, 1.2, 0.64, 1)',
                  whiteSpace: 'nowrap',
                  zIndex: 3,
                }}>
                  {d.count}
                </div>
              </div>

              {/* Chain label */}
              <div style={{
                marginTop: 8,
                fontSize: 10,
                fontWeight: 700,
                color: d.color,
                letterSpacing: 1,
              }}>
                {chain.emoji} {d.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Earth at bottom */}
      <div style={{
        fontSize: 26,
        marginTop: 6,
        filter: 'drop-shadow(0 0 8px rgba(100,180,255,0.3))',
      }}>
        🌍
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 14,
        marginTop: 6,
      }}>
        {data.map((d, idx) => {
          const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={d.chain} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>{CHAINS[idx].label} {pct}%</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>
        {total} sales tracked · next milestone: {ceiling}
      </div>

      <style>{`
        @keyframes twinkle {
          0% { opacity: 0.1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
