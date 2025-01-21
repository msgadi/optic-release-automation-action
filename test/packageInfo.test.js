'use strict'
const { test } = require('node:test')
const assert = require('assert')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const { getLocalInfo, getPublishedInfo } = require('../src/utils/packageInfo')

const mockPackageInfo = {
  name: 'some-package-name',
  license: 'some-license',
  publishConfig: {
    access: 'restricted',
  },
}

const setupPublished = ({
  value = JSON.stringify(mockPackageInfo),
  error,
} = {}) => {
  const execWithOutputStub = sinon.stub()
  const args = ['npm', ['view', '--json']]

  if (value) {
    execWithOutputStub.withArgs(...args).returns(value)
  }
  if (error) {
    execWithOutputStub.withArgs(...args).throws(error)
  }

  return proxyquire('../src/utils/packageInfo', {
    './execWithOutput': { execWithOutput: execWithOutputStub },
  })
}

const setupLocal = ({ value = JSON.stringify(mockPackageInfo) } = {}) => {
  const readFileSyncStub = sinon
    .stub()
    .withArgs('./package.json', 'utf8')
    .returns(value)

  return proxyquire('../src/utils/packageInfo', {
    fs: { readFileSync: readFileSyncStub },
  })
}

test('getPublishedInfo does not get any info for this package', async () => {
  // Check it works for real: this package is a Github Action, not published on NPM, so expect null
  const packageInfo = await getPublishedInfo()
  assert.strictEqual(packageInfo, null)
})

test('getPublishedInfo parses any valid JSON it finds', async () => {
  const mocks = setupPublished()

  const packageInfo = await mocks.getPublishedInfo()
  assert.deepStrictEqual(packageInfo, mockPackageInfo)
})

test(
  'getPublishedInfo continues and returns null if the request 404s',
  async () => {
    const mocks = setupPublished({
      value: JSON.stringify(mockPackageInfo),
      error: new Error('code E404 - package not found'),
    })

    const packageInfo = await mocks.getPublishedInfo()
    assert.strictEqual(packageInfo, null)
  }
)

test(
  'getPublishedInfo throws if it encounters an internal error',
  async () => {
    const mocks = setupPublished({
      value: "[{ 'this:' is not ] valid}j.s.o.n()",
    })

    await assert.rejects(mocks.getPublishedInfo, /JSON/)
  }
)

test(
  'getPublishedInfo continues and returns null if the request returns null',
  async () => {
    const mocks = setupPublished({
      value: null,
    })

    const packageInfo = await mocks.getPublishedInfo()
    assert.strictEqual(packageInfo, null)
  }
)

test('getPublishedInfo throws if it hits a non-404 error', async () => {
  const mocks = setupPublished({
    error: new Error('code E418 - unexpected teapot'),
  })

  await assert.rejects(mocks.getPublishedInfo, /teapot/)
})

test(
  'getLocalInfo gets real name and stable properties of this package',
  async () => {
    const packageInfo = getLocalInfo()
    // Check it works for real using real package.json properties that are stable
    assert.strictEqual(packageInfo.name, 'optic-release-automation-action')
    assert.strictEqual(packageInfo.license, 'MIT')
  }
)

test('getLocalInfo gets data from stringified JSON from file', async () => {
  const mocks = setupLocal()
  const packageInfo = mocks.getLocalInfo()
  assert.deepStrictEqual(packageInfo, mockPackageInfo)
})
