import { COUNTRIES, type UserStatus, type UserSummary } from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../api/errors.ts';
import { useCurrentUser } from '../auth/session.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardContent } from '../components/ui/card.tsx';
import { cn } from '../lib/cn.ts';
import { formatDate } from '../lib/format.ts';
import { ROLE_LABELS, UserForm, type UserFormValues } from '../users/UserForm.tsx';
import { createUser, resendInvite, updateUser, usersQueryKey, useUsers } from '../users/api.ts';

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  inactive: 'Inactive',
};

const STATUS_STYLES: Record<UserStatus, string> = {
  active: 'bg-secondary text-secondary-foreground',
  invited: 'border border-border text-muted-foreground',
  inactive: 'bg-muted text-muted-foreground line-through',
};

function formatLastSignIn(value: string | null): string {
  return value === null ? 'Never' : formatDate(value);
}

type Panel = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; user: UserSummary };

/** Global HR users add, edit, invite and deactivate HR users (HLD 3.1). */
export function UsersPage() {
  const users = useUsers();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>({ kind: 'closed' });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: usersQueryKey });

  const add = useMutation({
    mutationFn: createUser,
    onSuccess: async ({ user, inviteSent }) => {
      setPanel({ kind: 'closed' });
      setNotice(
        inviteSent
          ? `${user.name} was added and an invite was sent to ${user.email}.`
          : `${user.name} was added, but the invite email could not be sent. Use Resend invite to try again.`,
      );
      await refresh();
    },
  });
  const edit = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UserFormValues }) =>
      updateUser(id, { name: values.name, role: values.role, countryCode: values.countryCode }),
    onSuccess: async (user) => {
      setPanel({ kind: 'closed' });
      setNotice(`${user.name} was updated.`);
      await refresh();
    },
  });
  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUser(id, { isActive }),
    onSuccess: async (user) => {
      setConfirmingId(null);
      setNotice(
        user.status === 'inactive'
          ? `${user.name} was deactivated and signed out.`
          : `${user.name} can sign in again.`,
      );
      await refresh();
    },
  });
  const invite = useMutation({
    mutationFn: (user: UserSummary) => resendInvite(user.id),
    onSuccess: (_result, user) => {
      setNotice(`A new invite was sent to ${user.email}.`);
    },
  });
  const actionError = errorMessage(setActive.error ?? invite.error);

  function open(next: Panel) {
    add.reset();
    edit.reset();
    setNotice(null);
    setPanel(next);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        {panel.kind === 'closed' && (
          <Button
            onClick={() => {
              open({ kind: 'add' });
            }}
          >
            Add user
          </Button>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-md border px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {actionError && <Alert className="mt-4">{actionError}</Alert>}

      {panel.kind !== 'closed' && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-medium">
              {panel.kind === 'add' ? 'Add a user' : `Edit ${panel.user.name}`}
            </h2>
            {panel.kind === 'add' ? (
              <UserForm
                submitLabel="Add and send invite"
                pending={add.isPending}
                serverError={errorMessage(add.error)}
                onSubmit={(values) => {
                  add.mutate(values);
                }}
                onCancel={() => {
                  setPanel({ kind: 'closed' });
                }}
              />
            ) : (
              <UserForm
                key={panel.user.id}
                initial={{
                  name: panel.user.name,
                  email: panel.user.email,
                  role: panel.user.role,
                  countryCode: panel.user.countryCode,
                }}
                submitLabel="Save changes"
                pending={edit.isPending}
                serverError={errorMessage(edit.error)}
                onSubmit={(values) => {
                  edit.mutate({ id: panel.user.id, values });
                }}
                onCancel={() => {
                  setPanel({ kind: 'closed' });
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {users.isPending && <p className="mt-6 text-sm text-muted-foreground">Loading users...</p>}
      {users.isError && <Alert className="mt-6">{errorMessage(users.error)}</Alert>}
      {users.data && (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Name
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Role
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Country
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Last sign-in
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-4 py-2">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-2">
                    {user.countryCode ? COUNTRIES[user.countryCode].name : 'All countries'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_STYLES[user.status])}
                    >
                      {STATUS_LABELS[user.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2">{formatLastSignIn(user.lastLoginAt)}</td>
                  <td className="px-4 py-2">
                    {user.id !== currentUser?.id && (
                      <div className="flex justify-end gap-2">
                        {confirmingId === user.id ? (
                          <>
                            <Button
                              size="sm"
                              disabled={setActive.isPending}
                              onClick={() => {
                                setActive.mutate({ id: user.id, isActive: false });
                              }}
                            >
                              Confirm deactivate
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setConfirmingId(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                open({ kind: 'edit', user });
                              }}
                            >
                              Edit
                            </Button>
                            {user.status === 'invited' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={invite.isPending}
                                onClick={() => {
                                  invite.mutate(user);
                                }}
                              >
                                Resend invite
                              </Button>
                            )}
                            {user.status === 'inactive' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={setActive.isPending}
                                onClick={() => {
                                  setActive.mutate({ id: user.id, isActive: true });
                                }}
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setConfirmingId(user.id);
                                }}
                              >
                                Deactivate
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
