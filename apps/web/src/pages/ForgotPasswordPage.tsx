import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@salary/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { errorMessage } from '../api/errors.ts';
import { requestPasswordReset } from '../auth/session.ts';
import { AuthCard } from '../components/auth-card.tsx';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';

export function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });
  const request = useMutation({ mutationFn: requestPasswordReset });
  const serverError = errorMessage(request.error);

  return (
    <AuthCard title="Reset your password">
      {request.isSuccess ? (
        <div className="flex flex-col gap-4 text-sm">
          <p role="status">
            If an account uses that email, we have sent a link to choose a new password. The link
            works for 30 minutes.
          </p>
          <Link to="/login" className="underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              request.mutate(values);
            })(event);
          }}
        >
          <p className="text-sm text-muted-foreground">
            Enter the email you sign in with, and we will send you a link to choose a new password.
          </p>
          {serverError && <Alert>{serverError}</Alert>}
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            error={form.formState.errors.email}
            {...form.register('email')}
          />
          <Button type="submit" disabled={request.isPending}>
            {request.isPending ? 'Sending...' : 'Send link'}
          </Button>
          <Link to="/login" className="text-center text-sm underline">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
