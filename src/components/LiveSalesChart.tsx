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

const CHAINS: { key: string; label: string; color: string; symbol: string }[] = [
  { key: 'ethereum', label: 'ETH', color: '#627EEA', symbol: 'Ξ' },
  { key: 'solana', label: 'SOL', color: '#9945FF', symbol: '◎' },
  { key: 'tezos', label: 'XTZ', color: '#2C7DF7', symbol: 'ꜩ' },
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

  const max = Math.max(1, ...data.map(d => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(8,8,12,0.92)',
      backdropFilter: 'blur(8px)',
      zIndex: 15,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Space Mono", monospace',
      gap: 20,
      padding: 40,
    }}>
      {/* Title */}
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
        Live Sales Volume
      </div>

      {/* Bar chart */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 32,
        height: 220,
        padding: '0 20px',
      }}>
        {data.map(d => {
          const pct = (d.count / max) * 100;
          return (
            <div key={d.chain} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {/* Count */}
              <span style={{ fontSize: 18, fontWeight: 700, color: d.color }}>{d.count}</span>
              {/* Bar */}
              <div style={{
                width: 48,
                height: 180,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 6,
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${Math.max(pct, 2)}%`,
                  background: `linear-gradient(180deg, ${d.color}, ${d.color}88)`,
                  borderRadius: 6,
                  transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: `0 0 20px ${d.color}44`,
                }} />
              </div>
              {/* Label */}
              <span style={{ fontSize: 11, fontWeight: 700, color: d.color, letterSpacing: 1 }}>{d.label}</span>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
        {total} total sales tracked
      </div>

      {/* Pie-style proportions */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        {data.map(d => {
          const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={d.chain} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{d.label} {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
