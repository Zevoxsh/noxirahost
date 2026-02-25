import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import { vmAPI } from '../api/client';

export default function Console() {
  const { id } = useParams<{ id: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const connect = async () => {
      try {
        const res = await vmAPI.getConsoleToken(Number(id));
        const { wsToken } = res.data;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${wsProtocol}://${window.location.host}/ws/console?token=${wsToken}`;

        // Load noVNC from CDN — @vite-ignore prevents Rollup from trying to bundle this
        const { default: RFB } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.5.0/core/rfb.js');

        if (!containerRef.current) return;

        const rfb = new RFB(containerRef.current, wsUrl);
        rfbRef.current = rfb;

        rfb.scaleViewport = true;
        rfb.resizeSession = true;

        rfb.addEventListener('connect', () => setStatus('connected'));
        rfb.addEventListener('disconnect', (e: any) => {
          if (e.detail?.clean) {
            setStatus('error');
            setError('Console disconnected.');
          } else {
            setStatus('error');
            setError('Connection lost. The server may be offline.');
          }
        });
        rfb.addEventListener('credentialsrequired', () => {
          rfb.sendCredentials({ password: '' });
        });
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Failed to establish console connection.');
      }
    };

    connect();

    return () => {
      if (rfbRef.current) {
        rfbRef.current.disconnect();
        rfbRef.current = null;
      }
    };
  }, [id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="h-10 bg-[#11131B] border-b border-white/[0.08] flex items-center px-4 gap-4 shrink-0 z-10">
        <Link to={`/vms/${id}`} className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Back
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs ${
            status === 'connected' ? 'text-[#6EE7B7]' :
            status === 'loading' ? 'text-[#FCD34D]' :
            'text-[#FCA5A5]'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              status === 'connected' ? 'bg-[#10B981]' :
              status === 'loading' ? 'bg-[#F59E0B] animate-pulse' :
              'bg-[#EF4444]'
            }`} />
            {status === 'loading' ? 'Connecting…' : status === 'connected' ? 'Connected' : 'Disconnected'}
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* noVNC Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden" style={{ background: '#000' }} />

      {/* Overlay states */}
      {status === 'loading' && (
        <div className="absolute inset-0 top-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-8 h-8 border-2 border-[#9D4EDD]/30 border-t-[#9D4EDD] rounded-full animate-spin mb-4" />
          <p className="text-white/60 text-sm font-light">Establishing connection…</p>
          <p className="text-white/30 text-xs mt-1">Retrieving console token</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 top-10 flex flex-col items-center justify-center bg-black/80">
          <div className="text-center max-w-xs">
            <p className="text-[#FCA5A5] text-sm mb-2">{error || 'Connection failed'}</p>
            <p className="text-white/30 text-xs mb-5">Make sure the server is running before opening the console.</p>
            <button
              onClick={() => { setStatus('loading'); setError(''); window.location.reload(); }}
              className="btn-ghost"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
