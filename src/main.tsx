import { render } from 'preact';
import { App } from './app/App.tsx';
import { loadPdfAssets } from './forms/ct-dob-security-deposit/assets.ts';
import en from './i18n/en.json' with { type: 'json' };
import './styles/tokens.css';
import './styles/base.css';

// §5: in dev builds, verify the template hash at app start (the loader checks it).
if (import.meta.env.DEV) {
  loadPdfAssets().catch((error: unknown) => console.error(error));
}

const root = document.getElementById('app');
if (root) {
  document.title = en.app.name;
  render(<App />, root);
}
