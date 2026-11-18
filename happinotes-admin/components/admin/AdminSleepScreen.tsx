'use client';

import { Button, Modal, ModalBody, ModalContent } from '@heroui/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useState } from 'react';

function SunIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>;
}

// Render the actual clock glyphs as glass, rather than decorating their container.
function GlassTimeGlyphs({ value }: { value: string }) {
  const id = useId().replace(/:/g, '');
  const isColon = value === ':';
  const width = isColon ? 30 : 128;
  return <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${width} 110`}
    className="admin-clock-glass block overflow-visible" style={{ width: isColon ? '.26em' : '1.1em', height: '.95em' }}>
    <defs>
      <text id={`${id}-shape`} x={width / 2} y="90" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
        fontSize="112" fontWeight="600" letterSpacing={isColon ? 0 : -6}
        textLength={isColon ? undefined : 119} lengthAdjust="spacingAndGlyphs">{value}</text>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2=".8" y2="1">
        <stop offset="0" stopColor="#fffaf3" stopOpacity=".48" />
        <stop offset=".3" stopColor="#ffe6d5" stopOpacity=".12" />
        <stop offset=".47" stopColor="#ffd1ad" stopOpacity=".06" />
        <stop offset=".52" stopColor="#fff6ec" stopOpacity=".36" />
        <stop offset=".62" stopColor="#ffc3a0" stopOpacity=".1" />
        <stop offset="1" stopColor="#fff1df" stopOpacity=".4" />
      </linearGradient>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2=".65" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
        <stop offset=".28" stopColor="#fff7ee" stopOpacity=".7" />
        <stop offset=".5" stopColor="#ffcfab" stopOpacity=".15" />
        <stop offset=".8" stopColor="#ffe5d0" stopOpacity=".45" />
        <stop offset="1" stopColor="#ffffff" stopOpacity=".9" />
      </linearGradient>
      <filter id={`${id}-bevel`} x="-15%" y="-15%" width="130%" height="140%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="surface" />
        <feSpecularLighting in="surface" surfaceScale="5" specularConstant=".9" specularExponent="28" lightingColor="#fff9ee" result="reflection">
          <fePointLight x="-45" y="-80" z="160" />
        </feSpecularLighting>
        <feComposite in="reflection" in2="SourceAlpha" operator="in" />
      </filter>
      <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2=".4">
        <stop offset=".1" stopColor="#ffffff" stopOpacity="0" />
        <stop offset=".35" stopColor="#ffffff" stopOpacity=".05" />
        <stop offset=".44" stopColor="#ffffff" stopOpacity=".65" />
        <stop offset=".48" stopColor="#ffffff" stopOpacity=".1" />
        <stop offset=".7" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <use href={`#${id}-shape`} fill="none" stroke="#000000" strokeOpacity=".25" strokeWidth="2" transform="translate(0 2)" />
    <use className="admin-clock-glass-body" href={`#${id}-shape`} fill={`url(#${id}-body)`} stroke={`url(#${id}-rim)`} strokeWidth=".85" />
    <use className="admin-clock-glass-light" href={`#${id}-shape`} fill="#ffffff" filter={`url(#${id}-bevel)`} />
    <use className="admin-clock-glass-shine" href={`#${id}-shape`} fill={`url(#${id}-shine)`} />
  </svg>;
}

function LiquidClockNumber({ value, reducedMotion }: { value: string; reducedMotion: boolean }) {
  if (reducedMotion) return <GlassTimeGlyphs value={value} />;

  return <span aria-hidden="true" className="relative inline-grid isolate">
    <AnimatePresence initial={false}>
      <motion.span key={value} className="col-start-1 row-start-1 origin-center"
        initial={{ opacity: 0, y: 14, scaleX: .9, scaleY: 1.12, filter: 'blur(5px)' }}
        animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -10, scaleX: 1.06, scaleY: .93, filter: 'blur(5px)', transition: { duration: .2, ease: 'easeOut' } }}
        transition={{
          type: 'spring', stiffness: 180, damping: 15, mass: .8,
          opacity: { duration: .24 }, filter: { duration: .35 },
        }}>
        <GlassTimeGlyphs value={value} />
      </motion.span>
    </AnimatePresence>
  </span>;
}

function SleepClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [use24Hours, setUse24Hours] = useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const update = () => setNow(new Date());
    const frame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 1000);
    // Browsers throttle background tabs; refresh immediately on returning.
    const resume = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);

  const hours = now ? String(use24Hours ? now.getHours() : now.getHours() % 12 || 12).padStart(2, '0') : '--';
  const minutes = now ? String(now.getMinutes()).padStart(2, '0') : '--';
  const seconds = now?.getSeconds() ?? 0;
  return <div className="flex w-full flex-col items-center">
    <p className="mb-6 text-sm font-medium tracking-wide text-orange-100/65 sm:mb-8 sm:text-base">
      {now ? now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }) : '\u00a0'}
    </p>
    <button type="button" onClick={() => setUse24Hours(value => !value)}
      aria-label={`Clock: ${hours}:${minutes}. Switch to ${use24Hours ? '12' : '24'}-hour format`}
      className="group relative rounded-3xl px-2 outline-none focus-visible:ring-2 focus-visible:ring-orange-200/70">
      <span className="flex items-center text-[clamp(5rem,20vw,15rem)] font-semibold leading-[.95] tracking-[-.075em] tabular-nums drop-shadow-[0_8px_48px_#fdba7415]">
        <LiquidClockNumber value={hours} reducedMotion={Boolean(reducedMotion)} />
        <motion.span aria-hidden="true" className="mx-[.035em]"
          animate={reducedMotion ? { opacity: .8 } : { opacity: [.85, .55, .85] }} transition={{ duration: 3, repeat: Infinity }}>
          <GlassTimeGlyphs value=":" />
        </motion.span>
        <LiquidClockNumber value={minutes} reducedMotion={Boolean(reducedMotion)} />
      </span>
    </button>
    <div className="mt-7 flex items-center gap-4 sm:mt-9">
      <div role="group" aria-label="Clock format" className="relative isolate flex rounded-full border border-white/10 bg-black/15 p-1">
        <motion.span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)]"
          initial={false} animate={{ x: use24Hours ? '100%' : '0%' }}
          transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 20, mass: .7 }}>
          <motion.span key={String(use24Hours)} className="absolute inset-0 overflow-hidden rounded-full border border-orange-100/20 bg-gradient-to-br from-white/20 via-orange-100/10 to-red-200/10 shadow-[inset_0_1px_0_#ffffff30,0_2px_10px_#00000015] backdrop-blur-md"
            initial={false} animate={reducedMotion ? { scaleX: 1, scaleY: 1 } : { scaleX: [.92, 1.1, .98, 1], scaleY: [1.08, .94, 1.02, 1] }}
            transition={{ duration: reducedMotion ? 0 : .65, ease: 'easeInOut' }}>
            <span className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </motion.span>
        </motion.span>
        {[false, true].map(format => <button key={String(format)} type="button" aria-pressed={use24Hours === format}
          onClick={() => setUse24Hours(format)}
          className={`relative z-10 rounded-full px-3 py-1.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange-200 motion-reduce:transition-none ${use24Hours === format ? 'text-orange-50' : 'text-orange-100/45 hover:text-orange-50'}`}>
          {format ? '24h' : '12h'}
        </button>)}
      </div>
      <span className="h-4 w-px bg-white/15" />
      <span className="min-w-16 text-xs font-medium tracking-widest text-orange-100/60 tabular-nums" aria-hidden="true">
        {String(seconds).padStart(2, '0')}s {!use24Hours && <span className="ml-2 text-orange-100/35">{now && now.getHours() >= 12 ? 'PM' : 'AM'}</span>}
      </span>
    </div>
    <div aria-hidden="true" className="mt-6 h-px w-40 overflow-hidden bg-white/10">
      <motion.div className="h-full origin-left bg-gradient-to-r from-orange-400/30 to-orange-200/80"
        animate={{ scaleX: (seconds + 1) / 60 }} transition={{ duration: reducedMotion || seconds === 0 ? 0 : .5, ease: 'easeOut' }} />
    </div>
  </div>;
}

