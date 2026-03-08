import { useState, useRef, useEffect, useCallback } from 'react';
import type { LxmfMessage, SendTarget } from '../../hooks/useReticulum';
import MobileModal from './MobileModal';

interface MessageLogProps {
  messages: LxmfMessage[];
  connected: boolean;
  isMobile?: boolean;
  onSend?: (target: SendTarget, body: string) => Promise<{ ok: boolean; error?: string }>;
  sending?: boolean;
}

function formatSource(src: string): string {
  if (!src) return '???';
  const clean = src.startsWith('<') ? src.slice(1) : src;
  return clean.slice(0, 8).toUpperCase();
}

function formatTime(ts: string): string {
  if (!ts) return '--:--:--';
  if (ts.length >= 19) return ts.slice(11, 19);
  if (ts.length >= 8) return ts.slice(0, 8);
  return ts;
}

function formatDate(ts: string): string {
  if (!ts || ts.length < 10) return '';
  return ts.slice(0, 10);
}

function ComposeBar({
  onSend,
  sending,
  connected,
  isMobile,
}: {
  onSend?: (target: SendTarget, body: string) => Promise<{ ok: boolean; error?: string }>;
  sending?: boolean;
  connected: boolean;
  isMobile: boolean;
}) {
  const [target, setTarget] = useState<SendTarget>('pi-heltec');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    if (!onSend || !text.trim() || sending) return;
    setStatus('SENDING...');
    const result = await onSend(target, text.trim());
    if (result.ok) {
      setText('');
      setStatus('DELIVERED');
      inputRef.current?.focus();
    } else {
      setStatus(result.error?.toUpperCase() || 'FAILED');
    }
    setTimeout(() => setStatus(null), 3000);
  }, [onSend, text, target, sending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!onSend) return null;

  const sz = isMobile ? 'text-[12px]' : 'text-[9px]';

  return (
    <div className="border-t border-wv-border px-2 py-2">
      <div className="flex items-center gap-1 mb-1.5">
        <span className={`${sz} text-wv-muted tracking-wider shrink-0`}>TO:</span>
        <button
          onClick={() => setTarget('pi-heltec')}
          className={`${sz} px-1.5 py-0.5 rounded tracking-wider transition-colors ${
            target === 'pi-heltec'
              ? 'bg-wv-green/20 text-wv-green border border-wv-green/40'
              : 'text-wv-muted hover:text-wv-text border border-transparent'
          }`}
        >
          PI RNODE
        </button>
        <button
          onClick={() => setTarget('mac-heltec')}
          className={`${sz} px-1.5 py-0.5 rounded tracking-wider transition-colors ${
            target === 'mac-heltec'
              ? 'bg-wv-cyan/20 text-wv-cyan border border-wv-cyan/40'
              : 'text-wv-muted hover:text-wv-text border border-transparent'
          }`}
        >
          MAC RNODE
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? 'Type message...' : 'Mesh offline'}
          disabled={!connected || sending}
          className={`flex-1 bg-wv-black/60 border border-wv-border rounded px-2 py-1
                      ${sz} text-wv-text placeholder:text-wv-muted/40
                      focus:outline-none focus:border-wv-green/50
                      disabled:opacity-40 disabled:cursor-not-allowed`}
        />
        <button
          onClick={handleSend}
          disabled={!connected || sending || !text.trim()}
          className={`${sz} px-2 py-1 rounded font-bold tracking-wider transition-all
                      ${sending
                        ? 'bg-wv-amber/20 text-wv-amber border border-wv-amber/40 animate-pulse'
                        : 'bg-wv-green/20 text-wv-green border border-wv-green/40 hover:bg-wv-green/30'
                      }
                      disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {sending ? '...' : 'TX'}
        </button>
      </div>
      {status && (
        <div className={`mt-1 ${sz} tracking-wider ${
          status === 'DELIVERED' ? 'text-wv-green' :
          status === 'SENDING...' ? 'text-wv-amber animate-pulse' :
          'text-wv-red'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}

export default function MessageLog({ messages, connected, isMobile = false, onSend, sending }: MessageLogProps) {
  const [visible, setVisible] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages.length]);

  const feedList = (
    <div
      ref={scrollRef}
      className={isMobile ? 'p-3 max-h-[50vh] overflow-y-auto' : 'max-h-56 overflow-y-auto p-2'}
    >
      {messages.length === 0 ? (
        <div className="text-[9px] text-wv-muted py-4 text-center tracking-wider">
          {connected ? 'NO MESSAGES YET' : 'MESH OFFLINE — NO MESSAGES'}
        </div>
      ) : (
        messages.map((msg, i) => {
          const isGps = msg.title === 'GPS';
          return (
            <div
              key={`${msg.ts}-${msg.src}-${i}`}
              className={`py-1 border-b border-wv-border/30 ${isMobile ? 'py-2' : ''}`}
            >
              <div className={`flex items-center gap-2 ${isMobile ? 'text-[11px]' : 'text-[9px]'}`}>
                <span className="text-wv-muted shrink-0">{formatTime(msg.ts)}</span>
                <span className={`shrink-0 font-bold tracking-wider ${isGps ? 'text-wv-amber' : 'text-wv-green'}`}>
                  {isGps ? '[GPS]' : '[LXMF]'}
                </span>
                <span className="text-wv-cyan shrink-0">{formatSource(msg.src)}</span>
              </div>
              <div className={`mt-0.5 text-wv-text/80 leading-snug ${isMobile ? 'text-[11px]' : 'text-[9px]'}`}>
                {isGps ? (
                  <span className="text-wv-amber/70">
                    {(() => {
                      try {
                        const d = JSON.parse(msg.msg);
                        return `${d.lat?.toFixed(5)}, ${d.lng?.toFixed(5)}`;
                      } catch {
                        return msg.msg;
                      }
                    })()}
                  </span>
                ) : (
                  msg.msg
                )}
              </div>
              {formatDate(msg.ts) && (
                <div className="text-[7px] text-wv-muted/50 mt-0.5">{formatDate(msg.ts)}</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const composeBar = (
    <ComposeBar onSend={onSend} sending={sending} connected={connected} isMobile={isMobile} />
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 right-3 z-40 w-11 h-11 rounded-lg panel-glass
                     flex items-center justify-center
                     text-wv-green hover:bg-white/10 transition-colors
                     select-none active:scale-95"
          aria-label="Open message log"
        >
          <span className="text-lg">◉</span>
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-wv-green
                             text-[8px] text-wv-black font-bold flex items-center justify-center px-0.5">
              {messages.length > 99 ? '99+' : messages.length}
            </span>
          )}
        </button>
        <MobileModal
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          title="Message Log"
          icon="◉"
          accent="bg-wv-green"
        >
          {feedList}
          {composeBar}
        </MobileModal>
      </>
    );
  }

  return (
    <div className="fixed top-4 right-4 w-72 panel-glass rounded-lg overflow-hidden z-40 select-none">
      <div
        className="px-3 py-2 border-b border-wv-border flex items-center justify-between cursor-pointer"
        onClick={() => setVisible(!visible)}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-wv-green animate-pulse' : 'bg-wv-red'}`} />
          <span className="text-[10px] text-wv-muted tracking-widest uppercase">Message Log</span>
          {messages.length > 0 && (
            <span className="text-[8px] text-wv-green/60">{messages.length}</span>
          )}
        </div>
        <span className="text-[10px] text-wv-muted">{visible ? '▼' : '▶'}</span>
      </div>
      {visible && (
        <>
          {feedList}
          {composeBar}
        </>
      )}
    </div>
  );
}
