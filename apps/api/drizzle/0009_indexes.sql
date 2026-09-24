CREATE INDEX "employees_country_code_idx" ON "employees" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "employees_department_idx" ON "employees" USING btree ("department");--> statement-breakpoint
CREATE INDEX "employees_job_title_idx" ON "employees" USING btree ("job_title");--> statement-breakpoint
CREATE INDEX "employees_employment_type_idx" ON "employees" USING btree ("employment_type");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "employees_full_name_trgm_idx" ON "employees" USING gin (("first_name" || ' ' || "last_name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pay_changes_employee_id_effective_from_idx" ON "pay_changes" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE INDEX "pay_items_employee_id_effective_from_idx" ON "pay_items" USING btree ("employee_id","effective_from");