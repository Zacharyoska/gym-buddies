/* QR member passes and camera scanning, using vendored offline libraries. */

import { esc, icon, openModal, closeModal } from './ui.js';

const scriptLoads = new Map();

function loadScript(src) {
  if (!scriptLoads.has(src)) {
    scriptLoads.set(
      src,
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          scriptLoads.delete(src);
          reject(new Error('A QR component could not be loaded.'));
        };
        document.head.appendChild(script);
      })
    );
  }
  return scriptLoads.get(src);
}

async function qrLibrary() {
  await loadScript('/js/vendor/qrcode-generator.js');
  if (typeof window.qrcode !== 'function') {
    throw new Error('The QR generator did not load correctly.');
  }
  return window.qrcode;
}

async function decoderLibrary() {
  await loadScript('/js/vendor/jsqr.js');
  const decoder = window.jsQR?.default || window.jsQR;
  if (typeof decoder !== 'function') {
    throw new Error('The QR scanner did not load correctly.');
  }
  return decoder;
}

export async function qrSvg(text, options = {}) {
  const qrcode = await qrLibrary();
  const qr = qrcode(0, options.errorCorrectionLevel || 'M');
  qr.addData(String(text || ''));
  qr.make();
  return qr.createSvgTag({
    cellSize: options.cellSize || 4,
    margin: options.margin ?? 2,
    scalable: true
  });
}

export async function fillQr(element, code, options = {}) {
  if (!element) return;
  try {
    element.innerHTML = await qrSvg(code, options);
    element.dataset.qrReady = '1';
  } catch (error) {
    element.innerHTML = `<div class="qr-loading">${icon('alert')}<span>QR unavailable</span></div>`;
    console.error('[gym-buddies]', error);
  }
}

export function normalizeScannedCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let candidate = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      candidate = url.searchParams.get('code') || url.searchParams.get('member') || raw;
    } catch {
      // Keep the raw text when the URL cannot be parsed.
    }
  }
  const match = String(candidate).match(/\b([A-Z]{2,6}-\d{2,})\b/i);
  return match ? match[1].toUpperCase() : String(candidate).trim().slice(0, 30);
}

export async function printQrPass({ code, name }) {
  const svg = await qrSvg(code, { cellSize: 8, margin: 4 });
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `<div class="qr-print-sheet">
    <div class="qr-print-qr">${svg}</div>
    <div class="qr-print-details">
      <div class="qr-print-brand">Gym Buddies by Jahren & Charles <span>Member QR pass</span></div>
      <div class="qr-print-name">${esc(name || 'Member')}</div>
      <div class="qr-print-code">${esc(code)}</div>
      <div class="qr-print-hint">Show this code at the front desk to check in.</div>
    </div>
  </div>`;
  document.body.classList.add('printing-qr');
  const cleanup = () => {
    document.body.classList.remove('printing-qr');
    root.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.setTimeout(cleanup, 60000);
  window.print();
}

export async function downloadQrPass({ code }) {
  const svg = await qrSvg(code, { cellSize: 10, margin: 4 });
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], {
    type: 'image/svg+xml;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(code || 'member').replace(/[^a-z0-9_-]/gi, '-')}-qr.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openQrScanner({ onScan } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    openModal({
      title: 'Camera scanning unavailable',
      subtitle: 'This browser or connection cannot open the camera.',
      size: 'modal-narrow',
      body: `<div class="modal-body">
        <div class="notice warn">${icon('alert')}<div>Camera access needs <strong>localhost</strong> or an <strong>HTTPS</strong> connection. Open the app at <code>127.0.0.1</code>, or use a USB QR scanner / type the member code instead.</div></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-primary" data-dialog-close>Got it</button></div>`
    });
    return null;
  }

  const dialog = openModal({
    title: 'Scan member QR',
    subtitle: 'Hold the member’s QR pass in front of the camera.',
    size: 'modal-narrow',
    body: `<div class="qr-scanner">
      <div class="qr-scanner-stage">
        <video id="qr-scanner-video" playsinline muted></video>
        <div class="qr-scanner-frame" aria-hidden="true"></div>
      </div>
      <div class="qr-scanner-status" id="qr-scanner-status">Starting camera…</div>
      <div class="qr-scanner-hint">${icon('info', 'icon-sm')}<span>The QR holds the member code, for example <code>GB-0001</code>. Nothing is recorded until you check them in.</span></div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" data-dialog-close>Cancel</button>
    </div>`
  });

  const video = dialog.querySelector('#qr-scanner-video');
  const status = dialog.querySelector('#qr-scanner-status');
  let stream = null;
  let timer = null;
  let stopped = false;

  const stop = () => {
    stopped = true;
    if (timer) window.clearInterval(timer);
    timer = null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  };
  dialog.addEventListener('close', stop, { once: true });

  const fail = (message) => {
    if (stopped) return;
    status.textContent = message;
    status.classList.add('error');
  };

  try {
    const decoder = await decoderLibrary();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    if (stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return dialog;
    }
    video.srcObject = stream;
    await video.play();
    status.textContent = 'Point the camera at the QR pass…';

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    timer = window.setInterval(() => {
      if (stopped || video.readyState < 2 || !video.videoWidth) return;
      const scale = Math.min(1, 900 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = decoder(image.data, image.width, image.height, {
        inversionAttempts: 'dontInvert'
      });
      if (!result?.data) return;
      const code = normalizeScannedCode(result.data);
      stop();
      closeModal();
      if (typeof onScan === 'function') onScan(code);
    }, 180);
  } catch (error) {
    const messages = {
      NotAllowedError: 'Camera permission was denied. Allow camera access, or type the member code.',
      PermissionDeniedError: 'Camera permission was denied. Allow camera access, or type the member code.',
      NotFoundError: 'No camera was found. Use a USB QR scanner or type the member code.',
      DevicesNotFoundError: 'No camera was found. Use a USB QR scanner or type the member code.',
      NotReadableError: 'The camera is in use by another app. Close it and try again.',
      TrackStartError: 'The camera is in use by another app. Close it and try again.',
      SecurityError: 'Camera access needs localhost or HTTPS. Use a USB QR scanner or type the code.'
    };
    fail(messages[error?.name] || 'Could not start the scanner. Use a USB QR scanner or type the code.');
  }
  return dialog;
}
