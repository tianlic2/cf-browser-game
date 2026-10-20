import './styles.css';
import { App } from './App';

const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
if (!canvas) throw new Error('Missing #scene-canvas');

try {
  const app = new App(canvas);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => app.dispose());
  }
} catch (err) {
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  const loading = document.querySelector('#loading');
  if (loading) loading.innerHTML = `<div class="load-cn">無法生成</div><div class="load-sub">${msg}</div>`;
}
