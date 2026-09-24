import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx';

/** Centred card used by the sign-in, forgot password and set password pages. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>ACME Salary Management</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
