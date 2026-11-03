import { EventEmitter } from 'events';
import { ServerEvent } from '../types/events';

class TypedEventBus extends EventEmitter {
  emitEvent(event: ServerEvent) {
    this.emit('server_event', event);
  }

  onEvent(listener: (event: ServerEvent) => void) {
    this.on('server_event', listener);
  }

  offEvent(listener: (event: ServerEvent) => void) {
    this.off('server_event', listener);
  }
}

export const eventBus = new TypedEventBus();
