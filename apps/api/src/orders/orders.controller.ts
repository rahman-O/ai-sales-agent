import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  ConfirmOrderRequest,
  CreateOrderRequest,
  OrderStatus,
} from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { OrdersService } from './orders.service.js';

@Controller('organizations/:organizationId/orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('status') status?: OrderStatus,
    @Query('customerId') customerId?: string,
    @Query('leadId') leadId?: string,
  ) {
    return this.orders.listOrders(req.auth!, org, { status, customerId, leadId });
  }

  @Get(':orderId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('orderId') orderId: string,
  ) {
    return this.orders.getOrder(req.auth!, org, orderId);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: CreateOrderRequest,
  ) {
    return this.orders.createOrder(req.auth!, org, body);
  }

  @Post(':orderId/confirm')
  confirm(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('orderId') orderId: string,
    @Body() body?: ConfirmOrderRequest,
  ) {
    return this.orders.confirmOrder(req.auth!, org, orderId, body);
  }

  @Post(':orderId/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('orderId') orderId: string,
    @Body('expectedVersion') expectedVersion?: number,
  ) {
    return this.orders.cancelOrder(req.auth!, org, orderId, expectedVersion);
  }

  @Post(':orderId/complete')
  complete(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('orderId') orderId: string,
    @Body('expectedVersion') expectedVersion?: number,
  ) {
    return this.orders.completeOrder(req.auth!, org, orderId, expectedVersion);
  }
}
