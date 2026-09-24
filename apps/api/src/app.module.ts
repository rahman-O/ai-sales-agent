import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { AgentModule } from './agent/agent.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { FollowUpsModule } from './followups/followups.module.js';
import { TemplatesModule } from './templates/templates.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { HealthModule } from './health/health.module.js';
import { RequestIdMiddleware } from './common/request-id.middleware.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    CustomersModule,
    CatalogModule,
    ConversationsModule,
    MessagingModule,
    AgentModule,
    KnowledgeModule,
    LeadsModule,
    BookingsModule,
    FollowUpsModule,
    TemplatesModule,
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
