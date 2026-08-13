import { prisma } from '../src/app/lib/prisma.js';
import { Role } from '../src/generated/prisma/enums.js';

async function main() {
  console.log('Seeding started...');

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jatra.com' },
    update: {},
    create: {
      email: 'admin@jatra.com',
      name: 'System Admin',
      fullName: 'System Administrator',
      role: Role.ADMIN,
      phone: '01700000000',
    },
  });

  const centerOwner = await prisma.user.upsert({
    where: { email: 'center@jatra.com' },
    update: {},
    create: {
      email: 'center@jatra.com',
      name: 'Auto Center',
      fullName: 'Auto Center Owner',
      role: Role.ADMIN,
      phone: '01711111111',
    },
  });

  const mechanic = await prisma.user.upsert({
    where: { email: 'mechanic@jatra.com' },
    update: {},
    create: {
      email: 'mechanic@jatra.com',
      name: 'Mike Mechanic',
      fullName: 'Mike Mechanic',
      role: Role.MECHANIC,
      phone: '01722222222',
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@jatra.com' },
    update: {},
    create: {
      email: 'customer@jatra.com',
      name: 'John Doe',
      fullName: 'John Doe',
      role: Role.CUSTOMER,
      phone: '01733333333',
    },
  });

  // 2. Create Center
  const center = await prisma.automotiveCenter.upsert({
    where: { adminId: centerOwner.id },
    update: {},
    create: {
      name: 'Jatra Premier Service',
      address: 'Road 11, Block E, Gulshan 1, Dhaka',
      latitude: 23.7808,
      longitude: 90.4196,
      phone: '01744444444',
      adminId: centerOwner.id,
      rating: 4.8,
      isApproved: true,
      servicesOffered: ['Engine Repair', 'Oil Change', 'Wash', 'Wheel Alignment', 'Emergency Towing'],
    },
  });

  // Link Mechanic to Center
  await prisma.user.update({
    where: { id: mechanic.id },
    data: { employedAtCenterId: center.id },
  });

  // 3. Create Vehicles
  const rentalVehicle = await prisma.vehicle.create({
    data: {
      make: 'Toyota',
      model: 'Corolla Cross',
      year: 2023,
      licensePlate: 'DHA-KHA-12-3456',
      type: 'RENTAL_FLEET',
      pricePerDay: 5000,
      isAvailable: true,
      features: ['AC', 'Automatic', 'Bluetooth', 'Reverse Camera'],
      centerId: center.id,
      images: ['https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&q=80'],
    }
  });

  const customerVehicle = await prisma.vehicle.create({
    data: {
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      licensePlate: 'DHA-GA-11-2233',
      type: 'CUSTOMER_OWNED',
      ownerId: customer.id,
    }
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
