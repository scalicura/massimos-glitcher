import test from 'node:test';
import assert from 'node:assert/strict';
import { canShareImage, shareImage } from '../src/image-sharing.js';

const file = new File(['pixels'], 'glitch.png', { type: 'image/png' });

test('sharing is hidden when file sharing is absent, denied, or unsupported', () => {
  assert.equal(canShareImage(file, {}), false);
  assert.equal(canShareImage(file, { share() {}, canShare: () => false }), false);
  assert.equal(canShareImage(file, { share() {}, canShare() { throw new Error('Denied'); } }), false);
});

test('native share receives only the prepared file and starts synchronously with the tap', async () => {
  let called = false;
  const result = shareImage(file, { canShare: () => true, share(data) {
    called = true;
    assert.deepEqual(data.files, [file]);
    assert.equal(data.files[0].type, 'image/png');
    assert.equal(data.url, undefined);
    return Promise.resolve();
  } });
  assert.equal(called, true);
  assert.equal(await result, true);
});

test('cancellation is quiet and other native-share failures remain actionable', async () => {
  assert.equal(await shareImage(file, { canShare: () => true, share() { throw new DOMException('Canceled', 'AbortError'); } }), false);
  await assert.rejects(shareImage(file, { canShare: () => true, share() { throw new Error('Unavailable'); } }), /Unavailable/);
  await assert.rejects(shareImage(file, {}), /Use Export/);
});
