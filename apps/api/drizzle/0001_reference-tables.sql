CREATE TABLE "countries" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"currency_code" char(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"minor_digits" smallint NOT NULL,
	CONSTRAINT "currencies_minor_digits_check" CHECK ("currencies"."minor_digits" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "pay_frequencies" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"periods_per_year" smallint NOT NULL,
	CONSTRAINT "pay_frequencies_periods_per_year_check" CHECK ("pay_frequencies"."periods_per_year" > 0)
);
--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;