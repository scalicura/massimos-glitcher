function makeButton(label, action, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.padAction = action;
  if (className) button.className = className;
  return button;
}

export function createSoundPadElement(pad) {
  const article = document.createElement('article');
  article.className = 'sound-pad';
  article.dataset.padId = pad.id;
  article.dataset.status = pad.status;

  const header = document.createElement('div');
  header.className = 'sound-pad__header';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Pad name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = pad.name;
  nameInput.maxLength = 48;
  nameInput.dataset.padField = 'name';
  nameInput.setAttribute('aria-label', `Name for ${pad.name}`);
  nameLabel.append(nameInput);
  const shortcutLabel = document.createElement('label');
  shortcutLabel.className = 'shortcut-field';
  shortcutLabel.textContent = 'Key';
  const shortcutInput = document.createElement('input');
  shortcutInput.type = 'text';
  shortcutInput.maxLength = 1;
  shortcutInput.value = pad.shortcut;
  shortcutInput.dataset.padField = 'shortcut';
  shortcutInput.setAttribute('aria-label', `Keyboard shortcut for ${pad.name}`);
  shortcutLabel.append(shortcutInput);
  header.append(nameLabel, shortcutLabel);

  const playButton = makeButton(`Play ${pad.name}`, 'play', 'sound-pad__trigger');
  playButton.innerHTML = '<span aria-hidden="true">▶</span><strong>Play / restart</strong>';
  playButton.title = 'Play from the beginning; other pads may continue playing';

  const transport = document.createElement('div');
  transport.className = 'sound-pad__transport';
  transport.append(
    makeButton('Pause', 'pause'),
    makeButton('Stop', 'stop'),
    makeButton('Loop', 'loop'),
  );

  const sliders = document.createElement('div');
  sliders.className = 'sound-pad__sliders';
  const volumeLabel = document.createElement('label');
  volumeLabel.innerHTML = 'Volume <output data-pad-output="volume">100</output>';
  const volume = document.createElement('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.value = String(Math.round(pad.volume * 100));
  volume.dataset.padField = 'volume';
  volume.setAttribute('aria-label', `Volume for ${pad.name}`);
  volumeLabel.append(volume);
  const speedLabel = document.createElement('label');
  speedLabel.innerHTML = 'Speed <output data-pad-output="rate">1.00×</output>';
  const speed = document.createElement('input');
  speed.type = 'range';
  speed.min = '0.5';
  speed.max = '2';
  speed.step = '0.05';
  speed.value = String(pad.rate);
  speed.dataset.padField = 'rate';
  speed.setAttribute('aria-label', `Playback speed for ${pad.name}`);
  speedLabel.append(speed);
  sliders.append(volumeLabel, speedLabel);

  const utilities = document.createElement('div');
  utilities.className = 'sound-pad__utilities';
  utilities.append(
    makeButton('Replace', 'replace'),
    makeButton('Duplicate', 'duplicate'),
    makeButton('Delete', 'delete'),
  );
  const replaceInput = document.createElement('input');
  replaceInput.type = 'file';
  replaceInput.accept = 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a';
  replaceInput.hidden = true;
  replaceInput.dataset.padReplace = '';
  utilities.append(replaceInput);

  const state = document.createElement('p');
  state.className = 'sound-pad__state';
  state.dataset.padState = '';
  state.setAttribute('aria-live', 'polite');
  state.textContent = 'Loading audio…';

  article.append(header, playButton, transport, sliders, utilities, state);
  return article;
}

export function updateSoundPadElement(element, pad) {
  element.dataset.status = pad.status;
  element.querySelector('[data-pad-state]').textContent = pad.error || ({
    loading: 'Loading audio…',
    stopped: pad.loop ? 'Stopped · loop armed' : 'Stopped',
    playing: pad.loop ? 'Playing · looping' : 'Playing',
    paused: pad.loop ? 'Paused · loop armed' : 'Paused',
    error: 'Audio error',
  }[pad.status] || pad.status);
  const loop = element.querySelector('[data-pad-action="loop"]');
  loop.setAttribute('aria-pressed', String(pad.loop));
  loop.textContent = pad.loop ? 'Loop on' : 'Loop';
  element.querySelector('.sound-pad__trigger strong').textContent = pad.status === 'paused' ? 'Resume' : 'Play / restart';
  element.querySelector('[data-pad-output="volume"]').value = String(Math.round(pad.volume * 100));
  element.querySelector('[data-pad-output="rate"]').value = `${pad.rate.toFixed(2)}×`;
  element.querySelector('[data-pad-field="shortcut"]').value = pad.shortcut;
}
