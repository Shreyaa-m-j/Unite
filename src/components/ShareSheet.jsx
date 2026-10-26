import { useState } from 'react';
import Dialog from './Dialog.jsx';
import { shareTargets, copyText, canNativeShare, nativeShare } from '../lib/share.js';

// Simple glyphs: one recognisable mark per app, so the sheet does not depend on any icon library.
const ICON = {
  whatsapp: <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Zm4.6 12.6c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.3.4-.4.5c-.1.1-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.9 1.2 2.2 1.3.3.1.4.1.6-.1l.8-1c.2-.2.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.8-.1 1.3Z" />,
  telegram: <path d="m20.7 4.3-17 6.6c-.9.4-.9 1.1-.2 1.3l4.3 1.4 1.7 5.2c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.1-2 4.3 3.2c.8.4 1.4.2 1.6-.7l2.8-13.3c.3-1.2-.4-1.7-1.3-1.3ZM17.8 8 10 15.1l-.3 3.1-1.6-5.3L17 7.5c.5-.3.9-.1.8.5Z" />,
  x: <path d="M17.8 3h3L14.3 10.4 22 21h-6l-4.7-6.4L5.8 21h-3l7-8L2.4 3h6.1l4.2 5.8L17.8 3Zm-1 16.2h1.7L7.5 4.7H5.7l11.1 14.5Z" />,
  sms: <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  email: <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2L4.5 7v1.6l7.5 5.2 7.5-5.2V7L12 12.2Z" />,
  copy: <path d="M8 3h9a2 2 0 0 1 2 2v11h-2V5H8V3Zm-3 4h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />,
  more: <path d="M5 10.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm7 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm7 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />,
};

const Glyph = ({ id, color }) => (
  <span className="share-icon" style={{ background: color }} aria-hidden="true">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff">{ICON[id]}</svg>
  </span>
);

export default function ShareSheet({ text, onClose, onShared, title = 'Share your result', subject, url }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(text)) {
      setCopied(true);
      onShared?.('copy');
      setTimeout(() => setCopied(false), 1800);
    } else {
      window.prompt('Copy this:', text);
    }
  };

  return (
    <Dialog
      title={title}
      actions={<button className="btn" onClick={onClose}>Close</button>}
    >
      <p className="hint share-preview">{text}</p>
      <div className="share-grid">
        {shareTargets(text, { subject, url }).map((t) => (
          <a
            key={t.id}
            className="share-opt"
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onShared?.(t.id)}
          >
            <Glyph id={t.id} color={t.color} />
            <span>{t.label}</span>
          </a>
        ))}
        <button type="button" className="share-opt" onClick={copy}>
          <Glyph id="copy" color={copied ? '#2fa36b' : '#8a6fc9'} />
          <span>{copied ? 'Copied ✓' : 'Copy'}</span>
        </button>
        {canNativeShare() && (
          <button
            type="button"
            className="share-opt"
            onClick={async () => {
              if ((await nativeShare(text)) === 'shared') onShared?.('native');
            }}
          >
            <Glyph id="more" color="#5a5f78" />
            <span>More…</span>
          </button>
        )}
      </div>
    </Dialog>
  );
}
