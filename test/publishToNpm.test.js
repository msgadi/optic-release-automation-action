'use strict'

const { test } = require('node:test')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const setup = ({
  packageName = 'fakeTestPkg',
  published = true,
  mockPackageInfo,
  otpFlow = 'optic',
} = {}) => {
  const execWithOutputStub = sinon.stub()

  // npm behavior < v8.13.0
  execWithOutputStub
    .withArgs('npm', ['view', `${packageName}@v5.1.3`])
    .returns('')

  const getLocalInfo = () => ({ name: packageName })
  const getPublishedInfo = async () =>
    published ? { name: packageName } : null

  // Conditional setup based on otpFlow
  let proxyConfig = {
    './packageInfo': mockPackageInfo
      ? mockPackageInfo({ execWithOutputStub, getLocalInfo, getPublishedInfo })
      : {
          getLocalInfo,
          getPublishedInfo,
        },
  }
  if (otpFlow === 'optic') {
    execWithOutputStub
      .withArgs('curl', [
        '-s',
        '-d',
        JSON.stringify({
          packageInfo: { version: 'v5.1.3', name: 'fakeTestPkg' },
        }),
        '-H',
        'Content-Type: application/json',
        '-X',
        'POST',
        'https://optic-test.run.app/api/generate/optic-token',
      ])
      .returns('otp123')
    proxyConfig['./execWithOutput'] = { execWithOutput: execWithOutputStub }
  } else if (otpFlow === 'ngrok') {
    // Setup for ngrok flow
    const otpVerification = sinon.stub().resolves('ngrok123')
    proxyConfig = {
      ...proxyConfig,
      './execWithOutput': { execWithOutput: execWithOutputStub },
      './ngrokOtpVerification': otpVerification,
    }
  }

  const publishToNpmProxy = proxyquire('../src/utils/publishToNpm', proxyConfig)

  return {
    execWithOutputStub,
    publishToNpmProxy,
    otpVerificationStub: proxyConfig['./ngrokOtpVerification'],
  }
}

test.afterEach(() => {
  sinon.restore()
})

test('Should publish to npm with optic', async () => {
  const { publishToNpmProxy, execWithOutputStub } = setup()
  await publishToNpmProxy.publishToNpm({
    npmToken: 'a-token',
    opticToken: 'optic-token',
    opticUrl: 'https://optic-test.run.app/api/generate/',
    npmTag: 'latest',
    version: 'v5.1.3',
  })

  sinon.assert.calledWithExactly(execWithOutputStub.getCall(0), 'npm', [
    'config',
    'set',
    '//registry.npmjs.org/:_authToken=a-token',
  ])
  assert.pass('npm config')

  sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
    'pack',
    '--dry-run',
  ])
  assert.pass('npm pack called')

  sinon.assert.calledWithExactly(execWithOutputStub, 'curl', [
    '-s',
    '-d',
    JSON.stringify({ packageInfo: { version: 'v5.1.3', name: 'fakeTestPkg' } }),
    '-H',
    'Content-Type: application/json',
    '-X',
    'POST',
    'https://optic-test.run.app/api/generate/optic-token',
  ])
  assert.pass('curl called')

  sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
    'publish',
    '--otp',
    'otp123',
    '--tag',
    'latest',
  ])
  assert.pass('npm publish called')
})

test(
  "Should publish to npm when package hasn't been published before",
  async () => {
    const { publishToNpmProxy, execWithOutputStub } = setup({
      published: false,
    })

    await publishToNpmProxy.publishToNpm({
      npmToken: 'a-token',
      opticUrl: 'https://optic-test.run.app/api/generate/',
      npmTag: 'latest',
      version: 'v5.1.3',
    })

    sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
      'pack',
      '--dry-run',
    ])
    assert.pass('npm pack called')

    sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
      'publish',
      '--tag',
      'latest',
    ])
    assert.pass('npm publish called')
  }
)

test('Should publish to npm without optic', async () => {
  const { publishToNpmProxy, execWithOutputStub } = setup()
  await publishToNpmProxy.publishToNpm({
    npmToken: 'a-token',
    opticUrl: 'https://optic-test.run.app/api/generate/',
    npmTag: 'latest',
    version: 'v5.1.3',
  })

  sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
    'pack',
    '--dry-run',
  ])
  assert.pass('npm pack called')

  sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
    'publish',
    '--tag',
    'latest',
  ])
  assert.pass('npm publish called')
})

