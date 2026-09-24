import type { RouteObject } from 'react-router';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { RequireRole } from './auth/RequireRole.tsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { SetPasswordPage } from './pages/SetPasswordPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/set-password', element: <SetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'users',
        element: (
          <RequireRole role="global_hr">
            <UsersPage />
          </RequireRole>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
