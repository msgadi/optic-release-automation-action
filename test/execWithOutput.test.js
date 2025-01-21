'use strict'

const { test } = require('node:test')
const assert = require('assert')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const { redactConfidentialArguments } = require('../src/utils/execWithOutput')

const setup = () => {
  const execStubInner = sinon.stub()
  return {
    execStub: execStubInner,
    execWithOutputModule: proxyquire('../src/utils/execWithOutput', {
      '@actions/exec': {
        exec: execStubInner,
      },
    }),
  }
}
const { execStub, execWithOutputModule } = setup()

test.afterEach(() => {
  sinon.restore()
})

test(
  'resolves with output of the exec command if exit code is 0',
  async () => {
    const output = 'output'

    execStub.callsFake((_, __, options) => {
      options.listeners.stdout(Buffer.from(output, 'utf8'))

      return Promise.resolve(0)
    })

    await assert.doesNotReject(execWithOutputModule.execWithOutput('ls', ['-al']), output)
    sinon.assert.calledWithExactly(execStub, 'ls', ['-al'], sinon.match({}))
  }
)

test(
  'Throws with output of the exec command if exit code is not 0',
  async () => {
    const output = 'output'

    execStub.callsFake((_, __, options) => {
      options.listeners.stderr(Buffer.from(output, 'utf8'))
      return Promise.reject(new Error())
    })

    await assert.rejects(
      () => execWithOutputModule.execWithOutput('ls', ['-al']),
      'Error: ls -al returned code 1  \nSTDOUT:  \nSTDERR: ${output}'
    )

    sinon.assert.calledWithExactly(execStub, 'ls', ['-al'], sinon.match({}))
  }
)

test('provides cwd to exec function', async () => {
  const cwd = './'

  execStub.resolves(0)
  await execWithOutputModule.execWithOutput('command', [], { cwd })
  sinon.assert.calledWithExactly(execStub, 'command', [], sinon.match({ cwd }))
})

test('rejects if exit code is not 0', async () => {
  const errorOutput = 'error output'

  execStub.callsFake((_, __, options) => {
    options.listeners.stderr(Buffer.from(errorOutput, 'utf8'))

    return Promise.resolve(1)
  })

  await assert.rejects(execWithOutputModule.execWithOutput('command'))
  sinon.assert.calledWithExactly(execStub, 'command', [], sinon.match({}))
})

test('passes env vars excluding `INPUT_*` env vars', async () => {
  const INPUT_NPM_TOKEN = 'some-secret-value'
  const INPUT_OPTIC_TOKEN = 'another-secret-value'
  const ACTIONS_ID_TOKEN_REQUEST_URL = 'https://example.com'
  const GITHUB_EVENT_NAME = 'someEvent'

  sinon.stub(process, 'env').value({
    ...process.env,
    INPUT_NPM_TOKEN,
    INPUT_OPTIC_TOKEN,
    ACTIONS_ID_TOKEN_REQUEST_URL,
    GITHUB_EVENT_NAME,
  })

  // Redo setup so it gets the new env vars
  const withEnv = setup()

  withEnv.execStub.resolves(0)
  withEnv.execWithOutputModule.execWithOutput('command', [])

  const envInExec = withEnv.execStub.firstCall.lastArg.env

  // Check custom env vars are preserved
  assert.deepStrictEqual(envInExec.ACTIONS_ID_TOKEN_REQUEST_URL, ACTIONS_ID_TOKEN_REQUEST_URL)
  assert.deepStrictEqual(envInExec.GITHUB_EVENT_NAME, GITHUB_EVENT_NAME)

  // Check INPUT_* env vars are removed
  assert.strictEqual(envInExec.INPUT_NPM_TOKEN, undefined)
  assert.strictEqual(envInExec.INPUT_OPTIC_TOKEN, undefined)

  // Check "real" env vars are preserved.
  // Its value will vary by test runner, so just check it is present.
  assert.ok(envInExec.NODE)
})

test('Invalid arguments inputs should not fail', async () => {
  const redactedBlankArray = redactConfidentialArguments([])
  const redactedUndefinedArray = redactConfidentialArguments(undefined)
  const redactedNullArray = redactConfidentialArguments(null)

  assert.strictEqual(Array.isArray(redactedBlankArray), true)
  assert.strictEqual(Array.isArray(redactedUndefinedArray), true)
  assert.strictEqual(Array.isArray(redactedNullArray), true)

  assert.strictEqual(redactedBlankArray.length, 0)
  assert.strictEqual(redactedUndefinedArray.length, 0)
  assert.strictEqual(redactedNullArray.length, 0)
})

