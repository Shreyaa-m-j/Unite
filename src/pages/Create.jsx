import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlayerForm from '../components/PlayerForm.jsx';
import { createRoom, REASON_MESSAGES } from '../lib/rooms.js';
import { firebaseReady } from '../firebase.js';
import { track, setPlayerName } from '../lib/analytics.js';

export default function Create() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!firebaseReady) {
    return (
      <main className="screen center">
        <div className="card stack">
          <p>Firebase isn't configured yet. Fill in <b>.env</b> (see .env.example) and restart the dev server.</p>
          <Link to="/" className="btn">Back to home</Link>
        </div>
      </main>
    );
  }

  return (
    <PlayerForm
      title="Create a room"
      submitLabel="Create room"
      busy={busy}
      error={error}
      onSubmit={async (player) => {
        setBusy(true);
        setError('');
        try {
          const code = await createRoom(player);
          setPlayerName(player.name);
          track('room_created', { roomId: code, player: 'p1', round: 0, interests_count: player.interests.length });
          navigate(`/room/${code}`);
        } catch {
          setError(REASON_MESSAGES.network);
          setBusy(false);
        }
      }}
    />
  );
}
