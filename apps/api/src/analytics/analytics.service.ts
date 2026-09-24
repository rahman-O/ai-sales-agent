import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService, type ActorContext } from '../database/tenant-context.service.js';
import { parseAnalyticsRange } from './range.js';

type Group = Record<string, unknown> & { _count?: { _all?: number } };
const counts = (rows: Group[], key: string) => Object.fromEntries(rows.map(r => [String(r[key]), Number(r._count?._all ?? 0)]));

@Injectable()
export class AnalyticsService {
  constructor(private readonly tenants: TenantContextService) {}
  async overview(actor:ActorContext, organizationId:string, q:{from:string;to:string;timezone:string}) {
    const member = await this.tenants.runAsActor(actor,tx=>tx.organizationMember.findUnique({where:{organizationId_userId:{organizationId,userId:actor.userId}}})) as {status:string;role:string}|null;
    if(!member||member.status!=='ACTIVE') throw new NotFoundException();
    if(!['OWNER','ADMIN'].includes(member.role)) throw new ForbiddenException('Analytics requires ADMIN or OWNER');
    const range=parseAnalyticsRange(q.from,q.to,q.timezone);
    return this.tenants.runInTenantContext(organizationId,actor,async tx=>{
      const where={organizationId,createdAt:{gte:range.from,lt:range.to}};
      const [leadState,leadCreated,bookingStates,followStates,origins,delivery,runs,tools,usage,handoffs,conversion,latency,followOutcome,automation] = await Promise.all([
        tx.lead.groupBy({by:['status'],where:{organizationId},_count:{_all:true}}),
        tx.lead.count({where}),
        tx.booking.groupBy({by:['status'],where,_count:{_all:true}}),
        tx.followUp.groupBy({by:['status'],where,_count:{_all:true}}),
        tx.message.groupBy({by:['origin'],where:{...where,direction:'OUTBOUND'},_count:{_all:true}}),
        tx.message.groupBy({by:['deliveryState'],where:{...where,direction:'OUTBOUND'},_count:{_all:true}}),
        tx.agentRun.groupBy({by:['status'],where:{organizationId,startedAt:{gte:range.from,lt:range.to}},_count:{_all:true}}),
        tx.toolCall.groupBy({by:['toolName','resultCode'],where,_count:{_all:true}}),
        tx.usageEvent.aggregate({where,_count:{_all:true},_sum:{inputTokens:true,outputTokens:true,latencyMs:true}}),
        tx.auditLog.groupBy({by:['action'],where:{organizationId,recordedAt:{gte:range.from,lt:range.to},action:{in:['conversation.takeover','conversation.claimed','conversation.resumed_ai']}},_count:{_all:true}}),
        tx.$queryRaw<Array<{denominator:number;numerator:number}>>`SELECT count(*)::int denominator, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM bookings b JOIN booking_activities ba ON ba.organization_id=b.organization_id AND ba.booking_id=b.id AND ba.type='BOOKING_CONFIRMED' WHERE b.organization_id=l.organization_id AND b.lead_id=l.id AND ba.created_at>=l.created_at AND ba.created_at<l.created_at+interval '30 days'))::int numerator FROM leads l WHERE l.organization_id=${organizationId}::uuid AND l.created_at>=${range.from} AND l.created_at<${range.to}`,
        tx.$queryRaw<Array<{origin:string;median_ms:number|null;p90_ms:number|null;samples:number}>>`WITH pairs AS (SELECT o.origin,extract(epoch from(o.created_at-i.created_at))*1000 latency FROM messages i JOIN LATERAL (SELECT x.origin,x.created_at,x.id FROM messages x WHERE x.organization_id=i.organization_id AND x.conversation_id=i.conversation_id AND x.timeline_sequence>i.timeline_sequence AND x.direction='OUTBOUND' AND x.origin IN ('AI','OPERATOR') AND NOT EXISTS(SELECT 1 FROM follow_ups f WHERE f.organization_id=x.organization_id AND f.outbound_message_id=x.id) ORDER BY x.timeline_sequence LIMIT 1) o ON true WHERE i.organization_id=${organizationId}::uuid AND i.direction='INBOUND' AND i.origin='CUSTOMER' AND i.created_at>=${range.from} AND i.created_at<${range.to}) SELECT origin,percentile_cont(.5) WITHIN GROUP(ORDER BY latency)::float8 median_ms,percentile_cont(.9) WITHIN GROUP(ORDER BY latency)::float8 p90_ms,count(*)::int samples FROM pairs GROUP BY origin`,
        tx.$queryRaw<Array<{eligible:number;replied:number;booking_associated:number}>>`SELECT count(*) FILTER(WHERE m.delivery_state IN ('ACCEPTED','DELIVERED','READ'))::int eligible,count(*) FILTER(WHERE m.delivery_state IN ('ACCEPTED','DELIVERED','READ') AND EXISTS(SELECT 1 FROM messages i WHERE i.organization_id=f.organization_id AND i.conversation_id=f.conversation_id AND i.direction='INBOUND' AND i.origin='CUSTOMER' AND i.timeline_sequence>m.timeline_sequence AND i.created_at<m.created_at+interval '7 days'))::int replied,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM bookings b JOIN booking_activities ba ON ba.organization_id=b.organization_id AND ba.booking_id=b.id AND ba.type='BOOKING_CONFIRMED' WHERE b.organization_id=f.organization_id AND b.customer_id=f.customer_id AND (f.lead_id IS NULL OR b.lead_id=f.lead_id) AND ba.created_at>=f.executed_at AND ba.created_at<f.executed_at+interval '7 days'))::int booking_associated FROM follow_ups f JOIN messages m ON m.organization_id=f.organization_id AND m.id=f.outbound_message_id WHERE f.organization_id=${organizationId}::uuid AND f.status='DISPATCHED' AND f.executed_at>=${range.from} AND f.executed_at<${range.to}`,
        tx.$queryRaw<Array<{denominator:number;numerator:number}>>`SELECT count(*)::int denominator,count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM messages o WHERE o.organization_id=c.organization_id AND o.conversation_id=c.id AND o.direction='OUTBOUND' AND o.origin='OPERATOR') AND NOT EXISTS(SELECT 1 FROM audit_logs a WHERE a.organization_id=c.organization_id AND a.target_id=c.id::text AND a.action='conversation.takeover'))::int numerator FROM conversations c WHERE c.organization_id=${organizationId}::uuid AND c.created_at>=${range.from} AND c.created_at<${range.to} AND EXISTS(SELECT 1 FROM messages a WHERE a.organization_id=c.organization_id AND a.conversation_id=c.id AND a.direction='OUTBOUND' AND a.origin='AI')`,
      ]);
      const c=conversion[0]??{denominator:0,numerator:0}; const f=followOutcome[0]??{eligible:0,replied:0,booking_associated:0}; const a=automation[0]??{denominator:0,numerator:0};
      const d=counts(delivery as Group[],'deliveryState'); const unknown=Number(d.UNKNOWN??0);
      return {metricVersion:'analytics_overview:v1',asOf:new Date().toISOString(),range:{from:q.from,to:q.to,timezone:q.timezone,semantics:'[from,to)'},
        leads:{completeness:'PARTIAL',currentStatus:counts(leadState as Group[],'status'),created:Number(leadCreated),historicalSnapshot:null,limitations:['NO_HISTORICAL_SNAPSHOTS']},
        conversion:{completeness:'PARTIAL',attribution:'DIRECT',observationDays:30,numerator:Number(c.numerator),denominator:Number(c.denominator),rate:c.denominator?c.numerator/c.denominator:null,limitations:[...(range.to>new Date(Date.now()-30*86400000)?['IMMATURE_COHORT']:[])]},
        bookings:{completeness:'COMPLETE',byCurrentState:counts(bookingStates as Group[],'status'),completionRate:null,limitations:['OUTCOME_NOT_MODELED']},
        followUps:{completeness:'PARTIAL',byStatus:counts(followStates as Group[],'status'),replyRate:{attribution:'ASSOCIATED',numerator:Number(f.replied),denominator:Number(f.eligible),rate:f.eligible?f.replied/f.eligible:null},bookingAssociation:{attribution:'ASSOCIATED',count:Number(f.booking_associated),windowDays:7},limitations:[]},
        conversations:{completeness:'PARTIAL',outboundByOrigin:counts(origins as Group[],'origin'),handoffActions:counts(handoffs as Group[],'action'),noHumanIntervention:{numerator:Number(a.numerator),denominator:Number(a.denominator),rate:a.denominator?a.numerator/a.denominator:null},responseLatencyMs:latency,limitations:['HISTORICAL_OWNERSHIP_INTERVALS_INCOMPLETE']},
        delivery:{completeness:unknown?'PARTIAL':'COMPLETE',byCurrentState:d,limitations:unknown?['UNKNOWN_DELIVERY_OUTCOMES']:[]},
        agent:{completeness:'COMPLETE',runsByStatus:counts(runs as Group[],'status'),toolCalls:(tools as Group[]).map(r=>({toolName:r.toolName,resultCode:r.resultCode,count:Number(r._count?._all??0)})),usage:{modelCalls:Number(usage._count._all),inputTokens:usage._sum.inputTokens,outputTokens:usage._sum.outputTokens,totalTokens:(usage._sum.inputTokens??0)+(usage._sum.outputTokens??0),totalLatencyMs:usage._sum.latencyMs}},
        unavailable:{cost:{completeness:'UNAVAILABLE',limitations:['COST_PRICING_NOT_VERSIONED']},attendanceRevenue:{completeness:'UNAVAILABLE',limitations:['OUTCOME_NOT_MODELED']},knowledgeEffectiveness:{completeness:'UNAVAILABLE',limitations:['NO_CAUSAL_DESIGN']}}};
    });
  }
}
