import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity as ActivityIcon, ArrowLeftRight, Bell, MonitorPlay, PlugZap, Sparkles } from 'lucide-react';
import { useWebRTC } from './hooks/useWebRTC';
import { useMockNotifications } from './hooks/useMockNotifications';
import { TopNav } from './components/TopNav';
import { ScreenMirror } from './components/ScreenMirror';
import { TransferCenter } from './components/TransferCenter';
import { ActivityFeed } from './components/ActivityFeed';
import { PairingModal } from './components/PairingModal';
import { Dialog } from './components/ui/Dialog';
import { Button } from './components/ui/Button';
import { cn } from './lib/utils';

type MobileTab = 'mirror' | 'transfer' | 'activity';

const MOBILE_TABS: Array<{ id: MobileTab; label: string; icon: typeof MonitorPlay }> = [
  { id: 'mirror', label: 'Mirror', icon: MonitorPlay },
  { id: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
];

export default function App() {
  const webrtc = useWebRTC();
  const [pairingOpen, setPairingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('mirror');
  const [localClipboard, setLocalClipboard] = useState('');

  const mockNotifications = useMockNotifications({ onNotification: webrtc.pushMockNotification });

  const connected = webrtc.connectionState === 'connected';
  const paired = webrtc.role !== 'none';

  return (
    <div className="relative flex min-h-screen flex-col bg-obsidian text-white">
      {/* Ambient background glow — signature touch, kept subtle and slow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -left-40 top-[-8%] h-[420px] w-[420px] rounded-full bg-flow-blue/10 blur-[120px]"
          animate={{ y: [0, 26, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[-12%] top-1/3 h-[380px] w-[380px] rounded-full bg-flow-cyan/10 blur-[120px]"
          animate={{ y: [0, -26, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <TopNav
        connectionState={webrtc.connectionState}
        role={webrtc.role}
        stats={webrtc.stats}
        onOpenPairing={() => setPairingOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col p-4 pb-24 sm:p-6 lg:pb-6">
        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
          {/* Screen mirroring viewport */}
          <div className={cn('flex min-h-[360px] flex-1 flex-col', mobileTab !== 'mirror' && 'hidden lg:flex')}>
            <ScreenMirror
              stream={webrtc.remoteStream}
              isSharingLocally={!!webrtc.localStream}
              connectionState={webrtc.connectionState}
              onStartShare={webrtc.startScreenShare}
              onStopShare={webrtc.stopScreenShare}
              onRequestQuality={webrtc.requestQuality}
            />
          </div>

          {/* Sidebar: transfer center + live activity */}
          <div className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
            <div className={cn(mobileTab !== 'transfer' && 'hidden lg:block')}>
              <TransferCenter
                connected={connected}
                transfers={webrtc.transfers}
                onSendFile={webrtc.sendFile}
                onCancelTransfer={webrtc.cancelTransfer}
                localClipboard={localClipboard}
                onLocalClipboardChange={setLocalClipboard}
                onSendClipboard={webrtc.sendClipboard}
                remoteClipboard={webrtc.remoteClipboard}
              />
            </div>
            <div className={cn('min-h-[280px] flex-1', mobileTab !== 'activity' && 'hidden lg:flex')}>
              <ActivityFeed items={webrtc.activity} onClear={webrtc.clearActivity} />
            </div>
          </div>
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/[0.06] bg-obsidian/90 px-2 py-2 backdrop-blur-xl lg:hidden">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-colors',
              mobileTab === id ? 'text-flow-cyan' : 'text-white/40'
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <PairingModal
        open={pairingOpen}
        onClose={() => setPairingOpen(false)}
        connectionState={webrtc.connectionState}
        createOffer={webrtc.createOffer}
        createAnswer={webrtc.createAnswer}
        completeConnection={webrtc.completeConnection}
        connectLoopback={webrtc.connectLoopback}
        disconnect={webrtc.disconnect}
      />

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings" subtitle="Session & simulator controls">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/35">Mock notifications</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={mockNotifications.running ? 'danger' : 'primary'}
                onClick={mockNotifications.running ? mockNotifications.stop : mockNotifications.start}
                className="flex-1"
              >
                <Bell size={13} />
                {mockNotifications.running ? 'Stop simulator' : 'Start simulator'}
              </Button>
              <Button size="sm" variant="outline" onClick={mockNotifications.fireOnce} className="flex-1">
                <Sparkles size={13} />
                Send one now
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/35">
              Browsers can't read a device's real system notifications — this simulator generates realistic ones so
              you can test forwarding end to end. When connected, they're relayed live to your peer.
            </p>
          </div>

          {paired && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/35">Session</p>
              <Button size="sm" variant="outline" className="w-full" onClick={webrtc.disconnect}>
                <PlugZap size={13} />
                Disconnect this device
              </Button>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-white/30">
            CrossFlow connects devices directly over WebRTC. Pairing uses a one-time QR/code exchange, not a
            signaling server — for best results, keep both devices on the same Wi-Fi network.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
