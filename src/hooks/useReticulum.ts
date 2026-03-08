import { useState, useEffect, useCallback, useRef } from 'react';

export interface ReticulumNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lastUpdate: number;
  type: 'rnode' | 'remote';
  host: string;
}

export interface RNSInterface {
  type: string;
  name: string;
  status?: string;
  noiseFloor?: number;
  battery?: number;
  cpuTemp?: number;
  rate?: string;
  airtime?: string;
  tx?: string;
  rx?: string;
  peers?: number;
}

export interface LxmfMessage {
  ts: string;
  src: string;
  dst: string;
  msg: string;
  title?: string;
}

export interface ReticulumData {
  nodes: ReticulumNode[];
  network: {
    interfaces: RNSInterface[];
    raw: string;
  };
  messages: LxmfMessage[];
  timestamp: number;
}

export type SendTarget = 'pi-heltec' | 'mac-heltec';

export interface SendResult {
  ok: boolean;
  error?: string;
  state?: string;
}

const POLL_INTERVAL = 5_000;

export function useReticulum(enabled: boolean) {
  const [nodes, setNodes] = useState<ReticulumNode[]>([]);
  const [interfaces, setInterfaces] = useState<RNSInterface[]>([]);
  const [messages, setMessages] = useState<LxmfMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/reticulum');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ReticulumData = await res.json();

      setNodes(data.nodes);
      setInterfaces(data.network?.interfaces || []);
      setMessages(data.messages || []);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [enabled]);

  const sendMessage = useCallback(async (target: SendTarget, body: string, title?: string): Promise<SendResult> => {
    setSending(true);
    try {
      const res = await fetch('/api/reticulum/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, body, title: title || 'Message' }),
      });
      const data: SendResult = await res.json();
      if (data.ok) {
        setTimeout(fetchData, 1000);
      }
      return data;
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    } finally {
      setSending(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    if (!enabled) return;
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData, enabled]);

  return { nodes, interfaces, messages, connected, sendMessage, sending };
}
