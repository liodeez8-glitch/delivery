'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');

const shipments = [
  { trackingCode:'CAC-2025-AIR00001', transportMode:'air',  shippingStatus:'in_transit',       origin:'Lagos, Nigeria',     destination:'London, UK',        currentLocation:'Dubai, UAE',          packageContent:'Electronic Components', packageWeight:2.5,  packageQuantity:1, recipientName:'James Okonkwo',   recipientAddress:'14 Baker Street, London W1U 6SZ', shipmentDate: new Date('2025-01-10'), arrivalDate: new Date('2025-01-18') },
  { trackingCode:'CAC-2025-SEA00002', transportMode:'sea',  shippingStatus:'processing',        origin:'Abidjan, Ivory Coast',destination:'New York, USA',     currentLocation:'Abidjan Port',       packageContent:'Textiles & Fabric',     packageWeight:120,  packageQuantity:5, recipientName:'Maria Santos',    recipientAddress:'250 W 57th St, New York, NY 10107', shipmentDate: new Date('2025-01-12'), arrivalDate: new Date('2025-02-02') },
  { trackingCode:'CAC-2025-LND00003', transportMode:'land', shippingStatus:'delivered',         origin:'Accra, Ghana',        destination:'Abuja, Nigeria',    currentLocation:'Abuja, Nigeria',     packageContent:'Pharmaceuticals',       packageWeight:8.0,  packageQuantity:2, recipientName:'Dr. Amina Bello', recipientAddress:'12 Adetokunbo Ademola Cres, Abuja', shipmentDate: new Date('2025-01-05'), arrivalDate: new Date('2025-01-09') },
  { trackingCode:'CAC-2025-AIR00004', transportMode:'air',  shippingStatus:'out_for_delivery',  origin:'Paris, France',       destination:'Lagos, Nigeria',    currentLocation:'Lagos Airport',      packageContent:'Luxury Goods',          packageWeight:1.2,  packageQuantity:1, recipientName:'Chisom Eze',      recipientAddress:'5 Ozumba Mbadiwe Ave, Lagos', shipmentDate: new Date('2025-01-14'), arrivalDate: new Date('2025-01-16') },
  { trackingCode:'CAC-2025-SEA00005', transportMode:'sea',  shippingStatus:'on_hold',           origin:'Shanghai, China',     destination:'Dakar, Senegal',    currentLocation:'Customs — Dakar',    packageContent:'Industrial Machinery',  packageWeight:850,  packageQuantity:3, recipientName:'Oumar Diallo',    recipientAddress:'Avenue Bourguiba, Dakar 12000', shipmentDate: new Date('2024-12-20'), arrivalDate: new Date('2025-01-25') },
  { trackingCode:'CAC-2025-LND00006', transportMode:'land', shippingStatus:'in_transit',        origin:'Nairobi, Kenya',      destination:'Kampala, Uganda',   currentLocation:'Busia Border, Kenya',packageContent:'Agricultural Equipment',packageWeight:200,  packageQuantity:4, recipientName:'Samuel Waweru',   recipientAddress:'Plot 14 Kampala Rd, Kampala', shipmentDate: new Date('2025-01-13'), arrivalDate: new Date('2025-01-17') },
  { trackingCode:'CAC-2025-AIR00007', transportMode:'air',  shippingStatus:'processing',        origin:'Dubai, UAE',          destination:'Douala, Cameroon',  currentLocation:'Dubai Airport',      packageContent:'Electronics',           packageWeight:5.5,  packageQuantity:2, recipientName:'Patrice Mbeng',   recipientAddress:'Rue Joss, Douala 24000', shipmentDate: new Date('2025-01-15'), arrivalDate: new Date('2025-01-19') },
  { trackingCode:'CAC-2025-SEA00008', transportMode:'sea',  shippingStatus:'delivered',         origin:'Rotterdam, Netherlands',destination:'Cape Town, SA',    currentLocation:'Cape Town, SA',      packageContent:'Automotive Parts',      packageWeight:340,  packageQuantity:6, recipientName:'Lerato Dlamini',  recipientAddress:'10 Long Street, Cape Town 8001', shipmentDate: new Date('2024-12-01'), arrivalDate: new Date('2025-01-08') },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  let created = 0;
  for (const data of shipments) {
    const exists = await Shipment.findOne({ trackingCode: data.trackingCode });
    if (!exists) { await Shipment.create(data); created++; }
  }
  console.log(`✅ Seeded ${created} shipments (${shipments.length - created} already existed)`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
