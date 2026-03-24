require('dotenv').config();
 
console.log('=== GOOGLE OAUTH SETUP CHECK ===\n');
 
if (process.env.GOOGLE_CLIENT_ID) {
  console.log('✅ GOOGLE_CLIENT_ID is set');
  console.log('Client ID starts with:', process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...');
  
  if (process.env.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')) {
    console.log('✅ Client ID format looks correct');
  } else {
    console.log('⚠️ Client ID might be wrong format (should end with .apps.googleusercontent.com)');
  }
} else {
  console.log('❌ GOOGLE_CLIENT_ID is NOT set!');
  console.log('\nFIX: Add this to your .env file:');
  console.log('GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com');
}
 
console.log('\n=== DONE ===');
 