import { useState } from 'react';
import Mascot from './Mascot.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import ShareSheet from './ShareSheet.jsx';
import { nativeShare, copyText } from '../lib/share.js';
import { track } from '../lib/analytics.js';

export default function Lobby({ room, slot, code, onStart, starting, onCancelRoom, onLeave }) {
  const [copied, setCopied] = useState('');
  const [dialog, setDialog] = useState(null); // 'cancel' | 'leave'
  const [inviteText, setInviteText] = useState(null); // set => our share sheet is open
  const link = `${window.location.origin}/room/${code}`;
  const p1 = room.players.p1;
  const p2 = room.players.p2;
  const partnerIn = Boolean(p1 && p2);

  const copy = async (what, text) => {
    // copyText tries the clipboard API, then the older execCommand route; only if both fail do we ask the player
    if (await copyText(text)) {
      setCopied(what);
      if (what === 'code') track('invite_shared', { method: 'copy_code' });
      setTimeout(() => setCopied(''), 1500);
    } else {
      window.prompt('Copy this:', text);
    }
  };
  // Same flow as sharing a result: the device's share sheet where it exists, our own sheet elsewhere.
  const invite = async () => {
    const text = `Join me on Unite 💞 Think alike to come closer!\n${link}\nRoom code: ${code}`;
    const result = await nativeShare(text);
    if (result === 'unsupported') setInviteText(text);
    else if (result === 'shared') track('invite_shared', { method: 'native' });
  };

  return (
    <main className="screen center">
      {slot === 'p1' && (
        <button className="link-btn top-left" onClick={() => setDialog('cancel')}>← Cancel room</button>
      )}
      {slot === 'p2' && partnerIn && (
        <button className="link-btn top-left" onClick={() => setDialog('leave')}>← Leave</button>
      )}
      {inviteText && (
        <ShareSheet
          title="Invite your partner"
          subject="Join me on Unite"
          url={link}
          text={inviteText}
          onShared={(method) => track('invite_shared', { method })}
          onClose={() => setInviteText(null)}
        />
      )}
      {dialog === 'cancel' && (
        <ConfirmDialog
          title="Cancel this room?"
          body={
            partnerIn
              ? `${p2.name} has already joined. Cancelling closes the room for both of you.`
              : "Your partner won't be able to join it."
          }
          confirmLabel="Cancel room"
          cancelLabel="Keep waiting"
          onConfirm={onCancelRoom}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'leave' && (
        <ConfirmDialog
          title="Leave this room?"
          body={`${p1.name} will go back to waiting for a partner. You can rejoin with the same code.`}
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={onLeave}
          onClose={() => setDialog(null)}
        />
      )}
      {!partnerIn && slot === 'p1' ? (
        <>
          <p className="hint">Your room code</p>
          <div className="room-code" aria-label={`Room code ${code.split('').join(' ')}`}>{code}</div>
          <button className="btn" onClick={() => copy('code', code)}>
            {copied === 'code' ? 'Copied ✓' : 'Copy code'}
          </button>
          <div className="card stack">
            <p className="hint share-link">{link}</p>
            <button className="btn primary" onClick={invite}>Share invite</button>
          </div>
          <p className="waiting"><span className="pulse" /> Waiting for your partner…</p>
          <p className="hint">Partner already made a room? Cancel this one and join theirs.</p>
        </>
      ) : (
        <>
          <h2>Ready to play!</h2>
          <div className="duo">
            {[p1, p2].map((p, i) => (
              <div className="duo-card" key={i}>
                <Mascot id={p.mascot} size={130} />
                <b>{p.name}{(i === 0 ? 'p1' : 'p2') === slot ? ' (you)' : ''}</b>
                <span className="hint">{p.interests?.join(' · ')}</span>
              </div>
            ))}
          </div>
          {slot === 'p1' ? (
            <button className="btn primary" onClick={onStart} disabled={starting}>
              {starting && <span className="spinner" />}Start
            </button>
          ) : (
            <p className="waiting"><span className="pulse" /> Waiting for {p1.name} to start…</p>
          )}
        </>
      )}
    </main>
  );
}
