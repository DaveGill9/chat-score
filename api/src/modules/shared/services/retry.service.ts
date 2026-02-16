import { Logger } from "@nestjs/common";

interface HttpError extends Error {
  headers?: Headers;
  status?: number;
}

export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  // return a promise that will retry the operation if it fails
  // @param fn - the function to retry
  // @param maxAttempts - the maximum number of attempts
  // @param tag - the tag to identify the operation
  // @returns a promise that will resolve to the result of the operation
  async retry<T>(fn: () => Promise<T>, tag: string = 'Retry', maxAttempts: number = 3): Promise<T> {
    let attempt = 0, delay = 500;
    while (true) {
      try {
        return await fn();
      }
      catch (error) {
        this.logger.error(`[${tag}] ${error.message}`);

        // 404 errors are not retryable
        if (error.status === 404) {
          throw error;
        }

        // increment the attempt
        attempt++;
        if (attempt > maxAttempts) {
          throw error;
        }

        // rate-limit error
        const { headers, status = 0 } = error as HttpError;
        if (status === 429) {
          try {
            const retryAfter = headers?.get('retry-after');
            delay = parseInt(retryAfter ?? '0') * 1_000;
          } catch {
            // use the default delay
          }
        }

        // jitter the delay
        const jitteredDelay = delay + (1_000 * Math.random());
        // backoff policy
        delay *= 2;
        // wait for the delay
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }
  }
}