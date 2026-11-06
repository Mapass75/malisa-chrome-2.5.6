import browser from './shared/browser.js';

const params = new URLSearchParams(location.search);
const REQ = params.get('req') || '';
const METHOD = params.get('method') === 'ai' ? 'ai' : 'browser';
const LANG = params.get('lang') || '';
const PROVIDER = params.get('provider') || '';
const MODEL = params.get('model') || '';

const micBtn = document.getElementById('micBtn');
const micStatus = document.getElementById('micStatus');
const micTranscript = document.getElementById('micTranscript');
const micUse = document.getElementById('micUse');
const micClose = document.getElementById('micClose');

let recognition = null;
let mediaRecorder = null;
let mediaStream = null;
let chunks = [];
let recTimer = null;
let finalText = '';
let busy = false;

function setStatus(text, isErr = false) {
  micStatus.textContent = text;
  micStatus.classList.toggle('err', isErr);
}

function setListening(on) {
  micBtn.classList.toggle('listening', on);
  micBtn.textContent = on ? '⏹' : '🎤';
  micBtn.setAttribute('aria-label', on ? 'Stop recording' : 'Start voice input');
}

function cleanup() {
  clearTimeout(recTimer);
  recTimer = null;
  if (recognition) {
    try { recognition.stop(); } catch { /* already stopped */ }
    recognition = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch { /* ignore */ }
  }
  mediaRecorder = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach((tr) => tr.stop());
    mediaStream = null;
  }
  chunks = [];
  setListening(false);
}

function sendResult(text) {
  if (!REQ) {
    window.close();
    return;
  }
  browser.runtime
    .sendMessage({ type: 'VOICE_PAGE_RESULT', req: REQ, text })
    .catch(() => {})
    .finally(() => window.close());
}

function handleFinalText(text) {
  const clean = (text || '').trim();
  if (!clean) {
    setStatus('No speech detected — try again.', true);
    return;
  }
  finalText = clean;
  micTranscript.textContent = clean;
  micUse.disabled = false;
  setStatus('Ready — click “Use this text” to send it to the chat.');
}

micUse.addEventListener('click', () => {
  if (finalText) sendResult(finalText);
});
micClose.addEventListener('click', () => sendResult(''));
window.addEventListener('beforeunload', cleanup);

function startBrowserRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setStatus('Browser speech recognition is not available here — switch to AI provider method.', true);
    return;
  }
  recognition = new SR();
  if (LANG) recognition.lang = LANG;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let interim = '';
  recognition.onresult = (e) => {
    let text = '';
    for (const r of e.results) text += r[0]?.transcript || '';
    interim = text;
    micTranscript.textContent = text;
  };
  recognition.onend = () => {
    if (interim.trim()) handleFinalText(interim);
    else setStatus('');
    setListening(false);
    recognition = null;
  };
  recognition.onerror = (e) => {
    setListening(false);
    recognition = null;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      setStatus('Microphone access denied — allow it for this extension page and try again.', true);
    } else if (e.error === 'no-speech') {
      setStatus('No speech detected — try again.');
    } else {
      setStatus(`Speech recognition error: ${e.error || 'unknown'}`, true);
    }
  };
  recognition.start();
  setListening(true);
  setStatus('Listening…');
}

async function startAiRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      setStatus('Microphone access denied — allow it for this extension page and try again.', true);
    } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      setStatus('No microphone found.', true);
    } else {
      setStatus(`Microphone error: ${err?.message || err?.name || 'unknown'}`, true);
    }
    return;
  }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
    .find((m) => MediaRecorder.isTypeSupported(m)) || '';
  try {
    mediaRecorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
  } catch {
    setStatus('Recording is not supported in this browser.', true);
    cleanup();
    return;
  }
  chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
    chunks = [];
    mediaRecorder = null;
    if (mediaStream) {
      mediaStream.getTracks().forEach((tr) => tr.stop());
      mediaStream = null;
    }
    setListening(false);
    if (!blob.size) {
      setStatus('No audio recorded — try again.');
      return;
    }
    busy = true;
    micBtn.disabled = true;
    setStatus('Transcribing…');
    try {
      const buf = await blob.arrayBuffer();
      const res = await browser.runtime.sendMessage({
        type: 'VOICE_TRANSCRIBE',
        audio: buf,
        mimeType: blob.type,
        language: LANG ? LANG.split('-')[0] : '',
        provider: PROVIDER,
        model: MODEL,
      });
      if (!res?.ok) throw new Error(res?.error || 'Transcription failed');
      handleFinalText(res.text);
    } catch (err) {
      setStatus(err?.message || 'Transcription failed', true);
    } finally {
      busy = false;
      micBtn.disabled = false;
      setStatus(micStatus.classList.contains('err') ? micStatus.textContent : '');
      if (!micStatus.classList.contains('err')) setStatus('Click the microphone to try again.');
    }
  };
  mediaRecorder.start(250);
  recTimer = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }, 60000);
  setListening(true);
  setStatus('Listening… (max 60 s)');
}

micBtn.addEventListener('click', () => {
  if (busy) return;
  if (recognition || (mediaRecorder && mediaRecorder.state !== 'inactive')) {
    if (recognition) recognition.stop();
    else if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    return;
  }
  finalText = '';
  micTranscript.textContent = '';
  micUse.disabled = true;
  if (METHOD === 'browser') startBrowserRecognition();
  else startAiRecording();
});

document.getElementById('micSub').textContent =
  METHOD === 'browser'
    ? 'Browser speech recognition — audio is processed by your browser vendor.'
    : 'Audio is sent to the selected AI provider for transcription.';
