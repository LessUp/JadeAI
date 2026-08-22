CREATE INDEX "chat_messages_session_id_created_idx" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_sessions_resume_id_idx" ON "chat_sessions" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "interview_messages_round_id_idx" ON "interview_messages" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "interview_rounds_session_id_idx" ON "interview_rounds" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "interview_sessions_user_id_idx" ON "interview_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_sections_resume_id_idx" ON "resume_sections" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "resume_shares_resume_id_idx" ON "resume_shares" USING btree ("resume_id");