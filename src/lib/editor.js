// Small, framework-free helpers for the code editor panel.

const HISTORY_LIMIT = 100;

export function emptyHistory() {
  return { past: [], future: [], lastAt: 0 };
}

// Typing bursts within `groupMs` become one undo step.
export function recordEdit(history, previous, now = Date.now(), groupMs = 800) {
  const startGroup = !history.past.length || now - history.lastAt > groupMs;
  return {
    past: startGroup
      ? [...history.past, previous].slice(-HISTORY_LIMIT)
      : history.past,
    future: [],
    lastAt: now,
  };
}

export function undoEdit(history, current) {
  if (!history.past.length) return null;
  return {
    code: history.past.at(-1),
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, HISTORY_LIMIT),
      lastAt: 0,
    },
  };
}

export function redoEdit(history, current) {
  if (!history.future.length) return null;
  return {
    code: history.future[0],
    history: {
      past: [...history.past, current].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
      lastAt: 0,
    },
  };
}

export function cursorPosition(code, index) {
  const before = code.slice(0, Math.max(0, index));
  const line = before.split("\n").length;
  return { line, column: index - (before.lastIndexOf("\n") + 1) + 1 };
}
