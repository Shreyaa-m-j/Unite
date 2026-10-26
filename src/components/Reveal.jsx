import Mascot from './Mascot.jsx';

// Shown for revealMs after both players answer: both picks, then the outcome line.
export default function Reveal({ matched, picks, children }) {
  return (
    <div className={`reveal-box ${matched ? 'match' : 'miss'}`} role="status">
      <div className="picks">
        {picks.map((p, i) => (
          <div className="pick-pill" key={i} style={{ animationDelay: `${i * 0.12}s` }}>
            <Mascot id={p.mascot} crop="head" size={30} />
            <span><small>{p.name}</small><b>{p.option}</b></span>
          </div>
        ))}
      </div>
      <p className="reveal">{children}</p>
    </div>
  );
}
