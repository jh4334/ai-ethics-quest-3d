import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Three.js를 별도 벤더 청크로 분리 — 게임 코드만 바뀌는 재배포에서
        // 학생이 Three.js를 다시 받지 않는다(PWA 캐시 우선 전략과 맞물려 재방문 로드 개선).
        // Rolldown은 manualChunks가 함수 형태만 허용한다.
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three';
          }
          return undefined;
        }
      }
    }
  }
});
