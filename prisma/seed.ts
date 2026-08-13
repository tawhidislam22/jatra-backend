import { prisma } from '../src/app/lib/prisma.js';
import { Role } from '../src/generated/prisma/enums.js';

async function main() {
  console.log('Seeding started...');

  // Clean up
  await prisma.vehicle.deleteMany();
  await prisma.automotiveCenter.deleteMany();

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

  const centerOwner1 = await prisma.user.upsert({
    where: { email: 'center1@jatra.com' },
    update: {},
    create: {
      email: 'center1@jatra.com',
      name: 'Jatra Premier Owner',
      fullName: 'Jatra Premier Owner',
      role: Role.ADMIN,
      phone: '01711111111',
    },
  });

  const centerOwner2 = await prisma.user.upsert({
    where: { email: 'center2@jatra.com' },
    update: {},
    create: {
      email: 'center2@jatra.com',
      name: 'AutoCare Owner',
      fullName: 'AutoCare Owner',
      role: Role.ADMIN,
      phone: '01988888888',
    },
  });

  const centerOwner3 = await prisma.user.upsert({
    where: { email: 'center3@jatra.com' },
    update: {},
    create: {
      email: 'center3@jatra.com',
      name: 'Dhanmondi Motors Owner',
      fullName: 'Dhanmondi Motors Owner',
      role: Role.ADMIN,
      phone: '01511111111',
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

  // 2. Create Centers
  const center1 = await prisma.automotiveCenter.create({
    data: {
      name: 'Jatra Premier Service',
      address: 'Road 11, Block E, Gulshan 1, Dhaka',
      latitude: 23.7808,
      longitude: 90.4196,
      phone: '01744444444',
      adminId: centerOwner1.id,
      rating: 4.8,
      isApproved: true,
      servicesOffered: ['Engine Repair', 'Oil Change', 'Wheel Alignment'],
      images: ['https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&q=80']
    },
  });

  const center2 = await prisma.automotiveCenter.create({
    data: {
      name: 'AutoCare Banani',
      address: 'Kemal Ataturk Ave, Banani, Dhaka',
      latitude: 23.7940,
      longitude: 90.4043,
      phone: '01988888888',
      adminId: centerOwner2.id,
      rating: 4.6,
      isApproved: true,
      servicesOffered: ['Wash', 'Battery Replacement'],
      images: ['https://images.unsplash.com/photo-1635766299863-71a7d6562095?auto=format&fit=crop&q=80']
    },
  });

  const center3 = await prisma.automotiveCenter.create({
    data: {
      name: 'Dhanmondi Motors',
      address: 'Satmasjid Road, Dhanmondi, Dhaka',
      latitude: 23.7461,
      longitude: 90.3742,
      phone: '01511111111',
      adminId: centerOwner3.id,
      rating: 4.9,
      isApproved: false,
      servicesOffered: ['Full Inspection', 'Dent Paint', 'Tire Rotation'],
      images: ['https://images.unsplash.com/photo-1599256621730-535171e2873c?auto=format&fit=crop&q=80']
    },
  });


  // 3. Create Vehicles
  await prisma.vehicle.createMany({
    data: [
      {
        make: 'Toyota',
        model: 'Corolla Cross',
        year: 2023,
        licensePlate: 'DHA-KHA-12-3456',
        type: 'RENTAL_FLEET',
        pricePerDay: 50,
        isAvailable: true,
        features: ['AC', 'Automatic', 'Hybrid'],
        centerId: center1.id,
        images: ['https://demo.xpeedstudio.com/carrental/onepage-v4/wp-content/uploads/sites/9/2020/07/image7.png'],
      },
      {
        make: 'BMW',
        model: '320i',
        year: 2022,
        licensePlate: 'DHA-GA-11-2233',
        type: 'RENTAL_FLEET',
        pricePerDay: 75,
        isAvailable: true,
        features: ['Automatic', 'Petrol'],
        centerId: center1.id,
        images: ['https://demo.xpeedstudio.com/carrental/onepage-v4/wp-content/uploads/sites/9/2020/07/image4.png'],
      },
      {
        make: 'Mercedes',
        model: 'C-Class',
        year: 2023,
        licensePlate: 'DHA-KA-33-4455',
        type: 'RENTAL_FLEET',
        pricePerDay: 85,
        isAvailable: true,
        features: ['Automatic', 'Petrol'],
        centerId: center2.id,
        images: ['https://demo.xpeedstudio.com/carrental/onepage-v4/wp-content/uploads/sites/9/2020/07/image2.png'],
      },
      {
        make: 'Audi',
        model: 'A1 S',
        year: 2021,
        licensePlate: 'DHA-PA-99-8877',
        type: 'RENTAL_FLEET',
        pricePerDay: 60,
        isAvailable: false,
        features: ['Manual', 'Petrol'],
        centerId: center2.id,
        images: ['https://demo.xpeedstudio.com/carrental/onepage-v4/wp-content/uploads/sites/9/2020/07/image6.png'],
      }
    ]
  });

  // 4. Generate 10 extra centers
  const extraCenters = [];
  for (let i = 1; i <= 10; i++) {
    const owner = await prisma.user.upsert({
      where: { email: `extra_center${i}@jatra.com` },
      update: {},
      create: {
        email: `extra_center${i}@jatra.com`,
        name: `Extra Center ${i} Owner`,
        fullName: `Extra Center ${i} Owner`,
        role: Role.ADMIN,
        phone: `01800000${i.toString().padStart(2, '0')}`,
      },
    });

    const centerImages = [
      "https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1635766299863-71a7d6562095?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1599256621730-535171e2873c?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1619864295897-408bbbc7b80a?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1605515298946-d062f2e9da53?auto=format&fit=crop&q=80"
    ];
    
    const c = await prisma.automotiveCenter.create({
      data: {
        name: `Service Center ${i}`,
        address: `Block ${String.fromCharCode(64 + (i % 26 === 0 ? 1 : i % 26))}, Avenue ${i}, Dhaka`,
        latitude: 23.7 + (Math.random() * 0.1),
        longitude: 90.3 + (Math.random() * 0.1),
        phone: `01755555${i.toString().padStart(2, '0')}`,
        adminId: owner.id,
        rating: 4.0 + (Math.random()),
        isApproved: i % 2 === 0,
        servicesOffered: ['Engine Repair', 'Oil Change', 'Wash', 'Battery Replacement'].slice(0, 1 + Math.floor(Math.random() * 3)),
        images: [centerImages[i % centerImages.length]]
      },
    });
    extraCenters.push(c);
  }

  // 5. Generate 20 extra vehicles
  const makes = ['Toyota', 'Honda', 'Hyundai', 'Nissan', 'Kia'];
  const models = ['Sedan', 'SUV', 'Hatchback', 'Cross'];
  const extraVehicles = [];
  
  const carImages = [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541443131876-44b03de101c5?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80'
  ];

  for (let i = 1; i <= 20; i++) {
    const make = makes[i % makes.length];
    const model = models[i % models.length];
    const image = carImages[i % carImages.length];
    extraVehicles.push({
      make,
      model: `${model} ${i}`,
      year: 2015 + Math.floor(Math.random() * 9),
      licensePlate: `DHA-GA-${10 + i}-${1000 + i}`,
      type: 'RENTAL_FLEET',
      pricePerDay: 40 + Math.floor(Math.random() * 60),
      isAvailable: Math.random() > 0.3,
      features: ['AC', 'Automatic', 'Bluetooth', 'GPS'].slice(0, 2 + Math.floor(Math.random() * 2)),
      centerId: extraCenters[i % extraCenters.length].id, // Assign evenly across the new centers
      images: [image],
    });
  }
  await prisma.vehicle.createMany({
    data: extraVehicles,
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
