
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter your new admin password: ', async (password) => {
  try {
    if (!password) {
      console.log('Password cannot be empty.');
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    console.log('\nGenerated hash:\n' + hash);
  } catch (error) {
    console.error('Unable to generate password hash.');
  } finally {
    rl.close();
  }
});
