import Mascot, { MASCOTS } from './Mascot.jsx';

export default function MascotPicker({ value, onChange }) {
  return (
    <div className="character-picker" role="radiogroup" aria-label="Character">
      {MASCOTS.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          aria-label={m.label}
          className={`pick ${value === m.id ? 'selected' : ''}`}
          onClick={() => onChange(m.id)}
        >
          <Mascot id={m.id} size={120} />
        </button>
      ))}
    </div>
  );
}
