import { useParams } from 'react-router';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { ButtonLink } from '../components/ui/button.tsx';
import { Card, CardContent } from '../components/ui/card.tsx';
import { EmployeeDetails } from '../employees/EmployeeDetails.tsx';
import { useEmployee } from '../employees/api.ts';

/** One employee's record: details, actions and history (HLD 3.1). */
export function EmployeePage() {
  const { id = '' } = useParams();
  const employee = useEmployee(id);
  const data = employee.data;

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
            </div>
            <div className="flex gap-2">
              <ButtonLink to={`/employees/${data.id}/edit`} variant="secondary">
                Edit
              </ButtonLink>
            </div>
          </div>

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
        </>
      )}
    </>
  );
}
