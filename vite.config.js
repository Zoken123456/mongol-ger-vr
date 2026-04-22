import { defineConfig } from 'vite';

// Ямар ч хост доор (GitHub Pages subpath эсвэл үндэс домэйн) ажиллах —
// relative path үүсгэнэ.
export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        assetsInlineLimit: 0, // .glb зэрэг том файлуудыг inline хийхгүй
    },
    assetsInclude: ['**/*.glb'],
});
