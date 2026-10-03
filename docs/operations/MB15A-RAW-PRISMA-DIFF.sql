-- DropForeignKey
ALTER TABLE "agent_configs" DROP CONSTRAINT "agent_configs_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_organization_id_agent_config_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_organization_id_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_organization_id_final_outbound_message_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_activities" DROP CONSTRAINT "booking_activities_organization_id_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_activities" DROP CONSTRAINT "booking_activities_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_created_by_agent_run_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_location_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_service_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_source_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_source_message_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_organization_id_staff_member_id_fkey";

-- DropForeignKey
ALTER TABLE "business_policies" DROP CONSTRAINT "business_policies_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "catalog_items" DROP CONSTRAINT "catalog_items_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "channel_connections" DROP CONSTRAINT "channel_connections_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "command_operations" DROP CONSTRAINT "command_operations_organization_id_agent_run_id_fkey";

-- DropForeignKey
ALTER TABLE "command_operations" DROP CONSTRAINT "command_operations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_receipts" DROP CONSTRAINT "consumer_receipts_organization_id_event_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_receipts" DROP CONSTRAINT "consumer_receipts_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation_summaries" DROP CONSTRAINT "conversation_summaries_organization_id_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation_summaries" DROP CONSTRAINT "conversation_summaries_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation_working_state" DROP CONSTRAINT "conversation_working_state_conv_fkey";

-- DropForeignKey
ALTER TABLE "conversation_working_state" DROP CONSTRAINT "conversation_working_state_lead_fkey";

-- DropForeignKey
ALTER TABLE "conversation_working_state" DROP CONSTRAINT "conversation_working_state_org_fkey";

-- DropForeignKey
ALTER TABLE "conversation_working_state" DROP CONSTRAINT "conversation_working_state_run_fkey";

-- DropForeignKey
ALTER TABLE "conversation_working_state" DROP CONSTRAINT "conversation_working_state_tool_call_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_organization_id_channel_connection_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_organization_id_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_organization_id_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_owner_member_fk";

-- DropForeignKey
ALTER TABLE "customer_identities" DROP CONSTRAINT "customer_identities_channel_connection_fk";

-- DropForeignKey
ALTER TABLE "customer_identities" DROP CONSTRAINT "customer_identities_organization_id_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_organization_id_merged_into_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_channel_connection_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_created_by_agent_run_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_outbound_message_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_organization_id_template_version_id_fkey";

-- DropForeignKey
ALTER TABLE "idempotency_records" DROP CONSTRAINT "idempotency_records_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_chunks" DROP CONSTRAINT "knowledge_chunks_organization_id_document_id_document_vers_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_chunks" DROP CONSTRAINT "knowledge_chunks_organization_id_document_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_chunks" DROP CONSTRAINT "knowledge_chunks_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_document_versions" DROP CONSTRAINT "knowledge_document_versions_organization_id_document_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_document_versions" DROP CONSTRAINT "knowledge_document_versions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_document_versions" DROP CONSTRAINT "knowledge_document_versions_reviewed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_documents" DROP CONSTRAINT "knowledge_documents_active_version_fk";

-- DropForeignKey
ALTER TABLE "knowledge_documents" DROP CONSTRAINT "knowledge_documents_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "lead_activities" DROP CONSTRAINT "lead_activities_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "lead_activities" DROP CONSTRAINT "lead_activities_organization_id_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "lead_activities" DROP CONSTRAINT "lead_activities_organization_id_source_agent_run_id_fkey";

-- DropForeignKey
ALTER TABLE "lead_activities" DROP CONSTRAINT "lead_activities_organization_id_source_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_assigned_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_assigned_user_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_created_by_agent_run_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_location_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_primary_service_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_source_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_organization_id_source_message_id_fkey";

-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "message_template_versions" DROP CONSTRAINT "message_template_versions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "message_template_versions" DROP CONSTRAINT "message_template_versions_organization_id_template_id_fkey";

