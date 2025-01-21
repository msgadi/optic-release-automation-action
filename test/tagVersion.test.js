'use strict'

const { test } = require('node:test')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const setup = () => {
  const execWithOutputStub = sinon.stub()
  const tagVersionProxy = proxyquire('../src/utils/tagVersion', {
    './execWithOutput': { execWithOutput: execWithOutputStub },
  })

  return { execWithOutputStub, tagVersionProxy }
}

test.afterEach(() => {
  sinon.restore()
})

test('Tag version in git', async () => {
  const { tagVersionProxy, execWithOutputStub } = setup()
  const version = 'v3.0.0'
  await tagVersionProxy.tagVersionInGit(version)

  assert.strictEqual(execWithOutputStub.callCount, 2)

  sinon.assert.calledWithExactly(execWithOutputStub, 'git', [
    'tag',
    '-f',
    `${version}`,
  ])
  sinon.assert.calledWithExactly(execWithOutputStub, 'git', [
    'push',
    'origin',
    '-f',
    `v3.0.0`,
  ])
})
