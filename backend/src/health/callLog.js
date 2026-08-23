import { callEvents } from './callEvents.js';

// Subscribes the call-event stream to MongoDB persistence. Call once at
// startup with a connected db handle. Per SPEC.md §6: "API call log —
// source, timestamp, outcome, duration, attempt count. Feeds F11 and F14."
function startCallLogging(db) {
  const collection = db.collection('call_log');
  callEvents.on('call', (event) => {
    collection.insertOne(event).catch((err) => {
      // Logging must never take down a live request — worst case, one
      // health/reliability data point is lost.
      console.error('call_log write failed:', err.message);
    });
  });
}

export { startCallLogging };
