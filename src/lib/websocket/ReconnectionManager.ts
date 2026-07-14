export class ReconnectionManager {
  private attempts = 0;

  private reconnectTimer?: ReturnType<typeof setTimeout>;

  scheduleReconnect(callback: () => void) {
    this.clear();

    const delay = Math.min(
      1000 * Math.pow(2, this.attempts),
      10000,
    );

    this.reconnectTimer = setTimeout(() => {
      this.attempts++;
      callback();
    }, delay);
  }

  reset() {
    this.attempts = 0;
    this.clear();
  }

  private clear() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }
}