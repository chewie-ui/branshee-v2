CREATE TABLE "todo_list_members" (
	"list_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "todo_list_members_list_id_member_id_pk" PRIMARY KEY("list_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "todo_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"visibility" text DEFAULT 'team' NOT NULL,
	"created_by_member_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"list_id" uuid,
	"parent_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"due_date" date,
	"due_time" text,
	"priority" integer DEFAULT 4 NOT NULL,
	"recurrence" text,
	"assignee_member_id" uuid,
	"created_by_member_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_by_member_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todo_list_members" ADD CONSTRAINT "todo_list_members_list_id_todo_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_list_members" ADD CONSTRAINT "todo_list_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_lists" ADD CONSTRAINT "todo_lists_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_lists" ADD CONSTRAINT "todo_lists_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_tasks" ADD CONSTRAINT "todo_tasks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_tasks" ADD CONSTRAINT "todo_tasks_list_id_todo_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_tasks" ADD CONSTRAINT "todo_tasks_assignee_member_id_members_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_tasks" ADD CONSTRAINT "todo_tasks_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_tasks" ADD CONSTRAINT "todo_tasks_completed_by_member_id_members_id_fk" FOREIGN KEY ("completed_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_lists_business_idx" ON "todo_lists" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "todo_tasks_business_idx" ON "todo_tasks" USING btree ("business_id","completed_at");--> statement-breakpoint
CREATE INDEX "todo_tasks_list_idx" ON "todo_tasks" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "todo_tasks_assignee_idx" ON "todo_tasks" USING btree ("assignee_member_id");--> statement-breakpoint
CREATE INDEX "todo_tasks_parent_idx" ON "todo_tasks" USING btree ("parent_id");