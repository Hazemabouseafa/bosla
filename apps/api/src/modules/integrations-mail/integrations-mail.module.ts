import { Global, Module } from '@nestjs/common';
import { IntegrationsMailService } from './integrations-mail.service';

@Global()
@Module({
  providers: [IntegrationsMailService],
  exports: [IntegrationsMailService],
})
export class IntegrationsMailModule {}
