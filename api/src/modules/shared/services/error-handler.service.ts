import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventLogsService, LogGroup, LogLevel } from '../../event-logs';

@Injectable()
export class ErrorHandlerService implements OnModuleInit {
  private readonly logger = new Logger(ErrorHandlerService.name);
  private readonly version: string;

  constructor(
    private readonly eventLogsService: EventLogsService,
    private readonly configService: ConfigService,
  ) {
    this.version = this.configService.get<string>('APP_VERSION', '0.0.0');
  }

  onModuleInit() {
    this.setupErrorHandlers();
  }

  private setupErrorHandlers(): void {

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      this.logger.error('Unhandled Rejection', reason);
      try {
        await this.eventLogsService.createOne({
          level: LogLevel.ERROR,
          group: LogGroup.EXCEPTION,
          message: `Unhandled Rejection: ${reason}`,
          properties: {
            version: this.version,
          },
        });
      } catch (error) {
        this.logger.error('Failed to log unhandled rejection:', error);
      }
      // Don't exit the process, just log the error
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught Exception:', error);
      try {
        await this.eventLogsService.createOne({
          level: LogLevel.ERROR,
          group: LogGroup.EXCEPTION,
          message: `Uncaught Exception: ${error}`,
          properties: {
            version: this.version,
          },
        });
      } catch (error) {
        this.logger.error('Failed to log uncaught exception:', error);
      }
      // Gracefully shutdown the application
      process.exit(1);
    });
  }

  setupGracefulShutdown(app: INestApplication): void {
    // Handle SIGTERM for graceful shutdown
    process.on('SIGTERM', async () => {
      this.logger.log('SIGTERM received, shutting down gracefully');
      try {
        await this.eventLogsService.createOne({
          level: LogLevel.INFO,
          group: LogGroup.GENERAL,
          message: `SIGTERM received, shutting down gracefully`,
          properties: {
            version: this.version,
          },
        });
      } catch (error) {
        this.logger.error('Failed to log SIGTERM:', error);
      }
      app.close().then(() => {
        this.logger.log('Application closed');
        process.exit(0);
      });
    });
    
    // Handle SIGINT for graceful shutdown
    process.on('SIGINT', async (signal) => {
      this.logger.log('SIGINT received, shutting down gracefully');
      try {
        await this.eventLogsService.createOne({
          level: LogLevel.INFO,
          group: LogGroup.GENERAL,
          message: `SIGINT received, shutting down gracefully: ${signal}`,
          properties: {
            version: this.version,
          },
        });
      } catch (error) {
        this.logger.error('Failed to log SIGINT:', error);
      }
      app.close().then(() => {
        this.logger.log('Application closed');
        process.exit(0);
      });
    });
  }
} 