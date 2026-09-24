CREATE TABLE "fx_rates" (
	"currency_code" char(3) NOT NULL,
	"rate_date" date NOT NULL,
	"units_per_usd" numeric(18, 8) NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_currency_code_rate_date_pk" PRIMARY KEY("currency_code","rate_date"),
	CONSTRAINT "fx_rates_units_per_usd_check" CHECK ("fx_rates"."units_per_usd" > 0)
);
--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;