import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000';

    return {
        root: '.',
        publicDir: 'public',
        build: {
            outDir: 'dist',
            rollupOptions: {
                input: resolve(__dirname, 'index.html'),
            },
        },
        server: {
            port: 5173,
            open: true,
            proxy: {
                '/api': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
