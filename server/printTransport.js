import net from 'node:net';
import { DEFAULT_SOCKET_TIMEOUT_MS } from './printWorkerConfig.js';

export class TcpPrintTransport {
  constructor({ timeoutMs = DEFAULT_SOCKET_TIMEOUT_MS } = {}) {
    this.timeoutMs = timeoutMs;
  }

  async sendRaw({ host, port, payload }) {
    if (!host || !port) {
      throw new Error('Missing printer host/port');
    }

    const data = Buffer.from(payload || '', 'ascii');

    await new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      socket.setTimeout(this.timeoutMs, () => {
        fail(new Error(`Print socket timeout after ${this.timeoutMs}ms`));
      });

      socket.once('error', fail);

      socket.connect(Number(port), host, () => {
        socket.write(data, (error) => {
          if (error) {
            fail(error);
            return;
          }

          socket.end(() => {
            if (settled) return;
            settled = true;
            resolve();
          });
        });
      });
    });
  }
}
