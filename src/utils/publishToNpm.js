'use strict'

const { execWithOutput } = require('./execWithOutput')
const { getPublishedInfo, getLocalInfo } = require('./packageInfo')
const { Octokit } = require('@octokit/rest')

async function allowNpmPublish(version) {
  // We need to check if the package was already published. This can happen if
  // the action was already executed before, but it failed in its last step
  // (GH release).

  const packageInfo = await getPublishedInfo()
  // Package has not been published before
  if (!packageInfo?.name) {
    return true
  }

  // NPM only looks into the remote registry when we pass an explicit
  // package name & version, so we don't have to fear that it reads the
  // info from the "local" package.json file.
  let packageVersionInfo

  try {
    // npm < v8.13.0 returns empty output, newer versions throw a E404
    // We handle both and consider them as package version not existing
    packageVersionInfo = await execWithOutput('npm', [
      'view',
      `${packageInfo.name}@${version}`,
    ])
  } catch (error) {
    if (!error?.message?.match(/code E404/)) {
      throw error
    }
  }

  return !packageVersionInfo
}

async function publishToNpm({
  npmToken,
  opticToken,
  opticUrl,
  npmTag,
  version,
  provenance,
  access,
}) {
  await execWithOutput('npm', [
    'config',
    'set',
    `//registry.npmjs.org/:_authToken=${npmToken}`,
  ])

  const flags = ['--tag', npmTag]

  if (access) {
    flags.push('--access', access)
  }

  if (provenance) {
    flags.push('--provenance')
  }

  if (await allowNpmPublish(version)) {
    await execWithOutput('npm', ['pack', '--dry-run'])
    const shouldGoNonOpticWay = true
    if (opticToken && !shouldGoNonOpticWay) {
      const packageInfo = await getLocalInfo()
      const otp = await execWithOutput('curl', [
        '-s',
        '-d',
        JSON.stringify({ packageInfo: { version, name: packageInfo?.name } }),
        '-H',
        'Content-Type: application/json',
        '-X',
        'POST',
        `${opticUrl}${opticToken}`,
      ])
      await execWithOutput('npm', ['publish', '--otp', otp, ...flags])
    } else {
      await execWithOutput('npm', ['publish', ...flags])
    }

    if (shouldGoNonOpticWay) {
      await triggerSecondaryWorkflow() // Trigger the secondary workflow
    }
  }
}

async function triggerSecondaryWorkflow() {
  const token = process.env.GITHUB_TOKEN
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
  const workflowFileName = 'optic-interactive-flow.yml'

  const octokit = new Octokit({ auth: token })

  try {
    const response = await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowFileName,
      ref: 'main',
    })

    console.log('Secondary workflow triggered successfully:', response.status)
    console.log('Secondary workflow full response:', JSON.stringify(response))
  } catch (error) {
    console.error('Failed to trigger secondary workflow:', error.message)
    throw error
  }
}

exports.publishToNpm = publishToNpm
