'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire').noCallThru()
const sinon = require('sinon')
const fastify = require('fastify')
const fs = require('fs')
const { logInfo } = require('../src/log')

const otpHtml = fs.readFileSync(__dirname + '/../src/utils/assets/otp.html', 'utf8')

const otpVerification = proxyquire('../src/utils/otpVerification', {
  fastify: fastify,
  fs: {
    readFileSync: sinon.stub().returns(otpHtml),
  },
  '../log': {
    logInfo: logInfo,
  },
})

tap.afterEach(() => {
  sinon.restore()
})

tap.test('otpVerification should return OTP when provided', async t => {
  const app = fastify()
  const packageInfo = { name: 'test-package', version: '1.0.0', tunnelUrl: 'http://localhost:3000' }

  const otpPromise = otpVerification(packageInfo)

  app.post('/otp', async (req, reply) => {
    reply.send('OTP received. You can close this window.')
  })

  await app.listen({ port: 3000 })

  const response = await app.inject({
    method: 'POST',
    url: '/otp',
    payload: { otp: '123456' },
  })

  t.equal(response.statusCode, 200)
  t.equal(response.body, 'OTP received. You can close this window.')

  const otp = await otpPromise
  t.equal(otp, '123456')

  await app.close()
  t.end()
})

tap.test('otpVerification should timeout if OTP is not provided', async t => {
  const app = fastify()
  const packageInfo = { name: 'test-package', version: '1.0.0', tunnelUrl: 'http://localhost:3000' }

  const otpPromise = otpVerification(packageInfo)

  await app.listen({ port: 3000 })

  const otp = await otpPromise
  t.equal(otp, '')

  await app.close()
  t.end()
})

tap.test('otpVerification should handle errors during OTP collection', async t => {
  const app = fastify()
  const packageInfo = { name: 'test-package', version: '1.0.0', tunnelUrl: 'http://localhost:3000' }

  const otpPromise = otpVerification(packageInfo)

  app.post('/otp', async (req, reply) => {
    throw new Error('Test error')
  })

  await app.listen({ port: 3000 })

  const response = await app.inject({
    method: 'POST',
    url: '/otp',
    payload: { otp: '123456' },
  })

  t.equal(response.statusCode, 500)
  t.match(response.body, /Error during OTP collection/)

  const otp = await otpPromise.catch(err => err.message)
  t.match(otp, /Error during OTP collection/)

  await app.close()
  t.end()
})
