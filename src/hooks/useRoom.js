import { useEffect, useState } from 'react';
import { ref, onValue, onDisconnect } from 'firebase/database';
import { db } from '../firebase.js';
import { setServerOffset, setPresence } from '../lib/rooms.js';

// Live room data (undefined = loading, null = missing), the server clock offset,
// and presence for this device's slot.
export function useRoom(code, slot) {
  const [room, setRoom] = useState(undefined);
  const [offsetMs, setOffsetMs] = useState(0);

  useEffect(() => {
    const unsubRoom = onValue(ref(db, `rooms/${code}`), (s) => setRoom(s.val()), () => setRoom(null));
    const unsubOffset = onValue(ref(db, '.info/serverTimeOffset'), (s) => {
      setOffsetMs(s.val() || 0);
      setServerOffset(s.val() || 0);
    });
    return () => {
      unsubRoom();
      unsubOffset();
    };
  }, [code]);

  useEffect(() => {
    if (!slot) return;
    const onlineRef = ref(db, `rooms/${code}/players/${slot}/online`);
    const unsub = onValue(ref(db, '.info/connected'), (s) => {
      if (s.val() !== true) return;
      onDisconnect(onlineRef).set(false).then(() => setPresence(code, slot, true));
    });
    return () => {
      unsub();
      onDisconnect(onlineRef).cancel();
      setPresence(code, slot, false);
    };
  }, [code, slot]);

  return { room, offsetMs };
}
