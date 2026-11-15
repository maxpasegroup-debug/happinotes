'use client';

import dynamic from 'next/dynamic';
import { memo, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { DotLottie } from '@lottiefiles/dotlottie-react';

const Animation = dynamic(
  () => import('@lottiefiles/dotlottie-react').then(module => module.DotLottieReact),
  { ssr: false },
);
const renderConfig = { autoResize: true, freezeOnOffscreen: true };
const motionQuery = '(prefers-reduced-motion: reduce)';
const readMotion = () => window.matchMedia(motionQuery).matches;
const serverMotion = () => true;
function subscribeMotion(notify: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}

// Bundled from the supplied LottieFiles handoff; decorative, not a health signal.
const SystemStatusAnimation = memo(function SystemStatusAnimation() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, readMotion, serverMotion);
  const [player, setPlayer] = useState<DotLottie | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const connect = useCallback((instance: DotLottie | null) => {
    setPlayer(instance);
    setLoaded(Boolean(instance?.isLoaded));
  }, []);

  useEffect(() => {
    if (!player) return;
    const applyMotion = () => {
      if (reducedMotion) { player.pause(); player.setFrame(Math.floor(player.totalFrames / 2)); }
      else player.play();
    };
    const onLoad = () => { setLoaded(true); applyMotion(); };
    const onError = () => setFailed(true);
    player.addEventListener('load', onLoad);
    player.addEventListener('loadError', onError);
    player.addEventListener('renderError', onError);
    if (player.isLoaded) applyMotion();
    return () => {
      player.removeEventListener('load', onLoad);
      player.removeEventListener('loadError', onError);
      player.removeEventListener('renderError', onError);
    };
  }, [player, reducedMotion]);

  return <div aria-hidden="true" className="pointer-events-none relative h-24 w-28 shrink-0 sm:h-40 sm:w-44">
    {(!loaded || failed) && <div className="absolute inset-0 flex items-center justify-center text-primary/70"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M6 6.5h.01M6 17.5h.01M10 6.5h8M10 17.5h8" /></svg></div>}
    {!failed && <Animation src="/admin/system-status.lottie" autoplay={!reducedMotion} loop={!reducedMotion}
      backgroundColor="transparent" renderConfig={renderConfig} dotLottieRefCallback={connect}
      className={`h-full w-full ${loaded ? 'opacity-100' : 'opacity-0'}`} />}
  </div>;
});

export default SystemStatusAnimation;
