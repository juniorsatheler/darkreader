// @ts-check
import http from 'http';
import path from 'path';
import url from 'url';

const mimeTypes = new Map(
    Object.entries({
        '.css': 'text/css',
        '.html': 'text/html',
        '.jpg': 'image/jpeg',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
    }),
);

export async function createTestServer(/** @type {number} */port) {
    /** @type {import('http').Server} */
    let server;
    /** @type {{[path: string]: string | import('http').RequestListener}} */
    const paths = {};
    /** @type {Set<import('net').Socket>} */
    const sockets = new Set();

    /** @type {import('http').RequestListener} */
    function handleRequest(req, res) {
        const parsedURL = url.parse(req.url);
        const pathName = parsedURL.pathname;

        if (!paths.hasOwnProperty(pathName)) {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }

        const contentOrListener = paths[pathName];

        if (typeof contentOrListener === 'function') {
            const listener = contentOrListener;
            return listener(req, res);
        }

        const content = contentOrListener;
        const ext = pathName === '/' ? '.html' : path.extname(pathName);
        const contentType = mimeTypes.get(ext) || 'text/plain';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.end(content, 'utf8');
    }

    /**
     * @returns {Promise<void>}
     */
    function start() {
        return new Promise((resolve) => {
            server = http
                .createServer(handleRequest)
                .listen(port, () => resolve());

            server.on('connection', (socket) => {
                sockets.add(socket);
                socket.on('close', () => sockets.delete(socket));
            });
        });
    }

    /**
     * @param {{[path: string]: string | import('http').RequestListener}} newPaths
     */
    function setPaths(newPaths) {
        Object.assign(paths, newPaths);
    }

    /**
     * @returns {Promise<void>}
     */
    function close() {
        if (!server) {
            return;
        }
        return new Promise((resolve) => {
            server.close((err) => {
                if (err) {
                    console.error(err);
                }
                server = null;
                resolve();
            });
            sockets.forEach((socket) => {
                socket.destroy();
            });
        });
    }

    process.on('exit', close);
    process.on('SIGINT', close);

    await start();

    return {
        setPaths,
        close,
        url: `http://localhost:${port}`,
    };
}
