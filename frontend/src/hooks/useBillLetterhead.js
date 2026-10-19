import { useCallback, useEffect, useState } from 'react';

// "Print with the clinic letterhead" vs "plain paper" (the clinic's pre-printed
// stationery). It's a clinic habit rather than a per-document choice, so it is
// remembered in the browser and every screen using the same key stays in sync —
// change it in one place and the others follow, even in other open tabs.
const EVENT = 'print-letterhead-change';

const read = (key) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
};

export function billPdfQuery(withLetterhead, templateId) {
  const params = new URLSearchParams();
  if (withLetterhead) params.set('with_letterhead', '1');
  if (withLetterhead && templateId) params.set('template_id', String(templateId));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function usePrintLetterhead(storageKey) {
  const [withLetterhead, setState] = useState(() => read(storageKey));

  useEffect(() => {
    const sync = (e) => { if (!e?.detail || e.detail === storageKey) setState(read(storageKey)); };
    const onStorage = (e) => { if (e.key === storageKey) setState(read(storageKey)); };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, [storageKey]);

  const setWithLetterhead = useCallback((value) => {
    try { localStorage.setItem(storageKey, value ? '1' : '0'); } catch { /* ignore */ }
    setState(Boolean(value));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: storageKey }));
  }, [storageKey]);

  return [withLetterhead, setWithLetterhead];
}

// Bills & receipts (Payments, Receipts, Queue, Billing dashboard).
export default function useBillLetterhead() {
  return usePrintLetterhead('billPrintWithLetterhead');
}

// Medical certificates — kept separate from bills: certificates go on the
// same stationery as prescriptions, receipts often don't.
export function useCertificateLetterhead() {
  return usePrintLetterhead('certificatePrintWithLetterhead');
}
