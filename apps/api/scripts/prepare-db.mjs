import { spawn } from 'node:child_process';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: false,
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(Object.assign(new Error(`${command} ${args.join(' ')} exited with code ${code}`), { stdout, stderr, code }));
      }
    });
  });
}

async function main() {
  await run('npm', ['run', 'prisma:generate']);

  try {
    await run('npm', ['run', 'prisma:push']);
  } catch (error) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`;
    const shouldRetry = /unique constraint/i.test(output) && /accept-data-loss/i.test(output);

    if (!shouldRetry) {
      throw error;
    }

    console.warn('Prisma push reported a unique constraint warning; retrying with --accept-data-loss.');
    await run('npx', ['prisma', 'db', 'push', '--accept-data-loss']);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
