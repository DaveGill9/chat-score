import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import { LogLevel, LogGroup, EventLogsService } from 'src/modules/event-logs';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {

  constructor(
    private eventLogsService: EventLogsService,
  ) { }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // log error
    this.eventLogsService.createOne({
      level: LogLevel.ERROR,
      group: LogGroup.EXCEPTION,
      message: exception.message || 'Unknown error',
      properties: {
        status,
        path: request.url,
        body: request.body,
        query: request.query,
        params: request.params,
      }
    });

    // send standardised error response
    const exceptionResponse = exception.getResponse();
    const responseBody = typeof exceptionResponse === 'object' && exceptionResponse !== null 
      ? exceptionResponse 
      : { message: exception.message };

    response
      .status(status)
      .json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        ...responseBody
      });
  }
}