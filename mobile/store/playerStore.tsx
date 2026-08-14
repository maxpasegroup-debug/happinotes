import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from "expo-audio";
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { Book, Chapter } from "@/types/book";

export type PlayerTrack = { book: Book; chapter: Chapter; chapters: Chapter[] };
type PlayerContextValue = {
  currentTrack: PlayerTrack | null; isPlaying: boolean; positionMillis: number;
  durationMillis: number; playbackRate: number; volume: number;
  sleepTimerMinutes: number | null; playbackError: string;
  playTrack: (track: PlayerTrack, startPositionSeconds?: number) => Promise<void>;
  togglePlayback: () => Promise<void>; stopPlayback: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>; skipToChapter: (chapterId: string) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>; setVolumeLevel: (volume: number) => Promise<void>;
  setSleepTimer: (minutes: number | null) => void; saveProgressNow: (completed?: boolean) => Promise<void>;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const SECOND = 1000;
const isTrackableChapter = (chapterId: string) => chapterId !== "__intro__";

export function PlayerProvider({ children }: PropsWithChildren) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const trackRef = useRef<PlayerTrack | null>(null);
  const positionRef = useRef(0);
  const lastSavedSecondRef = useRef(0);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playTrackRef = useRef<(track: PlayerTrack, start?: number) => Promise<void>>(async () => undefined);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [playbackRate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState("");

  const saveTrackProgress = useCallback(async (track: PlayerTrack | null, seconds: number, completed = false) => {
    if (!track || !isTrackableChapter(track.chapter._id)) return;
    await api.post("/progress", { bookId: track.book._id, chapterId: track.chapter._id, positionSeconds: Math.floor(seconds), completed });
  }, []);
  const saveProgressNow = useCallback(async (completed = false) => {
    await saveTrackProgress(trackRef.current, positionRef.current, completed);
  }, [saveTrackProgress]);

  const handleStatus = useCallback((status: AudioStatus) => {
    setIsPlaying(status.playing);
    positionRef.current = status.currentTime;
    setPositionMillis(status.currentTime * SECOND);
    setDurationMillis(status.duration * SECOND);
    const track = trackRef.current;
    const second = Math.floor(status.currentTime);
    if (track && isTrackableChapter(track.chapter._id) && second > 0 && second - lastSavedSecondRef.current >= 10) {
      lastSavedSecondRef.current = second;
      void saveTrackProgress(track, second);
    }
    if (status.didJustFinish && track) {
      void saveTrackProgress(track, status.duration || status.currentTime, true);
      const index = track.chapters.findIndex((chapter) => chapter._id === track.chapter._id);
      const next = track.chapters.slice(index + 1).find((chapter) => chapter.audioUrl);
      if (next) void playTrackRef.current({ ...track, chapter: next }, 0);
    }
  }, [saveTrackProgress]);

  const ensurePlayer = useCallback((url: string) => {
    if (!playerRef.current) {
      const player = createAudioPlayer({ uri: url }, { updateInterval: 250, downloadFirst: true });
      playerRef.current = player;
      subscriptionRef.current = player.addListener("playbackStatusUpdate", handleStatus);
    } else playerRef.current.replace({ uri: url });
    return playerRef.current;
  }, [handleStatus]);

  const playTrack = useCallback(async (track: PlayerTrack, start = 0) => {
    if (!track.chapter.audioUrl) return;
    setPlaybackError("");
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" });
      await saveProgressNow();
      const player = ensurePlayer(track.chapter.audioUrl);
      player.volume = volume;
      player.setPlaybackRate(playbackRate);
      trackRef.current = track;
      setCurrentTrack(track);
      positionRef.current = start;
      setPositionMillis(start * SECOND);
      lastSavedSecondRef.current = start;
      if (start > 0) await player.seekTo(start);
      player.play();
    } catch (error) {
      setIsPlaying(false);
      setPlaybackError(error instanceof Error ? `Could not play this audio: ${error.message}` : "Could not play this audio file.");
    }
  }, [ensurePlayer, playbackRate, saveProgressNow, volume]);
  playTrackRef.current = playTrack;

  const togglePlayback = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.playing) { player.pause(); await saveProgressNow(); }
    else { if (player.duration > 0 && player.currentTime >= player.duration) await player.seekTo(0); player.play(); }
  }, [saveProgressNow]);
  const stopPlayback = useCallback(async () => {
    const player = playerRef.current; if (!player) return;
    player.pause(); await player.seekTo(0); positionRef.current = 0; setPositionMillis(0); setIsPlaying(false);
  }, []);
  const seekTo = useCallback(async (millis: number) => {
    const seconds = Math.max(0, millis / SECOND); await playerRef.current?.seekTo(seconds);
    positionRef.current = seconds; setPositionMillis(seconds * SECOND);
  }, []);
  const skipToChapter = useCallback(async (id: string) => {
    const track = trackRef.current; if (!track) return;
    const chapter = track.chapters.find((item) => item._id === id);
    if (chapter?.audioUrl) await playTrack({ ...track, chapter }, 0);
  }, [playTrack]);
  const setPlaybackRate = useCallback(async (rate: number) => { setRateState(rate); playerRef.current?.setPlaybackRate(rate); }, []);
  const setVolumeLevel = useCallback(async (value: number) => {
    const next = Math.min(1, Math.max(0, value)); setVolumeState(next); if (playerRef.current) playerRef.current.volume = next;
  }, []);
  const setSleepTimer = useCallback((minutes: number | null) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current); setSleepTimerMinutes(minutes);
    if (minutes) sleepTimerRef.current = setTimeout(() => { playerRef.current?.pause(); setIsPlaying(false); setSleepTimerMinutes(null); }, minutes * 60 * SECOND);
  }, []);

  useEffect(() => () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    void saveTrackProgress(trackRef.current, positionRef.current);
    subscriptionRef.current?.remove(); playerRef.current?.remove(); playerRef.current = null;
  }, [saveTrackProgress]);

  return <PlayerContext.Provider value={{ currentTrack, isPlaying, positionMillis, durationMillis, playbackRate, volume, sleepTimerMinutes, playbackError, playTrack, togglePlayback, stopPlayback, seekTo, skipToChapter, setPlaybackRate, setVolumeLevel, setSleepTimer, saveProgressNow }}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
}