test('Valid arguments inputs should pass', async () => {
  const args = ['publish', '--tag', 'latest', '--access', 'public']

  const otp = '1827Sdys7'

  const arrayWithOTP = [...args.slice(0, 2), '--otp', otp, ...args.slice(2)]
  const arrayWithOTPInStart = ['--otp', otp, ...args]
  const arrayWithOTPAtEnd = [...args, '--otp', otp]

  const redactedArray1 = redactConfidentialArguments(arrayWithOTP)
  const redactedArray2 = redactConfidentialArguments(arrayWithOTPInStart)
  const redactedArray3 = redactConfidentialArguments(arrayWithOTPAtEnd)
  const redactedArray4 = redactConfidentialArguments(args)

  assert.strictEqual(
    Array.isArray(redactedArray1),
    true,
    'Failed - [Array with OTP] - Output Not An Array'
  )
  assert.strictEqual(
    redactedArray1.length,
    arrayWithOTP.length - 2,
    'Failed - [Array with OTP] - Output Array Length not matching>>'
  )
  assert.strictEqual(
    redactedArray1.includes('--otp'),
    false,
    'Failed - [Array with OTP] - OTP Keyword is found in Output Array'
  )
  assert.strictEqual(
    redactedArray1.includes(otp),
    false,
    'Failed - [Array with OTP] - OTP Value is found in Output Array'
  )

  assert.strictEqual(
    Array.isArray(redactedArray2),
    true,
    'Failed - [Array with OTP in start] - Output Not An Array'
  )
  assert.strictEqual(
    redactedArray2.length,
    arrayWithOTPInStart.length - 2,
    'Failed - [Array with OTP in start] - Output Array Length not matching'
  )
  assert.strictEqual(
    redactedArray2.includes('--otp'),
    false,
    'Failed - [Array with OTP in start] - OTP Keyword is found in Output Array'
  )
  assert.strictEqual(
    redactedArray2.includes(otp),
    false,
    'Failed - [Array with OTP in start] - OTP Value is found in Output Array'
  )

  assert.strictEqual(
    Array.isArray(redactedArray3),
    true,
    'Failed - [Array with OTP in end] - Output Not An Array'
  )
  assert.strictEqual(
    redactedArray3.length,
    arrayWithOTPAtEnd.length - 2,
    'Failed - [Array with OTP in end] - Output Array Length not matching'
  )
  assert.strictEqual(
    redactedArray3.includes('--otp'),
    false,
    'Failed - [Array with OTP in end] - OTP Keyword is found in Output Array'
  )
  assert.strictEqual(
    redactedArray3.includes(otp),
    false,
    'Failed - [Array with OTP in end] - OTP Value is found in Output Array'
  )

  assert.strictEqual(
    Array.isArray(redactedArray4),
    true,
    'Failed - [Array with no OTP] - Output Not An Array'
  )
  assert.strictEqual(
    redactedArray4.length,
    args.length,
    'Failed - [Array with no OTP] - Output Array Length not matching'
  )
})

test('Otp should be redacted from args in case of an error', async () => {
  const args = ['publish', '--tag', 'latest', '--access', 'public']

  const otp = '872333'

  const arrayWithOTP = [...args.slice(0, 2), '--otp', otp, ...args.slice(2)]
  const arrayWithOTPInStart = ['--otp', otp, ...args]
  const arrayWithOTPAtEnd = [...args, '--otp', otp]

  const errorObject1 = await assert.rejects(
    execWithOutputModule.execWithOutput('ls', arrayWithOTP)
  )
  const errorObject2 = await assert.rejects(
    execWithOutputModule.execWithOutput('ls', arrayWithOTPInStart)
  )
  const errorObject3 = await assert.rejects(
    execWithOutputModule.execWithOutput('ls', arrayWithOTPAtEnd)
  )
  const errorObject4 = await assert.rejects(
    execWithOutputModule.execWithOutput('ls', args)
  )

  assert.strictEqual(
    errorObject1.message.indexOf('--otp'),
    -1,
    'Failed - [Array with OTP] - OTP Keyword is found in Error Output'
  )
  assert.strictEqual(
    errorObject1.message.indexOf(otp),
    -1,
    'Failed - [Array with OTP] - OTP Value is found in Error Output'
  )

  assert.strictEqual(
    errorObject2.message.indexOf('--otp'),
    -1,
    'Failed - [Array with OTP in start] - OTP Keyword is found in Error Output'
  )
  assert.strictEqual(
    errorObject2.message.indexOf(otp),
    -1,
    'Failed - [Array with OTP in start] - OTP Value is found in Error Output'
  )

  assert.strictEqual(
    errorObject3.message.indexOf('--otp'),
    -1,
    'Failed - [Array with OTP in end] - OTP Keyword is found in Error Output'
  )
  assert.strictEqual(
    errorObject3.message.indexOf(otp),
    -1,
    'Failed - [Array with OTP in end] - OTP Value is found in Error Output'
  )

  assert.strictEqual(
    errorObject4.message.indexOf('--tag') > -1,
    true,
    'Failed - [Array without OTP] - Expected Keyword is not found in Error Output'
  )
  assert.strictEqual(
    errorObject4.message.indexOf('latest') > -1,
    true,
    'Failed - [Array without OTP] - Expected Value is not found in Error Output'
  )
})
