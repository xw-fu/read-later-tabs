type Listener = (...args: any[]) => void;

class FakeEvent {
  private listeners: Listener[] = [];
  addListener(fn: Listener) { this.listeners.push(fn); }
  removeListener(fn: Listener) { this.listeners = this.listeners.filter(l => l !== fn); }
  trigger(...args: any[]) { this.listeners.forEach(l => l(...args)); }
  reset() { this.listeners = []; }
}

class FakeStorageArea {
  private data: Record<string, unknown> = {};
  async get(keys?: string | string[] | Record<string, unknown>) {
    if (!keys) return { ...this.data };
    const ks = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const result: Record<string, unknown> = {};
    for (const k of ks) {
      if (k in this.data) result[k] = this.data[k];
      else if (typeof keys === 'object' && !Array.isArray(keys)) result[k] = (keys as any)[k];
    }
    return result;
  }
  async set(items: Record<string, unknown>) { Object.assign(this.data, items); }
  async remove(keys: string | string[]) {
    const ks = typeof keys === 'string' ? [keys] : keys;
    for (const k of ks) delete this.data[k];
  }
  async clear() { this.data = {}; }
  reset() { this.data = {}; }
}

export const mockStorage = new FakeStorageArea();
export const mockSessionStorage = new FakeStorageArea();
export const tabsOnCreated = new FakeEvent();
export const tabsOnUpdated = new FakeEvent();
export const tabsOnActivated = new FakeEvent();
export const tabsOnRemoved = new FakeEvent();

export function installChromeMock() {
  (globalThis as any).chrome = {
    storage: { local: mockStorage, session: mockSessionStorage, onChanged: new FakeEvent() },
    tabs: {
      query: vi.fn(async () => []),
      get: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => undefined),
      create: vi.fn(async () => ({})),
      onCreated: tabsOnCreated,
      onUpdated: tabsOnUpdated,
      onActivated: tabsOnActivated,
      onRemoved: tabsOnRemoved,
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: new FakeEvent(),
      onInstalled: new FakeEvent(),
      openOptionsPage: vi.fn(),
    },
    bookmarks: { create: vi.fn(async () => ({ id: 'bm1' })), search: vi.fn(async () => []) },
    alarms: { create: vi.fn(), onAlarm: new FakeEvent() },
  };
}

export function resetChromeMock() {
  mockStorage.reset();
  mockSessionStorage.reset();
  tabsOnCreated.reset();
  tabsOnUpdated.reset();
  tabsOnActivated.reset();
  tabsOnRemoved.reset();
}
