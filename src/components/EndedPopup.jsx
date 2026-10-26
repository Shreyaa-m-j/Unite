import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog from './Dialog.jsx';
import { clearSlot } from '../lib/storage.js';
import { track } from '../lib/analytics.js';

const AUTO_HOME_SECONDS = 8;

// Shown to the player who did NOT end the room.
export default function EndedPopup({ code, partnerName, cancelled = false, roundsPlayed = 0, onLeave }) {
  const navigate = useNavigate();
  const [left, setLeft] = useState(AUTO_HOME_SECONDS);
  const [engaged, setEngaged] = useState(false); // pointer over the dialog, or a button focused
  const done = useRef(false);

  const leave = (action, to) => {
    if (done.current) return;
    done.current = true;
    clearSlot(code);
    track('room_ended_by_partner_seen', { rounds_played: roundsPlayed, action, cancelled });
    onLeave?.(action);
    navigate(to, { state: { guard: true } });
  };

  useEffect(() => {
    clearSlot(code);
  }, [code]);

  // The 8s redirect pauses while the user is interacting, so the screen never changes under their cursor.
  useEffect(() => {
    if (engaged) return;
    if (left <= 0) {
      leave('auto', '/');
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, engaged]);

  return (
    <Dialog
      title={`${partnerName} ${cancelled ? 'cancelled' : 'ended'} the room 👋`}
      onEngage={setEngaged}
      actions={
        <>
          <button className="btn primary" onClick={() => leave('home', '/')}>Back to home</button>
          <button className="btn" onClick={() => leave('new_room', '/create')}>Start a new room</button>
        </>
      }
    >
      <p>{cancelled ? 'They closed the room before the game started.' : 'Thanks for playing together!'}</p>
      <p className="hint">{engaged ? 'Take your time.' : `Going home in ${left}s…`}</p>
    </Dialog>
  );
}
