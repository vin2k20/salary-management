CREATE TABLE "pay_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"country_code" char(2),
	"default_frequency" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_components_code_country_unique" UNIQUE NULLS NOT DISTINCT("code","country_code"),
	CONSTRAINT "pay_components_category_check" CHECK ("pay_components"."category" in ('earning', 'allowance', 'bonus', 'employer_contribution', 'benefit', 'other'))
);
--> statement-breakpoint
ALTER TABLE "pay_components" ADD CONSTRAINT "pay_components_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_components" ADD CONSTRAINT "pay_components_default_frequency_pay_frequencies_code_fk" FOREIGN KEY ("default_frequency") REFERENCES "public"."pay_frequencies"("code") ON DELETE no action ON UPDATE no action;