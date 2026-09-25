import type { RouteObject } from 'react-router';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { RequireRole } from './auth/RequireRole.tsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { EditEmployeePage } from './pages/EditEmployeePage.tsx';
import { EmployeePage } from './pages/EmployeePage.tsx';
import { EmployeesPage } from './pages/EmployeesPage.tsx';
import { ImportPage } from './pages/ImportPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NewEmployeePage } from './pages/NewEmployeePage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { PayComponentsPage } from './pages/PayComponentsPage.tsx';
import { SetPasswordPage } from './pages/SetPasswordPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/set-password', element: <SetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'employees/new', element: <NewEmployeePage /> },
      { path: 'employees/:id', element: <EmployeePage /> },
      { path: 'employees/:id/edit', element: <EditEmployeePage /> },
      { path: 'pay-components', element: <PayComponentsPage /> },
      { path: 'import', element: <ImportPage /> },
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
