import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtVerifierService } from './jwt-verifier.service.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtVerifierService, AuthGuard],
  exports: [AuthService, JwtVerifierService, AuthGuard],
})
export class AuthModule {}
