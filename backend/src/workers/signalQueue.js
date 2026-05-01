// --- In-Memory Queue for Backpressure ---
// Signals go in → processed one batch at a time → databases never overwhelmed

const Signal = require('../models/Signal');
const { debounceSignal } = require('../services/debounceService');

class SignalQueue {
  constructor() {
    this.queue    = [];        // The waiting room (array of signals)
    this.isProcessing = false; // Are we currently draining?
    this.processed = 0;        // Total signals processed (for metrics)
    this.batchSize = 50;       // Process 50 at a time
  }

  // Add a signal to the waiting room
  enqueue(signalData) {
    this.queue.push(signalData);

    // Start processing if we're not already
    if (!this.isProcessing) {
      this.process();
    }
  }

  // Drain the queue in batches
  async process() {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      // Take the next batch
      const batch = this.queue.splice(0, this.batchSize);

      // Process all signals in this batch at the same time
      await Promise.all(batch.map(data => this.processOne(data)));

      this.processed += batch.length;

      // Small pause between batches — gives DB time to breathe
      if (this.queue.length > 0) {
        await this.sleep(10);
      }
    }

    this.isProcessing = false;
  }

  // Process a single signal
  async processOne(signalData) {
    try {
      // Step 1: Save raw signal to MongoDB (audit log)
      const signal = await Signal.create(signalData);

      // Step 2: Run debounce logic — group or create Work Item
      await debounceSignal(signal);

      // Step 3: Increment global throughput counter
      if (global.incrementSignalCount) {
        global.incrementSignalCount();
      }

    } catch (err) {
      console.error('Signal processing error:', err.message);
      // We log and continue — one bad signal doesn't stop the queue
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Stats for monitoring
  getStats() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      totalProcessed: this.processed,
    };
  }
}

// Export a single shared instance
// (all routes share the same queue)
module.exports = new SignalQueue();