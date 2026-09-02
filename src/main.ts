import '@/ui/styles.css';
import { App } from '@/app/App';

App.boot().then((app) => { (window as unknown as { app: App }).app = app; }).catch((e) => {
  console.error(e);
  const el = document.querySelector('.loading-text');
  if (el) el.textContent = 'Failed to load: ' + (e as Error).message;
});
