CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"job_title" text NOT NULL,
	"job_level" text,
	"department" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"region" text NOT NULL,
	"employment_type" text NOT NULL,
	"fte" numeric(4, 3) DEFAULT 1 NOT NULL,
	"hire_date" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"inactive_on" date,
	"country_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_code_unique" UNIQUE("employee_code"),
	CONSTRAINT "employees_employment_type_check" CHECK ("employees"."employment_type" in ('full_time', 'part_time', 'contractor', 'intern')),
	CONSTRAINT "employees_status_check" CHECK ("employees"."status" in ('active', 'inactive')),
	CONSTRAINT "employees_inactive_on_check" CHECK (("employees"."status" = 'inactive') = ("employees"."inactive_on" is not null)),
	CONSTRAINT "employees_fte_check" CHECK ("employees"."fte" > 0 and "employees"."fte" <= 1)
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;