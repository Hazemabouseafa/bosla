import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { AdminEventsController, EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [MembershipModule],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
