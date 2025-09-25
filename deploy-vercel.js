#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing Vercel deployment...');

// Create a temporary directory for Vercel
const vercelDir = '.vercel-temp';
if (fs.existsSync(vercelDir)) {
  fs.rmSync(vercelDir, { recursive: true });
}
fs.mkdirSync(vercelDir);

// Copy frontend files to root
console.log('📦 Copying frontend files...');
execSync('xcopy frontend\\* .vercel-temp\\ /E /I /Y', { stdio: 'inherit' });

// Copy package.json and other necessary files
fs.copyFileSync('frontend/package.json', path.join(vercelDir, 'package.json'));
fs.copyFileSync('frontend/package-lock.json', path.join(vercelDir, 'package-lock.json'));

// Create a simple vercel.json for the temp directory
const vercelConfig = {
  "version": 2,
  "buildCommand": "npm install && npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
};

fs.writeFileSync(
  path.join(vercelDir, 'vercel.json'),
  JSON.stringify(vercelConfig, null, 2)
);

console.log('✅ Vercel deployment files prepared in .vercel-temp/');
console.log('📝 To deploy:');
console.log('   1. cd .vercel-temp');
console.log('   2. vercel --prod');
console.log('   3. Set environment variables in Vercel dashboard');
