import './style.css';
import type { Scene, Character, Dialogue, RecordedTrack, User, Room, PlaylistScene, Assignment } from './types';
import { defaultScenes } from './data';

// --- YouTube API Global Setup ---
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
    removeScene: (idx: number) => void;
    removeAdminScene: (id: string) => void;
    editScene: (id: string) => void;
  }
}

let ytApiReady = false;
window.onYouTubeIframeAPIReady = () => {
  ytApiReady = true;
};

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --- VideoController Abstraction ---
class VideoController {
  private wrapper: HTMLElement;
  private htmlVideo: HTMLVideoElement | null = null;
  private ytPlayer: any = null;
  private isYT = false;
  private timeUpdateInterval: any = null;
  private bgAudio: HTMLAudioElement | null = null;
  
  public onTimeUpdate: (time: number, duration: number) => void = () => {};
  public onEnded: () => void = () => {};
  public onPause: () => void = () => {};
  public onPlay: () => void = () => {};

  constructor(wrapperId: string) {
    this.wrapper = document.getElementById(wrapperId)!;
  }

  setWrapper(wrapperId: string) {
    const oldLoader = this.wrapper.querySelector('div[style*="Cargando"]');
    this.wrapper = document.getElementById(wrapperId)!;
    
    if (this.htmlVideo) this.wrapper.appendChild(this.htmlVideo);
    if (this.isYT && this.ytPlayer && this.ytPlayer.getIframe) {
      const iframe = this.ytPlayer.getIframe();
      if (iframe) this.wrapper.appendChild(iframe);
    }
    if (oldLoader) this.wrapper.appendChild(oldLoader);
  }

  async load(url: string, bgAudioUrl?: string) {
    this.destroy();
    
    if (bgAudioUrl) {
      this.bgAudio = new Audio(bgAudioUrl);
      this.bgAudio.load();
    }
    
    const loader = document.createElement('div');
    loader.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:rgba(255,255,255,0.7); font-size:1.2rem; pointer-events:none; z-index:50; text-shadow: 0 2px 4px rgba(0,0,0,0.8);';
    loader.innerHTML = '⏳ Cargando vídeo...';
    this.wrapper.appendChild(loader);
    
    const ytId = getYouTubeId(url);
    
    if (ytId) {
      this.isYT = true;
      while (!ytApiReady || !window.YT) {
        await new Promise(r => setTimeout(r, 100));
      }
      const div = document.createElement('div');
      this.wrapper.appendChild(div);
      
      return new Promise<void>((resolve) => {
        this.ytPlayer = new window.YT.Player(div, {
          videoId: ytId,
          playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => {
              loader.remove();
              this.setAudioMode(activeAudioMode);
              if (this.ytPlayer.getDuration && this.ytPlayer.getCurrentTime) {
                this.onTimeUpdate(this.ytPlayer.getCurrentTime(), this.ytPlayer.getDuration());
              }
              resolve();
            },
            onStateChange: (e: any) => {
              if (e.data === window.YT.PlayerState.PLAYING) {
                this.onPlay();
                this.startTimePoll();
              } else if (e.data === window.YT.PlayerState.PAUSED) {
                this.onPause();
                this.stopTimePoll();
              } else if (e.data === window.YT.PlayerState.ENDED) {
                this.stopTimePoll();
                this.onEnded();
              }
            }
          }
        });
      });
    } else {
      this.isYT = false;
      this.htmlVideo = document.createElement('video');
      this.htmlVideo.src = url;
      this.htmlVideo.crossOrigin = "anonymous";
      this.htmlVideo.playsInline = true;
      this.setAudioMode(activeAudioMode);
      this.htmlVideo.style.width = '100%';
      this.htmlVideo.style.height = '100%';
      this.htmlVideo.style.objectFit = 'contain';
      
      this.htmlVideo.addEventListener('loadedmetadata', () => {
        if (this.htmlVideo) this.onTimeUpdate(this.htmlVideo.currentTime, this.htmlVideo.duration || 0);
      });
      this.htmlVideo.addEventListener('timeupdate', () => {
        if (this.htmlVideo) this.onTimeUpdate(this.htmlVideo.currentTime, this.htmlVideo.duration || 0);
      });
      this.htmlVideo.addEventListener('canplay', () => loader.remove());
      this.htmlVideo.addEventListener('error', () => {
        loader.innerHTML = '❌ Error cargando vídeo<br><span style="font-size:0.8rem">(Enlace caducado o denegado)</span>';
        setTimeout(() => loader.remove(), 4000);
      });
      this.htmlVideo.addEventListener('ended', () => this.onEnded());
      this.htmlVideo.addEventListener('pause', () => this.onPause());
      this.htmlVideo.addEventListener('play', () => this.onPlay());
      
      this.wrapper.appendChild(this.htmlVideo);
      return Promise.resolve();
    }
  }

  play() {
    if (this.isYT && this.ytPlayer) this.ytPlayer.playVideo();
    else if (this.htmlVideo) this.htmlVideo.play();
    
    if (this.bgAudio) this.bgAudio.play();
  }

  pause() {
    if (this.isYT && this.ytPlayer) this.ytPlayer.pauseVideo();
    else if (this.htmlVideo) this.htmlVideo.pause();
    
    if (this.bgAudio) this.bgAudio.pause();
  }

  get currentTime(): number {
    if (this.isYT && this.ytPlayer && this.ytPlayer.getCurrentTime) {
      return this.ytPlayer.getCurrentTime();
    } else if (this.htmlVideo) {
      return this.htmlVideo.currentTime;
    }
    return 0;
  }

  set currentTime(time: number) {
    if (this.isYT && this.ytPlayer) this.ytPlayer.seekTo(time, true);
    else if (this.htmlVideo) this.htmlVideo.currentTime = time;
    
    if (this.bgAudio) this.bgAudio.currentTime = time;
  }

  setVolume(vol: number) {
    if (this.isYT && this.ytPlayer && this.ytPlayer.setVolume) this.ytPlayer.setVolume(vol * 100);
    else if (this.htmlVideo) this.htmlVideo.volume = vol;
    
    if (this.bgAudio) this.bgAudio.volume = vol;
  }

  loadBgAudio(url: string) {
    if (this.bgAudio) {
      this.bgAudio.pause();
      this.bgAudio.src = '';
      this.bgAudio = null;
    }
    if (url) {
      this.bgAudio = new Audio(url);
      this.bgAudio.load();
      
      const volSlider = document.getElementById('editor-vol-slider') as HTMLInputElement;
      if (volSlider) this.bgAudio.volume = parseFloat(volSlider.value);
      
      this.setAudioMode(activeAudioMode);
      this.bgAudio.currentTime = this.currentTime;
      
      // If video is playing, play bgAudio
      const isPlaying = (this.htmlVideo && !this.htmlVideo.paused) || (this.isYT && this.ytPlayer && this.ytPlayer.getPlayerState && this.ytPlayer.getPlayerState() === 1);
      if (isPlaying) {
        this.bgAudio.play();
      }
    }
  }

  setAudioMode(mode: 'original' | 'background') {
    if (mode === 'original') {
      if (this.isYT && this.ytPlayer && this.ytPlayer.unMute) this.ytPlayer.unMute();
      else if (this.htmlVideo) this.htmlVideo.muted = false;
      if (this.bgAudio) this.bgAudio.muted = true;
    } else {
      if (this.isYT && this.ytPlayer && this.ytPlayer.mute) this.ytPlayer.mute();
      else if (this.htmlVideo) this.htmlVideo.muted = true;
      if (this.bgAudio) this.bgAudio.muted = false;
    }
  }

  private startTimePoll() {
    if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
    this.timeUpdateInterval = setInterval(() => {
      if (this.ytPlayer && this.ytPlayer.getCurrentTime && this.ytPlayer.getDuration) {
        this.onTimeUpdate(this.ytPlayer.getCurrentTime(), this.ytPlayer.getDuration());
      }
    }, 100);
  }

  private stopTimePoll() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  destroy() {
    this.stopTimePoll();
    if (this.bgAudio) {
      this.bgAudio.pause();
      this.bgAudio.src = '';
      this.bgAudio = null;
    }
    if (this.isYT && this.ytPlayer) {
      this.ytPlayer.destroy();
      this.ytPlayer = null;
    } else if (this.htmlVideo) {
      this.htmlVideo.pause();
      this.htmlVideo.removeAttribute('src');
      this.htmlVideo.load();
      this.wrapper.innerHTML = '';
      this.htmlVideo = null;
    }
    this.wrapper.innerHTML = '';
  }
}

// --- Global Data (LocalStorage merged) ---
function loadScenes(): Scene[] {
  let loaded = [...defaultScenes];
  
  const delStr = localStorage.getItem('voiceme_deleted_scenes');
  if (delStr) {
    try {
      const deletedIds: string[] = JSON.parse(delStr);
      loaded = loaded.filter(s => !deletedIds.includes(s.id));
    } catch (e) {}
  }

  const localStr = localStorage.getItem('voiceme_scenes');
  if (localStr) {
    try {
      const localScenes: Scene[] = JSON.parse(localStr);
      localScenes.forEach(ls => {
        const idx = loaded.findIndex(s => s.id === ls.id);
        if (idx >= 0) loaded[idx] = ls;
        else loaded.push(ls);
      });
    } catch (e) {}
  }
  return loaded;
}

function saveLocalScene(scene: Scene) {
  const localStr = localStorage.getItem('voiceme_scenes');
  let localScenes: Scene[] = [];
  if (localStr) {
    try { localScenes = JSON.parse(localStr); } catch (e) {}
  }
  
  const idx = localScenes.findIndex(s => s.id === scene.id);
  if (idx >= 0) localScenes[idx] = scene;
  else localScenes.push(scene);
  
  localStorage.setItem('voiceme_scenes', JSON.stringify(localScenes));
  scenes = loadScenes();
}

function deleteGlobalScene(id: string) {
  // Check if it's a local scene
  const localStr = localStorage.getItem('voiceme_scenes');
  let localScenes: Scene[] = [];
  if (localStr) {
    try { localScenes = JSON.parse(localStr); } catch (e) {}
  }
  const isLocal = localScenes.some(s => s.id === id);
  if (isLocal) {
    localScenes = localScenes.filter(s => s.id !== id);
    localStorage.setItem('voiceme_scenes', JSON.stringify(localScenes));
  }
  
  // Check if it's a default scene, mark as deleted
  const isDefault = defaultScenes.some(s => s.id === id);
  if (isDefault) {
    const delStr = localStorage.getItem('voiceme_deleted_scenes');
    let deletedIds: string[] = [];
    if (delStr) {
      try { deletedIds = JSON.parse(delStr); } catch (e) {}
    }
    deletedIds.push(id);
    localStorage.setItem('voiceme_deleted_scenes', JSON.stringify(deletedIds));
  }
  
  scenes = loadScenes();
}

const bc = new BroadcastChannel('voiceme-room');
let scenes: Scene[] = loadScenes();

// --- State ---
let recordedTracks: RecordedTrack[] = [];
let currentUser: User | null = null;
let currentRoom: Room | null = null;
let isRecording = false;

// Media
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let stream: MediaStream | null = null;
let mixAudioPlayers: HTMLAudioElement[] = [];

// Video Controllers
const editorVidCtrl = new VideoController('editor-video-mount');
const resultVidCtrl = new VideoController('result-video-wrapper');

// --- DOM Elements ---
const views = [
  'view-landing', 'view-join', 'view-lobby', 'view-library',
  'view-assignment', 'view-spectator', 'view-dub', 'view-waiting', 'view-result',
  'view-editor', 'view-admin-library', 'view-studio'
].map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[];

