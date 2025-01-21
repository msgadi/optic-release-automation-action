'use strict'

const { test, mock } = require('node:test')
const assert = require('assert')
const sinon = require('sinon')
const actionLog = require('../src/log')

const TOKEN = 'GH-TOKEN'
const TAG = 'v1.0.1'

const setup = ({ throwsError }) => {
  const logStub = sinon.stub(actionLog)
  const releasesModule = mock('../src/utils/releases.js', {
    '../src/log.js': logStub,
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
            getLatestRelease: async () => {
              if (throwsError) {
                throw new Error()
              }
              return {
                status: 200,
                data: {},
              }
            },
            generateReleaseNotes: async () => {
              if (throwsError) {
                throw new Error()
              }
              return {
                status: 200,
                data: {},
              }
            },
            getReleaseByTag: async () => {
              if (throwsError) {
                throw new Error()
              }
              return {
                status: 200,
                data: {},
              }
            },
          },
        },
      }),
    },
  })

  return { logStub, releasesModule }
}

test.afterEach(() => {
  sinon.restore()
})

test('fetchLatestRelease return properly the latest release', async () => {
  const { releasesModule } = setup({ throwsError: false })

  await assert.doesNotReject(releasesModule.fetchLatestRelease(TOKEN))
})

test(
  'fetchLatestRelease throws an error if an exception occurs while calling GitHub APIs',
  async () => {
    const { releasesModule } = setup({ throwsError: true })

    await assert.rejects(releasesModule.fetchLatestRelease(TOKEN))
  }
)

test(
  'generateReleaseNotes return properly the generated release notes',
  async () => {
    const { releasesModule } = setup({ throwsError: false })

    await assert.doesNotReject(
      releasesModule.generateReleaseNotes(TOKEN, '1.1.0', '1.0.0')
    )
  }
)

test(
  'generateReleaseNotes throws an error if an exception occurs while calling GitHub APIs',
  async () => {
    const { releasesModule } = setup({ throwsError: true })

    await assert.rejects(releasesModule.generateReleaseNotes(TOKEN))
  }
)

test(
  'fetchLatestRelease returns null if no previous releases are found',
  async () => {
    const logStub = sinon.stub(actionLog)
    const releasesModule = mock('../src/utils/releases.js', {
      '../src/log.js': logStub,
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
              getLatestRelease: async () => {
                throw new Error('Not Found')
              },
            },
          },
        }),
      },
    })

    await assert.doesNotReject(releasesModule.fetchLatestRelease(TOKEN))
  }
)

test('fetchReleaseByTag return properly the specified release', async () => {
  const { releasesModule } = setup({ throwsError: false })

  await assert.doesNotReject(releasesModule.fetchReleaseByTag(TOKEN, TAG))
})

test(
  'fetchReleaseByTag throws an error if an exception occurs while calling GitHub APIs',
  async () => {
    const { releasesModule } = setup({ throwsError: true })

    await assert.rejects(releasesModule.fetchReleaseByTag(TOKEN, TAG))
  }
)

test('fetchReleaseByTag throws an error if Not Found', async () => {
  const logStub = sinon.stub(actionLog)
  const releasesModule = mock('../src/utils/releases.js', {
    '../src/log.js': logStub,
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
            getReleaseByTag: async () => {
              throw new Error('Not Found')
            },
          },
        },
      }),
    },
  })

  await assert.rejects(releasesModule.fetchReleaseByTag(TOKEN, TAG))
})
