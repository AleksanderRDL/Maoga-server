class NotificationMetrics {
  constructor() {
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

  increment(metric, channel = null) {
    if (channel) {
      this.metrics[metric][channel]++;
    } else {
      this.metrics[metric]++;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date()
    };
  }

  reset() {
    Object.keys(this.metrics).forEach((key) => {
      if (typeof this.metrics[key] === 'object') {
        Object.keys(this.metrics[key]).forEach((subKey) => {
          this.metrics[key][subKey] = 0;
        });
      } else {
        this.metrics[key] = 0;
      }
    });
  }
}

module.exports = new NotificationMetrics();