-- DropForeignKey
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_active_version_fk";

-- DropForeignKey
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_organization_id_channel_connection_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_organization_id_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_template_version_fk";

-- DropForeignKey
ALTER TABLE "offer_catalog_items" DROP CONSTRAINT "offer_catalog_items_organization_id_catalog_item_id_fkey";

-- DropForeignKey
ALTER TABLE "offer_catalog_items" DROP CONSTRAINT "offer_catalog_items_organization_id_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "order_line_items" DROP CONSTRAINT "order_line_items_catalog_item_id_fkey";

-- DropForeignKey
ALTER TABLE "order_line_items" DROP CONSTRAINT "order_line_items_order_id_fkey";

-- DropForeignKey
ALTER TABLE "order_line_items" DROP CONSTRAINT "order_line_items_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_quote_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_capabilities" DROP CONSTRAINT "organization_capabilities_org_fkey";

-- DropForeignKey
ALTER TABLE "organization_conversation_profiles" DROP CONSTRAINT "organization_conversation_profiles_org_fkey";

-- DropForeignKey
ALTER TABLE "organization_follow_up_policies" DROP CONSTRAINT "organization_follow_up_policies_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_onboarding" DROP CONSTRAINT "organization_onboarding_org_fkey";

-- DropForeignKey
ALTER TABLE "organization_profiles" DROP CONSTRAINT "organization_profiles_org_fkey";

-- DropForeignKey
ALTER TABLE "outbound_attempts" DROP CONSTRAINT "outbound_attempts_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "outbound_attempts" DROP CONSTRAINT "outbound_attempts_organization_id_message_id_fkey";

-- DropForeignKey
ALTER TABLE "outbox_events" DROP CONSTRAINT "outbox_events_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "quote_line_items" DROP CONSTRAINT "quote_line_items_catalog_item_id_fkey";

-- DropForeignKey
ALTER TABLE "quote_line_items" DROP CONSTRAINT "quote_line_items_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "quote_line_items" DROP CONSTRAINT "quote_line_items_quote_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "service_staff" DROP CONSTRAINT "service_staff_organization_id_service_id_fkey";

-- DropForeignKey
ALTER TABLE "service_staff" DROP CONSTRAINT "service_staff_organization_id_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_catalog_item_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_organization_id_location_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_availability_exceptions" DROP CONSTRAINT "staff_availability_exceptions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_availability_exceptions" DROP CONSTRAINT "staff_availability_exceptions_organization_id_location_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_availability_exceptions" DROP CONSTRAINT "staff_availability_exceptions_organization_id_staff_member_fkey";

-- DropForeignKey
ALTER TABLE "staff_availability_rules" DROP CONSTRAINT "staff_availability_rules_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_availability_rules" DROP CONSTRAINT "staff_availability_rules_organization_id_location_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_availability_rules" DROP CONSTRAINT "staff_availability_rules_organization_id_staff_member_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_members" DROP CONSTRAINT "staff_members_active_org_member_fk";

-- DropForeignKey
ALTER TABLE "staff_members" DROP CONSTRAINT "staff_members_member_user_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_members" DROP CONSTRAINT "staff_members_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_members" DROP CONSTRAINT "staff_members_organization_id_location_id_fkey";

-- DropForeignKey
ALTER TABLE "tool_calls" DROP CONSTRAINT "tool_calls_organization_id_agent_run_id_fkey";

-- DropForeignKey
ALTER TABLE "tool_calls" DROP CONSTRAINT "tool_calls_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_organization_id_agent_run_id_fkey";

-- DropForeignKey
ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_receipts" DROP CONSTRAINT "webhook_receipts_organization_id_channel_connection_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_receipts" DROP CONSTRAINT "webhook_receipts_organization_id_fkey";

-- DropIndex
DROP INDEX "business_policies_effective_lookup_idx";

-- DropIndex
DROP INDEX "orders_lookup_idx";

-- DropIndex
DROP INDEX "quotes_lookup_idx";

