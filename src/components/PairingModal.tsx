import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, QrCode, ScanLine, Sparkles } from 'lucide-react';
import type { ConnectionState } from '../types';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';

type Mode = 'choose' | 'host-offer' | 'host-scan-answer' | 'join-scan-offer' | 'join-show-answer';

interface PairingModalProps {
  open: boolean;
  onClose: () => void;
  connectionState: ConnectionState;
  createOffer: () => Promise<string>;
  createAnswer: (offerCode: string) => Promise<string>;
  completeConnection: (answerCode: string) => Promise<void>;
  connectLoopback: () => Promise<void>;
  disconnect: () => void;
}

const SCANNER_ELEMENT_ID = 'crossflow-qr-reader';
// Rough safety margin: SDP-carrying codes beyond this length scan poorly at
// low error-correction, even though they still fit in a QR's raw capacity.
const QR_RELIABLE_LIMIT = 1800;

export function PairingModal({
  open,
  onClose,
  connectionState,
  createOffer,
  createAnswer,
  completeConnection,
  connectLoopback,
  disconnect,
}: PairingModalProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [offerCode, setOfferCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Reset everything each time the modal is opened fresh.
  useEffect(() => {
    if (!open) {
      setMode('choose');
      setOfferCode('');
      setAnswerCode('');
      setManualInput('');
      setError(null);
      setCameraError(null);
    }
  }, [open]);

  // Auto-close shortly after the data channel actually opens.
  useEffect(() => {
    if (open && connectionState === 'connected') {
      const t = window.setTimeout(onClose, 650);
      return () => window.clearTimeout(t);
    }
  }, [connectionState, open, onClose]);

  // Host: generate the offer as soon as we enter this step.
  useEffect(() => {
    if (mode !== 'host-offer') return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    createOffer()
      .then((code) => {
        if (!cancelled) setOfferCode(code);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not generate a pairing code.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, createOffer]);

  const processCode = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'join-scan-offer') {
        const answer = await createAnswer(code);
        setAnswerCode(answer);
        setMode('join-show-answer');
      } else if (mode === 'host-scan-answer') {
        await completeConnection(code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code could not be read. Double-check it and try again.');
    } finally {
      setBusy(false);
    }
  };

  // Camera scanner lifecycle — only mounted while in a scanning step.
  useEffect(() => {
    const isScanStep = mode === 'host-scan-answer' || mode === 'join-scan-offer';
    if (!isScanStep) return;

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;
    setCameraError(null);

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 230 },
        (decodedText) => {
          if (scannerRef.current) {
            scannerRef.current = null;
            scanner.stop().then(() => scanner.clear()).catch(() => {});
          }
          void processCode(decodedText);
        },
        () => {
          /* fires continuously while no code is in frame — expected, ignore */
        }
      )
      .catch(() => {
        setCameraError('Camera unavailable or permission denied. Paste the code manually below instead.');
      });

    return () => {
      scannerRef.current = null;
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy — select and copy the code manually.');
    }
  };

  const goToChoose = () => {
    disconnect();
    setMode('choose');
    setOfferCode('');
    setAnswerCode('');
    setManualInput('');
    setError(null);
  };

  const handleDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectLoopback();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start demo mode.');
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = {
    choose: 'Pair a device',
    'host-offer': 'Show this to your other device',
    'host-scan-answer': 'Scan their reply code',
    'join-scan-offer': "Scan the host's code",
    'join-show-answer': 'Show this back to the host',
  };

  return (
    <Dialog open={open} onClose={onClose} title={titles[mode]} subtitle="Direct P2P — no data touches a server">
      {mode !== 'choose' && (
        <button
          onClick={goToChoose}
          className="mb-4 -mt-1 inline-flex items-center gap-1 text-xs text-white/40 transition hover:text-white/70"
        >
          <ArrowLeft size={13} /> Start over
        </button>
      )}

      {mode === 'choose' && (
        <div className="space-y-2.5">
          <button
            onClick={() => setMode('host-offer')}
            className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-left transition hover:border-flow-cyan/40 hover:bg-white/[0.05]"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-flow-cyan/10 text-flow-cyan">
              <QrCode size={17} />
            </span>
            <span>
              <span className="block text-sm font-medium text-white">I'm the host</span>
              <span className="block text-xs text-white/40">Show a code for your other device to scan</span>
            </span>
          </button>

          <button
            onClick={() => setMode('join-scan-offer')}
            className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-left transition hover:border-flow-blue/40 hover:bg-white/[0.05]"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-flow-blue/10 text-blue-300">
              <ScanLine size={17} />
            </span>
            <span>
              <span className="block text-sm font-medium text-white">I'm joining</span>
              <span className="block text-xs text-white/40">Scan the code shown on the host device</span>
            </span>
          </button>

          <div className="flex items-center gap-3 py-1 text-[11px] text-white/25">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Button variant="outline" size="md" className="w-full" onClick={handleDemo} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Try demo mode — no second device needed
          </Button>
        </div>
      )}

      {mode === 'host-offer' && (
        <div className="space-y-3">
          {busy && !offerCode ? (
            <div className="flex flex-col items-center gap-2 py-8 text-white/40">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-xs">Preparing your pairing code…</p>
            </div>
          ) : offerCode ? (
            <>
              <div className="flex justify-center rounded-xl bg-white p-3">
                <QRCodeSVG value={offerCode} size={200} level="L" />
              </div>
              {offerCode.length > QR_RELIABLE_LIMIT && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                  This code is large — copying it is more reliable than scanning.
                </p>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={() => copyCode(offerCode)}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy code instead'}
              </Button>
              <p className="text-center text-[11px] text-white/35">
                Scan this with your other device, or paste the copied code there.
              </p>
              <Button size="md" className="w-full" onClick={() => setMode('host-scan-answer')}>
                Next: scan their reply <ArrowRight size={14} />
              </Button>
            </>
          ) : null}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      )}

      {(mode === 'host-scan-answer' || mode === 'join-scan-offer') && (
        <div className="space-y-3">
          <div id={SCANNER_ELEMENT_ID} className="overflow-hidden rounded-xl bg-black/40" />
          {cameraError && <p className="text-xs text-amber-300">{cameraError}</p>}

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-1.5 text-[11px] text-white/40">No camera? Paste the code here:</p>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              rows={2}
              placeholder="Paste pairing code…"
              className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 font-mono text-[11px] text-white/80 placeholder:text-white/25 focus:border-flow-cyan/50 focus:outline-none"
            />
            <Button size="sm" className="mt-2 w-full" disabled={busy || !manualInput.trim()} onClick={() => processCode(manualInput)}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
              Connect
            </Button>
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      )}

      {mode === 'join-show-answer' && (
        <div className="space-y-3">
          <div className="flex justify-center rounded-xl bg-white p-3">
            <QRCodeSVG value={answerCode} size={200} level="L" />
          </div>
          {answerCode.length > QR_RELIABLE_LIMIT && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              This code is large — copying it is more reliable than scanning.
            </p>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={() => copyCode(answerCode)}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy code instead'}
          </Button>
          <p className="text-center text-[11px] text-white/35">
            Show this back to the host device (or send them the copied code) to finish pairing.
          </p>
        </div>
      )}
    </Dialog>
  );
}
