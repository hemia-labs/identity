import { AppDataSource } from '../../../data-source';
import { seed999SuperAdminRolesPermissions } from './999-seed-super-admin-roles-permissions';

async function runSeeds() {
  await AppDataSource.initialize();

  try {
    await seed999SuperAdminRolesPermissions(AppDataSource);
  } finally {
    await AppDataSource.destroy();
  }
}

runSeeds().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
