'use strict'

const { test, mock } = require('node:test')
const assert = require('assert')

const setup = ({ isDirectory }) => {
  const archiverModule = mock('../src/utils/archiver.js', {
    'fs/promises': {
      lstat: async () => ({
        isDirectory: () => isDirectory,
      }),
    },
    'adm-zip': function Mocked() {
      this.addLocalFolderPromise = async function () {
        return null
      }
      this.addLocalFile = function () {
        return null
      }
      this.writeZipPromise = async function () {
        return null
      }
    },
  })

  return { archiverModule }
}

test('throws an error if path not found', async () => {
  const archiverModule = mock('../src/utils/archiver.js', {
    'fs/promises': {
      lstat: async () => ({
        isDirectory: () => {
          throw Error()
        },
      }),
    },
  })

  await assert.rejects(archiverModule.archiveItem('path', 'out.zip'))
})

test('does not throw any errors if directory', async () => {
  const { archiverModule } = setup({ isDirectory: true })

  await assert.doesNotReject(archiverModule.archiveItem('path', 'out.zip'))
})

test('throws if writing to zip file fails', async () => {
  const archiverModule = mock('../src/utils/archiver.js', {
    'fs/promises': {
      lstat: async () => ({
        isDirectory: () => true,
      }),
    },
    'adm-zip': function Mocked() {
      this.addLocalFolderPromise = async function () {
        return null
      }
      this.addLocalFile = function () {
        return null
      }
      this.writeZipPromise = async function () {
        return Promise.reject()
      }
    },
  })

  await assert.rejects(archiverModule.archiveItem('path', 'out.zip'))
})

test('resolves if a path is not a directory', async () => {
  const archiverModule = mock('../src/utils/archiver.js', {
    'fs/promises': {
      lstat: async () => ({
        isDirectory: () => false,
      }),
    },
    'adm-zip': function Mocked() {
      this.addLocalFolderPromise = async function () {
        return Promise.reject()
      }
      this.addLocalFile = function () {
        return undefined
      }
      this.writeZipPromise = async function () {
        return null
      }
    },
  })

  await assert.doesNotReject(archiverModule.archiveItem('path', 'out.zip'))
})

test('does not throw any errors if file', async () => {
  const { archiverModule } = setup({ isDirectory: false })

  await assert.doesNotReject(archiverModule.archiveItem('file.js', 'out.zip'))
})
