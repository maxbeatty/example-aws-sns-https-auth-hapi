const Hapi = require('hapi')
const Joi = require('joi')
const Boom = require('boom')
const https = require('https')

const internals = {}

internals.auth = function (request, username, password, callback) {
  callback(null, (username === 'alice' && password === 'example'), {})
}

const server = new Hapi.Server()
server.connection()

server.register(require('hapi-auth-basic'), (err) => {
  if (err) throw err

  server.auth.strategy('default', 'basic', 'required', {
    validateFunc: internals.auth
  })

  server.route({
    method: 'POST',
    path: '/sns',
    config: {
      auth: 'default',
      validate: {
        payload: Joi.object().keys({
          Type: Joi.string(),
          MessageId: Joi.string(),
          Token: Joi.string().token().optional(),
          TopicArn: Joi.string(),
          Subject: Joi.string().optional(),
          Message: Joi.string(),
          SubscribeURL: Joi.string().uri().optional(),
          UnsubscribeURL: Joi.string().uri().optional(),
          Timestamp: Joi.string().isoDate(),
          SignatureVersion: Joi.string(),
          Signature: Joi.string(),
          SigningCertURL: Joi.string().uri()
        })
      },
      handler: function (request, reply) {
        switch (request.headers['x-amz-sns-message-type']) {
          case 'SubscriptionConfirmation':
            https
              .get(request.payload.SubscribeURL)
              .on('error', function (err) {
                reply(Boom.wrap(err))
              })
              .on('response', function (res) {
                if (res.statusCode !== 200) {
                  reply(Boom.badImplementation('unsuccessful response from SubscribeURL', {
                    statusCode: res.statusCode
                  }))
                } else {
                  reply()
                }
              })
            break
          case 'Notification':
            // TODO: process notification
            reply()
          default:
            reply(Boom.notAcceptable())
        }
      }
    }
  })

  server.start((err) => {
    if (err) throw err

    console.log('Server started at: ' + server.info.uri)
  })
})
