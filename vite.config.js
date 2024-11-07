import { defineConfig } from 'vite';

export default defineConfig({
    base: '/snn/', // Make sure this matches your repository name
    resolve: {
        alias: {
            '@': '/src'
        },
        extensions: ['.js', '.jsx', '.ts', '.tsx'] // Add file extensions to try
    },
    optimizeDeps: {
        include: ['three', '@three.ez/main']
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
    build: {
        target: 'esnext',
        minify: 'terser',
        sourcemap: true,
        chunkSizeWarningLimit: 1000,
        outDir: 'dist', // Explicitly set output directory
        assetsDir: 'assets', // Where to place assets
        emptyOutDir: true, // Clean the output directory before build
        rollupOptions: {
            input: {
                main: './index.html'  // Add this line to specify entry point
            },
            output: {
                manualChunks: {
                    three: ['three'],
                    vendor: ['@three.ez/main']
                },
                // Add better file naming for cache management
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]'
            }
        }
    },
    // Add public path handling
    publicDir: 'public',
    // Add asset handling
    assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr', '**/*.env'],
    // Add CSS handling
    css: {
        devSourcemap: true,
        modules: {
            scopeBehavior: 'local'
        }
    }
});