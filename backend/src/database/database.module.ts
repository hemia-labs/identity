import path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('database.host'),
        port: configService.getOrThrow<number>('database.port'),
        username: configService.getOrThrow<string>('database.username'),
        password: configService.getOrThrow<string>('database.password'),
        database: configService.getOrThrow<string>('database.database'),
        entities: [
          path.join(__dirname, '..', '**', '*.entity.ts'),
          path.join(__dirname, '..', '**', '*.entity.js'),
        ],
        migrations: [
          path.join(__dirname, 'migrations', '*.ts'),
          path.join(__dirname, 'migrations', '*.js'),
        ],
        synchronize: false,
        migrationsRun: false,
        logging: configService.get<boolean>('database.logging', false),
        retryAttempts: configService.get<number>('database.retryAttempts', 3),
        retryDelay: configService.get<number>('database.retryDelay', 3000),
        ssl: configService.get<boolean>('database.ssl', false)
          ? { rejectUnauthorized: false }
          : false,
        extra: {
          options: '-c timezone=America/Mexico_City',
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
