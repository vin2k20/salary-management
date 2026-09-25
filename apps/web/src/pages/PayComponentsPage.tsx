import {
  COUNTRIES,
  type CreatePayComponentRequest,
  type CurrentUser,
  type PayComponent,
} from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../api/errors.ts';
import { useCurrentUser } from '../auth/session.ts';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardContent } from '../components/ui/card.tsx';
import { frequencyLabel } from '../employees/labels.ts';
import { cn } from '../lib/cn.ts';
import { PayComponentForm } from '../pay-components/PayComponentForm.tsx';
import {
  componentsChanged,
  createPayComponent,
  updatePayComponent,
  usePayComponentCatalogue,
} from '../pay-components/api.ts';
import { CATEGORY_LABELS } from '../pay-components/labels.ts';

type Panel = { kind: 'closed' } | { kind: 'add' } | { kind: 'rename'; component: PayComponent };

/** Global HR users change any component; country HR users only their own country's (HLD 3.3). */
function canChange(user: CurrentUser | null | undefined, component: PayComponent): boolean {
  if (!user) return false;
  return user.role === 'global_hr' || component.countryCode === user.countryCode;
}

function RenameForm({
  component,
  pending,
  serverError,
  onSave,
  onCancel,
}: {
  component: PayComponent;
  pending: boolean;
  serverError: string | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(component.name);
  const blank = name.trim() === '';
  return (
    <form
      noValidate
      className="flex flex-col gap-4 sm:max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blank) onSave(name);
      }}
    >
      {serverError && <Alert>{serverError}</Alert>}
      <TextField
        id="component-rename"
        label="Name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        error={blank ? { type: 'required', message: 'Enter a name' } : undefined}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || blank}>
          {pending ? 'Saving...' : 'Save name'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The pay component catalogue: every component in the user's scope, with forms to add and rename
 * components and actions to deactivate and reactivate them.
 */
export function PayComponentsPage() {
  const catalogue = usePayComponentCatalogue();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>({ kind: 'closed' });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: createPayComponent,
    onSuccess: async (component) => {
      setPanel({ kind: 'closed' });
      setNotice(`${component.name} was added.`);
      await componentsChanged(queryClient);
    },
  });
  const rename = useMutation({
    mutationFn: ({ component, name }: { component: PayComponent; name: string }) =>
      updatePayComponent(component.id, { name }),
    onSuccess: async (renamed, { component }) => {
      setPanel({ kind: 'closed' });
      setNotice(`${component.name} was renamed to ${renamed.name}.`);
      await componentsChanged(queryClient);
    },
  });
  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updatePayComponent(id, { isActive }),
    onSuccess: async (component) => {
      setConfirmingId(null);
      setNotice(
        component.isActive
          ? `${component.name} can be used again.`
          : `${component.name} was deactivated. It stays on current pay but cannot be used in new pay changes.`,
      );
      await componentsChanged(queryClient);
    },
  });

  function open(next: Panel) {
    add.reset();
    rename.reset();
    setNotice(null);
    setPanel(next);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pay components</h1>
        {panel.kind === 'closed' && (
          <Button
            onClick={() => {
              open({ kind: 'add' });
            }}
          >
            Add component
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        The parts that make up pay, such as basic pay, allowances and employer contributions.
      </p>

      {notice && (
        <p role="status" className="mt-4 rounded-md border px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {setActive.isError && <Alert className="mt-4">{errorMessage(setActive.error)}</Alert>}

      {panel.kind !== 'closed' && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-medium">
              {panel.kind === 'add' ? 'Add a pay component' : `Rename ${panel.component.name}`}
            </h2>
            {panel.kind === 'add' ? (
              <PayComponentForm
                fixedCountry={user?.countryCode ?? null}
                frequencies={catalogue.data?.frequencies ?? []}
                pending={add.isPending}
                serverError={errorMessage(add.error)}
                onSubmit={(values: CreatePayComponentRequest) => {
                  add.mutate(values);
                }}
                onCancel={() => {
                  setPanel({ kind: 'closed' });
                }}
              />
            ) : (
              <RenameForm
                key={panel.component.id}
                component={panel.component}
                pending={rename.isPending}
                serverError={errorMessage(rename.error)}
                onSave={(name) => {
                  rename.mutate({ component: panel.component, name });
                }}
                onCancel={() => {
                  setPanel({ kind: 'closed' });
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {catalogue.isPending && (
        <p className="mt-6 text-sm text-muted-foreground">Loading pay components...</p>
      )}
      {catalogue.isError && <Alert className="mt-6">{errorMessage(catalogue.error)}</Alert>}
      {catalogue.data && (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {['Component', 'Category', 'Country', 'Usual frequency', 'Status'].map(
                  (heading) => (
                    <th key={heading} scope="col" className="px-4 py-2 font-medium">
                      {heading}
                    </th>
                  ),
                )}
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {catalogue.data.items.map((component) => (
                <tr key={component.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{component.name}</div>
                    <div className="text-muted-foreground">{component.code}</div>
                  </td>
                  <td className="px-4 py-2">{CATEGORY_LABELS[component.category]}</td>
                  <td className="px-4 py-2">
                    {component.countryCode === null
                      ? 'All countries'
                      : COUNTRIES[component.countryCode].name}
                  </td>
                  <td className="px-4 py-2">{frequencyLabel(component.defaultFrequency)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        component.isActive
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-muted-foreground line-through',
                      )}
                    >
                      {component.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {canChange(user, component) && (
                      <div className="flex justify-end gap-2">
                        {confirmingId === component.id ? (
                          <>
                            <Button
                              size="sm"
                              disabled={setActive.isPending}
                              onClick={() => {
                                setActive.mutate({ id: component.id, isActive: false });
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
                                open({ kind: 'rename', component });
                              }}
                            >
                              Rename
                            </Button>
                            {component.isActive ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setNotice(null);
                                  setConfirmingId(component.id);
                                }}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={setActive.isPending}
                                onClick={() => {
                                  setActive.mutate({ id: component.id, isActive: true });
                                }}
                              >
                                Reactivate
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