-- AlterTable
ALTER TABLE "agent_configs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_runs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "booking_activities" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "business_policies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "catalog_items" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "channel_connections" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "command_operations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "consumer_receipts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conversation_summaries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conversations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_identities" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "follow_ups" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "idempotency_records" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_chunks" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_document_versions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_documents" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lead_activities" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "locations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "message_template_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "message_templates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "offers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "order_line_items" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization_capabilities" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization_conversation_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization_follow_up_policies" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization_members" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization_onboarding" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "outbound_attempts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quote_line_items" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "services" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "staff_availability_exceptions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "staff_availability_rules" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "staff_members" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tool_calls" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "usage_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "webhook_receipts" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "business_policies_organization_id_policy_type_status_effect_idx" ON "business_policies"("organization_id", "policy_type", "status", "effective_from", "effective_until", "version");

-- CreateIndex
CREATE INDEX "orders_organization_id_status_created_at_idx" ON "orders"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "quotes_organization_id_status_created_at_idx" ON "quotes"("organization_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "business_policies" ADD CONSTRAINT "business_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_organization_id_channel_connection_id_fkey" FOREIGN KEY ("organization_id", "channel_connection_id") REFERENCES "channel_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_catalog_items" ADD CONSTRAINT "offer_catalog_items_organization_id_offer_id_fkey" FOREIGN KEY ("organization_id", "offer_id") REFERENCES "offers"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_catalog_items" ADD CONSTRAINT "offer_catalog_items_organization_id_catalog_item_id_fkey" FOREIGN KEY ("organization_id", "catalog_item_id") REFERENCES "catalog_items"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_location_id_fkey" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_catalog_item_id_fkey" FOREIGN KEY ("organization_id", "catalog_item_id") REFERENCES "catalog_items"("organization_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_organization_id_location_id_fkey" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_staff" ADD CONSTRAINT "service_staff_organization_id_service_id_fkey" FOREIGN KEY ("organization_id", "service_id") REFERENCES "services"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_staff" ADD CONSTRAINT "service_staff_organization_id_staff_id_fkey" FOREIGN KEY ("organization_id", "staff_id") REFERENCES "staff_members"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_channel_connection_id_fkey" FOREIGN KEY ("organization_id", "channel_connection_id") REFERENCES "channel_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_identity_id_fkey" FOREIGN KEY ("organization_id", "identity_id") REFERENCES "customer_identities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_owner_member_id_fkey" FOREIGN KEY ("organization_id", "owner_member_id") REFERENCES "organization_members"("organization_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_conversation_id_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_channel_connection_id_fkey" FOREIGN KEY ("organization_id", "channel_connection_id") REFERENCES "channel_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_template_version_id_fkey" FOREIGN KEY ("organization_id", "template_version_id") REFERENCES "message_template_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_receipts" ADD CONSTRAINT "webhook_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_receipts" ADD CONSTRAINT "webhook_receipts_organization_id_channel_connection_id_fkey" FOREIGN KEY ("organization_id", "channel_connection_id") REFERENCES "channel_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumer_receipts" ADD CONSTRAINT "consumer_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumer_receipts" ADD CONSTRAINT "consumer_receipts_organization_id_event_id_fkey" FOREIGN KEY ("organization_id", "event_id") REFERENCES "outbox_events"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_attempts" ADD CONSTRAINT "outbound_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_attempts" ADD CONSTRAINT "outbound_attempts_organization_id_message_id_fkey" FOREIGN KEY ("organization_id", "message_id") REFERENCES "messages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_conversation_id_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_agent_config_id_fkey" FOREIGN KEY ("organization_id", "agent_config_id") REFERENCES "agent_configs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_organization_id_agent_run_id_fkey" FOREIGN KEY ("organization_id", "agent_run_id") REFERENCES "agent_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_operations" ADD CONSTRAINT "command_operations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_operations" ADD CONSTRAINT "command_operations_organization_id_agent_run_id_fkey" FOREIGN KEY ("organization_id", "agent_run_id") REFERENCES "agent_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_agent_run_id_fkey" FOREIGN KEY ("organization_id", "agent_run_id") REFERENCES "agent_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_organization_id_conversation_id_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "knowledge_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "knowledge_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_document_id_document_vers_fkey" FOREIGN KEY ("organization_id", "document_id", "document_version_id") REFERENCES "knowledge_document_versions"("organization_id", "document_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_primary_service_id_fkey" FOREIGN KEY ("organization_id", "primary_service_id") REFERENCES "services"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_location_id_fkey" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_assigned_user_id_fkey" FOREIGN KEY ("organization_id", "assigned_user_id") REFERENCES "organization_members"("organization_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_assigned_by_user_id_fkey" FOREIGN KEY ("organization_id", "assigned_by_user_id") REFERENCES "organization_members"("organization_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_source_conversation_id_fkey" FOREIGN KEY ("organization_id", "source_conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_source_message_id_fkey" FOREIGN KEY ("organization_id", "source_message_id") REFERENCES "messages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_created_by_agent_run_id_fkey" FOREIGN KEY ("organization_id", "created_by_agent_run_id") REFERENCES "agent_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_organization_id_source_conversation_id_fkey" FOREIGN KEY ("organization_id", "source_conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_organization_id_source_agent_run_id_fkey" FOREIGN KEY ("organization_id", "source_agent_run_id") REFERENCES "agent_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availability_rules" ADD CONSTRAINT "staff_availability_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availability_rules" ADD CONSTRAINT "staff_availability_rules_organization_id_staff_member_id_fkey" FOREIGN KEY ("organization_id", "staff_member_id") REFERENCES "staff_members"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availability_rules" ADD CONSTRAINT "staff_availability_rules_organization_id_location_id_fkey" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availability_exceptions" ADD CONSTRAINT "staff_availability_exceptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availability_exceptions" ADD CONSTRAINT "staff_availability_exceptions_organization_id_staff_member_fkey" FOREIGN KEY ("organization_id", "staff_member_id") REFERENCES "staff_members"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availability_exceptions" ADD CONSTRAINT "staff_availability_exceptions_organization_id_location_id_fkey" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_service_id_fkey" FOREIGN KEY ("organization_id", "service_id") REFERENCES "services"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_location_id_fkey" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_staff_member_id_fkey" FOREIGN KEY ("organization_id", "staff_member_id") REFERENCES "staff_members"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_source_conversation_id_fkey" FOREIGN KEY ("organization_id", "source_conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_source_message_id_fkey" FOREIGN KEY ("organization_id", "source_message_id") REFERENCES "messages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_created_by_agent_run_id_fkey" FOREIGN KEY ("organization_id", "created_by_agent_run_id") REFERENCES "agent_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_activities" ADD CONSTRAINT "booking_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_activities" ADD CONSTRAINT "booking_activities_organization_id_booking_id_fkey" FOREIGN KEY ("organization_id", "booking_id") REFERENCES "bookings"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organization_id_active_version_id_fkey" FOREIGN KEY ("organization_id", "active_version_id") REFERENCES "message_template_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_template_versions" ADD CONSTRAINT "message_template_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_template_versions" ADD CONSTRAINT "message_template_versions_organization_id_template_id_fkey" FOREIGN KEY ("organization_id", "template_id") REFERENCES "message_templates"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_follow_up_policies" ADD CONSTRAINT "organization_follow_up_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_conversation_id_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_booking_id_fkey" FOREIGN KEY ("organization_id", "booking_id") REFERENCES "bookings"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_channel_connection_id_fkey" FOREIGN KEY ("organization_id", "channel_connection_id") REFERENCES "channel_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_template_version_id_fkey" FOREIGN KEY ("organization_id", "template_version_id") REFERENCES "message_template_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_outbound_message_id_fkey" FOREIGN KEY ("organization_id", "outbound_message_id") REFERENCES "messages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_created_by_agent_run_id_fkey" FOREIGN KEY ("organization_id", "created_by_agent_run_id") REFERENCES "agent_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_working_state" ADD CONSTRAINT "conversation_working_state_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_working_state" ADD CONSTRAINT "conversation_working_state_organization_id_conversation_id_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_working_state" ADD CONSTRAINT "conversation_working_state_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_working_state" ADD CONSTRAINT "conversation_working_state_organization_id_last_agent_run__fkey" FOREIGN KEY ("organization_id", "last_agent_run_id") REFERENCES "agent_runs"("organization_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_working_state" ADD CONSTRAINT "conversation_working_state_organization_id_last_tool_call__fkey" FOREIGN KEY ("organization_id", "last_tool_call_id") REFERENCES "tool_calls"("organization_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_capabilities" ADD CONSTRAINT "organization_capabilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_onboarding" ADD CONSTRAINT "organization_onboarding_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_conversation_profiles" ADD CONSTRAINT "organization_conversation_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_organization_id_quote_id_fkey" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "quotes"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_organization_id_catalog_item_id_fkey" FOREIGN KEY ("organization_id", "catalog_item_id") REFERENCES "catalog_items"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_quote_id_fkey" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "quotes"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_organization_id_order_id_fkey" FOREIGN KEY ("organization_id", "order_id") REFERENCES "orders"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_organization_id_catalog_item_id_fkey" FOREIGN KEY ("organization_id", "catalog_item_id") REFERENCES "catalog_items"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "agent_runs_org_conversation_started" RENAME TO "agent_runs_organization_id_conversation_id_started_at_idx";

-- RenameIndex
ALTER INDEX "audit_logs_org_recorded_idx" RENAME TO "audit_logs_organization_id_recorded_at_idx";

-- RenameIndex
ALTER INDEX "booking_activities_booking_created_idx" RENAME TO "booking_activities_organization_id_booking_id_created_at_idx";

-- RenameIndex
ALTER INDEX "bookings_org_customer_starts_idx" RENAME TO "bookings_organization_id_customer_id_starts_at_idx";

-- RenameIndex
ALTER INDEX "bookings_org_staff_starts_idx" RENAME TO "bookings_organization_id_staff_member_id_starts_at_idx";

-- RenameIndex
ALTER INDEX "catalog_items_org_kind_status_idx" RENAME TO "catalog_items_organization_id_kind_status_idx";

-- RenameIndex
ALTER INDEX "catalog_items_org_status_name_idx" RENAME TO "catalog_items_organization_id_status_name_idx";

-- RenameIndex
ALTER INDEX "channel_connections_org_status_idx" RENAME TO "channel_connections_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "conversation_summaries_lookup" RENAME TO "conversation_summaries_organization_id_conversation_id_vers_idx";

-- RenameIndex
ALTER INDEX "conversations_inbox_idx" RENAME TO "conversations_organization_id_mode_last_message_at_id_idx";

-- RenameIndex
ALTER INDEX "conversations_lease_expiry_idx" RENAME TO "conversations_organization_id_lease_expires_at_idx";

-- RenameIndex
ALTER INDEX "conversations_org_mode_owner_last_msg_idx" RENAME TO "conversations_organization_id_mode_owner_member_id_last_mes_idx";

-- RenameIndex
ALTER INDEX "customer_identities_customer_idx" RENAME TO "customer_identities_organization_id_customer_id_idx";

-- RenameIndex
ALTER INDEX "customer_identities_org_connection_address_key" RENAME TO "customer_identities_organization_id_channel_connection_id_e_key";

-- RenameIndex
ALTER INDEX "customers_org_updated_idx" RENAME TO "customers_organization_id_updated_at_id_idx";

-- RenameIndex
ALTER INDEX "follow_ups_org_customer" RENAME TO "follow_ups_organization_id_customer_id_created_at_idx";

-- RenameIndex
ALTER INDEX "follow_ups_org_status_eligible" RENAME TO "follow_ups_organization_id_status_next_eligible_at_idx";

-- RenameIndex
ALTER INDEX "knowledge_chunks_version_idx" RENAME TO "knowledge_chunks_organization_id_document_version_id_chunk__idx";

-- RenameIndex
ALTER INDEX "knowledge_document_versions_doc_idx" RENAME TO "knowledge_document_versions_organization_id_document_id_ver_idx";

-- RenameIndex
ALTER INDEX "knowledge_documents_org_updated_idx" RENAME TO "knowledge_documents_organization_id_updated_at_idx";

-- RenameIndex
ALTER INDEX "knowledge_documents_source_type_idx" RENAME TO "knowledge_documents_organization_id_source_type_visibility_idx";

-- RenameIndex
ALTER INDEX "lead_activities_lead_created" RENAME TO "lead_activities_organization_id_lead_id_created_at_idx";

-- RenameIndex
ALTER INDEX "leads_org_customer" RENAME TO "leads_organization_id_customer_id_idx";

-- RenameIndex
ALTER INDEX "leads_org_status_updated" RENAME TO "leads_organization_id_status_updated_at_idx";

-- RenameIndex
ALTER INDEX "locations_org_active_idx" RENAME TO "locations_organization_id_active_idx";

-- RenameIndex
ALTER INDEX "messages_timeline_idx" RENAME TO "messages_organization_id_conversation_id_timeline_sequence__idx";

-- RenameIndex
ALTER INDEX "offer_catalog_items_org_item_idx" RENAME TO "offer_catalog_items_organization_id_catalog_item_id_idx";

-- RenameIndex
ALTER INDEX "offers_org_status_dates_idx" RENAME TO "offers_organization_id_status_starts_at_ends_at_idx";

-- RenameIndex
ALTER INDEX "order_line_items_order_idx" RENAME TO "order_line_items_organization_id_order_id_idx";

-- RenameIndex
ALTER INDEX "orders_customer_idx" RENAME TO "orders_organization_id_customer_id_idx";

-- RenameIndex
ALTER INDEX "organization_members_org_role_status_idx" RENAME TO "organization_members_organization_id_role_status_idx";

-- RenameIndex
ALTER INDEX "outbox_events_org_created_idx" RENAME TO "outbox_events_organization_id_created_at_idx";

-- RenameIndex
ALTER INDEX "outbox_events_org_id_uidx" RENAME TO "outbox_events_organization_id_id_key";

-- RenameIndex
ALTER INDEX "quote_line_items_quote_idx" RENAME TO "quote_line_items_organization_id_quote_id_idx";

-- RenameIndex
ALTER INDEX "quotes_customer_idx" RENAME TO "quotes_organization_id_customer_id_idx";

-- RenameIndex
ALTER INDEX "service_staff_org_staff_idx" RENAME TO "service_staff_organization_id_staff_id_idx";

-- RenameIndex
ALTER INDEX "services_org_active_name_idx" RENAME TO "services_organization_id_active_name_idx";

-- RenameIndex
ALTER INDEX "services_org_catalog_item_unique" RENAME TO "services_organization_id_catalog_item_id_key";

-- RenameIndex
ALTER INDEX "staff_availability_exceptions_staff_date_idx" RENAME TO "staff_availability_exceptions_organization_id_staff_member__idx";

-- RenameIndex
ALTER INDEX "staff_availability_rules_staff_idx" RENAME TO "staff_availability_rules_organization_id_staff_member_id_da_idx";

-- RenameIndex
ALTER INDEX "staff_members_org_location_active_idx" RENAME TO "staff_members_organization_id_location_id_active_idx";

-- RenameIndex
ALTER INDEX "usage_events_org_run" RENAME TO "usage_events_organization_id_agent_run_id_idx";

-- RenameIndex
ALTER INDEX "webhook_receipts_org_received_idx" RENAME TO "webhook_receipts_organization_id_received_at_idx";

