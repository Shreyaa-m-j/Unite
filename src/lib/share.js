// Sharing: the device's native share sheet when it exists (phones on HTTPS), otherwise our own sheet
// with the common apps. `navigator.share` is missing on desktop Chrome/Firefox and on any page that
// is not served over HTTPS (for example a phone opening http://192.168.x.x during testing).

export const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

// Returns 'shared' | 'cancelled' | 'unsupported'
export async function nativeShare(text) {
  if (!canNativeShare()) return 'unsupported';
  try {
    await navigator.share({ text });
    return 'shared';
  } catch (e) {
    return e?.name === 'AbortError' ? 'cancelled' : 'unsupported'; // a real failure falls back to our sheet
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API blocked (non-HTTPS, permissions): the old-fashioned way
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// App links. Each opens the app (or its web page) with the message prefilled.
export function shareTargets(text, { subject = 'My Unite result', url = window.location.origin } = {}) {
  const t = encodeURIComponent(text);
  return [
    { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', href: `https://wa.me/?text=${t}` },
    { id: 'telegram', label: 'Telegram', color: '#2aabee', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${t}` },
    { id: 'x', label: 'X', color: '#111111', href: `https://twitter.com/intent/tweet?text=${t}` },
    { id: 'sms', label: 'Messages', color: '#34c759', href: `sms:?&body=${t}` },
    { id: 'email', label: 'Email', color: '#6b7fd7', href: `mailto:?subject=${encodeURIComponent(subject)}&body=${t}` },
  ];
}
