import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Minimal in-memory localStorage; Node's built-in one needs --localstorage-file.
class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, String(value)); }
  removeItem(key: string) { this.items.delete(key); }
  clear() { this.items.clear(); }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(async () => {
  // Unmount React trees between component tests (no-op in the Node environment).
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
  vi.unstubAllGlobals();
});
