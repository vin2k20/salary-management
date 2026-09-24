CREATE TABLE "change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb NOT NULL,
	"country_code" char(2),
	"changed_by" uuid,
	"changed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "change_log_entity_type_check" CHECK ("change_log"."entity_type" in ('employee', 'pay_change', 'pay_component', 'user')),
	CONSTRAINT "change_log_action_check" CHECK ("change_log"."action" in ('created', 'updated', 'inactivated', 'transferred'))
);
--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_log_entity_idx" ON "change_log" USING btree ("entity_type","entity_id","changed_at");