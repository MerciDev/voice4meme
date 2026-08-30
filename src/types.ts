export interface Dialogue {
  id: string;
  characterId: string;
  startTime: number;
  endTime: number;
  text: string;
  audioBlobUrl?: string;
  audioBlobStartTime?: number;
}

export interface Character {
  id: string;
  name: string;
  color: string;
}

export interface Scene {
  id: string;
  title: string;
  videoUrl: string;
  backgroundAudioUrl?: string;
  characters: Character[];
  dialogues: Dialogue[];
}

export interface StudioClip {
  id: string;
  startTime: number;
  endTime: number;
  trackIndex: number;
  blobUrl: string;
  base64?: string;
  blob?: Blob;
  
  // Audio Editor properties
  volume?: number;      // 0 to 2
  pitch?: number;       // 0.5 to 2 (playbackRate)
  eqLow?: number;       // -12 to 12 dB
  eqMid?: number;       // -12 to 12 dB
  eqHigh?: number;      // -12 to 12 dB
  fadeIn?: boolean;     // apply 2s fade in
  fadeOut?: boolean;    // apply 2s fade out
}

export interface RecordedTrack {
  sceneId: string;
  characterId: string;
  audioUrl?: string;
  clips?: { startTime: number, trackIndex?: number, base64: string }[];
  audioBlob?: Blob;
  recordedByUserId?: string;
}

export interface User {
  id: string;
  name: string;
  icon: string;
  isHost: boolean;
}

export type GamePhase = 'LOBBY' | 'ASSIGNING' | 'RECORDING' | 'WAITING' | 'REVEAL';

export interface Assignment {
  userId: string;
  sceneId: string;
  characterId: string;
}

export interface PlaylistScene {
  sceneId: string;
  sceneTitle: string;
  characterCount: number;
}

export interface Room {
  code: string;
  users: User[];
  phase: GamePhase;
  playlist: PlaylistScene[];
  assignments: Assignment[];
  currentSceneIndex: number;
}
