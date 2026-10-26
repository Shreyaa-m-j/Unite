const key = (roomId) => `unite_${roomId}`;

export function getSlot(roomId) {
  try {
    const v = localStorage.getItem(key(roomId));
    return v === 'p1' || v === 'p2' ? v : null;
  } catch {
    return null;
  }
}

export function saveSlot(roomId, slot) {
  try {
    localStorage.setItem(key(roomId), slot);
  } catch {
    /* storage unavailable: the player just won't be restored after a refresh */
  }
}

export function clearSlot(roomId) {
  try {
    localStorage.removeItem(key(roomId));
  } catch {
    /* ignore */
  }
}

// Every room this device holds a seat in: [{ code, slot }].
export function listSlots() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('unite_')) continue;
      const v = localStorage.getItem(k);
      if (v === 'p1' || v === 'p2') out.push({ code: k.slice(6), slot: v });
    }
  } catch {
    /* ignore */
  }
  return out;
}
