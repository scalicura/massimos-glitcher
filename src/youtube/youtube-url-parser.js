const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^(PL|UU|LL|RD|FL|WL|OLAK5uy)[A-Za-z0-9_-]{10,}$/;

function validVideoId(value) {
  return VIDEO_ID.test(value || '');
}

function validPlaylistId(value) {
  return PLAYLIST_ID.test(value || '');
}

function canonicalUrl(videoId, playlistId) {
  if (videoId) {
    const url = new URL('https://www.youtube.com/watch');
    url.searchParams.set('v', videoId);
    if (playlistId) url.searchParams.set('list', playlistId);
    return url.href;
  }
  const url = new URL('https://www.youtube.com/playlist');
  url.searchParams.set('list', playlistId);
  return url.href;
}

/** Parse only known YouTube URL shapes and explicit IDs; never scrape page content. */
export function parseYouTubeInput(rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) throw new Error('Enter a YouTube URL, video ID, or playlist ID.');

  if (validVideoId(input)) {
    return { kind: 'video', videoId: input, playlistId: '', canonicalUrl: canonicalUrl(input, '') };
  }
  if (validPlaylistId(input)) {
    return { kind: 'playlist', videoId: '', playlistId: input, canonicalUrl: canonicalUrl('', input) };
  }

  let candidate = input;
  if (/^(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(candidate)) candidate = `https://${candidate}`;

  let url;
  try { url = new URL(candidate); } catch { throw new Error('That is not a valid YouTube URL or ID.'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (!['youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    throw new Error('Use a youtube.com or youtu.be URL.');
  }

  let videoId = '';
  let playlistId = url.searchParams.get('list') || '';
  if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
  else if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
  else {
    const segments = url.pathname.split('/').filter(Boolean);
    if (['shorts', 'embed', 'live'].includes(segments[0])) videoId = segments[1] || '';
  }

  if (videoId && !validVideoId(videoId)) throw new Error('The YouTube video ID is malformed.');
  if (playlistId && !validPlaylistId(playlistId)) throw new Error('The YouTube playlist ID is malformed.');
  if (!videoId && !playlistId) throw new Error('No valid video or playlist ID was found in that URL.');

  return {
    kind: videoId && playlistId ? 'video + playlist' : videoId ? 'video' : 'playlist',
    videoId,
    playlistId,
    canonicalUrl: canonicalUrl(videoId, playlistId),
  };
}

