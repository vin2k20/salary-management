import { COUNTRIES, type UpdateEmployeeRequest } from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Button, ButtonLink } from '../components/ui/button.tsx';
import { Card, CardContent } from '../components/ui/card.tsx';
import { CurrentPay } from '../employees/CurrentPay.tsx';
import { EmployeeChangeLog } from '../employees/EmployeeChangeLog.tsx';
import { EmployeeDetails } from '../employees/EmployeeDetails.tsx';
import { MarkInactivePanel } from '../employees/MarkInactivePanel.tsx';
import { PayChangeDialog } from '../employees/PayChangeDialog.tsx';
import { PayHistory } from '../employees/PayHistory.tsx';
import { PaySummary } from '../employees/PaySummary.tsx';
import { employeeSaved, payChanged, updateEmployee, useEmployee } from '../employees/api.ts';

type OpenDialog = 'none' | 'pay-change';

/** One employee's record: details, pay, actions and history (HLD 3.1). */
export function EmployeePage() {
  const { id = '' } = useParams();
  const employee = useEmployee(id);
  const data = employee.data?.employee;
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<OpenDialog>('none');
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const setStatus = useMutation({
    mutationFn: (change: UpdateEmployeeRequest) => updateEmployee(id, change),
    onSuccess: async (updated) => {
      setConfirming(false);
      const name = `${updated.firstName} ${updated.lastName}`;
      setNotice(
        updated.status === 'inactive' ? `${name} was marked inactive.` : `${name} is active again.`,
      );
      await employeeSaved(queryClient, updated);
    },
  });

  return (
    <>
      <ButtonLink to="/employees" variant="ghost" size="sm" className="-ml-3">
        Back to employees
      </ButtonLink>
      {employee.isPending && (
        <p className="mt-6 text-sm text-muted-foreground">Loading employee...</p>
      )}
      {employee.isError && <Alert className="mt-6">{errorMessage(employee.error)}</Alert>}
      {data && (
        <>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">
                  {data.firstName} {data.lastName}
                </h1>
                {data.status === 'inactive' && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Inactive
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.jobTitle}, {data.department}
              </p>
              {employee.data && (
                <div className="mt-4">
                  <PaySummary totals={employee.data.payTotals} />
                </div>
              )}
            </div>
            {!confirming && (
              <div className="flex flex-wrap gap-2">
                <ButtonLink to={`/employees/${data.id}/edit`} variant="secondary">
                  Edit
                </ButtonLink>
                {data.status === 'active' ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStatus.reset();
                      setNotice(null);
                      setConfirming(true);
                    }}
                  >
                    Mark inactive
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={setStatus.isPending}
                    onClick={() => {
                      setStatus.mutate({ status: 'active' });
                    }}
                  >
                    Mark active
                  </Button>
                )}
              </div>
            )}
          </div>

          {notice && (
            <p role="status" className="mt-4 rounded-md border px-4 py-3 text-sm">
              {notice}
            </p>
          )}
          {!confirming && setStatus.isError && (
            <Alert className="mt-4">{errorMessage(setStatus.error)}</Alert>
          )}
          {confirming && (
            <MarkInactivePanel
              name={`${data.firstName} ${data.lastName}`}
              hireDate={data.hireDate}
              pending={setStatus.isPending}
              error={errorMessage(setStatus.error)}
              onConfirm={(inactiveOn) => {
                setStatus.mutate({ status: 'inactive', inactiveOn });
              }}
              onCancel={() => {
                setConfirming(false);
              }}
            />
          )}

          <Card className="mt-6">
            <CardContent className="pt-6">
              <CurrentPay
                employeeId={data.id}
                action={
                  data.status === 'active' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setNotice(null);
                        setDialog('pay-change');
                      }}
                    >
                      Record pay change
                    </Button>
                  )
                }
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardContent className="pt-6">
              <PayHistory employeeId={data.id} />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardContent className="pt-6">
              <section aria-labelledby="details-heading">
                <h2 id="details-heading" className="mb-4 text-lg font-medium">
                  Details
                </h2>
                <EmployeeDetails employee={data} />
              </section>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardContent className="pt-6">
              <section aria-labelledby="change-log-heading">
                <h2 id="change-log-heading" className="mb-4 text-lg font-medium">
                  Change log
                </h2>
                <EmployeeChangeLog employeeId={data.id} />
              </section>
            </CardContent>
          </Card>

          {dialog === 'pay-change' && (
            <PayChangeDialog
              open
              onOpenChange={(open) => {
                if (!open) setDialog('none');
              }}
              employeeId={data.id}
              countryCode={data.countryCode}
              currency={COUNTRIES[data.countryCode].currencyCode}
              onSaved={() => {
                setDialog('none');
                setNotice('Pay change saved.');
                void payChanged(queryClient, data.id);
              }}
            />
          )}
        </>
      )}
    </>
  );
}
