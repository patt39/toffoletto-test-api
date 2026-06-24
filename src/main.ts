import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 6000);
  const version = process.env.API_VERSION;
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix(`/api/${version}`);
  const withList = ['http://localhost:3000'];
  app.enableCors({
    origin: withList,
    credentials: true,
    exposedHeaders: ['set-cookie'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );
  app.use(cookieParser());
  app.use(helmet());
  await app.listen(port, () => {
    console.log(`=============================================`);
    console.log(`*** 🚀 Link  http://localhost:${port}/api/${version} ***`);
    console.log(`=============================================`);
  });
}

void bootstrap();