export default function AdminSleepScreen({ isOpen, onWake }: { isOpen: boolean; onWake: () => void }) {
  const reducedMotion = useReducedMotion();
  return <Modal isOpen={isOpen} onClose={onWake} size="full" hideCloseButton isDismissable={false}
    disableAnimation={Boolean(reducedMotion)} scrollBehavior="inside"
    motionProps={{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: .3 } }}
    classNames={{ wrapper: 'z-[100] !p-0', backdrop: 'z-[99] bg-black/70 backdrop-blur-xl', base: 'dark !m-0 !h-[100dvh] !max-h-[100dvh] !max-w-none overflow-hidden !rounded-none bg-[#100c0d] text-white' }}>
    <ModalContent aria-labelledby="admin-sleep-title" aria-describedby="admin-sleep-description">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-8 overflow-hidden blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,#51231c_0%,#201314_45%,#100c0d_85%)]" />
        <motion.div className="absolute bottom-[-35%] left-[-10%] h-[80vh] w-[80vw] rounded-[50%] bg-orange-500/30 blur-[120px]"
          animate={reducedMotion ? undefined : { x: [0, 60, 0], y: [0, -35, 0], scale: [1, 1.1, 1] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute bottom-[-30%] right-[-15%] h-[75vh] w-[70vw] rounded-[50%] bg-red-500/25 blur-[120px]"
          animate={reducedMotion ? undefined : { x: [0, -60, 0], y: [0, -45, 0] }} transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="absolute -bottom-[51vw] left-1/2 h-[60vw] min-h-72 w-[130vw] -translate-x-1/2 rounded-[50%] border-t border-orange-200/10 bg-[#100c0d]/20 shadow-[0_-20px_90px_#fb923c08]" />
      </div>
      <ModalBody className="relative z-10 !gap-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-12 sm:py-9">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200/15 bg-gradient-to-br from-orange-300/15 to-red-400/5 text-orange-100">
              <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4v16M19 4v16M5 12h14M9 17c2 2 4 2 6 0" /></svg>
            </span>
            <span className="text-sm font-semibold tracking-tight text-orange-50/90">HappiNotes <span className="ml-1 hidden font-normal text-orange-100/40 sm:inline">/ Admin</span></span>
          </div>
          <span className="flex items-center gap-2 text-xs text-orange-100/50">
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11Z" /></svg>
            Sleep mode
          </span>
        </header>
        <motion.div className="flex flex-1 flex-col items-center justify-center py-12 text-center"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .1 }}>
          <h2 id="admin-sleep-title" className="mb-7 text-[10px] font-medium uppercase tracking-[.32em] text-orange-100/40 sm:mb-10">A little time for yourself</h2>
          <SleepClock />
          <p id="admin-sleep-description" className="mt-8 text-sm leading-relaxed text-orange-100/50 sm:mt-10">Everything is right where you left it.</p>
        </motion.div>
        <footer className="flex shrink-0 flex-col items-center gap-4 pb-2 sm:pb-4">
          <Button autoFocus onPress={onWake} size="lg" radius="full" startContent={<SunIcon />}
            endContent={<span aria-hidden="true" className="ml-5 text-lg text-orange-100/65">→</span>}
            className="h-14 min-w-52 border border-orange-100/25 bg-gradient-to-r from-orange-400/20 to-red-400/15 px-7 font-medium text-orange-50 shadow-[inset_0_1px_0_#fff2,0_8px_40px_#0002] backdrop-blur-2xl transition-[background-color,box-shadow,transform] hover:bg-orange-400/25 hover:shadow-[inset_0_1px_0_#fff3,0_8px_48px_#f9731620] data-[pressed=true]:scale-95 motion-reduce:transition-none">
            Wake up
          </Button>
          <p className="text-[11px] text-orange-100/35">or press <kbd className="ml-1 rounded border border-white/10 px-1.5 py-0.5 font-sans text-[10px] text-orange-100/55">esc</kbd></p>
        </footer>
      </ModalBody>
    </ModalContent>
  </Modal>;
}
