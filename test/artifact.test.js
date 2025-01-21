'use strict'

const { test, mock } = require('node:test')
const { ZIP_EXTENSION } = require('../src/const')

const DEFAULT_INPUT_DATA = {
  artifactPath: 'dist',
  releaseId: '1',
  token: 'token',
}

const setup = ({ throwsError }) => {
  const attachArtifactModule = mock('../src/utils/artifact.js', {
    '../src/utils/archiver.js': {
      archiveItem: async () => null,
    },
    'fs/promises': {
      stat: async () => 100,
      lstat: async () => ({ isDirectory: () => true }),
      readFile: async () => Buffer.from('hello world'),
    },
    '@actions/github': {
      context: {
        repo: {
          repo: 'repo',
          owner: 'owner',
        },
      },
      getOctokit: () => ({
        rest: {
          repos: {
            uploadReleaseAsset: async () => {
              if (throwsError) {
                throw new Error()
              }
              return {
                status: 201,
                data: { state: 'uploaded' },
              }
            },
          },
        },
      }),
    },
  })

  return { attachArtifactModule }
}

test(
  'attach artifact does not throw errors with proper inputs',
  async () => {
    const { attachArtifactModule } = setup({ throwsError: false })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    await assert.doesNotReject(
      attachArtifactModule.attach(artifactPath, releaseId, token)
    )
  }
)

test(
  'attach artifact does not throw errors with path ending with .zip',
  async () => {
    const { attachArtifactModule } = setup({ throwsError: false })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    await assert.doesNotReject(
      attachArtifactModule.attach(
        artifactPath + ZIP_EXTENSION,
        releaseId,
        token
      )
    )
  }
)

test(
  'attach artifact throws an error if build folder not found',
  async () => {
    const artifactModule = mock('../src/utils/artifact.js', {
      '../src/utils/archiver.js': {
        archiveItem: async () => {
          throw new Error('file not found')
        },
      },
    })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    await assert.rejects(artifactModule.attach(artifactPath, releaseId, token))
  }
)

test(
  'attach artifact throws an error if an error occurres during the asset upload',
  async () => {
    const { attachArtifactModule } = setup({ throwsError: true })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    await assert.rejects(attachArtifactModule.attach(artifactPath, releaseId, token))
  }
)

test(
  'attach artifact throws an error if the upload asset state is not uploaded',
  async () => {
    const artifactModule = mock('../src/utils/artifact.js', {
      '../src/utils/archiver.js': {
        archiveItem: async () => null,
      },
      'fs/promises': {
        stat: async () => 100,
        lstat: async () => ({ isDirectory: () => true }),
        readFile: async () => Buffer.from('hello world'),
      },
      '@actions/github': {
        context: {
          repo: {
            repo: 'repo',
            owner: 'owner',
          },
        },
        getOctokit: () => ({
          rest: {
            repos: {
              uploadReleaseAsset: async () => ({
                status: 201,
                data: { state: 'not_uploaded' },
              }),
            },
          },
        }),
      },
    })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    await assert.rejects(artifactModule.attach(artifactPath, releaseId, token))
  }
)
