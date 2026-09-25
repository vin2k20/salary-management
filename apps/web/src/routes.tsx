import { Outlet, type RouteObject } from 'react-router';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { RequireRole } from './auth/RequireRole.tsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { SetPasswordPage } from './pages/SetPasswordPage.tsx';

/**
 * Routes. The sign-in pages are in the main bundle, so the first screen appears at once; each
 * signed-in page is loaded the first time it is opened, so charts and spreadsheet code are only
 * fetched by the pages that use them.
 */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/set-password', element: <SetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('./pages/DashboardPage.tsx')).DashboardPage,
        }),
      },
      {
        path: 'employees',
        lazy: async () => ({
          Component: (await import('./pages/EmployeesPage.tsx')).EmployeesPage,
        }),
      },
      {
        path: 'employees/new',
        lazy: async () => ({
          Component: (await import('./pages/NewEmployeePage.tsx')).NewEmployeePage,
        }),
      },
      {
        path: 'employees/:id',
        lazy: async () => ({
          Component: (await import('./pages/EmployeePage.tsx')).EmployeePage,
        }),
      },
      {
        path: 'employees/:id/edit',
        lazy: async () => ({
          Component: (await import('./pages/EditEmployeePage.tsx')).EditEmployeePage,
        }),
      },
      {
        path: 'pay-components',
        lazy: async () => ({
          Component: (await import('./pages/PayComponentsPage.tsx')).PayComponentsPage,
        }),
      },
      {
        path: 'import',
        lazy: async () => ({
          Component: (await import('./pages/ImportPage.tsx')).ImportPage,
        }),
      },
      {
        element: (
          <RequireRole role="global_hr">
            <Outlet />
          </RequireRole>
        ),
        children: [
          {
            path: 'users',
            lazy: async () => ({
              Component: (await import('./pages/UsersPage.tsx')).UsersPage,
            }),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
