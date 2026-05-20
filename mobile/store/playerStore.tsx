import { Audio, AVPlaybackStatus } from "expo-av";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/services/api";
import { Book, Chapter } from "@/types/book";

export type PlayerTrack = {
  book: Book;
  chapter: Chapter;
  chapters: Chapter[];
};

type PlayerContextValue = {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  playbackRate: number;
  volume: number;
  sleepTimerMinutes: number | null;
  playTrack: (track: PlayerTrack, startPositionSeconds?: number) => Promise<void>;
  togglePlayback: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  skipToChapter: (chapterId: string) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  setVolumeLevel: (volume: number) => Promise<void>;
  setSleepTimer: (minutes: number | null) => void;
  saveProgressNow: (completed?: boolean) => Promise<void>;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const SECOND = 1000;

export function PlayerProvider({ children }: PropsWithChildren) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const lastSavedSecondRef = useRef(0);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [playbackRate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);

  const saveProgressNow = useCallback(
    async (completed = false) => {
      if (!currentTrack) return;

      await api.post("/progress", {
        bookId: currentTrack.book._id,
        chapterId: currentTrack.chapter._id,
        positionSeconds: Math.floor(positionMillis / SECOND),
        completed,
      });
    },
    [currentTrack, positionMillis]
  );

  const unloadSound = useCallback(async () => {
    if (!soundRef.current) return;
    await soundRef.current.unloadAsync();
    soundRef.current.setOnPlaybackStatusUpdate(null);
    soundRef.current = null;
  }, []);

  const playTrack = useCallback(
    async (track: PlayerTrack, startPositionSeconds = 0) => {
      if (!track.chapter.audioUrl) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      if (currentTrack) await saveProgressNow();
      await unloadSound();

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.chapter.audioUrl },
        {
          shouldPlay: true,
          positionMillis: Math.max(0, startPositionSeconds * SECOND),
          rate: playbackRate,
          volume,
        }
      );

      soundRef.current = sound;
      setCurrentTrack(track);
      setIsPlaying(true);
      lastSavedSecondRef.current = startPositionSeconds;

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;

        setIsPlaying(status.isPlaying);
        setPositionMillis(status.positionMillis);
        setDurationMillis(status.durationMillis || 0);

        const currentSecond = Math.floor(status.positionMillis / SECOND);
        if (currentSecond > 0 && currentSecond - lastSavedSecondRef.current >= 10) {
          lastSavedSecondRef.current = currentSecond;
          void api.post("/progress", {
            bookId: track.book._id,
            chapterId: track.chapter._id,
            positionSeconds: currentSecond,
            completed: false,
          });
        }

        if (status.didJustFinish) {
          void api.post("/progress", {
            bookId: track.book._id,
            chapterId: track.chapter._id,
            positionSeconds: Math.floor((status.durationMillis || status.positionMillis) / SECOND),
            completed: true,
          });

          const currentIndex = track.chapters.findIndex((chapter) => chapter._id === track.chapter._id);
          const nextChapter = track.chapters.slice(currentIndex + 1).find((chapter) => chapter.audioUrl);
          if (nextChapter) {
            void playTrack({ ...track, chapter: nextChapter }, 0);
          }
        }
      });
    },
    [currentTrack, playbackRate, saveProgressNow, unloadSound, volume]
  );

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;

    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      await saveProgressNow();
    } else {
      await soundRef.current.playAsync();
    }
  }, [saveProgressNow]);

  const seekTo = useCallback(async (millis: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(Math.max(0, millis));
    setPositionMillis(Math.max(0, millis));
  }, []);

  const skipToChapter = useCallback(
    async (chapterId: string) => {
      if (!currentTrack) return;
      const chapter = currentTrack.chapters.find((item) => item._id === chapterId);
      if (!chapter?.audioUrl) return;
      await playTrack({ ...currentTrack, chapter }, 0);
    },
    [currentTrack, playTrack]
  );

  const setPlaybackRate = useCallback(async (rate: number) => {
    setRateState(rate);
    if (soundRef.current) await soundRef.current.setRateAsync(rate, true);
  }, []);

  const setVolumeLevel = useCallback(async (nextVolume: number) => {
    const clamped = Math.min(1, Math.max(0, nextVolume));
    setVolumeState(clamped);
    if (soundRef.current) await soundRef.current.setVolumeAsync(clamped);
  }, []);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      setSleepTimerMinutes(minutes);

      if (minutes) {
        sleepTimerRef.current = setTimeout(() => {
          void soundRef.current?.pauseAsync();
          setSleepTimerMinutes(null);
        }, minutes * 60 * SECOND);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      void saveProgressNow();
      void unloadSound();
    };
  }, [saveProgressNow, unloadSound]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        positionMillis,
        durationMillis,
        playbackRate,
        volume,
        sleepTimerMinutes,
        playTrack,
        togglePlayback,
        seekTo,
        skipToChapter,
        setPlaybackRate,
        setVolumeLevel,
        setSleepTimer,
        saveProgressNow,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
}
