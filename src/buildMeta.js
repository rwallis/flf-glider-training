import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function trimEnv(value) {
  return String(value ?? '').trim() || null;
}

export function readPackageVersion() {
  try {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.1.0';
  } catch {
    return process.env.APP_VERSION?.trim() || '0.1.0';
  }
}

export function readInstanceBuildMeta() {
  const deploymentId = trimEnv(process.env.RAILWAY_DEPLOYMENT_ID);
  const gitCommit = trimEnv(process.env.RAILWAY_GIT_COMMIT_SHA);
  const environment =
    trimEnv(process.env.RAILWAY_ENVIRONMENT_NAME) || trimEnv(process.env.RAILWAY_ENVIRONMENT);

  return {
    deployment_id: deploymentId,
    git_commit: gitCommit ? gitCommit.slice(0, 7) : null,
    environment,
    service_id: trimEnv(process.env.RAILWAY_SERVICE_ID),
    project_id: trimEnv(process.env.RAILWAY_PROJECT_ID),
    environment_id: trimEnv(process.env.RAILWAY_ENVIRONMENT_ID),
    is_railway: Boolean(deploymentId || process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_PROJECT_ID)
  };
}

export function getAppBuildMeta(serviceName = 'glider-training') {
  const instance = readInstanceBuildMeta();
  return {
    ok: true,
    service: serviceName,
    version: readPackageVersion(),
    git_commit: instance.git_commit,
    environment: instance.environment,
    deployment_id: instance.deployment_id,
    is_railway: instance.is_railway
  };
}

export function formatAppVersionText(meta = {}) {
  const commit = meta.git_commit ? ` · ${meta.git_commit}` : '';
  const env = meta.environment ? ` · ${meta.environment}` : '';
  return `v${meta.version || '?'}${commit}${env}`;
}

/**
 * Compare the deployment id the browser loaded with the live process.
 * After Railway rolls a new deploy, live id changes → refresh recommended.
 */
export function deriveDeployUiState({
  instanceDeploymentId = null,
  pageLoadDeploymentId = null
} = {}) {
  const baselineId = trimEnv(pageLoadDeploymentId) || trimEnv(instanceDeploymentId);
  const liveId = trimEnv(instanceDeploymentId);

  if (baselineId && liveId && baselineId !== liveId) {
    return {
      label: 'New version ready',
      tone: 'ready',
      refresh_recommended: true
    };
  }

  if (liveId) {
    return {
      label: 'Live',
      tone: 'ok',
      refresh_recommended: false
    };
  }

  return {
    label: 'Local',
    tone: 'muted',
    refresh_recommended: false
  };
}

export function getDeployStatusPayload({ pageLoadDeploymentId = null } = {}) {
  const instance = readInstanceBuildMeta();
  const ui = deriveDeployUiState({
    instanceDeploymentId: instance.deployment_id,
    pageLoadDeploymentId
  });
  return {
    ok: true,
    instance,
    ui,
    version: readPackageVersion()
  };
}
