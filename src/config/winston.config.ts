import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig = (): WinstonModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  const transports: winston.transport[] = isProduction
    ? [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ]
    : [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.colorize({ all: true }),
            winston.format.printf(({ timestamp, level, message, context }) => {
              const ctx = context ? `[${context as string}] ` : '';
              return `${timestamp as string} ${level} ${ctx}${message as string}`;
            }),
          ),
        }),
      ];

  return {
    transports,
    level: isProduction ? 'info' : 'debug',
  };
};
