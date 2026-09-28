import { render } from 'preact';
import en from './i18n/en.json';

function App() {
  return <h1>{en.app.name}</h1>;
}

const root = document.getElementById('app');
if (root) {
  document.title = en.app.name;
  render(<App />, root);
}
