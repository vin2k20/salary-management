import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, type LoginRequest } from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api/errors.ts';
import { currentUserQueryKey, login, useCurrentUser } from '../auth/session.ts';
import { AuthCard } from '../components/auth-card.tsx';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';

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
  const serverError = errorMessage(signIn.error);

  return (
    <AuthCard title="Sign in">
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
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          error={errors.email}
          {...form.register('email')}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
          {...form.register('password')}
        />
        <Button type="submit" disabled={signIn.isPending}>
          {signIn.isPending ? 'Signing in...' : 'Sign in'}
        </Button>
        <Link to="/forgot-password" className="text-center text-sm underline">
          Forgot your password?
        </Link>
      </form>
    </AuthCard>
  );
}
