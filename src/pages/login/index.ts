/**
 * T016: barrel export for the `/login` page component.
 *
 * `router.tsx` currently wires `/login` to its own inline placeholder
 * (see `LoginPage.tsx`'s module doc, gap #1). Once a task with
 * `router.tsx` in its Allowed Files does that wiring, the expected import
 * is `import { LoginPage } from '../pages/login';`.
 */
export { LoginPage, default } from './LoginPage';
