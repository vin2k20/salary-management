import { zodResolver } from '@hookform/resolvers/zod';
import { newPasswordSchema } from '@salary/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { errorMessage } from '../api/errors.ts';
import { setPassword } from '../auth/session.ts';
import { AuthCard } from '../components/auth-card.tsx';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';

const formSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match',
  });

type FormValues = z.infer<typeof formSchema>;

/** Opened from a reset or invite link: /set-password?token=... */
export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const save = useMutation({ mutationFn: setPassword });
  const serverError = errorMessage(save.error);
  const newLink = (
    <Link to="/forgot-password" className="text-sm underline">
      Ask for a new link
    </Link>
  );

  if (!token) {
    return (
      <AuthCard title="Choose a password">
        <div className="flex flex-col gap-4 text-sm">
          <p>
            This link is missing its token. Open the link from the email again, or ask for a new
            one.
          </p>
          {newLink}
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a password">
      {save.isSuccess ? (
        <div className="flex flex-col gap-4 text-sm">
          <p role="status">Your password is set.</p>
          <Link to="/login" className="underline">
            Sign in
          </Link>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(({ password }) => {
              save.mutate({ token, password });
            })(event);
          }}
        >
          {serverError && (
            <div className="flex flex-col gap-2">
              <Alert>{serverError}</Alert>
              {newLink}
            </div>
          )}
          <TextField
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.password}
            {...form.register('password')}
          />
          <TextField
            id="confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.confirmPassword}
            {...form.register('confirmPassword')}
          />
          <p className="text-sm text-muted-foreground">Use at least 12 characters.</p>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Set password'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
