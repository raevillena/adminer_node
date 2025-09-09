#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Adminer Node...\n');

// Check if Node.js version is compatible
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18 or higher is required. Current version:', nodeVersion);
  process.exit(1);
}

console.log('✅ Node.js version check passed:', nodeVersion);

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, 'backend', '.env');
const envExamplePath = path.join(__dirname, 'backend', 'env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  console.log('📝 Creating .env file...');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created from template');
} else if (fs.existsSync(envPath)) {
  console.log('✅ .env file already exists');
}

// Install dependencies
console.log('\n📦 Installing dependencies...');

try {
  console.log('Installing root dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('Installing backend dependencies...');
  execSync('cd backend && npm install', { stdio: 'inherit' });

  console.log('Installing frontend dependencies...');
  execSync('cd frontend && npm install', { stdio: 'inherit' });

  console.log('✅ All dependencies installed successfully!');
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  process.exit(1);
}

// Create data directory for backend
const dataDir = path.join(__dirname, 'backend', 'data');
if (!fs.existsSync(dataDir)) {
  console.log('📁 Creating data directory...');
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Data directory created');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Edit backend/.env with your configuration');
console.log('2. Start the development servers: npm run dev');
console.log('3. Open http://localhost:3000 in your browser');
console.log('\n🔧 Available commands:');
console.log('- npm run dev          # Start both frontend and backend');
console.log('- npm run dev:backend  # Start only backend');
console.log('- npm run dev:frontend # Start only frontend');
console.log('- npm run build        # Build for production');
console.log('- npm start            # Start production server');
console.log('\n📚 For more information, see README.md');
