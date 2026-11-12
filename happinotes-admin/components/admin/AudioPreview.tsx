'use client';

import { Button, Slider } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';

type AudioPreviewProps = { src: string; title: string; durationSeconds?: number };

function timeLabel(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

// A new source gets a fresh player, stopping the previous clip on replacement.
export default function AudioPreview(props: AudioPreviewProps) {
  return <AudioPreviewPlayer key={props.src} {...props} />;
}

function AudioPreviewPlayer({ src, title, durationSeconds = 0 }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pending = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const total = duration || (Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    if (pending.current) return;
    pending.current = true;
    setError('');
    setBuffering(true);
    try {
      if (audio.error) audio.load();
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
    } catch (cause) {
      if (audio.isConnected && !(cause instanceof DOMException && cause.name === 'AbortError')) {
        setError('Unable to play this audio. Check your connection and try again.');
        setPlaying(false);
      }
      setBuffering(false);
    } finally { pending.current = false; }
  }

  return <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Audio preview</p><p className="mt-1 truncate text-sm font-medium text-foreground" title={title}>{title || 'Current audio'}</p></div>
      <span className="shrink-0 rounded-lg bg-content2 px-2 py-1 text-[10px] font-semibold text-default-400">MP3</span>
    </div>
    <div className="flex items-center gap-4">
      <Button type="button" isIconOnly radius="full" color="primary" aria-label={playing ? 'Pause audio preview' : error ? 'Retry audio preview' : 'Play audio preview'}
        onPress={() => void togglePlayback()} className="h-12 min-h-12 w-12 min-w-12 shrink-0 shadow-lg shadow-primary/15">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </Button>
      <div className="min-w-0 flex-1">
        <Slider aria-label={`Playback position for ${title || 'audio preview'}`} size="sm" color="primary" step={0.1}
          minValue={0} maxValue={total || 1} value={Math.min(position, total)} isDisabled={!duration || Boolean(error)}
          getValue={(value) => timeLabel(Array.isArray(value) ? value[0] : value)}
          onChange={(value) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            const next = Math.max(0, Math.min(duration, Array.isArray(value) ? value[0] : value));
            try { audio.currentTime = next; setPosition(next); }
            catch { setError('Unable to seek in this audio. Try playing it again.'); }
          }}
          classNames={{ track: 'border-s-primary/10 bg-primary/10', thumb: 'h-3 w-3 after:h-3 after:w-3' }} />
        <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-default-400"><span>{timeLabel(position)}</span><span>{total ? timeLabel(total) : '—:—'}</span></div>
      </div>
    </div>
    <p role="status" className="mt-3 text-xs text-default-400">{buffering ? 'Loading audio…' : playing ? 'Playing preview' : position > 0 && position >= total ? 'Preview finished · play again' : 'Listen before saving'}</p>
    {error ? <p role="alert" className="mt-2 text-xs text-danger-300">{error}</p> : null}
    <audio ref={audioRef} src={src} preload="metadata" className="hidden" aria-hidden="true"
      onLoadedMetadata={(event) => { const seconds = event.currentTarget.duration; setDuration(Number.isFinite(seconds) && seconds > 0 ? seconds : 0); }}
      onDurationChange={(event) => { const seconds = event.currentTarget.duration; setDuration(Number.isFinite(seconds) && seconds > 0 ? seconds : 0); }}
      onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPlaying={() => { setPlaying(true); setBuffering(false); }}
      onWaiting={() => setBuffering(true)} onCanPlay={() => setBuffering(false)}
      onPause={() => { setPlaying(false); setBuffering(false); }}
      onEnded={() => { setPlaying(false); setBuffering(false); }}
      onError={() => { setPlaying(false); setBuffering(false); setError('This audio could not be loaded. Press play to retry.'); }} />
  </div>;
}
