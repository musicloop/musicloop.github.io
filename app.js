const dropzone = document.getElementById('dropzone');
const playPauseBtn = document.getElementById('playPauseBtn');
const fileList = document.getElementById('fileList');

let audioFiles = []; // { url, name, duration }
let currentIndex = 0;
let currentAudio = null;
let isPlaying = false;
let progressAnimationFrame = null;
let isReverse = false;
let isFilePickerOpen = false;
let shouldScrollToCurrent = false;

// Handle tabbing to dropzone with keyboard
dropzone.tabIndex = 0; // Make it focusable
dropzone.setAttribute('role', 'button'); // For screen readers
dropzone.setAttribute('aria-label', 'Upload audio files'); // Accessibility

dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click(); // Trigger file picker
  }
});


// Add hidden file input element to dropzone
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'audio/mpeg';
fileInput.multiple = true;
fileInput.style.display = 'none'; // Hide file input
dropzone.appendChild(fileInput);

// Dropzone behavior
dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('border-green-600', 'bg-green-100');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('border-green-600', 'bg-green-100');
});

dropzone.addEventListener('drop', async e => {
  e.preventDefault();
  dropzone.classList.remove('border-green-600', 'bg-green-100');

  const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'audio/mpeg');

  for (const file of files) {
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(url);
    audioFiles.push({ url, name: file.name, duration });
  }

  renderFileList();
  resetAudio();
});

// Trigger file picker on dropzone click
dropzone.addEventListener('click', () => {
  isFilePickerOpen = true;
  fileInput.click(); // Trigger file input on dropzone click
});

// Handle file selection from file picker
fileInput.addEventListener('change', async e => {
  isFilePickerOpen = false;
  const files = Array.from(e.target.files).filter(file => file.type === 'audio/mpeg');
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(url);
    audioFiles.push({ url, name: file.name, duration });
  }

  renderFileList();
  resetAudio();

  // Blur the dropzone so it no longer receives spacebar events
  dropzone.blur();
});


fileInput.addEventListener('blur', () => {
  isFilePickerOpen = false;
});


// Utility to get audio duration
function getAudioDuration(url) {
  return new Promise(resolve => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
  });
}

// Utility to format seconds to mm:ss
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Render file list with drag, duration, rename, delete, progress bar, and countdown
function renderFileList() {
  fileList.innerHTML = '';
  audioFiles.forEach((file, idx) => {
    const li = document.createElement('li');
    li.className = `flex items-center justify-between px-3 py-2 rounded transition-all cursor-pointer`;
    li.draggable = true;

    // DRAG EVENTS
    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', idx); // Store dragged index
      li.classList.add('opacity-50');
    });

    li.addEventListener('dragend', () => {
      li.classList.remove('opacity-50');
    });

    li.addEventListener('dragover', e => {
      e.preventDefault(); // Needed to allow drop
      li.classList.add('bg-gray-100');
    });

    li.addEventListener('dragleave', () => {
      li.classList.remove('bg-gray-100');
    });

    li.addEventListener('drop', e => {
      e.preventDefault();
      li.classList.remove('bg-gray-100');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = idx;
      reorderFiles(fromIdx, toIdx);
    });

    // LEFT SIDE: Name + Time
    const left = document.createElement('div');
    left.className = 'flex-1 flex items-center gap-2';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = file.name;
    nameSpan.className = 'cursor-pointer hover:underline';
    nameSpan.style.cursor = 'grab'; // drag indicator
    nameSpan.addEventListener('click', e => {
      e.stopPropagation(); // prevent li click when renaming
      makeEditable(nameSpan, idx);
    });

    const remainingTime =
      idx === currentIndex && currentAudio
        ? formatTime(file.duration - currentAudio.currentTime)
        : formatTime(file.duration);

    const time = document.createElement('span');
    time.textContent = remainingTime;
    time.className = 'text-xs text-gray-500 ml-2';

    left.appendChild(nameSpan);
    left.appendChild(time);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.className = 'text-red-500 hover:text-red-700 ml-4';
    delBtn.addEventListener('click', e => {
      e.stopPropagation(); // prevent li click when deleting
      deleteFile(idx);
    });

    li.appendChild(left);
    li.appendChild(delBtn);

    // Click to play if not clicking on name or delete
    li.addEventListener('click', () => {
      if (idx !== currentIndex || !isPlaying) {
        currentIndex = idx;
        startTrack(idx);
      }
    });

    // Progress bar and current-track marking
    if (idx === currentIndex && currentAudio) {
      const progress = currentAudio?.currentTime / currentAudio?.duration || 0;
      li.style.background = `linear-gradient(to right, #bfdbfe ${progress * 100}%, #f3f4f6 ${progress * 100}%)`;
      li.classList.add('current-track');
    } else {
      li.style.background = '#fff';
    }

    fileList.appendChild(li);
  });

  // Scroll to currently playing track if it exists
  if (shouldScrollToCurrent) {
  const currentEl = document.querySelector('.current-track');
  if (currentEl) {
    currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  shouldScrollToCurrent = false;
}

}


