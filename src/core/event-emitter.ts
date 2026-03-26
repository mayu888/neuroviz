type EventHandler<T = unknown> = (event: T) => void;

export class EventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  on<T>(event: string, handler: EventHandler<T>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler as EventHandler);
    return this;
  }

  off<T>(event: string, handler: EventHandler<T>): this {
    const handlers = this.listeners.get(event);
    if (!handlers) return this;
    this.listeners.set(event, handlers.filter((h) => h !== handler));
    return this;
  }

  emit<T>(event: string, data?: T): this {
    this.listeners.get(event)?.forEach((h) => h(data));
    return this;
  }

  once<T>(event: string, handler: EventHandler<T>): this {
    const wrapper: EventHandler<T> = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}
