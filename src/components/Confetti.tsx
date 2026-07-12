// Drawn from the app's own palette instead of generic rainbow confetti, so a
// celebratory moment still looks like it belongs to ShareFair.
const COLORS = ["#de5330", "#6f8f5c", "#d6a15e", "#6f95b8", "#9b7aa6", "#67a9a4", "#c98263"];

export type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
  color: string;
};

// The randomness has to be resolved once, at the moment the celebration is
// triggered (inside the event handler that flips to the "thanks" stage) --
// not during render or in an effect -- so render itself stays pure.
export function makeConfettiPieces(count = 16): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1 + Math.random() * 0.6,
    rotate: Math.random() * 360,
    drift: (Math.random() - 0.5) * 70,
    color: COLORS[i % COLORS.length],
  }));
}

export function Confetti({ pieces }: { pieces: ConfettiPiece[] }) {
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
