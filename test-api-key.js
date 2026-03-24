require('dotenv').config();
 
console.log('=== ENVIRONMENT VARIABLES CHECK ===\n');
 
// Check all critical variables
const checks = {
  'PORT': process.env.PORT,
  'NODE_ENV': process.env.NODE_ENV,
  'MONGO_URI': process.env.MONGO_URI ? '✅ Set' : '❌ Missing',
  'JWT_SECRET': process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
  'GOOGLE_AI_KEY': process.env.GOOGLE_AI_KEY ? '✅ Set' : '❌ Missing',
  'EMAIL_USER': process.env.EMAIL_USER ? '✅ Set' : '❌ Missing',
  'CLOUDINARY_CLOUD_NAME': process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing'
};
 
Object.entries(checks).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});
 
console.log('\n=== GOOGLE AI KEY CHECK ===\n');
 
if (process.env.GOOGLE_AI_KEY) {
  console.log('✅ GOOGLE_AI_KEY is set');
  console.log('Key starts with:', process.env.GOOGLE_AI_KEY.substring(0, 10) + '...');
  console.log('Key length:', process.env.GOOGLE_AI_KEY.length, 'characters');
  
  if (process.env.GOOGLE_AI_KEY.length < 30) {
    console.log('⚠️ WARNING: Key seems too short!');
  }
} else {
  console.log('❌ GOOGLE_AI_KEY is NOT set!');
  console.log('');
  console.log('FIX: Add this to your .env file:');
  console.log('GOOGLE_AI_KEY=your_key_from_google');
}
 
console.log('\n=== DONE ===');
 