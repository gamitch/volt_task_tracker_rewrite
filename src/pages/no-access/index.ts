/**
 * T020: barrel export for the `/no-access` page component.
 *
 * `router.tsx` currently has NO route at all for `/no-access` -- not even an
 * inline placeholder (see `NoAccessPage.tsx`'s module doc, gap #1). Once a
 * task with `router.tsx` in its Allowed Files adds one, the expected import
 * is `import { NoAccessPage } from '../pages/no-access';`.
 */
export { NoAccessPage, default } from './NoAccessPage';
export type { NoAccessPageProps } from './NoAccessPage';
export type { LoadNoAccessDataFn, NoAccessData } from './types';
