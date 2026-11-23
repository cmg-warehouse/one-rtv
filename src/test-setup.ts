import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { setLang } from './i18n';

// The suite finds elements by their Thai text; the app itself starts in English.
setLang('th');
beforeEach(() => setLang('th'));

// findBy*/waitFor default to 1 s, which the full parallel suite overruns on a busy machine.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
