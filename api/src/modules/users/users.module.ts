import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from './services/users.service';
import { AuthService } from './services/auth.service';
import { User, UserSchema } from './entities/user.entity';
import { EventLogsModule } from '../event-logs/event-logs.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './controllers/users.controller';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [
    JwtModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    EventLogsModule,
  ],
  controllers: [
    UsersController,
    AuthController,
  ],
  providers: [
    UsersService, 
    AuthService, 
  ],
  exports: [
    UsersService, 
    AuthService, 
  ],
})
export class UsersModule {}
