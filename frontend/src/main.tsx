import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // ВАЖНО: без этого стили не загрузятся

const container = document.getElementById('root')!;
const root = createRoot(container);

// В dev отключаем StrictMode (чтобы не было двойного монтирования и лишнего закрытия WS)
// В production оставляем StrictMode
if (import.meta.env.DEV) {
  root.render(<App />);
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
