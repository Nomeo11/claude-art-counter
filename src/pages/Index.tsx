import { useState, useCallback } from "react";

const Index = () => {
  const [count, setCount] = useState(0);
  const [bumping, setBumping] = useState(false);

  const increment = useCallback(() => {
    setCount((c) => c + 1);
    setBumping(true);
    setTimeout(() => setBumping(false), 300);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 bg-background px-4">
      <div className="text-center space-y-2">
        <h1 className="text-lg font-medium tracking-widest uppercase text-muted-foreground">
          Claude Artifact Counter
        </h1>
        <p className="text-sm text-muted-foreground/60">
          Track every artifact published
        </p>
      </div>

      <button
        onClick={increment}
        className="group relative flex h-56 w-56 items-center justify-center rounded-full bg-card border-2 border-border hover:border-primary/50 transition-all duration-300 cursor-pointer animate-pulse-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={`text-7xl font-bold text-primary transition-transform ${bumping ? "animate-count-bump" : ""}`}
          style={{ fontFamily: "var(--font-mono)" }}
          key={count}
        >
          {count}
        </span>
        <span className="absolute bottom-8 text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          Tap to count
        </span>
      </button>

      <button
        onClick={() => setCount(0)}
        className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
      >
        Reset
      </button>
    </div>
  );
};

export default Index;
