import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule } from '@nestjs/mongoose';
import { getAppVersion } from './utils/get-app-version';
import { HealthModule } from './modules/health/health.module';
import { HttpExceptionFilter } from './modules/event-logs/filters/http-exception.filter';
import { EventLogsModule } from './modules/event-logs/event-logs.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { UsersModule } from './modules/users/users.module';
import { AuthGuard } from './modules/users/guards/auth.guard';

@Module({
  imports: [

    // Simple in-memory cache module
    CacheModule.register({
      isGlobal: true,
    }),

    // API rate limiting
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 10,
        },
      ],
    }),

    // Access environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      load: [
        () => ({
          APP_VERSION: getAppVersion(),
        }),
      ],
    }),

    // Module for scheduled tasks (CRON jobs)
    ScheduleModule.forRoot(),

    // Connect to MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),

    // Modules
    HealthModule,
    EventLogsModule,
    DocumentsModule,
    UsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
