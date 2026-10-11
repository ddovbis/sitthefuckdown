import { startStaticServer } from './serve.mjs';

const host = '127.0.0.1';
const port = 8125;

export default async function globalSetup() {
  let server;
  try {
    server = await startStaticServer({ host, port });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      throw new Error(`Playwright preview cannot start: ${host}:${port} is already in use. Close that listener and retry.`, { cause: error });
    }
    throw error;
  }

  return async function globalTeardown() {
    await new Promise((resolveClose, rejectClose) => {
      server.close(error => error ? rejectClose(error) : resolveClose());
      server.closeAllConnections();
    });
  };
}
