import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import compression from 'compression';
import { Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);  
  const configService = app.get(ConfigService);
  const port = process.env.PORT ?? 3000;

  // CORS configuration
  // In production, CORS is managed at the infrastructure level
  // In development, enable CORS for local frontend
  const isDevelopment = configService.get<string>('NODE_ENV', 'development') !== 'production';
  if (isDevelopment) {
    app.enableCors({
      origin: [ 'http://localhost:5173', 'http://localhost:5174' ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    logger.log('CORS enabled for local development');
  }

  // Enable compression middleware
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req: Request, res: Response) => {
      // Disable compression for SSE endpoints
      if (res.getHeader('Content-Type') === 'text/event-stream') {
        return false;
      }
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  // Security headers
  app.use(
    helmet({
      xContentTypeOptions: true,
      hsts: {
        maxAge: 63072000, // 2 years, in seconds
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // Start the application
  await app.listen(port);

  // Log startup event
  const version = configService.get<string>('APP_VERSION', '0.0.0');
  logger.log(`API v${version} is running on port ${port}`);  
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error.message);
  process.exit(1);
});
