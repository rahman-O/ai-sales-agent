import type { PoolClient } from 'pg';
export async function getRecentConversationMessages(client: Pick<PoolClient,'query'>, organizationId:string, conversationId:string, targetIngressSequence:number) {
  return client.query<{id:string;direction:string;ingress_sequence:number|null;timeline_sequence:number;content_text:string}>(
    `SELECT id,direction,ingress_sequence,timeline_sequence,content_text FROM (
       SELECT id,direction,ingress_sequence,timeline_sequence,content_text
       FROM messages WHERE organization_id=$1 AND conversation_id=$2
         AND (ingress_sequence IS NULL OR ingress_sequence<=$3)
       ORDER BY timeline_sequence DESC,id DESC LIMIT 50
     ) recent ORDER BY timeline_sequence ASC,id ASC`,
    [organizationId,conversationId,targetIngressSequence],
  );
}
