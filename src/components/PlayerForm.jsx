import { useState } from 'react';
import { INTERESTS } from '../config.js';
import MascotPicker from './MascotPicker.jsx';

const MIN = 3;
const MAX = 6;

export default function PlayerForm({ title, submitLabel, onSubmit, busy, error, defaultMascot = 'g1' }) {
  const [name, setName] = useState('');
  const [mascot, setMascot] = useState(defaultMascot);
  const [interests, setInterests] = useState([]);

  const toggle = (i) =>
    setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length < MAX ? [...cur, i] : cur));
  const ready = name.trim() && interests.length >= MIN && !busy;

  return (
    <form
      className="screen"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ name: name.trim(), mascot, interests });
      }}
    >
      <h2>{title}</h2>
      <section className="card stack">
        <label className="field">
          Your name
          <input value={name} maxLength={16} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          Pick your character
          <MascotPicker value={mascot} onChange={setMascot} />
        </div>
      </section>
      <section className="card stack">
        <div className="field">
          Pick {MIN}–{MAX} interests ({interests.length} chosen)
          <div className="chips">
            {INTERESTS.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={interests.includes(i)}
                className={`chip ${interests.includes(i) ? 'on' : ''}`}
                onClick={() => toggle(i)}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary" type="submit" disabled={!ready}>
        {busy && <span className="spinner" />}
        {submitLabel}
      </button>
    </form>
  );
}
