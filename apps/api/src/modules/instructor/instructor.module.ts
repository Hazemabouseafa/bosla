import { Module } from '@nestjs/common';
import { InstructorCollabModule } from '../instructor-collab/instructor-collab.module';
import { VideoModule } from '../video/video.module';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';

@Module({
  imports: [VideoModule, InstructorCollabModule],
  controllers: [InstructorController],
  providers: [InstructorService],
  exports: [InstructorService, InstructorCollabModule],
})
export class InstructorModule {}
