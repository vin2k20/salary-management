import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { errorMessage } from '../api/errors.ts';
import { useCurrentUser } from '../auth/session.ts';
import { Card, CardContent } from '../components/ui/card.tsx';
import { EmployeeForm } from '../employees/EmployeeForm.tsx';
import { createEmployee, employeeSaved } from '../employees/api.ts';

/** Adds an employee in the user's scope (HLD 3.1). Starting pay is recorded on the record. */
export function NewEmployeePage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const add = useMutation({
    mutationFn: createEmployee,
    onSuccess: async (employee) => {
      await employeeSaved(queryClient, employee);
      await navigate(`/employees/${employee.id}`);
    },
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">Add an employee</h1>
      <Card className="mt-6">
        <CardContent className="pt-6">
          <EmployeeForm
            fixedCountry={user?.countryCode}
            submitLabel="Add employee"
            pending={add.isPending}
            serverError={errorMessage(add.error)}
            cancelTo="/employees"
            onSubmit={(values) => {
              add.mutate(values);
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
