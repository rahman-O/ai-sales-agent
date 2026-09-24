-- P13: event-trigger functions are invoked by PostgreSQL, never by app_runtime.
-- Remove the inherited PUBLIC execute surface without changing trigger behavior.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM app_runtime;
