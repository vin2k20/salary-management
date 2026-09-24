CREATE TABLE "pay_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_changes_reason_check" CHECK ("pay_changes"."reason" in ('hire', 'promotion', 'revision', 'correction', 'import', 'transfer'))
);
--> statement-breakpoint
CREATE TABLE "pay_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"pay_change_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"frequency_code" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	CONSTRAINT "pay_items_amount_minor_check" CHECK ("pay_items"."amount_minor" >= 0),
	CONSTRAINT "pay_items_effective_dates_check" CHECK ("pay_items"."effective_to" is null or "pay_items"."effective_to" > "pay_items"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "pay_changes" ADD CONSTRAINT "pay_changes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_items" ADD CONSTRAINT "pay_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_items" ADD CONSTRAINT "pay_items_pay_change_id_pay_changes_id_fk" FOREIGN KEY ("pay_change_id") REFERENCES "public"."pay_changes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_items" ADD CONSTRAINT "pay_items_component_id_pay_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."pay_components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_items" ADD CONSTRAINT "pay_items_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_items" ADD CONSTRAINT "pay_items_frequency_code_pay_frequencies_code_fk" FOREIGN KEY ("frequency_code") REFERENCES "public"."pay_frequencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pay_items_one_open_item_idx" ON "pay_items" USING btree ("employee_id","component_id") WHERE "pay_items"."effective_to" is null;