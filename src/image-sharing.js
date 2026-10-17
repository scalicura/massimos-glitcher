export function canShareImage(file, shareApi = globalThis.navigator) {
  try {
    return typeof shareApi?.share === 'function' && typeof shareApi?.canShare === 'function'
      && shareApi.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Called directly from a tap on the prepared-file button to preserve activation. */
export async function shareImage(file, shareApi = globalThis.navigator) {
  if (!canShareImage(file, shareApi)) throw new Error('Sharing this file is unavailable. Use Export to save it instead.');
  try {
    await shareApi.share({ files: [file], title: 'Made with Massimo’s Glitcher' });
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    throw error;
  }
}
