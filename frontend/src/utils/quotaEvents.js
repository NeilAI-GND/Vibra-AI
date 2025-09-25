// Simple event system for quota updates
class QuotaEventEmitter {
  constructor() {
    this.listeners = [];
  }

  // Add a listener for quota updates
  addListener(callback) {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Emit quota update event
  emit() {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in quota event listener:', error);
      }
    });
  }
}

// Create singleton instance
const quotaEvents = new QuotaEventEmitter();

export default quotaEvents;