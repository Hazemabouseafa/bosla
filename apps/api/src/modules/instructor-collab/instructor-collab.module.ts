import { Module } from '@nestjs/common';
import { InstructorCollabController } from './instructor-collab.controller';
import { InstructorCollabService } from './instructor-collab.service';

@Module({
  controllers: [InstructorCollabController],
  providers: [InstructorCollabService],
  exports: [InstructorCollabService],
})
export class InstructorCollabModule {}
