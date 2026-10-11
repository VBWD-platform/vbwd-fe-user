/**
 * Runs a backend Flask CLI command inside the running `api` compose service.
 *
 * Shared by global setup (seed-test-data) and teardown (cleanup-test-data).
 *
 * Environment Variables:
 *   VBWD_BACKEND_DIR: vbwd-backend checkout holding docker-compose.yaml
 *                     (default: the sibling ../vbwd-backend of this fe-user repo)
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const SIBLING_BACKEND_DIR = fileURLToPath(new URL('../../../../../vbwd-backend', import.meta.url));
const BACKEND_COMMAND_TIMEOUT_MS = 60000;

export function runBackendFlaskCommand(command: string, enableFlag: string): void {
  const backendDir = process.env.VBWD_BACKEND_DIR || SIBLING_BACKEND_DIR;
  execSync(
    `docker compose exec -T -e ${enableFlag}=true api flask --app "vbwd:create_app()" ${command}`,
    { cwd: backendDir, stdio: 'inherit', timeout: BACKEND_COMMAND_TIMEOUT_MS },
  );
}
