import { PrismaClient } from '@prisma/client-central-core';
import { createMariaDbAdapter } from '../src/prisma/create-mariadb-adapter';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environmental variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const databaseUrl = process.env.CENTRAL_CORE_DATABASE_URL;
  if (!databaseUrl) {
    console.error('CENTRAL_CORE_DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const adapter = createMariaDbAdapter(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    console.log('Connected to central-core database successfully.');

    const email = 'lila.admin@gmail.com';
    const rawPassword = 'Lucky5452%#';

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    let userId: bigint;

    if (existing) {
      console.log(`User ${email} already exists.`);
      userId = existing.id;
    } else {
      // Hash the password using bcryptjs
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      const userUuid = randomUUID();

      // Create new user & profile records
      const user = await prisma.user.create({
        data: {
          uuid: userUuid,
          email,
          passwordHash,
          status: 'ACTIVE',
          emailVerified: true,
          profile: {
            create: {
              firstName: 'Lila',
              lastName: 'Admin',
              displayName: 'Lila Admin',
              timezone: 'Asia/Kolkata',
            },
          },
        },
      });
      console.log(`Created user ${email} with UUID ${user.uuid}`);
      userId = user.id;
    }

    // Fetch the SUPER_ADMIN role
    const role = await prisma.role.findUnique({
      where: { code: 'SUPER_ADMIN' },
    });

    if (!role) {
      throw new Error(
        'SUPER_ADMIN role not found. Ensure the backend module seed was run on startup.',
      );
    }

    // Check if role is already linked
    const existingLink = await prisma.userRoleLink.findFirst({
      where: { userId, roleId: role.id },
    });

    if (!existingLink) {
      await prisma.userRoleLink.create({
        data: {
          userId,
          roleId: role.id,
        },
      });
      console.log(`Successfully assigned SUPER_ADMIN role to ${email}.`);
    } else {
      console.log(`User ${email} already holds SUPER_ADMIN role.`);
    }

    // Fetch or create the DRIVE_AI product access entitlement to resolve the 403 Forbidden checks
    let product = await prisma.product.findUnique({
      where: { code: 'DRIVE_AI' },
    });

    if (!product) {
      console.log('DRIVE_AI product not found in database. Seeding it...');
      product = await prisma.product.create({
        data: {
          uuid: randomUUID(),
          code: 'DRIVE_AI',
          name: 'Drive AI Cloud Storage',
          description: 'Cloud storage and AI tools',
          isActive: true,
        },
      });
    }

    const existingProductLink = await prisma.userProductAccess.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: product.id,
        },
      },
    });

    if (!existingProductLink) {
      await prisma.userProductAccess.create({
        data: {
          uuid: randomUUID(),
          userId,
          productId: product.id,
          status: 'ACTIVE',
        },
      });
      console.log(`Successfully granted DRIVE_AI product access to ${email}.`);
    } else if (existingProductLink.status !== 'ACTIVE') {
      await prisma.userProductAccess.update({
        where: { id: existingProductLink.id },
        data: { status: 'ACTIVE' },
      });
      console.log(
        `Successfully activated DRIVE_AI product access status for ${email}.`,
      );
    } else {
      console.log(
        `User ${email} already has ACTIVE access to product DRIVE_AI.`,
      );
    }

    console.log('\n=============================================');
    console.log('ADMIN USER SETUP AND ENTITLED SUCCESSFULLY!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${rawPassword}`);
    console.log('=============================================\n');
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
