import { EventEmitter } from 'node:events';

// A single shared emitter that source clients report every live call to,
// and that the health/call-log subsystem listens on. This keeps the source
// clients decoupled from MongoDB — they don't need a db handle just to be
// observable.
const callEvents = new EventEmitter();

function reportCall({ source, outcome, durationMs, attempts }) {
  callEvents.emit('call', { source, outcome, durationMs, attempts, timestamp: new Date() });
}

export { callEvents, reportCall };
