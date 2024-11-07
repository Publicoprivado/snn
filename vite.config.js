import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: '/snn/', // Make sure this matches your repository name
    resolve: {
        alias: {
            '@': '/src'
        },
        extensions: ['.js', '.jsx', '.ts', '.tsx']
    },
    optimizeDeps: {
        include: ['three', '@three.ez/main', 'tone'] // Added tone
    },
    build: {
        target: 'esnext',
        minify: 'terser',
        sourcemap: true,
        chunkSizeWarningLimit: 1000,
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            },
            output: {
                manualChunks: {
                    three: ['three', 'three/examples/jsm/libs/stats.module', 'three/examples/jsm/libs/lil-gui.module.min'],
                    tone: ['tone'],
                    vendor: ['@three.ez/main']
                },
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]'
            }
        }
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        open: true,
        https: false,
        cors: true,
        hmr: {
            overlay: true
        },
        watch: {
            usePolling: true
        }
    },
    preview: {
        host: '0.0.0.0',
        port: 4173
    },
    publicDir: 'public',
    assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr', '**/*.env'],
    css: {
        devSourcemap: true,
        modules: {
            scopeBehavior: 'local'
        }
    }
});