function reorderFiles(from, to) {
  if (from === to) return;

  const [moved] = audioFiles.splice(from, 1);
  audioFiles.splice(to, 0, moved);

  // Adjust currentIndex if needed
  if (from === currentIndex) {
    currentIndex = to;
  } else if (from < currentIndex && to >= currentIndex) {
    currentIndex--;
  } else if (from > currentIndex && to <= currentIndex) {
    currentIndex++;
  }

  renderFileList();
}



// Inline renaming
function makeEditable(span, idx) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = audioFiles[idx].name;
  input.className = 'border px-1 rounded text-sm';
  input.addEventListener('blur', () => finishEdit(input, idx));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
  });
  span.replaceWith(input);
  input.focus();
}

function finishEdit(input, idx) {
  const newName = input.value.trim();
  if (newName) {
    audioFiles[idx].name = newName;
  }
  renderFileList();
}

function deleteFile(index) {
  URL.revokeObjectURL(audioFiles[index].url);
  const wasPlaying = isPlaying && index === currentIndex;

  audioFiles.splice(index, 1);
  if (index < currentIndex || currentIndex >= audioFiles.length) {
    currentIndex = Math.max(currentIndex - 1, 0);
  }

  if (wasPlaying || audioFiles.length === 0) {
    resetAudio();
  }

  renderFileList();
}

// Reset playback
function resetAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  stopProgressLoop();
  isPlaying = false;
  playPauseBtn.textContent = 'Play';
  renderFileList();
}

// Core function to start and play a track
function startTrack(index) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeEventListener('ended', handleAudioEnd);
  }

  currentAudio = new Audio(audioFiles[index].url);
  currentAudio.addEventListener('ended', handleAudioEnd);
  currentAudio.play();
  isPlaying = true;
  playPauseBtn.textContent = 'Pause';
  startProgressLoop();

  shouldScrollToCurrent = true; // <-- only scroll when starting a new track
  
  renderFileList();
}

// Play/pause toggle
playPauseBtn.addEventListener('click', () => {
  if (!audioFiles.length) return;

  if (!currentAudio) {
    currentIndex = isReverse ? audioFiles.length - 1 : 0;
    shouldScrollToCurrent = true; // New track starting
    startTrack(currentIndex);
  } else if (isPlaying) {
    currentAudio.pause();
    stopProgressLoop();
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
    renderFileList(); // still want to refresh UI
  } else {
    currentAudio.play();
    isPlaying = true; //set before calling the loop
    startProgressLoop(); // this now sees isPlaying = true
    playPauseBtn.textContent = 'Pause';
    shouldScrollToCurrent = true;
    renderFileList();
  }
});



// Playlist reverse logic
const reverseToggle = document.getElementById('reverseToggle');

reverseToggle.addEventListener('change', () => {
  isReverse = reverseToggle.checked;

  const nothingPlaying = !isPlaying && !currentAudio;
  const isPaused = currentAudio && !isPlaying;

  if (nothingPlaying || isPaused) {
    currentIndex = isReverse ? audioFiles.length - 1 : 0;
    resetAudio(); // Reset and update list display
  }

  if (isPlaying && currentAudio) {
    if (isReverse && currentIndex === 0) {
      currentIndex = audioFiles.length - 1;
      startTrack(currentIndex); // Restart in reverse from end
    } else if (!isReverse && currentIndex === audioFiles.length - 1) {
      currentIndex = 0;
      startTrack(currentIndex); // Restart in forward from beginning
    }
    // Otherwise, let current track play to end and follow new direction
  }
});



// Track end logic — move to next and loop
function handleAudioEnd() {
  if (isReverse) {
    currentIndex = (currentIndex - 1 + audioFiles.length) % audioFiles.length;
  } else {
    currentIndex = (currentIndex + 1) % audioFiles.length;
  }
  startTrack(currentIndex);
}



// Background progress updater
function startProgressLoop() {
  function update() {
    if (currentAudio && isPlaying) {
      renderFileList(); // update progress bar and countdown
      progressAnimationFrame = requestAnimationFrame(update);
    }
  }
  stopProgressLoop();
  update();
}

function stopProgressLoop() {
  if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame);
    progressAnimationFrame = null;
  }
}


// Prevent spacebar activating reverse checkbox toggle
reverseToggle.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault(); // Stop the native spacebar toggle
  }
});

// Keyboard shortcut: toggle play/pause with spacebar
document.addEventListener('keydown', e => {
  const isTyping = e.target.matches('input, textarea');
  const isFocusedReverseToggle = document.activeElement === reverseToggle;

  // Spacebar → Play/Pause (only when not typing or in file picker)
  if (e.code === 'Space' && !isTyping && !isFilePickerOpen) {
    e.preventDefault();
    playPauseBtn.click();
  }

  // Enter → Toggle reverse checkbox (when not focused directly)
  if (e.code === 'Enter' && !isTyping && !isFilePickerOpen && !isFocusedReverseToggle) {
    e.preventDefault();
    reverseToggle.checked = !reverseToggle.checked;
    reverseToggle.dispatchEvent(new Event('change'));
  }
});
