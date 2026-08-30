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

export let ytApiReady = false;
window.onYouTubeIframeAPIReady = () => {
  ytApiReady = true;
};

export function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}


// --- VideoController Abstraction ---
export class VideoController {
  public wrapper: HTMLElement;
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
              this.setAudioMode('original');
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
      this.setAudioMode('original');
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

  get duration(): number {
    if (this.isYT && this.ytPlayer && this.ytPlayer.getDuration) {
      return this.ytPlayer.getDuration();
    } else if (this.htmlVideo) {
      return this.htmlVideo.duration;
    }
    return 0;
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
      
      this.setAudioMode('original');
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

