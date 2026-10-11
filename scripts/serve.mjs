import { createReadStream, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const publicRoot = realpathSync(fileURLToPath(new URL('../public/', import.meta.url)));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export function createStaticServer() {
  return createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    let filePath = resolve(publicRoot, relativePath);
    if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      filePath = realpathSync(filePath);
      if (!filePath.startsWith(`${publicRoot}${sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      if (!statSync(filePath).isFile()) throw new Error('Not a file');
    } catch {
      response.writeHead(404).end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).on('error', () => response.destroy()).pipe(response);
  });
}

export async function startStaticServer({ host = '127.0.0.1', port = 8123, server = createStaticServer() } = {}) {
  await new Promise((resolveListen, rejectListen) => {
    const onError = error => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
  return server;
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
}

const entryPath = process.argv[1];
if (entryPath && pathToFileURL(resolve(entryPath)).href === import.meta.url) {
  const host = readOption(process.argv.slice(2), '--host', '0.0.0.0');
  const port = Number(readOption(process.argv.slice(2), '--port', '8123'));
  const server = await startStaticServer({ host, port });
  const browserHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  const urlHost = browserHost.includes(':') ? `[${browserHost}]` : browserHost;
  console.log(`Serving ${publicRoot} at http://${urlHost}:${server.address().port}/ (listening on ${host})`);
  server.on('error', error => {
    console.error(error);
    process.exitCode = 1;
  });
}
