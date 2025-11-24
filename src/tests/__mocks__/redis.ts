// Mock Redis client for testing
export class Redis {
  private data: Map<string, string> = new Map();

  async ping(): Promise<string> {
    return "PONG";
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string): Promise<string> {
    this.data.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async quit(): Promise<string> {
    this.data.clear();
    return "OK";
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace("*", ".*"));
    return Array.from(this.data.keys()).filter((key) => regex.test(key));
  }
}

