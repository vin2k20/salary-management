import type { CreateEmployeeRequest } from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Card, CardContent } from '../components/ui/card.tsx';
import { EmployeeForm } from '../employees/EmployeeForm.tsx';
import { employeeSaved, updateEmployee, useEmployee } from '../employees/api.ts';

/** Edits an employee's details. The code and country stay as they are. */
export function EditEmployeePage() {
  const { id = '' } = useParams();
  const employee = useEmployee(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const save = useMutation({
    mutationFn: ({
      employeeCode: _code,
      countryCode: _country,
      startingPay: _startingPay,
      ...details
    }: CreateEmployeeRequest) => updateEmployee(id, details),
    onSuccess: async (updated) => {
      await employeeSaved(queryClient, updated);
      await navigate(`/employees/${id}`);
    },
  });
  const data = employee.data?.employee;

  return (
    <>
      {employee.isPending && <p className="text-sm text-muted-foreground">Loading employee...</p>}
      {employee.isError && <Alert>{errorMessage(employee.error)}</Alert>}
      {data && (
        <>
          <h1 className="text-2xl font-semibold">
            Edit {data.firstName} {data.lastName}
          </h1>
          <Card className="mt-6">
            <CardContent className="pt-6">
              <EmployeeForm
                key={data.id}
                initial={{ ...data, jobLevel: data.jobLevel ?? '' }}
                submitLabel="Save changes"
                pending={save.isPending}
                serverError={errorMessage(save.error)}
                cancelTo={`/employees/${data.id}`}
                onSubmit={(values) => {
                  save.mutate(values);
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