function showView(viewId: string) {
  if (viewId !== 'view-studio' && typeof studioLoopId !== 'undefined') {
    cancelAnimationFrame(studioLoopId);
    if (editorVidCtrl.wrapper === document.getElementById('studio-video-mount')) {
      editorVidCtrl.pause();
    }
  }

  views.forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  const v = document.getElementById(viewId);
  if (v) {
    v.classList.remove('hidden');
    v.classList.add('active');
  }
  window.scrollTo(0, 0);
}

function formatTimecode(seconds: number) {
  if (isNaN(seconds)) return '00:00:00:000';
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s}:${ms}`;
}

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Global Nav
const btnHome = document.getElementById('btn-home')!;
const btnOpenAdmin = document.getElementById('btn-open-admin')!;
const modalPassword = document.getElementById('modal-password')!;
const formPassword = document.getElementById('form-password') as HTMLFormElement;
const inputPassword = document.getElementById('input-password') as HTMLInputElement;
const btnCancelPassword = document.getElementById('btn-cancel-password')!;
const passwordError = document.getElementById('password-error')!;

btnHome.addEventListener('click', () => {
  currentRoom = null;
  editorVidCtrl.destroy();
  resultVidCtrl.destroy();
  window.history.pushState({}, '', '/');
  showView('view-landing');
});

btnOpenAdmin.addEventListener('click', () => {
  inputPassword.value = '';
  passwordError.classList.add('hidden');
  modalPassword.classList.remove('hidden');
});
btnCancelPassword.addEventListener('click', () => modalPassword.classList.add('hidden'));

formPassword.addEventListener('submit', (e) => {
  e.preventDefault();
  if (inputPassword.value === '1234') {
    modalPassword.classList.add('hidden');
    renderAdminLibrary();
  } else {
    passwordError.classList.remove('hidden');
  }
});

// --- Admin Library ---
const adminLibraryGrid = document.getElementById('admin-library-grid')!;
const btnAdminClose = document.getElementById('btn-admin-close')!;
const btnAdminCreate = document.getElementById('btn-admin-create')!;

function renderAdminLibrary() {
  adminLibraryGrid.innerHTML = '';
  scenes.forEach(scene => {
    const ytId = getYouTubeId(scene.videoUrl);
    const bgImage = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '';
    
    const card = document.createElement('div');
    card.className = 'scene-card glass-panel';
    card.innerHTML = `
      ${bgImage ? `<div style="height:140px; background:url(${bgImage}) center/cover; border-radius:6px 6px 0 0; margin:-1.5rem -1.5rem 1rem -1.5rem;"></div>` : ''}
      <div class="scene-info">
        <h3>${scene.title}</h3>
        <p>${scene.characters.length} personajes</p>
      </div>
      <div style="display:flex; justify-content:space-between; padding:1rem; border-top:1px solid var(--panel-border);">
        <button class="btn secondary small" onclick="window.editScene('${scene.id}')">✏️ Editar</button>
        <button class="btn secondary small" onclick="window.removeAdminScene('${scene.id}')" style="color:var(--danger)">🗑️</button>
      </div>
    `;
    adminLibraryGrid.appendChild(card);
  });
  showView('view-admin-library');
}

btnAdminClose.addEventListener('click', () => showView('view-landing'));
btnAdminCreate.addEventListener('click', () => {
  editingSceneId = null;
  document.getElementById('editor-main-title')!.textContent = "Estudio de Creación";
  initEditor();
  showView('view-editor');
});

window.removeAdminScene = (id: string) => {
  if (confirm("¿Seguro que quieres borrar esta escena?")) {
    deleteGlobalScene(id);
    renderAdminLibrary();
  }
};

window.editScene = (id: string) => {
  const scene = scenes.find(s => s.id === id);
  if (!scene) return;
  editingSceneId = id;
  newScene = JSON.parse(JSON.stringify(scene)); // Deep copy
  document.getElementById('editor-main-title')!.textContent = "Editar Escena";
  
  editorTitle.value = newScene.title;
  editorVideoUrl.value = newScene.videoUrl;
  editorBtnPlay.innerHTML = playIcon;
  tlBtnPlay.innerHTML = playIcon;
  editorIsPlaying = false;
  
  editorVidCtrl.destroy();
  if (newScene.videoUrl) {
    editorVidCtrl.load(newScene.videoUrl, newScene.backgroundAudioUrl);
    generateWaveform(newScene.backgroundAudioUrl || newScene.videoUrl);
  }
  renderEditorState();
  showView('view-editor');
};
// --- Audio & SRT State ---
let activeAudioMode: 'original' | 'background' = 'original';

// --- Editor Logic ---
const btnAudioToggle = document.getElementById('btn-audio-toggle')!;
const modalSrtMapping = document.getElementById('modal-srt-mapping')!;
const srtMappingList = document.getElementById('srt-mapping-list')!;
const btnCancelSrt = document.getElementById('btn-cancel-srt')!;
const btnConfirmSrt = document.getElementById('btn-confirm-srt')!;
const srtBulkCharSelect = document.getElementById('srt-bulk-char-select') as HTMLSelectElement;
const srtBulkNewCharInput = document.getElementById('srt-bulk-new-char-input') as HTMLInputElement;
const btnSrtAssign = document.getElementById('btn-srt-assign')!;
const editorVolSlider = document.getElementById('editor-vol-slider') as HTMLInputElement;

const btnEnterStudio = document.getElementById('btn-enter-studio')!;
const viewStudio = document.getElementById('view-studio')!;
const btnExitStudio = document.getElementById('btn-exit-studio')!;
const btnStudioMixer = document.getElementById('btn-studio-mixer')!;
const studioCharList = document.getElementById('studio-char-list')!;
const studioPrompterList = document.getElementById('studio-prompter-list')!;
const studioBtnPlay = document.getElementById('studio-btn-play')!;
const studioTimeDisplay = document.getElementById('studio-time-display')!;
const studioAudioToggle = document.getElementById('studio-audio-toggle')!;

const studioModeSelect = document.getElementById('studio-mode-select') as HTMLSelectElement;
const studioFreestyleControls = document.getElementById('studio-freestyle-controls')!;
const btnGlobalRecord = document.getElementById('btn-global-record') as HTMLButtonElement;
const studioMultitrackSection = document.getElementById('studio-multitrack-section')!;
const studioMultitrackTimeline = document.getElementById('studio-multitrack-timeline')!;
const studioMultitrackPlayhead = document.getElementById('studio-multitrack-playhead')!;
const studioRuler = document.getElementById('studio-ruler')!;
const studioZoomOut = document.getElementById('studio-zoom-out') as HTMLButtonElement;
const studioZoomIn = document.getElementById('studio-zoom-in') as HTMLButtonElement;

let studioMode: 'guided' | 'freestyle' = 'guided';
let studioRecordedClips: import('./types').StudioClip[] = [];
let studioZoom = 1;

studioZoomOut.addEventListener('click', () => {
  studioZoom = Math.max(1, studioZoom - 0.5);
  studioMultitrackTimeline.style.width = `calc(100% * ${studioZoom})`;
  if (typeof renderStudioMultitrack === 'function') renderStudioMultitrack();
});

studioZoomIn.addEventListener('click', () => {
  studioZoom = Math.min(10, studioZoom + 0.5);
  studioMultitrackTimeline.style.width = `calc(100% * ${studioZoom})`;
  if (typeof renderStudioMultitrack === 'function') renderStudioMultitrack();
});

studioModeSelect.addEventListener('change', () => {
  studioMode = studioModeSelect.value as 'guided' | 'freestyle';
  if (studioMode === 'freestyle') {
    studioFreestyleControls.classList.remove('hidden');
    studioMultitrackSection.classList.remove('hidden');
  } else {
    studioFreestyleControls.classList.add('hidden');
    studioMultitrackSection.classList.add('hidden');
  }
  renderStudioMultitrack();
});

let activeStudioCharacterId: string | null = null;
let studioIsPlaying = false;
let studioActiveAudioMode: 'original' | 'background' = 'original';
let studioMediaRecorder: MediaRecorder | null = null;
let studioAudioChunks: Blob[] = [];
let recordingDialogueId: string | null = null;
let mixerAudioPlayers: HTMLAudioElement[] = [];
let isMixerMode = false;

const editorTitle = document.getElementById('editor-title') as HTMLInputElement;
const editorVideoUrl = document.getElementById('editor-video-url') as HTMLInputElement;
const editorBackgroundUrl = document.getElementById('editor-background-url') as HTMLInputElement;
const editorImportSrt = document.getElementById('editor-import-srt') as HTMLInputElement;
const btnLoadVideo = document.getElementById('btn-load-video')!;
const editorCharList = document.getElementById('editor-char-list')!;
const editorCharName = document.getElementById('editor-char-name') as HTMLInputElement;
const editorCharColor = document.getElementById('editor-char-color') as HTMLInputElement;
const btnAddChar = document.getElementById('btn-add-char')!;
const editorStartTime = document.getElementById('editor-start-time') as HTMLInputElement;
const editorEndTime = document.getElementById('editor-end-time') as HTMLInputElement;
const btnCapStart = document.getElementById('btn-cap-start')!;
const btnCapEnd = document.getElementById('btn-cap-end')!;
const btnAddDialogue = document.getElementById('btn-add-dialogue')!;
const btnSaveScene = document.getElementById('btn-save-scene')!;
const btnExitEditor = document.getElementById('btn-exit-editor')!;

// NLE DOM
const nleRuler = document.getElementById('nle-ruler')!;
const nlePlayhead = document.getElementById('nle-playhead')!;
const nleTracks = document.getElementById('nle-tracks')!;
const nleTimecode = document.getElementById('nle-timecode')!;
const nleWaveformCanvas = document.getElementById('nle-waveform') as HTMLCanvasElement;
const nleWaveformStatus = document.getElementById('nle-waveform-status')!;
const nleWaveformWrapper = document.getElementById('nle-waveform-wrapper')!;
const inlineEditorContainer = document.getElementById('inline-editor-container')!;
const inlineDialogueText = document.getElementById('inline-dialogue-text') as HTMLTextAreaElement;
const btnInlineSave = document.getElementById('btn-inline-save')!;
const btnInlineDelete = document.getElementById('btn-inline-delete')!;
const btnInlineMerge = document.getElementById('btn-inline-merge') as HTMLButtonElement;
const inlineEditorSingle = document.getElementById('inline-editor-single')!;
const inlineEditorMulti = document.getElementById('inline-editor-multi')!;
const inlineMultiStatus = document.getElementById('inline-multi-status')!;
const btnMultiMerge = document.getElementById('btn-multi-merge')!;
const btnMultiDelete = document.getElementById('btn-multi-delete')!;
const inlineDialogueChar = document.getElementById('inline-dialogue-char') as HTMLSelectElement;
const editorZoomOut = document.getElementById('editor-zoom-out') as HTMLButtonElement;
const editorZoomIn = document.getElementById('editor-zoom-in') as HTMLButtonElement;
const nleTimeline = document.getElementById('nle-timeline')!;

const transcriptList = document.getElementById('transcript-list')!;
let activeDialogueIds = new Set<string>();
let nleZoom = 1;

editorZoomOut.addEventListener('click', () => {
  nleZoom = Math.max(1, nleZoom - 0.5);
  nleTimeline.style.width = `calc(100% * ${nleZoom})`;
});

editorZoomIn.addEventListener('click', () => {
  nleZoom = Math.min(10, nleZoom + 0.5);
  nleTimeline.style.width = `calc(100% * ${nleZoom})`;
});

// Waveform Generator
async function generateWaveform(url: string) {
  nleWaveformStatus.textContent = '🎧 Analizando audio...';
  const ctx = nleWaveformCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, nleWaveformCanvas.width, nleWaveformCanvas.height);
  
  const studioCanvas = document.getElementById('studio-waveform-canvas') as HTMLCanvasElement;
  let studioCtx: CanvasRenderingContext2D | null = null;
  if (studioCanvas) {
    studioCtx = studioCanvas.getContext('2d');
    if (studioCtx) studioCtx.clearRect(0, 0, studioCanvas.width, studioCanvas.height);
  }
  
  if (getYouTubeId(url)) {
    nleWaveformStatus.textContent = '⚠️ Onda no disponible para YouTube (CORS)';
    return;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error');
    const arrayBuffer = await response.arrayBuffer();
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const numBars = 1000;
    const step = Math.ceil(channelData.length / numBars);
    const peaks = [];
    let max = 0;
    
    for (let i = 0; i < numBars; i++) {
      let minP = 1.0;
      let maxP = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < minP) minP = datum;
        if (datum > maxP) maxP = datum;
      }
      const peak = Math.max(Math.abs(minP), Math.abs(maxP));
      peaks.push(peak);
      if (peak > max) max = peak;
    }
    
    nleWaveformCanvas.width = nleWaveformWrapper.offsetWidth;
    nleWaveformCanvas.height = nleWaveformWrapper.offsetHeight;
    const cw = nleWaveformCanvas.width;
    const ch = nleWaveformCanvas.height;
    
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const barWidth = cw / numBars;
    
    if (studioCtx) {
      studioCanvas.width = studioCanvas.offsetWidth;
      studioCanvas.height = studioCanvas.offsetHeight;
      studioCtx.fillStyle = 'rgba(255,255,255,0.4)';
    }
    const studioBarWidth = studioCanvas ? studioCanvas.width / numBars : 0;
    
    for (let i = 0; i < numBars; i++) {
      const h = (peaks[i] / max) * ch * 0.9;
      const y = (ch - h) / 2;
      ctx.fillRect(i * barWidth, y, barWidth, h);
      
      if (studioCtx) {
        const sh = (peaks[i] / max) * studioCanvas.height * 0.9;
        const sy = (studioCanvas.height - sh) / 2;
        studioCtx.fillRect(i * studioBarWidth, sy, studioBarWidth, sh);
      }
    }
    
    nleWaveformStatus.textContent = '';
  } catch (e) {
    console.error(e);
    nleWaveformStatus.textContent = '❌ Error cargando onda (CORS o Red)';
  }
}

// Custom Controls DOM
const editorBtnBack = document.getElementById('editor-btn-back')!;
const editorBtnPlay = document.getElementById('editor-btn-play')!;
const editorBtnForward = document.getElementById('editor-btn-forward')!;
const editorBtnReload = document.getElementById('editor-btn-reload')!;
const editorProgress = document.getElementById('editor-progress') as HTMLInputElement;
const editorTimeDisplay = document.getElementById('editor-time-display')!;

// Helper for mini waveform
async function drawMiniWaveform(blobUrl: string, canvas: HTMLCanvasElement, color: string) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  try {
    const response = await fetch(blobUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / canvas.width);
    const amp = canvas.height / 2;
    
    ctx.fillStyle = color;
    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  } catch (e) {
    console.error('Mini waveform error', e);
  }
}

const tlBtnBack = document.getElementById('tl-btn-back')!;
const tlBtnPlay = document.getElementById('tl-btn-play')!;
const tlBtnForward = document.getElementById('tl-btn-forward')!;

const playIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const pauseIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
let editorIsPlaying = false;
let editorCurrentDuration = 100;

let playheadRaf: number;
function startPlayheadLoop() {
  if (playheadRaf) cancelAnimationFrame(playheadRaf);
  const loop = () => {
    if (!editorIsPlaying) return;
    const time = editorVidCtrl.currentTime;
    const duration = editorCurrentDuration;
    
    if (duration > 0) {
      const pct = (time / duration) * 100;
      nlePlayhead.style.left = `${pct}%`;
      nleTimecode.textContent = formatTimecode(time);
      if (!editorProgress.matches(':active')) {
        editorProgress.value = ((time / duration) * 100).toString();
      }
      editorTimeDisplay.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
    }
    playheadRaf = requestAnimationFrame(loop);
  };
  playheadRaf = requestAnimationFrame(loop);
}

function openSceneEditor(sceneId: string) {
  const scene = loadScenes().find(s => s.id === sceneId);
  if (!scene) return;
  
  editingSceneId = sceneId;
  newScene = JSON.parse(JSON.stringify(scene));
  
  editorTitle.value = newScene.title;
  editorVideoUrl.value = newScene.videoUrl;
  editorBackgroundUrl.value = newScene.backgroundAudioUrl || '';
  editorBtnPlay.innerHTML = playIcon;
  tlBtnPlay.innerHTML = playIcon;
  editorIsPlaying = false;
  
  editorVidCtrl.destroy();
  if (newScene.videoUrl) {
    editorVidCtrl.load(newScene.videoUrl, newScene.backgroundAudioUrl);
    const targetAudioUrl = activeAudioMode === 'background' && newScene.backgroundAudioUrl ? newScene.backgroundAudioUrl : newScene.videoUrl;
    generateWaveform(targetAudioUrl);
  }
  
  activeAudioMode = 'original';
  btnAudioToggle.textContent = '🎵 Escuchando: Original';
  
  renderEditorState();
  showView('view-editor');
}

editorBtnPlay.addEventListener('click', () => {
  if (editorIsPlaying) {
    editorVidCtrl.pause();
    editorBtnPlay.innerHTML = playIcon;
    tlBtnPlay.innerHTML = playIcon;
    editorIsPlaying = false;
  } else {
    editorVidCtrl.play();
    editorBtnPlay.innerHTML = pauseIcon;
    tlBtnPlay.innerHTML = pauseIcon;
    editorIsPlaying = true;
    startPlayheadLoop();
  }
});
editorBtnBack.addEventListener('click', () => {
  editorVidCtrl.currentTime = Math.max(0, editorVidCtrl.currentTime - 5);
});
editorBtnForward.addEventListener('click', () => {
  editorVidCtrl.currentTime = editorVidCtrl.currentTime + 5;
});
editorBtnReload.addEventListener('click', async () => {
  if (newScene.videoUrl) {
    editorBtnPlay.innerHTML = playIcon;
    tlBtnPlay.innerHTML = playIcon;
    editorIsPlaying = false;
    await editorVidCtrl.load(newScene.videoUrl, newScene.backgroundAudioUrl);
  }
});
tlBtnPlay.addEventListener('click', () => {
  if (editorIsPlaying) {
    editorVidCtrl.pause();
    editorBtnPlay.innerHTML = playIcon;
    tlBtnPlay.innerHTML = playIcon;
    editorIsPlaying = false;
  } else {
    editorVidCtrl.play();
    editorBtnPlay.innerHTML = pauseIcon;
    tlBtnPlay.innerHTML = pauseIcon;
    editorIsPlaying = true;
    startPlayheadLoop();
  }
});
tlBtnBack.addEventListener('click', () => {
  editorVidCtrl.currentTime = Math.max(0, editorVidCtrl.currentTime - 5);
});
tlBtnForward.addEventListener('click', () => {
  editorVidCtrl.currentTime = editorVidCtrl.currentTime + 5;
});
btnAudioToggle.addEventListener('click', () => {
  activeAudioMode = activeAudioMode === 'original' ? 'background' : 'original';
  btnAudioToggle.textContent = activeAudioMode === 'original' ? '🎵 Escuchando: Original' : '🎵 Escuchando: Fondo';
  
  if (editorBackgroundUrl.value && editorBackgroundUrl.value !== newScene.backgroundAudioUrl) {
    newScene.backgroundAudioUrl = editorBackgroundUrl.value;
    editorVidCtrl.loadBgAudio(newScene.backgroundAudioUrl);
  }
  
  editorVidCtrl.setAudioMode(activeAudioMode);
  const targetAudioUrl = activeAudioMode === 'background' && newScene.backgroundAudioUrl ? newScene.backgroundAudioUrl : newScene.videoUrl;
  generateWaveform(targetAudioUrl);
});
editorVolSlider.addEventListener('input', () => {
  editorVidCtrl.setVolume(parseFloat(editorVolSlider.value));
});
editorProgress.addEventListener('input', () => {
  // We assume range 0-100, we need duration
  // We'll update currentTime based on percentage
});
editorProgress.addEventListener('change', () => {
  const percent = parseFloat(editorProgress.value);
  // Need to know duration to seek correctly. Let's store it globally for the editor
});
let newScene: Scene = { id: '', title: '', videoUrl: '', characters: [], dialogues: [] };
let editingSceneId: string | null = null;
let selectedCharId: string | null = null;

function initEditor() {
  newScene = { id: `s_${Date.now()}`, title: '', videoUrl: '', characters: [], dialogues: [] };
  editorTitle.value = '';
  editorVideoUrl.value = '';
  editorBackgroundUrl.value = '';
  editorStartTime.value = '';
  editorEndTime.value = '';
  selectedCharId = null;
  editorVidCtrl.destroy();
  renderEditorState();
}

function renderEditorState() {
  editorCharList.innerHTML = '';
  
  if (newScene.characters.length > 0 && !newScene.characters.find(c => c.id === selectedCharId)) {
    selectedCharId = newScene.characters[0].id;
  }
  if (newScene.characters.length === 0) {
    selectedCharId = null;
  }
  
  newScene.characters.forEach((c) => {
    const span = document.createElement('span');
    const isSelected = selectedCharId === c.id;
    const bg = isSelected ? c.color : `${c.color}44`;
    const fg = isSelected ? '#fff' : c.color;
    
    span.style.cssText = `background:${bg}; color:${fg}; border:1px solid ${c.color}; padding:0.25rem 0.5rem; border-radius:4px; margin-right:0.5rem; font-weight:bold; display:inline-block; margin-bottom:0.5rem; cursor:pointer; transition:all 0.2s;`;
    if (isSelected) span.style.boxShadow = `0 0 8px ${c.color}`;
    span.textContent = c.name;
    
    span.addEventListener('click', () => {
      selectedCharId = c.id;
      renderEditorState();
    });
    
    editorCharList.appendChild(span);
  });

  renderNleTimeline();
}

function renderNleTimeline() {
  nleTracks.innerHTML = '';
  nleRuler.innerHTML = '';
  const dur = editorCurrentDuration || 100;
  
  // Draw Ruler Markers
  let step = 5;
  if (dur > 600) step = 60;
  else if (dur > 120) step = 15;
  else if (dur > 60) step = 10;
  else if (dur > 20) step = 5;
  else step = 1;
  
  for (let t = 0; t <= dur; t += step) {
    const mark = document.createElement('div');
    mark.style.position = 'absolute';
    mark.style.left = `${(t / dur) * 100}%`;
    mark.style.height = '10px';
    mark.style.borderLeft = '1px solid rgba(255,255,255,0.3)';
    mark.style.bottom = '0';
    mark.style.fontSize = '0.6rem';
    mark.style.color = 'var(--text-muted)';
    mark.style.paddingLeft = '2px';
    mark.style.pointerEvents = 'none';
    mark.textContent = formatTime(t).substring(3, 8); // e.g. MM:SS
    nleRuler.appendChild(mark);
  }
  
  newScene.characters.forEach((c) => {
    const track = document.createElement('div');
    track.className = 'nle-track';
    track.style.borderLeft = `4px solid ${c.color}`;
    
    const charDialogues = newScene.dialogues.filter(d => d.characterId === c.id);
    charDialogues.forEach(d => {
      const clip = document.createElement('div');
      clip.className = 'nle-clip';
      clip.style.background = c.color;
      
      const leftPct = (d.startTime / dur) * 100;
      const widthPct = ((d.endTime - d.startTime) / dur) * 100;
      clip.style.left = `${leftPct}%`;
      clip.style.width = `${widthPct}%`;
      clip.textContent = d.text;      clip.style.borderColor = c.color;
      if (activeDialogueIds.has(d.id)) {
        clip.classList.add('active');
      }
      
      const hLeft = document.createElement('div');
      hLeft.className = 'nle-handle left';
      const hRight = document.createElement('div');
      hRight.className = 'nle-handle right';
      
      clip.appendChild(hLeft);
      clip.appendChild(hRight);
      
      let isResizing = false;
      let resizeType = '';
      let initialX = 0;
      let initialStart = 0;
      let initialEnd = 0;
      let initialDuration = 0;
      
      const onMouseDown = (type: string) => (e: MouseEvent) => {
        isResizing = true;
        resizeType = type;
        initialX = e.clientX;
        initialStart = d.startTime;
        initialEnd = d.endTime;
        initialDuration = d.endTime - d.startTime;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        if(type === 'center') e.preventDefault();
      };
      
      const onMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const dx = e.clientX - initialX;
        let dt = (dx / nleTracks.offsetWidth) * dur;
        
        const snapTargets: number[] = [editorVidCtrl.currentTime];
        newScene.dialogues.forEach(otherD => {
          if (otherD.id === d.id) return;
          snapTargets.push(otherD.startTime);
          snapTargets.push(otherD.endTime);
        });
        
        const applySnap = (time: number): number => {
          let closest = time;
          let minDiff = 0.5; // Umbral de snap: medio segundo
          for (const target of snapTargets) {
            const diff = Math.abs(target - time);
            if (diff < minDiff) {
              minDiff = diff;
              closest = target;
            }
          }
          return closest;
        };

        if (resizeType === 'left') {
          let newStart = Math.max(0, Math.min(initialStart + dt, d.endTime - 0.5));
          d.startTime = applySnap(newStart);
        } else if (resizeType === 'right') {
          let newEnd = Math.min(dur, Math.max(d.startTime + 0.5, initialEnd + dt));
          d.endTime = applySnap(newEnd);
        } else if (resizeType === 'center') {
          let newStart = Math.max(0, Math.min(initialStart + dt, dur - initialDuration));
          let snappedStart = applySnap(newStart);
          let snappedEnd = applySnap(newStart + initialDuration);
          
          if (Math.abs(snappedStart - newStart) < Math.abs(snappedEnd - (newStart + initialDuration))) {
             d.startTime = snappedStart;
             d.endTime = snappedStart + initialDuration;
          } else {
             d.endTime = snappedEnd;
             d.startTime = snappedEnd - initialDuration;
          }
        }
        const lPct = (d.startTime / dur) * 100;
        const wPct = ((d.endTime - d.startTime) / dur) * 100;
        clip.style.left = `${lPct}%`;
        clip.style.width = `${wPct}%`;
      };
      
      const onMouseUp = (e: MouseEvent) => {
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        if (resizeType === 'center') {
          const dx = Math.abs(e.clientX - initialX);
          if (dx < 5) {
            handleDialogueSelection(d.id, e.ctrlKey || e.metaKey);
          }
        }
      };
      
      clip.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).classList.contains('nle-handle')) return;
        onMouseDown('center')(e);
      });
      hLeft.addEventListener('mousedown', onMouseDown('left'));
      hRight.addEventListener('mousedown', onMouseDown('right'));
      
      track.appendChild(clip);
    });
    nleTracks.appendChild(track);
  });
  
  renderTranscript();
}

function renderTranscript() {
  transcriptList.innerHTML = '';
  const sortedDialogues = [...newScene.dialogues].sort((a, b) => a.startTime - b.startTime);
  
  sortedDialogues.forEach(d => {
    const c = newScene.characters.find(char => char.id === d.characterId);
    if (!c) return;
    
    const div = document.createElement('div');
    const isActive = activeDialogueIds.has(d.id);
    div.className = `transcript-item ${isActive ? 'active' : ''}`;
    div.style.borderLeftColor = c.color;
    
    const timeSpan = document.createElement('span');
    timeSpan.style.fontFamily = 'monospace';
    timeSpan.style.fontSize = '0.8rem';
    timeSpan.style.color = 'var(--text-muted)';
    timeSpan.style.marginRight = '0.5rem';
    timeSpan.style.minWidth = '110px';
    timeSpan.textContent = `[${formatTime(d.startTime)} - ${formatTime(d.endTime)}]`;
    
    const textSpan = document.createElement('span');
    textSpan.style.color = c.color;
    textSpan.style.fontWeight = isActive ? 'bold' : 'normal';
    textSpan.textContent = d.text || '(Sin texto)';
    
    div.appendChild(timeSpan);
    div.appendChild(textSpan);
    
    div.addEventListener('click', (e) => {
      handleDialogueSelection(d.id, e.ctrlKey || e.metaKey);
      div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    transcriptList.appendChild(div);
  });
}

function handleDialogueSelection(id: string, isMulti: boolean) {
  if (isMulti) {
    if (activeDialogueIds.has(id)) activeDialogueIds.delete(id);
    else activeDialogueIds.add(id);
  } else {
    activeDialogueIds.clear();
    activeDialogueIds.add(id);
  }
  
  if (activeDialogueIds.size === 0) {
    inlineEditorContainer.classList.add('hidden');
  } else if (activeDialogueIds.size === 1) {
    const singleId = Array.from(activeDialogueIds)[0];
    const d = newScene.dialogues.find(x => x.id === singleId);
    if (d) {
      inlineEditorContainer.classList.remove('hidden');
      inlineEditorSingle.classList.remove('hidden');
      inlineEditorMulti.classList.add('hidden');
      inlineDialogueText.value = d.text;
      editorVidCtrl.currentTime = d.startTime;
      
      // Populate character select
      inlineDialogueChar.innerHTML = '';
      newScene.characters.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        opt.selected = c.id === d.characterId;
        inlineDialogueChar.appendChild(opt);
      });
      
      const sortedDialogues = [...newScene.dialogues].sort((a, b) => a.startTime - b.startTime);
      const currIndex = sortedDialogues.findIndex(x => x.id === d.id);
      const nextD = sortedDialogues[currIndex + 1];
      if (nextD && nextD.characterId === d.characterId) {
        btnInlineMerge.style.display = 'inline-block';
      } else {
        btnInlineMerge.style.display = 'none';
      }
    }
  } else {
    inlineEditorContainer.classList.remove('hidden');
    inlineEditorSingle.classList.add('hidden');
    inlineEditorMulti.classList.remove('hidden');
    inlineMultiStatus.textContent = `${activeDialogueIds.size} clips seleccionados.`;
  }
  
  renderNleTimeline();
}

btnInlineSave.addEventListener('click', () => {
  if (activeDialogueIds.size !== 1) return;
  const singleId = Array.from(activeDialogueIds)[0];
  const d = newScene.dialogues.find(d => d.id === singleId);
  if (d) {
    d.text = inlineDialogueText.value.trim();
    d.characterId = inlineDialogueChar.value;
  }
  renderNleTimeline();
});

btnInlineDelete.addEventListener('click', () => {
  if (activeDialogueIds.size !== 1) return;
  const singleId = Array.from(activeDialogueIds)[0];
  newScene.dialogues = newScene.dialogues.filter(d => d.id !== singleId);
  activeDialogueIds.clear();
  inlineEditorContainer.classList.add('hidden');
  renderNleTimeline();
});

btnInlineMerge.addEventListener('click', () => {
  if (activeDialogueIds.size !== 1) return;
  const singleId = Array.from(activeDialogueIds)[0];
  const sortedDialogues = [...newScene.dialogues].sort((a, b) => a.startTime - b.startTime);
  const currIndex = sortedDialogues.findIndex(x => x.id === singleId);
  const currD = sortedDialogues[currIndex];
  const nextD = sortedDialogues[currIndex + 1];
  
  if (currD && nextD && currD.characterId === nextD.characterId) {
    currD.text = (currD.text + " " + nextD.text).trim();
    currD.endTime = nextD.endTime; 
    newScene.dialogues = newScene.dialogues.filter(d => d.id !== nextD.id);
    inlineDialogueText.value = currD.text;
    
    const newSorted = [...newScene.dialogues].sort((a, b) => a.startTime - b.startTime);
    const newNextD = newSorted[newSorted.findIndex(x => x.id === currD.id) + 1];
    if (newNextD && newNextD.characterId === currD.characterId) {
      btnInlineMerge.style.display = 'inline-block';
    } else {
      btnInlineMerge.style.display = 'none';
    }
    
    renderNleTimeline();
  }
});

btnMultiDelete.addEventListener('click', () => {
  newScene.dialogues = newScene.dialogues.filter(d => !activeDialogueIds.has(d.id));
  activeDialogueIds.clear();
  inlineEditorContainer.classList.add('hidden');
  renderNleTimeline();
});

btnMultiMerge.addEventListener('click', () => {
  if (activeDialogueIds.size < 2) return;
  
  // Sort selected dialogues by start time
  const selectedDialogues = newScene.dialogues
    .filter(d => activeDialogueIds.has(d.id))
    .sort((a, b) => a.startTime - b.startTime);
    
  if (selectedDialogues.length === 0) return;
  
  const firstD = selectedDialogues[0];
  
  // Concat texts
  firstD.text = selectedDialogues.map(d => d.text).join(' ').trim();
  // Set end time to the latest end time
  firstD.endTime = Math.max(...selectedDialogues.map(d => d.endTime));
  
  // Remove all other selected dialogues
  const idsToRemove = new Set(selectedDialogues.slice(1).map(d => d.id));
  newScene.dialogues = newScene.dialogues.filter(d => !idsToRemove.has(d.id));
  
  // Keep only the first one selected
  activeDialogueIds.clear();
  handleDialogueSelection(firstD.id, false);
});

btnLoadVideo.addEventListener('click', async () => {
  newScene.videoUrl = editorVideoUrl.value;
  newScene.backgroundAudioUrl = editorBackgroundUrl.value || undefined;
  editorBtnPlay.innerHTML = playIcon;
  editorIsPlaying = false;
  await editorVidCtrl.load(newScene.videoUrl, newScene.backgroundAudioUrl);
  
  const targetAudioUrl = activeAudioMode === 'background' && newScene.backgroundAudioUrl ? newScene.backgroundAudioUrl : newScene.videoUrl;
  generateWaveform(targetAudioUrl);
});

interface SrtBlock {
  id: string;
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  tempCharId?: string;
}
let pendingSrtBlocks: SrtBlock[] = [];
let srtColors = ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#38b2ac', '#4299e1', '#667eea', '#9f7aea', '#ed64a6'];

editorImportSrt.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  
  const text = await file.text();
  prepareSrtMapping(text);
  (e.target as HTMLInputElement).value = ''; 
});

function prepareSrtMapping(srtContent: string) {
  const blocks = srtContent.trim().split(/\n\s*\n/);
  const timeRegex = /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/;
  
  const parseTime = (timeStr: string) => {
    const parts = timeStr.replace(',', '.').split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
  };
  
  pendingSrtBlocks = [];
  
  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim());
    if (lines.length < 3) return; 
    
    const timeLine = lines[1];
    const match = timeLine.match(timeRegex);
    if (!match) return;
    
    const startTime = parseTime(match[1]);
    const endTime = parseTime(match[2]);
    let textLines = lines.slice(2).join(' ');
    
    pendingSrtBlocks.push({ 
      id: `srt_${Date.now()}_${Math.floor(Math.random()*10000)}`,
      speaker: 'Desconocido', 
      text: textLines, 
      startTime, 
      endTime 
    });
  });
  
  // Poblar select
  srtBulkCharSelect.innerHTML = `<option value="new">-- Crear Nuevo Personaje --</option>` +
    newScene.characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  srtBulkNewCharInput.style.display = 'block';
  srtBulkNewCharInput.value = '';

  srtBulkCharSelect.onchange = () => {
    srtBulkNewCharInput.style.display = srtBulkCharSelect.value === 'new' ? 'block' : 'none';
  };

  renderSrtMappingList();
  modalSrtMapping.classList.remove('hidden');
}

function renderSrtMappingList() {
  srtMappingList.innerHTML = '';
  
  pendingSrtBlocks.forEach(b => {
    const div = document.createElement('div');
    div.className = 'srt-block-item';
    div.dataset.id = b.id;
    
    const formatT = (t: number) => {
      const m = Math.floor(t / 60).toString().padStart(2, '0');
      const s = Math.floor(t % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    let charName = 'Sin asignar';
    let charColor = 'transparent';
    if (b.tempCharId) {
      const char = newScene.characters.find(c => c.id === b.tempCharId);
      if (char) {
        charName = char.name;
        charColor = char.color;
      }
    }
    
    div.style.borderLeftColor = charColor;

    div.innerHTML = `
      <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.25rem;">
        [${formatT(b.startTime)} - ${formatT(b.endTime)}] ${charName !== 'Sin asignar' ? `<span style="color:${charColor}">(${charName})</span>` : ''}
      </div>
      <div style="font-size:0.9rem; color:white;">${b.text}</div>
    `;

    div.addEventListener('click', () => {
      div.classList.toggle('selected');
    });

    srtMappingList.appendChild(div);
  });
}

btnSrtAssign.addEventListener('click', () => {
  const selectedDivs = srtMappingList.querySelectorAll('.srt-block-item.selected');
  if (selectedDivs.length === 0) return;

  let charId = srtBulkCharSelect.value;
  
  if (charId === 'new') {
    const charName = srtBulkNewCharInput.value.trim() || 'Nuevo Personaje';
    const newChar = {
      id: `c_${Date.now()}_${Math.floor(Math.random()*10000)}`,
      name: charName,
      color: srtColors[newScene.characters.length % srtColors.length]
    };
    newScene.characters.push(newChar);
    charId = newChar.id;
    
    // update select
    srtBulkCharSelect.innerHTML = `<option value="new">-- Crear Nuevo Personaje --</option>` +
      newScene.characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    srtBulkCharSelect.value = charId;
    srtBulkNewCharInput.style.display = 'none';
  }

  // Assign to selected
  selectedDivs.forEach(div => {
    const id = (div as HTMLElement).dataset.id;
    const block = pendingSrtBlocks.find(b => b.id === id);
    if (block) {
      block.tempCharId = charId;
    }
  });

  renderSrtMappingList();
});

btnCancelSrt.addEventListener('click', () => {
  modalSrtMapping.classList.add('hidden');
  pendingSrtBlocks = [];
});

btnConfirmSrt.addEventListener('click', () => {
  // Only import those that have a char assigned
  const blocksToImport = pendingSrtBlocks.filter(b => b.tempCharId);
  
  blocksToImport.forEach(b => {
    newScene.dialogues.push({
      id: `d_${Date.now()}_${Math.floor(Math.random()*10000)}`,
      characterId: b.tempCharId!,
      startTime: b.startTime,
      endTime: b.endTime,
      text: b.text
    });
  });
  
  modalSrtMapping.classList.add('hidden');
  pendingSrtBlocks = [];
  renderEditorState();
});

let isScrubbing = false;

const updateScrub = (e: MouseEvent) => {
  const dur = editorCurrentDuration || 1;
  const rect = nleRuler.getBoundingClientRect();
  let x = e.clientX - rect.left;
  if (x < 0) x = 0;
  if (x > rect.width) x = rect.width;
  
  const pct = x / rect.width;
  editorVidCtrl.currentTime = pct * dur;
  
  // Disable transition momentarily for tight dragging
  nlePlayhead.style.transition = 'none';
  nlePlayhead.style.left = `${pct * 100}%`;
};

const onScrubMove = (e: MouseEvent) => {
  if (!isScrubbing) return;
  updateScrub(e);
};

const onScrubUp = () => {
  isScrubbing = false;
  document.removeEventListener('mousemove', onScrubMove);
  document.removeEventListener('mouseup', onScrubUp);
  nlePlayhead.style.transition = 'left 0.1s linear';
};

nleRuler.addEventListener('mousedown', (e) => {
  isScrubbing = true;
  updateScrub(e);
  document.addEventListener('mousemove', onScrubMove);
  document.addEventListener('mouseup', onScrubUp);
});
nleWaveformWrapper.addEventListener('mousedown', (e) => {
  isScrubbing = true;
  updateScrub(e);
  document.addEventListener('mousemove', onScrubMove);
  document.addEventListener('mouseup', onScrubUp);
});

editorVidCtrl.onTimeUpdate = (time: number, duration: number) => {
  const needsTimelineReRender = editorCurrentDuration !== duration;
  editorCurrentDuration = duration;
  
  if (!editorIsPlaying) {
    if (!editorProgress.matches(':active')) {
      editorProgress.value = duration > 0 ? ((time / duration) * 100).toString() : '0';
    }
    editorTimeDisplay.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
    nleTimecode.textContent = formatTimecode(time);
    
    if (duration > 0) {
      const pct = (time / duration) * 100;
      nlePlayhead.style.left = `${pct}%`;
    }
  }
  
  if (needsTimelineReRender) {
    renderNleTimeline();
  }
};

editorProgress.addEventListener('change', () => {
  const percent = parseFloat(editorProgress.value);
  editorVidCtrl.currentTime = (percent / 100) * editorCurrentDuration;
});

editorVidCtrl.onPause = () => {
  editorIsPlaying = false;
  editorBtnPlay.innerHTML = playIcon;
};
editorVidCtrl.onPlay = () => {
  editorIsPlaying = true;
  editorBtnPlay.innerHTML = pauseIcon;
};

btnAddChar.addEventListener('click', () => {
  if (!editorCharName.value) return;
  newScene.characters.push({
    id: `c_${Date.now()}`,
    name: editorCharName.value,
    color: editorCharColor.value
  });
  editorCharName.value = '';
  renderEditorState();
});

btnCapStart.addEventListener('click', () => editorStartTime.value = editorVidCtrl.currentTime.toFixed(2));
btnCapEnd.addEventListener('click', () => editorEndTime.value = editorVidCtrl.currentTime.toFixed(2));

btnAddDialogue.addEventListener('click', () => {
  const charId = selectedCharId;
  if (!charId) {
    alert("Crea al menos un personaje primero.");
    return;
  }
  
  let start = parseFloat(editorStartTime.value);
  let end = parseFloat(editorEndTime.value);
  
  if (isNaN(start)) start = editorVidCtrl.currentTime;
  if (isNaN(end)) end = Math.min(start + 5, editorCurrentDuration || start + 5);
  
  if (end <= start) {
    alert("El tiempo de fin debe ser mayor que el de inicio.");
    return;
  }
  
  newScene.dialogues.push({
    id: `d_${Date.now()}`,
    characterId: charId,
    startTime: start,
    endTime: end,
    text: 'Clic para editar texto'
  });
  
  editorStartTime.value = '';
  editorEndTime.value = '';
  renderNleTimeline();
});

btnSaveScene.addEventListener('click', () => {
  newScene.title = editorTitle.value || 'Escena sin título';
  if (!newScene.videoUrl || newScene.characters.length === 0 || newScene.dialogues.length === 0) {
    alert("La escena necesita video, al menos 1 personaje y 1 diálogo.");
    return;
  }
  saveLocalScene(newScene);
  alert("¡Escena guardada con éxito!");
  editorVidCtrl.destroy();
  renderAdminLibrary();
});

btnExitEditor.addEventListener('click', () => {
  editorVidCtrl.destroy();
  renderAdminLibrary();
});

// --- Landing & Join ---
const btnCreateRoom = document.getElementById('btn-create-room')!;
const formJoinCode = document.getElementById('form-join-code') as HTMLFormElement;
const inputRoomCode = document.getElementById('input-room-code') as HTMLInputElement;
const formJoinProfile = document.getElementById('form-join-profile') as HTMLFormElement;
const inputUsername = document.getElementById('input-username') as HTMLInputElement;
const joinRoomDisplay = document.getElementById('join-room-display')!;
const avatarSelector = document.getElementById('avatar-selector')!;
let selectedAvatar = '🦊';
const AVATARS = ['🦊', '🐼', '👽', '🤖', '👻', '👾', '🦁', '🦉'];

// Lobby
const lobbyUsersCount = document.getElementById('lobby-users-count')!;
const lobbyRoomCode = document.getElementById('lobby-room-code')!;
const btnCopyLink = document.getElementById('btn-copy-link')!;
const usersGrid = document.getElementById('users-grid')!;
const playlistContainer = document.getElementById('playlist-container')!;
const playlistCharCount = document.getElementById('playlist-char-count')!;
const btnOpenLibrary = document.getElementById('btn-open-library')!;
const btnStartGame = document.getElementById('btn-start-game') as HTMLButtonElement;
const hostControls = document.getElementById('host-controls')!;
const guestControls = document.getElementById('guest-controls')!;

// Library
const libraryGrid = document.getElementById('library-grid')!;
const btnCloseLibrary = document.getElementById('btn-close-library')!;

// Assignment
const assignmentDetails = document.getElementById('assignment-details')!;
const btnReadyRecord = document.getElementById('btn-ready-record')!;

// Dubbing
const dubTime = document.getElementById('dub-time')!;
const dubCharacterName = document.getElementById('dub-character-name')!;
const scriptContainer = document.getElementById('script-container')!;
const btnRecord = document.getElementById('btn-record') as HTMLButtonElement;
const recordStatus = document.getElementById('record-status')!;
const btnFinishDub = document.getElementById('btn-finish-dub')!;

// Waiting
const waitingUsersStatus = document.getElementById('waiting-users-status')!;
const hostRevealControls = document.getElementById('host-reveal-controls')!;
const btnGoReveal = document.getElementById('btn-go-reveal')!;

// Result
const resultSceneTitle = document.getElementById('result-scene-title')!;
const tracksList = document.getElementById('tracks-list')!;
const btnPlayResult = document.getElementById('btn-play-result')!;
const btnNextScene = document.getElementById('btn-next-scene')!;
const btnEndGame = document.getElementById('btn-end-game')!;


// --- Helpers ---
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function broadcast(type: string, payload: any) {
  bc.postMessage({ type, payload });
}

function getCurrentScene(): Scene | undefined {
  if (!currentRoom || currentRoom.playlist.length === 0) return undefined;
  const pScene = currentRoom.playlist[currentRoom.currentSceneIndex];
  return scenes.find(s => s.id === pScene?.sceneId);
}

function getMyAssignmentForCurrentScene(): Assignment | undefined {
  const scene = getCurrentScene();
  if (!scene || !currentUser || !currentRoom) return undefined;
  return currentRoom.assignments.find(a => a.userId === currentUser!.id && a.sceneId === scene.id);
}

// --- Sync Logic ---
bc.onmessage = (event) => {
  const { type, payload } = event.data;
  if (!currentRoom) return;
  if (payload.roomCode !== currentRoom.code) return;

  switch (type) {
    case 'USER_JOINED':
      if (!currentRoom.users.find(u => u.id === payload.user.id)) {
        currentRoom.users.push(payload.user);
        syncUI();
        if (currentUser?.isHost) {
          broadcast('SYNC_ROOM', { roomCode: currentRoom.code, room: currentRoom });
        }
      }
      break;
    case 'SYNC_ROOM':
      currentRoom = payload.room;
      syncUI();
      break;
    case 'TRACK_RECORDED':
      recordedTracks = recordedTracks.filter(t => !(t.characterId === payload.track.characterId && t.sceneId === payload.track.sceneId));
      recordedTracks.push({
        sceneId: payload.track.sceneId,
        characterId: payload.track.characterId,
        audioUrl: '', // Mock for remote
        recordedByUserId: payload.userId
      });
      syncUI();
      break;
  }
};

function syncUI() {
  if (!currentRoom) return;
  
  switch (currentRoom.phase) {
    case 'LOBBY':
      renderLobby();
      break;
    case 'ASSIGNING':
      renderAssignment();
      break;
    case 'RECORDING':
      const assignment = getMyAssignmentForCurrentScene();
      if (assignment) openDubView();
      else showView('view-spectator');
      break;
    case 'WAITING':
      renderWaiting();
      break;
    case 'REVEAL':
      renderReveal();
      break;
  }
}

// --- Init ---
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    startJoinFlow(roomParam);
  } else {
    showView('view-landing');
  }
}

// --- Landing & Join ---
btnCreateRoom.addEventListener('click', () => {
  const code = generateRoomCode();
  window.history.pushState({}, '', `?room=${code}`);
  startJoinFlow(code, true);
});

formJoinCode.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = inputRoomCode.value.toUpperCase();
  window.history.pushState({}, '', `?room=${code}`);
  startJoinFlow(code, false);
});

function startJoinFlow(code: string, isHost = false) {
  joinRoomDisplay.textContent = code;
  avatarSelector.innerHTML = '';
  AVATARS.forEach(icon => {
    const div = document.createElement('div');
    div.className = `avatar-option ${icon === selectedAvatar ? 'selected' : ''}`;
    div.textContent = icon;
    div.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      selectedAvatar = icon;
    });
    avatarSelector.appendChild(div);
  });

  currentRoom = { 
    code, 
    users: [],
    phase: 'LOBBY',
    playlist: [],
    assignments: [],
    currentSceneIndex: 0
  };
  
  formJoinProfile.onsubmit = (e) => {
    e.preventDefault();
    currentUser = { id: `u_${Date.now()}`, name: inputUsername.value, icon: selectedAvatar, isHost };
    currentRoom!.users.push(currentUser);
    broadcast('USER_JOINED', { roomCode: code, user: currentUser });
    syncUI();
  };

  showView('view-join');
}

// --- Lobby ---
function renderLobby() {
  showView('view-lobby');
  lobbyUsersCount.textContent = currentRoom!.users.length.toString();
  lobbyRoomCode.textContent = currentRoom!.code;
  
  usersGrid.innerHTML = '';
  currentRoom!.users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'user-card';
    div.innerHTML = `
      <div class="avatar">${u.icon}</div>
      <div class="name">${u.name} ${u.id === currentUser?.id ? '(Tú)' : ''}</div>
      <div class="role">${u.isHost ? 'Anfitrión' : 'Invitado'}</div>
    `;
    usersGrid.appendChild(div);
  });

  if (currentUser?.isHost) {
    hostControls.classList.remove('hidden');
    guestControls.classList.add('hidden');
  } else {
    hostControls.classList.add('hidden');
    guestControls.classList.remove('hidden');
  }

  playlistContainer.innerHTML = '';
  let totalChars = 0;
  if (currentRoom!.playlist.length === 0) {
    playlistContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No hay escenas. El anfitrión debe añadir algunas.</p>';
  } else {
    currentRoom!.playlist.forEach((p, idx) => {
      totalChars += p.characterCount;
      const div = document.createElement('div');
      div.className = 'playlist-item';
      div.innerHTML = `
        <div>
          <div class="title">${p.sceneTitle}</div>
          <div class="chars">${p.characterCount} personajes</div>
        </div>
        ${currentUser?.isHost ? `<button onclick="window.removeScene(${idx})">×</button>` : ''}
      `;
      playlistContainer.appendChild(div);
    });
  }
  playlistCharCount.textContent = totalChars.toString();
  btnStartGame.disabled = totalChars === 0;
}

window.removeScene = (idx: number) => {
  if (!currentUser?.isHost) return;
  currentRoom!.playlist.splice(idx, 1);
  broadcast('SYNC_ROOM', { roomCode: currentRoom!.code, room: currentRoom });
  syncUI();
};

btnCopyLink.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href);
  btnCopyLink.textContent = "¡Copiado!";
  setTimeout(() => btnCopyLink.textContent = "Copiar Enlace", 2000);
});

// --- Library ---
btnOpenLibrary.addEventListener('click', () => {
  libraryGrid.innerHTML = '';
  scenes.forEach(scene => {
    const ytId = getYouTubeId(scene.videoUrl);
    const bgImage = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '';
    
    const card = document.createElement('div');
    card.className = 'scene-card glass-panel';
    card.innerHTML = `
      ${bgImage ? `<div style="height:120px; background:url(${bgImage}) center/cover; border-radius:6px 6px 0 0; margin:-1rem -1rem 1rem -1rem;"></div>` : ''}
      <h3>${scene.title}</h3>
      <p>${scene.characters.length} Personajes</p>
    `;
    card.addEventListener('click', () => {
      currentRoom!.playlist.push({
        sceneId: scene.id,
        sceneTitle: scene.title,
        characterCount: scene.characters.length
      });
      broadcast('SYNC_ROOM', { roomCode: currentRoom!.code, room: currentRoom });
      syncUI();
      showView('view-lobby');
    });
    libraryGrid.appendChild(card);
  });
  showView('view-library');
});

btnCloseLibrary.addEventListener('click', () => showView('view-lobby'));

// --- Start Game ---
btnStartGame.addEventListener('click', () => {
  if (!currentUser?.isHost) return;
  
  const users = [...currentRoom!.users];
  const assignments: Assignment[] = [];
  
  currentRoom!.playlist.forEach(pScene => {
    const scene = scenes.find(s => s.id === pScene.sceneId);
    if (!scene) return;
    
    const shuffledUsers = users.sort(() => 0.5 - Math.random());
    const shuffledChars = [...scene.characters].sort(() => 0.5 - Math.random());
    shuffledChars.forEach((char, idx) => {
      const user = shuffledUsers[idx % shuffledUsers.length];
      assignments.push({ sceneId: scene.id, characterId: char.id, userId: user.id });
    });
  });

  currentRoom!.assignments = assignments;
  currentRoom!.currentSceneIndex = 0;
  currentRoom!.phase = 'ASSIGNING';
  
  recordedTracks = [];
  broadcast('SYNC_ROOM', { roomCode: currentRoom!.code, room: currentRoom });
  syncUI();
});

// --- Assignment ---
function renderAssignment() {
  const scene = getCurrentScene();
  const assignment = getMyAssignmentForCurrentScene();
  
  if (assignment && scene) {
    const char = scene.characters.find(c => c.id === assignment.characterId);
    assignmentDetails.innerHTML = `
      Vas a doblar la escena:<br/> <strong>${scene.title}</strong>
      <span class="highlight">${char?.name}</span>
    `;
  } else if (scene) {
    assignmentDetails.innerHTML = `
      Escena actual:<br/> <strong>${scene.title}</strong>
      <span class="highlight" style="color:var(--text-muted); font-size:1.5rem;">Eres Espectador en esta ronda</span>
    `;
  }
  showView('view-assignment');
}

btnReadyRecord.addEventListener('click', () => {
  const assignment = getMyAssignmentForCurrentScene();
  if (assignment) {
    const scene = getCurrentScene();
    if (scene) {
      // Set the scene as the current "newScene" so Studio Mode can read from it
      Object.assign(newScene, JSON.parse(JSON.stringify(scene)));
      activeStudioCharacterId = assignment.characterId;
      openDubView();
    }
  } else {
    showView('view-spectator');
  }
  
  if (currentUser?.isHost && currentRoom!.phase !== 'RECORDING') {
    currentRoom!.phase = 'RECORDING';
    broadcast('SYNC_ROOM', { roomCode: currentRoom!.code, room: currentRoom });
  }
});


// --- Dubbing (Multiplayer via Studio Mode) ---
async function openDubView() {
  const scene = getCurrentScene();
  const assignment = getMyAssignmentForCurrentScene();
  if (!scene || !assignment) return;
  
  // Use Studio Mode!
  editorVidCtrl.setWrapper('studio-video-mount');
  showView('view-studio');
  
  // Load the video into the studio controller!
  await editorVidCtrl.load(newScene.videoUrl, newScene.backgroundAudioUrl);
  
  // Show "Send" button instead of "Exit"
  document.getElementById('btn-exit-studio')!.classList.add('hidden');
  document.getElementById('btn-studio-send')!.classList.remove('hidden');
  
  renderStudioCharList(); // It will now respect currentRoom logic
  renderStudioPrompter();
  startStudioLoop();
  
  const targetAudioUrl = studioActiveAudioMode === 'background' && newScene.backgroundAudioUrl ? newScene.backgroundAudioUrl : newScene.videoUrl;
  generateWaveform(targetAudioUrl);
}

document.getElementById('btn-studio-send')!.addEventListener('click', async () => {
  const assignment = getMyAssignmentForCurrentScene();
  if (!assignment) return;
  
  const btn = document.getElementById('btn-studio-send') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  
  // Collect all clips for this character
  const clips: { startTime: number, trackIndex?: number, base64: string }[] = [];
  
  for (const d of studioRecordedClips) {
    try {
      const res = await fetch(d.blobUrl!);
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      clips.push({ startTime: d.startTime, trackIndex: d.trackIndex, base64 });
    } catch (e) {
      console.error('Error procesando clip libre:', e);
    }
  }
  
  const myTrack: RecordedTrack = {
    sceneId: newScene.id,
    characterId: assignment.characterId,
    clips,
    recordedByUserId: currentUser!.id
  };
  
  // We push it locally (since broadcast doesn't trigger our own onData)
  recordedTracks = recordedTracks.filter(t => !(t.characterId === assignment.characterId && t.sceneId === newScene.id));
  recordedTracks.push(myTrack);
  
  broadcast('TRACK_RECORDED', { roomCode: currentRoom!.code, track: myTrack, userId: currentUser!.id });
  
  currentRoom!.phase = 'WAITING';
  if (currentUser?.isHost) broadcast('SYNC_ROOM', { roomCode: currentRoom!.code, room: currentRoom });
  syncUI();
  
  btn.disabled = false;
  btn.textContent = '✅ Terminar y Enviar';
});

// --- Waiting ---
function renderWaiting() {
  showView('view-waiting');
  editorVidCtrl.pause(); // Just in case
  const scene = getCurrentScene();
  if (!scene) return;
  
  waitingUsersStatus.innerHTML = '';
  const sceneAssignments = currentRoom!.assignments.filter(a => a.sceneId === scene.id);
  
  let allReady = true;
  sceneAssignments.forEach(a => {
    const user = currentRoom!.users.find(u => u.id === a.userId);
    const hasTrack = recordedTracks.find(t => t.characterId === a.characterId && t.sceneId === scene.id);
    if (!hasTrack) allReady = false;
    
    const div = document.createElement('div');
    div.className = `user-status ${hasTrack ? 'ready' : ''}`;
    div.innerHTML = `
      <span style="font-size: 1.5rem;">${user?.icon}</span>
      <span>${user?.name}</span>
      <span>${hasTrack ? '✅' : '⏳'}</span>
    `;
    waitingUsersStatus.appendChild(div);
  });
  
  if (currentUser?.isHost) hostRevealControls.classList.remove('hidden');
  else hostRevealControls.classList.add('hidden');
}

btnGoReveal.addEventListener('click', () => {
  if (!currentUser?.isHost) return;
  currentRoom!.phase = 'REVEAL';
  broadcast('SYNC_ROOM', { roomCode: currentRoom!.code, room: currentRoom });
  syncUI();
});

// --- Studio Mode ---
let studioLoopId: number;
let studioMicStream: MediaStream | null = null;
let studioMicRecorder: MediaRecorder | null = null;

btnEnterStudio.addEventListener('click', () => {
  editorVidCtrl.setWrapper('studio-video-mount');
  if (myCharacter) activeStudioCharacterId = myCharacter.id;
  
  studioModeSelect.value = 'guided';
  studioModeSelect.dispatchEvent(new Event('change'));
  
  showView('view-studio');
  renderStudioCharList();
  renderStudioPrompter();
  startStudioLoop();
  
  const targetAudioUrl = studioActiveAudioMode === 'background' && newScene.backgroundAudioUrl ? newScene.backgroundAudioUrl : newScene.videoUrl;
  generateWaveform(targetAudioUrl);
});

btnExitStudio.addEventListener('click', () => {
  cancelAnimationFrame(studioLoopId);
  editorVidCtrl.setWrapper('editor-video-mount');
  showView('view-editor');
});

function renderStudioCharList() {
  const studioCharList = document.getElementById('studio-char-list')!;
  studioCharList.innerHTML = '';
  
  const assignment = currentRoom ? getMyAssignmentForCurrentScene() : null;
  const isMultiplayer = !!currentRoom;
  
  newScene.characters.forEach(char => {
    // In multiplayer, only show the assigned character
    if (isMultiplayer && assignment && char.id !== assignment.characterId) return;
    
    const btn = document.createElement('button');
    btn.className = `btn secondary ${char.id === activeStudioCharacterId ? 'primary' : ''}`;
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.borderLeft = `4px solid ${char.color}`;
    btn.textContent = char.name;
    
    if (!isMultiplayer) {
      btn.addEventListener('click', () => {
        activeStudioCharacterId = char.id;
        renderStudioCharList();
        renderStudioPrompter();
      });
    } else {
      btn.style.cursor = 'default';
    }
    studioCharList.appendChild(btn);
  });
}

function renderStudioPrompter() {
  studioPrompterList.innerHTML = '';
  const sorted = [...newScene.dialogues].sort((a,b) => a.startTime - b.startTime);
  
  sorted.forEach(dialogue => {
    const char = newScene.characters.find(c => c.id === dialogue.characterId);
    if (!char) return;
    
    const isMine = activeStudioCharacterId === char.id;
    const div = document.createElement('div');
    div.className = `prompter-item ${isMine ? 'interactive' : 'inactive'}`;
    div.dataset.id = dialogue.id;
    div.dataset.start = dialogue.startTime.toString();
    div.dataset.end = dialogue.endTime.toString();
    
    
    if (isMine) div.style.borderLeftColor = char.color;
    
    // Allow clicking the item to seek to its start time
    div.addEventListener('click', (e) => {
      // Don't seek if clicking a button inside
      if ((e.target as HTMLElement).closest('.btn')) return;
      editorVidCtrl.currentTime = dialogue.startTime;
      if (!studioIsPlaying) {
        editorVidCtrl.play();
        studioBtnPlay.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        studioIsPlaying = true;
      }
    });
    
    let html = `
      <div style="font-size:0.8rem; color:${char.color}; font-weight:bold;">${char.name} [${formatTime(dialogue.startTime)}]</div>
      <div style="font-size:1.1rem; line-height:1.4;">${dialogue.text}</div>
    `;
    
    if (isMine) {
      html += `
        <div style="display:flex; gap:0.5rem; margin-top:0.5rem;" class="studio-controls">
          <button class="btn-rec btn secondary small" style="background:#e53e3e; border:none; border-radius:4px; padding:0.25rem 0.5rem;">🔴 Grabar</button>
          ${dialogue.audioBlobUrl ? `<button class="btn-play-rec btn secondary small" style="background:var(--primary); border-radius:4px; padding:0.25rem 0.5rem;">▶️ Escuchar Toma</button>` : ''}
          ${dialogue.audioBlobUrl ? `<button class="btn-del-rec btn secondary small" style="background:transparent; border:1px solid #e53e3e; color:#e53e3e; border-radius:4px; padding:0.25rem 0.5rem;">🗑️</button>` : ''}
        </div>
        ${dialogue.audioBlobUrl ? `<canvas class="mini-wave" width="300" height="40" style="margin-top:0.5rem; width:100%; height:40px; background:rgba(0,0,0,0.3); border-radius:4px;"></canvas>` : ''}
      `;
    }
    div.innerHTML = html;
    
    if (isMine) {
      if (dialogue.audioBlobUrl) {
        const canvas = div.querySelector('.mini-wave') as HTMLCanvasElement;
        if (canvas) drawMiniWaveform(dialogue.audioBlobUrl, canvas, char.color);
      }
      const btnRec = div.querySelector('.btn-rec') as HTMLButtonElement;
      const btnPlay = div.querySelector('.btn-play-rec') as HTMLButtonElement;
      const btnDel = div.querySelector('.btn-del-rec') as HTMLButtonElement;
      
      btnRec.addEventListener('click', async () => {
        if (recordingDialogueId) return; // Ya grabando
        
        try {
          if (!studioMicStream) studioMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          studioMicRecorder = new MediaRecorder(studioMicStream);
          const chunks: Blob[] = [];
          
          studioMicRecorder.ondataavailable = e => chunks.push(e.data);
          studioMicRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            dialogue.audioBlobUrl = url;
            
            studioRecordedClips.push({
              id: Math.random().toString(36).substring(2, 9),
              startTime: dialogue.audioBlobStartTime ?? Math.max(0, dialogue.startTime - 1),
              endTime: editorVidCtrl.currentTime,
              trackIndex: 0,
              blobUrl: url,
              blob: blob
            });
            renderStudioMultitrack();
            
            recordingDialogueId = null;
            btnRec.textContent = '🔴 Grabar';
            renderStudioPrompter(); // refrescar
          };
          
          recordingDialogueId = null;
          pendingRecordingDialogueId = dialogue.id;
          btnRec.textContent = '⏳ Cargando...';
          
          editorVidCtrl.currentTime = Math.max(0, dialogue.startTime - 1);
          editorVidCtrl.play();
          
        } catch (e) {
          alert('No se pudo acceder al micrófono.');
        }
      });
      
      if (btnPlay) {
        btnPlay.addEventListener('click', () => {
          const a = new Audio(dialogue.audioBlobUrl);
          a.play();
        });
      }
      
      if (btnDel) {
        btnDel.addEventListener('click', () => {
          // Remove from studioRecordedClips matching this blobUrl
          studioRecordedClips = studioRecordedClips.filter(c => c.blobUrl !== dialogue.audioBlobUrl);
          dialogue.audioBlobUrl = undefined;
          renderStudioMultitrack();
          renderStudioPrompter();
        });
      }
    }
    
    studioPrompterList.appendChild(div);
  });
}

let lastScrolledDialogueId: string | null = null;
let pendingRecordingDialogueId: string | null = null;
let studioLastTime = -1;

function startStudioLoop() {
  if (studioLoopId) cancelAnimationFrame(studioLoopId);
  studioLastTime = editorVidCtrl.currentTime;
  
  const loop = () => {
    if (viewStudio.classList.contains('hidden')) return;
    
    const time = editorVidCtrl.currentTime;
    studioTimeDisplay.textContent = formatTimecode(time);
    
    // Start recording if pending and video has finally started playing
    if (pendingRecordingDialogueId && time !== studioLastTime) {
      const pd = newScene.dialogues.find(x => x.id === pendingRecordingDialogueId);
      if (pd && studioMicRecorder) {
        pd.audioBlobStartTime = time;
        studioMicRecorder.start();
        recordingDialogueId = pendingRecordingDialogueId;
        pendingRecordingDialogueId = null;
        const el = document.getElementById(`dialogue-${pd.id}`);
        if (el) {
          const btn = el.querySelector('.btn-rec');
          if (btn) btn.textContent = '⏹️ Detener';
        }
      }
    }
    
    // Check if we need to auto-stop recording
    if (recordingDialogueId && studioMicRecorder && studioMicRecorder.state === 'recording') {
      const d = newScene.dialogues.find(x => x.id === recordingDialogueId);
      if (d && time >= d.endTime + 1) {
        studioMicRecorder.stop();
        editorVidCtrl.pause();
      }
    }
    
    // Highlight prompter items
    const items = studioPrompterList.querySelectorAll('.prompter-item');
    items.forEach(el => {
      const div = el as HTMLDivElement;
      const s = parseFloat(div.dataset.start!);
      const e = parseFloat(div.dataset.end!);
      const dId = div.dataset.id!;
      
      if (time >= s && time <= e) {
        div.classList.add('active');
        // Scroll into view if needed, but only once per active dialogue
        if (lastScrolledDialogueId !== dId) {
          lastScrolledDialogueId = dId;
          const rect = div.getBoundingClientRect();
          const parentRect = studioPrompterList.getBoundingClientRect();
          if (rect.bottom > parentRect.bottom || rect.top < parentRect.top) {
             studioPrompterList.scrollTo({
               top: div.offsetTop - studioPrompterList.offsetTop - 50,
               behavior: 'smooth'
             });
          }
        }
      } else {
        div.classList.remove('active');
        if (lastScrolledDialogueId === dId) {
           lastScrolledDialogueId = null; // reset if we leave the current item
        }
      }
    });
    
    // Mixer Logic
    if (isMixerMode) {
      studioRecordedClips.forEach(clip => {
        let player = mixerAudioPlayers.find(p => p.src === clip.blobUrl);
        if (!player) {
          player = new Audio(clip.blobUrl);
          mixerAudioPlayers.push(player);
        }
        
        if (time >= clip.startTime && time <= clip.endTime) {
          if (player.paused) {
            const targetTime = time - clip.startTime;
            if (Math.abs(player.currentTime - targetTime) > 0.2) player.currentTime = targetTime;
            player.play().catch(e => console.error(e));
          }
        } else {
          if (!player.paused) player.pause();
        }
      });
    }
    
    // Scrubber update
    const studioProgress = document.getElementById('studio-progress') as HTMLInputElement;
    if (studioProgress && editorCurrentDuration > 0 && !studioProgress.matches(':active')) {
      const pct = (time / editorCurrentDuration) * 100;
      studioProgress.value = pct.toString();
      const playhead = document.getElementById('studio-playhead');
      if (playhead) playhead.style.left = `${pct}%`;
      
      if (studioMultitrackPlayhead) {
        studioMultitrackPlayhead.style.left = `${pct}%`;
      }
    }
    
    studioLastTime = time;
    studioLoopId = requestAnimationFrame(loop);
  };
  studioLoopId = requestAnimationFrame(loop);
}

document.getElementById('studio-progress')?.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  const pct = parseFloat(target.value) / 100;
  editorVidCtrl.currentTime = pct * editorCurrentDuration;
  const playhead = document.getElementById('studio-playhead');
  if (playhead) playhead.style.left = `${pct * 100}%`;
});

document.getElementById('studio-btn-back')?.addEventListener('click', () => {
  editorVidCtrl.currentTime = Math.max(0, editorVidCtrl.currentTime - 5);
});

document.getElementById('studio-btn-forward')?.addEventListener('click', () => {
  editorVidCtrl.currentTime = Math.min(editorCurrentDuration, editorVidCtrl.currentTime + 5);
});

studioBtnPlay.addEventListener('click', () => {
  if (studioIsPlaying) {
    editorVidCtrl.pause();
    studioBtnPlay.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    studioIsPlaying = false;
  } else {
    editorVidCtrl.play();
    studioBtnPlay.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    studioIsPlaying = true;
  }
});

studioAudioToggle.addEventListener('click', () => {
  studioActiveAudioMode = studioActiveAudioMode === 'original' ? 'background' : 'original';
  
  if (editorBackgroundUrl.value && editorBackgroundUrl.value !== newScene.backgroundAudioUrl) {
    newScene.backgroundAudioUrl = editorBackgroundUrl.value;
    editorVidCtrl.loadBgAudio(newScene.backgroundAudioUrl);
  }
  
  studioAudioToggle.textContent = studioActiveAudioMode === 'original' ? '🎵 Escuchando: Original' : '🎵 Escuchando: Fondo';
  editorVidCtrl.setAudioMode(studioActiveAudioMode);
  
  const targetAudioUrl = studioActiveAudioMode === 'background' && newScene.backgroundAudioUrl ? newScene.backgroundAudioUrl : newScene.videoUrl;
  generateWaveform(targetAudioUrl);
});

btnStudioMixer.addEventListener('click', () => {
  isMixerMode = !isMixerMode;
  if (isMixerMode) {
    btnStudioMixer.style.background = '#48bb78';
    btnStudioMixer.textContent = '🎧 Detener Mezcla';
    studioActiveAudioMode = 'background'; // Force bg audio
    studioAudioToggle.textContent = '🎵 Mezcla Final (Fondo + Tus Voces)';
    editorVidCtrl.setAudioMode('background');
    editorVidCtrl.currentTime = 0;
    editorVidCtrl.play();
    studioBtnPlay.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    studioIsPlaying = true;
  } else {
    btnStudioMixer.style.background = 'var(--secondary)';
    btnStudioMixer.textContent = '🎧 Previsualizar Mezcla';
    studioActiveAudioMode = 'original';
    studioAudioToggle.textContent = '🎵 Escuchando: Original';
    editorVidCtrl.setAudioMode('original');
    editorVidCtrl.pause();
    mixerAudioPlayers.forEach(p => p.pause());
    studioBtnPlay.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    studioIsPlaying = false;
  }
});

// --- Result ---
async function renderReveal() {
  showView('view-result');
  const scene = getCurrentScene();
  if (!scene) return;
  
  resultSceneTitle.textContent = `Viendo: ${scene.title}`;
  await resultVidCtrl.load(scene.videoUrl, scene.backgroundAudioUrl);
  
  // Set to background mode so original audio is muted and instrumental plays
  resultVidCtrl.setAudioMode('background');
  
  tracksList.innerHTML = '';
  mixAudioPlayers = [];
  
  scene.characters.forEach(char => {
    const track = recordedTracks.find(t => t.characterId === char.id && t.sceneId === scene.id);
    const assignment = currentRoom!.assignments.find(a => a.sceneId === scene.id && a.characterId === char.id);
    const user = currentRoom!.users.find(u => u.id === assignment?.userId);
    
    const div = document.createElement('div');
    div.className = 'track-item';
    let status = 'Sin pista ❌';
    if (track) status = track.clips && track.clips.length > 0 ? 'Tú ✅' : 'Enviado ✅';
    
    div.innerHTML = `
      <div>
        <span style="color: ${char.color}; font-weight: 600;">${char.name}</span>
        <span style="font-size:0.8rem; color:var(--text-muted); margin-left:0.5rem;">(por ${user?.name || 'Nadie'})</span>
      </div>
      <span style="color: ${track ? 'var(--success)' : 'var(--text-muted)'}">${status}</span>
    `;
    tracksList.appendChild(div);
    if (track && track.clips) {
      track.clips.forEach(clip => {
        const audio = new Audio(clip.base64);
        audio.dataset.start = clip.startTime.toString();
        mixAudioPlayers.push(audio);
      });
    } else if (track && track.audioUrl) {
      // Legacy fallback
      mixAudioPlayers.push(new Audio(track.audioUrl));
    }
  });

  if (currentUser?.isHost) {
    const hasNext = currentRoom!.currentSceneIndex < currentRoom!.playlist.length - 1;
    btnNextScene.classList.toggle('hidden', !hasNext);
    btnEndGame.classList.toggle('hidden', hasNext);
  } else {
    btnNextScene.classList.add('hidden');
    btnEndGame.classList.add('hidden');
  }
}

btnPlayResult.addEventListener('click', () => {
  resultVidCtrl.currentTime = 0;
  resultVidCtrl.setVolume(1);
  resultVidCtrl.play();
  mixAudioPlayers.forEach(a => { 
    a.pause();
    a.currentTime = 0; 
  });
});

resultVidCtrl.onPause = () => mixAudioPlayers.forEach(a => a.pause());
resultVidCtrl.onPlay = () => {
  // Sync logic is handled in onTimeUpdate for clips
};
resultVidCtrl.onTimeUpdate = (time: number) => {
  mixAudioPlayers.forEach(a => {
    const start = parseFloat(a.dataset.start || '0');
    // If it's time to play this clip and it's paused at the beginning
    if (time >= start && a.paused && a.currentTime === 0) {
      a.play();
    }
  });
};

btnNextScene.addEventListener('click', () => {
  if (!currentUser?.isHost) return;
  currentRoom!.currentSceneIndex++;
  currentRoom!.phase = 'ASSIGNING';
  broadcast('SYNC_ROOM', { roomCode: currentRoom!.code, room: currentRoom });
  syncUI();
});

btnEndGame.addEventListener('click', () => {
  if (!currentUser?.isHost) return;
  currentRoom!.phase = 'LOBBY';
  currentRoom!.playlist = [];
  currentRoom!.currentSceneIndex = 0;
  recordedTracks = [];
  broadcast('SYNC_ROOM', { roomCode: currentRoom!.code, room: currentRoom });
  syncUI();
});

// --- Freestyle & Multitrack Logic ---
let globalRecChunks: Blob[] = [];
let globalRecStartTime = -1;
let globalRecClickTime = -1;
let globalRecorder: MediaRecorder | null = null;
let isGlobalRecording = false;

async function initGlobalRecorder() {
  if (!globalRecorder) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    globalRecorder = new MediaRecorder(stream);
    globalRecorder.ondataavailable = e => { if(e.data.size > 0) globalRecChunks.push(e.data); };
    globalRecorder.onstop = () => {
       const blob = new Blob(globalRecChunks, { type: 'audio/webm' });
       const url = URL.createObjectURL(blob);
       const endTime = editorVidCtrl.currentTime > globalRecStartTime ? editorVidCtrl.currentTime : globalRecStartTime + 0.5;
       
       let trackIndex = 0; // default
       
       studioRecordedClips.push({
         id: Math.random().toString(36).substring(2, 9),
         startTime: globalRecStartTime,
         endTime: endTime,
         trackIndex: trackIndex,
         blobUrl: url,
         blob: blob
       });
       renderStudioMultitrack();
       isGlobalRecording = false;
       btnGlobalRecord.textContent = '🔴 Mantén pulsado o clic para Grabar';
       btnGlobalRecord.classList.remove('recording');
    };
  }
}

btnGlobalRecord.addEventListener('mousedown', async (e) => {
  if (e.button !== 0) return;
  if (isGlobalRecording) {
    globalRecorder?.stop();
    editorVidCtrl.pause();
    return;
  }
  await initGlobalRecorder();
  globalRecChunks = [];
  globalRecStartTime = editorVidCtrl.currentTime;
  globalRecClickTime = Date.now();
  isGlobalRecording = true;
  editorVidCtrl.play();
  globalRecorder!.start();
  btnGlobalRecord.textContent = '⏹️ Grabando... (suelta o clic para parar)';
  btnGlobalRecord.classList.add('recording');
});

document.addEventListener('mouseup', () => {
  if (isGlobalRecording) {
     const elapsed = Date.now() - globalRecClickTime;
     if (elapsed > 400) {
        globalRecorder?.stop();
        editorVidCtrl.pause();
     }
  }
});

function renderStudioMultitrack() {
  const dur = editorVidCtrl.duration || 1;
  const tracks = [
    document.querySelector('.studio-track[data-track="0"]')!,
    document.querySelector('.studio-track[data-track="1"]')!,
    document.querySelector('.studio-track[data-track="2"]')!
  ];
  
  tracks.forEach(t => t.innerHTML = '');
  
  if (studioRuler) {
    studioRuler.innerHTML = '';
    const numMarkers = Math.floor(dur / 5);
    for (let i = 0; i <= numMarkers; i++) {
      const time = i * 5;
      const pct = (time / dur) * 100;
      const marker = document.createElement('div');
      marker.className = 'nle-ruler-marker';
      marker.style.left = `${pct}%`;
      marker.innerHTML = `<span>${formatTime(time)}</span>`;
      studioRuler.appendChild(marker);
    }
  }
  
  studioRecordedClips.forEach(clip => {
    if (clip.trackIndex < 0 || clip.trackIndex > 2) clip.trackIndex = 0;
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.height = '80%';
    div.style.top = '10%';
    div.style.background = 'var(--accent)';
    div.style.borderRadius = '4px';
    div.style.cursor = 'grab';
    div.title = 'Arrastra para mover';
    
    const leftPct = (clip.startTime / dur) * 100;
    const widthPct = ((clip.endTime - clip.startTime) / dur) * 100;
    
    div.style.left = `${leftPct}%`;
    div.style.width = `${Math.max(0.5, widthPct)}%`;
    
    // Drag logic
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialStartTime = clip.startTime;
    let initialTrack = clip.trackIndex;
    
    div.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialStartTime = clip.startTime;
      initialTrack = clip.trackIndex;
      div.style.cursor = 'grabbing';
      e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const timelineWidth = studioMultitrackTimeline.offsetWidth;
      
      const timeOffset = (dx / timelineWidth) * dur;
      let newStart = initialStartTime + timeOffset;
      if (newStart < 0) newStart = 0;
      if (newStart > dur - 0.1) newStart = dur - 0.1;
      
      const dt = newStart - clip.startTime;
      clip.startTime = newStart;
      clip.endTime += dt;
      
      // Track changing
      const trackHeight = tracks[0].getBoundingClientRect().height;
      const trackOffset = Math.round(dy / trackHeight);
      let newTrack = initialTrack + trackOffset;
      if (newTrack < 0) newTrack = 0;
      if (newTrack > 2) newTrack = 2;
      clip.trackIndex = newTrack;
      
      renderStudioMultitrack();
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        div.style.cursor = 'grab';
      }
    });
    
    tracks[clip.trackIndex].appendChild(div);
  });
}

init();
