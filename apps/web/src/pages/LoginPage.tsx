import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, type LoginRequest } from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError } from '../api/client.ts';
import { currentUserQueryKey, login, useCurrentUser } from '../auth/session.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';

function returnPath(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    if (typeof state.from === 'string' && state.from.startsWith('/')) return state.from;
  }
  return '/';
}

export function LoginPage() {
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const target = returnPath(location.state);

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });
  const signIn = useMutation({
    mutationFn: login,
    onSuccess: async (user) => {
      queryClient.setQueryData(currentUserQueryKey, user);
      await navigate(target, { replace: true });
    },
  });

  if (currentUser.isPending) return null;
  if (currentUser.data) return <Navigate to={target} replace />;

  const { errors } = form.formState;
  const serverError =
    signIn.error instanceof ApiError
      ? signIn.error.message
      : signIn.error
        ? 'Something went wrong. Try again.'
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>ACME Salary Management</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              void form.handleSubmit((values) => {
                signIn.mutate(values);
              })(event);
            }}
          >
            {serverError && <Alert>{serverError}</Alert>}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...form.register('email')}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...form.register('password')}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={signIn.isPending}>
              {signIn.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
