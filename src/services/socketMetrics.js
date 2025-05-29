class SocketMetrics {
  constructor() {
    this.metrics = {
      connections: {
        total: 0,
        successful: 0,
        failed: 0
      },
      events: {
        sent: new Map(),
        received: new Map()
      },
      errors: new Map(),
      performance: {
        avgLatency: 0,
        measurements: []
      }
    };
  }

  recordConnection(success = true) {
    this.metrics.connections.total++;
    if (success) {
      this.metrics.connections.successful++;
    } else {
      this.metrics.connections.failed++;
    }
  }

  recordEvent(event, direction = 'received') {
    const map = direction === 'sent' ? this.metrics.events.sent : this.metrics.events.received;

    const count = map.get(event) || 0;
    map.set(event, count + 1);
  }

  recordError(error) {
    const errorType = error.code || error.name || 'UNKNOWN';
    const count = this.metrics.errors.get(errorType) || 0;
    this.metrics.errors.set(errorType, count + 1);
  }

  recordLatency(latency) {
    this.metrics.performance.measurements.push(latency);

    // Keep only last 1000 measurements
    if (this.metrics.performance.measurements.length > 1000) {
      this.metrics.performance.measurements.shift();
    }

    // Recalculate average
    const sum = this.metrics.performance.measurements.reduce((a, b) => a + b, 0);
    this.metrics.performance.avgLatency = sum / this.metrics.performance.measurements.length;
  }

  getMetrics() {
    return {
      connections: this.metrics.connections,
      events: {
        sent: Object.fromEntries(this.metrics.events.sent),
        received: Object.fromEntries(this.metrics.events.received)
      },
      errors: Object.fromEntries(this.metrics.errors),
      performance: {
        avgLatency: Math.round(this.metrics.performance.avgLatency),
        sampleSize: this.metrics.performance.measurements.length
      },
      timestamp: new Date()
    };
  }

  reset() {
    this.metrics.connections = { total: 0, successful: 0, failed: 0 };
    this.metrics.events.sent.clear();
    this.metrics.events.received.clear();
    this.metrics.errors.clear();
    this.metrics.performance.measurements = [];
    this.metrics.performance.avgLatency = 0;
  }
}

module.exports = new SocketMetrics();
