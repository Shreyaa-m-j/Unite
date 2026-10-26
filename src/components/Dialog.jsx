import { useEffect, useRef } from 'react';

export default function Dialog({ title, children, actions, onEngage }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="modal-overlay">
      <div
        className="modal card stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        tabIndex={-1}
        ref={ref}
        onPointerEnter={() => onEngage?.(true)}
        onPointerLeave={() => onEngage?.(false)}
        onPointerDown={() => onEngage?.(true)}
        onFocus={(e) => e.target !== ref.current && onEngage?.(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && onEngage?.(false)}
      >
        <h2 id="dlg-title">{title}</h2>
        {children}
        <div className="stack">{actions}</div>
      </div>
    </div>
  );
}
