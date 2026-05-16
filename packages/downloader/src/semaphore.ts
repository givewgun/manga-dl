export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (limit < 1) throw new Error("Semaphore limit must be at least 1");
  }

  async acquire(): Promise<() => void> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.waiters.shift()?.();
    };
  }
}
