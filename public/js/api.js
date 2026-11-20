const API_ROOT = '/api';

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { 'X-Gym-App': '1' };
  const fetchOptions = {
    method,
    headers,
    credentials: 'same-origin'
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, fetchOptions);
  } catch {
    throw new ApiError('Cannot reach the Gym Buddies by Jahren & Charles server. Check that it is running.', 0);
  }

  let payload = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent('gb:unauthorized'));
    }
    throw new ApiError(
      payload?.error || `Request failed (${response.status}).`,
      response.status,
      payload?.details || null
    );
  }
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: 'POST', body }),
  patch: (path, body = {}) => request(path, { method: 'PATCH', body })
};

export function exportUrl(kind) {
  return `${API_ROOT}/export/${kind}.csv`;
}