test(
  'Should skip npm package publication when it was already published',
  async () => {
    const { publishToNpmProxy, execWithOutputStub } = setup()

    execWithOutputStub
      .withArgs('npm', ['view', 'fakeTestPkg@v5.1.3'])
      .returns('fake package data that says it was published')

    await publishToNpmProxy.publishToNpm({
      npmToken: 'a-token',
      opticUrl: 'https://optic-test.run.app/api/generate/',
      npmTag: 'latest',
      version: 'v5.1.3',
    })

    sinon.assert.neverCalledWith(execWithOutputStub, 'npm', [
      'publish',
      '--otp',
      'otp123',
      '--tag',
      'latest',
    ])
    assert.pass('publish never called with otp')

    sinon.assert.neverCalledWith(execWithOutputStub, 'npm', [
      'publish',
      '--tag',
      'latest',
    ])
    assert.pass('publish never called')
  }
)

test('Should stop action if package info retrieval fails', async () => {
  assert.plan(3)
  const { publishToNpmProxy, execWithOutputStub } = setup({
    // Use original getPublishedInfo logic with execWithOutputStub injected into it
    mockPackageInfo: ({ getLocalInfo, execWithOutputStub }) => ({
      getLocalInfo,
      getPublishedInfo: proxyquire('../src/utils/packageInfo', {
        './execWithOutput': { execWithOutput: execWithOutputStub },
      }).getPublishedInfo,
    }),
  })
  execWithOutputStub
    .withArgs('npm', ['view', '--json'])
    .throws(new Error('Network Error'))

  try {
    await publishToNpmProxy.publishToNpm({
      npmToken: 'a-token',
      opticUrl: 'https://optic-test.run.app/api/generate/',
      npmTag: 'latest',
      version: 'v5.1.3',
    })
  } catch (e) {
    assert.equal(e.message, 'Network Error')
  }

  sinon.assert.neverCalledWith(execWithOutputStub, 'npm', [
    'publish',
    '--otp',
    'otp123',
    '--tag',
    'latest',
  ])
  assert.pass('package is not published with otp code')

  sinon.assert.neverCalledWith(execWithOutputStub, 'npm', [
    'publish',
    '--tag',
    'latest',
  ])
  assert.pass('package is not published without otp code')
})

test(
  'Should stop action if package version info retrieval fails',
  async () => {
    assert.plan(3)
    const { publishToNpmProxy, execWithOutputStub } = setup()

    execWithOutputStub
      .withArgs('npm', ['view', 'fakeTestPkg@v5.1.3'])
      .throws(new Error('Network Error'))

    try {
      await publishToNpmProxy.publishToNpm({
        npmToken: 'a-token',
        opticUrl: 'https://optic-test.run.app/api/generate/',
        npmTag: 'latest',
        version: 'v5.1.3',
      })
    } catch (e) {
      assert.equal(e.message, 'Network Error')
    }

    sinon.assert.neverCalledWith(execWithOutputStub, 'npm', [
      'publish',
      '--otp',
      'otp123',
      '--tag',
      'latest',
    ])
    assert.pass('package is not published with otp code')

    sinon.assert.neverCalledWith(execWithOutputStub, 'npm', [
      'publish',
      '--tag',
      'latest',
    ])
    assert.pass('package is not published without otp code')
  }
)

test(
  'Should continue action if package info returns not found',
  async () => {
    const { publishToNpmProxy, execWithOutputStub } = setup({
      // Use original getPublishedInfo logic with execWithOutputStub injected into it
      mockPackageInfo: ({ getLocalInfo, execWithOutputStub }) => ({
        getLocalInfo,
        getPublishedInfo: proxyquire('../src/utils/packageInfo', {
          './execWithOutput': { execWithOutput: execWithOutputStub },
        }).getPublishedInfo,
      }),
    })

    execWithOutputStub
      .withArgs('npm', ['view', '--json'])
      .throws(new Error('code E404'))

    execWithOutputStub
      .withArgs('npm', ['view', 'fakeTestPkg@v5.1.3'])
      .returns('')

    await publishToNpmProxy.publishToNpm({
      npmToken: 'a-token',
      opticUrl: 'https://optic-test.run.app/api/generate/',
      npmTag: 'latest',
      version: 'v5.1.3',
    })

    sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
      'pack',
      '--dry-run',
    ])
    assert.pass('npm pack called')

    sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
      'publish',
      '--tag',
      'latest',
    ])
    assert.pass('npm publish called')
  }
)

