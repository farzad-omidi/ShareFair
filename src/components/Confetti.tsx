// Drawn from the app's own palette instead of generic rainbow confetti, so a
// celebratory moment still looks like it belongs to ShareFair -- the brand
// green plus its teal family, with a sprinkle of MongoDB's category-tag
// colors for variety a one-off burst can afford that persistent UI can't.
const COLORS = ["#00ed64", "#00a35c", "#00684a", "#003d4f", "#7b3ff2", "#fa6e39", "#f06bb8"];

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
