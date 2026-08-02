import { parseYouTubeInput } from './youtube-url-parser.js';

const SESSION_KEY = 'massimos-glitcher:last-youtube-input';
let apiPromise;

/** Load the official IFrame API exactly once and share the readiness promise. */
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const existingCallback = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error('The YouTube player API did not load. Check the network connection.')), 15000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (typeof existingCallback === 'function') existingCallback();
      resolve(window.YT);
    };

    let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) {
      script = document.createElement('script');
      script.id = 'youtube-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.append(script);
    }
    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      reject(new Error('The official YouTube player API could not be loaded.'));
    }, { once: true });
  });
  return apiPromise;
}

const STATE_NAMES = {
  '-1': 'Unstarted',
  0: 'Ended',
  1: 'Playing',
  2: 'Paused',
  3: 'Buffering',
  5: 'Cued',
};

const ERROR_MESSAGES = {
  2: 'YouTube rejected the requested ID.',
  5: 'The requested content cannot play in the HTML5 player.',
  100: 'The requested video is unavailable, private, or removed.',
  101: 'The owner has disabled embedded playback for this video.',
  150: 'The owner has disabled embedded playback for this video.',
  153: 'YouTube could not identify this embedded player request.',
};

export function initYouTubePlayer(root) {
  const elements = {
    form: root.querySelector('#youtube-load-form'),
    input: root.querySelector('#youtube-input'),
    message: root.querySelector('#youtube-message'),
    state: root.querySelector('#youtube-state'),
    kind: root.querySelector('#youtube-kind'),
    videoId: root.querySelector('#youtube-video-id'),
    playlistId: root.querySelector('#youtube-playlist-id'),
    volume: root.querySelector('#youtube-volume'),
    volumeOutput: root.querySelector('#youtube-volume-output'),
    open: root.querySelector('#youtube-open-button'),
    clear: root.querySelector('#youtube-clear-button'),
    controls: [...root.querySelectorAll('[data-youtube-action]')],
  };
  const state = { player: null, ready: false, content: null, pendingPlaylistVideo: '' };
  elements.input.value = sessionStorage.getItem(SESSION_KEY) || '';

  function announce(message, mode = 'ready') {
    elements.message.textContent = message;
    elements.message.dataset.mode = mode;
  }

  function updateButtons() {
    const hasContent = Boolean(state.content && state.ready);
    elements.controls.forEach((button) => {
      const playlistOnly = ['previous', 'next'].includes(button.dataset.youtubeAction);
      button.disabled = !hasContent || (playlistOnly && !state.content.playlistId);
    });
    elements.volume.disabled = !hasContent;
    elements.open.disabled = !state.content;
    elements.clear.disabled = !state.content;
  }

  function updateMeta() {
    elements.kind.textContent = state.content?.kind || 'None';
    elements.videoId.textContent = state.content?.videoId || '—';
    elements.playlistId.textContent = state.content?.playlistId || '—';
  }

  function onPlayerStateChange(event) {
    elements.state.textContent = STATE_NAMES[event.data] || `State ${event.data}`;
    if (event.data === window.YT.PlayerState.PLAYING && state.player.getVideoData()?.video_id) {
      elements.videoId.textContent = state.player.getVideoData().video_id;
    }
  }

  function onPlayerError(event) {
    const message = ERROR_MESSAGES[event.data] || `YouTube player error ${event.data}.`;
    elements.state.textContent = 'Error';
    announce(message, 'error');
  }

  async function ensurePlayer() {
    if (state.player && state.ready) return state.player;
    const YT = await loadYouTubeApi();
    return new Promise((resolve, reject) => {
      try {
        state.player = new YT.Player('youtube-player', {
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0, controls: 1, playsinline: 1, origin: window.location.origin },
          events: {
            onReady: (event) => {
              state.ready = true;
              event.target.setVolume(Number(elements.volume.value));
              updateButtons();
              resolve(event.target);
            },
            onStateChange: onPlayerStateChange,
            onError: onPlayerError,
          },
        });
      } catch (error) { reject(error); }
    });
  }

  async function loadContent(rawInput) {
    let parsed;
    try { parsed = parseYouTubeInput(rawInput); } catch (error) { announce(error.message, 'error'); return; }
    announce('Loading the official YouTube player…', 'working');
    try {
      const player = await ensurePlayer();
      state.content = parsed;
      state.pendingPlaylistVideo = parsed.videoId && parsed.playlistId ? parsed.videoId : '';
      if (parsed.playlistId) {
        player.cuePlaylist({ listType: 'playlist', list: parsed.playlistId, index: 0, startSeconds: 0 });
      } else {
        player.cueVideoById({ videoId: parsed.videoId, startSeconds: 0 });
      }
      updateMeta();
      elements.state.textContent = 'Cued';
      updateButtons();
      announce(`${parsed.kind} loaded. Use Play or the visible YouTube controls to begin.`);
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The YouTube player could not be initialized.', 'error');
    }
  }

  function perform(action) {
    if (!state.player || !state.ready || !state.content) return;
    try {
      if (action === 'play') {
        if (state.pendingPlaylistVideo) {
          const index = state.player.getPlaylist()?.indexOf(state.pendingPlaylistVideo) ?? -1;
          if (index >= 0) state.player.playVideoAt(index);
          else state.player.playVideo();
          state.pendingPlaylistVideo = '';
        } else state.player.playVideo();
      }
      if (action === 'pause') state.player.pauseVideo();
      if (action === 'stop') state.player.stopVideo();
      if (action === 'restart') { state.player.seekTo(0, true); state.player.playVideo(); }
      if (action === 'previous') state.player.previousVideo();
      if (action === 'next') state.player.nextVideo();
      if (action === 'mute') {
        const muted = !state.player.isMuted();
        if (muted) state.player.mute();
        else state.player.unMute();
        const button = elements.controls.find((item) => item.dataset.youtubeAction === 'mute');
        button.textContent = muted ? 'Unmute' : 'Mute';
        button.setAttribute('aria-pressed', String(muted));
      }
    } catch (error) { announce(`YouTube control failed: ${error.message}`, 'error'); }
  }

  function clearContent() {
    if (state.player && state.ready) {
      state.player.stopVideo();
      state.player.clearVideo();
    }
    state.content = null;
    state.pendingPlaylistVideo = '';
    elements.state.textContent = 'No content';
    updateMeta();
    updateButtons();
    announce('YouTube player cleared.');
  }

  elements.input.addEventListener('input', () => sessionStorage.setItem(SESSION_KEY, elements.input.value));
  elements.form.addEventListener('submit', (event) => { event.preventDefault(); loadContent(elements.input.value); });
  elements.controls.forEach((button) => button.addEventListener('click', () => perform(button.dataset.youtubeAction)));
  elements.volume.addEventListener('input', () => {
    elements.volumeOutput.value = elements.volume.value;
    if (state.player && state.ready) state.player.setVolume(Number(elements.volume.value));
  });
  elements.open.addEventListener('click', () => {
    if (state.content) window.open(state.content.canonicalUrl, '_blank', 'noopener,noreferrer');
  });
  elements.clear.addEventListener('click', clearContent);
  updateButtons();

  return {
    pause() {
      // Never keep the official player hidden while playback continues.
      if (state.player && state.ready && state.player.getPlayerState() === window.YT.PlayerState.PLAYING) state.player.pauseVideo();
    },
    clear: clearContent,
    getState: () => state,
  };
}