test(
  'Should continue action if package version info returns not found',
  async () => {
    const { publishToNpmProxy, execWithOutputStub } = setup()

    execWithOutputStub
      .withArgs('npm', ['view', 'fakeTestPkg@v5.1.3'])
      .throws(new Error('code E404'))

    await publishToNpmProxy.publishToNpm({
      npmToken: 'a-token',
      opticUrl: 'https://optic-test.run.app/api/generate/',
      npmTag: 'latest',
      version: 'v5.1.3',
    })

    sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
      'pack',
      '--dry-run',
    ])
    assert.pass('npm pack called')

    sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
      'publish',
      '--tag',
      'latest',
    ])
    assert.pass('npm publish called')
  }
)

test('Adds --provenance flag when provenance option provided', async () => {
  const { publishToNpmProxy, execWithOutputStub } = setup()
  await publishToNpmProxy.publishToNpm({
    npmToken: 'a-token',
    opticUrl: 'https://optic-test.run.app/api/generate/',
    npmTag: 'latest',
    version: 'v5.1.3',
    provenance: true,
  })

  sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
    'publish',
    '--tag',
    'latest',
    '--provenance',
  ])
})

test('Adds --access flag if provided as an input', async () => {
  const { publishToNpmProxy, execWithOutputStub } = setup()
  await publishToNpmProxy.publishToNpm({
    npmToken: 'a-token',
    opticUrl: 'https://optic-test.run.app/api/generate/',
    npmTag: 'latest',
    version: 'v5.1.3',
    access: 'public',
  })

  sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
    'publish',
    '--tag',
    'latest',
    '--access',
    'public',
  ])
})

test('Should publish using ngrok for OTP verification', async () => {
  const { publishToNpmProxy, execWithOutputStub, otpVerificationStub } = setup({
    otpFlow: 'ngrok',
  })

  await publishToNpmProxy.publishToNpm({
    npmToken: 'a-token',
    ngrokToken: 'ngrok-token',
    npmTag: 'latest',
    version: 'v5.1.3',
  })

  sinon.assert.calledWithExactly(
    otpVerificationStub,
    { version: 'v5.1.3', name: 'fakeTestPkg' },
    'ngrok-token'
  )

  sinon.assert.calledWithExactly(execWithOutputStub, 'npm', [
    'publish',
    '--otp',
    'ngrok123',
    '--tag',
    'latest',
  ])
  assert.pass('npm publish called with ngrok OTP')
})

test('Should fail gracefully when ngrok services fail', async () => {
  const { publishToNpmProxy, otpVerificationStub } = setup({
    mockPackageInfo: ({ getLocalInfo, execWithOutputStub }) => ({
      getLocalInfo,
      getPublishedInfo: proxyquire('../src/utils/packageInfo', {
        './execWithOutput': { execWithOutput: execWithOutputStub },
      }).getPublishedInfo,
    }),
    otpFlow: 'ngrok',
  })

  // Mock failed otpVerification
  otpVerificationStub.throws(new Error('Ngrok failed'))

  await assert.rejects(
    publishToNpmProxy.publishToNpm({
      npmToken: 'a-token',
      ngrokToken: 'ngrok-token',
      npmTag: 'latest',
      version: 'v5.1.3',
    }),
    { message: 'OTP verification failed: Ngrok failed' }
  )
})

test(
  'Should fail gracefully when fail to receive otp from optic',
  async () => {
    const { publishToNpmProxy, execWithOutputStub } = setup({
      otpFlow: 'optic',
    })

    execWithOutputStub
      .withArgs('curl', [
        '-s',
        '-d',
        JSON.stringify({
          packageInfo: { version: 'v5.1.3', name: 'fakeTestPkg' },
        }),
        '-H',
        'Content-Type: application/json',
        '-X',
        'POST',
        'https://optic-test.run.app/api/generate/optic-token',
      ])
      .throws(new Error('Optic failed'))
    await assert.rejects(
      publishToNpmProxy.publishToNpm({
        npmToken: 'a-token',
        opticToken: 'optic-token',
        opticUrl: 'https://optic-test.run.app/api/generate/',
        npmTag: 'latest',
        version: 'v5.1.3',
      }),
      { message: 'OTP verification failed: Optic failed' }
    )
  }
)
