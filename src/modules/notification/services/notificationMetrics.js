class NotificationMetrics {
  constructor() {
    this.reset();
  }

  increment(metric, channel = null) {
    switch (metric) {
      case 'created':
        this.metrics.created += 1;
        return;
      case 'read':
        this.metrics.read += 1;
        return;
      case 'delivered':
        this.incrementChannelMetric(this.metrics.delivered, channel);
        return;
      case 'failed':
        this.incrementChannelMetric(this.metrics.failed, channel);
        return;
      default:
        throw new Error(`Unsupported metric: ${metric}`);
    }
  }

  incrementChannelMetric(target, channel) {
    if (!channel) {
      throw new Error('Channel is required for delivered/failed metrics');
    }

    switch (channel) {
      case 'inApp':
        target.inApp += 1;
        break;
      case 'push':
        target.push += 1;
        break;
      case 'email':
        target.email += 1;
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date()
    };
  }

  reset() {
    this.metrics = {
      created: 0,
      delivered: {
        inApp: 0,
        push: 0,
        email: 0
      },
      failed: {
        inApp: 0,
        push: 0,
        email: 0
      },
      read: 0
    };
  }
}

module.exports = new NotificationMetrics();
