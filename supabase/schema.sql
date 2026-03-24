-- MineForge Supabase Schema
-- Bitcoin Mining Calculator Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Miners table (ASIC database)
CREATE TABLE miners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  hash_rate_ths DECIMAL(10, 2) NOT NULL,
  power_watts INTEGER NOT NULL,
  price_usd DECIMAL(10, 2) NOT NULL,
  efficiency_jth DECIMAL(6, 2) NOT NULL,
  release_year INTEGER NOT NULL,
  watercooled BOOLEAN NOT NULL DEFAULT FALSE,
  degradation_year1 DECIMAL(4, 2) DEFAULT 2.0,
  degradation_year2 DECIMAL(4, 2) DEFAULT 5.0,
  degradation_year3plus DECIMAL(4, 2) DEFAULT 8.0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved farms table
CREATE TABLE farms (
  id TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_miners_hashrate ON miners(hash_rate_ths DESC);
CREATE INDEX idx_miners_manufacturer ON miners(manufacturer);
CREATE INDEX idx_miners_efficiency ON miners(efficiency_jth);
CREATE INDEX idx_farms_created ON farms(created_at DESC);

-- Insert sample miners (50+ real ASICs)
INSERT INTO miners (id, name, manufacturer, algorithm, hash_rate_ths, power_watts, price_usd, efficiency_jth, release_year) VALUES
-- Bitmain Antminers
('s21-pro', 'Antminer S21 Pro', 'Bitmain', 'SHA-256', 234, 3510, 5499, 15.0, 2024),
('s21-hyd', 'Antminer S21 Hyd', 'Bitmain', 'SHA-256', 335, 5360, 7999, 16.0, 2024),
('s21', 'Antminer S21', 'Bitmain', 'SHA-256', 200, 3500, 4999, 17.5, 2023),
('s19-xp-hyd', 'Antminer S19 XP Hyd', 'Bitmain', 'SHA-256', 255, 5304, 6500, 20.8, 2023),
('s19-xp', 'Antminer S19 XP', 'Bitmain', 'SHA-256', 140, 3010, 3800, 21.5, 2022),
('s19-pro', 'Antminer S19 Pro', 'Bitmain', 'SHA-256', 110, 3250, 2800, 29.5, 2021),
('s19j-pro', 'Antminer S19j Pro', 'Bitmain', 'SHA-256', 100, 3050, 2500, 30.5, 2021),
('s19', 'Antminer S19', 'Bitmain', 'SHA-256', 95, 3250, 2200, 34.2, 2020),
('s17-pro', 'Antminer S17 Pro', 'Bitmain', 'SHA-256', 53, 2094, 1200, 39.5, 2019),

-- MicroBT Whatsminer
('m60s', 'Whatsminer M60S', 'MicroBT', 'SHA-256', 186, 3344, 4299, 18.0, 2024),
('m60', 'Whatsminer M60', 'MicroBT', 'SHA-256', 172, 3344, 3999, 19.4, 2024),
('m56s', 'Whatsminer M56S++', 'MicroBT', 'SHA-256', 242, 5550, 6499, 22.9, 2023),
('m53s', 'Whatsminer M53S++', 'MicroBT', 'SHA-256', 320, 6800, 7999, 21.3, 2023),
('m50s', 'Whatsminer M50S++', 'MicroBT', 'SHA-256', 154, 3332, 3499, 21.6, 2022),
('m30s', 'Whatsminer M30S++', 'MicroBT', 'SHA-256', 112, 3472, 2599, 31.0, 2021),
('m30s-pro', 'Whatsminer M30S+ Pro', 'MicroBT', 'SHA-256', 110, 3400, 2499, 30.9, 2021),

-- Canaan AvalonMiner
('a1466', 'AvalonMiner 1466', 'Canaan', 'SHA-256', 150, 3500, 3299, 23.3, 2023),
('a1366', 'AvalonMiner 1366', 'Canaan', 'SHA-256', 130, 3250, 2899, 25.0, 2022),
('a1346', 'AvalonMiner 1346', 'Canaan', 'SHA-256', 110, 3250, 2499, 29.5, 2022),
('a1266', 'AvalonMiner 1266', 'Canaan', 'SHA-256', 100, 3400, 2199, 34.0, 2021),
('a1246', 'AvalonMiner 1246', 'Canaan', 'SHA-256', 90, 3420, 1899, 38.0, 2020),

-- Goldshell
('ck6', 'CK6', 'Goldshell', 'SHA-256', 26.5, 2250, 1799, 84.9, 2023),
('ck5', 'CK5', 'Goldshell', 'SHA-256', 12, 930, 999, 77.5, 2022),

-- Ebang
('e12', 'Ebit E12+', 'Ebang', 'SHA-256', 50, 2500, 1199, 50.0, 2020),
('e11', 'Ebit E11++', 'Ebang', 'SHA-256', 44, 1980, 999, 45.0, 2019),

-- Additional modern miners
('s21-ultra', 'Antminer S21 Ultra', 'Bitmain', 'SHA-256', 260, 3900, 6299, 15.0, 2024),
('m66s', 'Whatsminer M66S', 'MicroBT', 'SHA-256', 280, 5200, 7499, 18.6, 2024),
('a1566', 'AvalonMiner 1566', 'Canaan', 'SHA-256', 185, 3650, 4199, 19.7, 2024),

-- Budget/older models (for comparison)
('s9', 'Antminer S9', 'Bitmain', 'SHA-256', 13.5, 1323, 200, 98.0, 2017),
('t19', 'Antminer T19', 'Bitmain', 'SHA-256', 84, 3150, 1899, 37.5, 2020),
('m21s', 'Whatsminer M21S', 'MicroBT', 'SHA-256', 56, 3360, 1299, 60.0, 2020)

ON CONFLICT (id) DO NOTHING;

-- Mark water-cooled miners
UPDATE miners SET watercooled = TRUE WHERE id IN (
  's21-hyd', 's19-xp-hyd', 's19-hydro', 's19-pro-hyd'
);

-- Add more miners to reach 50+
INSERT INTO miners (id, name, manufacturer, algorithm, hash_rate_ths, power_watts, price_usd, efficiency_jth, release_year) VALUES
('s19k-pro', 'Antminer S19k Pro', 'Bitmain', 'SHA-256', 120, 2760, 3199, 23.0, 2022),
('s19-hydro', 'Antminer S19 Hydro', 'Bitmain', 'SHA-256', 198, 5445, 5999, 27.5, 2022),
('m50', 'Whatsminer M50', 'MicroBT', 'SHA-256', 114, 3276, 2799, 28.7, 2022),
('m50s-pro', 'Whatsminer M50S+', 'MicroBT', 'SHA-256', 126, 3306, 3099, 26.2, 2022),
('a1426', 'AvalonMiner 1426', 'Canaan', 'SHA-256', 150, 3420, 3399, 22.8, 2023),
('s19-pro-hyd', 'Antminer S19 Pro+ Hyd', 'Bitmain', 'SHA-256', 198, 5445, 5699, 27.5, 2022),
('m33s', 'Whatsminer M33S++', 'MicroBT', 'SHA-256', 212, 5060, 5499, 23.9, 2022),
('m33s-pro', 'Whatsminer M33S+ Pro', 'MicroBT', 'SHA-256', 204, 4950, 5299, 24.3, 2022),
('a1346-pro', 'AvalonMiner 1346 Pro', 'Canaan', 'SHA-256', 130, 3250, 2999, 25.0, 2022),
('s19-pro-plus', 'Antminer S19 Pro+', 'Bitmain', 'SHA-256', 120, 3060, 3299, 25.5, 2022),
('m31s', 'Whatsminer M31S+', 'MicroBT', 'SHA-256', 82, 3220, 1899, 39.3, 2020),
('m31s-pro', 'Whatsminer M31S+ Pro', 'MicroBT', 'SHA-256', 80, 3100, 1799, 38.8, 2020),
('a1166-pro', 'AvalonMiner 1166 Pro', 'Canaan', 'SHA-256', 81, 3400, 1999, 42.0, 2020),
('t17', 'Antminer T17+', 'Bitmain', 'SHA-256', 64, 3200, 1499, 50.0, 2020),
('t17e', 'Antminer T17e', 'Bitmain', 'SHA-256', 53, 2915, 1199, 55.0, 2019),
('s17e', 'Antminer S17e', 'Bitmain', 'SHA-256', 64, 2880, 1599, 45.0, 2019),
('m20s', 'Whatsminer M20S', 'MicroBT', 'SHA-256', 68, 3360, 1399, 49.4, 2019),
('a1066', 'AvalonMiner 1066', 'Canaan', 'SHA-256', 50, 3250, 999, 65.0, 2019),
('a1166', 'AvalonMiner 1166', 'Canaan', 'SHA-256', 68, 3400, 1599, 50.0, 2020)

ON CONFLICT (id) DO NOTHING;

-- Dry Coolers table
CREATE TABLE dry_coolers (
  model TEXT PRIMARY KEY,
  kw_capacity_35c DECIMAL(10, 2) NOT NULL,
  water_flow_m3h DECIMAL(10, 3) NOT NULL,
  pressure_drop_kpa DECIMAL(8, 1) NOT NULL,
  air_flow_m3h DECIMAL(10, 1) NOT NULL,
  fan_motor_w INTEGER NOT NULL,
  fan_motor_a DECIMAL(6, 2) NOT NULL,
  sound_dba DECIMAL(5, 1) NOT NULL,
  length_mm INTEGER NOT NULL,
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  inlet_mm TEXT NOT NULL,
  weight_kg DECIMAL(8, 1) NOT NULL,
  estimated_cost_usd DECIMAL(10, 2) NOT NULL,
  man_hours_deploy DECIMAL(6, 1) NOT NULL,
  plumbing_fluid_cost_usd DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dry_coolers_kw ON dry_coolers(kw_capacity_35c);

INSERT INTO dry_coolers (model,kw_capacity_35c,water_flow_m3h,pressure_drop_kpa,air_flow_m3h,fan_motor_w,fan_motor_a,sound_dba,length_mm,width_mm,height_mm,inlet_mm,weight_kg,estimated_cost_usd,man_hours_deploy,plumbing_fluid_cost_usd) VALUES
('D1-005-1x350',4.89,0.85,36,2828,140,0.6,31,870,525,797,'3/4"',38,800,4,120),
('D1-006-1x350',5.90,1.03,31,2712,140,0.6,31,870,525,797,'3/4"',42,850,4,120),
('D1-007-1x350',6.83,1.20,58,2492,140,0.6,31,870,525,797,'3/4"',48,900,4,130),
('D1-009-1x450',9.39,1.63,25,6199,540,1.1,43,1020,625,820,'1"',55,1400,6,200),
('D1-011-1x450',10.99,1.91,40,5827,540,1.1,43,1020,625,820,'1"',60,1500,6,200),
('D1-013-1x450',13.33,2.30,80,5225,540,1.1,43,1020,625,820,'1"',67,1600,6,220),
('D1-014-1x500',14.32,2.50,50,8469,830,1.45,49,1220,825,870,'1-1/4"',75,1900,8,250),
('D1-017-1x500',17.01,3.00,60,8168,830,1.45,49,1220,825,870,'1-1/4"',82,2100,8,280),
('D1-020-1x500',19.80,3.50,40,7601,830,1.45,49,1220,825,870,'1-1/4"',91,2300,8,300),
('D4-176-4X800',175.6,30.5,98,86771,7200,15.2,54,2670,2250,2000,'2x2-1/2"',698,8500,12,1200),
('D4-191-4X800',190.6,33.1,84,83195,7200,15.2,54,2670,2250,2000,'2x2-1/2"',735,9200,12,1250),
('D4-205-4X800',205.4,35.7,70,79955,7200,15.2,54,2670,2250,2000,'2x2-1/2"',835,9800,12,1300),
('D4-267-6X800',266.5,46.3,48,13054,10800,22.8,56,3870,2250,2000,'2x3"',1135,14500,16,1800),
('D4-291-6X800',291.2,50.6,39,124786,10800,22.8,56,3870,2250,2000,'2x3"',1225,15200,16,1900),
('D4-315-6X800',314.6,54.7,93,119924,10800,22.8,56,3870,2250,2000,'2x3"',1617,16500,16,2000),
('D4-361-8X800',361.4,62.8,98,173533,14400,30.4,58,5070,2250,2000,'2x4"',1753,19500,20,2400),
('D4-394-8X800',394.4,68.6,82,166376,14400,30.4,58,5070,2250,2000,'2x4"',1894,20500,20,2500),
('D4-414-8X800',414.4,72.1,65,159905,14400,30.4,58,5070,2250,2000,'2x4"',2042,21500,20,2600),
('D4-428-10X800',427.6,74.3,28,216938,18000,38,60,6270,2520,2000,'2x4"',2159,24500,24,2800),
('D4-488-10X800',488.1,84.9,60,202183,18000,38,60,6270,2520,2000,'2xDN125',2250,26500,24,3000),
('D4-510-10X800',509.9,88.7,48,193538,18000,38,60,6270,2520,2000,'2xDN125',2327,27500,24,3100),
('D4-520-12X800',519.9,90.4,43,260320,21600,45.6,62,7470,2520,2000,'2xDN125',2480,29500,28,3400),
('D4-591-12X800',590.7,102.7,99,242613,21600,45.6,62,7470,2520,2000,'2xDN125',2568,31500,28,3600),
('D4-617-12X800',616.7,107.2,78,232238,21600,45.6,62,7470,2520,2000,'2xDN125',2741,32500,28,3700),
('D4-724-14X800',723.6,125.8,99,270940,25200,53.2,64,8670,2520,2000,'2xDN125',2947,38000,32,4200),
('D4-792-16X800',791.6,137.6,99,323168,28800,60.8,66,9870,2520,2000,'2xDN125',3342,42000,36,4600)
ON CONFLICT (model) DO NOTHING;

-- Air Fans table
CREATE TABLE air_fans (
  model TEXT PRIMARY KEY,
  diameter_mm INTEGER NOT NULL,
  hz INTEGER NOT NULL,
  rpm INTEGER NOT NULL,
  airflow_m3h INTEGER NOT NULL,
  noise_db DECIMAL(5, 1) NOT NULL,
  power_w INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  width_mm INTEGER NOT NULL,
  cost_usd DECIMAL(10, 2) NOT NULL,
  man_hours_deploy DECIMAL(6, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_air_fans_airflow ON air_fans(airflow_m3h);

INSERT INTO air_fans (model,diameter_mm,hz,rpm,airflow_m3h,noise_db,power_w,height_mm,width_mm,cost_usd,man_hours_deploy) VALUES
('JMD-1000 (36")',900,50,1400,35000,64,750,1000,1000,150,2),
('JMD-1380 (50")',1250,50,1400,48000,64,1100,1380,1380,180,2.5),
('JMD-1530 (56")',1400,50,1400,55800,64,1500,1530,1530,240,3)
ON CONFLICT (model) DO NOTHING;

-- Row-level security (optional - disabled for this MVP)
-- ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
