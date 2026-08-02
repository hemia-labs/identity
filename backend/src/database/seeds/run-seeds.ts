import { AppDataSource } from '../../../data-source';
import { seedInitialIdentity } from './001-initial-identity';

async function runSeeds() {
  await AppDataSource.initialize();

  try {
    await seedInitialIdentity(AppDataSource);
  } finally {
    await AppDataSource.destroy();
  }
}

runSeeds().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
