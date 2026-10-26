import { useState } from 'react';
import { nativeShare } from '../lib/share.js';
import ShareSheet from './ShareSheet.jsx';
import Confetti from './Confetti.jsx';

const steps = (n) => `${n} ${n === 1 ? 'step' : 'steps'}`;

export default function EndScreen({ won, names, headline, track, gap, answered, matches, tookSec, onShared, onEndRoom, children }) {
  const [sheetText, setSheetText] = useState(null); // set => our share sheet is open
  const matchRate = answered ? Math.round((matches / answered) * 100) : 0;

  const share = async () => {
    const url = window.location.origin;
    const text = won
      ? `${names} united on Unite in ${tookSec}s 💞 ${matchRate}% match rate. Think you two can beat that? ${url}`
      : `${names} got within ${steps(gap)} on Unite 😅 ${matchRate}% match rate. Think you two can do better? ${url}`;
    // Phones on HTTPS get the real system share sheet; everywhere else our own sheet opens.
    const result = await nativeShare(text);
    if (result === 'shared') onShared?.('native');
    else if (result === 'unsupported') setSheetText(text);
  };

  return (
    <main className="screen center">
      {won && <Confetti />}
      {/* the step count under the track is hidden here: the headline and stat tiles already say it */}
      <div className="result-track">{track}</div>

      <header className="result-head">
        <h2 className={won ? 'win-title' : ''}>{won ? headline : 'So close!'}</h2>
        <p className="hint">
          {won
            ? 'You two think alike. Go again and beat your time?'
            : `Only ${steps(gap)} left between you. One more round?`}
        </p>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <b>{won ? `${tookSec}s` : gap}</b>
          <span>{won ? 'Time taken' : 'Steps left'}</span>
        </div>
        <div className="stat">
          <b>{answered}</b>
          <span>Questions</span>
        </div>
        <div className="stat">
          <b>{matchRate}%</b>
          <span>{matches} of {answered} matched</span>
        </div>
      </div>

      <div className="result-actions">
        {children}
        <button className="btn" onClick={share}>Share result</button>
        {onEndRoom && <button className="btn ghost" onClick={onEndRoom}>End room &amp; go home</button>}
      </div>

      {sheetText && <ShareSheet text={sheetText} onClose={() => setSheetText(null)} onShared={onShared} />}
    </main>
  );
}
