console.log('Test script is running!');
console.log('Current directory:', __dirname);
 
require('dotenv').config();
 
console.log('\n.env variables:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set ✅' : 'Missing ❌');
console.log('GOOGLE_AI_KEY:', process.env.GOOGLE_AI_KEY ? 'Set ✅' : 'Missing ❌');