const listeners = new Map();
let socket = null;
let activeConversationId = null;
let activeToken = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let manualDisconnect = false;
let connectionStatus = 'disconnected';

const MAX_RETRIES = 5;

const emit = (event, payload) => {
  listeners.get(event)?.forEach((handler) => handler(payload));
};

const setConnectionStatus = (status) => {
  connectionStatus = status;
  emit('status', status);
};

const buildSocketUrl = (conversationId, token) => {
  const baseUrl = import.meta.env.VITE_WS_BASE_URL || (window.location.protocol === 'https:' ? 'wss://localhost:8000' : 'ws://localhost:8000');
  return `${baseUrl}/ws/chat/${conversationId}/?token=${encodeURIComponent(token)}`;
};

export function registerListener(event, handler) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(handler);
}

export function removeListener(event, handler) {
  listeners.get(event)?.delete(handler);
}

export function getConnectionStatus() {
  return connectionStatus;
}

export function connect({ conversationId, token }) {
  if (!conversationId || !token) {
    setConnectionStatus('disconnected');
    return false;
  }

  if (socket && socket.readyState === WebSocket.OPEN && activeConversationId === conversationId) {
    setConnectionStatus('connected');
    return true;
  }

  manualDisconnect = false;
  activeConversationId = conversationId;
  activeToken = token;

  if (socket && socket.readyState === WebSocket.CONNECTING) {
    return true;
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  clearTimeout(reconnectTimer);
  setConnectionStatus('connecting');

  const ws = new WebSocket(buildSocketUrl(conversationId, token));
  socket = ws;

  ws.addEventListener('open', () => {
    reconnectAttempts = 0;
    setConnectionStatus('connected');
  });

  ws.addEventListener('message', (event) => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      emit('message', payload);
    } catch (error) {
      emit('message', { type: 'error', message: 'Unable to parse websocket payload.' });
    }
  });

  ws.addEventListener('close', () => {
    if (socket === ws) {
      socket = null;
    }

    if (!manualDisconnect && reconnectAttempts < MAX_RETRIES && activeConversationId && activeToken) {
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 8000);
      reconnectAttempts += 1;
      setConnectionStatus('reconnecting');
      reconnectTimer = window.setTimeout(() => {
        connect({ conversationId: activeConversationId, token: activeToken });
      }, delay);
      return;
    }

    setConnectionStatus('disconnected');
  });

  ws.addEventListener('error', () => {
    if (socket === ws) {
      emit('message', { type: 'error', message: 'WebSocket connection error.' });
    }
  });

  return true;
}

export function disconnect(isManual = true) {
  manualDisconnect = isManual;
  clearTimeout(reconnectTimer);
  if (socket) {
    socket.close();
    socket = null;
  }
  activeConversationId = null;
  activeToken = null;
  setConnectionStatus('disconnected');
}

export function reconnect() {
  manualDisconnect = false;
  if (activeConversationId && activeToken) {
    connect({ conversationId: activeConversationId, token: activeToken });
  }
}

export function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify(payload));
  return true;
}
