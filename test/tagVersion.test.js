'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const setup = () => {
  const execWithOutputStub = sinon.stub()
  const tagVersionProxy = proxyquire('../src/utils/tagVersion', {
    './execWithOutput': { execWithOutput: execWithOutputStub },
  })

  return { execWithOutputStub, tagVersionProxy }
}

tap.afterEach(() => {
  sinon.restore()
})

tap.test('Tag version in git', async t => {
  const { tagVersionProxy, execWithOutputStub } = setup()
  const version = 'v3.0.0'
  await tagVersionProxy.tagVersionInGit(version)

  t.ok(execWithOutputStub.callCount === 2)

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

tap.test('Tag version in git with different version', async t => {
  const { tagVersionProxy, execWithOutputStub } = setup()
  const version = 'v1.2.3'
  await tagVersionProxy.tagVersionInGit(version)

  t.ok(execWithOutputStub.callCount === 2)

  sinon.assert.calledWithExactly(execWithOutputStub, 'git', [
    'tag',
    '-f',
    `${version}`,
  ])
  sinon.assert.calledWithExactly(execWithOutputStub, 'git', [
    'push',
    'origin',
    '-f',
    `v1.2.3`,
  ])
})

tap.test('Tag version in git with empty version', async t => {
  const { tagVersionProxy, execWithOutputStub } = setup()
  const version = ''
  await tagVersionProxy.tagVersionInGit(version)

  t.ok(execWithOutputStub.callCount === 2)

  sinon.assert.calledWithExactly(execWithOutputStub, 'git', [
    'tag',
    '-f',
    `${version}`,
  ])
  sinon.assert.calledWithExactly(execWithOutputStub, 'git', [
    'push',
    'origin',
    '-f',
    ``,
  ])
})
