/**
 * A production-shaped build that links DEVELOPMENT React.
 *
 * `plan5-keys.js` needs this and nothing else does. React's duplicate-key
 * message ("Encountered two children with the same key") only exists in the
 * development build; Vite hardcodes `process.env.NODE_ENV = "production"` for
 * `vite build` regardless of `--mode`, so the shipped bundle strips it and a
 * console sweep over the real bundle sees an empty console whether or not the
 * defect is present. That is a check that cannot fail — this config exists so
 * it can.
 *
 * Everything else is inherited from the real vite.config.js so the bundle under
 * test is the same code, not a variant.
 *
 * Usage (from the repo root):
 *   npx vite build --config _harness/vite.devreact.js --outDir _harness/devdist --emptyOutDir
 */
import base from '../vite.config.js';

export default {
  ...base,
  define: { ...(base.define || {}), 'process.env.NODE_ENV': '"development"' },
  // Unminified so a stack in the console is legible when a check does fail.
  build: { ...(base.build || {}), minify: false },
};
